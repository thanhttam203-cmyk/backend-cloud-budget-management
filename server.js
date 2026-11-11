const {
  createTransactionWithBudgetAlerts
} = require("./budget-alert-firestore");
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}
const express = require("express");
const cors = require("cors");
const { Firestore, FieldValue } = require("@google-cloud/firestore");
const { PubSub } = require("@google-cloud/pubsub");
const { Storage } = require("@google-cloud/storage");
const multer = require("multer");
const crypto = require("crypto");
const { calculateBudgetProgress } = require("./budget-progress");
const { evaluateBudgetAlert } = require("./budget-alert-service");
const { processBudgetAlertOutbox } = require("./budget-alert-outbox");

const BUDGET_ALERT_TOPIC =
  process.env.BUDGET_ALERT_TOPIC || "budget-alerts";
const app = express();
const PORT = Number(process.env.PORT) || 8080;
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
const TOPIC_NAME = process.env.PUBSUB_TOPIC || "transaction-created";
const RECEIPTS_BUCKET = process.env.RECEIPTS_BUCKET;
// Firestore documents are scoped to the verified Firebase Authentication UID.
const { getApps, initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
if (!getApps().length) initializeApp();

async function requireAuth(req, res, next) {
  // Explicit local-only testing mode; never enabled in Cloud Run production.
  if (process.env.NODE_ENV !== "production" && process.env.ENABLE_DEV_AUTH === "true") {
    const uid = process.env.DEV_UID;
    if (!uid) return res.status(503).json({ error: "Chưa cấu hình DEV_UID" });
    req.uid = uid;
    return next();
  }
  const match = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || "");
  if (!match) return res.status(401).json({ error: "Cần Firebase ID token trong Authorization: Bearer ..." });
  try {
    const decoded = await getAuth().verifyIdToken(match[1]);
    req.uid = decoded.uid;
    return next();
  } catch (error) {
    return res.status(401).json({ error: "Firebase ID token không hợp lệ hoặc hết hạn" });
  }
}


app.use(cors({ origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : true }));
app.use(express.json({ limit: "1mb" }));

// ADC: local dùng gcloud ADC; Cloud Run dùng service account.
// Cloud Run IAM phải bật xác thực (không cho phép unauthenticated).
const db = new Firestore(PROJECT_ID ? { projectId: PROJECT_ID } : undefined);
const pubsub = new PubSub(PROJECT_ID ? { projectId: PROJECT_ID } : undefined);
const storage = new Storage(PROJECT_ID ? { projectId: PROJECT_ID } : undefined);

const DEFAULT_CATEGORIES = [
  { id: "an-uong", name: "Ăn uống", type: "expense", icon: "restaurant", isDefault: true },
  { id: "di-lai", name: "Đi lại", type: "expense", icon: "directions_car", isDefault: true },
  { id: "nha-o", name: "Nhà ở", type: "expense", icon: "home", isDefault: true },
  { id: "hoc-tap", name: "Học tập", type: "expense", icon: "school", isDefault: true },
  { id: "giai-tri", name: "Giải trí", type: "expense", icon: "sports_esports", isDefault: true },
  { id: "mua-sam", name: "Mua sắm", type: "expense", icon: "shopping_cart", isDefault: true },
  { id: "suc-khoe", name: "Sức khỏe", type: "expense", icon: "favorite", isDefault: true },
  { id: "thu-nhap", name: "Thu nhập", type: "income", icon: "payments", isDefault: true },
  { id: "khac", name: "Khác", type: "expense", icon: "category", isDefault: true }
];

const userCollection = (uid, name) => db.collection("users").doc(uid).collection(name);
const isValidMonth = value => typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

