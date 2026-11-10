
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const { Firestore } = require("@google-cloud/firestore");
const { PubSub } = require("@google-cloud/pubsub");
const {
  processBudgetAlertOutbox
} = require("./budget-alert-outbox");

const PROJECT_ID =
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.GCLOUD_PROJECT ||
  "hk261-cc-g04";

const TOPIC_NAME =
  process.env.BUDGET_ALERT_TOPIC || "budget-alerts";

const UID = "group4-demo";

const db = new Firestore({ projectId: PROJECT_ID });
const pubsub = new PubSub({ projectId: PROJECT_ID });

let isProcessing = false;

async function retryPendingAlerts() {
  if (isProcessing) return;

  isProcessing = true;

  try {
    const result = await processBudgetAlertOutbox({
      db,
      pubsub,
      uid: UID,
      topicName: TOPIC_NAME,
      limit: 10
    });

    console.log(
      `[Outbox] Đã kiểm tra: ${result.processed}, ` +
      `gửi thành công: ${result.sent}`
    );

    for (const item of result.results) {
      if (item.status === "pending") {
        console.error(
          `[Outbox] Gửi thất bại ${item.id}: ${item.error}`
        );
      }
    }
  } catch (error) {
    console.error("[Outbox] Lỗi:", error.message);
  } finally {
    isProcessing = false;
  }
}

console.log("Budget Alert Worker đang chạy.");
console.log("Kiểm tra cảnh báo pending mỗi 60 giây.");

retryPendingAlerts();

setInterval(retryPendingAlerts, 60 * 1000);

