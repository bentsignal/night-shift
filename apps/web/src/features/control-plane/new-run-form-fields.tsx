import { ArrowRight, LoaderCircle } from "lucide-react";

import { Button } from "@code/ui-web/components/button";
import {
  CardContent,
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

import type { NewRunFormState } from "./new-run-form-state";

export function NewRunFormFields(state: NewRunFormState) {
  return (
    <>
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
          <PreferenceSelect
            id="provider"
            label="Provider"
            onValueChange={state.selectProvider}
            options={state.providerOptions}
            value={state.provider}
          />
          <PreferenceSelect
            id="model"
            label="Model"
            onValueChange={state.selectModel}
            options={state.modelOptions}
            value={state.model}
          />
          <PreferenceSelect
            id="reasoning"
            label="Reasoning"
            onValueChange={state.selectReasoning}
            options={state.reasoningOptions}
            value={state.reasoning}
          />
        </div>
      </CardContent>
    </>
  );
}

function PreferenceSelect({
  id,
  label,
  onValueChange,
  options,
  value,
}: {
  id: string;
  label: string;
  onValueChange: (value: string) => void;
  options: ReadonlyArray<{ id: string; label: string }>;
  value: string;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="w-full" id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function QueueButton({ submitting }: { submitting: boolean }) {
  return (
    <Button disabled={submitting} type="submit">
      <QueueButtonIcon submitting={submitting} />
      Queue run
    </Button>
  );
}

function QueueButtonIcon({ submitting }: { submitting: boolean }) {
  if (submitting) return <LoaderCircle className="animate-spin" />;
  return <ArrowRight />;
}
