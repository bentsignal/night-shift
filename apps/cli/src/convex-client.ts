import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

import type { NightShiftClientConfig } from "./config.ts";
import type {
  ControlKind,
  HostSummary,
  NightShiftClient,
  RunDetails,
  RunSummary,
  SubmitRequest,
} from "./types.ts";

type Mutation = ReturnType<typeof makeFunctionReference<"mutation">>;
type Query = ReturnType<typeof makeFunctionReference<"query">>;

const mutations = {
  submit: makeFunctionReference<"mutation">("runs:submit"),
  requestControl: makeFunctionReference<"mutation">(
    "orchestration:requestControl",
  ),
} satisfies Record<string, Mutation>;

const queries = {
  listRuns: makeFunctionReference<"query">("runs:list"),
  getRun: makeFunctionReference<"query">("runs:get"),
  listHosts: makeFunctionReference<"query">("hosts:list"),
} satisfies Record<string, Query>;

export class ConvexNightShiftClient implements NightShiftClient {
  readonly #client: ConvexHttpClient;
  readonly #ownerId: string;

  constructor(config: NightShiftClientConfig) {
    this.#client = new ConvexHttpClient(config.url);
    this.#ownerId = config.ownerId;
  }

  submit(input: SubmitRequest): Promise<{ created: boolean; runId: string }> {
    return this.#mutation(mutations.submit, {
      submitKey: input.submitKey,
      prompt: input.prompt,
      projectId: input.projectPath,
      requiredCapabilities: input.requiredCapabilities,
      runtime: input.runtime,
    });
  }

  async listRuns(limit = 10): Promise<RunSummary[]> {
    const runs = await this.#query<Array<ConvexRun>>(queries.listRuns, {
      limit,
    });
    return runs.map(toRunSummary);
  }

  async getRun(runId: string): Promise<RunDetails | null> {
    const result = await this.#query<ConvexRunDetails | null>(queries.getRun, {
      runId,
    });
    if (!result) return null;
    return {
      run: toRunSummary(result.run),
      milestones: result.milestones,
    };
  }

  async listHosts(): Promise<HostSummary[]> {
    const hosts = await this.#query<Array<ConvexHost>>(queries.listHosts, {});
    return hosts.map((host) => ({
      id: host._id,
      displayName: host.displayName,
      status: host.status,
      capabilities: host.capabilities,
      activeAssignments: host.activeAssignments,
      maxConcurrent: host.maxConcurrent,
      sessionExpiresAt: host.sessionExpiresAt,
    }));
  }

  async requestControl(
    runId: string,
    kind: ControlKind,
    idempotencyKey: string,
  ) {
    const result = await this.#mutation<ControlReply>(
      mutations.requestControl,
      { runId, kind, idempotencyKey },
    );
    return {
      accepted:
        result.command.status === "pending" ||
        result.command.status === "acknowledged",
      status: result.command.status,
    };
  }

  #mutation<T>(reference: Mutation, input: object): Promise<T> {
    return this.#client.mutation(reference, {
      ...input,
      ownerId: this.#ownerId,
    }) as Promise<T>;
  }

  #query<T>(reference: Query, input: object): Promise<T> {
    return this.#client.query(reference, {
      ...input,
      ownerId: this.#ownerId,
    }) as Promise<T>;
  }
}

interface ConvexRun {
  _id: string;
  prompt: string;
  projectId?: string;
  status: string;
  validationStatus: string;
  runtime?: RunSummary["runtime"];
  updatedAt: number;
  resultSummary?: string;
  failure?: string;
}

interface ConvexRunDetails {
  run: ConvexRun;
  milestones: RunDetails["milestones"];
}

interface ConvexHost {
  _id: string;
  displayName: string;
  status: string;
  capabilities: string[];
  activeAssignments: number;
  maxConcurrent: number;
  sessionExpiresAt: number;
}

interface ControlReply {
  command: { status: string };
}

function toRunSummary(run: ConvexRun) {
  return {
    id: run._id,
    prompt: run.prompt,
    projectPath: run.projectId,
    status: run.status,
    validationStatus: run.validationStatus,
    runtime: run.runtime,
    updatedAt: run.updatedAt,
    resultSummary: run.resultSummary,
    failure: run.failure,
  };
}
