// provider=gemini — Google Gemini via an API KEY. STUB.
//
// To implement (suggested engine: aider via litellm):
//   prepareEnv(key): process.env.GEMINI_API_KEY = key;   // litellm reads GEMINI_API_KEY
//   run({dir, prompt, model, defaultModel}):
//     spawnSync('aider', [
//       '--model', `gemini/${model || defaultModel || 'gemini-2.5-pro'}`,
//       '--yes-always', '--no-auto-commit', '--no-gitignore', '--message', prompt,
//     ], { cwd: dir, encoding: 'utf8' });
//   then map aider's result into the standard { resultText, model, ... } shape.

const NAME = 'gemini';
export function prepareEnv() { throw new Error(`provider='${NAME}' is not implemented yet — see scripts/providers/${NAME}.mjs`); }
export function run() { throw new Error(`provider='${NAME}' is not implemented yet — see scripts/providers/${NAME}.mjs`); }
