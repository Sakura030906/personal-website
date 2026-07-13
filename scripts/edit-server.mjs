import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const port = Number(process.env.PORT || 4180);
const rootDir = new URL("../", import.meta.url);
const adminDir = new URL("../admin/", import.meta.url);
const contentFile = new URL("../data/site.json", import.meta.url);

const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
};

function send(res, status, body, type = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "content-type": type,
    "cache-control": "no-store",
  });
  res.end(body);
}

async function readRequestBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function serveFile(res, baseUrl, pathname) {
  const relativePath = pathname.replace(/^\/+/, "") || "index.html";
  const normalized = normalize(relativePath);
  if (normalized.startsWith("..")) {
    send(res, 403, "Forbidden");
    return;
  }

  const file = new URL(normalized, baseUrl);
  const body = await readFile(file);
  send(res, 200, body, types[extname(file.pathname)] || "application/octet-stream");
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/api/content") {
      send(res, 200, await readFile(contentFile, "utf8"), types[".json"]);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/content") {
      const payload = JSON.parse(await readRequestBody(req));
      await writeFile(contentFile, `${JSON.stringify(payload, null, 2)}\n`);
      send(res, 200, JSON.stringify({ ok: true }), types[".json"]);
      return;
    }

    if (req.method !== "GET") {
      send(res, 405, "Method Not Allowed");
      return;
    }

    if (url.pathname === "/" || url.pathname === "/edit") {
      await serveFile(res, adminDir, "index.html");
      return;
    }

    if (url.pathname.startsWith("/admin/")) {
      await serveFile(res, rootDir, url.pathname);
      return;
    }

    if (url.pathname.startsWith("/assets/")) {
      await serveFile(res, rootDir, url.pathname);
      return;
    }

    send(res, 404, "Not Found");
  } catch (error) {
    send(res, 500, error instanceof Error ? error.message : "Internal Server Error");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Local editor: http://127.0.0.1:${port}`);
});
