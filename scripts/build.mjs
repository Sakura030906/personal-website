import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const outputDir = new URL("../dist/", import.meta.url);
const rootDir = new URL("../", import.meta.url);

await build({
  entryPoints: [fileURLToPath(new URL("script.js", rootDir))],
  outfile: fileURLToPath(new URL("app.bundle.js", rootDir)),
  bundle: true,
  format: "iife",
  minify: true,
  target: ["es2020"],
  legalComments: "none",
});

const entries = [
  "index.html",
  "styles.css",
  "app.bundle.js",
  "assets",
  "data",
  "feed.xml",
  "sitemap.xml",
  "robots.txt",
  ".openai",
];

await rm(outputDir, { force: true, recursive: true });
await mkdir(outputDir, { recursive: true });

const siteData = JSON.parse(await readFile(new URL("data/site.json", rootDir), "utf8"));
const siteOrigin = "https://sakura000702.me";
const posts = (siteData.posts || []).filter((post) => post.status !== "draft");

function xmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function normalizeSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

const feed = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
  <channel>
    <title>${xmlEscape(siteData.profile?.name || "晏宏翔")}的技术文章</title>
    <link>${siteOrigin}/</link>
    <description>${xmlEscape(siteData.profile?.summary || "")}</description>
    <language>zh-CN</language>
    ${posts
      .map((post, index) => {
        const slug = post.slug || normalizeSlug(post.title) || `post-${index + 1}`;
        return `<item>
      <title>${xmlEscape(post.title)}</title>
      <link>${siteOrigin}/#post-${xmlEscape(slug)}</link>
      <guid>${siteOrigin}/#post-${xmlEscape(slug)}</guid>
      <pubDate>${post.date ? new Date(`${post.date}T00:00:00+08:00`).toUTCString() : new Date().toUTCString()}</pubDate>
      <description>${xmlEscape(post.summary || "")}</description>
    </item>`;
      })
      .join("\n    ")}
  </channel>
</rss>
`;

const sitemapUrls = [
  `${siteOrigin}/`,
  `${siteOrigin}/#projects`,
  `${siteOrigin}/#posts`,
  `${siteOrigin}/#knowledge`,
  `${siteOrigin}/#graph`,
  `${siteOrigin}/#now`,
  `${siteOrigin}/#building`,
  `${siteOrigin}/#changelog`,
  `${siteOrigin}/#lab`,
  `${siteOrigin}/#about`,
  ...posts.map((post, index) => `${siteOrigin}/#post-${post.slug || normalizeSlug(post.title) || `post-${index + 1}`}`),
];

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls.map((url) => `  <url><loc>${xmlEscape(url)}</loc></url>`).join("\n")}
</urlset>
`;

await writeFile(new URL("feed.xml", rootDir), feed);
await writeFile(new URL("sitemap.xml", rootDir), sitemap);
await writeFile(new URL("robots.txt", rootDir), `User-agent: *\nAllow: /\nSitemap: ${siteOrigin}/sitemap.xml\n`);

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
  "/app.bundle.js": {
    body: await readFile(new URL("app.bundle.js", rootDir), "utf8"),
    type: "text/javascript; charset=utf-8",
  },
  "/data/site.json": {
    body: await readFile(new URL("data/site.json", rootDir), "utf8"),
    type: "application/json; charset=utf-8",
  },
  "/feed.xml": {
    body: await readFile(new URL("feed.xml", rootDir), "utf8"),
    type: "application/rss+xml; charset=utf-8",
  },
  "/sitemap.xml": {
    body: await readFile(new URL("sitemap.xml", rootDir), "utf8"),
    type: "application/xml; charset=utf-8",
  },
  "/robots.txt": {
    body: await readFile(new URL("robots.txt", rootDir), "utf8"),
    type: "text/plain; charset=utf-8",
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
      "cache-control": type.startsWith("text/") || type.startsWith("application/json")
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

    if (pathname.includes(".")) {
      return response("Not Found", "text/plain; charset=utf-8", { status: 404 });
    }

    return response(textAssets["/"].body, textAssets["/"].type, { status: 200 });
  }
};
`;

await writeFile(new URL("server/index.js", outputDir), serverSource);
