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

const server = http.createServer((req, res) => {
    if (req.url) {
      const url = new URL(req.url, `http://${hostname}:${port}`);
      if (url.pathname === "/workflows/share.html") {
        url.pathname = "/workflows/share";
        req.url = `${url.pathname}${url.search}`;
      }
    }

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
