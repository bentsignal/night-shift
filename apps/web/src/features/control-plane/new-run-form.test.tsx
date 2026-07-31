import { act, render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createComponent, makeStore } from "@night-shift/effect-react";

import type { ControlPlaneState } from "../../control-plane/client";
import type {
  ControlPlaneClient,
  ControlPlaneSnapshot,
  SubmitWorkInput,
} from "../../control-plane/types";
import { ControlPlane } from "../../control-plane/client";
import { NewRunForm } from "./new-run-form";
import { useNewRunFormState } from "./new-run-form-state";

const router = vi.hoisted(() => ({
  navigate: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useNavigate: () => router.navigate,
}));

function client(submitWork = vi.fn<ControlPlaneClient["submitWork"]>()) {
  const snapshot = {
    authority: "connected",
    hosts: [],
    runs: [],
  } satisfies ControlPlaneSnapshot;

  return {
    commandRun: vi.fn(),
    getSnapshot: () => snapshot,
    submitWork,
    subscribe: () => () => undefined,
  } satisfies ControlPlaneClient;
}

function testControlPlaneState(
  submitWork = vi.fn<ControlPlaneClient["submitWork"]>(),
) {
  const testClient = client(submitWork);
  return {
    ...testClient.getSnapshot(),
    commandRun: testClient.commandRun,
    submitWork: testClient.submitWork,
  } satisfies ControlPlaneState;
}

function testControlPlaneStore(
  submitWork = vi.fn<ControlPlaneClient["submitWork"]>(),
) {
  return makeStore(testControlPlaneState(submitWork));
}

const NewRunFormHarness = createComponent({
  ui: () => (
    <ControlPlane implements={() => testControlPlaneState()}>
      <NewRunForm />
    </ControlPlane>
  ),
});

describe("NewRunForm", () => {
  it("exposes the state/ui contract as the rendered form", () => {
    render(<NewRunFormHarness />);

    expect(screen.getByLabelText("What should the agent do?")).toBeTruthy();
    expect(screen.getByLabelText("Project")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Queue run" })).toBeTruthy();
  });

  it("keeps submission and execution preferences in state", async () => {
    const submitWork = vi
      .fn<ControlPlaneClient["submitWork"]>()
      .mockResolvedValue("run_effect");
    const deps = { controlPlane: testControlPlaneStore(submitWork) } as const;
    const { result } = renderHook(() => useNewRunFormState({ deps }));

    act(() => {
      result.current.selectProvider("anthropic");
      result.current.selectModel("claude-opus-4-1");
      result.current.selectReasoning("xhigh");
    });

    const formData = new FormData();
    formData.set("project", "~/dev/projects/night-shift");
    formData.set("prompt", "Wire the Effect boundary.");

    await act(async () => result.current.submit(formData));

    expect(submitWork).toHaveBeenCalledWith({
      model: "claude-opus-4-1",
      project: "~/dev/projects/night-shift",
      prompt: "Wire the Effect boundary.",
      provider: "anthropic",
      reasoning: "xhigh",
    } satisfies SubmitWorkInput);
    expect(router.navigate).toHaveBeenCalledWith({
      params: { runId: "run_effect" },
      to: "/runs/$runId",
    });
  });
});
