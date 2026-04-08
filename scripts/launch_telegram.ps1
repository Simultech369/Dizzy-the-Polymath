$ErrorActionPreference = "Stop"

function Mask-Secret([string]$s) {
  if (-not $s) { return "(missing)" }
  if ($s.Length -le 8) { return "****" }
  return ($s.Substring(0, 4) + "..." + $s.Substring($s.Length - 4))
}

function Normalize-Env([string]$s) {
  if ($null -eq $s) { return "" }
  $t = ($s + "").Trim()
  if (($t.StartsWith('"') -and $t.EndsWith('"')) -or ($t.StartsWith("'") -and $t.EndsWith("'"))) {
    $t = $t.Substring(1, $t.Length - 2)
  }
  return $t.Trim()
}

function Get-EnvOrUser([string]$Name, [string]$Fallback = "") {
  $v = Normalize-Env (Get-Item -Path ("Env:" + $Name) -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Value -ErrorAction SilentlyContinue)
  if ($v) { return $v }
  try {
    $u = Normalize-Env ([Environment]::GetEnvironmentVariable($Name, "User"))
    if ($u) { return $u }
  } catch {
    # ignore
  }
  return Normalize-Env $Fallback
}

function Escape-SingleQuotes([string]$s) {
  if ($null -eq $s) { return "" }
  return ($s -replace "'", "''")
}

function Start-DizzyWindow([string]$Repo, [string]$Title, [string]$Cmd) {
  $full = @"
`$Host.UI.RawUI.WindowTitle = '$Title'
`$ErrorActionPreference = 'Stop'
cd '$Repo'
$Cmd
"@
  Start-Process powershell.exe -WorkingDirectory $Repo -ArgumentList @("-NoExit", "-NoProfile", "-Command", $full)
}

function Wait-DizzyHealth([string]$BaseUrl, [string]$AuthToken, [int]$TimeoutSec = 20) {
  $healthUrl = ($BaseUrl.TrimEnd("/") + "/health")
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  $headers = @{}
  if ($AuthToken) { $headers["Authorization"] = ("Bearer " + $AuthToken) }

  while ((Get-Date) -lt $deadline) {
    try {
      $res = Invoke-RestMethod -Uri $healthUrl -Method Get -Headers $headers -TimeoutSec 2
      if ($res -and $res.ok -eq $true) { return $true }
    } catch {
      # keep polling
    }
    Start-Sleep -Milliseconds 500
  }
  return $false
}

function Get-TcpListenersOnPort([int]$Port) {
  $out = @()
  try {
    $lines = & netstat -ano -p tcp | Select-String -Pattern "LISTENING" | ForEach-Object { $_.Line }
    foreach ($line in $lines) {
      $parts = ($line.Trim() -split "\\s+")
      if ($parts.Length -lt 5) { continue }
      $local = [string]$parts[1]
      $state = [string]$parts[3]
      $pid = [string]$parts[4]
      if ($state -ne "LISTENING") { continue }
      if ($local -match (":" + [string]$Port + "$")) {
        $out += [PSCustomObject]@{ Local = $local; Pid = $pid }
      }
    }
  } catch {
    # best-effort only
  }
  return $out
}

$Repo = Split-Path -Parent $PSScriptRoot

# Required (Telegram)
$TelegramBotToken = Normalize-Env $env:TELEGRAM_BOT_TOKEN
$TelegramChatId = Normalize-Env $env:TELEGRAM_CHAT_ID

# Runtime
$BindHost = Normalize-Env $(if ($env:DIZZY_BIND_HOST) { $env:DIZZY_BIND_HOST } else { "127.0.0.1" })
$Port = if ($env:PORT) { [int]$env:PORT } else { 3000 }
$OverrideBaseUrl = $env:DIZZY_BASE_URL_OVERRIDE -eq "1"
$DizzyBaseUrl = Normalize-Env $(if ($OverrideBaseUrl -and $env:DIZZY_BASE_URL) { $env:DIZZY_BASE_URL } else { "http://127.0.0.1:$Port" })
$DizzyAuthToken = Normalize-Env $(if ($env:DIZZY_AUTH_TOKEN) { $env:DIZZY_AUTH_TOKEN } else { "" })

# Chat backend + keys (prefer process env, fall back to persisted User env)
$ChatBackend = Get-EnvOrUser "DIZZY_CHAT_BACKEND" ""
$GeminiApiKey = Get-EnvOrUser "GEMINI_API_KEY" ""
$GeminiModel = Get-EnvOrUser "GEMINI_MODEL" ""
$PromptPack = Get-EnvOrUser "DIZZY_PROMPT_PACK" ""

