# Cloud Functions — deferred

This folder is a placeholder. Cloud Functions require the Firebase **Blaze**
(pay-as-you-go) plan, same as Firestore did — so we're not deploying this yet
since you chose to avoid billing for now.

For now, logic that would normally live here (PRI calculation, auto
escalation notifications, alumni migration) runs **client-side** in the web
app instead — see `apps/web/src/lib/computeReadiness.ts` (added in the
Mentor Progress module).

When you're ready to enable billing later, we move this logic here for a
more reliable, tamper-proof version — same calculation, just triggered
server-side on every write instead of computed in the browser.
