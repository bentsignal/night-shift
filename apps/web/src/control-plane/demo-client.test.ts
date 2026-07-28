import { describe, expect, it, vi } from "vitest";

import type { ControlPlaneSnapshot, Run } from "./types";
import { createDemoControlPlaneClient } from "./demo-client";

function run(status: Run["status"]) {
  return {
    id: "run_test",
    title: "Test authority transitions",
    prompt: "Exercise the demo boundary.",
    project: "~/project",
    provider: "OpenAI",
    model: "gpt-5.2-codex",
    reasoning: "high",
    status,
    createdAt: "2026-07-26T12:00:00.000Z",
    updatedAt: "2026-07-26T12:00:00.000Z",
    host: { id: "host_one", name: "One" },
    lease: {
      generation: 3,
      expiresAt: "2026-07-26T12:05:00.000Z",
    },
    milestones: [],
  } satisfies Run;
}

function snapshot(seedRun: Run) {
  return {
    authority: "connected",
    hosts: [],
    runs: [seedRun],
  } satisfies ControlPlaneSnapshot;
}

describe("demo control-plane client", () => {
  it("accepts work into the queue with no hosts available", async () => {
    const client = createDemoControlPlaneClient(snapshot(run("completed")));
    const listener = vi.fn();
    client.subscribe(listener);

    const id = await client.submitWork({
      prompt: "Implement a durable queue.",
      project: "~/project",
      provider: "openai",
      model: "gpt-5.2-codex",
      reasoning: "high",
    });

    const submitted = client.getSnapshot().runs[0];
    expect(id).toMatch(/^run_demo_/);
    expect(submitted).toMatchObject({
      id,
      status: "queued",
    });
    expect(submitted).not.toHaveProperty("host");
    expect(submitted).not.toHaveProperty("lease");
    expect(submitted?.milestones).toHaveLength(1);
    expect(submitted?.milestones[0]?.kind).toBe("queued");
    expect(listener).toHaveBeenCalledOnce();
  });

  it("returns a paused attempt to the queue without reusing its lease", async () => {
    const client = createDemoControlPlaneClient(snapshot(run("paused")));

    await client.commandRun("run_test", { type: "resume" });

    expect(client.getSnapshot().runs[0]).toMatchObject({
      status: "queued",
      host: undefined,
      lease: undefined,
    });
    expect(client.getSnapshot().runs[0]?.milestones.at(-1)?.kind).toBe(
      "resumed",
    );
  });

  it("ignores commands which are invalid for the current state", async () => {
    const completed = run("completed");
    const client = createDemoControlPlaneClient(snapshot(completed));

    await client.commandRun("run_test", { type: "pause" });
    await client.commandRun("run_test", { type: "cancel" });

    expect(client.getSnapshot().runs[0]).toBe(completed);
  });
});
