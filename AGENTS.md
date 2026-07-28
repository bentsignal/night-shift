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

- Build a simple working vertical slice before generalizing.
- Prefer explicit state machines and deterministic workflow steps over prompt reminders.
- Keep Convex cloud-authoritative for orchestration while execution remains on enrolled hosts.
- Keep Convex writes sparse and meaningful; do not persist token deltas or generic high-volume event dumps.
- Treat leases, fencing, idempotency, isolated attempts, pause/resume, and crash recovery as correctness requirements.
- Always accept user work into a durable queue even when execution capacity is unavailable.
- Schedule work fairly across hosts, projects, and parents; safe system responsiveness matters more than maximum concurrency.
- Only parent orchestrators may create child agents initially. Children must not recursively spawn agents.
- Child coding attempts use isolated Git worktrees created and managed by deterministic workflow code.
- Keep provider/model/authentication choices independent from orchestration. Credentials stay on execution hosts, not in Convex.
- Use Effect AI behind the product-owned host runtime. Keep the bounded agent loop,
  tools, provider selection, and host-local subscription authentication under
  product control rather than adopting Pi's harness or session model.

## Source repositories

- Rodge Mail scaffold source: `/Users/shawn/dev/projects/rodge-mail`
- UAV source: `/Users/shawn/dev/projects/uav`

Do not modify either source repository while extracting or studying reusable pieces. Rodge Mail currently has uncommitted work that must be preserved. Derive from a deliberate snapshot or copy tracked pieces into this repository.

## Delegation during initial implementation

The implementation orchestrator may use subagents to parallelize independent research and build work. Give each code-writing subagent an isolated worktree and retain responsibility for integrating and validating its result. Avoid multiple agents editing the same files or worktree.

## Validation

Once the scaffold defines repository validation scripts, run the full lint, typecheck, test, and formatting workflow before completion. Use computer-use verification for user-facing web flows where practical, in addition to deterministic tests.
