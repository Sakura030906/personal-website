import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";

const outputDir = new URL("../dist/", import.meta.url);
const rootDir = new URL("../", import.meta.url);

const entries = [
  "index.html",
  "styles.css",
  "script.js",
  "assets",
  "data",
  ".openai",
];

await rm(outputDir, { force: true, recursive: true });
await mkdir(outputDir, { recursive: true });

for (const entry of entries) {
  await cp(new URL(entry, rootDir), new URL(entry, outputDir), {
    recursive: true,
  });
}

await mkdir(new URL("server/", outputDir), { recursive: true });

const textAssets = {
  "/": {
    body: await readFile(new URL("index.html", rootDir), "utf8"),
    type: "text/html; charset=utf-8",
  },
  "/index.html": {
    body: await readFile(new URL("index.html", rootDir), "utf8"),
    type: "text/html; charset=utf-8",
  },
  "/styles.css": {
    body: await readFile(new URL("styles.css", rootDir), "utf8"),
    type: "text/css; charset=utf-8",
  },
  "/script.js": {
    body: await readFile(new URL("script.js", rootDir), "utf8"),
    type: "text/javascript; charset=utf-8",
  },
  "/data/site.json": {
    body: await readFile(new URL("data/site.json", rootDir), "utf8"),
    type: "application/json; charset=utf-8",
  },
};

const imageAsset = {
  body: (await readFile(new URL("assets/hero-workspace.png", rootDir))).toString("base64"),
  type: "image/png",
};

const serverSource = `const textAssets = ${JSON.stringify(textAssets, null, 2)};
const imageAssets = {
  "/assets/hero-workspace.png": ${JSON.stringify(imageAsset, null, 2)}
};

function response(body, type, init = {}) {
  return new Response(body, {
    ...init,
    headers: {
      "content-type": type,
      "cache-control": type.startsWith("text/html")
        ? "public, max-age=0, must-revalidate"
        : "public, max-age=31536000, immutable",
      ...(init.headers || {})
    }
  });
}

function decodeBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const pathname = url.pathname.endsWith("/") && url.pathname !== "/" ? url.pathname.slice(0, -1) : url.pathname;

    if (textAssets[pathname]) {
      const asset = textAssets[pathname];
      return response(asset.body, asset.type);
    }

    if (imageAssets[pathname]) {
      const asset = imageAssets[pathname];
      return response(decodeBase64(asset.body), asset.type);
    }

    return response(textAssets["/"].body, textAssets["/"].type, { status: 200 });
  }
};
`;

await writeFile(new URL("server/index.js", outputDir), serverSource);