const { transactionInput, toTransaction, toBudget } = require("./api-schema");
async function getSpent(uid, month, category) {
  const snap = await userCollection(uid, "transactions").where("month", "==", month).get();
  let spent = 0;
  for (const doc of snap.docs) {
    const tx = doc.data();
    if (tx.type === "expense" && (tx.category ?? tx.categoryId) === category) {
      if (!Number.isSafeInteger(tx.amount) || tx.amount <= 0 ||
          !Number.isSafeInteger(spent + tx.amount)) throw new Error("Dữ liệu chi tiêu không hợp lệ");
      spent += tx.amount;
    }
  }
  return spent;
}
function validateTransaction(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "Body phải là JSON object";
  if (!Number.isSafeInteger(body.amount) || body.amount <= 0) return "amount phải là số nguyên dương tính bằng VND";
  if (!["expense", "income"].includes(body.type)) return "type chỉ nhận expense hoặc income";
  if (typeof body.categoryId !== "string" || !body.categoryId.trim()) return "category là bắt buộc";
  if (!isValidDate(body.date)) return "date phải là ngày hợp lệ theo định dạng YYYY-MM-DD";
  if (body.note !== undefined && typeof body.note !== "string") return "note phải là chuỗi";
  if (body.receiptPath !== undefined && body.receiptPath !== null && typeof body.receiptPath !== "string") return "receiptPath phải là chuỗi hoặc null";
  return null;
}

async function categoryExists(uid, categoryId) {
  if (DEFAULT_CATEGORIES.some(c => c.id === categoryId)) return true;
  const doc = await userCollection(uid, "categories").doc(categoryId).get();
  return doc.exists;
}

app.get("/", (req, res) => res.json({ name: "Quản lý chi tiêu API", status: "ok", health: "/health" }));
app.get("/health", (req, res) =>
  res.json({
    status: "ok",
    message: "Backend API đang hoạt động",
    mode: "firestore-pubsub"
  })
);

app.use(requireAuth);

app.get("/transactions", async (req, res, next) => {
  try {
    const { month, type, categoryId } = req.query;
    if (month && !isValidMonth(month)) return res.status(400).json({ error: "month phải có định dạng YYYY-MM" });
    if (type && !["expense", "income"].includes(type)) return res.status(400).json({ error: "type chỉ nhận expense hoặc income" });
    let query = userCollection(req.uid, "transactions");
    if (month) query = query.where("month", "==", month);
    const snap = await query.get();
    const filterCategory = req.query.category || categoryId;
    const data = snap.docs.map(d => toTransaction(d.id, d.data()))
      .filter(t => (!type || t.type === type) && (!filterCategory || t.category === filterCategory))
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
    return res.json({ total: data.length, data });
  } catch (e) { return next(e); }
});

app.post("/transactions", async (req, res, next) => {
  try {
    const input = transactionInput(req.body);
    const validationError = validateTransaction(input);
    if (validationError) return res.status(400).json({ error: validationError });
    if (!(await categoryExists(req.uid, input.categoryId))) return res.status(400).json({ error: "category không tồn tại" });
    const uid = req.uid;
    const ref = userCollection(uid, "transactions").doc();
    const data = {
      amount: input.amount, type: input.type, category: input.categoryId,
      date: input.date, month: input.date.slice(0, 7), note: (input.note || "").trim(),
      receiptPath: input.receiptPath || null,
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
    };
   await createTransactionWithBudgetAlerts({
  db,
  uid,
  transactionRef: ref,
  transactionData: data
});
try {
  const outboxResult = await processBudgetAlertOutbox({
    db,
    pubsub,
    uid,
    topicName: BUDGET_ALERT_TOPIC,
    limit: 10
  });

  console.log("Budget alert Outbox:", outboxResult);
} catch (error) {
  console.error("Không xử lý được Budget alert Outbox:", error.message);
}
    try {
      await pubsub.topic(TOPIC_NAME).publishMessage({
        data: Buffer.from(JSON.stringify({
          event: "transaction.created", transactionId: ref.id, uid, categoryId: data.category,
          month: data.month, type: data.type, amount: data.amount, createdAt: new Date().toISOString()
        }))
      });
    } catch (pubsubError) {
      console.error("Không gửi được sự kiện Pub/Sub (giao dịch đã lưu):", pubsubError.message);
    }
    const saved = await ref.get();
    return res.status(201).json({ message: "Thêm giao dịch thành công", data: toTransaction(ref.id, saved.data()) });
  } catch (e) { return next(e); }
});

