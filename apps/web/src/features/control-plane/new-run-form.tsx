import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, LoaderCircle } from "lucide-react";

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

import type { ReasoningLevel } from "../../control-plane/types";
import { useControlPlane } from "../../control-plane/client";
import {
  getHostCapacity,
  providerOptions,
} from "../../control-plane/view-model";

export function NewRunForm() {
  const navigate = useNavigate();
  const { snapshot, submitWork } = useControlPlane();
  const firstProvider = providerOptions[0];
  const [provider, setProvider] = useState(firstProvider?.id ?? "openai-codex");
  const activeProvider =
    providerOptions.find((option) => option.id === provider) ?? firstProvider;
  const [model, setModel] = useState(
    activeProvider?.models[0]?.id ?? "gpt-5.6-sol",
  );
  const [reasoning, setReasoning] = useState<ReasoningLevel>("high");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const capacity = getHostCapacity(snapshot.hosts);

  async function submit(formData: FormData) {
    setSubmitting(true);
    setError(undefined);
    try {
      const runId = await submitWork({
        prompt: String(formData.get("prompt") ?? ""),
        project: String(formData.get("project") ?? ""),
        provider,
        model,
        reasoning,
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
                  const next = providerOptions.find(
                    (option) => option.id === value,
                  );
                  setProvider(value);
                  setModel(next?.models[0]?.id ?? "");
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
              <Select value={model} onValueChange={setModel}>
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
                onValueChange={(value) => setReasoning(value as ReasoningLevel)}
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
