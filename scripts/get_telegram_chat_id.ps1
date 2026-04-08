$ErrorActionPreference = "Stop"

function Normalize-Text([string]$s) {
  if ($null -eq $s) { return "" }
  $t = ($s + "").Trim()
  if (($t.StartsWith('"') -and $t.EndsWith('"')) -or ($t.StartsWith("'") -and $t.EndsWith("'"))) {
    $t = $t.Substring(1, $t.Length - 2)
  }
  return $t.Trim()
}

function SecureStringToPlainText([Security.SecureString]$secure) {
  if (-not $secure) { return "" }
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}

$token = Normalize-Text $env:TELEGRAM_BOT_TOKEN
if (-not $token) {
  $tokenSecure = Read-Host "Enter TELEGRAM_BOT_TOKEN (from @BotFather)" -AsSecureString
  $token = Normalize-Text (SecureStringToPlainText $tokenSecure)
}

if (-not $token) {
  Write-Host "Missing TELEGRAM_BOT_TOKEN."
  exit 2
}

Write-Host "[tg] validating token..."
try {
  $me = Invoke-RestMethod -Uri ("https://api.telegram.org/bot" + $token + "/getMe") -Method Get -TimeoutSec 15
  if (-not $me.ok) { throw "getMe returned ok=false" }
  $user = $me.result
  Write-Host ("[tg] bot: @" + $user.username + " (id=" + $user.id + ")")
} catch {
  Write-Host "[tg] ERROR: token invalid (getMe failed)."
  throw
}

Write-Host "[tg] ensuring polling mode (deleting webhook + dropping pending updates)..."
Invoke-RestMethod -Uri ("https://api.telegram.org/bot" + $token + "/deleteWebhook?drop_pending_updates=true") -Method Get -TimeoutSec 15 | Out-Null

Write-Host ""
Write-Host "Now DM the bot in Telegram and send: /start"
Write-Host "Then this script will look for your chat id."
Write-Host ""

$deadline = (Get-Date).AddSeconds(60)
$seen = @{}

while ((Get-Date) -lt $deadline) {
  try {
    $u = Invoke-RestMethod -Uri ("https://api.telegram.org/bot" + $token + "/getUpdates?limit=25") -Method Get -TimeoutSec 30
    if ($u.ok -ne $true) { throw "getUpdates returned ok=false" }
    foreach ($r in ($u.result | Where-Object { $_ })) {
      $m = $r.message
      if (-not $m) { continue }
      $c = $m.chat
      if (-not $c) { continue }
      $id = [string]$c.id
      if (-not $id) { continue }
      if ($seen.ContainsKey($id)) { continue }

      $seen[$id] = $true
      Write-Host ""
      Write-Host ("Found chat:")
      Write-Host ("  id=" + $id + " type=" + $c.type + " title=" + $c.title + " username=" + $c.username + " first_name=" + $c.first_name + " last_name=" + $c.last_name)
      Write-Host ""
      Write-Host ("fix: set TELEGRAM_CHAT_ID=" + $id)
      Write-Host ""
      exit 0
    }
  } catch {
    # ignore transient failures and keep polling
  }

  Start-Sleep -Milliseconds 800
}

Write-Host ""
Write-Host "No chats found in the last 60 seconds."
Write-Host "Make sure you DM'd the bot and sent: /start"
Write-Host "Then re-run:"
Write-Host "  powershell -NoProfile -ExecutionPolicy Bypass -File $PSScriptRoot\\get_telegram_chat_id.ps1"
exit 3
