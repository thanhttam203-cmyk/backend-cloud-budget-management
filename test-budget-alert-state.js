
const assert = require("node:assert/strict");
const { getPendingBudgetAlerts } = require("./budget-alert-state");

const tests = [
  [750000, false, false, []],
  [800000, false, false, ["budget.warning"]],
  [850000, true, false, []],
  [1000000, true, false, ["budget.exceeded"]],
  [1100000, false, false, ["budget.warning", "budget.exceeded"]],
  [1200000, true, true, []]
];

let passed = 0;

for (const [currentSpent, warningAlerted, exceededAlerted, expected] of tests) {
  try {
    const actual = getPendingBudgetAlerts({
      currentSpent,
      limitAmount: 1000000,
      warningAlerted,
      exceededAlerted
    });

    assert.deepEqual(actual, expected);
    console.log(`PASS - ${JSON.stringify(actual)}`);
    passed++;
  } catch (error) {
    console.error(`FAIL - ${error.message}`);
  }
}

console.log(`Ket qua: ${passed}/${tests.length} PASS`);

if (passed !== tests.length) {
  process.exitCode = 1;
}
