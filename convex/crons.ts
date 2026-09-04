import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.cron(
  "weekly evidence-first lead scan",
  "0 6 * * 1",
  internal.leadScans.runWeeklyInternal,
  {},
);

crons.cron(
  "daily continuous opportunity source dispatcher",
  "0 5 * * *",
  internal.continuousOpportunityEngine.runDueSourceDispatcherInternal,
  {},
);

crons.cron(
  "daily continuous opportunity alert delivery",
  "20 5 * * *",
  internal.continuousOpportunityEngine.processPendingAlertDeliveriesInternal,
  {},
);

crons.cron(
  "daily stale evidence demotion",
  "40 5 * * *",
  internal.evidenceFunnel.expireStaleUncontactedInternal,
  {},
);

crons.cron(
  "quarterly parked evidence review",
  "0 7 1 1,4,7,10 *",
  internal.evidenceEngineV11.reopenChangedParkedInternal,
  {},
);

export default crons;