# Optional chat fallback (OpenAI-compatible: Groq/local)
$FallbackBackend = Get-EnvOrUser "DIZZY_CHAT_FALLBACK_BACKEND" ""
$CompatBaseUrl = Get-EnvOrUser "OPENAI_COMPAT_BASE_URL" ""
$CompatApiKey = Get-EnvOrUser "OPENAI_COMPAT_API_KEY" ""
$CompatModel = Get-EnvOrUser "OPENAI_COMPAT_MODEL" ""
$CompatTimeoutMs = Get-EnvOrUser "OPENAI_COMPAT_TIMEOUT_MS" ""
$CompatTemp = Get-EnvOrUser "OPENAI_COMPAT_TEMPERATURE" ""
$CompatMaxTokens = Get-EnvOrUser "OPENAI_COMPAT_MAX_TOKENS" ""
$FallbackMaxTurns = Get-EnvOrUser "DIZZY_FALLBACK_MAX_TURNS" ""
$FallbackSysMaxChars = Get-EnvOrUser "DIZZY_FALLBACK_SYSTEM_PROMPT_MAX_CHARS" ""
$FallbackUseRag = Get-EnvOrUser "DIZZY_FALLBACK_USE_RAG" ""
$FallbackMaxMsgChars = Get-EnvOrUser "DIZZY_FALLBACK_MAX_MESSAGE_CHARS" ""
$FallbackMaxCallsPerHour = Get-EnvOrUser "DIZZY_FALLBACK_MAX_CALLS_PER_HOUR" ""

# Optional add-ons (require Redis running separately)
$EnableWorker = $env:DIZZY_ENABLE_WORKER -eq "1"
$EnableNotifyDrain = $env:DIZZY_ENABLE_NOTIFY_DRAIN -eq "1"
$RedisUrl = Normalize-Env $(if ($env:REDIS_URL) { $env:REDIS_URL } else { "redis://127.0.0.1:6379" })
$AllowRemoteMutations = Normalize-Env $(if ($env:DIZZY_ALLOW_REMOTE_MUTATIONS) { $env:DIZZY_ALLOW_REMOTE_MUTATIONS } else { "0" })
$AllowSelfModify = Normalize-Env $(if ($env:DIZZY_ALLOW_SELF_MODIFY) { $env:DIZZY_ALLOW_SELF_MODIFY } else { "0" })
$SendStartupMessage = Normalize-Env $(if ($env:TELEGRAM_SEND_STARTUP_MESSAGE) { $env:TELEGRAM_SEND_STARTUP_MESSAGE } else { "0" })
$ToolAllowLocalhost = Normalize-Env $(if ($env:DIZZY_TOOL_ALLOW_LOCALHOST) { $env:DIZZY_TOOL_ALLOW_LOCALHOST } else { "0" })
$ToolAllowPrivateNet = Normalize-Env $(if ($env:DIZZY_TOOL_ALLOW_PRIVATE_NET) { $env:DIZZY_TOOL_ALLOW_PRIVATE_NET } else { "0" })
$ToolDnsTimeoutMs = Normalize-Env $(if ($env:DIZZY_TOOL_DNS_TIMEOUT_MS) { $env:DIZZY_TOOL_DNS_TIMEOUT_MS } else { "2000" })
$ToolMaxRedirects = Normalize-Env $(if ($env:DIZZY_TOOL_MAX_REDIRECTS) { $env:DIZZY_TOOL_MAX_REDIRECTS } else { "3" })

# Telegram relay behavior
$PollJobResults = $env:TELEGRAM_POLL_JOB_RESULTS -eq "1"
$TelegramDebug = $env:TELEGRAM_DEBUG -eq "1"
$OffsetReset = $env:TELEGRAM_OFFSET_RESET -eq "1"

