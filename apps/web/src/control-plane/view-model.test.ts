import { describe, expect, it } from "vitest";

import type { Host, RunStatus } from "./types";
import {
  getHostCapacity,
  getRunActionState,
  getRunStatusLabel,
  providerOptions,
} from "./view-model";

describe("run action state", () => {
  it("offers pause and cancel only while a run is executing", () => {
    expect(getRunActionState("running")).toEqual({
      canPause: true,
      showResume: false,
      canCancel: true,
    });
  });

  it("replaces pause with resume for a safely paused run", () => {
    expect(getRunActionState("paused")).toEqual({
      canPause: false,
      showResume: true,
      canCancel: true,
    });
  });

  it.each<RunStatus>(["completed", "failed", "canceled"])(
    "disables destructive controls for terminal status %s",
    (status) => {
      expect(getRunActionState(status)).toEqual({
        canPause: false,
        showResume: false,
        canCancel: false,
      });
    },
  );

  it("keeps queued work cancelable while capacity is absent", () => {
    expect(getRunActionState("queued")).toEqual({
      canPause: false,
      showResume: false,
      canCancel: true,
    });
  });
});

describe("host capacity", () => {
  const hosts: Host[] = [
    {
      id: "one",
      name: "One",
      health: "offline",
      lastSeenAt: "2026-07-26T12:00:00.000Z",
      capabilities: [],
    },
    {
      id: "two",
      name: "Two",
      health: "busy",
      lastSeenAt: "2026-07-26T12:00:00.000Z",
      capabilities: [],
    },
  ];

  it("explicitly reassures the operator when no host can claim", () => {
    expect(getHostCapacity(hosts)).toEqual({
      total: 2,
      available: 0,
      message: "Submissions remain available",
    });
  });

  it("reports immediately available execution capacity", () => {
    expect(
      getHostCapacity([{ ...hosts[0]!, health: "ready" }, hosts[1]!]),
    ).toEqual({
      total: 2,
      available: 1,
      message: "1 machine can claim work",
    });
  });
});

describe("runtime selection", () => {
  it("keeps provider and model choice separate from workflow state", () => {
    expect(providerOptions.map((provider) => provider.id)).toEqual([
      "openai-codex",
      "anthropic",
    ]);
    expect(providerOptions[0]?.models.length).toBeGreaterThan(1);
    expect(getRunStatusLabel("claimed")).toBe("Claimed");
  });
});
