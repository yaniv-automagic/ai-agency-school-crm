# Fireberry (formerly Powerlink) CRM - Technical Research

## 1. API Documentation & REST API

### Base URL
- **Current (Fireberry):** `https://api.fireberry.com/api/`
- **Legacy (Powerlink):** `https://api.powerlink.co.il/api/`

### Authentication
- **Method:** API Key via header
- **Header Name:** `tokenid`
- **Token Location:** Settings (gear icon) > Integration > API Forms > "My Token" field
- Each user has a unique TokenID

### Developer Resources
- **Developer Portal:** https://developers.fireberry.com/
- **API Reference:** https://developers.fireberry.com/reference/
- **SDK (TypeScript):** `@fireberry/sdk` (npm)
- **API Explorer:** https://developers.fireberry.com/docs/api-explorer
- **GitHub (Legacy):** https://github.com/powerlink/Rest-API
- **NPM Package (Legacy):** `powerlink-api`
- **OpenAPI Specs Available:**
  - `fireberry-api.json` (Primary)
  - `fireberry-api-batch.json` (Batch operations)
  - `fireberry-api-files.json` (File handling)
  - `fireberry-metadata-api.json` (Metadata)
  - `fireberry-phone-calls.json` (Phone calls)
  - `fireberry-api-dev.json` (Development)

### Request/Response Format
- **Request format:** JSON or form-encoded
- **Response format:** JSON (all responses, including errors)
- **Character encoding:** UTF-8 only

### Rate Limits
- **100 requests per minute** (per organization, 1-minute rolling windows)
- **Max request size:** 10 MB
- **Concurrent GET requests:** up to 100
- **Concurrent POST/PUT/DELETE:** up to 30
- **Exceeded:** Returns HTTP 429 Too Many Requests
- **Increase:** Contact support

### Pagination
- **Default page size:** 50 records
- **Maximum page size:** 50 records
- **Maximum per request:** 500 records total
- **GET parameters:** `pagesize`, `pagenumber`
- **Query parameters:** `page_size`, `page_number`
- **Response includes:** `Total_Records`, `Page_Size`, `Page_Number`, `Records` (GET) or `IsLastPage`, `PageNum`, `Data`, `Columns` (Query)

---

## 2. API Endpoints

### CRUD Operations
| Action | Method | URL |
|--------|--------|-----|
| Create | POST | `/api/record/{objectType}` |
| Read One | GET | `/api/record/{objectType}/{id}` |
| Update | PUT | `/api/record/{objectType}/{id}` |
| Delete | DELETE | `/api/record/{objectType}/{id}` |
| Query | POST | `/api/query` |

### Metadata Endpoints
| Action | Method | URL |
|--------|--------|-----|
| Get All Record Types | GET | `/metadata/records` |
| Get Record Fields | GET | `/metadata/records/{recordid}/fields` |
| Get Specific Field | GET | `/metadata/records/{recordid}/fields/{fieldid}` |
| Get Picklist Values | GET | `/metadata/records/{recordid}/fields/{fieldid}/values` |

### Batch Operations
- **Batch Create:** Up to 20 records at once
- **Batch Update:** Up to 20 records at once
- Endpoints at `/reference/batch-create-records-overview` and `/reference/batch-update-records-overview`

### Query API Parameters
| Parameter | Details |
|-----------|---------|
| `objecttype` | Numeric object identifier |
| `page_size` | Results per page (1-500) |
| `page_number` | Starting at 1 |
| `fields` | Comma-separated field names or "*" for all |
| `query` | Filter expression string |
| `sort_by` | Field name to sort by |
| `sort_type` | "asc" or "desc" |

### Query Operators
| Operator | Description |
|----------|-------------|
| `=` | Equals |
| `!=` | Not equals |
| `<` | Less than |
| `>` | Greater than |
| `<=` | Less than or equal |
| `>=` | Greater than or equal |
| `start-with` | Starts with value |
| `not-start-with` | Does not start with |
| `end-with` | Ends with value |
| `not-end-with` | Does not end with |
| `is-null` | Field is empty |
| `is-not-null` | Field is not empty |
| `AND` | Logical AND |
| `OR` | Logical OR |

**Wildcard:** `%` prefix with `start-with` enables substring matching anywhere.

**Example:** `((accountname start-with 'Bob D') AND (statuscode = 6)) OR (accountnumber >= 50)`

**Important:** Single quotes only (not double quotes).

---

## 3. Data Model / Built-in Objects

