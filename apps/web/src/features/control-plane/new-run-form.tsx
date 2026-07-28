import type { ComponentType } from "react";
import { useState, useSyncExternalStore } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Context, Effect } from "effect";
import { ArrowRight, LoaderCircle } from "lucide-react";

import type { Store } from "@code/effect-react";
import { Component, makeStore, useStoreSelector } from "@code/effect-react";
import { Button } from "@code/ui-web/components/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@code/ui-web/components/card";
import { Input } from "@code/ui-web/components/input";
import { Label } from "@code/ui-web/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@code/ui-web/components/select";
import { Textarea } from "@code/ui-web/components/textarea";

import type {
  ControlPlaneClient,
  ReasoningLevel,
  SubmitWorkInput,
} from "../../control-plane/types";
import { useControlPlaneClient } from "../../control-plane/client";
import {
  getHostCapacity,
  providerOptions,
} from "../../control-plane/view-model";

export interface ExecutionPreferences {
  readonly model: string;
  readonly provider: string;
  readonly reasoning: ReasoningLevel;
}

export class NewRunControlPlane extends Context.Tag("NewRunControlPlane")<
  NewRunControlPlane,
  ControlPlaneClient
>() {}

export class NewRunPreferences extends Context.Tag("NewRunPreferences")<
  NewRunPreferences,
  Store<ExecutionPreferences>
>() {}

export function createExecutionPreferencesStore(): Store<ExecutionPreferences> {
  const firstProvider = providerOptions[0];
  return makeStore<ExecutionPreferences>({
    model: firstProvider?.models[0]?.id ?? "gpt-5.6-sol",
    provider: firstProvider?.id ?? "openai-codex",
    reasoning: "high",
  });
}

export function selectProvider(provider: string) {
  return (preferences: ExecutionPreferences): ExecutionPreferences => {
    const next = providerOptions.find((option) => option.id === provider);
    return {
      ...preferences,
      model: next?.models[0]?.id ?? "",
      provider,
    };
  };
}

export async function queueNewRun(
  client: ControlPlaneClient,
  preferences: ExecutionPreferences,
  fields: Pick<SubmitWorkInput, "project" | "prompt">,
): Promise<string> {
  return client.submitWork({
    ...fields,
    ...preferences,
  });
}

export const newRunFormFactory = Component.make(
  Effect.gen(function* () {
    const client = yield* NewRunControlPlane;
    const preferences = yield* NewRunPreferences;

    return function EffectNewRunForm() {
      return <NewRunFormView client={client} preferences={preferences} />;
    };
  }),
);

export function createNewRunFormComponent(
  client: ControlPlaneClient,
  preferences: Store<ExecutionPreferences>,
): ComponentType {
  return Component.mount(
    newRunFormFactory.pipe(
      Effect.provideService(NewRunControlPlane, client),
      Effect.provideService(NewRunPreferences, preferences),
    ),
    {
      displayName: "NewRunForm",
      onFailure: (error: never) => error,
    },
  );
}

export function NewRunForm() {
  const client = useControlPlaneClient();
  const [preferences] = useState(createExecutionPreferencesStore);
  const [Form] = useState(() => createNewRunFormComponent(client, preferences));

  return <Form />;
}

function NewRunFormView({
  client,
  preferences,
}: {
  client: ControlPlaneClient;
  preferences: Store<ExecutionPreferences>;
}) {
  const navigate = useNavigate();
  const snapshot = useSyncExternalStore(
    client.subscribe,
    client.getSnapshot,
    client.getSnapshot,
  );
  const provider = useStoreSelector(preferences, (state) => state.provider);
  const activeProvider =
    providerOptions.find((option) => option.id === provider) ??
    providerOptions[0];
  const model = useStoreSelector(preferences, (state) => state.model);
  const reasoning = useStoreSelector(preferences, (state) => state.reasoning);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const capacity = getHostCapacity(snapshot.hosts);

  async function submit(formData: FormData) {
    setSubmitting(true);
    setError(undefined);
    try {
      const runId = await queueNewRun(client, preferences.getSnapshot(), {
        prompt: String(formData.get("prompt") ?? ""),
        project: String(formData.get("project") ?? ""),
      });
      await navigate({ to: "/runs/$runId", params: { runId } });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to queue run");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form action={(formData) => void submit(formData)}>
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-sm">Assignment</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 pt-6">
          <div className="grid gap-2">
            <Label htmlFor="prompt">What should the agent do?</Label>
            <Textarea
              autoFocus
              className="min-h-44 resize-y text-[15px] leading-6"
              id="prompt"
              name="prompt"
              placeholder="Describe the change, the constraints, and how you want it validated."
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="project">Project</Label>
            <Input
              defaultValue="~/dev/projects/code"
              id="project"
              name="project"
              required
              spellCheck={false}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="provider">Provider</Label>
              <Select
                value={provider}
                onValueChange={(value) => {
                  preferences.update(selectProvider(value));
                }}
              >
                <SelectTrigger className="w-full" id="provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {providerOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="model">Model</Label>
              <Select
                value={model}
                onValueChange={(value) => {
                  preferences.update((current) => ({
                    ...current,
                    model: value,
                  }));
                }}
              >
                <SelectTrigger className="w-full" id="model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {activeProvider?.models.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="reasoning">Reasoning</Label>
              <Select
                value={reasoning}
                onValueChange={(value) => {
                  preferences.update((current) => ({
                    ...current,
                    reasoning: value as ReasoningLevel,
                  }));
                }}
              >
                <SelectTrigger className="w-full" id="reasoning">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="xhigh">Extra high</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
        <CardFooter className="bg-muted/20 justify-between border-t">
          <div className="text-muted-foreground min-w-0 text-xs">
            {capacity.available > 0
              ? `${capacity.available} ${capacity.available === 1 ? "host" : "hosts"} ready`
              : "No host ready — this run will wait in the queue"}
            {error && (
              <span className="text-destructive mt-1 block">{error}</span>
            )}
          </div>
          <Button disabled={submitting} type="submit">
            {submitting ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <ArrowRight />
            )}
            Queue run
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
