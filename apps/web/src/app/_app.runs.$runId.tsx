import { createElement } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Effect } from "effect";
import { ArrowLeft } from "lucide-react";

import { createComponent, useStoreSelector } from "@night-shift/effect-react";
import { Button } from "@night-shift/ui-web/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@night-shift/ui-web/components/card";
import { Skeleton } from "@night-shift/ui-web/components/skeleton";

import { controlPlane } from "../control-plane/client";
import { Page } from "../features/control-plane/page";
import { RunDetail } from "../features/control-plane/run-detail";
import { QuickLink } from "../features/quick-link/quick-link";

const RunPage = createComponent({
  displayName: "RunPage",
  deps: Effect.gen(function* () {
    return { store: yield* controlPlane.service };
  }),
  state: ({
    deps,
    props,
  }: {
    deps: { store: Effect.Effect.Success<typeof controlPlane.service> };
    props: { runId: string };
  }) =>
    Effect.succeed({
      authority: useStoreSelector(deps.store, (state) => state.authority),
      commandRun: useStoreSelector(deps.store, (state) => state.commandRun),
      run: useStoreSelector(deps.store, (state) =>
        state.runs.find((candidate) => candidate.id === props.runId),
      ),
    }),
  ui: ({ state }) => {
    const run = state.run;
    if (!run) {
      if (state.authority !== "connected") {
        return (
          <div className="mx-auto grid w-full max-w-6xl gap-5 px-5 py-8 md:px-8 md:py-10 lg:grid-cols-[minmax(0,1fr)_19rem]">
            <Skeleton className="h-72 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        );
      }

      return (
        <Page title="Run not found">
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="text-sm">
                This run is not available.
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button asChild size="sm" variant="outline">
                <QuickLink to="/runs">
                  <ArrowLeft />
                  Back to runs
                </QuickLink>
              </Button>
            </CardContent>
          </Card>
        </Page>
      );
    }

    return (
      <div className="mx-auto w-full max-w-6xl px-5 py-8 md:px-8 md:py-10">
        <RunDetail
          onCommand={(command) => state.commandRun(run.id, command)}
          run={run}
        />
      </div>
    );
  },
});

export const Route = createFileRoute("/_app/runs/$runId")({
  component: RunRoute,
});

function RunRoute() {
  return createElement(RunPage, Route.useParams());
}
