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

function SecureStringToPlainText([Security.SecureString]$secure) {
  if (-not $secure) { return "" }
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}

Write-Host "This will set USER environment variables (persistent) for Telegram + Dizzy auth."
Write-Host "Note: user env vars are stored in plaintext for your Windows user account."
Write-Host ""

$tokenSecure = Read-Host "Enter TELEGRAM_BOT_TOKEN (from @BotFather)" -AsSecureString
$chatIdRaw = Read-Host "Enter TELEGRAM_CHAT_ID (numeric)"
$authSecure = Read-Host "Enter DIZZY_AUTH_TOKEN (recommended; blank ok)" -AsSecureString

$token = Normalize-Text (SecureStringToPlainText $tokenSecure)
$chatId = Normalize-Text $chatIdRaw
$auth = Normalize-Text (SecureStringToPlainText $authSecure)

if (-not $token -or -not $chatId) {
  Write-Host "Missing TELEGRAM_BOT_TOKEN and/or TELEGRAM_CHAT_ID; nothing was set."
  exit 2
}

[Environment]::SetEnvironmentVariable("TELEGRAM_BOT_TOKEN", $token, "User")
[Environment]::SetEnvironmentVariable("TELEGRAM_CHAT_ID", $chatId, "User")

if ($auth) {
  [Environment]::SetEnvironmentVariable("DIZZY_AUTH_TOKEN", $auth, "User")
} else {
  Write-Host "(leaving existing DIZZY_AUTH_TOKEN unchanged)"
}

# Also set for the current session so you can launch immediately.
$env:TELEGRAM_BOT_TOKEN = $token
$env:TELEGRAM_CHAT_ID = $chatId
if ($auth) { $env:DIZZY_AUTH_TOKEN = $auth }

Write-Host ""
Write-Host "USER env vars set:"
Write-Host "  TELEGRAM_BOT_TOKEN=$(Mask-Secret $token)"
Write-Host "  TELEGRAM_CHAT_ID=$chatId"
Write-Host "  DIZZY_AUTH_TOKEN=$(Mask-Secret $auth)"
Write-Host ""
Write-Host "Next: run the launcher:"
Write-Host "  powershell -NoProfile -ExecutionPolicy Bypass -File $PSScriptRoot\\launch_telegram.ps1"
