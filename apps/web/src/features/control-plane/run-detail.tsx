import { Check, Clock3, Pause, Play, Server, Square, X } from "lucide-react";

import { Badge } from "@night-shift/ui-web/components/badge";
import { Button } from "@night-shift/ui-web/components/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@night-shift/ui-web/components/card";
import { Separator } from "@night-shift/ui-web/components/separator";
import { cn } from "@night-shift/ui-web/lib/utils";

import type { Run, RunCommand } from "../../control-plane/types";
import {
  formatMoment,
  getRunActionState,
} from "../../control-plane/view-model";
import { StatusBadge, statusTone } from "./status-badge";

export function RunDetail({
  run,
  onCommand,
}: {
  run: Run;
  onCommand: (command: RunCommand) => Promise<void>;
}) {
  const actions = getRunActionState(run.status);
  const terminal = ["completed", "failed", "canceled"].includes(run.status);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="grid min-w-0 content-start gap-5">
        <Card>
          <CardHeader className="gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <StatusBadge status={run.status} />
              <div className="flex items-center gap-2">
                <PrimaryRunAction actions={actions} onCommand={onCommand} />
                <Button
                  disabled={!actions.canCancel}
                  onClick={() => void onCommand({ type: "cancel" })}
                  size="sm"
                  variant="destructive"
                >
                  <Square />
                  Cancel
                </Button>
              </div>
            </div>
            <div>
              <h1 className="text-lg leading-7 font-semibold">{run.title}</h1>
              <p className="text-muted-foreground mt-2 text-sm leading-6 whitespace-pre-wrap">
                {run.prompt}
              </p>
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <h2 className="text-sm font-semibold">Activity</h2>
          </CardHeader>
          <CardContent className="pt-1">
            <ActivityContent run={run} />
          </CardContent>
        </Card>
      </div>

      <div className="grid content-start gap-5">
        <Card>
          <CardHeader className="border-b">
            <h2 className="text-sm font-semibold">Execution</h2>
          </CardHeader>
          <CardContent className="grid gap-4 pt-5 text-sm">
            <MetadataRow
              icon={<Server />}
              label="Host"
              value={run.host?.name ?? "Unassigned"}
            />
            <MetadataRow
              icon={<Clock3 />}
              label="Lease"
              value={
                run.lease
                  ? terminal
                    ? "Closed"
                    : `Generation ${run.lease.generation}`
                  : "Not issued"
              }
            />
            <Separator />
            <div>
              <p className="text-muted-foreground text-xs">Runtime</p>
              <p className="mt-1 font-medium">{run.model}</p>
              <p className="text-muted-foreground mt-1 text-xs">
                {run.provider} · {run.reasoning}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Project</p>
              <p className="mt-1 font-mono text-xs break-all">{run.project}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <h2 className="text-sm font-semibold">Validation</h2>
          </CardHeader>
          <CardContent className="pt-5">
            <ValidationContent validation={run.validation} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PrimaryRunAction({
  actions,
  onCommand,
}: {
  actions: ReturnType<typeof getRunActionState>;
  onCommand: (command: RunCommand) => Promise<void>;
}) {
  if (actions.showResume) {
    return (
      <Button onClick={() => void onCommand({ type: "resume" })} size="sm">
        <Play />
        Resume
      </Button>
    );
  }

  return (
    <Button
      disabled={!actions.canPause}
      onClick={() => void onCommand({ type: "pause" })}
      size="sm"
      variant="outline"
    >
      <Pause />
      Pause
    </Button>
  );
}

function ActivityContent({ run }: { run: Run }) {
  if (run.milestones.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">
        Waiting for the first event
      </p>
    );
  }

  return (
    <ol>
      {run.milestones.map((milestone, index) => (
        <li
          className="relative grid grid-cols-[1.25rem_minmax(0,1fr)_auto] gap-3 py-4"
          key={milestone.id}
        >
          <MilestoneConnector visible={index < run.milestones.length - 1} />
          <span
            className={cn(
              "border-background ring-border relative mt-1 size-3 rounded-full border-2 bg-current ring-1",
              statusTone(
                milestone.kind === "validation"
                  ? run.validation?.passed
                    ? "completed"
                    : "failed"
                  : milestone.kind === "progress" ||
                      milestone.kind === "started" ||
                      milestone.kind === "resumed"
                    ? "running"
                    : milestone.kind,
              ),
            )}
          />
          <div className="min-w-0">
            <p className="text-sm font-medium">{milestone.label}</p>
            <p className="text-muted-foreground mt-1 text-sm">
              {milestone.detail}
            </p>
          </div>
          <time className="text-muted-foreground font-mono text-[11px]">
            {formatMoment(milestone.at)}
          </time>
        </li>
      ))}
    </ol>
  );
}

function MilestoneConnector({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <span className="bg-border absolute top-8 bottom-0 left-[0.34rem] w-px" />
  );
}

function ValidationContent({ validation }: { validation: Run["validation"] }) {
  if (!validation) {
    return (
      <p className="text-muted-foreground text-sm">
        Validation has not run yet.
      </p>
    );
  }

  return (
    <div className="flex items-start gap-3">
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full",
          validation.passed
            ? "bg-success/10 text-success"
            : "bg-destructive/10 text-destructive",
        )}
      >
        <ValidationIcon passed={validation.passed} />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium">
          {validationLabel(validation.passed)}
        </p>
        <p className="text-muted-foreground mt-1 font-mono text-[11px] break-all">
          {validation.command}
        </p>
        <Badge className="mt-3" variant="secondary">
          {validation.durationMs} ms
        </Badge>
      </div>
    </div>
  );
}

function ValidationIcon({ passed }: { passed: boolean }) {
  if (passed) return <Check />;
  return <X />;
}

function validationLabel(passed: boolean) {
  return passed ? "Passed" : "Failed";
}

function MetadataRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="bg-muted text-muted-foreground flex size-8 items-center justify-center rounded-md [&>svg]:size-4">
        {icon}
      </span>
      <div>
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="mt-0.5 font-medium">{value}</p>
      </div>
    </div>
  );
}
