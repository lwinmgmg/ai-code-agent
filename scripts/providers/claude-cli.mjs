// Shared `claude` CLI runner — the provider-independent execution path used by the
// Claude adapters (claude-sub today, claude-api next). Auth-agnostic: it assumes the
// caller's prepareEnv already wired the credential env (CLAUDE_CODE_OAUTH_TOKEN or
// ANTHROPIC_API_KEY). It only spawns the CLI, parses the JSON result, and returns the
// standard result shape — it never touches git or auth.

import { spawnSync } from 'node:child_process';

// Named thinking levels -> a reasoning-token budget the Claude CLI honors via
// MAX_THINKING_TOKENS. Driven by an `ai-thinking-<level>` label; an unknown or
// absent level leaves the budget unset (the account default), per the issue.
const THINKING_BUDGETS = { low: 4000, medium: 10000, high: 20000, max: 31999 };

export function runClaudeCli({ dir, prompt, model, defaultModel, thinking }) {
  const chosen = model || defaultModel || ''; // '' => Claude account default
  const args = ['-p', prompt, '--permission-mode', 'acceptEdits',
    '--allowedTools', 'Read,Edit,Write,Glob,Grep,Bash', '--output-format', 'json'];
  if (chosen) args.push('--model', chosen); // alias (opus|sonnet|haiku) or full id

  // Raise the thinking budget for a known level; unknown/absent => provider default.
  const env = process.env;
  const budget = THINKING_BUDGETS[(thinking || '').toLowerCase()];
  if (budget) env.MAX_THINKING_TOKENS = String(budget);

  const res = spawnSync('claude', args, { cwd: dir, encoding: 'utf8', env, maxBuffer: 64 * 1024 * 1024 });
  if (res.error) throw res.error;
  if (res.status !== 0) throw new Error(`claude exited ${res.status}: ${(res.stderr || '').slice(0, 2000)}`);

  let j = {};
  try { j = JSON.parse(res.stdout); } catch { /* non-JSON output */ }
  const used = j.modelUsage ? Object.keys(j.modelUsage) : [];
  return {
    raw: res.stdout,
    resultText: j.result || '',
    model: used.join(',') || chosen || '(account default)',
    requested: chosen || '(account default)',
    numTurns: j.num_turns,
    durationMs: j.duration_ms,
    costUsd: j.total_cost_usd,
    isError: !!j.is_error,
  };
}
