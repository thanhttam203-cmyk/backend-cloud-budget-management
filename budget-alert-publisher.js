
async function publishBudgetAlert({
  pubsub,
  topicName,
  event
}) {
  if (!pubsub || typeof pubsub.topic !== "function") {
    throw new Error("PubSub client khong hop le");
  }

  if (typeof topicName !== "string" || !topicName.trim()) {
    throw new Error("Topic name khong hop le");
  }

  if (
    !event ||
    !["budget.warning", "budget.exceeded"].includes(event.event)
  ) {
    throw new Error("Su kien canh bao khong hop le");
  }

  const messageId = await pubsub
    .topic(topicName)
    .publishMessage({
      data: Buffer.from(JSON.stringify(event))
    });

  return {
    messageId,
    event: event.event
  };
}

module.exports = { publishBudgetAlert };
