import http from "node:http";
import next from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchEditorMiddleware } from "@react-dev-inspector/middleware";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = Number(process.env.PORT || 3000);
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const app = next({ dev, hostname, port, dir: projectRoot, webpack: true });
const handle = app.getRequestHandler();

await app.prepare();

function normalizeHtmlAppUrl(req) {
  if (!req.url) return;

  const url = new URL(req.url, `http://${hostname}:${port}`);
  const { pathname } = url;

  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/public/") ||
    pathname.startsWith("/static/")
  ) {
    return;
  }

  if (pathname === "/index.html") {
    url.pathname = "/";
  } else if (pathname.endsWith(".html")) {
    url.pathname = pathname.slice(0, -".html".length);
  } else {
    return;
  }

  req.url = `${url.pathname}${url.search}`;
}

const server = http.createServer((req, res) => {
    if (dev) normalizeHtmlAppUrl(req);

    if (dev) {
      launchEditorMiddleware(req, res, () => handle(req, res));
      return;
    }

    handle(req, res);
  });

if (dev) {
  server.on("upgrade", app.getUpgradeHandler());
}

server.listen(port, hostname, () => {
  console.log(`> Ready on http://${hostname}:${port}`);
});
