# ai-code-agent

A **provider-agnostic dev-agent GitHub Action**. Apply a label to an issue or PR and the
action does one unit of work and exits — no always-on server.

- An issue labeled **`ai-ready[-<model>]`** → implement on a `dev/*` branch → open a PR.
- A PR labeled **`ai-needs-changes[-<model>]`** → revise the PR branch from review feedback.
- An Epic issue labeled **`ai-plan[-<model>]`** → inspect the codebase and break it into an
  ordered set of serial sub-issues (no code) → review each in turn.
- An issue labeled **`ai-discussion[-<model>]`** → discuss scope/approach in the comments before
  any work; the agent flips the label to **`need-user-action`** (it has questions) or
  **`user-action-ai-ready`** (clear — go).

If the **target** repo has a `CLAUDE.md` / `AGENTS.md`, that governs what the agent does in
the working tree. Pick the engine with `provider`.

> **Subscription or API key.** `provider: claude-sub` uses a Claude Pro/Max subscription
> (OAuth token, no API key) and refuses to run if `ANTHROPIC_API_KEY` is set — so a project
> that wants to stay subscription-only gets that guarantee enforced. `provider: claude-api`
> runs the same Claude Code engine but authenticates with an `ANTHROPIC_API_KEY` (metered
> per-token billing). The remaining providers are still stubs.

## Quick start

1. Create a dedicated **bot GitHub account**, give it repo write, and mint a PAT → store as
   the `DEV_BOT_PAT` secret. **Do not** use the default `GITHUB_TOKEN` — PRs it opens won't
   trigger your CI workflows.
2. Generate a subscription token: `claude setup-token` → store as `CLAUDE_CODE_OAUTH_TOKEN`.
3. Copy [`examples/caller-claude-sub.yml`](./examples/caller-claude-sub.yml) into each repo
   as `.github/workflows/dev-agent.yml`.
4. Label an issue `ai-ready` (or `ai-ready-sonnet`, etc.). Watch the Actions tab.

## Getting the Claude subscription token (`claude-sub`)

The `claude-sub` provider authenticates with a **Claude Pro or Max subscription** via a long-lived
OAuth token — no API key, no per-token billing. To mint one:

