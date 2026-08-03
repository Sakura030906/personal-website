import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(entryPath)));
    else if (entry.isFile() && entry.name.endsWith(".sh")) files.push(entryPath);
  }
  return files;
}

const shellFiles = [
  ...(await listFiles(path.resolve("ops"))),
  ...(await listFiles(path.resolve("scripts"))),
];

for (const file of shellFiles) {
  const source = await readFile(file, "utf8");
  if (!source.startsWith("#!/bin/sh")) continue;

  const forbidden = [
    ["Bash [[ test syntax", /(^|[;&|]\s*)\[\[/m],
    ["Bash function keyword", /^\s*function\s+\w+/m],
    ["Bash arrays", /^\s*\w+=\([^)]*\)/m],
  ];
  for (const [label, pattern] of forbidden) {
    if (pattern.test(source)) {
      throw new Error(`${path.relative(process.cwd(), file)} uses ${label} with #!/bin/sh.`);
    }
  }
}

console.log(`Shell compatibility check passed (${shellFiles.length} scripts).`);
