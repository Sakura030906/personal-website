import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const python = existsSync("backend/.venv/bin/python") ? ".venv/bin/python" : "python3";
const result = spawnSync(python, ["-m", "pytest", "tests"], {
  cwd: "backend",
  stdio: "inherit",
  env: {
    ...process.env,
    PYTHONDONTWRITEBYTECODE: "1",
  },
});
process.exit(result.status ?? 1);
