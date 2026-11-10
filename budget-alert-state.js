
function getPendingBudgetAlerts({
  currentSpent,
  limitAmount,
  warningAlerted = false,
  exceededAlerted = false
}) {
  if (
    !Number.isSafeInteger(currentSpent) ||
    currentSpent < 0 ||
    !Number.isSafeInteger(limitAmount) ||
    limitAmount <= 0
  ) {
    throw new Error("Du lieu ngan sach khong hop le");
  }

  const alerts = [];

  if (
    currentSpent / limitAmount >= 0.8 &&
    !warningAlerted
  ) {
    alerts.push("budget.warning");
  }

  if (
    currentSpent >= limitAmount &&
    !exceededAlerted
  ) {
    alerts.push("budget.exceeded");
  }

  return alerts;
}

module.exports = { getPendingBudgetAlerts };
