const assert = require("node:assert/strict");
const { transactionInput, toTransaction, toBudget } = require("./api-schema");
const a = transactionInput({ amount: 100, category: "an-uong", date: "2026-11-11", type: "expense" });
assert.equal(a.categoryId, "an-uong");
assert.equal(toTransaction("t1", { amount: 100, category: "an-uong", date: "2026-11-11", type: "expense" }).category, "an-uong");
assert.equal(toTransaction("t2", { amount: 100, categoryId: "di-lai", date: "2026-11-11", type: "expense" }).category, "di-lai");
assert.deepEqual([toBudget("b1", { category: "an-uong", limit: 1500000, month: "2026-11" }, 262000).category, toBudget("b1", { category: "an-uong", limit: 1500000, month: "2026-11" }, 262000).limit, toBudget("b1", { category: "an-uong", limit: 1500000, month: "2026-11" }, 262000).spent], ["an-uong", 1500000, 262000]);
assert.equal(toBudget("b2", { categoryId: "an-uong", limitAmount: 1500000, month: "2026-11" }, 262000).category, "an-uong");
console.log("PASS - new API schema and legacy Firestore compatibility");
