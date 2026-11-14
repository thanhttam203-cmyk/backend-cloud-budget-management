
require("dotenv").config();
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === "true",
  requireTLS: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

async function sendBudgetEmail({
  email,
  category,
  month,
  limit,
  spent
}) {
  if (process.env.EMAIL_ALERT_ENABLED !== "true") {
    return { sent: false, reason: "Email disabled" };
  }

  if (!email || !Number.isFinite(limit) || limit <= 0 ||
      !Number.isFinite(spent) || spent < 0) {
    throw new Error("Dữ liệu cảnh báo không hợp lệ");
  }

  const percent = (spent / limit) * 100;

  if (percent < 80) {
    return { sent: false, reason: "Below threshold" };
  }

  const status = percent >= 100
    ? "Đã chạm hoặc vượt ngân sách"
    : "Sắp hết ngân sách";

  const money = value =>
    Number(value).toLocaleString("vi-VN") + " đ";

  const message = `
Xin chào bạn,

Hệ thống quản lý thu chi gửi cảnh báo ngân sách:

Danh mục: ${category}
Tháng: ${month}
Hạn mức: ${money(limit)}
Đã chi: ${money(spent)}
Còn lại: ${money(limit - spent)}
Tỷ lệ sử dụng: ${percent.toFixed(2)}%
Trạng thái: ${status}

Bạn hãy cân nhắc điều chỉnh chi tiêu.

Trân trọng,
Hệ thống quản lý thu chi cá nhân.
`;

  const info = await transporter.sendMail({
    from: {
      name: process.env.SMTP_FROM_NAME || "Quan ly thu chi",
      address: process.env.SMTP_USER
    },
    to: email,
    subject: `[Cảnh báo ngân sách] ${status}`,
    text: message
  });

  return {
    sent: true,
    messageId: info.messageId
  };
}

module.exports = { sendBudgetEmail };
