// provider=oss — open-source / self-hosted models behind an OpenAI-compatible API. STUB.
// Covers local runtimes (Ollama, vLLM, LM Studio, llama.cpp) and OpenAI-compatible gateways.
//
// To implement (suggested engine: aider via litellm, OpenAI-compatible endpoint):
//   prepareEnv(key):
//     process.env.OPENAI_API_KEY = key || 'sk-noop';      // many local servers ignore the key
//     process.env.OPENAI_API_BASE = process.env.OSS_BASE_URL || 'http://localhost:11434/v1';
//   run({dir, prompt, model, defaultModel}):
//     spawnSync('aider', [
//       '--model', `openai/${model || defaultModel || 'qwen2.5-coder'}`,
//       '--yes-always', '--no-auto-commit', '--no-gitignore', '--message', prompt,
//     ], { cwd: dir, encoding: 'utf8' });
//   Consider adding an `oss_base_url` action input rather than reusing OSS_BASE_URL.

const NAME = 'oss';
export function prepareEnv() { throw new Error(`provider='${NAME}' is not implemented yet — see scripts/providers/${NAME}.mjs`); }
export function run() { throw new Error(`provider='${NAME}' is not implemented yet — see scripts/providers/${NAME}.mjs`); }
