#!/usr/bin/env node

const command = process.argv[2] ?? "help";

if (command === "status") {
  console.log("Code control plane CLI is installed; no host is connected yet.");
} else {
  console.log(`Code control plane

Usage:
  code-control status   Show local client status
`);
}
