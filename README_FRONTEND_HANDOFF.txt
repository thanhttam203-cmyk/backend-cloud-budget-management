BACKEND API - FRONTEND HANDOFF
================================
1. Cloud Run supports Firebase Authentication. Frontend logs in with Firebase Auth then includes:
   Authorization: Bearer <Firebase ID token> on every API except GET /health and GET /.
   Server verifies token via firebase-admin; Firestore path is users/<verified UID>/... .
   DO NOT pass uid in query/body; server ignores arbitrary uid.
2. HTTP examples:
   POST /transactions {"amount":162000,"category":"an-uong","date":"2026-11-11","type":"expense", "note":"Lunch"}
   GET /transactions?month=2026-11&category=an-uong
   GET /budgets?month=2026-11
   POST /budgets {"category":"an-uong","month":"2026-11","limit":1500000}
   GET /budgets/an-uong_2026-11/progress
   DELETE /budgets/an-uong_2026-11
   GET /reports/summary?month=2026-11
   POST /receipts/upload (multipart form-data: field file)
3. Transaction output: id, amount, category, date, type, month, note, receiptPath, createdAt, updatedAt.
4. Budget output: id, category, limit, spent, month, warningAlerted, exceededAlerted, createdAt, updatedAt.
   spent is CALCULATED from same-month expense transactions (not stored independently).
5. Firestore backward compatibility: older documents with categoryId/limitAmount remain readable.
6. Local test only: set ENABLE_DEV_AUTH=true and DEV_UID=some-uid in .env; NEVER deploy those to production.
7. Cloud Run URL is obtained after successful deployment; localhost URLs work only on your own PC.
8. Worker runs as a separate local process. For reliable cloud retry use Cloud Scheduler + Cloud Run Job.
9. Receipt g s:// path is not a browser image URL; use authorized signed URL/proxy to display.