app.put("/transactions/:id", async (req, res, next) => {
  try {
    const input = transactionInput(req.body);
    const validationError = validateTransaction(input);
    if (validationError) return res.status(400).json({ error: validationError });
    if (!(await categoryExists(req.uid, input.categoryId))) return res.status(400).json({ error: "category không tồn tại" });
    const ref = userCollection(req.uid, "transactions").doc(req.params.id);
    const current = await ref.get();
    if (!current.exists) return res.status(404).json({ error: "Không tìm thấy giao dịch" });
    const updated = {
      amount: input.amount, type: input.type, category: input.categoryId,
      date: input.date, month: input.date.slice(0, 7), note: (input.note || "").trim(),
      receiptPath: input.receiptPath === undefined ? (current.data().receiptPath || null) : input.receiptPath,
      updatedAt: FieldValue.serverTimestamp()
    };
    await ref.update(updated);
    const saved = await ref.get();
    return res.json({ message: "Cập nhật giao dịch thành công", data: toTransaction(ref.id, saved.data()) });
  } catch (e) { return next(e); }
});

app.delete("/transactions/:id", async (req, res, next) => {
  try {
    const ref = userCollection(req.uid, "transactions").doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: "Không tìm thấy giao dịch" });
    await ref.delete();
    return res.json({ message: "Xóa giao dịch thành công", id: req.params.id });
  } catch (e) { return next(e); }
});

app.get("/categories", async (req, res, next) => {
  try {
    const snap = await userCollection(req.uid, "categories").get();
    const custom = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const merged = [...DEFAULT_CATEGORIES, ...custom.filter(c => !DEFAULT_CATEGORIES.some(d => d.id === c.id))];
    return res.json({ total: merged.length, data: merged });
  } catch (e) { return next(e); }
});

app.post("/categories", async (req, res, next) => {
  try {
    const { id, name, type, icon } = req.body || {};
    if (typeof name !== "string" || !name.trim()) return res.status(400).json({ error: "name là bắt buộc" });
    if (!["expense", "income"].includes(type)) return res.status(400).json({ error: "type chỉ nhận expense hoặc income" });
    const categoryId = (typeof id === "string" && /^[a-zA-Z0-9_-]+$/.test(id))
      ? id
      : name.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!categoryId) return res.status(400).json({ error: "Không tạo được id danh mục" });
    if (DEFAULT_CATEGORIES.some(c => c.id === categoryId)) return res.status(409).json({ error: "ID danh mục mặc định đã tồn tại" });
    const ref = userCollection(req.uid, "categories").doc(categoryId);
    if ((await ref.get()).exists) return res.status(409).json({ error: "Danh mục đã tồn tại" });
    const data = { name: name.trim(), type, icon: typeof icon === "string" ? icon : "category", isDefault: false, createdAt: FieldValue.serverTimestamp() };
    await ref.set(data);
    return res.status(201).json({ message: "Tạo danh mục thành công", data: { id: categoryId, ...data } });
  } catch (e) { return next(e); }
});

app.get("/budgets", async (req, res, next) => {
  try {
    const { month } = req.query;
    if (month && !isValidMonth(month)) return res.status(400).json({ error: "month phải có định dạng YYYY-MM" });
    let query = userCollection(req.uid, "budgets");
    if (month) query = query.where("month", "==", month);
    const snap = await query.get();
    const data = await Promise.all(snap.docs.map(async doc => {
      const budget = doc.data();
      const category = budget.category ?? budget.categoryId;
      const spent = await getSpent(req.uid, budget.month, category);
      return toBudget(doc.id, budget, spent);
    }));
    return res.json({ total: data.length, data });
  } catch (e) { return next(e); }
});

