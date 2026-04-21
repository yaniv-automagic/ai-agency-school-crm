/**
 * Branded email templates for AI Agency School CRM.
 *
 * Built from the canonical design-language doc: /email_design/DESIGN-LANGUAGE.md
 * Three variants: Dark (marketing), Light (transactional), Hybrid (newsletters).
 *
 * Palette:
 *   --brand-deep    #0A0820
 *   --brand-deep-2  #12082A
 *   --brand-violet  #712FF1
 *   --brand-magenta #DC1FFF
 *   --brand-gold    #C9A449
 *   --paper         #FEFBFF
 *   --ink           #0A0820
 *
 * Font stack: 'Heebo','Assistant','Noto Sans Hebrew','Segoe UI',Arial,sans-serif
 */

// ─── Shared constants ────────────────────────────────────────

const FONT = "'Heebo','Assistant','Noto Sans Hebrew','Segoe UI',Arial,sans-serif";
const YEAR = new Date().getFullYear();

const SOCIAL = {
  youtube: "https://www.youtube.com/@yaniv.benlolo",
  instagram: "https://www.instagram.com/nitzan.ai/",
  website: "https://aiagencyschool.co.il",
};

// Publicly-hosted logos
const LOGO_PURPLE = "https://aiagencyschool.co.il/wp-content/uploads/2025/10/cropped-Untitled-design-1-270x270.png";
const LOGO_GOLD = "https://sqazqjmbnczeargwywxu.supabase.co/storage/v1/render/image/public/crm-files/brand/logo-gold-transparent.png?width=400&quality=90";

// ─── Types ───────────────────────────────────────────────────

export type EmailVariant = "dark" | "light" | "hybrid";

export interface EmailTemplateParams {
  variant?: EmailVariant;
  preheader?: string;
  badgeText?: string;
  heroTitlePart1?: string;
  heroTitleHighlight?: string;
  heroTitlePart2?: string;
  heroLead?: string;
  calloutText?: string;           // Dark only — gradient pill
  sectionTitle?: string;
  bodyParagraphs?: string[];
  bullets?: string[];
  quoteText?: string;
  quoteAuthor?: string;
  infoLabel?: string;             // Light only
  infoValue?: string;             // Light only
  ctaText?: string;
  ctaUrl?: string;
  ctaMicrocopy?: string;
  unsubscribeUrl?: string;
}

/**
 * CRM-specific simple params for quick sends from timeline/automations.
 */
export interface SimpleEmailParams {
  recipientName?: string;
  body: string;                   // plain text (line-break separated)
  ctaText?: string;
  ctaUrl?: string;
  variant?: EmailVariant;
}

// ─── Head / meta shared across all variants ──────────────────

const HEAD = `<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<meta name="x-apple-disable-message-reformatting">
<title>AI Agency School</title>
<!--[if mso]>
<xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
<![endif]-->`;

const MOBILE_RESET = `@media (max-width:620px){
  .container{width:100%!important;}
  .px-40{padding-left:24px!important;padding-right:24px!important;}
  .py-48{padding-top:32px!important;padding-bottom:32px!important;}
  .h1{font-size:28px!important;line-height:1.2!important;}
  .h2{font-size:22px!important;}
  .lead{font-size:17px!important;}
  .cta{font-size:16px!important;padding:14px 28px!important;}
  .logo{width:90px!important;height:auto!important;}
  .stack{display:block!important;width:100%!important;}
  .hide-mobile{display:none!important;}
}`;

// ─── Component builders ──────────────────────────────────────

function preheaderBlock(text: string, bgColor: string) {
  return `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${bgColor};">${text} — AI Agency School</div>`;
}

