import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import router from "./routes";
import { logger } from "./lib/logger";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Path to the built bountypilot frontend (dist/public relative to compiled output)
const frontendDist = resolve(__dirname, "../../bountypilot/dist/public");

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes first
app.use("/api", router);

// Serve bountypilot static assets (JS, CSS, images — hashed filenames, long cache)
app.use(express.static(frontendDist, { maxAge: "1y", index: false }));

// SPA catch-all: serve index.html with no-cache so users always get the latest build
app.get("/{*any}", (_req, res) => {
  res.set("Cache-Control", "no-cache, no-store, must-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  res.sendFile(resolve(frontendDist, "index.html"));
});

export default app;
