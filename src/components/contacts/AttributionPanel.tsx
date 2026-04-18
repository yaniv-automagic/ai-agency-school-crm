import { ExternalLink } from "lucide-react";
import { AD_PLATFORMS, ENTRY_TYPES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Contact } from "@/types/crm";

interface AttributionPanelProps {
  contact: Contact;
}

export default function AttributionPanel({ contact }: AttributionPanelProps) {
  const hasAttribution =
    contact.utm_source ||
    contact.utm_medium ||
    contact.utm_campaign ||
    contact.utm_content ||
    contact.ad_platform ||
    contact.entry_type ||
    contact.landing_page_url ||
    contact.referrer_url ||
    contact.ad_campaign_id ||
    contact.ad_adset_id ||
    contact.ad_id ||
    contact.first_touch_at ||
    contact.conversion_at;

  if (!hasAttribution) return null;

  const adPlatform = contact.ad_platform
    ? AD_PLATFORMS.find((p) => p.value === contact.ad_platform)
    : null;
  const entryType = contact.entry_type
    ? ENTRY_TYPES.find((e) => e.value === contact.entry_type)
    : null;

  const truncateUrl = (url: string, maxLength = 40) => {
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength) + "...";
  };

  const hasAdIds = contact.ad_campaign_id || contact.ad_adset_id || contact.ad_id;

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <h3 className="font-semibold text-sm mb-3">שיוך ומקור</h3>
      <div className="space-y-2.5 text-sm">
        {contact.utm_source && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">מקור</span>
            <span className="font-medium">{contact.utm_source}</span>
          </div>
        )}

        {contact.utm_medium && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">מדיום</span>
            <span className="font-medium">{contact.utm_medium}</span>
          </div>
        )}

        {contact.utm_campaign && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">קמפיין</span>
            <span className="font-medium">{contact.utm_campaign}</span>
          </div>
        )}

        {contact.utm_content && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">תוכן</span>
            <span className="font-medium">{contact.utm_content}</span>
          </div>
        )}

        {adPlatform && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">פלטפורמה</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
              {adPlatform.label}
            </span>
          </div>
        )}

        {entryType && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">סוג כניסה</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
              {entryType.label}
            </span>
          </div>
        )}

        {contact.landing_page_url && (
          <div className="flex justify-between items-start gap-2">
            <span className="text-muted-foreground shrink-0">דף נחיתה</span>
            <a
              href={contact.landing_page_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-primary hover:underline truncate"
              dir="ltr"
              title={contact.landing_page_url}
            >
              <ExternalLink size={10} className="shrink-0" />
              {truncateUrl(contact.landing_page_url)}
            </a>
          </div>
        )}

        {contact.referrer_url && (
          <div className="flex justify-between items-start gap-2">
            <span className="text-muted-foreground shrink-0">referrer</span>
            <span className="text-xs text-muted-foreground truncate" dir="ltr" title={contact.referrer_url}>
              {truncateUrl(contact.referrer_url)}
            </span>
          </div>
        )}

        {/* Ad IDs */}
        {hasAdIds && (
          <div className="pt-2 mt-2 border-t border-border space-y-1.5">
            {contact.ad_campaign_id && (
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Campaign ID</span>
                <code className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded" dir="ltr">
                  {contact.ad_campaign_id}
                </code>
              </div>
            )}
            {contact.ad_adset_id && (
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Adset ID</span>
                <code className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded" dir="ltr">
                  {contact.ad_adset_id}
                </code>
              </div>
            )}
            {contact.ad_id && (
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Ad ID</span>
                <code className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded" dir="ltr">
                  {contact.ad_id}
                </code>
              </div>
            )}
          </div>
        )}

        {/* Dates */}
        {(contact.first_touch_at || contact.conversion_at) && (
          <div className="pt-2 mt-2 border-t border-border space-y-1.5">
            {contact.first_touch_at && (
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">מגע ראשון</span>
                <span className="text-xs">
                  {new Date(contact.first_touch_at).toLocaleDateString("he-IL", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            )}
            {contact.conversion_at && (
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">המרה</span>
                <span className="text-xs">
                  {new Date(contact.conversion_at).toLocaleDateString("he-IL", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
