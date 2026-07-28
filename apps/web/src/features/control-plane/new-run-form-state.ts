import type { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Context, Effect } from "effect";

import type { Store } from "@code/effect-react";
import { makeStore, useStoreSelector } from "@code/effect-react";

import type { useControlPlane } from "../../control-plane/client";
import type { ReasoningLevel } from "../../control-plane/types";
import {
  getHostCapacity,
  providerOptions,
} from "../../control-plane/view-model";

const reasoningOptions = [
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
  { id: "xhigh", label: "Extra high" },
] as const;

export interface ExecutionPreferences {
  readonly model: string;
  readonly provider: string;
  readonly reasoning: ReasoningLevel;
}

export class NewRunControlPlane extends Context.Tag("NewRunControlPlane")<
  NewRunControlPlane,
  typeof useControlPlane
>() {}

export class NewRunPreferences extends Context.Tag("NewRunPreferences")<
  NewRunPreferences,
  () => Store<ExecutionPreferences>
>() {}

export class NewRunNavigation extends Context.Tag("NewRunNavigation")<
  NewRunNavigation,
  typeof useNavigate
>() {}

export const createExecutionPreferencesStore = () => {
  const firstProvider = providerOptions[0];
  return makeStore({
    model: firstProvider?.models[0]?.id ?? "gpt-5.6-sol",
    provider: firstProvider?.id ?? "openai-codex",
    reasoning: "high" as ReasoningLevel,
  });
};

export const newRunFormState = Effect.gen(function* () {
  const useControlPlane = yield* NewRunControlPlane;
  const createPreferences = yield* NewRunPreferences;
  const useNavigation = yield* NewRunNavigation;

  return function useNewRunFormState() {
    const navigate = useNavigation();
    const [preferences] = useState(createPreferences);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string>();
    const hosts = useControlPlane((state) => state.hosts);
    const submitWork = useControlPlane((state) => state.submitWork);
    const provider = useStoreSelector(preferences, (state) => state.provider);
    const model = useStoreSelector(preferences, (state) => state.model);
    const reasoning = useStoreSelector(preferences, (state) => state.reasoning);
    const activeProvider =
      providerOptions.find((option) => option.id === provider) ??
      providerOptions[0];
    const capacity = getHostCapacity(hosts);

    const selectProvider = (nextProvider: string) => {
      preferences.update((current) => ({
        ...current,
        model:
          providerOptions.find((option) => option.id === nextProvider)
            ?.models[0]?.id ?? "",
        provider: nextProvider,
      }));
    };

    const selectModel = (nextModel: string) => {
      preferences.update((current) => ({
        ...current,
        model: nextModel,
      }));
    };

    const selectReasoning = (nextReasoning: string) => {
      preferences.update((current) => ({
        ...current,
        reasoning: nextReasoning as ReasoningLevel,
      }));
    };

    const submit = (formData: FormData) => {
      setSubmitting(true);
      setError(undefined);

      return Effect.tryPromise({
        try: async () => {
          const runId = await submitWork({
            prompt: String(formData.get("prompt") ?? ""),
            project: String(formData.get("project") ?? ""),
            ...preferences.getSnapshot(),
          });
          await navigate({ to: "/runs/$runId", params: { runId } });
        },
        catch: (cause) =>
          cause instanceof Error ? cause : new Error("Unable to queue run"),
      }).pipe(
        Effect.catchAll((cause) =>
          Effect.sync(() => {
            setError(cause.message);
          }),
        ),
        Effect.ensuring(
          Effect.sync(() => {
            setSubmitting(false);
          }),
        ),
        Effect.runPromise,
      );
    };

    return Effect.succeed({
      capacityLabel:
        capacity.available > 0
          ? `${capacity.available} ${capacity.available === 1 ? "host" : "hosts"} ready`
          : "No host ready — this run will wait in the queue",
      error,
      model,
      modelOptions: activeProvider?.models ?? [],
      provider,
      providerOptions,
      reasoning,
      reasoningOptions,
      selectModel,
      selectProvider,
      selectReasoning,
      submit,
      submitting,
    });
  };
});

type NewRunFormStateHook = Effect.Effect.Success<typeof newRunFormState>;

export type NewRunFormState = Effect.Effect.Success<
  ReturnType<NewRunFormStateHook>
>;
