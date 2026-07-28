import { act, render, renderHook, screen } from "@testing-library/react";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import type { ControlPlaneState } from "../../control-plane/client";
import type {
  ControlPlaneClient,
  ControlPlaneSnapshot,
  SubmitWorkInput,
} from "../../control-plane/types";
import { ControlPlaneProvider } from "../../control-plane/client";
import { NewRunForm } from "./new-run-form";
import {
  createExecutionPreferencesStore,
  NewRunControlPlane,
  newRunFormState,
  NewRunNavigation,
  NewRunPreferences,
} from "./new-run-form-state";

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

function testControlPlane(
  submitWork = vi.fn<ControlPlaneClient["submitWork"]>(),
) {
  const testClient = client(submitWork);
  const state = {
    ...testClient.getSnapshot(),
    commandRun: testClient.commandRun,
    submitWork: testClient.submitWork,
  } satisfies ControlPlaneState;

  return function useTestControlPlane<Selected>(
    selector: (controlPlane: ControlPlaneState) => Selected,
  ) {
    return selector(state);
  };
}

describe("NewRunForm", () => {
  it("exposes the state/component contract as the rendered form", () => {
    render(
      <ControlPlaneProvider client={client()}>
        <NewRunForm />
      </ControlPlaneProvider>,
    );

    expect(screen.getByLabelText("What should the agent do?")).toBeTruthy();
    expect(screen.getByLabelText("Project")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Queue run" })).toBeTruthy();
  });

  it("keeps submission and execution preferences in state", async () => {
    const submitWork = vi
      .fn<ControlPlaneClient["submitWork"]>()
      .mockResolvedValue("run_effect");
    const useFormState = Effect.runSync(
      newRunFormState.pipe(
        Effect.provideService(NewRunControlPlane, testControlPlane(submitWork)),
        Effect.provideService(
          NewRunPreferences,
          createExecutionPreferencesStore,
        ),
        Effect.provideService(NewRunNavigation, () => router.navigate),
      ),
    );
    const { result } = renderHook(() => Effect.runSync(useFormState()));

    act(() => {
      result.current.selectProvider("anthropic");
      result.current.selectModel("claude-opus-4-1");
      result.current.selectReasoning("xhigh");
    });

    const formData = new FormData();
    formData.set("project", "~/dev/projects/code");
    formData.set("prompt", "Wire the Effect boundary.");

    await act(async () => result.current.submit(formData));

    expect(submitWork).toHaveBeenCalledWith({
      model: "claude-opus-4-1",
      project: "~/dev/projects/code",
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
