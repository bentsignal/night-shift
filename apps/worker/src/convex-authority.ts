import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

import type {
  AttemptIdentity,
  AuthorityReply,
  HostRegistration,
  LeaseReply,
  RuntimeMilestone,
  ValidationResult,
  WorkerAssignment,
  WorkerAuthority,
} from "./types";

type Mutation = ReturnType<typeof makeFunctionReference<"mutation">>;

const functions = {
  registerHost: makeFunctionReference<"mutation">("hosts:registerOrRefresh"),
  claimNext: makeFunctionReference<"mutation">("queue:claimNext"),
  renewLease: makeFunctionReference<"mutation">("attempts:renewLease"),
  startAttempt: makeFunctionReference<"mutation">("attempts:start"),
  recordMilestone: makeFunctionReference<"mutation">(
    "attempts:recordMilestone",
  ),
  publishValidation: makeFunctionReference<"mutation">(
    "attempts:publishValidation",
  ),
  pauseAttempt: makeFunctionReference<"mutation">("attempts:pause"),
  cancelAttempt: makeFunctionReference<"mutation">("attempts:cancel"),
  failAttempt: makeFunctionReference<"mutation">("attempts:fail"),
  completeAttempt: makeFunctionReference<"mutation">("attempts:complete"),
} satisfies Record<string, Mutation>;

export class ConvexWorkerAuthority implements WorkerAuthority {
  readonly #client: ConvexHttpClient;
  readonly #ownerId: string;

  constructor(url: string, ownerId: string) {
    this.#client = new ConvexHttpClient(url);
    this.#ownerId = ownerId;
  }

  registerHost(
    input: Parameters<WorkerAuthority["registerHost"]>[0],
  ): Promise<HostRegistration> {
    return this.#mutate(functions.registerHost, input);
  }

  claimNext(input: HostRegistration): Promise<WorkerAssignment | null> {
    return this.#mutate(functions.claimNext, input);
  }

  renewLease(input: AttemptIdentity): Promise<LeaseReply> {
    return this.#mutate(functions.renewLease, input);
  }

  startAttempt(
    input: AttemptIdentity & { operationId: string },
  ): Promise<AuthorityReply> {
    return this.#mutate(functions.startAttempt, input);
  }

  recordMilestone(
    input: AttemptIdentity & RuntimeMilestone,
  ): Promise<AuthorityReply> {
    return this.#mutate(functions.recordMilestone, input);
  }

  publishValidation(
    input: AttemptIdentity & {
      operationId: string;
      validation: ValidationResult;
    },
  ): Promise<AuthorityReply> {
    return this.#mutate(functions.publishValidation, input);
  }

  pauseAttempt(
    input: Parameters<WorkerAuthority["pauseAttempt"]>[0],
  ): Promise<AuthorityReply> {
    return this.#mutate(functions.pauseAttempt, input);
  }

  cancelAttempt(
    input: Parameters<WorkerAuthority["cancelAttempt"]>[0],
  ): Promise<AuthorityReply> {
    return this.#mutate(functions.cancelAttempt, input);
  }

  failAttempt(
    input: Parameters<WorkerAuthority["failAttempt"]>[0],
  ): Promise<AuthorityReply> {
    return this.#mutate(functions.failAttempt, input);
  }

  completeAttempt(
    input: Parameters<WorkerAuthority["completeAttempt"]>[0],
  ): Promise<AuthorityReply> {
    return this.#mutate(functions.completeAttempt, input);
  }

  #mutate<T>(reference: Mutation, input: object): Promise<T> {
    return this.#client.mutation(reference, {
      ...input,
      ownerId: this.#ownerId,
    }) as Promise<T>;
  }
}
