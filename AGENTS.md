# Project operating instructions

## Memory and coordination

UAV is the source of truth for project intent, decisions, architecture context, and tasks.

At the start of every run:

1. Run `uav status`.
2. Run `uav ask` with a question relevant to the current assignment.
3. Inspect `uav task list` and claim any task you take responsibility for.
4. Follow `uav workflow`, including `uav closeout` before finishing.

Verbatim planning transcripts are stored under `docs/raw/`. They are source material, not a parallel synthesized-note system. Store new decisions, findings, and implementation outcomes in UAV rather than creating planning Markdown files.

## Implementation posture

- Night Shift is headless. Do not add a web, desktop, or mobile product surface
  unless a task explicitly reactivates one. The CLI is the primary human and
  agent integration surface. Its public interaction model is conversational:
  accept natural-language requests and return natural-language answers. Keep
  authentication, enrollment, and daemon lifecycle operations minimal, and
  keep typed machine contracts behind the conversational boundary.
- Build a simple working vertical slice before generalizing.
- Prefer explicit state machines and deterministic workflow steps over prompt reminders.
- Keep durable orchestration cloud-authoritative while execution remains on
  explicitly enrolled hosts that connect outbound. The substrate is an adapter
  boundary until the authority spike is complete; do not assume Convex.
- Use Effect TS for product-owned services, schemas, failures, retries, and
  observability. Use Confect where a retained Convex boundary benefits from it;
  do not let Confect force Convex to be the workflow engine.
- Keep authoritative writes sparse and meaningful; do not persist token deltas
  or generic high-volume event dumps.
- Treat leases, fencing, idempotency, isolated attempts, pause/resume, and crash recovery as correctness requirements.
- Always accept user work into a durable queue even when execution capacity is unavailable.
- Schedule work fairly across hosts, projects, and parents; safe system responsiveness matters more than maximum concurrency.
- Model human input as durable attention requests that pause and resume workflow
  steps rather than as transient chat state.
- Split resource control into two cooperating layers. A deterministic safety
  kernel enforces hard capacity ceilings, admission, isolation, fencing, and
  rollback. An AI resource governor actively interprets telemetry, prioritizes
  work, tunes policy within those bounds, and can propose or implement tested,
  reversible platform-specific monitors and host adaptations.
- Only parent orchestrators may create child agents initially. Children must not recursively spawn agents.
- Child coding attempts use isolated Git worktrees created and managed by deterministic workflow code.
- Make recursive self-improvement an early dogfood requirement. Host adaptation
  must use explicit enrollment, declared capabilities, least privilege, signed
  or otherwise authenticated changes, validation, and rollback—never stealthy
  propagation.
- Keep provider/model/authentication choices independent from orchestration.
  Provider credentials stay on execution hosts, not in the cloud authority.
- Keep agent runtimes behind an adapter boundary. Support external harnesses
  such as Codex CLI, Claude Code, and Pi while retaining a product-owned Effect
  AI runtime with an explicit bounded loop, typed tools, provider selection, and
  host-local subscription authentication.

## Source repositories

- Legacy scaffold source: `/Users/shawn/dev/projects/rodge-mail`
- UAV source: `/Users/shawn/dev/projects/uav`

Do not modify either source repository while extracting or studying reusable pieces. The legacy scaffold currently has uncommitted work that must be preserved. Derive from a deliberate snapshot or copy tracked pieces into this repository.

## Delegation during initial implementation

The implementation orchestrator may use subagents to parallelize independent research and build work. Give each code-writing subagent an isolated worktree and retain responsibility for integrating and validating its result. Avoid multiple agents editing the same files or worktree.

## Validation

Once the scaffold defines repository validation scripts, run the full lint, typecheck, test, and formatting workflow before completion. Use computer-use verification for user-facing web flows where practical, in addition to deterministic tests.
