# Skill Registry

**Delegator use only.** Any agent that launches sub-agents reads this registry to resolve compact rules, then injects them directly into sub-agent prompts. Sub-agents do NOT read this registry or individual SKILL.md files.

See `_shared/skill-resolver.md` for the full resolution protocol.

## User Skills

| Trigger | Skill | Path |
|---------|-------|------|
| When creating a pull request, opening a PR, or preparing changes for review. | branch-pr | /home/o_may/.config/opencode/skills/branch-pr/SKILL.md |
| When writing Go tests, using teatest, or adding test coverage. | go-testing | /home/o_may/.config/opencode/skills/go-testing/SKILL.md |
| When creating a GitHub issue, reporting a bug, or requesting a feature. | issue-creation | /home/o_may/.config/opencode/skills/issue-creation/SKILL.md |
| When user says "judgment day", "judgment-day", "review adversarial", "dual review", "doble review", "juzgar", "que lo juzguen". | judgment-day | /home/o_may/.config/opencode/skills/judgment-day/SKILL.md |
| When user asks to create a new skill, add agent instructions, or document patterns for AI. | skill-creator | /home/o_may/.config/opencode/skills/skill-creator/SKILL.md |
| Testing local web applications with Playwright. | webapp-testing | /home/o_may/.config/opencode/skills/webapp-testing/SKILL.md |

## Compact Rules

Pre-digested rules per skill. Delegators copy matching blocks into sub-agent prompts as `## Project Standards (auto-resolved)`.

### branch-pr
- Every PR MUST link an approved issue — no exceptions
- Every PR MUST have exactly one `type:*` label
- Automated checks must pass before merge is possible
- Branch names MUST match: `^(feat|fix|chore|docs|style|refactor|perf|test|build|ci|revert)\/[a-z0-9._-]+$`

### go-testing
- Table-driven tests with struct input/expected/wantErr
- Bubbletea TUI testing with teatest library
- Golden file testing for complex outputs
- Use testify for assertions

### issue-creation
- Blank issues are disabled — MUST use template
- Every issue gets `status:needs-review` automatically
- A maintainer MUST add `status:approved` before PR
- Questions go to Discussions, not issues

### judgment-day
- Launch TWO blind judge sub-agents simultaneously
- Neither agent knows about the other
- Synthesize verdicts, apply fixes, re-judge until pass
- Max 2 iterations before escalation

### skill-creator
- Create skill when pattern used repeatedly
- SKILL.md required, assets/ and references/ optional
- Include name, description, trigger in frontmatter
- Document allowed-tools in frontmatter

### webapp-testing
- Use Playwright for dynamic webapps
- Run helper scripts with `--help` first
- Navigate, screenshot, identify selectors, then action
- Use `scripts/with_server.py` for server lifecycle

## Project Conventions

| File | Path | Notes |
|------|------|-------|
| Agent reference | /home/o_may/prox/OCmobile/AGENTS.md | Full project conventions — read first |
| Theme system | REQUIRED for UI work | Load theme-system skill before visual changes |
| Clack CLI | REQUIRED for CLI work | Load clack-cli-patterns for terminal CLI |

Read the convention file listed above for project-specific patterns and rules. All referenced paths have been extracted — no need to read index files to discover more.