/**
 * Contract routes — proxies to automation backend for PDF generation and signing.
 * The automation backend handles the heavy lifting (Puppeteer PDF, hashing, signing ceremony).
 * This route provides the frontend-facing API that forwards requests.
 */

import { Router, Request, Response } from "express";
import { authMiddleware } from "../middleware/auth.js";

export const contractRouter = Router();

const AUTOMATION_BACKEND = process.env.AUTOMATION_BACKEND_URL || "https://crm-automation-backend.onrender.com";

// ── Proxy contract send to automation backend ──
contractRouter.post("/:id/send", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const response = await fetch(`${AUTOMATION_BACKEND}/api/contracts/${id}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    res.json(data);
  } catch (err: any) {
    console.error("[Contracts Proxy] Error:", err);
    res.status(500).json({ error: err.message || "שגיאה בשליחת החוזה" });
  }
});

// ── Proxy audit log ──
contractRouter.get("/:id/audit-log", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const response = await fetch(`${AUTOMATION_BACKEND}/api/contracts/${id}/audit-log`);
    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    res.json(data);
  } catch (err: any) {
    console.error("[Contracts Proxy] Error:", err);
    res.status(500).json({ error: err.message });
  }
});
