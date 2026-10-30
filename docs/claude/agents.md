# Agent team, skills and review

This project uses custom AI agents that work together as a team. The lead agent (Claude Code) orchestrates the pipeline — it does NOT implement code itself but distributes tasks to sub-agents.

### Agent Architecture

Agents are markdown files in `.claude/agents/` that define specialized roles. They are spawned as sub-agents via the `Agent` tool. Sub-agents use skills by reading the skill's SKILL.md file and following its instructions — they do NOT have access to a `Skill()` tool.

### How Agents Use Skills

Skills are `.md` files in `.claude/skills/`. Agents use them by:
1. Reading the skill file (e.g., `skills/design-grill/SKILL.md`)
2. Following its instructions completely — executing the full process described in that file

Agents must NOT just summarize or paraphrase a skill. They must read and execute.

### Human-in-the-Loop Rule (CRITICAL)

**NEVER:**
- Answer your own design questions or auto-approve decisions
- Assume you know what the human would choose
- Skip asking the human because the answer seems obvious

**ALWAYS:**
- Present decisions and options directly to the human
- Wait for the human's explicit response before proceeding
- Confirm alignment before moving to the next phase

### Available Agents

| Agent | Role | When to Use |
|-------|------|-------------|
| `design-flow` | Full design phase: explore, stress-test, glossary alignment, spec generation | Before implementation — when a feature needs design |
| `workflow-orchestrator` | Pipeline orchestration, team coordination, glossary enforcement | Full Pipeline Mode — orchestrates all other agents, enforces glossary term consistency |
| `backend-dev` | Back-end implementation + unit tests | Any back-end work (reads tech stack from CLAUDE.md) |
| `frontend-dev` | Frontend implementation + unit/e2e tests | Any frontend work (reads tech stack from CLAUDE.md) |
| `full-e2e-test` | E2E test audit + Playwright execution | When OpenSpec + frontend are enabled |
| `code-review-final` | Code quality review of PRs | After all implementation is complete |
| `security-review-final` | Security review of PRs (conditional) | Only when diff touches security-sensitive files |

### Security Review Trigger

Run `security-review-final` only when the diff includes files matching ANY of:
- Any new route/controller (new attack surface)
- `docker-compose.yml`, `Dockerfile` (container security)
- `apps/korfbal-stream-api/src/config.ts` (env/config changes)
- Any file with `password`, `secret`, `token`, `credential` in its path
- `package.json` (dependency changes — supply chain risk)

Skip security review when the diff only touches: service logic, schemas, frontend components, tests, migrations, README/docs.

### How to Use the Agents

#### Assisted Mode (small changes, bug fixes)

For changes under ~5 files or single-module work, use agents directly without orchestration:

1. Spawn the appropriate implementation agent (e.g., `backend-dev`)
2. Agent implements + tests + commits
3. Run build verification
4. Read `skills/review-local/SKILL.md` and follow its instructions on the changed code
5. Spawn `code-review-final` agent
6. Fix review comments, push, merge

#### Full Pipeline Mode (features, multi-module changes)

For larger features, spawn the `workflow-orchestrator` agent. It will:

- Distribute tasks to implementation agents in parallel
- Run build verification, pre-commit quality checks, and local review
- Create the PR and spawn `code-review-final` (and `security-review-final` if the diff touches security-sensitive files)
- Spawn Playwright e2e test agents if the project has a frontend
- For optional or ambiguous steps, ask the human before executing

See the `workflow-orchestrator` agent definition for the full pipeline details.

### Available Skills

Skills are invoked by reading their SKILL.md file and following the instructions. Available in `.claude/skills/`:

- `design-grill` — Stress-test design decisions
- `parallel-plan` — Fan-out parallel approach comparison
- `glossary` — Ubiquitous language glossary management
- `review-local` — 4-agent parallel local code review
- `gitlab-code-review` — PR review via VCS CLI
- `playwright-cli` — Browser automation for e2e testing
- `write-simply` — Plain language writing
- `structure-clearly` — Pyramid principle document structure
- `retro` — Retrospective on the change

### Key Rules

- **Sweep enforcement**: Every review finding includes a grep command. Fix agents MUST run the sweep and fix ALL matches — not just the reported file
- **Cross-stack contract alignment**: When backend and frontend run in parallel, the frontend API service task MUST read the actual backend DTOs before writing interfaces
- **PR Key Decisions**: Include a "Key Decisions" section in PR descriptions listing intentional design choices. Prevents review agents from flagging them as bugs

## Code Review Workflow

- When reviewing PRs, structure findings by category: security, efficiency, code quality, reuse
- Post findings directly to PR via `gh` CLI
- Two review passes max — after pass 2, the PR is considered ready for merge
