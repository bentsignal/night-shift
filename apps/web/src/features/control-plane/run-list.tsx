import { ArrowUpRight, Plus } from "lucide-react";

import { Button } from "@night-shift/ui-web/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@night-shift/ui-web/components/card";

import type { Run } from "../../control-plane/types";
import { formatMoment } from "../../control-plane/view-model";
import { QuickLink } from "../quick-link/quick-link";
import { StatusBadge } from "./status-badge";

export function RunList({ runs }: { runs: Run[] }) {
  if (runs.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex min-h-64 flex-col items-center justify-center gap-4 text-center">
          <div>
            <p className="text-sm font-medium">No runs yet</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Queue the first assignment to get started.
            </p>
          </div>
          <Button asChild size="sm">
            <QuickLink to="/new">
              <Plus />
              New run
            </QuickLink>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden py-0">
      <CardHeader className="border-b py-4">
        <CardTitle className="text-sm">Recent activity</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {runs.map((run) => (
            <QuickLink
              className="group hover:bg-muted/40 grid min-w-0 gap-2 px-4 py-4 transition-colors sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-5"
              key={run.id}
              params={{ runId: run.id }}
              to="/runs/$runId"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{run.title}</p>
                <p className="text-muted-foreground mt-1 truncate font-mono text-[11px]">
                  {run.project}
                </p>
              </div>
              <StatusBadge status={run.status} />
              <div className="text-muted-foreground flex items-center gap-3 text-xs">
                <span>{formatMoment(run.updatedAt)}</span>
                <ArrowUpRight className="size-4 opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
            </QuickLink>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
