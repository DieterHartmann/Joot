# Joot — Statement of Work
## Leave Management System

**Version:** 1.0 — Handover to Claude Code
**Prepared by:** Claude Sonnet (claude.ai design session)
**Handover target:** Claude Code (CLI)

---

## 0. Handover Instructions for Claude Code

This document is the complete design specification for Joot, a leave management system. It was produced in a structured design session and contains every architectural decision, data model, business rule, and deployment detail needed to build the system. Read it in full before writing any code.

### What has been decided — do not revisit these
- Stack (see Section 2) — do not substitute technologies
- Multi-tenancy approach: one Postgres database, one schema per subsidiary (see Section 3)
- Data model: all tables, fields, types, and relationships (see Section 4)
- Approval workflow logic including apex resolution via department tree (see Section 5)
- Rules engine structure (see Section 6)
- BCEA compliance requirements — these are legal floors, not optional (see Section 6)
- Notification events and recipients (see Section 7)
- Role and permission model (see Section 9)

### What has NOT been designed yet — use your judgement and document decisions
- API endpoint structure (REST, Fastify routes, request/response shapes)
- Frontend page structure and routing
- Wizard flows for admin configuration
- Auth session management details beyond what Better Auth provides out of the box
- BullMQ job definitions and queue structure

### Your first task — do this before anything else
1. Scaffold the monorepo using pnpm workspaces with this structure:
```
joot/
  packages/
    types/          # Shared TypeScript types
    db/             # Prisma schema and migrations
  apps/
    api/            # Fastify 4 + TypeScript
    web/            # React 18 + Vite
  docker-compose.yml
  .env.example
```
2. Write the Prisma schema in `packages/db/schema.prisma` from the data model in Section 4. Use `postgresql` provider. Implement schema-per-tenant using Prisma's `multiSchema` preview feature — each subsidiary gets its own Postgres schema. `holding_company` and `subsidiary` tables live in a shared `public` schema.
3. Run `prisma migrate dev` to confirm the schema is valid and migrations generate cleanly.
4. Stop and report back before touching any application code.

### Critical implementation notes
- The `department` table is a self-referencing tree. `parent_department_id` is nullable (null = root). `tree_path` is a materialised path string that must be kept in sync whenever a department is renamed or moved. Write a utility function for this — it is easy to get wrong.
- The `audit_event` table is append-only. No update or delete operations should ever be performed on it. Enforce this at the Prisma level with middleware if possible.
- Reciprocal deputy constraint: if user A has user B as deputy, user B cannot have user A as deputy. Enforce this in application logic on write, not just UI.
- Apex approver resolution walks up the `parent_department_id` chain at leave request submission time. The resolved approver ID is written to `approval_step` and never re-resolved. Write this as an explicit recursive function, not inline logic.
- BCEA floors are legal minimums. Any configuration wizard that sets leave entitlements must validate against these floors and reject values below them with a clear error message.

---

## 1. Project Overview

Joot is a production-grade leave management system for a holding company with multiple subsidiaries. It is designed to be low-maintenance, low technical debt, and long-lived. Simplicity and robustness are preferred over convenience or aesthetics.

The name "Joot" is derived from "adjutant" — the administrative officer in a military unit responsible for personnel records and leave management.

---

## 2. Stack

| Layer | Technology | Notes |
|---|---|---|
| Backend | Fastify 4 + TypeScript strict mode | Type safety reduces long-term debt |
| Frontend | React 18 + Vite (SPA) | Mature ecosystem, form-heavy UI |
| Database | PostgreSQL 16 + Prisma | Schema-per-tenant isolation |
| Auth | Better Auth 1.2.7 (Prisma adapter) | Email/password day one; Entra SSO later |
| Email | Nodemailer SMTP | Event-triggered only |
| Queue | BullMQ + Redis 7 | Workflow state transitions, email dispatch |
| Package manager | pnpm (monorepo workspaces) | Shared types across backend/frontend |
| Deployment | Docker Compose + Cloudflare Tunnel | PoC on Raspberry Pi, production on Hetzner |