app.post("/budgets", async (req, res, next) => {
  try {
    const { month } = req.body || {};
    const categoryId = req.body?.category ?? req.body?.categoryId;
    const limitAmount = req.body?.limit ?? req.body?.limitAmount;
    if (typeof categoryId !== "string" || !(await categoryExists(req.uid, categoryId))) return res.status(400).json({ error: "category không tồn tại" });
    if (!isValidMonth(month)) return res.status(400).json({ error: "month phải có định dạng YYYY-MM" });
    if (!Number.isSafeInteger(limitAmount) || limitAmount <= 0) return res.status(400).json({ error: "limit phải là số nguyên dương tính bằng VND" });
    const id = `${categoryId}_${month}`;
    const ref = userCollection(req.uid, "budgets").doc(id);
    const old = await ref.get();
    const data = {
      category: categoryId, month, limit: limitAmount,
alerted: old.exists ? Boolean(old.data().alerted) : false,
warningAlerted: old.exists
  ? Boolean(old.data().warningAlerted)
  : false,
exceededAlerted: old.exists
  ? Boolean(old.data().exceededAlerted)
  : false,

      updatedAt: FieldValue.serverTimestamp()
    };
    if (!old.exists) data.createdAt = FieldValue.serverTimestamp();
    await ref.set(data, { merge: true });
    return res.status(old.exists ? 200 : 201).json({
      message: old.exists ? "Cập nhật ngân sách thành công" : "Tạo ngân sách thành công",
      data: toBudget(id, data, await getSpent(req.uid, month, categoryId))
    });
  } catch (e) { return next(e); }
});

app.delete("/budgets/:id", async (req, res, next) => {
  try {
    const ref = userCollection(req.uid, "budgets").doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: "Không tìm thấy ngân sách" });
    await ref.delete();
    return res.json({ message: "Xóa ngân sách thành công", id: req.params.id });
  } catch (e) { return next(e); }
});

//
// GET /budgets/:id/progress
// Tính tiến độ ngân sách từ dữ liệu Firestore
//
app.get("/budgets/:id/progress", async (req, res, next) => {
  try {
    const budgetId = req.params.id;

    // Đọc ngân sách
    const budgetRef = userCollection(
      req.uid,
      "budgets"
    ).doc(budgetId);

    const budgetDoc = await budgetRef.get();

    if (!budgetDoc.exists) {
      return res.status(404).json({
        error: "Không tìm thấy ngân sách"
      });
    }

    const budget = budgetDoc.data();

    if (!isValidMonth(budget.month)) {
      return res.status(400).json({
        error: "Tháng ngân sách không hợp lệ"
      });
    }

    // Đọc giao dịch đúng tháng
    const snapshot = await userCollection(
      req.uid,
      "transactions"
    )
      .where("month", "==", budget.month)
      .get();

    // Chỉ cộng giao dịch chi tiêu cùng danh mục
    let currentSpent = 0;

    for (const doc of snapshot.docs) {
      const item = doc.data();

      if (
        item.type === "expense" &&
        (item.category ?? item.categoryId) === (budget.category ?? budget.categoryId)
      ) {
        if (
          !Number.isSafeInteger(item.amount) ||
          item.amount <= 0
        ) {
          return res.status(422).json({
            error: "Có giao dịch chứa số tiền không hợp lệ"
          });
        }

        currentSpent += item.amount;

        if (!Number.isSafeInteger(currentSpent)) {
          return res.status(422).json({
            error: "Tổng chi tiêu vượt giới hạn an toàn"
          });
        }
      }
    }

    const progress = calculateBudgetProgress(
      currentSpent,
      (budget.limit ?? budget.limitAmount)
    );

    return res.status(200).json({
      budgetId: budgetDoc.id,
      category: (budget.category ?? budget.categoryId),
      month: budget.month,
      limit: progress.limitAmount,
      spent: progress.currentSpent,
      percentage: progress.percentage,
      remainingAmount: progress.remainingAmount,
      status: progress.status
    });

  } catch (error) {
    next(error);
  }
});

