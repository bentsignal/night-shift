import { describe, expect, it } from "vitest";

import type { AttemptState, AuthorityProof, RunState } from "./domain";
import {
  assertAuthority,
  AuthorityError,
  claimState,
  commandState,
  idempotencyDecision,
  IdempotencyError,
  LEASE_DURATION_MS,
  milestoneState,
  recoverExpiredState,
} from "./domain";

const now = 1_000_000;

function queuedRun() {
  return {
    status: "queued",
    validationStatus: "pending",
    fencingGeneration: 0,
    controlGeneration: 0,
  } satisfies RunState;
}

function activeRun(overrides: Partial<RunState> = {}) {
  return {
    status: "running",
    validationStatus: "pending",
    fencingGeneration: 3,
    controlGeneration: 0,
    activeAttemptId: "attempt-3",
    startedAt: now - 1_000,
    ...overrides,
  } satisfies RunState;
}

function activeAttempt(overrides: Partial<AttemptState> = {}) {
  return {
    id: "attempt-3",
    hostId: "host-1",
    hostSessionId: "session-current",
    fencingGeneration: 3,
    status: "running",
    leaseExpiresAt: now + LEASE_DURATION_MS,
    ...overrides,
  } satisfies AttemptState;
}

function proof(overrides: Partial<AuthorityProof> = {}) {
  return {
    attemptId: "attempt-3",
    hostId: "host-1",
    hostSessionId: "session-current",
    fencingGeneration: 3,
    controlGeneration: 0,
    ...overrides,
  } satisfies AuthorityProof;
}

describe("queue claiming", () => {
  it("atomically advances the monotonic fence and grants a 90 second lease", () => {
    const patch = claimState(queuedRun(), "attempt-1", now);

    expect(patch.run).toMatchObject({
      status: "claimed",
      activeAttemptId: "attempt-1",
      fencingGeneration: 1,
    });
    expect(patch.attempt).toMatchObject({
      status: "claimed",
      fencingGeneration: 1,
      leaseExpiresAt: now + 90_000,
    });
  });

  it("rejects claiming a run that is already owned", () => {
    expect(() => claimState(activeRun(), "attempt-4", now)).toThrowError(
      expect.objectContaining({ code: "INVALID_TRANSITION" }),
    );
  });
});

describe("lease and fencing authority", () => {
  it.each([
    [
      "old fencing generation",
      activeAttempt(),
      proof({ fencingGeneration: 2 }),
      "FENCE_STALE",
    ],
    [
      "replaced host session",
      activeAttempt(),
      proof({ hostSessionId: "old-session" }),
      "HOST_SESSION_STALE",
    ],
    [
      "expired lease",
      activeAttempt({ leaseExpiresAt: now }),
      proof(),
      "LEASE_EXPIRED",
    ],
    [
      "inactive attempt",
      activeAttempt({ id: "attempt-old" }),
      proof(),
      "ATTEMPT_NOT_ACTIVE",
    ],
  ])("rejects %s", (_label, attempt, authority, expectedCode) => {
    expect(() =>
      assertAuthority(activeRun(), attempt, authority, now),
    ).toThrowError(expect.objectContaining({ code: expectedCode }));
  });

  it("prevents an expired attempt from completing after recovery", () => {
    const run = activeRun();
    const attempt = activeAttempt({ leaseExpiresAt: now - 1 });
    const recovery = recoverExpiredState(run, attempt, now);
    expect(recovery).toMatchObject({
      run: { status: "queued", activeAttemptId: undefined },
      attempt: { status: "expired" },
    });

    const recoveredRun = { ...run, ...recovery?.run };
    const recoveredAttempt = { ...attempt, ...recovery?.attempt };
    expect(() =>
      milestoneState({
        run: recoveredRun,
        attempt: recoveredAttempt,
        proof: proof(),
        milestone: { kind: "completed" },
        now: now + 1,
      }),
    ).toThrowError(expect.objectContaining({ code: "ATTEMPT_NOT_ACTIVE" }));
  });
});

