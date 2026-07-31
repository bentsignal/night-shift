import { createFileRoute } from "@tanstack/react-router";
import { Effect } from "effect";
import { Cpu, Server } from "lucide-react";

import { createComponent, useStore } from "@night-shift/effect-react";
import { Badge } from "@night-shift/ui-web/components/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@night-shift/ui-web/components/card";
import { cn } from "@night-shift/ui-web/lib/utils";

import type { Host } from "../control-plane/types";
import { controlPlane } from "../control-plane/client";
import { formatMoment } from "../control-plane/view-model";
import { Page } from "../features/control-plane/page";

const HostsPage = createComponent({
  displayName: "HostsPage",
  deps: Effect.gen(function* () {
    return { store: yield* controlPlane.store };
  }),
  state: ({ deps }) =>
    Effect.succeed({
      hosts: useStore(deps.store, (state) => state.hosts),
    }),
  ui: ({ state }) => (
    <Page
      description="Execution machines enrolled with the control plane."
      title="Hosts"
    >
      <HostsContent hosts={state.hosts} />
    </Page>
  ),
});

export const Route = createFileRoute("/_app/hosts")({
  component: HostsPage,
});

function HostsContent({ hosts }: { hosts: Host[] }) {
  if (hosts.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex min-h-56 flex-col items-center justify-center text-center">
          <Server className="text-muted-foreground mb-4 size-6" />
          <p className="text-sm font-medium">No hosts enrolled</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Runs will remain queued until a worker connects.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {hosts.map((host) => (
        <Card key={host.id}>
          <CardHeader className="flex-row items-start justify-between">
            <div>
              <CardTitle className="text-base">{host.name}</CardTitle>
              <p className="text-muted-foreground mt-1 font-mono text-[11px]">
                {host.id}
              </p>
            </div>
            <Badge className="gap-1.5 font-normal" variant="outline">
              <span
                className={cn(
                  "size-1.5 rounded-full bg-current",
                  host.health === "ready"
                    ? "text-success"
                    : host.health === "busy"
                      ? "text-warning"
                      : "text-muted-foreground",
                )}
              />
              {host.health}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="text-muted-foreground flex items-center gap-2 text-xs">
              <Cpu className="size-4" />
              Seen {formatMoment(host.lastSeenAt)}
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {host.capabilities.map((capability) => (
                <Badge key={capability} variant="secondary">
                  {capability}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
