# ai-code-agent

A **provider-agnostic dev-agent GitHub Action**. Apply a label to an issue or PR and the
action does one unit of work and exits — no always-on server.

- An issue labeled **`ai-ready[-<model>]`** → implement on a `dev/*` branch → open a PR.
- A PR labeled **`ai-needs-changes[-<model>]`** → revise the PR branch from review feedback.

If the **target** repo has a `CLAUDE.md` / `AGENTS.md`, that governs what the agent does in
the working tree. Pick the engine with `provider`.

> **Subscription or API key.** `provider: claude-sub` uses a Claude Pro/Max subscription
> (OAuth token, no API key) and refuses to run if `ANTHROPIC_API_KEY` is set — so a project
> that wants to stay subscription-only gets that guarantee enforced. The other providers use
> an API key.

## Quick start

1. Create a dedicated **bot GitHub account**, give it repo write, and mint a PAT → store as
   the `DEV_BOT_PAT` secret. **Do not** use the default `GITHUB_TOKEN` — PRs it opens won't
   trigger your CI workflows.
2. Generate a subscription token: `claude setup-token` → store as `CLAUDE_CODE_OAUTH_TOKEN`.
3. Copy [`examples/caller-claude-sub.yml`](./examples/caller-claude-sub.yml) into each repo
   as `.github/workflows/dev-agent.yml`.
4. Label an issue `ai-ready` (or `ai-ready-sonnet`, etc.). Watch the Actions tab.

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `provider` | yes | `claude-sub` | Engine (single): `claude-sub` \| `claude-api` \| `gemini` \| `openai` \| `oss`. |
| `provider_key` | yes | — | `claude-sub` OAuth token, or the provider's API key. |
| `github_token` | yes | — | Dedicated **bot PAT** (repo write). Not the default `GITHUB_TOKEN`. |
| `language` | no | `""` | Comma-separated toolchains to pre-install: `go,node,bun` (extensible). |
| `model` | no | `""` | Default model when a label has no `-<model>` suffix. |
| `models` | no | `opus,sonnet,haiku` | Allowed `-<model>` label suffixes. |
| `ready_label` | no | `ai-ready` | Implement-loop trigger. |
| `review_label` | no | `ai-needs-changes` | Revise-loop trigger. |
| `base_branch` | no | `main` | PR base. |
| `max_review_iterations` | no | `3` | Escalate instead of looping past this. |
| `git_author_name` / `git_author_email` | no | bot identity | Commit identity. |

### Outputs

| Output | Description |
|--------|-------------|
| `status` | `pr-opened` \| `pr-updated` \| `escalated` \| `no-changes` \| `skipped`. |
| `pr_url` | URL of the PR opened/updated, if any. |

## Provider status

| Provider | Auth | Status |
|----------|------|--------|
| `claude-sub` | Subscription OAuth (`claude setup-token`) | ✅ implemented (Claude Code CLI) |
| `claude-api` | `ANTHROPIC_API_KEY` | 🚧 stub |
| `gemini` | `GEMINI_API_KEY` | 🚧 stub |
| `openai` | `OPENAI_API_KEY` | 🚧 stub |
| `oss` | OpenAI-compatible endpoint | 🚧 stub |

## Adding a provider

Every engine is a uniform **"edits-only" adapter** — it makes file edits in a working tree
and never touches git; the orchestrator ([`scripts/dev-agent.mjs`](./scripts/dev-agent.mjs))
owns all branching, commits, PRs, labels, and escalation. Implement two functions in
`scripts/providers/<name>.mjs`:

```js
export function prepareEnv(providerKey) { /* set auth env, assert guardrails */ }
export function run({ dir, prompt, model, defaultModel }) {
  // make edits in `dir`; return:
  return { resultText, model, requested, numTurns, durationMs, costUsd, isError, raw };
}
```

Then add the language install (if needed) in `action.yml`. The stub files carry a concrete
[aider](https://aider.chat) sketch for the API-key providers. `claude-sub` is the reference
implementation.

## Architecture

```
caller workflow (per repo)            this composite action
  on: issues/pull_request labeled  →  ┌─ language setup (go/node/bun, by `language`)
  if: ai-ready / ai-needs-changes     ├─ engine install  (by `provider`)
  with: provider, provider_key,       └─ scripts/dev-agent.mjs
        github_token, language              ├─ parse trigger label + -<model> suffix
                                            ├─ claim (relabel in-progress) / iteration cap
                                            ├─ clone (bot PAT) + branch
                                            ├─ providers/<provider>.run()  ← edits only
                                            └─ ESCALATE? no-changes? else commit/push/PR
```

## Notes & caveats

- **CI on the agent's PRs** only runs because we push with the bot PAT. Keep it that way.
- The `claude-sub` engine installs the Claude Code CLI at runtime; **pin a version** before
  production use (see `action.yml`).
- Verify the subscription/credit behavior of programmatic runs against current official
  Anthropic docs before relying on it.
