import { createServer } from "http";
import { readFile, stat } from "fs/promises";
import { join, extname } from "path";
import { fileURLToPath } from "url";

const PORT = process.env.PORT || 3000;
const distDir = join(fileURLToPath(import.meta.url), "../dist/public");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

async function serveFile(filePath, res) {
  const ext = extname(filePath).toLowerCase();
  const type = MIME[ext] || "application/octet-stream";
  const data = await readFile(filePath);
  res.writeHead(200, {
    "Content-Type": type,
    "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=31536000, immutable",
  });
  res.end(data);
}

const server = createServer(async (req, res) => {
  const url = (req.url || "/").split("?")[0];
  const filePath = join(distDir, url);

  try {
    const s = await stat(filePath);
    if (s.isDirectory()) {
      await serveFile(join(filePath, "index.html"), res);
    } else {
      await serveFile(filePath, res);
    }
  } catch {
    // SPA fallback — serve index.html for every unknown path
    try {
      await serveFile(join(distDir, "index.html"), res);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
    }
  }
});

server.listen(Number(PORT), "0.0.0.0", () => {
  console.log(`BountyPilot serving on port ${PORT}`);
});
