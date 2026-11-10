
const assert = require("node:assert/strict");
const { publishBudgetAlert } = require("./budget-alert-publisher");

async function main() {
  const published = [];

  const mockPubsub = {
    topic: (name) => ({
      publishMessage: async ({ data }) => {
        published.push({
          topic: name,
          message: JSON.parse(data.toString("utf8"))
        });

        return "mock-message-001";
      }
    })
  };

  const baseEvent = {
    uid: "group4-demo",
    budgetId: "an-uong_2026-11",
    categoryId: "an-uong",
    month: "2026-11",
    currentSpent: 1300000,
    limitAmount: 1500000
  };

  let passed = 0;

  for (const eventName of ["budget.warning", "budget.exceeded"]) {
    const result = await publishBudgetAlert({
      pubsub: mockPubsub,
      topicName: "budget-alerts-test",
      event: { ...baseEvent, event: eventName }
    });

    assert.equal(result.messageId, "mock-message-001");
    assert.equal(result.event, eventName);
    assert.equal(published.at(-1).message.event, eventName);
    assert.equal(published.at(-1).topic, "budget-alerts-test");

    console.log(`PASS - ${eventName}`);
    passed++;
  }

  await assert.rejects(
    publishBudgetAlert({
      pubsub: mockPubsub,
      topicName: "budget-alerts-test",
      event: { ...baseEvent, event: "invalid.event" }
    })
  );

  console.log("PASS - Tu choi su kien khong hop le");
  passed++;

  assert.equal(published.length, 2);

  console.log(`Ket qua: ${passed}/3 PASS`);
}

main().catch(error => {
  console.error("FAIL:", error.message);
  process.exitCode = 1;
});
