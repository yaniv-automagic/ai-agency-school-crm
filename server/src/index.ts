import express from "express";
import cors from "cors";
import { whatsappRouter } from "./routes/whatsapp.js";
import { campaignRouter } from "./routes/campaigns.js";
import { formRouter } from "./routes/forms.js";
import { integrationRouter } from "./routes/integrations.js";
import { webhookRouter } from "./routes/webhooks.js";

const app = express();
const PORT = parseInt(process.env.PORT || "3001");

// CORS - allow frontend (multiple origins for dev)
app.use(cors({
  origin: (origin, callback) => {
    const allowed = (process.env.FRONTEND_URL || "http://localhost:5173").split(",");
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin || allowed.some(u => origin.startsWith(u.trim())) || origin.match(/^http:\/\/localhost:\d+$/)) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all for now, tighten in production
    }
  },
  credentials: true,
}));

app.use(express.json({ limit: "10mb" }));

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Routes
app.use("/api/whatsapp", whatsappRouter);
app.use("/api/campaigns", campaignRouter);
app.use("/api/forms", formRouter);
app.use("/api/integrations", integrationRouter);
app.use("/api/webhooks", webhookRouter);

app.listen(PORT, () => {
  console.log(`CRM Backend running on port ${PORT}`);
});
