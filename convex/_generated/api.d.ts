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
import type * as companyImportActions from "../companyImportActions.js";
import type * as constants from "../constants.js";
import type * as countryCapabilityProfiles from "../countryCapabilityProfiles.js";
import type * as dashboard from "../dashboard.js";
import type * as decisionOpportunities from "../decisionOpportunities.js";
import type * as decisionOpportunityEngine from "../decisionOpportunityEngine.js";
import type * as discovery from "../discovery.js";
import type * as discoveryJobs from "../discoveryJobs.js";
import type * as distributorFit from "../distributorFit.js";
import type * as drugEntityLinkUtils from "../drugEntityLinkUtils.js";
import type * as drugEntityLinks from "../drugEntityLinks.js";
import type * as drugs from "../drugs.js";
import type * as evidenceEnrichment from "../evidenceEnrichment.js";
import type * as fileProcessing from "../fileProcessing.js";
import type * as files from "../files.js";
import type * as gapAnalysis from "../gapAnalysis.js";
import type * as gapCompanyMatches from "../gapCompanyMatches.js";
import type * as gapFlow from "../gapFlow.js";
import type * as gapIdentity from "../gapIdentity.js";
import type * as gapOpportunities from "../gapOpportunities.js";
import type * as openaiResearch from "../openaiResearch.js";
import type * as opportunities from "../opportunities.js";
import type * as productIntelligence from "../productIntelligence.js";
import type * as productIntelligenceActions from "../productIntelligenceActions.js";
import type * as productIntelligenceHelpers from "../productIntelligenceHelpers.js";
import type * as productMarketAnalysis from "../productMarketAnalysis.js";
import type * as registrationImportActions from "../registrationImportActions.js";
import type * as registrationImports from "../registrationImports.js";
import type * as reports from "../reports.js";
import type * as research from "../research.js";
import type * as researchInputs from "../researchInputs.js";
import type * as researchLifecycle from "../researchLifecycle.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ai: typeof ai;
  bdActivities: typeof bdActivities;
  companies: typeof companies;
  companyImportActions: typeof companyImportActions;
  constants: typeof constants;
  countryCapabilityProfiles: typeof countryCapabilityProfiles;
  dashboard: typeof dashboard;
  decisionOpportunities: typeof decisionOpportunities;
  decisionOpportunityEngine: typeof decisionOpportunityEngine;
  discovery: typeof discovery;
  discoveryJobs: typeof discoveryJobs;
  distributorFit: typeof distributorFit;
  drugEntityLinkUtils: typeof drugEntityLinkUtils;
  drugEntityLinks: typeof drugEntityLinks;
  drugs: typeof drugs;
  evidenceEnrichment: typeof evidenceEnrichment;
  fileProcessing: typeof fileProcessing;
  files: typeof files;
  gapAnalysis: typeof gapAnalysis;
  gapCompanyMatches: typeof gapCompanyMatches;
  gapFlow: typeof gapFlow;
  gapIdentity: typeof gapIdentity;
  gapOpportunities: typeof gapOpportunities;
  openaiResearch: typeof openaiResearch;
  opportunities: typeof opportunities;
  productIntelligence: typeof productIntelligence;
  productIntelligenceActions: typeof productIntelligenceActions;
  productIntelligenceHelpers: typeof productIntelligenceHelpers;
  productMarketAnalysis: typeof productMarketAnalysis;
  registrationImportActions: typeof registrationImportActions;
  registrationImports: typeof registrationImports;
  reports: typeof reports;
  research: typeof research;
  researchInputs: typeof researchInputs;
  researchLifecycle: typeof researchLifecycle;
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
