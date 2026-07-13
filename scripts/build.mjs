import { cp, mkdir, rm } from "node:fs/promises";

const outputDir = new URL("../dist/", import.meta.url);
const rootDir = new URL("../", import.meta.url);

const entries = [
  "index.html",
  "styles.css",
  "script.js",
  "assets",
  ".openai",
];

await rm(outputDir, { force: true, recursive: true });
await mkdir(outputDir, { recursive: true });

for (const entry of entries) {
  await cp(new URL(entry, rootDir), new URL(entry, outputDir), {
    recursive: true,
  });
}