### Known System Objects (with Object Numbers)
| Object | System Name | Object Number | API Path |
|--------|------------|---------------|----------|
| Accounts | account | 1 | `/api/record/account` |
| Contacts | contact | 2 | `/api/record/contact` |
| Cases/Tickets | cases | 5 | `/api/record/cases` |
| Tasks | task | 10 | `/api/record/task` |
| Opportunities | opportunity | ? | `/api/record/opportunity` |
| Orders | crmorder | ? | `/api/record/crmorder` |
| Products | product | ? | `/api/record/product` |
| Invoices | invoiceno | ? | `/api/record/invoiceno` |
| Credit Invoices | invoicecredit | ? | `/api/record/invoicecredit` |
| Delivery Invoices | invoicedelivery | ? | `/api/record/invoicedelivery` |
| Activity Logs | activitylog | ? | `/api/record/activitylog` |
| Phone Calls | calllog | ? | `/api/record/calllog` |
| Campaigns | campaign | ? | `/api/record/campaign` |
| Competitors | competitor | ? | `/api/record/competitor` |
| Contracts | contracts/contract | ? | `/api/record/contracts` |
| Assets | accountproduct | ? | `/api/record/accountproduct` |
| Articles | article | ? | `/api/record/article` |
| Business Units | businessunit | ? | `/api/record/businessunit` |
| Users | crmuser | ? | `/api/record/crmuser` |

**Note:** To find all object numbers, go to Settings > System > Object Studio.

### SDK OBJECTS Constant
The SDK exports an `OBJECTS` constant with all built-in types: `account`, `contact`, `opportunity`, `task`, `order`, `product`, etc.

---

## 4. Field Types

| API Type | System Equivalents | Details |
|----------|-------------------|---------|
| **Text** | Text, Phone, Email, URL, Formula | Max 200 characters |
| **Number** | Number, Summary, Formula | 0-4 decimal precision |
| **Date** | Date, Formula | UTC format |
| **Date & Time** | Date & Time, Formula | UTC format |
| **Picklist** | Picklist | Stored as numeric values, not text |
| **HTML** | HTML, Text Area, Formula | Max 4,000 characters |
| **Object (Lookup)** | Lookup (GUID) | 32-char GUID linking to related records |

### Additional Field Types (via SDK metadata)
`date`, `dateTime`, `emailAddress`, `lookUp`, `number`, `picklist`, `richText`, `text`, `textArea`, `url`, `telephone`, `formula`, `summary`

### Special Fields
- **Formula fields:** Can output Text, Number, Date, DateTime, or HTML
- **Summary fields:** Aggregate calculations
- **Lookup fields:** GUID references to related records in other objects

---

## 5. Custom Objects

- **Numbering:** Starts at 1000, increments for each new object
- **Referencing:** Can use system name or object number in API endpoints
- **CRUD:** Full create/read/update/delete support
- **Deletion constraints:** Cannot delete if used by fields, dashboard widgets, or automations
- **Deletion:** Unlike built-in objects, custom objects CAN be deleted
- **Requires GUID** for editing or deleting custom objects
- **Custom fields** can be added to any custom object

---

## 6. Data Export

### Single View Export
- Export any view as CSV
- Three-dot menu > Export to CSV
- Columns in view = columns in CSV

### Bulk Export (Full System)
- Settings > Tools > Export
- Exports ALL objects as separate CSV files in a ZIP
- Optional: Include attached files and documents
- Delivered via email to primary user with download link
- Link expires after 7 days

### API Export
- Use the Query API (`POST /api/query`) to paginate through all records
- Max 500 records per request, 50 per page
- Can select specific fields or all fields ("*")

---

## 7. Webhooks

### Outgoing Webhooks (Fireberry -> External)
- Configured as automation actions
- **HTTP Methods:** POST, GET, PUT, DELETE, PATCH
- **URL:** Must be full URL, HTTPS recommended
- **Headers:** Key-value pairs (Content-Type, Authorization, API tokens)
- **Body:** JSON format (unavailable for GET requests)
- **No built-in authentication** - must provide tokens via headers

### Error Handling
- **Within 24 hours:** Auto-drafts after 1,000 consecutive errors
- **After 24 hours:** Auto-drafts after 5 consecutive errors
- Notifications sent to automation creator and primary user
- No documented retry mechanism

### Incoming Webhooks
- Not explicitly documented as a native feature
- External data can be received via the REST API endpoints
- Third-party integration via Make (Integromat) and Zapier

---

## 8. Automation Engine

### Trigger Types
1. **Record Creation** - fires when new record is created
2. **Record Update** - fires when specified fields change
3. **Record Creation or Update** - combined trigger
4. **Relative Time** - based on date fields (1-100 units: hours/days/weeks/months/years)
5. **Fixed Time** - daily, weekly, or monthly at specified times

### Conditions (Filters)
- Field + Operator + Value
- Operators: "Is changed", "Equals", comparisons, etc.
- Multiple conditions with AND/OR logic
- Group filters available

### Available Actions
1. **Send Email** - with field references and templates
2. **Update Record** - change field values
3. **Create Record** - create new records (meetings, tasks, etc.)
4. **Webhook** - HTTP request to external systems

### Limitations
- Time-based automations: max 500 records per cycle
- Automation type cannot be changed after creation
- Some triggers restricted by license tier
- Minimum one action required

---

## 9. WhatsApp Integration

### Native Integration
- Send/receive WhatsApp messages from within Fireberry
- Messages appear in the activity stream alongside emails and calls
- Supports: text, images, videos, buttons, voice recordings, locations, emojis, reactions, quotes

