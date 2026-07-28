import { describe, expect, it, vi } from "vitest";

import type {
  ControlPlaneClient,
  ControlPlaneSnapshot,
  SubmitWorkInput,
} from "../../control-plane/types";
import {
  createExecutionPreferencesStore,
  createNewRunFormComponent,
  queueNewRun,
  selectProvider,
} from "./new-run-form";

function client(submitWork = vi.fn<ControlPlaneClient["submitWork"]>()) {
  const snapshot: ControlPlaneSnapshot = {
    authority: "connected",
    hosts: [],
    runs: [],
  };

  return {
    commandRun: vi.fn(),
    getSnapshot: () => snapshot,
    submitWork,
    subscribe: () => () => undefined,
  } satisfies ControlPlaneClient;
}

describe("Effect new-run boundary", () => {
  it("submits the selected execution preferences through the real client", async () => {
    const submitWork = vi
      .fn<ControlPlaneClient["submitWork"]>()
      .mockResolvedValue("run_effect");
    const preferences = createExecutionPreferencesStore();
    preferences.update(selectProvider("anthropic"));
    preferences.update((current) => ({
      ...current,
      model: "claude-opus-4-1",
      reasoning: "xhigh",
    }));

    const fields = {
      project: "~/dev/projects/code",
      prompt: "Wire the Effect boundary.",
    };
    const runId = await queueNewRun(
      client(submitWork),
      preferences.getSnapshot(),
      fields,
    );

    expect(runId).toBe("run_effect");
    expect(submitWork).toHaveBeenCalledWith({
      ...fields,
      model: "claude-opus-4-1",
      provider: "anthropic",
      reasoning: "xhigh",
    } satisfies SubmitWorkInput);
  });

  it("provides both Effect services before mounting the React component", () => {
    const Form = createNewRunFormComponent(
      client(),
      createExecutionPreferencesStore(),
    );

    expect(Form).toBeTypeOf("function");
    expect(Form.displayName).toBe("NewRunForm");
  });
});
