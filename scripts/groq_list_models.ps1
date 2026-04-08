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

$key = Normalize-Text $env:GROQ_API_KEY

if (-not $key) {
  $key = Normalize-Text $env:OPENAI_COMPAT_API_KEY
}

if (-not $key) {
  try {
    $key = Normalize-Text ([Environment]::GetEnvironmentVariable("OPENAI_COMPAT_API_KEY", "User"))
  } catch {
    $key = ""
  }
}

if (-not $key) {
  Write-Host "No API key found in env."
  Write-Host "Enter your Groq API key (it will not echo):"
  $keySecure = Read-Host "GROQ_API_KEY" -AsSecureString
  $key = Normalize-Text (SecureStringToPlainText $keySecure)
}

if (-not $key) {
  Write-Host "Missing GROQ_API_KEY; cannot list models."
  exit 2
}

$url = "https://api.groq.com/openai/v1/models"
$headers = @{
  Authorization = ("Bearer " + $key)
  "Content-Type" = "application/json"
}

try {
  $res = Invoke-RestMethod -Uri $url -Method Get -Headers $headers -TimeoutSec 20
} catch {
  Write-Host ("Request failed: " + $_.Exception.Message)
  exit 3
}

$ids = @()
if ($res -and $res.data) {
  foreach ($m in $res.data) {
    if ($m -and $m.id) { $ids += [string]$m.id }
  }
}

if ($ids.Count -eq 0) {
  Write-Host "No models returned."
  exit 4
}

$ids = $ids | Sort-Object -Unique
Write-Host ""
Write-Host "Available Groq model IDs:"
$ids | ForEach-Object { Write-Host ("- " + $_) }
