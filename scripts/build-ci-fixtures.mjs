import { readFileSync, writeFileSync } from "node:fs";
import { ciFixture } from "../ci-contract.mjs";

const target = new URL("../fixtures/ci-plan.json", import.meta.url);
const check = process.argv.includes("--check");
const body = `${JSON.stringify(ciFixture(), null, 2)}\n`;

if (check) {
  const existing = readFileSync(target, "utf8");
  if (existing !== body) {
    console.error("surface_ci_fixture_drift: regenerate fixtures/ci-plan.json");
    process.exit(1);
  }
  console.log("CI fixture matches the canonical templates");
} else {
  writeFileSync(target, body);
  console.log(`CI fixture written: ${Object.keys(JSON.parse(body).plans).length} variant plans`);
}