describe("state transitions and validation gate", () => {
  it("requires start, deterministic validation, then completion", () => {
    const claimedRun = activeRun({
      status: "claimed",
      startedAt: undefined,
    });
    const claimedAttempt = activeAttempt({ status: "claimed" });
    const started = milestoneState({
      run: claimedRun,
      attempt: claimedAttempt,
      proof: proof(),
      milestone: { kind: "started" },
      now,
    });
    const runningRun = { ...claimedRun, ...started.run };
    const runningAttempt = { ...claimedAttempt, ...started.attempt };
    expect(runningRun.status).toBe("running");

    const validated = milestoneState({
      run: runningRun,
      attempt: runningAttempt,
      proof: proof(),
      milestone: { kind: "validation", validationOutcome: "passed" },
      now: now + 1,
    });
    const validatedRun = { ...runningRun, ...validated.run };
    const completed = milestoneState({
      run: validatedRun,
      attempt: runningAttempt,
      proof: proof(),
      milestone: { kind: "completed" },
      now: now + 2,
    });
    expect(completed).toMatchObject({
      run: { status: "completed", activeAttemptId: undefined },
      attempt: { status: "completed" },
    });
  });

  it("rejects completion until validation passes", () => {
    expect(() =>
      milestoneState({
        run: activeRun(),
        attempt: activeAttempt(),
        proof: proof(),
        milestone: { kind: "completed" },
        now,
      }),
    ).toThrowError(expect.objectContaining({ code: "VALIDATION_REQUIRED" }));
  });

  it("does not allow arbitrary transitions", () => {
    expect(() =>
      milestoneState({
        run: activeRun({ status: "paused" }),
        attempt: activeAttempt({ status: "paused" }),
        proof: proof(),
        milestone: { kind: "checkpoint" },
        now,
      }),
    ).toThrowError(expect.objectContaining({ code: "INVALID_TRANSITION" }));
  });
});

describe("pause/resume command races", () => {
  it("releases a paused attempt and requeues resume behind a new fence", () => {
    const pauseRequested = activeRun({
      status: "pause_requested",
      controlGeneration: 1,
    });
    const paused = milestoneState({
      run: pauseRequested,
      attempt: activeAttempt(),
      proof: proof({ controlGeneration: 1 }),
      milestone: { kind: "paused" },
      now,
    });
    expect(paused).toMatchObject({
      run: {
        status: "paused",
        activeAttemptId: undefined,
        validationStatus: "pending",
        startedAt: undefined,
      },
      attempt: { status: "paused" },
    });

    const resume = commandState({ ...pauseRequested, ...paused.run }, "resume");
    expect(resume).toMatchObject({
      accepted: true,
      status: "acknowledged",
      controlGeneration: 2,
      run: {
        status: "queued",
        activeAttemptId: undefined,
        validationStatus: "pending",
        startedAt: undefined,
      },
    });
  });

  it("uses control generations to reject a late pause acknowledgement", () => {
    const original = activeRun();
    const pause = commandState(original, "pause");
    const pauseRequested = { ...original, ...pause.run };
    expect(pauseRequested).toMatchObject({
      status: "pause_requested",
      controlGeneration: 1,
    });

    const resume = commandState(pauseRequested, "resume");
    const resumed = { ...pauseRequested, ...resume.run };
    expect(resumed).toMatchObject({
      status: "running",
      controlGeneration: 2,
    });

    expect(() =>
      milestoneState({
        run: resumed,
        attempt: activeAttempt(),
        proof: proof({ controlGeneration: 1 }),
        milestone: { kind: "paused" },
        now,
      }),
    ).toThrowError(
      expect.objectContaining({ code: "CONTROL_GENERATION_STALE" }),
    );
  });

  it("cancels queued work immediately without execution capacity", () => {
    const canceled = commandState(queuedRun(), "cancel");
    expect(canceled).toMatchObject({
      accepted: true,
      status: "acknowledged",
      run: { status: "canceled", controlGeneration: 1 },
    });
  });
});

describe("idempotency", () => {
  it("distinguishes a create from an exact replay", () => {
    expect(idempotencyDecision(undefined, "same-payload")).toBe("create");
    expect(idempotencyDecision("same-payload", "same-payload")).toBe("replay");
  });

  it("rejects key reuse for different content", () => {
    expect(() =>
      idempotencyDecision("first-payload", "different-payload"),
    ).toThrowError(IdempotencyError);
  });
});

it("AuthorityError exposes stable machine codes", () => {
  const error = new AuthorityError("FENCE_STALE", "stale");
  expect(error).toMatchObject({ code: "FENCE_STALE", message: "stale" });
});
