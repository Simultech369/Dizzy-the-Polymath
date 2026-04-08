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

Write-Host "This will set USER environment variables (persistent) for OpenRouter chat via OpenAI-compatible API."
Write-Host "Note: user env vars are stored in plaintext for your Windows user account."
Write-Host ""

$apiKeySecure = Read-Host "Enter OPENROUTER_API_KEY" -AsSecureString
$modelRaw = Read-Host "Enter OPENAI_COMPAT_MODEL (recommended: openrouter/free or qwen/qwen3.6-plus-preview:free)"
$maxTokensRaw = Read-Host "Enter OPENAI_COMPAT_MAX_TOKENS (blank = default; recommended 200-500)"

$apiKey = Normalize-Text (SecureStringToPlainText $apiKeySecure)
$model = Normalize-Text $modelRaw
$maxTokens = Normalize-Text $maxTokensRaw

if (-not $apiKey) {
  Write-Host "Missing OPENROUTER_API_KEY; nothing was set."
  exit 2
}
if (-not $model) {
  Write-Host "Missing OPENAI_COMPAT_MODEL; nothing was set."
  exit 2
}

# Chat backend
[Environment]::SetEnvironmentVariable("DIZZY_CHAT_BACKEND", "openai_compat", "User")

# OpenAI-compatible OpenRouter endpoint
[Environment]::SetEnvironmentVariable("OPENAI_COMPAT_BASE_URL", "https://openrouter.ai/api/v1", "User")
[Environment]::SetEnvironmentVariable("OPENAI_COMPAT_API_KEY", $apiKey, "User")
[Environment]::SetEnvironmentVariable("OPENAI_COMPAT_MODEL", $model, "User")
if ($maxTokens) {
  [Environment]::SetEnvironmentVariable("OPENAI_COMPAT_MAX_TOKENS", $maxTokens, "User")
} else {
  Write-Host "(leaving OPENAI_COMPAT_MAX_TOKENS unchanged)"
}

# Also set for the current session so you can launch immediately.
$env:DIZZY_CHAT_BACKEND = "openai_compat"
$env:OPENAI_COMPAT_BASE_URL = "https://openrouter.ai/api/v1"
$env:OPENAI_COMPAT_API_KEY = $apiKey
$env:OPENAI_COMPAT_MODEL = $model
if ($maxTokens) { $env:OPENAI_COMPAT_MAX_TOKENS = $maxTokens }

Write-Host ""
Write-Host "USER env vars set:"
Write-Host "  DIZZY_CHAT_BACKEND=openai_compat"
Write-Host "  OPENAI_COMPAT_BASE_URL=https://openrouter.ai/api/v1"
Write-Host "  OPENAI_COMPAT_API_KEY=$(Mask-Secret $apiKey)"
Write-Host "  OPENAI_COMPAT_MODEL=$model"
Write-Host "  OPENAI_COMPAT_MAX_TOKENS=$(if($maxTokens){$maxTokens}else{'(unchanged or default)'})"
Write-Host ""
Write-Host "Next: re-run the launcher:"
Write-Host "  powershell -NoProfile -ExecutionPolicy Bypass -File $PSScriptRoot\\launch_telegram.ps1"
