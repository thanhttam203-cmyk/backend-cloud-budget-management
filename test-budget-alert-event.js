
const assert = require("node:assert/strict");

const {
  detectBudgetAlert
} = require("./budget-alert-event");

const limit = 1500000;

const tests = [
  {
    name: "Binh thuong 60%",
    before: 600000,
    after: 900000,
    expected: null
  },
  {
    name: "Cham nguong 80%",
    before: 900000,
    after: 1230000,
    expected: "budget_warning"
  },
  {
    name: "Khong canh bao lap 90%",
    before: 1230000,
    after: 1350000,
    expected: null
  },
  {
    name: "Vuot nguong 100%",
    before: 1350000,
    after: 1530000,
    expected: "budget_exceeded"
  },
  {
    name: "Khong canh bao lap 110%",
    before: 1530000,
    after: 1650000,
    expected: null
  },
  {
    name: "Vuot truc tiep 60% den 110%",
    before: 900000,
    after: 1650000,
    expected: "budget_exceeded"
  }
];

for (const test of tests) {
  const result = detectBudgetAlert(
    test.before,
    test.after,
    limit
  );

  assert.equal(result.alertType, test.expected);

  assert.equal(
    result.shouldAlert,
    test.expected !== null
  );

  console.log(`PASS: ${test.name}`);
}

console.log("HOAN THANH 6/6 KIEM THU CANH BAO");
