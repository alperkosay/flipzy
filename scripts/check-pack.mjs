// Fails if the npm tarball would contain anything besides the allowed files,
// or if the build output contains patterns that suggest secrets or unsafe code.
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const ALLOWED = [/^package\.json$/, /^README\.md$/, /^LICENSE$/, /^CHANGELOG\.md$/, /^dist\/index\.(js|cjs|d\.ts|d\.cts)$/, /^dist\/styles\.css$/];
const FORBIDDEN_CONTENT = [
  { name: "innerHTML", re: /\.(inner|outer)HTML\b/ },
  { name: "dangerouslySetInnerHTML", re: /dangerouslySetInnerHTML/ },
  { name: "eval", re: /\beval\s*\(/ },
  { name: "new Function", re: /new\s+Function\s*\(/ },
  { name: "npm token", re: /npm_[A-Za-z0-9]{36}/ },
  { name: "GitHub token", re: /gh[pousr]_[A-Za-z0-9]{36}/ },
  { name: "private key", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
];

const [pack] = JSON.parse(execSync("npm pack --dry-run --json --ignore-scripts", { encoding: "utf8" }));
const problems = [];
for (const { path } of pack.files) {
  if (!ALLOWED.some((re) => re.test(path))) problems.push(`unexpected file in package: ${path}`);
  if (path.startsWith("dist/")) {
    const text = readFileSync(path, "utf8");
    for (const { name, re } of FORBIDDEN_CONTENT) if (re.test(text)) problems.push(`${path} contains ${name}`);
  }
}
if (!pack.files.some((f) => f.path === "dist/index.js")) problems.push("dist/index.js missing: run npm run build first");

console.log(`${pack.name}@${pack.version}: ${pack.files.length} files, ${(pack.size / 1024).toFixed(1)} kB packed`);
for (const f of pack.files) console.log(`  ${f.path}`);
if (problems.length) {
  console.error(problems.map((p) => `FAIL ${p}`).join("\n"));
  process.exit(1);
}
console.log("ok   package contents look safe");
