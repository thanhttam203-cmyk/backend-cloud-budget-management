
const { publishBudgetAlert } = require("./budget-alert-publisher");

async function processBudgetAlertOutbox({
  db,
  pubsub,
  uid,
  topicName,
  limit = 10
}) {
  if (!db || !pubsub || !uid || !topicName) {
    throw new Error("Thieu cau hinh xu ly Outbox");
  }

  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw new Error("limit phai tu 1 den 100");
  }

  const collection = db.collection("users")
    .doc(uid)
    .collection("budget-alert-outbox");

  const snapshot = await collection
    .where("status", "==", "pending")
    .limit(limit)
    .get();

  const results = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();

    try {
      const result = await publishBudgetAlert({
        pubsub,
        topicName,
        event: {
          ...data,
          id: doc.id
        }
      });

      await doc.ref.update({
        status: "sent",
        messageId: result.messageId,
        sentAt: new Date().toISOString()
      });

      results.push({
        id: doc.id,
        status: "sent",
        messageId: result.messageId
      });
    } catch (error) {
      results.push({
        id: doc.id,
        status: "pending",
        error: error.message
      });
    }
  }

  return {
    processed: results.length,
    sent: results.filter(r => r.status === "sent").length,
    results
  };
}

module.exports = { processBudgetAlertOutbox };

