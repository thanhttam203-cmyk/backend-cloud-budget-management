
const { sendBudgetEmail } = require("./email-service");

async function processBudgetAlertEmail({
  event,
  getUserEmail
}) {
  if (!event || !event.uid) {
    throw new Error("Thieu UID nguoi dung");
  }

  if (!["budget.warning", "budget.exceeded"].includes(event.event)) {
    return {
      sent: false,
      reason: "Unsupported event"
    };
  }

  if (event.emailStatus === "sent") {
    return {
      sent: false,
      reason: "Already sent"
    };
  }

  const email = await getUserEmail(event.uid);

  if (!email) {
    return {
      sent: false,
      reason: "User email not found"
    };
  }

  return sendBudgetEmail({
    email,
    category: event.categoryId,
    month: event.month,
    limit: event.limitAmount,
    spent: event.currentSpent
  });
}

module.exports = { processBudgetAlertEmail };
