#!/usr/bin/env node
import { runCheck } from "../scripts/check-surface.mjs";

const usage = "Usage: ponpoko-surface check <bundle> [--host-hello <captured-json>]";
const [command, ...args] = process.argv.slice(2);
if (command === "--help" || command === "check" && args.length === 1 && args[0] === "--help") console.log(usage);
else if (command === "check") await runCheck(args, usage);
else {
  console.error(usage);
  process.exitCode = 1;
}