### Funnerberry (by Funner) - Primary WhatsApp Add-on
- Built on **WhatsApp Cloud API**
- **Bot builder** for automated customer journeys
- **Broadcasts & campaigns** with targeted segments from CRM data
- **Document sending** (PDFs: quotes, invoices, delivery notes)
- **Mail2WhatsApp** feature - send WhatsApp from any email inbox
- **Automation integration** - trigger WhatsApp messages from Fireberry automations
- Multi-account support, no connection limits

### Additional Integrations
- TimelinesAI integration available
- Glassix integration available

---

## 10. Email Integration

- **Google Team Inbox** support - send/receive emails directly through Fireberry
- **Google/Office 365 sync** - calendar and contacts
- **Shared team inbox** for collaborative client communication
- **Email templates** with pre-built and custom templates
- **Email tracking** per client with full correspondence history
- Email automation via automation engine (Send Email action)

---

## 11. Reports & Analytics

### Dashboards
- Customizable dashboards with widgets (charts)
- Real-time data tracking
- KPI table widgets for cross-object comparisons

### Capabilities
- Sales data analysis
- Representative performance tracking
- Conversion rate tracking
- Custom rules for conditional display
- Call volume, handle time, resolution rate, satisfaction scores

### Widget Types
- Charts (various types)
- KPI tables
- Custom formula-based widgets

---

## 12. Mobile App

- **Platforms:** iOS (iPhone, iPad) and Android
- **Features:**
  - Real-time data access and updates
  - Sales pipeline management
  - Lead tracking
  - Task management
  - Contact communication
  - Analytics and reporting
  - Calendar integration
- **Sync:** Real-time bidirectional sync with central CRM

---

## 13. SDK Technical Details

### Installation
```bash
npm install @fireberry/sdk@latest
```

### Core APIs
```typescript
const client = new FireberryClientSDK();
await client.initializeContext();

// CRUD Operations
client.api.query(objectType, { fields, query, page_size, page_number });
client.api.create(objectType, data);
client.api.update(objectType, recordId, data);
client.api.delete(objectType, recordId);

// Metadata
client.metadata.getObjects();        // List all object types
client.metadata.getFields(objType);  // Fields for an object
client.metadata.getField(objType, fieldName); // Field details

// Storage
client.app.storage.uploadFile();
client.app.storage.getFile();
client.app.storage.getFiles();

// App Settings & DB
client.app.settings.get();
client.app.settings.set(jsonObject);
client.app.db.setItem(key, value);
client.app.db.getItem(key);
client.app.db.deleteItem(key);

// Navigation
client.system.goToRecord(objectType, recordId);
client.system.goToView(objectType, viewId);

// UI
client.badge.show({ number, badgeType });
client.toast.show({ content, toastType, placement });

// Events
client.system.on('navigation', handler);
```

### Permissions
- **Object permissions:** `create`, `read`, `update`, `delete` per object
- **Feature permissions:** `allowed` boolean per feature (billing, settings, webservices)

### Response Format
```json
{
  "success": true,
  "data": {},
  "error": { "status": 0, "statusText": "", "data": {} },
  "requestId": "string"
}
```

---

## 14. Third-Party Integrations

- **Make (Integromat):** Official Fireberry app
- **Zapier:** Official Fireberry CRM integration
- **Pipedream:** Fireberry API integration
- **Facebook:** Built-in integration
- **Google:** Built-in (Gmail, Calendar, Contacts)
- **Office 365:** Built-in (Calendar, Contacts)
- **Chrome Extension:** "Add to CRM" for B2B prospecting
- **Priority ERP:** Marketplace integration
- **AWS Marketplace:** Listed

---

## 15. Pricing (as of 2026)

- **Free plan** available (never expires)
- **Paid plans** starting from $35/month per user
- **Enterprise plan:** Unlimited customers, tickets, contacts, automations
- Includes: Fireberry Copilot (AI), customization, automations

---

## 16. Key Considerations for Building a Replacement

### What Fireberry Does Well
1. Flexible object model with custom objects (numbered from 1000+)
2. Comprehensive REST API with OpenAPI specs
3. Query language with decent operator support
4. Built-in automation engine with multiple trigger types
5. WhatsApp integration (via Funnerberry/Funner)
6. Email integration with Google/Office 365
7. SDK for custom app development

### Limitations to Improve Upon
1. **Rate limits:** Only 100 req/min, 50 records per page, 500 max per request
2. **Batch operations:** Only 20 records per batch
3. **Webhook limitations:** No retry mechanism, auto-disables after errors
4. **Query language:** Legacy syntax, limited operators (no `contains`, no regex)
5. **Automation actions:** Only 4 action types (email, update, create, webhook)
6. **No incoming webhooks:** Must use API endpoints directly
7. **Export:** Bulk export only via email/ZIP with 7-day expiration
8. **Field limits:** Text fields max 200 chars, HTML max 4000 chars
