import { supabase } from "../lib/supabase.js";
import { evaluateConditions } from "./conditions.js";
import { executeAction } from "./actions.js";

interface QueueItem {
  id: string;
  tenant_id: string;
  event_type: string;
  record_type: string;
  record_id: string;
  old_data: any;
  new_data: any;
}

interface Automation {
  id: string;
  name: string;
  trigger_type: string;
  trigger_config: any;
  conditions: any[];
  actions: any[];
  is_active: boolean;
}

/**
 * Process pending items in crm_automation_queue.
 * For each item, find matching automations, evaluate conditions, execute actions.
 */
export async function processAutomationQueue() {
  // Fetch unprocessed queue items (max 50 per cycle)
  const { data: items, error } = await supabase
    .from("crm_automation_queue")
    .select("*")
    .eq("processed", false)
    .order("created_at", { ascending: true })
    .limit(50);

  if (error || !items?.length) return;

  console.log(`[Processor] Processing ${items.length} queue items`);

  for (const item of items as QueueItem[]) {
    try {
      await processQueueItem(item);
    } catch (err) {
      console.error(`[Processor] Failed to process item ${item.id}:`, err);
    }

    // Mark as processed regardless of success/failure
    await supabase
      .from("crm_automation_queue")
      .update({ processed: true })
      .eq("id", item.id);
  }
}

async function processQueueItem(item: QueueItem) {
  // Map event types to trigger types
  const triggerTypeMap: Record<string, string[]> = {
    "contact.created": ["record_created", "record_created_or_updated"],
    "contact.updated": ["record_updated", "record_created_or_updated"],
    "deal.created": ["record_created", "record_created_or_updated"],
    "deal.updated": ["record_updated", "record_created_or_updated"],
    "deal.stage_changed": ["record_updated", "record_created_or_updated"],
    "task.created": ["record_created", "record_created_or_updated"],
    "form.submitted": ["form_submitted"],
    "webhook.received": ["webhook_received"],
  };

  const matchingTriggers = triggerTypeMap[item.event_type] || [];
  if (matchingTriggers.length === 0) return;

  // Find active automations that match this trigger
  const { data: automations } = await supabase
    .from("crm_automations")
    .select("*")
    .in("trigger_type", matchingTriggers)
    .eq("is_active", true);

  if (!automations?.length) return;

  for (const auto of automations as Automation[]) {
    const startTime = Date.now();

    try {
      // Check if trigger config matches the record type
      const triggerObjectType = auto.trigger_config?.object_type;
      if (triggerObjectType && triggerObjectType !== item.record_type) {
        continue; // This automation is for a different object type
      }

      // Evaluate conditions
      const record = item.new_data || {};
      const conditionsMet = evaluateConditions(auto.conditions, record, item.old_data);

      if (!conditionsMet) {
        await logExecution(auto.id, item.record_id, item.record_type, "skipped", null, null, Date.now() - startTime);
        continue;
      }

      // Execute actions sequentially
      const actionResults: any[] = [];
      let hasError = false;

      for (const action of auto.actions) {
        try {
          const result = await executeAction(action, record, item);
          actionResults.push({ type: action.type, status: "success", result });
        } catch (actionErr: any) {
          actionResults.push({ type: action.type, status: "failed", error: actionErr.message });
          hasError = true;
          // Don't stop on error - continue with remaining actions
        }
      }

      // Update automation stats
      await supabase
        .from("crm_automations")
        .update({
          run_count: (auto as any).run_count + 1,
          last_run_at: new Date().toISOString(),
          error_count: hasError ? (auto as any).error_count + 1 : (auto as any).error_count,
          last_error: hasError ? actionResults.find(r => r.status === "failed")?.error : null,
        })
        .eq("id", auto.id);

      // Log execution
      await logExecution(
        auto.id,
        item.record_id,
        item.record_type,
        hasError ? "partial" : "success",
        actionResults,
        hasError ? actionResults.find(r => r.status === "failed")?.error : null,
        Date.now() - startTime
      );

      console.log(`[Processor] Automation "${auto.name}" executed: ${hasError ? "partial" : "success"} (${Date.now() - startTime}ms)`);
    } catch (err: any) {
      await logExecution(auto.id, item.record_id, item.record_type, "failed", null, err.message, Date.now() - startTime);

      // Update error count
      await supabase
        .from("crm_automations")
        .update({
          error_count: (auto as any).error_count + 1,
          last_error: err.message,
          // Auto-disable after too many errors
          is_active: (auto as any).error_count + 1 >= 10 ? false : true,
        })
        .eq("id", auto.id);

      console.error(`[Processor] Automation "${auto.name}" failed:`, err.message);
    }
  }
}

async function logExecution(
  automationId: string, recordId: string, recordType: string,
  status: string, actionsExecuted: any, errorMessage: string | null, executionTimeMs: number
) {
  await supabase.from("crm_automation_logs").insert({
    automation_id: automationId,
    trigger_record_id: recordId,
    trigger_record_type: recordType,
    status,
    actions_executed: actionsExecuted,
    error_message: errorMessage,
    execution_time_ms: executionTimeMs,
  });
}
