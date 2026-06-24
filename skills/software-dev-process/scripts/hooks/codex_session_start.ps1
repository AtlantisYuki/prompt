$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$cwd = (Get-Location).Path
$sessionId = $env:CODEX_SESSION_ID
if ([string]::IsNullOrWhiteSpace($sessionId)) {
    $sessionId = $env:CODEX_SESSION
}

$contextLines = @(
    "SDLC Codex SessionStart hook is active.",
    "When using software-dev-process, maintain docs/ai-register.db via the skill's scripts/ai_register_core.py: run 'upsert' to register this session identity, and 'progress' to record task progress.",
    "Current working directory: $cwd"
)

if (-not [string]::IsNullOrWhiteSpace($sessionId)) {
    $contextLines += "Current Codex session id: $sessionId"
}

$response = @{
    hookSpecificOutput = @{
        hookEventName     = "SessionStart"
        additionalContext = ($contextLines -join "`n")
    }
}

[Console]::WriteLine(($response | ConvertTo-Json -Depth 4 -Compress))
