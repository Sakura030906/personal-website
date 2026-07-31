import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const workflowDirectory = path.resolve(".github/workflows");
const workflowNames = (await readdir(workflowDirectory)).filter((name) =>
  /\.ya?ml$/i.test(name),
);

if (!workflowNames.length) {
  throw new Error("No GitHub Actions workflows were found.");
}

const forbiddenPatterns = [
  ["pull_request_target", /\bpull_request_target\s*:/],
  ["unverified SSH host keys", /\bssh-keyscan\b|StrictHostKeyChecking=no/],
  ["mutable latest action references", /^\s*uses:\s+\S+@(main|master|latest)\s*$/m],
];

for (const workflowName of workflowNames) {
  const workflowPath = path.join(workflowDirectory, workflowName);
  const source = await readFile(workflowPath, "utf8");

  for (const [label, pattern] of forbiddenPatterns) {
    if (pattern.test(source)) {
      throw new Error(`${workflowName} contains ${label}.`);
    }
  }

  for (const match of source.matchAll(/^\s*uses:\s+([^#\s]+)(?:\s+#.*)?$/gm)) {
    const reference = match[1];
    if (reference.startsWith("./")) continue;
    const separator = reference.lastIndexOf("@");
    const revision = separator >= 0 ? reference.slice(separator + 1) : "";
    if (!/^[a-f0-9]{40}$/.test(revision)) {
      throw new Error(
        `${workflowName} must pin ${reference} to a full commit SHA.`,
      );
    }
  }
}

const releaseWorkflow = await readFile(
  path.join(workflowDirectory, "release.yml"),
  "utf8",
);
const requiredReleaseMarkers = [
  "workflow_dispatch:",
  "environment:",
  "name: production",
  "confirmation:",
  '"DEPLOY"',
  "release.sh",
  "SERVER_SSH_KNOWN_HOSTS",
  "tailscale/github-action@",
  "aquasecurity/trivy-action@",
];

for (const marker of requiredReleaseMarkers) {
  if (!releaseWorkflow.includes(marker)) {
    throw new Error(`release.yml is missing required marker: ${marker}`);
  }
}

console.log(`Workflow policy check passed (${workflowNames.length} workflows).`);
