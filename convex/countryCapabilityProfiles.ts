export type CountryCapabilityProfile = {
  dossierRoute: string;
  localAgentRequired: boolean;
  legalisationNeeds: string[];
  biologicConstraints: string[];
  expectedTimeline: string;
  marketAccessRoutes: Array<
    "public_tender" | "private_hospital" | "retail_pharmacy" | "specialty_center" | "named_patient"
  >;
  keyBlockers: string[];
};

const DEFAULT_PROFILE: CountryCapabilityProfile = {
  dossierRoute: "Full national registration with local regulatory representation.",
  localAgentRequired: true,
  legalisationNeeds: ["CPP", "GMP", "legalized dossier set as requested locally"],
  biologicConstraints: ["Cold-chain and local comparability expectations may extend review."],
  expectedTimeline: "9-15 months",
  marketAccessRoutes: ["public_tender", "private_hospital"],
  keyBlockers: ["Local MAH setup", "document legalization", "public-sector procurement timing"],
};

export const COUNTRY_CAPABILITY_PROFILES: Record<string, CountryCapabilityProfile> = {
  "Saudi Arabia": {
    dossierRoute: "SFDA national registration with local authorized representative and structured dossier review.",
    localAgentRequired: true,
    legalisationNeeds: ["CPP", "GMP", "legalized manufacturer documents"],
    biologicConstraints: ["Biologics and biosimilars face heavier technical review and comparability scrutiny."],
    expectedTimeline: "9-14 months",
    marketAccessRoutes: ["public_tender", "private_hospital", "specialty_center"],
    keyBlockers: ["Local agent/MAH alignment", "tender access", "pricing approval sequence"],
  },
  UAE: {
    dossierRoute: "MOHAP registration, often via local partner / agent plus emirate-level commercialization planning.",
    localAgentRequired: true,
    legalisationNeeds: ["CPP", "GMP", "legalized product and manufacturer documents"],
    biologicConstraints: ["Biologics often need stronger cold-chain and technical documentation packages."],
    expectedTimeline: "8-12 months",
    marketAccessRoutes: ["private_hospital", "retail_pharmacy", "public_tender"],
    keyBlockers: ["Agent structure", "private-vs-public route clarity", "pricing path"],
  },
  Jordan: {
    dossierRoute: "JFDA registration with local representative and relatively practical dossier path.",
    localAgentRequired: true,
    legalisationNeeds: ["CPP", "GMP"],
    biologicConstraints: ["Specialty and biologic review can still lengthen approval."],
    expectedTimeline: "6-10 months",
    marketAccessRoutes: ["private_hospital", "retail_pharmacy", "public_tender"],
    keyBlockers: ["Local representation", "price referencing", "tender timing"],
  },
  Qatar: {
    dossierRoute: "National registration plus institutional procurement / formulary route where applicable.",
    localAgentRequired: true,
    legalisationNeeds: ["CPP", "GMP", "legalized corporate documents"],
    biologicConstraints: ["Hospital and institutional adoption matters as much as registration."],
    expectedTimeline: "8-12 months",
    marketAccessRoutes: ["public_tender", "private_hospital", "specialty_center"],
    keyBlockers: ["Formulary route", "institutional access", "small-volume economics"],
  },
  Egypt: {
    dossierRoute: "National registration with pricing and public access considerations often affecting launch timing.",
    localAgentRequired: true,
    legalisationNeeds: ["CPP", "GMP", "legalized dossier documents"],
    biologicConstraints: ["Complex biologics may need longer technical and access planning."],
    expectedTimeline: "10-18 months",
    marketAccessRoutes: ["public_tender", "private_hospital", "retail_pharmacy"],
    keyBlockers: ["Pricing pressure", "public procurement path", "timeline variability"],
  },
};

export function getCountryCapabilityProfile(country: string): CountryCapabilityProfile {
  return COUNTRY_CAPABILITY_PROFILES[country] ?? DEFAULT_PROFILE;
}