Write-Host "[launch] repo=$Repo"
Write-Host "[launch] telegram_token=$(Mask-Secret $TelegramBotToken) telegram_chat_id=$TelegramChatId"
Write-Host "[launch] base=$DizzyBaseUrl base_override=$(if($OverrideBaseUrl){'on'}else{'off'}) bind=$BindHost port=$Port auth=$(if($DizzyAuthToken){'set'}else{'none'})"
Write-Host "[launch] worker=$(if($EnableWorker){'on'}else{'off'}) notify_drain=$(if($EnableNotifyDrain){'on'}else{'off'}) poll_job_results=$(if($PollJobResults){'on'}else{'off'})"
Write-Host "[launch] telegram_debug=$(if($TelegramDebug){'on'}else{'off'}) offset_reset=$(if($OffsetReset){'on'}else{'off'})"
Write-Host "[launch] remote_mutations=$AllowRemoteMutations self_modify=$AllowSelfModify startup_message=$SendStartupMessage tool_localhost=$ToolAllowLocalhost tool_private=$ToolAllowPrivateNet"

if (-not $TelegramBotToken -or -not $TelegramChatId) {
  Write-Host ""
  Write-Host "Missing TELEGRAM_BOT_TOKEN and/or TELEGRAM_CHAT_ID in this PowerShell session."
  Write-Host "Set them and re-run (or run set_user_env_telegram.ps1):"
  Write-Host '  $env:TELEGRAM_BOT_TOKEN="123456789:AA..."'
  Write-Host '  $env:TELEGRAM_CHAT_ID="123456789"'
  exit 2
}

$listeners = Get-TcpListenersOnPort -Port $Port
if ($listeners.Count -gt 0) {
  Write-Host ""
  Write-Host "[launch] ERROR: port $Port already has a TCP listener:"
  foreach ($l in $listeners) {
    $pname = ""
    try { $pname = (Get-Process -Id ([int]$l.Pid) -ErrorAction Stop).ProcessName } catch { $pname = "" }
    Write-Host ("  " + $l.Local + " pid=" + $l.Pid + ($(if ($pname) { " (" + $pname + ")" } else { "" })))
  }
  Write-Host ""
  Write-Host "[launch] Pick a free port and retry, e.g.:"
  Write-Host "  `$env:PORT=3001 ; powershell -NoProfile -ExecutionPolicy Bypass -File $PSScriptRoot\\launch_telegram.ps1"
  exit 4
}

Start-DizzyWindow $Repo "Dizzy Server" @"
`$env:DIZZY_BIND_HOST='$BindHost'
`$env:PORT='$Port'
`$env:DIZZY_AUTH_TOKEN='$DizzyAuthToken'
$(if ($ChatBackend) { "`$env:DIZZY_CHAT_BACKEND='" + (Escape-SingleQuotes $ChatBackend) + "'" } else { "" })
$(if ($GeminiApiKey) { "`$env:GEMINI_API_KEY='" + (Escape-SingleQuotes $GeminiApiKey) + "'" } else { "" })
$(if ($GeminiModel) { "`$env:GEMINI_MODEL='" + (Escape-SingleQuotes $GeminiModel) + "'" } else { "" })
$(if ($PromptPack) { "`$env:DIZZY_PROMPT_PACK='" + (Escape-SingleQuotes $PromptPack) + "'" } else { "" })
$(if ($FallbackBackend) { "`$env:DIZZY_CHAT_FALLBACK_BACKEND='" + (Escape-SingleQuotes $FallbackBackend) + "'" } else { "" })
$(if ($CompatBaseUrl) { "`$env:OPENAI_COMPAT_BASE_URL='" + (Escape-SingleQuotes $CompatBaseUrl) + "'" } else { "" })
$(if ($CompatApiKey) { "`$env:OPENAI_COMPAT_API_KEY='" + (Escape-SingleQuotes $CompatApiKey) + "'" } else { "" })
$(if ($CompatModel) { "`$env:OPENAI_COMPAT_MODEL='" + (Escape-SingleQuotes $CompatModel) + "'" } else { "" })
$(if ($CompatTimeoutMs) { "`$env:OPENAI_COMPAT_TIMEOUT_MS='" + (Escape-SingleQuotes $CompatTimeoutMs) + "'" } else { "" })
$(if ($CompatTemp) { "`$env:OPENAI_COMPAT_TEMPERATURE='" + (Escape-SingleQuotes $CompatTemp) + "'" } else { "" })
$(if ($CompatMaxTokens) { "`$env:OPENAI_COMPAT_MAX_TOKENS='" + (Escape-SingleQuotes $CompatMaxTokens) + "'" } else { "" })
$(if ($FallbackMaxTurns) { "`$env:DIZZY_FALLBACK_MAX_TURNS='" + (Escape-SingleQuotes $FallbackMaxTurns) + "'" } else { "" })
$(if ($FallbackSysMaxChars) { "`$env:DIZZY_FALLBACK_SYSTEM_PROMPT_MAX_CHARS='" + (Escape-SingleQuotes $FallbackSysMaxChars) + "'" } else { "" })
$(if ($FallbackUseRag) { "`$env:DIZZY_FALLBACK_USE_RAG='" + (Escape-SingleQuotes $FallbackUseRag) + "'" } else { "" })
$(if ($FallbackMaxMsgChars) { "`$env:DIZZY_FALLBACK_MAX_MESSAGE_CHARS='" + (Escape-SingleQuotes $FallbackMaxMsgChars) + "'" } else { "" })
$(if ($FallbackMaxCallsPerHour) { "`$env:DIZZY_FALLBACK_MAX_CALLS_PER_HOUR='" + (Escape-SingleQuotes $FallbackMaxCallsPerHour) + "'" } else { "" })
$(if ($EnableWorker -or $env:REDIS_URL) { "`$env:REDIS_URL='$RedisUrl'" } else { "" })
`$env:DIZZY_ALLOW_REMOTE_MUTATIONS='$AllowRemoteMutations'
`$env:DIZZY_ALLOW_SELF_MODIFY='$AllowSelfModify'
`$env:DIZZY_TOOL_ALLOW_LOCALHOST='$ToolAllowLocalhost'
`$env:DIZZY_TOOL_ALLOW_PRIVATE_NET='$ToolAllowPrivateNet'
`$env:DIZZY_TOOL_DNS_TIMEOUT_MS='$ToolDnsTimeoutMs'
`$env:DIZZY_TOOL_MAX_REDIRECTS='$ToolMaxRedirects'
node .\agent_server.mjs
"@

