$ErrorActionPreference = "Stop"

function Mask-Secret([string]$s) {
  if (-not $s) { return "(missing)" }
  if ($s.Length -le 8) { return "****" }
  return ($s.Substring(0, 4) + "..." + $s.Substring($s.Length - 4))
}

function Normalize-Text([string]$s) {
  if ($null -eq $s) { return "" }
  $t = ($s + "").Trim()
  if (($t.StartsWith('"') -and $t.EndsWith('"')) -or ($t.StartsWith("'") -and $t.EndsWith("'"))) {
    $t = $t.Substring(1, $t.Length - 2)
  }
  return $t.Trim()
}

$Repo = Split-Path -Parent $PSScriptRoot
$Port = if ($env:PORT) { [int]$env:PORT } else { 3000 }
$BaseUrl = Normalize-Text $(if ($env:DIZZY_BASE_URL) { $env:DIZZY_BASE_URL } else { "http://127.0.0.1:$Port" })

$Token = Normalize-Text $env:TELEGRAM_BOT_TOKEN
$ChatId = Normalize-Text $env:TELEGRAM_CHAT_ID
$Auth = Normalize-Text $env:DIZZY_AUTH_TOKEN

Write-Host "[doctor] repo=$Repo"
Write-Host "[doctor] base=$BaseUrl port=$Port auth=$(if($Auth){'set'}else{'none'})"
Write-Host "[doctor] TELEGRAM_BOT_TOKEN=$(Mask-Secret $Token)"
Write-Host "[doctor] TELEGRAM_CHAT_ID=$ChatId"

if (-not $Token -or -not $ChatId) {
  Write-Host "[doctor] ERROR: missing TELEGRAM_BOT_TOKEN and/or TELEGRAM_CHAT_ID (User env vars recommended)."
  exit 2
}

Write-Host ""
Write-Host "[doctor] check 1/3: local server health"
try {
  $headers = @{}
  if ($Auth) { $headers["Authorization"] = ("Bearer " + $Auth) }
  $health = Invoke-RestMethod -Uri ($BaseUrl.TrimEnd("/") + "/health") -Method Get -Headers $headers -TimeoutSec 3
  Write-Host ("[doctor] health ok=" + $health.ok + " redis_ready=" + $health.redis.ready)
} catch {
  Write-Host ("[doctor] ERROR: cannot reach " + ($BaseUrl.TrimEnd("/") + "/health"))
  Write-Host ("[doctor] " + $_.Exception.Message)
  Write-Host "[doctor] fix: run the launcher: powershell -NoProfile -ExecutionPolicy Bypass -File $PSScriptRoot\\launch_telegram.ps1"
  exit 3
}

Write-Host ""
Write-Host "[doctor] check 2/3: Telegram getMe"
try {
  $me = Invoke-RestMethod -Uri ("https://api.telegram.org/bot" + $Token + "/getMe") -Method Get -TimeoutSec 10
  if ($me.ok -ne $true) { throw "getMe ok=false" }
  Write-Host ("[doctor] bot @" + $me.result.username + " id=" + $me.result.id)
} catch {
  Write-Host "[doctor] ERROR: Telegram token invalid or blocked."
  Write-Host ("[doctor] " + $_.Exception.Message)
  exit 4
}

Write-Host ""
Write-Host "[doctor] check 3/3: Telegram sendMessage (ping)"
try {
  $body = @{
    chat_id = $ChatId
    text = ("doctor ping: " + (Get-Date).ToString("s"))
    disable_web_page_preview = $true
  } | ConvertTo-Json

  $res = Invoke-RestMethod -Uri ("https://api.telegram.org/bot" + $Token + "/sendMessage") -Method Post -ContentType "application/json" -Body $body -TimeoutSec 10
  if ($res.ok -ne $true) { throw "sendMessage ok=false" }
  Write-Host "[doctor] ping sent ok"
} catch {
  Write-Host "[doctor] ERROR: cannot send to TELEGRAM_CHAT_ID (wrong chat id or bot not started in that chat)."
  Write-Host ("[doctor] " + $_.Exception.Message)
  Write-Host "[doctor] fix: DM the bot and send /start, then re-run get_telegram_chat_id.ps1"
  exit 5
}

Write-Host ""
Write-Host "[doctor] OK: server reachable + Telegram reachable."
Write-Host "[doctor] Next: in Telegram DM, send /health."
Write-Host "[doctor] Note: localhost tool fetches are blocked by default unless DIZZY_TOOL_ALLOW_LOCALHOST=1."
