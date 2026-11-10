
const {
  calculateBudgetProgress
} = require("./budget-progress");

const {
  detectBudgetAlert
} = require("./budget-alert-event");

function evaluateBudgetAlert(previousSpent, currentSpent, limitAmount) {
  const progress = calculateBudgetProgress(
    currentSpent,
    limitAmount
  );

  const alert = detectBudgetAlert(
    previousSpent,
    currentSpent,
    limitAmount
  );

  return {
    ...progress,
    ...alert
  };
}

module.exports = {
  evaluateBudgetAlert
};
