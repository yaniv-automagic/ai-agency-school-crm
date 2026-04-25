import express from "express";
import cors from "cors";
import cron from "node-cron";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { processAutomationQueue } from "./engine/processor.js";
import { processScheduledAutomations } from "./engine/scheduled.js";
import { webhookRouter } from "./routes/webhooks.js";
import { healthRouter } from "./routes/health.js";
import { contractRouter } from "./routes/contracts.js";
import { googleCalendarRouter } from "./routes/google-calendar.js";
import { usersRouter } from "./routes/users.js";
import { zoomRouter } from "./routes/zoom.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.set("trust proxy", true);
app.use(cors());
app.use(express.json({ limit: "5mb" }));

// Serve tracking script
const __dirname = dirname(fileURLToPath(import.meta.url));
app.get("/crm-tracker.js", (_req, res) => {
  try {
    const script = readFileSync(resolve(__dirname, "../../public/crm-tracker.js"), "utf-8");
    res.setHeader("Content-Type", "application/javascript");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(script);
  } catch {
    res.status(404).send("// tracker not found");
  }
});

// Routes
app.use("/api", healthRouter);
app.use("/api/webhooks", webhookRouter);
app.use("/api/contracts", contractRouter);
app.use("/api/integrations/google-calendar", googleCalendarRouter);
app.use("/api/users", usersRouter);
app.use("/api/zoom", zoomRouter);

// ── Automation Queue Processor ──
// Polls crm_automation_queue every 30 seconds for new events
cron.schedule("*/30 * * * * *", async () => {
  try {
    await processAutomationQueue();
  } catch (err) {
    console.error("[Automation Queue] Error:", err);
  }
});

// ── Scheduled Automations ──
// Checks for time-based automations every minute
cron.schedule("* * * * *", async () => {
  try {
    await processScheduledAutomations();
  } catch (err) {
    console.error("[Scheduled Automations] Error:", err);
  }
});

app.listen(PORT, () => {
  console.log(`[CRM Backend] Running on port ${PORT}`);
  console.log(`[CRM Backend] Automation queue: polling every 30s`);
  console.log(`[CRM Backend] Scheduled automations: checking every 1m`);
});
