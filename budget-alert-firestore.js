
const { FieldValue } = require("@google-cloud/firestore");
const { getPendingBudgetAlerts } = require("./budget-alert-state");

async function createTransactionWithBudgetAlerts({
  db,
  uid,
  transactionRef,
  transactionData
}) {
  return db.runTransaction(async (tx) => {
    const data = transactionData;

    if (data.type !== "expense") {
      tx.create(transactionRef, data);
      return { alerts: [] };
    }

    const budgetId = `${data.categoryId}_${data.month}`;

    const budgetRef = db.collection("users")
      .doc(uid)
      .collection("budgets")
      .doc(budgetId);

    // Read all required data before writing
    const budgetDoc = await tx.get(budgetRef);

    if (!budgetDoc.exists) {
      tx.create(transactionRef, data);
      return { alerts: [] };
    }

    const budget = budgetDoc.data();

    const query = db.collection("users")
      .doc(uid)
      .collection("transactions")
      .where("month", "==", data.month);

    const snapshot = await tx.get(query);

    let previousSpent = 0;

    for (const doc of snapshot.docs) {
      const item = doc.data();

      if (
        item.type === "expense" &&
        item.categoryId === data.categoryId
      ) {
        if (!Number.isSafeInteger(item.amount) || item.amount <= 0) {
          throw new Error("Giao dich co so tien khong hop le");
        }

        previousSpent += item.amount;

        if (!Number.isSafeInteger(previousSpent)) {
          throw new Error("Tong chi tieu vuot gioi han an toan");
        }
      }
    }

    const currentSpent = previousSpent + data.amount;

    if (!Number.isSafeInteger(currentSpent)) {
      throw new Error("Tong chi tieu vuot gioi han an toan");
    }

    const alerts = getPendingBudgetAlerts({
      currentSpent,
      limitAmount: budget.limitAmount,
      warningAlerted: Boolean(budget.warningAlerted),
      exceededAlerted: Boolean(budget.exceededAlerted)
    });

    tx.create(transactionRef, data);

    if (alerts.length > 0) {
      const update = {
        updatedAt: FieldValue.serverTimestamp()
      };

      if (alerts.includes("budget.warning")) {
        update.warningAlerted = true;
      }

      if (alerts.includes("budget.exceeded")) {
        update.exceededAlerted = true;
      }

      tx.update(budgetRef, update);

      for (const event of alerts) {
        const eventRef = db.collection("users")
          .doc(uid)
          .collection("budget-alert-outbox")
          .doc(`${transactionRef.id}_${event}`);

        tx.create(eventRef, {
          event,
          uid,
          budgetId,
          transactionId: transactionRef.id,
          categoryId: data.categoryId,
          month: data.month,
          previousSpent,
          currentSpent,
          limitAmount: budget.limitAmount,
          status: "pending",
          createdAt: FieldValue.serverTimestamp()
        });
      }
    }

    return { alerts };
  });
}

module.exports = { createTransactionWithBudgetAlerts };
