## AiWorkers.vip QA Checklist (Release Gate)

This checklist is designed to validate the app as a **working operating system**, not just UI.

### Preconditions
- Supabase migrations applied (all files in `supabase/migrations/`)
- `.env.local` set (Supabase URL/keys; optional Resend/OpenClaw)
- You can log in and have at least one organization

---

## Scenario 1: login → pick org → create campaign
- **Auth**: Visit `/admin` while logged out → redirected to `/login`
- **Org context**: After login, if no org cookie, `/admin/*` routes redirect to `/admin/onboarding`
- **Create campaign**: `/admin/campaigns` → create campaign
- **Persistence**: Refresh page, campaign remains
- **Org scoping**: Switch org (onboarding) and verify campaign list changes
- **Audit logs**: `/admin/logs` shows `campaign.created`
- **Error handling**: invalid payload shows toast/error

## Scenario 2: create funnel → add 3 steps → link to campaign
- Create funnel in `/admin/funnels`
- Add 3 steps via step editor dialog
- Reorder steps (up/down) and refresh → order persists
- Link funnel to campaign (create-time or edit if enabled)
- **Persistence**: refresh → step count correct
- **Audit logs**: funnel/step edits are logged

## Scenario 3: create content asset → move through statuses
- Create content asset in `/admin/content` (with campaign + funnel selected)
- Change status draft → approved → scheduled → published → archived
- **Persistence**: refresh → status persists
- **Queue**: when scheduled, verify `content_publish_queue` has a new row (if platform configured)
- **Audit logs**: content create/update/status changes are logged

## Scenario 4: submit lead through public form → appears in admin
- Trigger `POST /api/leads/capture` (via public form or direct request)
- Verify lead appears in `/admin/leads`
- Verify lead has correct org/campaign attribution
- **Audit logs**: `lead.captured`

## Scenario 5: assign lead to email sequence → logs created
- Create at least one template + sequence + step in `/admin/email`
- In `/admin/leads`, enroll a lead into a sequence
- Verify queued email logs appear in `/admin/email` → Logs tab
- **Audit logs**: enrollment + queued logs are present

## Scenario 6: enable AI worker → edit prompt → run worker
- `/admin/ai-workers` enable worker and toggle approval requirement
- `/admin/ai-workers/prompts/[agentId]` edit default template prompt → refresh page → changes persist
- Trigger run from `/admin/ai-workers`
- **Audit logs**: worker config changes and run creation

## Scenario 7: worker run creates logs/output
- Run lifecycle:
  - run exists in `/admin/ai-workers/runs`
  - run detail shows input/output/errors
  - logs show “Run started” + “Provider finished/error”

## Scenario 8: approval-required run enters approval queue
- Set a worker to require approval, then run it
- `/admin/approvals` shows a pending approval tied to the run

## Scenario 9: approve item → status updates correctly
- Approve from `/admin/approvals`
- Verify run status updates to `approved`
- Reject path: reject with reason → run `rejected` + reason stored
- **Audit logs**: `approval.decision`

## Scenario 10: analytics dashboard updates from real events
- Trigger `POST /api/events` with an org/campaign context
- `/admin/analytics` shows updated KPIs/charts for the selected range

## Scenario 11: logs page shows all related actions
- `/admin/logs` shows audit entries for:
  - campaign create/update/delete
  - funnel step operations
  - lead capture + lead updates
  - email enrollment/log generation
  - approval decisions

## Scenario 12: refresh all pages and verify persistence
- Refresh each admin module page; confirm state is DB-backed (not local-only)
- Verify org context remains correct across refreshes

