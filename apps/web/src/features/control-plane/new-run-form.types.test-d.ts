import { Component } from "@code/effect-react";

import { newRunFormFactory } from "./new-run-form";

// @ts-expect-error the raw factory still requires both tagged services
Component.mount(newRunFormFactory, { onFailure: () => null });
