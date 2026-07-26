import { createFileRoute } from "@tanstack/react-router";
import { Cpu, Server } from "lucide-react";

import { Badge } from "@code/ui-web/components/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@code/ui-web/components/card";
import { cn } from "@code/ui-web/lib/utils";

import { useControlPlane } from "../control-plane/client";
import { formatMoment } from "../control-plane/view-model";
import { Page } from "../features/control-plane/page";

export const Route = createFileRoute("/_app/hosts")({
  component: HostsPage,
});

function HostsPage() {
  const { snapshot } = useControlPlane();

  return (
    <Page
      description="Execution machines enrolled with the control plane."
      title="Hosts"
    >
      {snapshot.hosts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex min-h-56 flex-col items-center justify-center text-center">
            <Server className="text-muted-foreground mb-4 size-6" />
            <p className="text-sm font-medium">No hosts enrolled</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Runs will remain queued until a worker connects.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {snapshot.hosts.map((host) => (
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
      )}
    </Page>
  );
}
