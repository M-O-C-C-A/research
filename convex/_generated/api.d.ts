/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ai from "../ai.js";
import type * as bdActivities from "../bdActivities.js";
import type * as companies from "../companies.js";
import type * as constants from "../constants.js";
import type * as dashboard from "../dashboard.js";
import type * as decisionOpportunities from "../decisionOpportunities.js";
import type * as decisionOpportunityEngine from "../decisionOpportunityEngine.js";
import type * as discovery from "../discovery.js";
import type * as discoveryJobs from "../discoveryJobs.js";
import type * as distributorFit from "../distributorFit.js";
import type * as drugEntityLinks from "../drugEntityLinks.js";
import type * as drugs from "../drugs.js";
import type * as fileProcessing from "../fileProcessing.js";
import type * as files from "../files.js";
import type * as gapAnalysis from "../gapAnalysis.js";
import type * as gapCompanyMatches from "../gapCompanyMatches.js";
import type * as gapFlow from "../gapFlow.js";
import type * as gapOpportunities from "../gapOpportunities.js";
import type * as openaiResearch from "../openaiResearch.js";
import type * as opportunities from "../opportunities.js";
import type * as reports from "../reports.js";
import type * as research from "../research.js";
import type * as researchInputs from "../researchInputs.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ai: typeof ai;
  bdActivities: typeof bdActivities;
  companies: typeof companies;
  constants: typeof constants;
  dashboard: typeof dashboard;
  decisionOpportunities: typeof decisionOpportunities;
  decisionOpportunityEngine: typeof decisionOpportunityEngine;
  discovery: typeof discovery;
  discoveryJobs: typeof discoveryJobs;
  distributorFit: typeof distributorFit;
  drugEntityLinks: typeof drugEntityLinks;
  drugs: typeof drugs;
  fileProcessing: typeof fileProcessing;
  files: typeof files;
  gapAnalysis: typeof gapAnalysis;
  gapCompanyMatches: typeof gapCompanyMatches;
  gapFlow: typeof gapFlow;
  gapOpportunities: typeof gapOpportunities;
  openaiResearch: typeof openaiResearch;
  opportunities: typeof opportunities;
  reports: typeof reports;
  research: typeof research;
  researchInputs: typeof researchInputs;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
