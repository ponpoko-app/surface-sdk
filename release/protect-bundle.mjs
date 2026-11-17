import { createRequire } from "node:module";
import { writeFile } from "node:fs/promises";

const {protectBundle} = createRequire(import.meta.url)("./protection.cjs");
const [input,output,report] = process.argv.slice(2);
if (!input || !output || !report || process.argv.length !== 5) throw new Error("Usage: node release/protect-bundle.mjs <built-bundle> <new-output> <new-report.json>");
try {
  const result = await protectBundle(input,output);
  await writeFile(report,JSON.stringify(result),{flag:"wx"});
  process.stdout.write("Protected release bundle prepared\n");
} catch (error) {
  process.stderr.write(`Release protection failed: ${error.message}\n`);
  process.exitCode = 1;
}