function ctaButton(text: string, url: string) {
  return `<!--[if mso]>
<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
  href="${url}" style="height:52px;v-text-anchor:middle;width:260px;" arcsize="100%" stroke="f" fillcolor="#712FF1">
  <w:anchorlock/><center style="color:#FFFFFF;font-family:Arial,sans-serif;font-size:18px;font-weight:700;">${text}</center>
</v:roundrect>
<![endif]-->
<!--[if !mso]><!-- -->
<a href="${url}" class="cta" style="display:inline-block;background:linear-gradient(180deg,#712FF1 0%,#DC1FFF 100%);color:#FFFFFF;font-size:18px;font-weight:700;padding:16px 40px;border-radius:50px;text-decoration:none;box-shadow:0 0 28px rgba(220,31,255,0.45);font-family:${FONT};">${text}</a>
<!--<![endif]-->`;
}

function bulletsHtml(items: string[], textColor: string) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px 0;direction:rtl;">${items.map(item => `<tr><td style="padding:6px 0;color:${textColor};font-size:15px;line-height:1.6;text-align:right;"><span style="display:inline-block;width:8px;height:8px;background:#DC1FFF;border-radius:50%;margin-left:12px;vertical-align:middle;"></span>${item}</td></tr>`).join("")}</table>`;
}

