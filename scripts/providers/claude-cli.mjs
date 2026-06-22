// Shared `claude` CLI runner — the provider-independent execution path used by the
// Claude adapters (claude-sub today, claude-api next). Auth-agnostic: it assumes the
// caller's prepareEnv already wired the credential env (CLAUDE_CODE_OAUTH_TOKEN or
// ANTHROPIC_API_KEY). It only spawns the CLI, parses the JSON result, and returns the
// standard result shape — it never touches git or auth.

import { spawnSync } from 'node:child_process';

export function runClaudeCli({ dir, prompt, model, defaultModel }) {
  const chosen = model || defaultModel || ''; // '' => Claude account default
  const args = ['-p', prompt, '--permission-mode', 'acceptEdits',
    '--allowedTools', 'Read,Edit,Write,Glob,Grep,Bash', '--output-format', 'json'];
  if (chosen) args.push('--model', chosen); // alias (opus|sonnet|haiku) or full id

  const res = spawnSync('claude', args, { cwd: dir, encoding: 'utf8', env: process.env, maxBuffer: 64 * 1024 * 1024 });
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
