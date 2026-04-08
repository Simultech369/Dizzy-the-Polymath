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

function Mask-Secret([string]$s) {
  if (-not $s) { return "(missing)" }
  if ($s.Length -le 8) { return "****" }
  return ($s.Substring(0, 4) + "..." + $s.Substring($s.Length - 4))
}

Write-Host "This will set USER environment variables (persistent) for Gemini chat."
Write-Host "Note: user env vars are stored in plaintext for your Windows user account."
Write-Host ""

$apiKeySecure = Read-Host "Enter GEMINI_API_KEY" -AsSecureString
$modelRaw = Read-Host "Enter GEMINI_MODEL (blank uses default gemini-1.5-flash)"

$apiKey = Normalize-Text (SecureStringToPlainText $apiKeySecure)
$model = Normalize-Text $modelRaw

if (-not $apiKey) {
  Write-Host "Missing GEMINI_API_KEY; nothing was set."
  exit 2
}

[Environment]::SetEnvironmentVariable("DIZZY_CHAT_BACKEND", "gemini", "User")
[Environment]::SetEnvironmentVariable("GEMINI_API_KEY", $apiKey, "User")
if ($model) {
  [Environment]::SetEnvironmentVariable("GEMINI_MODEL", $model, "User")
} else {
  Write-Host "(leaving existing GEMINI_MODEL unchanged)"
}

# Also set for the current session so you can launch immediately.
$env:DIZZY_CHAT_BACKEND = "gemini"
$env:GEMINI_API_KEY = $apiKey
if ($model) { $env:GEMINI_MODEL = $model }

Write-Host ""
Write-Host "USER env vars set:"
Write-Host "  DIZZY_CHAT_BACKEND=gemini"
Write-Host "  GEMINI_API_KEY=$(Mask-Secret $apiKey)"
Write-Host "  GEMINI_MODEL=$(if($model){$model}else{'(default or unchanged)'})"
Write-Host ""
Write-Host "Next: re-run the launcher:"
Write-Host "  powershell -NoProfile -ExecutionPolicy Bypass -File $PSScriptRoot\\launch_telegram.ps1"
