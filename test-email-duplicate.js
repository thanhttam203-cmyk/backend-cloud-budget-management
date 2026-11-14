
const assert = require("node:assert/strict");
const {
  processBudgetAlertEmail
} = require("./budget-alert-email");

async function test() {
  let lookupCount = 0;

  const result = await processBudgetAlertEmail({
    event: {
      event: "budget.warning",
      uid: "user-001",
      categoryId: "An uong",
      month: "2026-11",
      limitAmount: 2000000,
      currentSpent: 1700000,
      emailStatus: "sent"
    },

    getUserEmail: async () => {
      lookupCount++;
      throw new Error("Khong duoc gui lai email");
    }
  });

  assert.equal(result.sent, false);
  assert.equal(result.reason, "Already sent");
  assert.equal(lookupCount, 0);

  console.log("Ket qua:", result);
  console.log("PASS: Khong gui lai email da xu ly");
}

test().catch(error => {
  console.error("FAIL:", error.message);
  process.exitCode = 1;
});
