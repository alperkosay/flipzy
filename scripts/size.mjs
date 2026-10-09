// Prints the gzip size of each build output and fails above the budget.
import { readFileSync, readdirSync } from "node:fs";
import { gzipSync } from "node:zlib";

const BUDGET_BYTES = 10 * 1024;
let failed = false;
for (const file of readdirSync("dist").filter((f) => /\.(c?js)$/.test(f))) {
  const size = gzipSync(readFileSync(`dist/${file}`)).length;
  const ok = size <= BUDGET_BYTES;
  failed ||= !ok;
  console.log(`${ok ? "ok  " : "FAIL"} dist/${file}: ${(size / 1024).toFixed(2)} kB gzip (budget ${BUDGET_BYTES / 1024} kB)`);
}
process.exit(failed ? 1 : 0);
