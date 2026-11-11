
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

// Process the users present in Firestore, including missing parent docs with subcollections.

const db = new Firestore({ projectId: PROJECT_ID });
const pubsub = new PubSub({ projectId: PROJECT_ID });

let isProcessing = false;

async function retryPendingAlerts() {
  if (isProcessing) return;

  isProcessing = true;

  try {
    const users = await db.collection("users").listDocuments();
    let processed = 0;
    let sent = 0;
    for (const userRef of users) {
      const result = await processBudgetAlertOutbox({
        db, pubsub, uid: userRef.id, topicName: TOPIC_NAME, limit: 10
      });
      processed += result.processed;
      sent += result.sent;
      for (const item of result.results) {
        if (item.status === "pending") {
          console.error(`[Outbox] ${userRef.id}/${item.id}: ${item.error}`);
        }
      }
    }
    console.log(`[Outbox] Đã kiểm tra: ${processed}, gửi thành công: ${sent}`);
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

