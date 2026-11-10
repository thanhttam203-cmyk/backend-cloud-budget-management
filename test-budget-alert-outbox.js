
const assert = require("node:assert/strict");
const {
  processBudgetAlertOutbox
} = require("./budget-alert-outbox");

async function runTest(name, shouldFail) {
  const updates = [];
  const messages = [];

  const eventData = {
    event: "budget.warning",
    uid: "group4-demo",
    budgetId: "an-uong_2026-11",
    categoryId: "an-uong",
    month: "2026-11",
    previousSpent: 1100000,
    currentSpent: 1300000,
    limitAmount: 1500000,
    status: "pending"
  };

  const doc = {
    id: "test-event-001",
    data: () => eventData,
    ref: {
      update: async (data) => {
        updates.push(data);
      }
    }
  };

  const db = {
    collection: () => ({
      doc: () => ({
        collection: () => ({
          where: () => ({
            limit: () => ({
              get: async () => ({ docs: [doc] })
            })
          })
        })
      })
    })
  };

  const pubsub = {
    topic: () => ({
      publishMessage: async ({ data }) => {
        if (shouldFail) {
          throw new Error("Mock PubSub error");
        }

        messages.push(JSON.parse(data.toString("utf8")));
        return "mock-message-001";
      }
    })
  };

  const result = await processBudgetAlertOutbox({
    db,
    pubsub,
    uid: "group4-demo",
    topicName: "budget-alerts-test"
  });

  if (shouldFail) {
    assert.equal(result.sent, 0);
    assert.equal(result.results[0].status, "pending");
    assert.equal(updates.length, 0);
    assert.equal(messages.length, 0);
  } else {
    assert.equal(result.sent, 1);
    assert.equal(result.results[0].status, "sent");
    assert.equal(updates[0].status, "sent");
    assert.equal(messages[0].id, "test-event-001");
  }

  console.log(`PASS - ${name}`);
}

async function main() {
  await runTest("Gui PubSub thanh cong", false);
  await runTest("Gui PubSub that bai", true);

  console.log("Ket qua: 2/2 PASS");
}

main().catch(error => {
  console.error("FAIL:", error.message);
  process.exitCode = 1;
});
