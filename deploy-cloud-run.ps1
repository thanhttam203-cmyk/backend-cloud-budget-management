# Run from the folder containing server.js. Deploys a NEW service, not the team's existing p3-api-crud.
$ErrorActionPreference = "Stop"
$ProjectId = "hk261-cc-g04"
$Region = "asia-southeast1"
$Service = "budget-management-api"
$ServiceAccount = "p3-cloudrun-sa@hk261-cc-g04.iam.gserviceaccount.com"
$gcloud = "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
if (-not (Test-Path $gcloud)) { throw "Khong tim thay gcloud.cmd. Kiem tra cai dat Google Cloud SDK." }
if (-not (Test-Path ".\server.js")) { throw "Hay cd vao thu muc chua server.js truoc." }
Write-Host "Deploy Cloud Run: $ProjectId / $Region / $Service"
& $gcloud run deploy $Service `
  --project=$ProjectId `
  --region=$Region `
  --source=. `
  --service-account=$ServiceAccount `
  --allow-unauthenticated `
  --min-instances=0 `
  --max-instances=2 `
  --update-env-vars="GOOGLE_CLOUD_PROJECT=$ProjectId,RECEIPTS_BUCKET=cloud-dh24hm-group4,PUBSUB_TOPIC=transaction-created,BUDGET_ALERT_TOPIC=budget-alerts"
if ($LASTEXITCODE -ne 0) { throw "Deploy that bai. Kiem tra IAM, Cloud Build, Artifact Registry va log gcloud." }
$url = (& $gcloud run services describe $Service --project=$ProjectId --region=$Region --format="value(status.url)")
if ($LASTEXITCODE -ne 0 -or -not $url) { throw "Khong truy xuat duoc URL Cloud Run." }
Write-Host "CLOUD_RUN_URL: $url" -ForegroundColor Green
Write-Host "Health: $url/health"
try { Invoke-RestMethod "$url/health" | Format-List } catch { Write-Warning "Khong truy cap duoc health: $_" }
