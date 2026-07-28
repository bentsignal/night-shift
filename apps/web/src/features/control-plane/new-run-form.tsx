import { useNavigate } from "@tanstack/react-router";
import { Effect } from "effect";

import { createComponent } from "@code/effect-react";
import { Card, CardFooter } from "@code/ui-web/components/card";

import { useControlPlaneClient } from "../../control-plane/client";
import { NewRunFormFields, QueueButton } from "./new-run-form-fields";
import {
  createExecutionPreferencesStore,
  NewRunControlPlane,
  newRunFormState,
  NewRunNavigation,
  NewRunPreferences,
} from "./new-run-form-state";

export const NewRunForm = createComponent({
  displayName: "NewRunForm",
  state: newRunFormState.pipe(
    Effect.provideService(NewRunControlPlane, useControlPlaneClient),
    Effect.provideService(NewRunPreferences, createExecutionPreferencesStore),
    Effect.provideService(NewRunNavigation, useNavigate),
  ),
  component: (state) => (
    <form action={(formData) => void state.submit(formData)}>
      <Card>
        <NewRunFormFields {...state} />
        <CardFooter className="bg-muted/20 justify-between border-t">
          <div className="text-muted-foreground min-w-0 text-xs">
            {state.capacityLabel}
            <SubmissionError error={state.error} />
          </div>
          <QueueButton submitting={state.submitting} />
        </CardFooter>
      </Card>
    </form>
  ),
});

function SubmissionError({ error }: { error?: string }) {
  if (!error) return null;
  return <span className="text-destructive mt-1 block">{error}</span>;
}
