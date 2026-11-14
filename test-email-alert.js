
const { sendBudgetEmail } = require("./email-service");

async function test() {
  console.log("=== KIEM THU GUI EMAIL CANH BAO ===");

  try {
    const result = await sendBudgetEmail({
      email: process.env.SMTP_USER,
      category: "An uong",
      month: "2026-11",
      limit: 2000000,
      spent: 1700000
    });

    console.log("Ket qua:", result);

    if (result.sent) {
      console.log("PASS: Gmail SMTP da chap nhan email!");
    } else {
      console.log("FAIL: Email chua duoc gui.");
      process.exitCode = 1;
    }
  } catch (error) {
    console.error("FAIL:", error.message);
    process.exitCode = 1;
  }
}

test();
