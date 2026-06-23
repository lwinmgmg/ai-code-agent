// provider=gemini — Google Gemini via an API KEY (GEMINI_API_KEY, metered billing).
//
// Runs the official Gemini CLI (`@google/gemini-cli`) headless in "edits only" mode
// (auto-approve, the prompt forbids git) and maps its output into the standard result
// shape. Like the Claude adapters it shells out to a CLI and NEVER touches git — the
// orchestrator (dev-agent.mjs) owns all branching, commits, pushes, PRs, and labels.

import { spawnSync } from 'node:child_process';

const NAME = 'gemini';

// Default model used when neither the -<model> label suffix nor `model` input set one.
const FALLBACK_MODEL = 'gemini-2.5-pro';

// Short label aliases -> full Gemini model ids. A value that isn't a key here (e.g. an
// already-full id like 'gemini-2.5-flash-lite') passes through unchanged, so callers can
// use either the alias or the full id in the -<model> suffix.
const MODEL_ALIASES = {
  'pro': 'gemini-2.5-pro',
  'flash': 'gemini-2.5-flash',
};

export function prepareEnv(providerKey) {
  if (!providerKey) {
    throw new Error('provider_key is required for provider=gemini (the GEMINI_API_KEY).');
  }
  process.env.GEMINI_API_KEY = providerKey; // read by the Gemini CLI (and litellm)
}

export function run({ dir, prompt, model, defaultModel }) {
  const requested = model || defaultModel || FALLBACK_MODEL;
  const chosen = MODEL_ALIASES[requested] || requested; // alias -> full id, or pass through

  // --yolo: non-interactive auto-approval of tool calls (incl. file edits), the closest
  // analog to claude's --permission-mode acceptEdits. -p: run the prompt headless.
  const args = ['--yolo', '--model', chosen, '-p', prompt];

  const res = spawnSync('gemini', args, { cwd: dir, encoding: 'utf8', env: process.env, maxBuffer: 64 * 1024 * 1024 });
  if (res.error) throw res.error;
  if (res.status !== 0) throw new Error(`gemini exited ${res.status}: ${(res.stderr || '').slice(0, 2000)}`);

  // The Gemini CLI does not report turns/duration/cost in its plain output — leave those
  // metrics null so logRun/runSummary render them as unknown rather than misreporting.
  return {
    raw: res.stdout,
    resultText: res.stdout || '',
    model: chosen,
    requested,
    numTurns: null,
    durationMs: null,
    costUsd: null,
    isError: false,
  };
}