function socialFooter(variant: "dark" | "light") {
  const linkColor = variant === "dark" ? "#C9A449" : "#712FF1";
  const dotColor = variant === "dark" ? "#4B2082" : "#C9C4D9";
  const textColor = variant === "dark" ? "#6E6589" : "#777777";
  const subColor = variant === "dark" ? "#8B7FB8" : "#777777";

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 20px;">
  <tr>
    <td style="padding:0 10px;"><a href="${SOCIAL.youtube}" style="color:${linkColor};font-size:13px;font-weight:600;">YouTube</a></td>
    <td style="padding:0 10px;color:${dotColor};">·</td>
    <td style="padding:0 10px;"><a href="${SOCIAL.instagram}" style="color:${linkColor};font-size:13px;font-weight:600;">Instagram</a></td>
    <td style="padding:0 10px;color:${dotColor};">·</td>
    <td style="padding:0 10px;"><a href="${SOCIAL.website}" style="color:${linkColor};font-size:13px;font-weight:600;">aiagencyschool.co.il</a></td>
  </tr>
</table>
<p style="margin:0 0 8px 0;font-size:12px;line-height:1.6;color:${textColor};direction:rtl;">© ${YEAR} AI Agency School</p>
<p style="margin:0;font-size:12px;color:${textColor};direction:rtl;">קיבלת את המייל הזה כי נרשמת לרשימת התפוצה שלנו. <a href="{{UNSUBSCRIBE_URL}}" style="color:${subColor};text-decoration:underline;">הסרה מרשימת התפוצה</a></p>`;
}

// ─── DARK template (marketing, events, webinars) ─────────────

function darkTemplate(p: EmailTemplateParams): string {
  const callout = p.calloutText
    ? `<div style="display:inline-block;background:linear-gradient(90deg,#712FF1 0%,#DC1FFF 100%);color:#FFFFFF;padding:10px 22px;border-radius:999px;font-size:14px;font-weight:600;margin-bottom:22px;">${p.calloutText}</div>`
    : "";

  const quote = p.quoteText
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#1A0D3A;border:1px solid rgba(220,31,255,0.2);border-radius:16px;margin:24px 0;">
  <tr><td style="padding:24px 28px;">
    <p style="margin:0 0 8px 0;font-size:17px;line-height:1.55;color:#EFECFF;font-style:italic;">"${p.quoteText}"</p>
    ${p.quoteAuthor ? `<p style="margin:0;font-size:13px;color:#8B7FB8;font-weight:600;">— ${p.quoteAuthor}</p>` : ""}
  </td></tr></table>`
    : "";

  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
${HEAD}
<style>
${MOBILE_RESET}
a{color:#DC1FFF;text-decoration:none;}
a:hover{text-decoration:underline;}
</style>
</head>
<body style="margin:0;padding:0;background:#0A0820;font-family:${FONT};-webkit-font-smoothing:antialiased;">

${p.preheader ? preheaderBlock(p.preheader, "#0A0820") : ""}

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0A0820;">
<tr><td align="center" style="padding:24px 12px;">

  <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0"
         style="width:600px;max-width:600px;background:#12082A;border-radius:20px;overflow:hidden;box-shadow:0 0 32px rgba(220,31,255,0.18);">

    <!-- HEADER — logo centered -->
    <tr>
      <td style="padding:28px 40px;background:#0A0820;border-bottom:1px solid rgba(220,31,255,0.15);text-align:center;">
        <img src="${LOGO_GOLD}" alt="AI Agency School" class="logo" width="200" height="auto" style="display:inline-block;border:0;outline:none;">
      </td>
    </tr>

    <!-- HERO -->
    <tr>
      <td class="px-40 py-48" style="padding:48px 40px 32px;text-align:right;direction:rtl;background:radial-gradient(circle at 15% 0%,rgba(113,47,241,0.35) 0%,transparent 55%);">
        ${callout}
        <h1 class="h1" style="margin:0 0 18px 0;font-size:34px;line-height:1.2;font-weight:800;color:#FFFFFF;letter-spacing:-0.3px;">
          ${p.heroTitlePart1 || ""}${p.heroTitleHighlight ? `<span style="color:#DC1FFF;">${p.heroTitleHighlight}</span>` : ""}${p.heroTitlePart2 || ""}
        </h1>
        ${p.heroLead ? `<p class="lead" style="margin:0;font-size:18px;line-height:1.55;color:#C9C4D9;font-weight:400;">${p.heroLead}</p>` : ""}
      </td>
    </tr>

    <!-- DIVIDER -->
    <tr><td style="padding:0 40px;"><div style="height:2px;background:linear-gradient(90deg,transparent 0%,#DC1FFF 50%,transparent 100%);"></div></td></tr>

    <!-- BODY -->
    <tr>
      <td class="px-40" style="padding:40px;color:#EFECFF;font-size:16px;line-height:1.65;direction:rtl;text-align:right;">
        ${p.sectionTitle ? `<h2 class="h2" style="margin:0 0 16px 0;font-size:26px;line-height:1.25;font-weight:700;color:#FFFFFF;">${p.sectionTitle}</h2>` : ""}
        ${(p.bodyParagraphs || []).map(para => `<p style="margin:0 0 16px 0;color:#C9C4D9;">${para}</p>`).join("")}
        ${p.bullets?.length ? bulletsHtml(p.bullets, "#EFECFF") : ""}
        ${quote}
      </td>
    </tr>

    <!-- CTA -->
    ${p.ctaText && p.ctaUrl ? `<tr>
      <td class="px-40" style="padding:16px 40px 48px;text-align:center;direction:rtl;">
        ${ctaButton(p.ctaText, p.ctaUrl)}
        ${p.ctaMicrocopy ? `<p style="margin:16px 0 0 0;font-size:13px;color:#8B7FB8;">${p.ctaMicrocopy}</p>` : ""}
      </td>
    </tr>` : ""}

    <!-- FOOTER -->
    <tr>
      <td style="padding:32px 40px;background:#0A0820;border-top:1px solid rgba(220,31,255,0.1);text-align:center;">
        ${socialFooter("dark")}
      </td>
    </tr>

  </table>
</td></tr>
</table>
</body>
</html>`;
}

// ─── LIGHT template (transactional, confirmations) ───────────

function lightTemplate(p: EmailTemplateParams): string {
  const infoBox = p.infoLabel && p.infoValue
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F7F3FF;border-right:4px solid #DC1FFF;border-radius:10px;margin:20px 0;">
  <tr><td style="padding:18px 22px;">
    <p style="margin:0 0 6px 0;font-size:13px;font-weight:700;color:#712FF1;letter-spacing:0.3px;">${p.infoLabel}</p>
    <p style="margin:0;font-size:16px;font-weight:600;color:#0A0820;">${p.infoValue}</p>
  </td></tr></table>`
    : "";

  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
${HEAD}
<style>
${MOBILE_RESET}
a{color:#712FF1;text-decoration:none;}
a:hover{text-decoration:underline;}
</style>
</head>
<body style="margin:0;padding:0;background:#F3F0FA;font-family:${FONT};-webkit-font-smoothing:antialiased;">

${p.preheader ? preheaderBlock(p.preheader, "#F3F0FA") : ""}

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F3F0FA;">
<tr><td align="center" style="padding:24px 12px;">

  <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0"
         style="width:600px;max-width:600px;background:#FEFBFF;border-radius:20px;overflow:hidden;box-shadow:0 10px 40px rgba(75,32,130,0.10);">

    <!-- HEADER — logo centered -->
    <tr>
      <td style="padding:28px 40px;background:#FEFBFF;border-bottom:1px solid #E8E6F0;text-align:center;">
        <img src="${LOGO_GOLD}" alt="AI Agency School" class="logo" width="200" height="auto" style="display:inline-block;border:0;outline:none;">
      </td>
    </tr>

    <!-- HERO -->
    <tr>
      <td class="px-40 py-48" style="padding:44px 40px 28px;text-align:right;direction:rtl;">
        <h1 class="h1" style="margin:0 0 16px 0;font-size:32px;line-height:1.2;font-weight:800;color:#0A0820;letter-spacing:-0.3px;">
          ${p.heroTitlePart1 || ""}${p.heroTitleHighlight ? `<span style="color:#DC1FFF;">${p.heroTitleHighlight}</span>` : ""}${p.heroTitlePart2 || ""}
        </h1>
        ${p.heroLead ? `<p class="lead" style="margin:0;font-size:17px;line-height:1.6;color:#555555;font-weight:400;">${p.heroLead}</p>` : ""}
      </td>
    </tr>

    <!-- DIVIDER -->
    <tr><td style="padding:0 40px;"><div style="height:1px;background:#E8E6F0;"></div></td></tr>

    <!-- BODY -->
    <tr>
      <td class="px-40" style="padding:36px 40px;color:#1F2124;font-size:16px;line-height:1.65;direction:rtl;text-align:right;">
        ${p.sectionTitle ? `<h2 class="h2" style="margin:0 0 14px 0;font-size:24px;line-height:1.3;font-weight:700;color:#0A0820;">${p.sectionTitle}</h2>` : ""}
        ${(p.bodyParagraphs || []).map(para => `<p style="margin:0 0 14px 0;color:#333333;">${para}</p>`).join("")}
        ${infoBox}
        ${p.bullets?.length ? bulletsHtml(p.bullets, "#1F2124") : ""}
      </td>
    </tr>

    <!-- CTA -->
    ${p.ctaText && p.ctaUrl ? `<tr>
      <td class="px-40" style="padding:0 40px 44px;text-align:center;direction:rtl;">
        ${ctaButton(p.ctaText, p.ctaUrl)}
        ${p.ctaMicrocopy ? `<p style="margin:14px 0 0 0;font-size:13px;color:#777777;">${p.ctaMicrocopy}</p>` : ""}
      </td>
    </tr>` : ""}

    <!-- FOOTER -->
    <tr>
      <td style="padding:28px 40px;background:#F7F3FF;text-align:center;border-top:1px solid #E8E6F0;">
        ${socialFooter("light")}
      </td>
    </tr>

  </table>
</td></tr>
</table>
</body>
</html>`;
}

// ─── HYBRID template (newsletter — dark header/footer, light body) ──

function hybridTemplate(p: EmailTemplateParams): string {
  const quote = p.quoteText
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0A0820;border-radius:16px;margin:8px 0 28px 0;">
  <tr><td style="padding:24px 28px;text-align:right;">
    <p style="margin:0 0 10px 0;font-size:17px;line-height:1.55;color:#FFFFFF;font-style:italic;font-weight:500;">"${p.quoteText}"</p>
    ${p.quoteAuthor ? `<p style="margin:0;font-size:13px;color:#C9A449;font-weight:700;">— ${p.quoteAuthor}</p>` : ""}
  </td></tr></table>`
    : "";

  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
${HEAD}
<style>
${MOBILE_RESET}
.card{padding:20px!important;}
a{color:#712FF1;text-decoration:none;}
a:hover{text-decoration:underline;}
</style>
</head>
<body style="margin:0;padding:0;background:#0A0820;font-family:${FONT};-webkit-font-smoothing:antialiased;">

${p.preheader ? preheaderBlock(p.preheader, "#0A0820") : ""}

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0A0820;">
<tr><td align="center" style="padding:24px 12px;">

  <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0"
         style="width:600px;max-width:600px;background:#FEFBFF;border-radius:20px;overflow:hidden;box-shadow:0 0 40px rgba(220,31,255,0.25);">

    <!-- HEADER (dark) — logo centered -->
    <tr>
      <td class="px-40 py-48" style="padding:36px 40px;background:#0A0820;text-align:center;direction:rtl;background-image:radial-gradient(circle at 85% 0%,rgba(113,47,241,0.4) 0%,transparent 50%);">
        <img src="${LOGO_GOLD}" alt="AI Agency School" class="logo" width="200" height="auto" style="display:inline-block;border:0;outline:none;margin-bottom:24px;">
        <h1 class="h1" style="margin:0 0 14px 0;font-size:32px;line-height:1.2;font-weight:800;color:#FFFFFF;letter-spacing:-0.3px;text-align:right;">
          ${p.heroTitlePart1 || ""}${p.heroTitleHighlight ? `<span style="color:#DC1FFF;">${p.heroTitleHighlight}</span>` : ""}${p.heroTitlePart2 || ""}
        </h1>
        ${p.heroLead ? `<p class="lead" style="margin:0;font-size:17px;line-height:1.55;color:#C9C4D9;text-align:right;">${p.heroLead}</p>` : ""}
      </td>
    </tr>

    <!-- BODY (light) -->
    <tr>
      <td class="px-40" style="padding:40px;color:#1F2124;font-size:16px;line-height:1.65;direction:rtl;text-align:right;">
        ${p.sectionTitle ? `<h2 class="h2" style="margin:0 0 14px 0;font-size:24px;line-height:1.3;font-weight:700;color:#0A0820;">${p.sectionTitle}</h2>` : ""}
        ${(p.bodyParagraphs || []).map(para => `<p style="margin:0 0 14px 0;color:#333333;">${para}</p>`).join("")}
        ${p.bullets?.length ? bulletsHtml(p.bullets, "#1F2124") : ""}
        ${quote}

        ${p.ctaText && p.ctaUrl ? `<div style="text-align:center;margin:8px 0 0 0;">
          ${ctaButton(p.ctaText, p.ctaUrl)}
          ${p.ctaMicrocopy ? `<p style="margin:14px 0 0 0;font-size:13px;color:#777777;">${p.ctaMicrocopy}</p>` : ""}
        </div>` : ""}
      </td>
    </tr>

    <!-- FOOTER (dark) -->
    <tr>
      <td style="padding:32px 40px;background:#0A0820;text-align:center;">
        ${socialFooter("dark")}
      </td>
    </tr>

  </table>
</td></tr>
</table>
</body>
</html>`;
}

// ─── Public API ──────────────────────────────────────────────

/**
 * Build a full branded email from structured params.
 * Choose variant: "dark" (marketing), "light" (transactional), "hybrid" (newsletter).
 */
export function brandedEmailTemplate(p: EmailTemplateParams): string {
  const variant = p.variant || "dark";
  switch (variant) {
    case "light":  return lightTemplate(p);
    case "hybrid": return hybridTemplate(p);
    default:       return darkTemplate(p);
  }
}

/**
 * Quick plain-text → branded HTML wrapper.
 * Used by the timeline email composer to wrap free-text in brand styling.
 * Defaults to Light variant (transactional 1:1 emails).
 */
export function wrapInBrandTemplate(text: string, recipientName?: string): string {
  const lines = text.split("\n").filter(l => l.trim());
  const paragraphs = lines.map(line => line.trim());

  return lightTemplate({
    preheader: paragraphs[0]?.substring(0, 80),
    heroTitlePart1: recipientName ? `שלום ${recipientName}, ` : "",
    bodyParagraphs: paragraphs,
  });
}

// ─── Prebuilt templates ──────────────────────────────────────

export function welcomeEmailTemplate(name: string): string {
  return darkTemplate({
    preheader: `${name}, ברוך הבא ל-AI Agency School`,
    heroTitlePart1: "ברוך הבא ל-",
    heroTitleHighlight: "AI Agency School",
    heroTitlePart2: "! 🚀",
    heroLead: "שמחים שהצטרפת. אנחנו כאן כדי לעזור לך להפוך ידע טכני לעסק AI רווחי.",
    sectionTitle: "מה עכשיו?",
    bodyParagraphs: [
      "אנחנו נלווה אותך צעד אחרי צעד — בלי לעזוב את העבודה, בלי להפוך לאיש מכירות.",
      "בקרוב נשלח לך עוד מידע על איך להתחיל. בינתיים, אל תהסס לפנות אלינו בכל שאלה.",
    ],
    bullets: [
      "ליווי פרקטי 1:1 לבניית סוכנות AI",
      "מתודולוגיה מוכחת — 10-15 שעות שבועיות",
      "קהילה של אנשי טכנולוגיה שהפכו ליזמים",
    ],
    ctaText: "גלה עוד על התוכנית",
    ctaUrl: "https://aiagencyschool.co.il",
    ctaMicrocopy: "בלי התחייבות · שיחת היכרות חינם",
  });
}

export function followUpEmailTemplate(name: string, meetingSummary?: string): string {
  const paragraphs = [
    "תודה על הפגישה! היה נהדר לדבר איתך.",
  ];
  if (meetingSummary) {
    paragraphs.push(meetingSummary);
  }
  paragraphs.push("אשמח לשמוע ממך אם יש שאלות נוספות.");

  return lightTemplate({
    preheader: `${name}, תודה על הפגישה`,
    badgeText: "פולואפ",
    heroTitlePart1: `${name}, `,
    heroTitleHighlight: "תודה על הפגישה",
    heroTitlePart2: " 🙏",
    bodyParagraphs: paragraphs,
    ctaText: "קבע פגישת המשך",
    ctaUrl: "https://aiagencyschool.co.il",
  });
}

// ─── Template registry for the UI ────────────────────────────

export const EMAIL_TEMPLATES = [
  { id: "blank",    label: "מייל חופשי",    description: "כתוב מייל מאפס עם עיצוב המותג", variant: "light" as const },
  { id: "welcome",  label: "ברוך הבא",      description: "מייל קבלת פנים לליד חדש",       variant: "dark" as const },
  { id: "followup", label: "פולואפ פגישה",   description: "מייל המשך אחרי פגישה עם סיכום",  variant: "light" as const },
  { id: "event",    label: "הזמנה לאירוע",   description: "הזמנה ללייב, וובינר או וורקשופ",  variant: "dark" as const },
  { id: "newsletter", label: "ניוזלטר",      description: "סיכום שבועי או עדכון תוכן",      variant: "hybrid" as const },
] as const;

export type EmailTemplateId = typeof EMAIL_TEMPLATES[number]["id"];
