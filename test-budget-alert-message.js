
const { buildBudgetAlertMessage } = require("./budget-alert-message");

const base = {
  uid: "group4-demo",
  budgetId: "an-uong_2026-11",
  categoryId: "an-uong",
  month: "2026-11",
  limitAmount: 1500000
};

const tests = [
  ["Canh bao 80%", 1100000, 1300000, "budget.warning"],
  ["Vuot 100%", 1400000, 1600000, "budget.exceeded"],
  ["Khong canh bao", 300000, 400000, null]
];

let passed = 0;

for (const [label, previousSpent, currentSpent, expected] of tests) {
  const result = buildBudgetAlertMessage({
    ...base,
    previousSpent,
    currentSpent
  });

  const actual = result ? result.event : null;
  const ok = actual === expected;

  console.log(
    `${ok ? "PASS" : "FAIL"} - ${label}: ${actual}`
  );

  if (ok) passed++;
}

console.log(`Ket qua: ${passed}/${tests.length} PASS`);

if (passed !== tests.length) {
  process.exitCode = 1;
}