Write-Host "[launch] waiting for /health..."
$HealthTimeoutSec = if ($env:DIZZY_HEALTH_TIMEOUT_SEC) { [int]$env:DIZZY_HEALTH_TIMEOUT_SEC } else { 60 }
$ok = Wait-DizzyHealth -BaseUrl $DizzyBaseUrl -AuthToken $DizzyAuthToken -TimeoutSec $HealthTimeoutSec
if (-not $ok) {
  Write-Host "[launch] ERROR: server not healthy at $($DizzyBaseUrl.TrimEnd('/'))/health after $HealthTimeoutSec s."
  Write-Host "[launch] Check the 'Dizzy Server' window for errors (port in use, node crash, etc)."
  Write-Host "[launch] Try: `$env:PORT=3001 ; powershell -NoProfile -ExecutionPolicy Bypass -File $PSScriptRoot\\launch_telegram.ps1"
  exit 3
}
Write-Host "[launch] server healthy"

Start-DizzyWindow $Repo "Dizzy Telegram Relay" @"
`$env:DIZZY_BASE_URL='$DizzyBaseUrl'
`$env:DIZZY_AUTH_TOKEN='$DizzyAuthToken'
`$env:TELEGRAM_BOT_TOKEN='$TelegramBotToken'
`$env:TELEGRAM_CHAT_ID='$TelegramChatId'
`$env:TELEGRAM_POLL_JOB_RESULTS='$([int]$PollJobResults)'
`$env:TELEGRAM_DEBUG='$([int]$TelegramDebug)'
`$env:TELEGRAM_OFFSET_RESET='$([int]$OffsetReset)'
`$env:TELEGRAM_ALLOW_AUTO_BIND='0'
`$env:TELEGRAM_SEND_STARTUP_MESSAGE='$SendStartupMessage'
`$env:DIZZY_ALLOW_REMOTE_MUTATIONS='$AllowRemoteMutations'
`$env:DIZZY_ALLOW_SELF_MODIFY='0'
node .\scripts\telegram_relay.mjs
"@

if ($EnableWorker) {
  Start-DizzyWindow $Repo "Dizzy Worker" @"
`$env:REDIS_URL='$RedisUrl'
node .\worker.mjs
"@
}

if ($EnableNotifyDrain) {
  Start-DizzyWindow $Repo "Dizzy Telegram Alerts" @"
`$env:DIZZY_BASE_URL='$DizzyBaseUrl'
`$env:DIZZY_AUTH_TOKEN='$DizzyAuthToken'
`$env:TELEGRAM_BOT_TOKEN='$TelegramBotToken'
`$env:TELEGRAM_CHAT_ID='$TelegramChatId'
node .\scripts\telegram_notify_drain.mjs
"@
}

Write-Host "[launch] started"
