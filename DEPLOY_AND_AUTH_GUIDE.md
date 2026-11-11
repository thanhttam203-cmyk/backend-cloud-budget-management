# Bàn giao Backend – UID động, schema mới, Cloud Run

## Các thay đổi

- **UID** được lấy từ Firebase ID token đã được xác minh (`Authorization: Bearer <idToken>`). Không dùng `group4-demo` cố định ở chế độ production. Đường dẫn Firestore là `users/<uid>/transactions`, `users/<uid>/budgets` và `users/<uid>/budget-alert-outbox`.
- **Transaction**: trường chính `amount`, `category`, `date`, `type` (thêm `id`, `month`, `note`, `receiptPath` và timestamps phục vụ nghiệp vụ). Ví dụ:
  ```json
  {"amount":162000,"category":"an-uong","date":"2026-11-11","type":"expense"}
  ```
- **Budget**: `category`, `limit`, `spent` + `month`, `id`. Ví dụ gửi yêu cầu tạo/cập nhật:
  ```json
  {"category":"an-uong","limit":1500000,"month":"2026-11"}
  ```
  Phản hồi GET ngân sách có thêm `spent` **tính từ các giao dịch chi tiêu** cùng tháng và danh mục (không được ghi độc lập để tránh lệch dữ liệu).
- Tương thích dữ liệu cũ: backend đọc được `categoryId` và `limitAmount` trong document cũ; request cũng chấp nhận hai tên cũ tạm thời.

## Yêu cầu cho Frontend

1. Đăng nhập với Firebase Authentication của cùng dự án `hk261-cc-g04`.
2. Lấy token và gửi trong **mọi request** (trừ `/` và `/health`):
   ```js
   import { getAuth } from "firebase/auth";
   const token = await getAuth().currentUser.getIdToken();
   const response = await fetch(`${API_BASE_URL}/budgets?month=2026-11`, {
     headers: { Authorization: `Bearer ${token}` }
   });
   const result = await response.json();
   ```
3. Mỗi tài khoản Firebase có UID riêng; dữ liệu demo cũ trong `users/group4-demo` **không tự chuyển sang UID mới**.
4. Hóa đơn dùng `POST /receipts/upload` với `multipart/form-data`, form field `file`; đường dẫn `gs://` trả về không phải URL để hiển thị ảnh trong browser.
5. Bộ API: `GET|POST|PUT|DELETE /transactions`, `GET|POST /budgets`, `DELETE /budgets/:id`, `GET /budgets/:id/progress`, `POST /budgets/:id/check-alert`, `GET /reports/summary`, `GET|POST /categories`, `POST /receipts/upload`.

## Chạy thử máy cá nhân

```powershell
npm ci
Copy-Item .env.example .env
# Chỉ dùng khi chạy local: sửa .env với ENABLE_DEV_AUTH=true, DEV_UID=group4-demo
$env:PORT="8082"
node server.js
```

**Không bật** `ENABLE_DEV_AUTH=true` trong Cloud Run. Trong production, mọi request nghiệp vụ không có Firebase ID token hợp lệ sẽ nhận 401.

## Triển khai Cloud Run

Cloud Run service mới tên `budget-management-api` ở `asia-southeast1` để không ghi đè dịch vụ nhóm `p3-api-crud`. Chạy trong thư mục chứa `server.js`:

```powershell
.\deploy-cloud-run.ps1
```

Script chỉ in `CLOUD_RUN_URL` **sau khi Google Cloud thực sự báo triển khai thành công**. Nếu cần chạy thủ công:

```powershell
$gcloud="$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
& $gcloud run services describe budget-management-api --project=hk261-cc-g04 --region=asia-southeast1 --format="value(status.url)"
```

### IAM và bảo mật

- Người deploy cần quyền Cloud Run/Cloud Build/Artifact Registry và Service Account User phù hợp.
- Service account `p3-cloudrun-sa@hk261-cc-g04.iam.gserviceaccount.com` cần quyền truy cập Firestore, ghi Cloud Storage vào bucket, xuất bản Pub/Sub (`transaction-created`, `budget-alerts`) và xác minh Firebase ID token với cấu hình Firebase Auth phù hợp.
- Deploy với `--allow-unauthenticated` **chỉ mở cổng HTTP ở Cloud Run** để browser truy cập và gửi Firebase ID token. Middleware ứng dụng **vẫn xác minh token và chặn API nghiệp vụ nếu không hợp lệ**. Điều này khác với bật quyền Cloud Run Invoker bằng Google IAM; nếu chính sách tổ chức không cho phép public service, cần dùng cơ chế auth/gateway phù hợp thay vì tắt middleware.
- Không đưa `.env`, service account keys hoặc file ảnh cá nhân lên GitHub.
- Worker `budget-alert-worker.js` chỉ chạy định kỳ khi process tồn tại trên local; **chưa triển khai Worker trên Cloud Run**. Để có retry 24/7, cần thêm Cloud Scheduler và Cloud Run Job hoặc kiến trúc tương đương, cùng cơ chế xử lý tránh gửi trùng khi có nhiều worker.
- Gửi thành công Pub/Sub không chứng minh email đã gửi: đó là mục 8 của người phụ trách thông báo.

## Kiểm thử nhanh sau khi triển khai

```powershell
$url = "<URL do script tra ve>"
Invoke-RestMethod "$url/health"  # 200
try { Invoke-RestMethod "$url/budgets" } catch { $_.Exception.Response.StatusCode.value__ }  # 401 without token
```
