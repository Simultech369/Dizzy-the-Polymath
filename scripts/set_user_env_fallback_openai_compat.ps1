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

Write-Host "This will set USER environment variables (persistent) for the OpenAI-compatible chat fallback."
Write-Host "Use this for Groq or a local OpenAI-compatible endpoint (Ollama/vLLM)."
Write-Host "Note: user env vars are stored in plaintext for your Windows user account."
Write-Host ""

$baseUrlRaw = Read-Host "Enter OPENAI_COMPAT_BASE_URL (example: https://api.groq.com/openai/v1)"
$apiKeySecure = Read-Host "Enter OPENAI_COMPAT_API_KEY (blank allowed for local)" -AsSecureString
$modelRaw = Read-Host "Enter OPENAI_COMPAT_MODEL (provider-specific)"
$capRaw = Read-Host "Enter DIZZY_FALLBACK_MAX_CALLS_PER_HOUR (blank = unlimited; recommended 10)"
$maxTokensRaw = Read-Host "Enter OPENAI_COMPAT_MAX_TOKENS (blank = default; recommended 200)"
$maxTurnsRaw = Read-Host "Enter DIZZY_FALLBACK_MAX_TURNS (blank = default; recommended 3)"
$sysMaxCharsRaw = Read-Host "Enter DIZZY_FALLBACK_SYSTEM_PROMPT_MAX_CHARS (blank = default; recommended 2500)"
$useRagRaw = Read-Host "Enter DIZZY_FALLBACK_USE_RAG (0/1; blank = default; recommended 0)"
$maxMsgCharsRaw = Read-Host "Enter DIZZY_FALLBACK_MAX_MESSAGE_CHARS (blank = default; recommended 1200)"

$baseUrl = Normalize-Text $baseUrlRaw
$apiKey = Normalize-Text (SecureStringToPlainText $apiKeySecure)
$model = Normalize-Text $modelRaw
$cap = Normalize-Text $capRaw
$maxTokens = Normalize-Text $maxTokensRaw
$maxTurns = Normalize-Text $maxTurnsRaw
$sysMaxChars = Normalize-Text $sysMaxCharsRaw
$useRag = Normalize-Text $useRagRaw
$maxMsgChars = Normalize-Text $maxMsgCharsRaw

if (-not $baseUrl) {
  Write-Host "Missing OPENAI_COMPAT_BASE_URL; nothing was set."
  exit 2
}
if (-not $model) {
  Write-Host "Missing OPENAI_COMPAT_MODEL; nothing was set."
  exit 2
}

[Environment]::SetEnvironmentVariable("DIZZY_CHAT_FALLBACK_BACKEND", "openai_compat", "User")
[Environment]::SetEnvironmentVariable("OPENAI_COMPAT_BASE_URL", $baseUrl, "User")
[Environment]::SetEnvironmentVariable("OPENAI_COMPAT_MODEL", $model, "User")
if ($cap) {
  [Environment]::SetEnvironmentVariable("DIZZY_FALLBACK_MAX_CALLS_PER_HOUR", $cap, "User")
} else {
  Write-Host "(leaving DIZZY_FALLBACK_MAX_CALLS_PER_HOUR unchanged)"
}
if ($maxTokens) {
  [Environment]::SetEnvironmentVariable("OPENAI_COMPAT_MAX_TOKENS", $maxTokens, "User")
} else {
  Write-Host "(leaving OPENAI_COMPAT_MAX_TOKENS unchanged)"
}
if ($maxTurns) {
  [Environment]::SetEnvironmentVariable("DIZZY_FALLBACK_MAX_TURNS", $maxTurns, "User")
} else {
  Write-Host "(leaving DIZZY_FALLBACK_MAX_TURNS unchanged)"
}
if ($sysMaxChars) {
  [Environment]::SetEnvironmentVariable("DIZZY_FALLBACK_SYSTEM_PROMPT_MAX_CHARS", $sysMaxChars, "User")
} else {
  Write-Host "(leaving DIZZY_FALLBACK_SYSTEM_PROMPT_MAX_CHARS unchanged)"
}
if ($useRag) {
  [Environment]::SetEnvironmentVariable("DIZZY_FALLBACK_USE_RAG", $useRag, "User")
} else {
  Write-Host "(leaving DIZZY_FALLBACK_USE_RAG unchanged)"
}
if ($maxMsgChars) {
  [Environment]::SetEnvironmentVariable("DIZZY_FALLBACK_MAX_MESSAGE_CHARS", $maxMsgChars, "User")
} else {
  Write-Host "(leaving DIZZY_FALLBACK_MAX_MESSAGE_CHARS unchanged)"
}
if ($apiKey) {
  [Environment]::SetEnvironmentVariable("OPENAI_COMPAT_API_KEY", $apiKey, "User")
} else {
  Write-Host "(leaving OPENAI_COMPAT_API_KEY blank)"
}

# Also set for the current session so you can launch immediately.
$env:DIZZY_CHAT_FALLBACK_BACKEND = "openai_compat"
$env:OPENAI_COMPAT_BASE_URL = $baseUrl
$env:OPENAI_COMPAT_MODEL = $model
if ($cap) { $env:DIZZY_FALLBACK_MAX_CALLS_PER_HOUR = $cap }
if ($maxTokens) { $env:OPENAI_COMPAT_MAX_TOKENS = $maxTokens }
if ($maxTurns) { $env:DIZZY_FALLBACK_MAX_TURNS = $maxTurns }
if ($sysMaxChars) { $env:DIZZY_FALLBACK_SYSTEM_PROMPT_MAX_CHARS = $sysMaxChars }
if ($useRag) { $env:DIZZY_FALLBACK_USE_RAG = $useRag }
if ($maxMsgChars) { $env:DIZZY_FALLBACK_MAX_MESSAGE_CHARS = $maxMsgChars }
if ($apiKey) { $env:OPENAI_COMPAT_API_KEY = $apiKey }

Write-Host ""
Write-Host "USER env vars set:"
Write-Host "  DIZZY_CHAT_FALLBACK_BACKEND=openai_compat"
Write-Host "  OPENAI_COMPAT_BASE_URL=$baseUrl"
Write-Host "  OPENAI_COMPAT_API_KEY=$(if($apiKey){Mask-Secret $apiKey}else{'(blank)'})"
Write-Host "  OPENAI_COMPAT_MODEL=$model"
Write-Host "  DIZZY_FALLBACK_MAX_CALLS_PER_HOUR=$(if($cap){$cap}else{'(unchanged or unlimited)'})"
Write-Host "  OPENAI_COMPAT_MAX_TOKENS=$(if($maxTokens){$maxTokens}else{'(unchanged or default)'})"
Write-Host "  DIZZY_FALLBACK_MAX_TURNS=$(if($maxTurns){$maxTurns}else{'(unchanged or default)'})"
Write-Host "  DIZZY_FALLBACK_SYSTEM_PROMPT_MAX_CHARS=$(if($sysMaxChars){$sysMaxChars}else{'(unchanged or default)'})"
Write-Host "  DIZZY_FALLBACK_USE_RAG=$(if($useRag){$useRag}else{'(unchanged or default)'})"
Write-Host "  DIZZY_FALLBACK_MAX_MESSAGE_CHARS=$(if($maxMsgChars){$maxMsgChars}else{'(unchanged or default)'})"
Write-Host ""
Write-Host "Next: re-run the launcher:"
Write-Host "  powershell -NoProfile -ExecutionPolicy Bypass -File $PSScriptRoot\\launch_telegram.ps1"
