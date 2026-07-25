# Close Phase 3 Gaps

Three concrete gaps remain from the last review. This plan closes each one end-to-end and leaves everything testable in the preview.

## 1. Unified Leaves & Attendance page (Employee portal)

New tab `Leaves & Attendance` in `/employee` that consolidates today's separate leave list into one MNC-style view:

- **Attendance Calendar** (month grid): each day color-coded — present / absent / leave / regularized / pending. Click a day to open a details popover with check-in/out and hours.
- **Request Leave** form (existing) surfaced in a dialog from the calendar toolbar.
- **Request Regularization** form: pick a missed date, enter check-in/out + reason, submits to `attendance_records` with `status = pending_regularization`.
- **My Requests** list (leaves + regularizations) with cancel action.

Backend: extend `attendance.functions.ts` with `submitRegularization`, `listMyAttendance(month)`, and approver-side `listPendingRegularizations` + `decideRegularization`. Uses the existing `attendance_records` table — no migration needed.

Manager/HR portal gets a **Regularization Approvals** panel alongside the existing Leave Approvals.

## 2. HR Task Manager (HR portal)

New tab in `/hr` for internal HR duties, distinct from candidate work:

- Create HR task (title, description, due date, assignee = any HR/admin user)
- Kanban-style status: `todo` / `in_progress` / `done`
- Reuses the existing `employee_tasks` table with a `category = 'hr_internal'` filter so no schema change is needed; server functions gate on `has_role(hr|admin)`.

## 3. Automated tests for document decisions + signed URLs

Add integration-style unit tests (Vitest, pure logic — no live Supabase) covering the decision path:

- **Document decision handler**: mock `supabase` client and assert Approve/Reject/Request-Changes writes correct status, decision_note, version bump, audit log row, and notification row.
- **Bulk decision**: assert N documents updated in one call, one audit entry per doc.
- **Signed URL access**: assert HR helper calls `storage.from('onboarding-docs').createSignedUrl(path, ttl)` with the correct bucket, path, and short TTL; assert non-HR callers are rejected before the storage call.

To make this testable, extract the decision logic in `hr.functions.ts` into a pure `applyDocumentDecision(deps, input)` helper (deps = `{ supabase, actorId, roles }`) so tests can inject a mock supabase. Same for `getOnboardingDocSignedUrl`.

New file: `src/lib/__tests__/hr-decisions.test.ts` — target ~10 tests, brings suite to ~29.

## Technical notes

- No new migrations. All three gaps map onto existing tables (`attendance_records`, `employee_tasks`, `onboarding_documents`).
- New server functions all use `requireSupabaseAuth` + explicit role check via `has_role` RPC or `user_roles` read; UI gates additionally via `route-access.ts`.
- Calendar built with existing shadcn `Calendar` + a lightweight day-cell renderer; no new deps.
- Kanban uses simple status-column layout (not drag-and-drop) to keep scope tight; matches existing task UI in admin.

## Deliverables checklist

- [ ] `src/lib/attendance.functions.ts` — regularization + monthly fetch + approver actions
- [ ] `src/components/employee/AttendanceCalendar.tsx` + `RegularizationDialog.tsx`
- [ ] `/employee` — new "Leaves & Attendance" tab wiring the above
- [ ] `/manager` + `/hr` — Regularization Approvals panel
- [ ] `src/lib/hrTasks.functions.ts` + `/hr` "HR Tasks" tab (Kanban)
- [ ] `src/lib/hr.functions.ts` — extract `applyDocumentDecision` + `getOnboardingDocSignedUrl` as testable pure helpers
- [ ] `src/lib/__tests__/hr-decisions.test.ts` — ~10 new tests
- [ ] Run `bun run test` — all suites green
- [ ] End-to-end walkthrough note at the end so you can click through in preview

Approve and I'll ship it in one pass.
