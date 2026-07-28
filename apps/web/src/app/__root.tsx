import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";

import { productDescription, productName } from "@night-shift/config/product";

import appStyles from "./styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    links: [{ rel: "stylesheet", href: appStyles }],
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: productName },
      { name: "description", content: productDescription },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <html className="dark" lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="min-h-svh overflow-hidden">
        <Outlet />
        <Scripts />
      </body>
    </html>
  );
}