app.post("/budgets/:id/check-alert", async (req, res, next) => {
  try {
    const { previousSpent } = req.body || {};

    if (!Number.isSafeInteger(previousSpent) || previousSpent < 0) {
      return res.status(400).json({
        error: "previousSpent phải là số nguyên không âm"
      });
    }

    const budgetDoc = await userCollection(
      req.uid,
      "budgets"
    ).doc(req.params.id).get();

    if (!budgetDoc.exists) {
      return res.status(404).json({
        error: "Không tìm thấy ngân sách"
      });
    }

    const budget = budgetDoc.data();

    if (!isValidMonth(budget.month)) {
      return res.status(422).json({
        error: "Tháng ngân sách không hợp lệ"
      });
    }

    const snapshot = await userCollection(
      req.uid,
      "transactions"
    )
      .where("month", "==", budget.month)
      .get();

    let currentSpent = 0;

    for (const doc of snapshot.docs) {
      const tx = doc.data();

      if (
        tx.type === "expense" &&
        (tx.category ?? tx.categoryId) === (budget.category ?? budget.categoryId)
      ) {
        if (!Number.isSafeInteger(tx.amount) || tx.amount <= 0) {
          return res.status(422).json({
            error: "Giao dịch có số tiền không hợp lệ"
          });
        }

        currentSpent += tx.amount;

        if (!Number.isSafeInteger(currentSpent)) {
          return res.status(422).json({
            error: "Tổng chi tiêu vượt giới hạn an toàn"
          });
        }
      }
    }

    const result = evaluateBudgetAlert(
      previousSpent,
      currentSpent,
      (budget.limit ?? budget.limitAmount)
    );

    return res.json({
      budgetId: budgetDoc.id,
      month: budget.month,
      category: (budget.category ?? budget.categoryId),
      ...result
    });

  } catch (error) {
    next(error);
  }
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.mimetype)) return cb(new Error("Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP"));
    cb(null, true);
  }
});

app.post("/receipts/upload", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Thiếu file ảnh ở field 'file'" });
    if (!RECEIPTS_BUCKET) return res.status(503).json({ error: "Chưa cấu hình biến môi trường RECEIPTS_BUCKET" });
    const ext = ({ "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" })[req.file.mimetype];
    const objectName = `receipts/${req.uid}/${Date.now()}-${crypto.randomUUID()}${ext}`;
    const bucket = storage.bucket(RECEIPTS_BUCKET);
    const file = bucket.file(objectName);
    await file.save(req.file.buffer, {
      resumable: false,
      metadata: { contentType: req.file.mimetype, cacheControl: "private, max-age=0" }
    });
    return res.status(201).json({
      message: "Tải ảnh hóa đơn thành công",
      data: { receiptPath: `gs://${RECEIPTS_BUCKET}/${objectName}`, objectName, bucket: RECEIPTS_BUCKET }
    });
  } catch (e) { return next(e); }
});

app.get("/reports/summary", async (req, res, next) => {
  try {
    const month = req.query.month;
    if (!isValidMonth(month)) return res.status(400).json({ error: "month phải có định dạng YYYY-MM" });
    const snap = await userCollection(req.uid, "transactions").where("month", "==", month).get();
    const txs = snap.docs.map(d => d.data());
    const totalIncome = txs.filter(t => t.type === "income").reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const totalExpense = txs.filter(t => t.type === "expense").reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const expensesByCategory = {};
    for (const t of txs) {
      if (t.type === "expense") expensesByCategory[t.category ?? t.categoryId] = (expensesByCategory[t.category ?? t.categoryId] || 0) + Number(t.amount || 0);
    }
    return res.json({ month, totalIncome, totalExpense, balance: totalIncome - totalExpense, expensesByCategory });
  } catch (e) { return next(e); }
});

app.use((req, res) => res.status(404).json({ error: "Endpoint không tồn tại" }));
app.use((err, req, res, next) => {
  console.error("Lỗi hệ thống:", err);
  if (res.headersSent) return next(err);
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.code === "LIMIT_FILE_SIZE" ? "Ảnh tối đa 5 MB" : "File upload không hợp lệ" });
  }
  if (err.message === "Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP") return res.status(400).json({ error: err.message });
  return res.status(500).json({ error: "Lỗi server" });
});

app.listen(PORT, () => console.log(`Backend API đang chạy tại cổng ${PORT}`));
