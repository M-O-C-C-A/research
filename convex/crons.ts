import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.cron(
  "weekly evidence-first lead scan",
  "0 6 * * 1",
  internal.leadScans.runWeeklyInternal,
  {}
);

export default crons;
