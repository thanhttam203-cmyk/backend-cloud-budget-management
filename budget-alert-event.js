
const {
  calculateBudgetProgress
} = require("./budget-progress");

function detectBudgetAlert(previousSpent, currentSpent, limitAmount) {
  if (
    !Number.isSafeInteger(previousSpent) ||
    previousSpent < 0 ||
    !Number.isSafeInteger(currentSpent) ||
    currentSpent < 0
  ) {
    throw new Error("Chi tiêu không hợp lệ");
  }

  const previous = calculateBudgetProgress(
    previousSpent,
    limitAmount
  );

  const current = calculateBudgetProgress(
    currentSpent,
    limitAmount
  );

  let alertType = null;

  // Chạm hoặc vượt ngưỡng 100%
  if (
    previous.percentage < 100 &&
    current.percentage >= 100
  ) {
    alertType = "budget_exceeded";
  }

  // Chạm hoặc vượt ngưỡng 80%
  else if (
    previous.percentage < 80 &&
    current.percentage >= 80
  ) {
    alertType = "budget_warning";
  }

  return {
    shouldAlert: alertType !== null,
    alertType,
    previousPercentage: previous.percentage,
    currentPercentage: current.percentage,
    status: current.status,
    remainingAmount: current.remainingAmount
  };
}

module.exports = { detectBudgetAlert };
