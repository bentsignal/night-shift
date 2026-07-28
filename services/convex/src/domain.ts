export const LEASE_DURATION_MS = 90_000;
export const HOST_SESSION_DURATION_MS = 120_000;

export type RunStatus =
  | "queued"
  | "claimed"
  | "running"
  | "pause_requested"
  | "paused"
  | "cancel_requested"
  | "canceled"
  | "failed"
  | "completed";

export type AttemptStatus =
  | "claimed"
  | "running"
  | "paused"
  | "expired"
  | "canceled"
  | "failed"
  | "completed";

export type ValidationStatus = "pending" | "passed" | "failed";
export type CommandKind = "pause" | "resume" | "cancel";
export type CommandStatus = "pending" | "acknowledged" | "superseded";
export type MilestoneKind =
  | "started"
  | "checkpoint"
  | "paused"
  | "validation"
  | "failed"
  | "canceled"
  | "completed";

export interface RunState {
  status: RunStatus;
  validationStatus: ValidationStatus;
  fencingGeneration: number;
  controlGeneration: number;
  activeAttemptId?: string;
  startedAt?: number;
}

export interface AttemptState {
  id: string;
  hostId: string;
  hostSessionId: string;
  fencingGeneration: number;
  status: AttemptStatus;
  leaseExpiresAt: number;
}

export interface AuthorityProof {
  attemptId: string;
  hostId: string;
  hostSessionId: string;
  fencingGeneration: number;
  controlGeneration: number;
}

export interface StatePatch {
  run: Partial<RunState>;
  attempt?: Partial<AttemptState>;
}

export interface MilestoneInput {
  kind: MilestoneKind;
  validationOutcome?: "passed" | "failed";
}

export interface MilestoneStateInput {
  run: RunState;
  attempt: AttemptState;
  proof: AuthorityProof;
  milestone: MilestoneInput;
  now: number;
}

export class AuthorityError extends Error {
  constructor(
    readonly code:
      | "ATTEMPT_NOT_ACTIVE"
      | "CONTROL_GENERATION_STALE"
      | "FENCE_STALE"
      | "HOST_SESSION_STALE"
      | "INVALID_TRANSITION"
      | "LEASE_EXPIRED"
      | "VALIDATION_REQUIRED",
    message: string,
  ) {
    super(message);
    this.name = "AuthorityError";
  }
}

export class IdempotencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IdempotencyError";
  }
}

/**
 * Shared by API handlers that make client/worker retries safe. Callers choose
 * the small stable fingerprint appropriate to their operation.
 */
export function idempotencyDecision(
  existingFingerprint: string | undefined,
  proposedFingerprint: string,
) {
  if (existingFingerprint === undefined) return "create";
  if (existingFingerprint === proposedFingerprint) return "replay";
  throw new IdempotencyError(
    "Idempotency key was already used for different content",
  );
}

const terminalRunStatuses = new Set<RunStatus>([
  "canceled",
  "failed",
  "completed",
]);

export function isRunTerminal(status: RunStatus) {
  return terminalRunStatuses.has(status);
}

export function claimState(run: RunState, attemptId: string, now: number) {
  requireRunStatus(run, ["queued"], "claim");

  return statePatch({
    run: {
      status: "claimed",
      activeAttemptId: attemptId,
      fencingGeneration: run.fencingGeneration + 1,
      validationStatus: "pending",
    },
    attempt: {
      status: "claimed",
      leaseExpiresAt: now + LEASE_DURATION_MS,
      fencingGeneration: run.fencingGeneration + 1,
    },
  });
}

/**
 * A worker mutation is authoritative only while all five coordinates agree:
 * active attempt, host, host session, fence, and current command generation.
 */
export function assertAuthority(
  run: RunState,
  attempt: AttemptState,
  proof: AuthorityProof,
  now: number,
) {
  if (
    run.activeAttemptId !== proof.attemptId ||
    attempt.id !== proof.attemptId
  ) {
    throw new AuthorityError(
      "ATTEMPT_NOT_ACTIVE",
      "Attempt is no longer active for this run",
    );
  }
  if (attempt.hostId !== proof.hostId) {
    throw new AuthorityError(
      "ATTEMPT_NOT_ACTIVE",
      "Attempt belongs to a different host",
    );
  }
  if (attempt.hostSessionId !== proof.hostSessionId) {
    throw new AuthorityError(
      "HOST_SESSION_STALE",
      "Host session has been replaced",
    );
  }
  if (
    run.fencingGeneration !== proof.fencingGeneration ||
    attempt.fencingGeneration !== proof.fencingGeneration
  ) {
    throw new AuthorityError(
      "FENCE_STALE",
      "Attempt fencing generation is stale",
    );
  }
  if (run.controlGeneration !== proof.controlGeneration) {
    throw new AuthorityError(
      "CONTROL_GENERATION_STALE",
      "Worker must observe the latest run command before publishing",
    );
  }
  if (attempt.leaseExpiresAt <= now) {
    throw new AuthorityError("LEASE_EXPIRED", "Attempt lease has expired");
  }
}

export function renewLeaseState(
  run: RunState,
  attempt: AttemptState,
  proof: AuthorityProof,
  now: number,
) {
  assertAuthority(run, attempt, proof, now);
  if (isRunTerminal(run.status)) {
    throw invalidTransition(run.status, "renew lease");
  }
  return statePatch({
    run: {},
    attempt: { leaseExpiresAt: now + LEASE_DURATION_MS },
  });
}