**No widget layer** (sandboxed iframe) — Joot is a standalone application, not an embeddable tool.

**Shared types:** Because frontend and backend share a monorepo, leave request objects, user objects, and API response shapes are defined once in a `/packages/types` workspace and consumed by both. TypeScript strict mode enforces this at compile time.

---

## 3. Multi-Tenancy Architecture

Joot is built for a holding company with multiple subsidiaries. Architecture decisions:

- **One PostgreSQL database, multiple schemas** — each subsidiary gets its own Postgres schema (e.g. `subsidiary_acme`, `subsidiary_holdco`). The holding company's own staff are treated as a subsidiary too.
- **Holding company admin** has a cross-schema read role — can view all subsidiaries' data but cannot modify subsidiary-level configuration.
- **Subsidiary-level admin (HR Director)** has full access within their schema only.
- **Row-level isolation** is enforced at the Prisma client level by always scoping queries to the active subsidiary schema.
- **Schema provisioning** is handled via a wizard — adding a new subsidiary creates and migrates a new Postgres schema automatically.

---

## 4. Data Model

### Tables (all within subsidiary schema unless noted)

#### `holding_company` (shared schema)
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name | string | |
| schema_name | string | Postgres schema name |
| created_at | timestamp | |

#### `subsidiary` (shared schema)
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| holding_company_id | uuid FK | |
| name | string | |
| pg_schema | string | Postgres schema name for this subsidiary |
| leave_year_type | enum | `calendar`, `tax`, `anniversary` |
| leave_year_start | date | Used if type is `calendar` or `tax` |
| public_holidays_excluded | bool | Default true; if false, public holidays count as leave days |
| timezone | string | IANA timezone string; defaults to Africa/Johannesburg |
| created_at | timestamp | |

#### `user`
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| subsidiary_id | uuid FK | |
| department_id | uuid FK | |
| email | string | Unique within subsidiary |
| full_name | string | |
| role | enum | `employee`, `manager`, `hr_director`, `ceo`, `subsidiary_admin`, `holding_admin` |
| start_date | date | Used for anniversary-based leave year and probation rules |
| ctc | decimal | Cost to company — used for leave liability calculation |
| ms_entra_linked | bool | Whether this account is linked to Microsoft Entra ID |
| entra_object_id | string | Nullable; populated on Entra SSO link |
| created_at | timestamp | |

#### `department`
Self-referencing tree — supports unlimited nesting depth (e.g. Holding Co > Subsidiary > Region > District > Store > Department).

| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| subsidiary_id | uuid FK | |
| parent_department_id | uuid FK | Nullable — null means root node |
| name | string | |
| default_approver_id | uuid FK | Line manager for this node |
| apex_approver_id | uuid FK | Nullable — if set, leave requests from this subtree stop here for final approval |
| tree_depth | int | Computed on write — 0 = root. Used for display and query optimisation |
| tree_path | string | Materialised path e.g. `root.region_north.district_3.store_42` — enables efficient subtree queries |

**Apex resolution logic:** When a leave request reaches the apex approval stage, the system walks up the `parent_department_id` chain from the employee's department until it finds a node with `apex_approver_id` set. That person becomes the final approver. If no apex is found before the root, the subsidiary HR Director is the fallback apex of last resort. This means a regional manager can be the apex for their entire region, and the HR Director only sees requests that have no closer apex configured.

#### `leave_type`
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| subsidiary_id | uuid FK | |
| name | string | e.g. "Annual Leave", "Sick Leave", "Parental Leave" |
| category | enum | `annual`, `sick`, `parental`, `maternity`, `compassionate`, `family_responsibility`, `custom` |
| max_days_per_year | int | Nullable for uncapped types |
| allow_negative | bool | Whether employee can go into negative balance |
| expiry_months | int | Months before unused leave is forfeited; null = never expires |
| requires_dual_approval | bool | Line manager + HR Director / apex approver |
| bcea_protected | bool | If true, system enforces BCEA statutory minimums and rejects config below floor |
| active | bool | |

