import { describe, expect, it, vi } from "vitest";

import type {
  AuthorityReply,
  HostRegistration,
  LeaseReply,
  RuntimeAdapter,
  RuntimeResult,
  ValidationResult,
  Validator,
  WorkerAssignment,
  WorkerAuthority,
} from "./types.ts";
import { WorkerDaemon } from "./daemon.ts";

const registration = {
  hostId: "host-1",
  sessionId: "session-1",
} satisfies HostRegistration;

const assignment = {
  runId: "run-1",
  attemptId: "attempt-1",
  generation: 3,
  hostId: "host-1",
  hostSessionId: "session-1",
  prompt: "Make a focused change",
  projectPath: "/tmp/project",
  leaseExpiresAt: Date.now() + 60_000,
  controlGeneration: 0,
  selection: {
    adapter: "effect-ai",
    provider: "faux",
    model: "test",
    reasoning: "high",
  },
} satisfies WorkerAssignment;

describe("WorkerDaemon", () => {
  it("leaves durable work unclaimed when the authority has no assignment", async () => {
    const authority = new FakeAuthority(null);
    const daemon = createDaemon(authority, immediateRuntime());

    await expect(daemon.runOneCycle()).resolves.toBe(false);
    expect(daemon.state).toBe("idle");
    expect(authority.completed).toBe(false);
  });

  it("validates and completes only while the fenced lease is current", async () => {
    const authority = new FakeAuthority(assignment);
    const daemon = createDaemon(authority, immediateRuntime());

    await expect(daemon.runOneCycle()).resolves.toBe(true);
    expect(authority.validation?.status).toBe("passed");
    expect(authority.completed).toBe(true);
  });

  it("aborts locally and never publishes completion when renewal loses authority", async () => {
    const authority = new FakeAuthority(assignment);
    authority.renew = async () => {
      throw new Error("Convex unavailable");
    };
    const runtime = {
      execute: async (_input, _selection, signal) =>
        new Promise<RuntimeResult>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          });
        }),
    } satisfies RuntimeAdapter;
    const daemon = createDaemon(authority, runtime, 1);

    await expect(daemon.runOneCycle()).resolves.toBe(true);
    expect(daemon.state).toBe("authority_lost");
    expect(authority.completed).toBe(false);
    expect(authority.failed).toBe(false);
  });

  it("acknowledges pause at a boundary using the observed control generation", async () => {
    const authority = new FakeAuthority(assignment);
    authority.renew = async () => ({
      accepted: true,
      leaseExpiresAt: Date.now() + 60_000,
      desiredState: "paused",
      controlGeneration: 4,
    });
    const runtime = {
      execute: async (_input, _selection, signal) =>
        new Promise<RuntimeResult>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          });
        }),
    } satisfies RuntimeAdapter;
    const daemon = createDaemon(authority, runtime, 1);

    await daemon.runOneCycle();
    expect(authority.pausedAtGeneration).toBe(4);
    expect(authority.completed).toBe(false);
  });

  it("serializes lease renewals so control generations cannot race", async () => {
    const authority = new FakeAuthority(assignment);
    let inFlight = 0;
    let maximumInFlight = 0;
    authority.renew = async () => {
      inFlight += 1;
      maximumInFlight = Math.max(maximumInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 10));
      inFlight -= 1;
      return {
        accepted: true,
        leaseExpiresAt: Date.now() + 60_000,
        desiredState: "running",
        controlGeneration: 0,
      };
    };
    const runtime = {
      execute: async () => {
        await new Promise((resolve) => setTimeout(resolve, 35));
        return { summary: "done" };
      },
    } satisfies RuntimeAdapter;

    await createDaemon(authority, runtime, 1).runOneCycle();
    expect(maximumInFlight).toBe(1);
    expect(authority.completed).toBe(true);
  });
});

class FakeAuthority implements WorkerAuthority {
  readonly assignment: WorkerAssignment | null;
  completed = false;
  failed = false;
  pausedAtGeneration: number | undefined;
  validation: ValidationResult | undefined;
  renew: () => Promise<LeaseReply> = async () => ({
    accepted: true,
    leaseExpiresAt: Date.now() + 60_000,
    desiredState: "running",
    controlGeneration: 0,
  });

  constructor(assignmentValue: WorkerAssignment | null) {
    this.assignment = assignmentValue;
  }

  async registerHost(): Promise<HostRegistration> {
    return registration;
  }

  async claimNext(): Promise<WorkerAssignment | null> {
    return this.assignment;
  }

  renewLease(): Promise<LeaseReply> {
    return this.renew();
  }

  async startAttempt(): Promise<AuthorityReply> {
    return { accepted: true };
  }

  async recordMilestone(): Promise<AuthorityReply> {
    return { accepted: true };
  }

  async publishValidation(
    input: Parameters<WorkerAuthority["publishValidation"]>[0],
  ): Promise<AuthorityReply> {
    this.validation = input.validation;
    return { accepted: true };
  }

  async pauseAttempt(
    input: Parameters<WorkerAuthority["pauseAttempt"]>[0],
  ): Promise<AuthorityReply> {
    this.pausedAtGeneration = input.controlGeneration;
    return { accepted: true };
  }

  async cancelAttempt(): Promise<AuthorityReply> {
    return { accepted: true };
  }

  async failAttempt(): Promise<AuthorityReply> {
    this.failed = true;
    return { accepted: true };
  }

  async completeAttempt(): Promise<AuthorityReply> {
    this.completed = true;
    return { accepted: true };
  }
}

function createDaemon(
  authority: WorkerAuthority,
  runtime: RuntimeAdapter,
  renewEveryMs = 30_000,
) {
  const validator = {
    validate: vi.fn(async () => ({
      name: "test",
      status: "passed" as const,
      exitCode: 0,
      durationMs: 1,
      summary: "passed",
    })),
  } satisfies Validator;
  return new WorkerDaemon({
    authority,
    runtime,
    validator,
    hostKey: "test-host",
    displayName: "Test host",
    capabilities: {
      platform: "test",
      arch: "test",
      maxConcurrent: 1,
      providers: ["faux"],
      runtimeAdapters: ["effect-ai"],
      adapterVersion: "test",
    },
    sessionId: registration.sessionId,
    renewEveryMs,
  });
}

function immediateRuntime() {
  return {
    execute: vi.fn(async () => ({ summary: "done" })),
  } satisfies RuntimeAdapter;
}
