import { supabase } from "../lib/supabase.js";
import { sendEmail } from "./email.js";

interface ActionConfig {
  type: string;
  config: Record<string, any>;
}

interface QueueItem {
  record_id: string;
  record_type: string;
  new_data: any;
}

/**
 * Execute a single automation action.
 */
export async function executeAction(
  action: ActionConfig,
  record: Record<string, any>,
  queueItem: QueueItem
): Promise<any> {
  const { type, config } = action;

  switch (type) {
    case "send_email":
      return await actionSendEmail(config, record);

    case "send_whatsapp":
      return await actionSendWhatsApp(config, record);

    case "update_record":
      return await actionUpdateRecord(config, record, queueItem);

    case "create_record":
      return await actionCreateRecord(config, record, queueItem);

    case "add_tag":
      return await actionAddTag(config, record, queueItem);

    case "assign_to":
      return await actionAssignTo(config, queueItem);

    case "webhook":
      return await actionWebhook(config, record);

    case "create_task":
      return await actionCreateTask(config, record, queueItem);

    case "notify_team":
      return await actionNotifyTeam(config, record);

    case "wait":
      // In a real system, this would re-enqueue with a delay
      // For now, just log it
      return { waited: config.duration, unit: config.unit };

    default:
      console.warn(`[Actions] Unknown action type: ${type}`);
      return { skipped: true, reason: `Unknown type: ${type}` };
  }
}

// ── Template variable substitution ──

function resolveTemplate(template: string, record: Record<string, any>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return record[key] || "";
  });
}

// ── Action Implementations ──

async function actionSendEmail(config: Record<string, any>, record: Record<string, any>) {
  const to = record.email;
  if (!to) throw new Error("Contact has no email address");

  const subject = resolveTemplate(config.subject || "", record);
  const body = resolveTemplate(config.body || "", record);

  await sendEmail(to, subject, body);

  // Log as activity
  if (record.id) {
    await supabase.from("crm_activities").insert({
      contact_id: record.id,
      type: "email",
      direction: "outbound",
      subject,
      body,
      metadata: { automated: true },
    });
  }

  return { sent_to: to, subject };
}

async function actionSendWhatsApp(config: Record<string, any>, record: Record<string, any>) {
  const phone = record.whatsapp_phone || record.phone;
  if (!phone) throw new Error("Contact has no phone number");

  const message = resolveTemplate(config.message || config.body || "", record);

  // TODO: Integrate with Evolution API backend proxy
  console.log(`[WhatsApp] Would send to ${phone}: ${message.substring(0, 50)}...`);

  // Log as activity
  if (record.id) {
    await supabase.from("crm_activities").insert({
      contact_id: record.id,
      type: "whatsapp",
      direction: "outbound",
      body: message,
      metadata: { automated: true },
    });
  }

  return { sent_to: phone, message_preview: message.substring(0, 100) };
}

async function actionUpdateRecord(config: Record<string, any>, record: Record<string, any>, item: QueueItem) {
  const { field, value } = config;
  if (!field) throw new Error("No field specified for update");

  const table = `crm_${item.record_type}`;
  const { error } = await supabase
    .from(table)
    .update({ [field]: value, updated_at: new Date().toISOString() })
    .eq("id", item.record_id);

  if (error) throw error;
  return { updated: field, value, record_id: item.record_id };
}

async function actionCreateRecord(config: Record<string, any>, record: Record<string, any>, item: QueueItem) {
  const { record_type, data } = config;
  if (!record_type) throw new Error("No record_type specified for create");

  const table = `crm_${record_type}`;
  const resolvedData: Record<string, any> = {};
  for (const [key, val] of Object.entries(data || {})) {
    resolvedData[key] = typeof val === "string" ? resolveTemplate(val, record) : val;
  }

  // Auto-link to source contact if creating activity/task
  if ((record_type === "activities" || record_type === "tasks") && record.id) {
    resolvedData.contact_id = record.id;
  }

  const { data: created, error } = await supabase.from(table).insert(resolvedData).select("id").single();
  if (error) throw error;
  return { created_type: record_type, created_id: created?.id };
}

async function actionAddTag(config: Record<string, any>, record: Record<string, any>, item: QueueItem) {
  const { tag } = config;
  if (!tag) throw new Error("No tag specified");

  // Only works on contacts
  if (item.record_type !== "contacts") return { skipped: true, reason: "Tags only on contacts" };

  const currentTags = record.tags || [];
  if (currentTags.includes(tag)) return { skipped: true, reason: "Tag already exists" };

  const { error } = await supabase
    .from("crm_contacts")
    .update({ tags: [...currentTags, tag] })
    .eq("id", item.record_id);

  if (error) throw error;
  return { added_tag: tag };
}

async function actionAssignTo(config: Record<string, any>, item: QueueItem) {
  const { team_member_id } = config;
  if (!team_member_id) throw new Error("No team_member_id specified");

  const table = `crm_${item.record_type}`;
  const { error } = await supabase
    .from(table)
    .update({ assigned_to: team_member_id })
    .eq("id", item.record_id);

  if (error) throw error;
  return { assigned_to: team_member_id };
}

async function actionWebhook(config: Record<string, any>, record: Record<string, any>) {
  const { url, method = "POST", headers: customHeaders } = config;
  if (!url) throw new Error("No webhook URL specified");

  const body = JSON.stringify(record);
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(customHeaders || {}),
    },
    body: method !== "GET" ? body : undefined,
  });

  return {
    status: res.status,
    ok: res.ok,
    response: await res.text().catch(() => ""),
  };
}

async function actionCreateTask(config: Record<string, any>, record: Record<string, any>, item: QueueItem) {
  const title = resolveTemplate(config.task_title || config.title || "משימה אוטומטית", record);
  const dueDate = config.due_days
    ? new Date(Date.now() + config.due_days * 86400000).toISOString()
    : null;

  const { data, error } = await supabase.from("crm_tasks").insert({
    title,
    type: "task",
    priority: config.priority || "medium",
    status: "pending",
    due_date: dueDate,
    contact_id: item.record_type === "contacts" ? item.record_id : record.contact_id || null,
    description: resolveTemplate(config.description || "", record),
  }).select("id").single();

  if (error) throw error;
  return { task_id: data?.id, title };
}

async function actionNotifyTeam(config: Record<string, any>, record: Record<string, any>) {
  const message = resolveTemplate(config.message || "", record);
  // For now, create an activity as a system notification
  // In the future, this could send push notifications or Slack messages
  console.log(`[Notify] ${message}`);
  return { notified: true, message_preview: message.substring(0, 100) };
}
