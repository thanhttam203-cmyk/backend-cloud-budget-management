
const assert = require("node:assert/strict");
const { prepareBudgetAlert } = require("./budget-alert-processor");

const base = {
  uid: "group4-demo",
  budgetId: "an-uong_2026-11",
  categoryId: "an-uong",
  month: "2026-11",
  limitAmount: 1500000
};

const tests = [
  {
    name: "Vuot nguong 80%",
    previousSpent: 1100000,
    transactionAmount: 200000,
    expected: "budget.warning"
  },
  {
    name: "Vuot nguong 100%",
    previousSpent: 1400000,
    transactionAmount: 200000,
    expected: "budget.exceeded"
  },
  {
    name: "Khong canh bao",
    previousSpent: 300000,
    transactionAmount: 100000,
    expected: null
  },
  {
    name: "Khong gui canh bao trung",
    previousSpent: 1300000,
    transactionAmount: 50000,
    expected: null
  }
];

let passed = 0;

for (const test of tests) {
  const result = prepareBudgetAlert({
    ...base,
    previousSpent: test.previousSpent,
    transactionAmount: test.transactionAmount
  });

  const actual = result?.event ?? null;

  try {
    assert.equal(actual, test.expected);
    console.log(`PASS - ${test.name}: ${actual}`);
    passed++;
  } catch (error) {
    console.error(`FAIL - ${test.name}: ${actual}`);
  }
}

console.log(`Ket qua: ${passed}/${tests.length} PASS`);

if (passed !== tests.length) {
  process.exitCode = 1;
}
