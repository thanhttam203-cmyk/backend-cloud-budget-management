
const assert = require("node:assert/strict");

const {
  processBudgetEmailOutbox
} = require("./budget-alert-email-outbox");

process.env.EMAIL_ALERT_ENABLED = "true";

let sendCount = 0;

const data = {
  uid: "user-001",
  event: "budget.warning",
  categoryId: "an-uong",
  month: "2026-11",
  limitAmount: 2000000,
  currentSpent: 1700000,
  status: "pending",
  emailStatus: "pending"
};

const ref = {
  update: async values => {
    Object.assign(data, values);
  }
};

const doc = {
  id: "alert-001",
  ref,
  exists: true,
  data: () => ({ ...data })
};

const db = {
  collection() { return this; },
  doc() { return this; },
  where() { return this; },
  limit() { return this; },

  async get() {
    const docs = data.emailStatus === "pending"
      ? [doc] : [];

    return { docs, size: docs.length };
  },

  async runTransaction(callback) {
    return callback({
      get: async () => doc,
      update: (_, values) => {
        Object.assign(data, values);
      }
    });
  }
};

async function test() {
  const options = {
    db,
    uid: "user-001",

    lookupEmail: async uid => {
      assert.equal(uid, "user-001");
      return "test@example.com";
    },

    processEmail: async ({ event, getUserEmail }) => {
      const email = await getUserEmail(event.uid);

      assert.equal(email, "test@example.com");
      sendCount++;

      return {
        sent: true,
        messageId: "mock-email-001"
      };
    }
  };

  const first = await processBudgetEmailOutbox(options);

  assert.equal(first.sent, 1);
  console.log("PASS - Xu ly Email Outbox");

  assert.equal(data.emailStatus, "sent");
  assert.ok(data.emailSentAt);
  assert.equal(data.emailMessageId, "mock-email-001");
  console.log("PASS - Luu trang thai gui email");

  assert.equal(data.status, "pending");
  console.log("PASS - Email doc lap voi PubSub");

  const second = await processBudgetEmailOutbox(options);

  assert.equal(second.sent, 0);
  assert.equal(sendCount, 1);
  console.log("PASS - Khong gui lai email da xu ly");

  console.log("========================");
  console.log("KET QUA: 4/4 PASS");
  console.log("Khong su dung Google Cloud");
}

test().catch(error => {
  console.error("FAIL:", error.message);
  process.exitCode = 1;
});
