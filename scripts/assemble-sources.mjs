import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  adminScripts,
  adminStyles,
  siteScripts,
  siteStyles,
} from "./source-manifest.mjs";

const rootDir = new URL("../", import.meta.url);
const generatedNotice = (kind) => `/* GENERATED ${kind}. Edit files under src/ and run npm run build. */\n`;

export async function readSources(paths) {
  const sources = await Promise.all(
    paths.map((path) => readFile(new URL(path, rootDir), "utf8")),
  );
  return sources.join("");
}

export async function assembleSources() {
  const [siteScript, adminScript, siteStyle, adminStyle] = await Promise.all([
    readSources(siteScripts),
    readSources(adminScripts),
    readSources(siteStyles),
    readSources(adminStyles),
  ]);

  await Promise.all([
    writeFile(new URL("script.js", rootDir), `${generatedNotice("SITE SCRIPT")}${siteScript}`),
    writeFile(new URL("admin/admin.js", rootDir), `${generatedNotice("ADMIN SCRIPT")}${adminScript}`),
    writeFile(new URL("styles.css", rootDir), `${generatedNotice("SITE STYLES")}${siteStyle}`),
    writeFile(new URL("admin/admin.css", rootDir), `${generatedNotice("ADMIN STYLES")}${adminStyle}`),
  ]);

  return { siteScript };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await assembleSources();
}
