import express from "express";
import cors from "cors";
import cron from "node-cron";
import { processAutomationQueue } from "./engine/processor.js";
import { processScheduledAutomations } from "./engine/scheduled.js";
import { webhookRouter } from "./routes/webhooks.js";
import { healthRouter } from "./routes/health.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: "5mb" }));

// Routes
app.use("/api", healthRouter);
app.use("/api/webhooks", webhookRouter);

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