1. **Have a Claude Pro/Max subscription** on the Anthropic account you want the agent to bill
   against. (API-key-only accounts can't produce this token — use `provider: claude-api` instead.)
2. **Install the Claude Code CLI** (needs Node.js):
   ```bash
   npm install -g @anthropic-ai/claude-code
   ```
3. **Generate the token:**
   ```bash
   claude setup-token
   ```
   This opens your browser to authorize with your Anthropic account, then prints an OAuth token.
   The token is long-lived but can expire or be revoked — just re-run the command to mint a new one
   if the Action starts failing on auth.
4. **Store it as a secret** named `CLAUDE_CODE_OAUTH_TOKEN` in each repo (or once at the org level),
   and pass it as the Action's `provider_key`. The [caller example](./examples/caller-claude-sub.yml)
   already wires this up:
   ```yaml
   with:
     provider: claude-sub
     provider_key: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
   ```

> **Treat this token like a password** — it grants use of your subscription. Keep it in GitHub
> Secrets, never in code. The `claude-sub` adapter refuses to run if `ANTHROPIC_API_KEY` is also
> present, so a stray API key can't silently bypass subscription billing.

## Using an Anthropic API key (`claude-api`)

The `claude-api` provider runs the **same Claude Code engine** as `claude-sub` but authenticates
with an **Anthropic API key** instead of a subscription OAuth token. Use it for projects that bill
Claude usage through the Anthropic API (**metered — you pay per token**) rather than a Pro/Max
subscription.

1. **Get an API key** from the [Anthropic Console](https://console.anthropic.com/) and **store it
   as a secret** named `ANTHROPIC_API_KEY` in each repo (or once at the org level).
2. **Wire it into the caller** — set `provider: claude-api` and pass the key as `provider_key`. The
   [caller example](./examples/caller-claude-api.yml) already does this:
   ```yaml
   with:
     provider: claude-api
     provider_key: ${{ secrets.ANTHROPIC_API_KEY }}
   ```

> **The inverse of the `claude-sub` guard.** `claude-api` refuses to run if a subscription OAuth
> token (`CLAUDE_CODE_OAUTH_TOKEN`) is present, so the two auth modes can't silently mix — each
> provider owns exactly one credential. Pick `claude-sub` for subscription billing, `claude-api`
> for API-key billing.

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `provider` | yes | `claude-sub` | Engine (single): `claude-sub` \| `claude-api` \| `gemini` \| `openai` \| `oss`. |
| `provider_key` | yes | — | `claude-sub` OAuth token, or the provider's API key. |
| `github_token` | yes | — | Dedicated **bot PAT** (repo write). Not the default `GITHUB_TOKEN`. |
| `language` | no | `""` | Comma-separated toolchains to pre-install: `go,node,bun` (extensible). |
| `model` | no | `""` | Default model when a label has no `-<model>` suffix. |
| `models` | no | `opus,sonnet,haiku` | Allowed `-<model>` label suffixes. |
| `extra_instructions` | no | `""` | Inline operator instructions prepended to every run (both flows). See [Adding context & instructions](#adding-context--instructions). |
| `instructions_file` | no | `""` | Path (in the target repo) to a Markdown file prepended to every run. Combined with `extra_instructions`. |
| `ready_label` | no | `ai-ready` | Implement-loop trigger. |
| `review_label` | no | `ai-needs-changes` | Revise-loop trigger. |
| `plan_label` | no | `ai-plan` | Planning-loop trigger (Epic → ordered sub-issues). |
| `max_plan_issues` | no | `20` | Max sub-issues one plan may create; a larger plan escalates. |
| `discussion_label` | no | `ai-discussion` | Discussion-loop trigger (clarify before acting). |
| `max_discussion_rounds` | no | `6` | Escalate the discussion once it runs this many rounds without converging. |
| `base_branch` | no | `main` | PR base. |
| `max_review_iterations` | no | `3` | Escalate instead of looping past this. |
| `git_author_name` / `git_author_email` | no | bot identity | Commit identity. |

### Outputs

| Output | Description |
|--------|-------------|
| `status` | `pr-opened` \| `pr-updated` \| `plan-created` \| `discussion-ready` \| `needs-user` \| `escalated` \| `no-changes` \| `skipped`. |
| `pr_url` | URL of the PR opened/updated, if any. |

## Adding context & instructions

You can steer the agent at three scopes. They form a precedence order — **higher wins on conflict:**

1. **Target repo `CLAUDE.md` / `AGENTS.md`** (highest authority). Commit it to the **repo the agent
   works on** (not this one). It's read and followed as the operating manual on every run — the
   place for guardrails and per-project conventions. No Action config needed.
2. **`extra_instructions` / `instructions_file` inputs** (operator config). Applies to **every**
   issue/PR handled by the workflow — good for org-wide conventions. Trusted, but cannot override a
   target-repo guardrail; a conflict makes the agent escalate instead. Use `extra_instructions` for
   short inline text, `instructions_file` to point at a Markdown file kept in the target repo (read
   from the clone, so it's version-controlled). Set either or both — if both are set, the file is
   included first, then the inline text:
   ```yaml
   with:
     provider: claude-sub
     provider_key: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
     github_token: ${{ secrets.DEV_BOT_PAT }}
     instructions_file: .github/ai-instructions.md
     extra_instructions: |
       Always add a CHANGELOG.md entry under "Unreleased".
       Prefer table-driven tests. Keep PRs under ~300 lines.
   ```
   A missing `instructions_file` is ignored with a warning (it doesn't fail the run).
3. **Issue / PR text** (per-task, lowest). The issue body and review comments are passed in as the
   **task specification**, treated as DATA — never as instructions that can override the rules
   above. This is where acceptance criteria, file pointers, and task-specific constraints go.

## Discussing before acting

Not sure an issue is well-specified yet? Label it **`ai-discussion`** (or `ai-discussion-opus`,
etc.) and the agent **talks instead of building**: it reads the comment thread and the existing
codebase, then replies in a comment — either asking specific questions or confirming the approach.
It never writes code, creates issues, or opens PRs in this mode.

It's a turn-based loop driven by two labels:

- **`need-user-action`** — the agent asked you something. Answer in a comment, then re-apply
  `ai-discussion` to hand the turn back for another round.
- **`user-action-ai-ready`** — the agent is satisfied that the issue is clear. It recommends the
  next step; you start it by applying `ai-ready` (implement) or `ai-plan` (break into sub-issues).

So the label ping-pongs `ai-discussion` ⇄ `need-user-action` until it lands on
`user-action-ai-ready`. The agent only ever recommends — **you** stay the gate that starts real
work (and the implement/plan flows clear the discussion labels when you do). Mechanically it's the
same edits-only pattern: the agent writes a `DISCUSSION.json` artifact; the orchestrator posts the
comment and moves the label. After `max_discussion_rounds` without converging, it escalates.

## Planning an Epic into sub-issues

Label a detailed Epic issue **`ai-plan`** (or `ai-plan-opus`, etc.) and the agent **plans instead
of coding**: it clones the repo read-only, **inspects the existing codebase**, and decomposes the
Epic into an ordered, phased set of sub-issues — each small and independently reviewable.

What you get back:

- One GitHub **sub-issue per phase**, created in order. Each says `Part of #<epic>` and, where
  relevant, `Depends on: #<n>`, with concrete files to touch and acceptance criteria.
- The Epic body gets a **`## Plan` checklist** (`- [ ] #123 …`) linking the sub-issues, so GitHub
  shows progress as they close.
- The Epic is relabeled `planned`.

It's deliberately **serial and human-gated**: the agent does **not** start coding any of them. You
drive the chain — apply `ai-ready` to the **first** sub-issue, review and merge its PR, then label
the next. This keeps a review checkpoint between every phase.

Mechanics mirror the other flows: the agent only writes a `PLAN.json` artifact (it never creates
issues or touches git); the orchestrator parses it and creates the sub-issues. A vague Epic makes
the agent escalate (via `ESCALATE.md`) rather than guess, and a plan larger than `max_plan_issues`
escalates instead of flooding your tracker.

## Provider status

| Provider | Auth | Status |
|----------|------|--------|
| `claude-sub` | Subscription OAuth (`claude setup-token`) | ✅ implemented (Claude Code CLI) |
| `claude-api` | `ANTHROPIC_API_KEY` | ✅ implemented (Claude Code CLI) |
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
