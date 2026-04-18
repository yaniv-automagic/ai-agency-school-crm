import { Router } from "express";
import { supabase } from "../lib/supabase.js";

export const healthRouter = Router();

healthRouter.get("/health", async (_req, res) => {
  try {
    const { count } = await supabase
      .from("crm_automations")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true);

    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      activeAutomations: count || 0,
    });
  } catch (err: any) {
    res.status(500).json({ status: "error", message: err.message });
  }
});
