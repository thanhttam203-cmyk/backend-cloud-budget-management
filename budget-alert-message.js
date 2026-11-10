
const { evaluateBudgetAlert } = require("./budget-alert-service");

function buildBudgetAlertMessage({
  uid,
  budgetId,
  categoryId,
  month,
  previousSpent,
  currentSpent,
  limitAmount
}) {
  const result = evaluateBudgetAlert(
    previousSpent,
    currentSpent,
    limitAmount
  );

  if (!result.shouldAlert) {
    return null;
  }

  return {
    event: result.alertType === "budget_warning"
      ? "budget.warning"
      : "budget.exceeded",
    uid,
    budgetId,
    categoryId,
    month,
    previousSpent,
    currentSpent,
    limitAmount,
    percentage: result.currentPercentage,
    remainingAmount: result.remainingAmount,
    alertType: result.alertType,
    createdAt: new Date().toISOString()
  };
}

module.exports = { buildBudgetAlertMessage };
