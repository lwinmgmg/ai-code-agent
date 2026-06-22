// provider=claude-sub — Claude via a Pro/Max SUBSCRIPTION (OAuth token), not an API key.
// Use this to stay on subscription billing. For key-based Anthropic, use claude-api.
//
// Runs the Claude Code CLI headless in "edits only" mode (the prompt forbids git)
// and parses the JSON result.

import { spawnSync } from 'node:child_process';

export function prepareEnv(providerKey) {
  if (!providerKey) {
    throw new Error('provider_key is required for provider=claude-sub (the `claude setup-token` OAuth token).');
  }
  // Guardrail: claude-sub is subscription-only. An API key here would silently bypass
  // the subscription model — refuse, so the subscription-only guarantee stays honest.
  if (process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is set — provider=claude-sub is subscription-only. Use provider=claude-api for key-based Anthropic.');
  }
  process.env.CLAUDE_CODE_OAUTH_TOKEN = providerKey; // read directly by `claude`
}

export function run({ dir, prompt, model, defaultModel }) {
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
