// provider=claude-sub — Claude via a Pro/Max SUBSCRIPTION (OAuth token), not an API key.
// Use this to stay on subscription billing. For key-based Anthropic, use claude-api.
//
// Runs the Claude Code CLI headless in "edits only" mode (the prompt forbids git)
// and parses the JSON result.

import { runClaudeCli } from './claude-cli.mjs';

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

export function run({ dir, prompt, model, defaultModel, thinking }) {
  return runClaudeCli({ dir, prompt, model, defaultModel, thinking });
}
