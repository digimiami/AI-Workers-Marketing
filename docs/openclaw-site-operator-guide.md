# OpenClaw · Site & operator guide (AiWorkers)

This document is for **people** who run AiWorkers in the browser: sign in, act as an **organization operator** (or admin), and use OpenClaw-backed features from the admin app.

Public machine-to-machine docs (tokens, `POST /api/v1/cloud/tools/run`) live at **`/docs/cloud-api`** on the deployed site (e.g. `https://www.aiworkers.vip/docs/cloud-api`).

---

## 1. Who can do what

| Role            | View agents / runs / schedules | Create schedules, run agents, approve | Cloud API tokens (Settings) |
|-----------------|--------------------------------|----------------------------------------|------------------------------|
| **Viewer**      | Usually yes (org member)       | No                                     | No                           |
| **Operator**    | Yes                            | Yes                                    | Yes                          |
| **Admin**       | Yes                            | Yes                                    | Yes                          |

OpenClaw **admin APIs** under `/api/admin/openclaw/*` require at least **org member** for reads and **operator or admin** for writes (runs, schedules, sync, approvals decisions where applicable).

---

## 2. Connect to the site

1. Open your deployment, e.g. **`https://www.aiworkers.vip`** (or your preview URL).
2. **Sign in** (Supabase auth). Complete onboarding if prompted so you belong to an **organization**.
3. Confirm you are **operator** or **admin** for that org (team/org settings or ask an admin to invite you with the right role).

If you see **403 Forbidden** on OpenClaw actions, your account is likely **viewer** or not a member of the selected organization.

---

## 3. Where OpenClaw shows up in the admin UI

Use the left nav (names may vary slightly by build):

| Area | Path | Purpose |
|------|------|---------|
| **Growth Engine** | `/admin/growth-engine` | Architecture map, subsystem health, variant scoring, optimization loop. |
| **AI Workers** | `/admin/ai-workers` | List agents, **sync** catalog from backend, **run** an agent, manage **schedules**, link **campaign agents**. |
| **OpenClaw tools** | `/admin/openclaw/tools` | Try **tool** calls against the Cloud tools API from the UI (debugging). |
| **Approvals** | `/admin/approvals` | Queue for human decisions on runs that require approval. |
| **Campaign automation** | `/admin/campaigns/<campaignId>/automation` | Per-campaign automation toggles + view **schedules** for that campaign. |
| **Settings** | `/admin/settings` | **Cloud API tokens** for external OpenClaw (or other clients) calling **into** AiWorkers. |
| **Dev health** | `/admin/dev/health` | Quick read on OpenClaw **stub vs HTTP** backend and DB counts. |

---

## 4. Typical operator workflows

### Sync agents and templates

1. Go to **`/admin/ai-workers`**.
2. Ensure the correct **organization** is selected (same pattern as other admin pages).
3. Use **sync** (calls the admin API that pulls definitions from the configured OpenClaw HTTP backend when `OPENCLAW_BASE_URL` is set; otherwise the app uses a **stub**).

### Run an agent once

1. **`/admin/ai-workers`** → choose an agent → **run** (POST to `/api/admin/openclaw/agents/<agentId>/run` with `organizationId` and optional `campaignId` / `input`).

### Schedules (cron)

1. **`/admin/ai-workers`** → schedules section, or campaign automation page for a filtered view.
2. Create/edit schedules via the UI (operators). Cron runners use server cron + DB; ensure production **migrations** include scheduling tables.

### Approvals

1. **`/admin/approvals`** → open an item → approve or reject according to your process.

---

## 5. Database prerequisites (production)

Several features persist to Supabase (e.g. `campaign_automation_settings`, orchestration tables). If saves or OpenClaw-adjacent pages fail with **503** / “table … not in schema cache”, apply **all** pending migrations for this repo to the **same** Supabase project referenced by `SUPABASE_URL` / keys on Vercel, then retry.

---

## 6. Extension noise in the browser

Scripts named like **`page_all.js`**, **`feature_collector.js`**, or commands such as **`clearCart`** are almost always **third-party browser extensions**, not AiWorkers. If the console is noisy, test in a **private window** with extensions disabled.

---

## 7. Growth Engine (architecture + health)

- **Dashboard**: `/admin/growth-engine` — shows the architecture diagram, per-layer health for a selected campaign, **Score variants** (heuristic AI scoring stored on the campaign), and **Run optimization loop** (collect analytics → run optimization JSON → append cycle to campaign metadata).
- **Full audit (diagram vs code)**: see **`docs/GROWTH_ENGINE_ARCHITECTURE.md`** in this repository (includes the same diagram under `docs/assets/`).

---

## 8. Related doc

- **External OpenClaw server** (AiWorkers calls *out* to your provider): see **`openclaw-bridge-deployment.md`** in this folder.