#### `leave_rule`
Flexible rule engine. Each leave type can have multiple rules.
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| leave_type_id | uuid FK | |
| rule_type | enum | `accrual_rate`, `probation_block`, `max_consecutive_days`, `min_notice_days`, `expiry_warning_days`, `sick_leave_cycle`, `bcea_floor` |
| parameters | jsonb | Rule-specific parameters |

#### `leave_balance`
One row per user per leave type.
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| leave_type_id | uuid FK | |
| accrued | decimal | Total accrued to date |
| used | decimal | Total used to date |
| balance | decimal | Computed: accrued - used |
| accrual_rate | decimal | Days per month; can differ per user (e.g. exec vs standard) |
| last_accrual_date | date | |
| expiry_date | date | Nullable; computed from leave_type.expiry_months |

#### `leave_request`
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| leave_type_id | uuid FK | |
| start_date | date | |
| end_date | date | |
| days_calculated | decimal | Working days, public holiday exclusion applied |
| includes_half_day | bool | |
| half_day_portion | enum | `morning`, `afternoon`; nullable |
| status | enum | `draft`, `pending_line_manager`, `pending_apex`, `approved`, `rejected`, `cancelled`, `recalled` |
| notes | string | Employee-submitted reason |
| is_backdated | bool | |
| backdated_reason | string | Nullable; required if is_backdated = true |
| created_at | timestamp | |

#### `approval_step`
One row per approver per leave request — created when request is submitted. The full approval chain is resolved at submission time (including deputy substitution) and written here — it is not re-resolved later.

| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| leave_request_id | uuid FK | |
| approver_id | uuid FK | Resolved at submission time including deputy fallback |
| sequence | int | 1 = line manager, 2 = apex approver |
| status | enum | `pending`, `approved`, `rejected`, `delegated` |
| decision_notes | string | Nullable |
| decided_at | timestamp | Nullable |

#### `deputy_assignment`
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | The person being deputised for |
| deputy_id | uuid FK | The deputy |
| valid_from | date | |
| valid_to | date | Nullable for permanent assignments |
| is_permanent | bool | |
| is_temporary_override | bool | Short-term wizard-created rerouting |

**Reciprocity constraint:** enforced at application level and database constraint — deputy_id cannot appear as user_id in another row where the user_id of this row appears as deputy_id.

#### `audit_event`
Append-only. Never updated or deleted.
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| entity_id | uuid | ID of the affected record |
| entity_type | string | e.g. `leave_request`, `leave_balance`, `approval_step` |
| event_type | string | e.g. `request_submitted`, `approved`, `balance_adjusted`, `deputy_assigned` |
| actor_id | uuid FK | User who triggered the event |
| before_state | jsonb | Full snapshot of record before change |
| after_state | jsonb | Full snapshot of record after change |
| created_at | timestamp | Immutable |

#### `public_holiday_calendar`
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| subsidiary_id | uuid FK | |
| name | string | |
| holiday_date | date | |
| description | string | |

---

## 5. Approval Workflow

### Org tree and apex resolution
The department table is a self-referencing tree supporting unlimited nesting (e.g. Subsidiary > Region > District > Store > Team). Each node can optionally have an `apex_approver_id` set. This is the person who gives final sign-off for all leave requests originating from that subtree.

When a leave request is submitted, the system resolves the full two-step approval chain immediately:
1. **Line manager (sequence 1):** `department.default_approver_id` for the employee's department node.
2. **Apex approver (sequence 2):** Walk up the `parent_department_id` chain from the employee's department until a node with `apex_approver_id` is found. That person is the apex. If no apex is found before the root, the subsidiary HR Director is the fallback apex of last resort.

Both resolved approvers are written to `approval_step` rows at submission time. Deputy substitution is also resolved at this point (see below). The chain is not re-resolved after submission.

This means:
- A store manager can be the apex for their store — requests never leave the store.
- A regional manager can be apex for their region — requests from all stores in the region stop there.
- The HR Director only receives requests where no closer apex is configured.
- The HR Director remains the fallback and always retains visibility of all requests in their subsidiary.

