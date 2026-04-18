import { supabase } from "../lib/supabase.js";
import { evaluateConditions } from "./conditions.js";
import { executeAction } from "./actions.js";

/**
 * Process scheduled and relative-time automations.
 * Runs every minute via cron.
 */
export async function processScheduledAutomations() {
  // Fetch active scheduled automations
  const { data: automations } = await supabase
    .from("crm_automations")
    .select("*")
    .in("trigger_type", ["scheduled", "relative_time"])
    .eq("is_active", true);

  if (!automations?.length) return;

  const now = new Date();

  for (const auto of automations) {
    try {
      if (auto.trigger_type === "scheduled") {
        await processScheduled(auto, now);
      } else if (auto.trigger_type === "relative_time") {
        await processRelativeTime(auto, now);
      }
    } catch (err) {
      console.error(`[Scheduled] Error in "${auto.name}":`, err);
    }
  }
}

async function processScheduled(auto: any, now: Date) {
  const config = auto.trigger_config || {};
  const frequency = config.frequency || "daily";
  const timeStr = config.time || "09:00";
  const [hours, minutes] = timeStr.split(":").map(Number);

  // Check if it's time to run
  if (now.getHours() !== hours || now.getMinutes() !== minutes) return;

  // Check frequency
  if (frequency === "weekly") {
    const scheduledDay = config.day_of_week || 0; // 0=Sunday
    if (now.getDay() !== scheduledDay) return;
  } else if (frequency === "monthly") {
    const scheduledDate = config.day_of_month || 1;
    if (now.getDate() !== scheduledDate) return;
  }

  // Check if already ran this minute (prevent double execution)
  if (auto.last_run_at) {
    const lastRun = new Date(auto.last_run_at);
    if (
      lastRun.getFullYear() === now.getFullYear() &&
      lastRun.getMonth() === now.getMonth() &&
      lastRun.getDate() === now.getDate() &&
      lastRun.getHours() === now.getHours() &&
      lastRun.getMinutes() === now.getMinutes()
    ) {
      return; // Already ran this minute
    }
  }

  console.log(`[Scheduled] Running "${auto.name}" (${frequency})`);

  // Fetch records to process (e.g., all contacts matching filters)
  const objectType = config.object_type || "contacts";
  const table = `crm_${objectType}`;
  const { data: records } = await supabase.from(table).select("*").limit(500);

  if (!records?.length) return;

  let processed = 0;
  for (const record of records) {
    const conditionsMet = evaluateConditions(auto.conditions, record);
    if (!conditionsMet) continue;

    for (const action of auto.actions) {
      try {
        await executeAction(action, record, {
          record_id: record.id,
          record_type: objectType,
          new_data: record,
        });
      } catch (err: any) {
        console.error(`[Scheduled] Action failed for record ${record.id}:`, err.message);
      }
    }
    processed++;
  }

  // Update stats
  await supabase
    .from("crm_automations")
    .update({
      run_count: auto.run_count + 1,
      last_run_at: now.toISOString(),
    })
    .eq("id", auto.id);

  // Log
  await supabase.from("crm_automation_logs").insert({
    automation_id: auto.id,
    trigger_record_type: objectType,
    status: "success",
    actions_executed: { processed_records: processed },
    execution_time_ms: 0,
  });

  console.log(`[Scheduled] "${auto.name}" processed ${processed} records`);
}

async function processRelativeTime(auto: any, now: Date) {
  const config = auto.trigger_config || {};
  const objectType = config.object_type || "contacts";
  const dateField = config.date_field || "created_at";
  const offsetValue = config.offset_value || 1;
  const offsetUnit = config.offset_unit || "days";
  const direction = config.offset_direction || "after"; // "before" or "after"

  // Calculate target date
  let offsetMs: number;
  switch (offsetUnit) {
    case "hours": offsetMs = offsetValue * 3600000; break;
    case "days": offsetMs = offsetValue * 86400000; break;
    case "weeks": offsetMs = offsetValue * 7 * 86400000; break;
    case "months": offsetMs = offsetValue * 30 * 86400000; break;
    default: offsetMs = offsetValue * 86400000;
  }

  // For "3 days after created_at", we want records where created_at + 3 days = now
  // i.e., created_at = now - 3 days (within a 2-minute window)
  const targetDate = new Date(now.getTime() - (direction === "after" ? offsetMs : -offsetMs));
  const windowStart = new Date(targetDate.getTime() - 60000); // 1 minute before
  const windowEnd = new Date(targetDate.getTime() + 60000); // 1 minute after

  const table = `crm_${objectType}`;
  const { data: records } = await supabase
    .from(table)
    .select("*")
    .gte(dateField, windowStart.toISOString())
    .lte(dateField, windowEnd.toISOString())
    .limit(100);

  if (!records?.length) return;

  console.log(`[Relative Time] "${auto.name}" found ${records.length} records`);

  for (const record of records) {
    const conditionsMet = evaluateConditions(auto.conditions, record);
    if (!conditionsMet) continue;

    for (const action of auto.actions) {
      try {
        await executeAction(action, record, {
          record_id: record.id,
          record_type: objectType,
          new_data: record,
        });
      } catch (err: any) {
        console.error(`[Relative Time] Action failed:`, err.message);
      }
    }
  }

  await supabase
    .from("crm_automations")
    .update({ run_count: auto.run_count + 1, last_run_at: now.toISOString() })
    .eq("id", auto.id);
}
