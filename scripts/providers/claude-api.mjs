// provider=claude-api — Claude via an API KEY (ANTHROPIC_API_KEY, metered billing).
// Mirrors claude-sub but authenticates with an API key instead of an OAuth token.
//
// For subscription billing (no API key), use provider=claude-sub instead.
//
// Runs the Claude Code CLI headless in "edits only" mode (the prompt forbids git)
// via the shared runner and parses the JSON result.

import { runClaudeCli } from './claude-cli.mjs';

export function prepareEnv(providerKey) {
  if (!providerKey) {
    throw new Error('provider_key is required for provider=claude-api (the ANTHROPIC_API_KEY).');
  }
  // Guardrail (inverse of claude-sub): claude-api is key-based. An OAuth token here would
  // silently mix the two auth modes — refuse, so each provider owns exactly one credential.
  if (process.env.CLAUDE_CODE_OAUTH_TOKEN) {
    throw new Error('CLAUDE_CODE_OAUTH_TOKEN is set — provider=claude-api is key-based. Use provider=claude-sub for subscription (OAuth) auth.');
  }
  process.env.ANTHROPIC_API_KEY = providerKey; // read directly by `claude`
}

export function run({ dir, prompt, model, defaultModel }) {
  return runClaudeCli({ dir, prompt, model, defaultModel });
}
