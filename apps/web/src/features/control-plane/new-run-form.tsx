import { createComponent } from "@night-shift/effect-react";
import { Card, CardFooter } from "@night-shift/ui-web/components/card";

import { controlPlane } from "../../control-plane/client";
import { NewRunFormFields, QueueButton } from "./new-run-form-fields";
import { useNewRunFormState } from "./new-run-form-state";

export const NewRunForm = createComponent({
  displayName: "NewRunForm",
  deps: [controlPlane.store],
  state: useNewRunFormState,
  ui: ({ state }) => (
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
