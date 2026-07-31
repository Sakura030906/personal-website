import { readFile } from "node:fs/promises";

const expectedUsers = new Map([
  ["backend/Dockerfile", "app"],
  ["ops/backup/Dockerfile", "backupsvc"],
  ["ops/web/Dockerfile", "nginx"],
]);

for (const [dockerfile, expectedUser] of expectedUsers) {
  const source = await readFile(dockerfile, "utf8");
  const users = [...source.matchAll(/^\s*USER\s+([^\s#]+)/gim)].map(
    (match) => match[1],
  );
  const finalUser = users.at(-1);

  if (finalUser !== expectedUser) {
    throw new Error(
      `${dockerfile} must finish with USER ${expectedUser}; found ${finalUser ?? "none"}.`,
    );
  }
}

const releaseScript = await readFile("ops/deploy/release.sh", "utf8");
for (const ownership of ["10001:10001", "10002:10002"]) {
  if (!releaseScript.includes(ownership)) {
    throw new Error(
      `ops/deploy/release.sh is missing volume ownership migration ${ownership}.`,
    );
  }
}

console.log("Container security policy check passed (3 images).");
