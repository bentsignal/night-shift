import { Badge } from "@code/ui-web/components/badge";
import { cn } from "@code/ui-web/lib/utils";

import type { RunStatus } from "../../control-plane/types";
import { getRunStatusLabel } from "../../control-plane/view-model";

export function statusTone(status: RunStatus) {
  if (status === "completed" || status === "running" || status === "claimed") {
    return "text-success";
  }
  if (status === "queued" || status === "paused") return "text-warning";
  if (status === "failed" || status === "canceled" || status === "canceling") {
    return "text-destructive";
  }
  return "text-muted-foreground";
}

export function StatusBadge({ status }: { status: RunStatus }) {
  return (
    <Badge className="gap-1.5 font-normal" variant="outline">
      <span
        className={cn("size-1.5 rounded-full bg-current", statusTone(status))}
      />
      {getRunStatusLabel(status)}
    </Badge>
  );
}
