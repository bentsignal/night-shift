import { randomUUID } from "node:crypto";

import type {
  AttemptIdentity,
  HostCapabilities,
  HostRegistration,
  RunDesiredState,
  RuntimeAdapter,
  Validator,
  WorkerAssignment,
  WorkerAuthority,
} from "./types";
import { AuthorityLeaseGuard } from "./authority-guard";

export type DaemonState =
  | "offline"
  | "registering"
  | "idle"
  | "claiming"
  | "executing"
  | "pausing"
  | "canceling"
  | "authority_lost"
  | "stopped";

export interface WorkerDaemonOptions {
  authority: WorkerAuthority;
  runtime: RuntimeAdapter;
  validator: Validator;
  hostKey: string;
  displayName: string;
  capabilities: HostCapabilities;
  sessionId?: string;
  now?: () => number;
  renewEveryMs?: number;
  sleep?: (durationMs: number) => Promise<void>;
}

export class WorkerDaemon {
  readonly #authority: WorkerAuthority;
  readonly #runtime: RuntimeAdapter;
  readonly #validator: Validator;
  readonly #hostKey: string;
  readonly #displayName: string;
  readonly #capabilities: HostCapabilities;
  readonly #sessionId: string;
  readonly #now: () => number;
  readonly #renewEveryMs: number;
  readonly #sleep: (durationMs: number) => Promise<void>;
  #registration: HostRegistration | undefined;
  #state: DaemonState = "offline";
  #stopped = false;

  constructor(options: WorkerDaemonOptions) {
    this.#authority = options.authority;
    this.#runtime = options.runtime;
    this.#validator = options.validator;
    this.#hostKey = options.hostKey;
    this.#displayName = options.displayName;
    this.#capabilities = options.capabilities;
    this.#sessionId = options.sessionId ?? randomUUID();
    this.#now = options.now ?? Date.now;
    this.#renewEveryMs = options.renewEveryMs ?? 30_000;
    this.#sleep =
      options.sleep ??
      ((durationMs) =>
        new Promise((resolve) => {
          setTimeout(resolve, durationMs);
        }));
  }

  get state(): DaemonState {
    return this.#state;
  }

  stop(): void {
    this.#stopped = true;
    this.#state = "stopped";
  }

  async run(): Promise<void> {
    while (!this.#stopped) {
      try {
        const didWork = await this.runOneCycle();
        if (!didWork) await this.#sleep(1_000);
      } catch {
        this.#registration = undefined;
        this.#state = "authority_lost";
        await this.#sleep(1_000);
      }
    }
  }

  async runOneCycle(): Promise<boolean> {
    const registration = await this.#ensureRegistered();
    this.#state = "claiming";
    const assignment = await this.#authority.claimNext(registration);
    if (!assignment) {
      this.#state = "idle";
      return false;
    }
    await this.#execute(assignment);
    if (!this.#authorityIsLost()) this.#state = "idle";
    return true;
  }

  #authorityIsLost(): boolean {
    return this.#state === "authority_lost";
  }

  async #ensureRegistered(): Promise<HostRegistration> {
    if (this.#registration) return this.#registration;
    this.#state = "registering";
    this.#registration = await this.#authority.registerHost({
      hostKey: this.#hostKey,
      sessionId: this.#sessionId,
      displayName: this.#displayName,
      capabilities: this.#capabilities,
    });
    return this.#registration;
  }

  async #execute(assignment: WorkerAssignment): Promise<void> {
    this.#state = "executing";
    const identity = identityOf(assignment);
    const guard = new AuthorityLeaseGuard({
      leaseExpiresAt: assignment.leaseExpiresAt,
      now: this.#now,
    });
    const controller = new AbortController();
    let desiredState: RunDesiredState = "running";
    let controlGeneration = assignment.controlGeneration;
    let authorityLost = false;

    const started = await this.#authority.startAttempt({
      ...identity,
      operationId: `${assignment.attemptId}:started`,
    });
    if (!started.accepted) return;

    const renewal = setInterval(() => {
      void this.#authority
        .renewLease(identity)
        .then((reply) => {
          if (!reply.accepted || !reply.leaseExpiresAt) {
            authorityLost = true;
            guard.revoke();
            controller.abort(new Error(reply.reason ?? "Authority was lost"));
            return;
          }
          guard.refresh(reply.leaseExpiresAt);
          desiredState = reply.desiredState ?? desiredState;
          controlGeneration = reply.controlGeneration ?? controlGeneration;
          if (desiredState !== "running") controller.abort(desiredState);
        })
        .catch(() => {
          authorityLost = true;
          guard.revoke();
          controller.abort(new Error("Convex authority is unavailable"));
        });
    }, this.#renewEveryMs);

    try {
      const result = await this.#runtime.execute(
        {
          attemptId: assignment.attemptId,
          prompt: assignment.prompt,
          projectPath: assignment.projectPath,
          systemPrompt:
            "Complete the assigned coding work. Stop before every new operation unless cloud authority remains valid.",
        },
        assignment.selection,
        controller.signal,
        async (milestone) => {
          if (!guard.canStartOperation()) return;
          await this.#authority.recordMilestone({ ...identity, ...milestone });
        },
      );

      if (authorityLost || !guard.canStartOperation()) {
        this.#state = "authority_lost";
        return;
      }
      if (desiredState !== "running") {
        await this.#finishControl(
          desiredState,
          controlGeneration,
          identity,
          result.summary,
        );
        return;
      }

      const validation = await this.#validator.validate(
        assignment.projectPath,
        controller.signal,
      );
      if (!guard.canStartOperation()) {
        this.#state = "authority_lost";
        return;
      }
      const validationReply = await this.#authority.publishValidation({
        ...identity,
        operationId: `${assignment.attemptId}:validation`,
        validation,
      });
      if (!validationReply.accepted) return;
      if (validation.status === "failed") {
        await this.#authority.failAttempt({
          ...identity,
          operationId: `${assignment.attemptId}:validation-failed`,
          code: "validation_failed",
          message: validation.summary,
        });
        return;
      }
      await this.#authority.completeAttempt({
        ...identity,
        operationId: `${assignment.attemptId}:completed`,
        summary: result.summary,
      });
    } catch (error) {
      if (authorityLost) {
        this.#state = "authority_lost";
        return;
      }
      if (desiredState !== "running") {
        await this.#finishControl(
          desiredState,
          controlGeneration,
          identity,
          "Stopped at a safe operation boundary.",
        );
        return;
      }
      await this.#authority.failAttempt({
        ...identity,
        operationId: `${assignment.attemptId}:failed`,
        code: "runtime_failed",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      clearInterval(renewal);
    }
  }

  async #finishControl(
    desiredState: Exclude<RunDesiredState, "running">,
    controlGeneration: number,
    identity: AttemptIdentity,
    summary: string,
  ): Promise<void> {
    if (desiredState === "paused") {
      this.#state = "pausing";
      await this.#authority.pauseAttempt({
        ...identity,
        operationId: `${identity.attemptId}:paused:${controlGeneration}`,
        controlGeneration,
        summary,
      });
      return;
    }
    this.#state = "canceling";
    await this.#authority.cancelAttempt({
      ...identity,
      operationId: `${identity.attemptId}:canceled:${controlGeneration}`,
      controlGeneration,
      summary,
    });
  }
}

function identityOf(assignment: WorkerAssignment): AttemptIdentity {
  return {
    runId: assignment.runId,
    attemptId: assignment.attemptId,
    generation: assignment.generation,
    hostId: assignment.hostId,
    hostSessionId: assignment.hostSessionId,
  };
}
