import { createComponent } from "@code/effect-react";

import { newRunFormState } from "./new-run-form-state";

createComponent({
  // @ts-expect-error raw state still requires all tagged services
  state: newRunFormState,
  component: () => null,
});