### Standard flow
1. Employee submits leave request.
2. System resolves approval chain (line manager + apex) and creates `approval_step` rows.
3. Sequence-1 approver receives email notification and in-app alert.
4. Sequence-1 approves or rejects.
5. If approved at sequence-1, sequence-2 (apex) receives notification.
6. Both approvals required for final `approved` status.
7. If either rejects, request status becomes `rejected`. No partial approval state.

### Deputy rules
- Every approver should have a designated permanent deputy.
- Temporary overrides (wizard-created) take precedence over permanent deputies during their validity window.
- Reciprocal deputies are blocked: if A is B's deputy, B cannot be A's deputy. Enforced at application and database constraint level.
- One active deputy per person at any time (permanent or temporary override).
- Deputy is resolved at submission time and written to `approval_step.approver_id` — if the original approver returns from leave mid-workflow, the step is already assigned to the deputy and stays that way.

### Backdating
- Only users with role `hr_director` or `ceo` may submit or approve backdated leave requests.
- Backdated requests require a written reason.
- All backdated actions generate a flagged `audit_event`.

### Recall
- Approved leave can be recalled by the apex approver or HR Director.
- Recall triggers a notification to the employee.
- Balance is restored on recall.
- Recall generates an `audit_event`.

---

## 6. Rules Engine

Leave types have configurable rules stored in `leave_rule`. The following rule types are supported:

| Rule type | Description |
|---|---|
| `accrual_rate` | Days accrued per month; can be overridden per user in `leave_balance.accrual_rate` |
| `probation_block` | Block leave requests for N days after `user.start_date` |
| `max_consecutive_days` | Maximum consecutive days per single request |
| `min_notice_days` | Minimum advance notice required |
| `expiry_warning_days` | Trigger notification N days before balance expires |
| `sick_leave_cycle` | Sick leave resets on a 3-year cycle per BCEA (not annual) |
| `bcea_floor` | Minimum statutory entitlement — system rejects config below this value |

### BCEA compliance (South Africa)
- Annual leave: minimum 15 working days per leave cycle (enforced as floor).
- Sick leave: 30 days per 3-year cycle, first 6 days per year at full pay.
- Family responsibility leave: 3 days per year (fixed statutory entitlement).
- Maternity leave: 4 consecutive months, timing relative to expected due date.
- System will not allow subsidiary configuration below BCEA statutory floors for protected leave types.

### Leave year
- Configurable per subsidiary: `calendar` (Jan-Dec), `tax` (Mar-Feb in SA), or `anniversary` (per employee start date).
- Affects accrual reset, expiry calculation, and reporting periods.

### Working day calculation
- Leave duration is calculated in working days (Monday to Friday).
- Public holidays are excluded by default; this is a per-subsidiary switch.
- Half-day support: 0.5 days deducted, morning or afternoon noted.

### Leave liability
- Calculated as: `leave_balance.balance × (user.ctc / 260)` (260 = approximate working days per year).
- Reported at user, department, subsidiary, and holding company level.
- Used in monthly summary reports.

---

## 7. Notifications

All notifications are event-triggered email via Nodemailer SMTP. No digest emails except the monthly summary.

| Event | Recipients |
|---|---|
| Leave request submitted | Sequence-1 approver |
| Approved at sequence-1 | Sequence-2 approver |
| Fully approved | Employee |
| Rejected (at any stage) | Employee |
| Leave recalled | Employee |
| Deputy assigned (temporary) | Deputy, original approver |
| Balance expiry warning | Employee, HR Director |
| Monthly summary | Configured recipients per subsidiary (HR Director / CEO); holding company rollup to holding admin |

In-app notifications are displayed in the dashboard notification centre for all events above.

---

## 8. Reporting

### Dashboard (primary)
- Live leave calendar (team view per manager, full view per HR Director).
- Balance summary per employee.
- Upcoming leave and expiry warnings.
- Leave liability by department and subsidiary.
- Abuse detection flag (employees with high frequency of Monday/Friday leave) — available to HR Director, not surfaced to managers.

