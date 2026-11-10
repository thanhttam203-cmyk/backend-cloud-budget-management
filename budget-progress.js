
function calculateBudgetProgress(currentSpent, limitAmount) {
  if (
    !Number.isSafeInteger(currentSpent) ||
    currentSpent < 0 ||
    !Number.isSafeInteger(limitAmount) ||
    limitAmount <= 0
  ) {
    throw new Error("Số tiền ngân sách không hợp lệ");
  }

  const percentage = Number(
    ((currentSpent / limitAmount) * 100).toFixed(2)
  );

  let status = "normal";

  if (percentage >= 100) {
    status = "exceeded";
  } else if (percentage >= 80) {
    status = "warning";
  }

  return {
    currentSpent,
    limitAmount,
    percentage,
    remainingAmount: limitAmount - currentSpent,
    status
  };
}

module.exports = { calculateBudgetProgress };
