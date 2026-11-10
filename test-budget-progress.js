
const assert = require("node:assert/strict");

const {
  calculateBudgetProgress
} = require("./budget-progress");

const tests = [
  [1000000, 2000000, "normal", 50],
  [1750000, 2000000, "warning", 87.5],
  [2200000, 2000000, "exceeded", 110]
];

for (const [spent, limit, expectedStatus, expectedPercent] of tests) {
  const result = calculateBudgetProgress(spent, limit);

  assert.equal(result.status, expectedStatus);
  assert.equal(result.percentage, expectedPercent);

  console.log(`PASS: ${expectedStatus} - ${expectedPercent}%`);
}

console.log("HOAN THANH 3/3 KIEM THU");
