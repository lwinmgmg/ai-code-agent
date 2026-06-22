// provider=claude-api — Anthropic via an API KEY (metered billing). STUB.
//
// For subscription billing (no API key), use provider=claude-sub instead.
//
// To implement (suggested engine: aider via litellm):
//   prepareEnv(key): process.env.ANTHROPIC_API_KEY = key;
//   run({dir, prompt, model, defaultModel}):
//     spawnSync('aider', [
//       '--model', `anthropic/${model || defaultModel || 'claude-sonnet-4-6'}`,
//       '--yes-always', '--no-auto-commit', '--no-gitignore', '--message', prompt,
//     ], { cwd: dir, encoding: 'utf8' });
//   then map aider's result into { resultText, model, numTurns, durationMs, costUsd, isError, raw }.

const NAME = 'claude-api';
export function prepareEnv() { throw new Error(`provider='${NAME}' is not implemented yet — see scripts/providers/${NAME}.mjs`); }
export function run() { throw new Error(`provider='${NAME}' is not implemented yet — see scripts/providers/${NAME}.mjs`); }
