# AI Agency School — Email Templates

ערכה מלאה של טמפלייטי מייל ב-RTL (עברית) עם שפה עיצובית של AI Agency School.
נוצרה מסריקה של `https://aiagencyschool.co.il` — הצבעים, הגרדיאנטים והטיפוגרפיה נאמנים למקור.

## קבצים בתיקייה

| קובץ | מטרה |
|---|---|
| **`DESIGN-LANGUAGE.md`** | **המסמך הראשי** — שפה עיצובית מלאה. כל מייל עתידי שתבקש מ-Claude חייב להיבנות על המסמך הזה. תצרף אותו בכל פעם שאתה מבקש מקלוד לבנות מייל חדש. |
| `email-dark.html` | טמפלייט Dark — שיווקי, לייב, וובינר, הזמנות. |
| `email-light.html` | טמפלייט Light — הודעות עסקיות, אישורי הרשמה, עדכונים טכניים. |
| `email-hybrid.html` | טמפלייט Hybrid — ניוזלטר ארוך, סיכומים שבועיים. |
| `email-*-preview.html` | גרסאות עם טקסט לדוגמה — לא למחוק, משמשות לבדיקה חזותית. |
| `email-*-preview.png` | צילומי מסך של איך כל גרסה נראית בפועל. |
| `assets/` | **כאן מחליפים את הלוגואים.** שמור כאן `logo-purple.png` ו-`logo-black.png`. |

## איך להשתמש בטמפלייט?

הטמפלייטים בנויים עם `{{PLACEHOLDERS}}` שצריך להחליף לפני שליחה.

### רשימת ה-placeholders

**מטא-דטה:**
- `{{PREHEADER_TEXT}}` — טקסט הקדם-תצוגה שמופיע באינבוקס ליד הכותרת (50-100 תווים).
- `{{BADGE_TEXT}}` — תג קטן בראש (למשל "NEW · לייב", או "אישור הרשמה").

**כותרת ראשית:**
- `{{HERO_TITLE_PART_1}}` — החלק הראשון של הכותרת.
- `{{HERO_TITLE_HIGHLIGHT}}` — החלק המודגש בצבע מג'נטה.
- `{{HERO_TITLE_PART_2}}` — המשך הכותרת.
- `{{HERO_LEAD}}` — פסקת פתיחה (1-2 משפטים).

**פס שיווקי (Dark בלבד):**
- `{{CALLOUT_TEXT}}` — למשל "וובינר חינם · יום שלישי 20:00".

**גוף:**
- `{{SECTION_TITLE}}` — כותרת חטיבה.
- `{{BODY_PARAGRAPH_1}}`, `{{BODY_PARAGRAPH_2}}` — פסקאות גוף.
- `{{BULLET_1}}`, `{{BULLET_2}}`, `{{BULLET_3}}` — נקודות תבליטים.
- `{{QUOTE_TEXT}}`, `{{QUOTE_AUTHOR}}` — ציטוט + שם המצטט.

**תיבת מידע (Light בלבד):**
- `{{INFO_LABEL}}` (למשל "מתי?"), `{{INFO_VALUE}}` (למשל "28 באפריל, 20:00").

**פיצ'רים (Hybrid בלבד, 3 עמודות):**
- `{{FEATURE_1_NUM}}`, `{{FEATURE_1_TITLE}}`, `{{FEATURE_1_DESC}}` — וכך ל-2 ו-3.

**CTA:**
- `{{CTA_TITLE}}` (Dark בלבד), `{{CTA_TEXT}}`, `{{CTA_URL}}`, `{{CTA_MICROCOPY}}`.

**Footer:**
- `{{LOGO_URL_BLACK}}` / `{{LOGO_URL_PURPLE}}` — URL מלא של הלוגו (חייב להיות מתארח פומבי, לא קובץ מקומי).
- `{{YEAR}}`, `{{COMPANY_ADDRESS}}`.
- `{{YOUTUBE_URL}}`, `{{INSTAGRAM_URL}}`, `{{WEBSITE_URL}}`, `{{UNSUBSCRIBE_URL}}`.

### דוגמה למילוי (Node/JS)

```js
const template = fs.readFileSync('email-dark.html', 'utf-8');
const filled = template
  .replace(/{{HERO_TITLE_HIGHLIGHT}}/g, 'לעסק AI רווחי')
  .replace(/{{CTA_URL}}/g, 'https://aiagencyschool.co.il/webinar-reg')
  // ...
```

### דוגמה למילוי (MailerLite / ActiveCampaign / Klaviyo)

המערכות האלו תומכות ב-`{{variable}}` native. פשוט העלה את הקובץ כ-custom HTML template.

## איפה שמים את הלוגואים?

שני לוגואים נמצאים בתיקיית `assets/`:
- `logo-purple.png` — לוגו זהב על רקע סגול (לשימוש ב-Light template).
- `logo-black.png` — לוגו זהב על רקע שחור (לשימוש ב-Dark ו-Hybrid templates).

> **חשוב:** מיילים לא טוענים קבצים מקומיים (`file://`). צריך להעלות את הלוגואים לשרת ציבורי (WordPress media, Cloudflare R2, AWS S3, GitHub raw, Cloudinary) ולהשתמש ב-URL המלא.
>
> למשל: `https://aiagencyschool.co.il/wp-content/uploads/2026/logo-black.png`.

## איך Claude יוצר מיילים חדשים?

בקשה לדוגמה:
> "קלוד, תכין לי מייל הזמנה ללייב שלי ביום רביעי - נושא: אוטומציות ב-n8n".

Claude יקרא את `DESIGN-LANGUAGE.md`, יבחר את הטמפלייט Dark (כי זה שיווקי), ימלא את ה-placeholders עם תוכן מותאם בטון של המותג (ישיר, פרובוקטיבי, בסגנון יניב), וישלח לך קובץ HTML מוכן.

**חוק ברזל:** Claude לא אמור לשנות צבעים, גדלי פונטים, או radii שלא מופיעים במסמך השפה העיצובית. הכל בתוך המסגרת הזו — בלי חריגות.

## בדיקות לפני שליחה

לפני שליחת מייל לתפוצה:

1. בדוק ב-[MailTester](https://www.mail-tester.com/) - ציון 9+/10.
2. שלח לעצמך לחשבון Gmail, Outlook, Apple Mail.
3. בדוק מובייל (iPhone Mail, Gmail app).
4. ודא שכל ה-`{{placeholders}}` הוחלפו (חפש את `{{` ב-HTML הסופי — צריך להיות ריק).
5. ודא שה-`CTA_URL` תקין עם UTM.
6. ודא ש-Unsubscribe link עובד.

## Versioning

- **v1.0** (אפריל 2026) — יציאה ראשונית, בסיס על סריקת האתר ב-21 באפריל 2026.

אם המיתוג משתנה בעתיד, עדכן קודם את `DESIGN-LANGUAGE.md`, אחר כך את שלושת הטמפלייטים.
