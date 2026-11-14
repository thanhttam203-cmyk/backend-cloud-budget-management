
const {
  processBudgetAlertEmail
} = require("./budget-alert-email");

const {
  getUserEmail
} = require("./firebase-user-email");

async function processBudgetEmailOutbox({
  db,
  uid,
  limit = 10,
  lookupEmail = getUserEmail,
  processEmail = processBudgetAlertEmail
}) {
  if (process.env.EMAIL_ALERT_ENABLED !== "true") {
    return { processed: 0, sent: 0 };
  }

  const collection = db.collection("users")
    .doc(uid)
    .collection("budget-alert-outbox");

  const snapshot = await collection
    .where("emailStatus", "==", "pending")
    .limit(limit)
    .get();

  let sent = 0;

  for (const doc of snapshot.docs) {
    const event = await db.runTransaction(async tx => {
      const current = await tx.get(doc.ref);

      if (!current.exists ||
          current.data().emailStatus !== "pending" ||
          current.data().uid !== uid) {
        return null;
      }

      tx.update(doc.ref, {
        emailStatus: "processing",
        emailProcessingAt: new Date().toISOString()
      });

      return current.data();
    });

    if (!event) continue;

    let result;

    try {
      result = await processEmail({
  event,
  getUserEmail: lookupEmail
});
    } catch (error) {
      await doc.ref.update({
        emailStatus: "review_required",
        emailError: error.message
      });
      continue;
    }

    if (result.sent) {
      await doc.ref.update({
        emailStatus: "sent",
        emailSentAt: new Date().toISOString(),
        emailMessageId: result.messageId
      });

      sent++;
    } else {
      await doc.ref.update({
        emailStatus: "skipped",
        emailError: result.reason || "Not sent"
      });
    }
  }

  return {
    processed: snapshot.size,
    sent
  };
}

module.exports = { processBudgetEmailOutbox };
