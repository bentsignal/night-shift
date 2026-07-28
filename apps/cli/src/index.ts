#!/usr/bin/env node

const command = process.argv[2] ?? "help";

if (command === "status") {
  console.log(
    "night shift control plane CLI is installed; no host is connected yet.",
  );
} else {
  console.log(`night shift control plane

Usage:
  night-shift status   Show local client status
`);
}
