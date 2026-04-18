import express from "express";
import cors from "cors";
import { whatsappRouter } from "./routes/whatsapp.js";
import { campaignRouter } from "./routes/campaigns.js";
import { formRouter } from "./routes/forms.js";
import { integrationRouter } from "./routes/integrations.js";
import { webhookRouter } from "./routes/webhooks.js";

const app = express();
const PORT = parseInt(process.env.PORT || "3001");

// CORS - allow frontend
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
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
