
const assert = require("node:assert/strict");
const {
  createTransactionWithBudgetAlerts
} = require("./budget-alert-firestore");

async function runTest(name, budget, previousSpent, expectedAlerts) {
  const writes = [];

  const db = {
    collection: (name) => ({
      doc: (id) => ({
        id,
        collection: (subName) => ({
          doc: (docId) => ({ id: docId, name: subName }),
          where: () => ({ kind: "query" })
        })
      })
    }),
    runTransaction: async (callback) => {
      const tx = {
        get: async (ref) => {
          if (ref.kind === "query") {
            return {
              docs: previousSpent > 0
                ? [{ data: () => ({
                    type: "expense",
                    categoryId: "an-uong",
                    amount: previousSpent
                  }) }]
                : []
            };
          }
          return {
            exists: Boolean(budget),
            data: () => budget
          };
        },
        create: (ref, data) => {
          writes.push({ operation: "create", ref, data });
        },
        update: (ref, data) => {
          writes.push({ operation: "update", ref, data });
        }
      };
      return callback(tx);
    }
  };

  const result = await createTransactionWithBudgetAlerts({
    db,
    uid: "group4-demo",
    transactionRef: { id: "test-transaction" },
    transactionData: {
      type: "expense",
      categoryId: "an-uong",
      month: "2026-11",
      amount: 200000
    }
  });

  assert.deepEqual(result.alerts, expectedAlerts);
  assert.equal(
    writes.filter(w => w.operation === "create").length,
    1 + expectedAlerts.length
  );
  assert.equal(
    writes.filter(w => w.operation === "update").length,
    expectedAlerts.length > 0 ? 1 : 0
  );

  console.log(`PASS - ${name}`);
}

async function main() {
  await runTest(
    "Khong co ngan sach",
    null,
    0,
    []
  );

  await runTest(
    "Canh bao 80%",
    {
      limitAmount: 1500000,
      warningAlerted: false,
      exceededAlerted: false
    },
    1100000,
    ["budget.warning"]
  );

  await runTest(
    "Canh bao 100%",
    {
      limitAmount: 1500000,
      warningAlerted: true,
      exceededAlerted: false
    },
    1400000,
    ["budget.exceeded"]
  );

  console.log("Ket qua: 3/3 PASS");
}

main().catch(error => {
  console.error("FAIL:", error.message);
  process.exitCode = 1;
});