export function milestoneState({
  run,
  attempt,
  proof,
  milestone,
  now,
}: MilestoneStateInput) {
  assertAuthority(run, attempt, proof, now);

  switch (milestone.kind) {
    case "started":
      requireRunStatus(run, ["claimed"], milestone.kind);
      return statePatch({
        run: { status: "running", startedAt: now },
        attempt: { status: "running" },
      });
    case "checkpoint":
      requireRunStatus(run, ["running"], milestone.kind);
      return statePatch({ run: {}, attempt: {} });
    case "paused":
      requireRunStatus(run, ["pause_requested"], milestone.kind);
      return statePatch({
        run: {
          status: "paused",
          activeAttemptId: undefined,
          validationStatus: "pending",
          startedAt: undefined,
        },
        attempt: { status: "paused" },
      });
    case "validation": {
      requireRunStatus(run, ["running"], milestone.kind);
      if (!milestone.validationOutcome) {
        throw invalidTransition(run.status, "validation without an outcome");
      }
      return statePatch({
        run: { validationStatus: milestone.validationOutcome },
        attempt: {},
      });
    }
    case "completed":
      requireRunStatus(run, ["running"], milestone.kind);
      if (run.validationStatus !== "passed") {
        throw new AuthorityError(
          "VALIDATION_REQUIRED",
          "A passing deterministic validation is required before completion",
        );
      }
      return statePatch({
        run: { status: "completed", activeAttemptId: undefined },
        attempt: { status: "completed" },
      });
    case "failed":
      requireRunStatus(
        run,
        ["claimed", "running", "pause_requested", "paused", "cancel_requested"],
        milestone.kind,
      );
      return statePatch({
        run: { status: "failed", activeAttemptId: undefined },
        attempt: { status: "failed" },
      });
    case "canceled":
      requireRunStatus(run, ["cancel_requested"], milestone.kind);
      return statePatch({
        run: { status: "canceled", activeAttemptId: undefined },
        attempt: { status: "canceled" },
      });
  }
}

export interface CommandPatch {
  accepted: boolean;
  status: CommandStatus;
  controlGeneration: number;
  run: Partial<RunState>;
}

/**
 * Commands are serialized by controlGeneration. Resume may supersede a pause
 * before the worker acknowledges it; the stale pause acknowledgement then
 * fails the generation check in assertAuthority.
 */
export function commandState(run: RunState, kind: CommandKind) {
  if (isRunTerminal(run.status)) {
    return unchangedCommand(run);
  }

  const generation = run.controlGeneration + 1;
  switch (kind) {
    case "pause":
      if (run.status !== "claimed" && run.status !== "running") {
        return unchangedCommand(run);
      }
      return commandPatch({
        accepted: true,
        status: "pending",
        controlGeneration: generation,
        run: {
          controlGeneration: generation,
          status: "pause_requested",
        },
      });
    case "resume":
      if (run.status !== "pause_requested" && run.status !== "paused") {
        return unchangedCommand(run);
      }
      if (run.status === "paused") {
        return commandPatch({
          accepted: true,
          status: "acknowledged",
          controlGeneration: generation,
          run: {
            controlGeneration: generation,
            status: "queued",
            activeAttemptId: undefined,
            validationStatus: "pending",
            startedAt: undefined,
          },
        });
      }
      return commandPatch({
        accepted: true,
        status: "pending",
        controlGeneration: generation,
        run: {
          controlGeneration: generation,
          status: run.startedAt === undefined ? "claimed" : "running",
        },
      });
    case "cancel":
      if (run.status === "queued") {
        return commandPatch({
          accepted: true,
          status: "acknowledged",
          controlGeneration: generation,
          run: {
            controlGeneration: generation,
            status: "canceled",
            activeAttemptId: undefined,
          },
        });
      }
      return commandPatch({
        accepted: true,
        status: "pending",
        controlGeneration: generation,
        run: {
          controlGeneration: generation,
          status: "cancel_requested",
        },
      });
  }
}

/**
 * Expiration is resolved by an authority mutation before another claim.
 * Incrementing the fence happens on the next claim; the expired lease already
 * prevents the old process from publishing in the meantime.
 */
export function recoverExpiredState(
  run: RunState,
  attempt: AttemptState,
  now: number,
) {
  if (
    run.activeAttemptId !== attempt.id ||
    attempt.leaseExpiresAt > now ||
    isRunTerminal(run.status)
  ) {
    return undefined;
  }

  if (run.status === "cancel_requested") {
    return statePatch({
      run: { status: "canceled", activeAttemptId: undefined },
      attempt: { status: "canceled" },
    });
  }

  return statePatch({
    run: {
      status: "queued",
      activeAttemptId: undefined,
      validationStatus: "pending",
      startedAt: undefined,
    },
    attempt: { status: "expired" },
  });
}

function unchangedCommand(run: RunState) {
  return commandPatch({
    accepted: false,
    status: "superseded",
    controlGeneration: run.controlGeneration,
    run: {},
  });
}

function requireRunStatus(
  run: RunState,
  expected: RunStatus[],
  action: string,
) {
  if (!expected.includes(run.status)) {
    throw invalidTransition(run.status, action);
  }
}

function invalidTransition(status: RunStatus, action: string) {
  return new AuthorityError(
    "INVALID_TRANSITION",
    `Cannot ${action} while run is ${status}`,
  );
}

function statePatch(patch: StatePatch) {
  return patch;
}

function commandPatch(patch: CommandPatch) {
  return patch;
}
