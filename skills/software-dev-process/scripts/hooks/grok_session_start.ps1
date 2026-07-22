[CmdletBinding()]
param(
    [Parameter(ValueFromPipeline = $true)]
    [AllowEmptyString()]
    [string]$InputJson = ""
)

$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# Grok SessionStart:
# - stdin JSON may include sessionId / cwd / workspaceRoot / model (camelCase or snake_case)
# - env is more reliable: GROK_SESSION_ID, GROK_WORKSPACE_ROOT, GROK_HOOK_EVENT
# - official docs: passive SessionStart ignores stdout for context injection
# - still emit Claude-compatible hookSpecificOutput for compat layers
# - write a small context file so AI registration can read a trusted session id
# - do NOT write ai-register.db here; registration stays AI-driven after identity is known

$raw = $InputJson
if ([string]::IsNullOrWhiteSpace($raw)) {
    try {
        $raw = [Console]::In.ReadToEnd()
    }
    catch {
        $raw = ""
    }
}

$sessionId = ""
$cwd = (Get-Location).Path
$model = ""
$source = ""

if (-not [string]::IsNullOrWhiteSpace($env:GROK_SESSION_ID)) {
    $sessionId = [string]$env:GROK_SESSION_ID
}
if (-not [string]::IsNullOrWhiteSpace($env:GROK_WORKSPACE_ROOT)) {
    $cwd = [string]$env:GROK_WORKSPACE_ROOT
}
elseif (-not [string]::IsNullOrWhiteSpace($env:CLAUDE_PROJECT_DIR)) {
    $cwd = [string]$env:CLAUDE_PROJECT_DIR
}
if (-not [string]::IsNullOrWhiteSpace($env:GROK_HOOK_EVENT)) {
    $source = "Grok:$($env:GROK_HOOK_EVENT)"
}

if (-not [string]::IsNullOrWhiteSpace($raw)) {
    try {
        $payload = $raw | ConvertFrom-Json
        # Prefer runner-injected env; fill gaps from stdin JSON only.
        if ([string]::IsNullOrWhiteSpace($sessionId)) {
            if ($payload.sessionId) { $sessionId = [string]$payload.sessionId }
            elseif ($payload.session_id) { $sessionId = [string]$payload.session_id }
        }
        $envProvidedCwd = -not [string]::IsNullOrWhiteSpace($env:GROK_WORKSPACE_ROOT) -or `
            -not [string]::IsNullOrWhiteSpace($env:CLAUDE_PROJECT_DIR)
        if (-not $envProvidedCwd) {
            if ($payload.cwd) { $cwd = [string]$payload.cwd }
            elseif ($payload.workspaceRoot) { $cwd = [string]$payload.workspaceRoot }
            elseif ($payload.workspace_root) { $cwd = [string]$payload.workspace_root }
        }
        if ([string]::IsNullOrWhiteSpace($model) -and $payload.model) {
            $model = [string]$payload.model
        }
        if ([string]::IsNullOrWhiteSpace($source)) {
            if ($payload.source) { $source = [string]$payload.source }
            elseif ($payload.hookEventName) { $source = [string]$payload.hookEventName }
            elseif ($payload.hook_event_name) { $source = [string]$payload.hook_event_name }
        }
    }
    catch {
        # Invalid hook input must not block session startup.
    }
}

if ([string]::IsNullOrWhiteSpace($sessionId)) {
    $sessionId = $env:GROK_SESSION
}
if ([string]::IsNullOrWhiteSpace($model)) {
    $model = $env:GROK_MODEL
}
if ([string]::IsNullOrWhiteSpace($source)) {
    $source = "SessionStart"
}

$contextLines = @(
    "SDLC Grok SessionStart hook is active.",
    "When using software-dev-process, maintain AI registration via scripts/ai_register_core.py (PostgreSQL/MySQL config first, project SQLite fallback). Never guess a missing session id from transcript timestamps.",
    "Current working directory: $cwd",
    "Tool: Grok"
)

if (-not [string]::IsNullOrWhiteSpace($sessionId)) {
    $contextLines += "Current Grok session id: $sessionId"
    $contextLines += "Resume shell: grok --resume $sessionId"
    $contextLines += "Resume CLI: /resume"
}
else {
    $contextLines += "Current Grok session id is unavailable; skip AI registration rather than guessing."
}

if (-not [string]::IsNullOrWhiteSpace($model)) {
    $contextLines += "Current model: $model"
}
if (-not [string]::IsNullOrWhiteSpace($source)) {
    $contextLines += "Session source: $source"
}

$contextLines += "If session id is not visible in conversation context, read .grok/sdlc-session-context.txt or ~/.grok/sdlc-session-context.txt before registering."

$contextText = ($contextLines -join [Environment]::NewLine)

# Durable fallback: Grok passive SessionStart may ignore stdout injection.
$contextTargets = @()
if (-not [string]::IsNullOrWhiteSpace($cwd)) {
    $contextTargets += (Join-Path $cwd ".grok\sdlc-session-context.txt")
}
$grokHome = if (-not [string]::IsNullOrWhiteSpace($env:GROK_HOME)) {
    $env:GROK_HOME
}
else {
    Join-Path $HOME ".grok"
}
$contextTargets += (Join-Path $grokHome "sdlc-session-context.txt")

foreach ($target in $contextTargets) {
    try {
        $parent = Split-Path -Parent $target
        if (-not [string]::IsNullOrWhiteSpace($parent) -and -not (Test-Path -LiteralPath $parent)) {
            New-Item -ItemType Directory -Path $parent -Force | Out-Null
        }
        [System.IO.File]::WriteAllText($target, $contextText, [System.Text.UTF8Encoding]::new($false))
    }
    catch {
        # Context file write failures must not block session startup.
    }
}

# Claude-compatible payload; Grok native may ignore it, but keep for compat layers.
$response = @{
    hookSpecificOutput = @{
        hookEventName     = "SessionStart"
        additionalContext = ($contextLines -join "`n")
    }
}

[Console]::WriteLine(($response | ConvertTo-Json -Depth 4 -Compress))
exit 0