### Exports
- XLSX and PDF export for all reports.
- Monthly summary email (automated, once per month per subsidiary + holding co rollup).

---

## 9. User Management

### Roles
| Role | Scope | Permissions |
|---|---|---|
| `employee` | Own records | Submit requests, view own balance and history |
| `manager` | Direct reports | Approve/reject requests, view team calendar |
| `hr_director` | Subsidiary | Full subsidiary access, backdating, configuration |
| `ceo` | Subsidiary | Same as hr_director |
| `subsidiary_admin` | Subsidiary | System configuration, user management |
| `holding_admin` | All subsidiaries | Read-only cross-subsidiary view, holding co config |

### User creation
- Individual wizard capture.
- Bulk XLSX upload (template provided).
- Microsoft Entra ID sync (post-PoC, optional per subsidiary).

### XLSX import format
- Defined template with columns: full_name, email, department, role, start_date, ctc, leave_type overrides (optional).
- Validation on upload: duplicate emails, missing required fields, invalid dates flagged before import.

### Microsoft Entra SSO
- Not required day one.
- Architecture must support it per subsidiary (some subsidiaries may never use it).
- Implementation: Better Auth Microsoft provider, Entra OAuth2/OIDC flow.
- On first SSO login, system links Entra object ID to existing user record by email match.
- Subsidiaries without Entra continue to use email/password.

---

## 10. Deployment

### PoC
- Docker Compose on Raspberry Pi.
- Cloudflare Tunnel for external access (no port forwarding required).
- Accessed via Tailscale + SSH for admin.

### Production
- Docker Compose on Hetzner CX22 VPS (approx R150/month).
- Same Docker Compose config — only environment variables and volume mounts change.
- Railway is an alternative if lower DevOps overhead is preferred (higher cost).
- Postgres runs as a Docker service with volume-mounted data directory and regular pg_dump backups.

### Monorepo structure
```
joot/
  packages/
    types/          # Shared TypeScript types
    db/             # Prisma schema and migrations
  apps/
    api/            # Fastify backend
    web/            # React + Vite frontend
  docker-compose.yml
  .env.example
```

---

## 11. Open Items and Post-PoC Decisions

These items are known but not yet designed. Claude Code should flag when it encounters them and not make silent assumptions.

| Item | Status | Notes |
|---|---|---|
| Microsoft Entra SSO | Post-PoC | Optional per subsidiary. Architecture must support it from day one even if not active. Better Auth Microsoft provider, OAuth2/OIDC. On first SSO login, link Entra object ID to existing user by email match. |
| Overlap detection | Post-PoC | Alert or block when too many staff in the same team are off simultaneously. Threshold configurable per department. |
| Minimum staffing rules | Post-PoC | Related to overlap detection. Configurable minimum headcount per department node. |
| Leave handover capture | Post-PoC | Field on leave request to note who covers responsibilities during absence. |
| Railway vs Hetzner | Decision pending | Hetzner CX22 ~R150/month, self-managed. Railway higher cost, zero DevOps. Either works with Docker Compose. |
| `tree_path` sync on restructure | Must implement | When a department is renamed or its parent changes, all descendant `tree_path` values must be updated. Write a dedicated function for this. |
| Prisma multiSchema production readiness | Verify | Confirm `multiSchema` preview feature is stable enough for production use in Prisma version in use. If not, implement schema switching via `SET search_path` in a Prisma middleware layer instead. |
| Stripe billing | Remove | Inherited from reference stack. Not needed for Joot. Remove from docker-compose and dependencies. |
| Monthly summary email scheduler | Implement | BullMQ repeatable job, one per subsidiary, fires on configured day of month. Recipients configurable per subsidiary by HR Director. |
| Abuse detection algorithm | Implement (hidden) | Flag users with statistically high frequency of Monday or Friday leave. Surface only in HR Director dashboard, not visible to managers or employees. |

---

*End of document. Hand this to Claude Code with the instruction: "Read Section 0 first."*
