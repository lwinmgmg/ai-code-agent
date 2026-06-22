// Provider registry. Each adapter implements the same two-function contract so the
// orchestrator (dev-agent.mjs) stays provider-independent:
//
//   prepareEnv(providerKey)            -> void   wire up auth + assert guardrails (fail fast)
//   run({ dir, prompt, model,                    make edits in `dir`; never touch git
//         defaultModel, thinking })    -> result  (thinking: optional ai-thinking-<level>)
//
// where `result` is:
//   { resultText, model, requested, numTurns, durationMs, costUsd, isError, raw }
//
// Only `claude-sub` is implemented. The others are stubs that throw with a clear
// message and carry a concrete aider-based sketch for whoever implements them.

import * as claudeSub from './claude-sub.mjs';
import * as claudeApi from './claude-api.mjs';
import * as gemini from './gemini.mjs';
import * as openai from './openai.mjs';
import * as oss from './oss.mjs';

const REGISTRY = {
  'claude-sub': claudeSub,
  'claude-api': claudeApi,
  'gemini': gemini,
  'openai': openai,
  'oss': oss,
};

export function getProvider(name) {
  const p = REGISTRY[name];
  if (!p) throw new Error(`unknown provider '${name}'. Known: ${Object.keys(REGISTRY).join(', ')}`);
  return p;
}
