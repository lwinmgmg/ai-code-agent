// provider=openai — OpenAI (GPT) via an API KEY. STUB.
//
// To implement (suggested engine: aider via litellm):
//   prepareEnv(key): process.env.OPENAI_API_KEY = key;
//   run({dir, prompt, model, defaultModel}):
//     spawnSync('aider', [
//       '--model', model || defaultModel || 'gpt-4.1',
//       '--yes-always', '--no-auto-commit', '--no-gitignore', '--message', prompt,
//     ], { cwd: dir, encoding: 'utf8' });
//   then map aider's result into the standard { resultText, model, ... } shape.

const NAME = 'openai';
export function prepareEnv() { throw new Error(`provider='${NAME}' is not implemented yet — see scripts/providers/${NAME}.mjs`); }
export function run() { throw new Error(`provider='${NAME}' is not implemented yet — see scripts/providers/${NAME}.mjs`); }
