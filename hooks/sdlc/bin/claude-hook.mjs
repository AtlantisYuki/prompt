#!/usr/bin/env node
import { runClaudeCodeHook } from "../adapters/claude-code.mjs";

runClaudeCodeHook().catch((error) => {
  process.stdout.write(
    `${JSON.stringify({
      decision: "deny",
      reason: `SDLC Claude Code hook failed: ${error.message}`,
    })}\n`,
  );
});
