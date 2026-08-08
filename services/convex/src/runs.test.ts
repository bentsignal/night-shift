import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { api } from "./_generated/api";
import schema from "./schema";

declare global {
  interface ImportMeta {
    glob(
      pattern: string,
    ): Record<string, () => Promise<Record<string, unknown>>>;
  }
}

const modules = import.meta.glob("./**/!(*.*.*)*.*s");

const submission = {
  ownerId: "owner-1",
  submitKey: "submit-1",
  prompt: "Implement the next vertical slice",
  projectId: "night-shift",
  requiredCapabilities: ["git", "typescript", "git"],
  runtime: {
    adapter: "codex-cli",
    provider: "openai-codex",
    model: "gpt-5",
    reasoningLevel: "high",
  },
};

describe("runs.submit through the experimental Confect adapter", () => {
  it("executes the Effect handler and durably admits normalized queued work", async () => {
    const t = convexTest(schema, modules);

    const result = await t.mutation(api.runs.submit, submission);
    const run = await t.run((ctx) => ctx.db.get("runs", result.runId));

    expect(result).toEqual({ created: true, runId: result.runId });
    expect(run).toMatchObject({
      ownerId: submission.ownerId,
      submitKey: submission.submitKey,
      prompt: submission.prompt,
      projectId: submission.projectId,
      requiredCapabilities: ["git", "typescript"],
      runtime: submission.runtime,
      status: "queued",
      validationStatus: "pending",
      fencingGeneration: 0,
      controlGeneration: 0,
    });
  });

  it("replays an identical submit key without creating a second run", async () => {
    const t = convexTest(schema, modules);

    const first = await t.mutation(api.runs.submit, submission);
    const replay = await t.mutation(api.runs.submit, {
      ...submission,
      requiredCapabilities: ["typescript", "git"],
    });
    const runs = await t.run((ctx) => ctx.db.query("runs").collect());

    expect(replay).toEqual({ created: false, runId: first.runId });
    expect(runs).toHaveLength(1);
  });

  it("publishes the existing conflict code and rolls the mutation back", async () => {
    const t = convexTest(schema, modules);

    await t.mutation(api.runs.submit, submission);

    await expect(
      t.mutation(api.runs.submit, {
        ...submission,
        prompt: "Different work under the same admission key",
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        data: {
          code: "IDEMPOTENCY_CONFLICT",
          message: "submitKey was already used for different work",
        },
      }),
    );

    const runs = await t.run((ctx) => ctx.db.query("runs").collect());
    expect(runs).toHaveLength(1);
    expect(runs[0]?.prompt).toBe(submission.prompt);
  });
});
