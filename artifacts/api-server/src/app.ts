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

// Serve bountypilot static assets (JS, CSS, images, etc.)
app.use(express.static(frontendDist));

// SPA catch-all: any non-API path gets index.html so React/Wouter handles routing
app.get(/(.*)/, (_req, res) => {
  res.sendFile(resolve(frontendDist, "index.html"));
});

export default app;
