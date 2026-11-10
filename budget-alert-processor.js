
const { buildBudgetAlertMessage } = require("./budget-alert-message");

function prepareBudgetAlert({
  uid,
  budgetId,
  categoryId,
  month,
  previousSpent,
  transactionAmount,
  limitAmount
}) {
  if (
    !Number.isSafeInteger(previousSpent) ||
    previousSpent < 0 ||
    !Number.isSafeInteger(transactionAmount) ||
    transactionAmount <= 0
  ) {
    throw new Error("So tien giao dich khong hop le");
  }

  const currentSpent = previousSpent + transactionAmount;

  if (!Number.isSafeInteger(currentSpent)) {
    throw new Error("Tong chi tieu vuot gioi han an toan");
  }

  return buildBudgetAlertMessage({
    uid,
    budgetId,
    categoryId,
    month,
    previousSpent,
    currentSpent,
    limitAmount
  });
}

module.exports = { prepareBudgetAlert };
