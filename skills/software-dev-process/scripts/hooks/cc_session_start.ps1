$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# Claude Code 通过 stdin 传入 JSON：session_id / transcript_path / cwd / source / model
$raw = [Console]::In.ReadToEnd()

$sessionId = ""
$cwd = (Get-Location).Path
$model = ""
$source = ""

if (-not [string]::IsNullOrWhiteSpace($raw)) {
    try {
        $payload = $raw | ConvertFrom-Json
        if ($payload.session_id) { $sessionId = [string]$payload.session_id }
        if ($payload.cwd) { $cwd = [string]$payload.cwd }
        if ($payload.model) { $model = [string]$payload.model }
        if ($payload.source) { $source = [string]$payload.source }
    }
    catch {
        # 解析失败不阻断主流程，仅退化为不带 session 信息的注入
    }
}

$contextLines = @(
    "SDLC Claude Code SessionStart hook is active.",
    "When using software-dev-process, maintain docs/ai-register.db via the skill's scripts/ai_register_core.py: run 'upsert' to register this session identity, and 'progress' to record task progress.",
    "Current working directory: $cwd"
)

if (-not [string]::IsNullOrWhiteSpace($sessionId)) {
    $contextLines += "Current Claude Code session id: $sessionId"
}

if (-not [string]::IsNullOrWhiteSpace($model)) {
    $contextLines += "Current model: $model"
}

if (-not [string]::IsNullOrWhiteSpace($source)) {
    $contextLines += "Session source: $source"
}

$response = @{
    hookSpecificOutput = @{
        hookEventName     = "SessionStart"
        additionalContext = ($contextLines -join "`n")
    }
}

[Console]::WriteLine(($response | ConvertTo-Json -Depth 4 -Compress))
