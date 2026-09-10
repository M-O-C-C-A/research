export const ASSESSMENT_SOURCES = [
  {
    name: "FDA Drugs@FDA",
    url: "https://www.accessdata.fda.gov/scripts/cder/daf/",
  },
  {
    name: "FDA Novel Drug Approvals",
    url: "https://www.fda.gov/drugs/new-drugs-fda-cders-new-molecular-entities-and-new-therapeutic-biological-products",
  },
  { name: "EMA medicines", url: "https://www.ema.europa.eu/en/medicines" },
  {
    name: "BfArM AMIce",
    url: "https://www.bfarm.de/EN/Medicinal-products/Information-on-medicinal-products/Research-medicinal-products/AMIce/_node.html",
  },
  {
    name: "UAE MOHAP",
    url: "https://mohap.gov.ae/en/w/registered-medications-list",
  },
  { name: "KSA SFDA", url: "https://www.sfda.gov.sa/en" },
  {
    name: "SFDA registered drugs",
    url: "https://www.sfda.gov.sa/en/drugs-list",
  },
  { name: "NUPCO tenders", url: "https://www.nupco.com/en/tenders/" },
  {
    name: "Egypt EDA supplied directory link",
    url: "https://edaegypt.gov.eg/en/eda-publications/the-egyptian-drug-registry/",
  },
  {
    name: "Egypt EDA registration search",
    url: "https://eservices.edaegypt.gov.eg/EDASearch/SearchRegDrugs.aspx",
  },
  {
    name: "Lauer-Taxe strategic report",
    url: "https://go.pharmazie.com/de/lauer-taxe-und-die-zukunft-der-arzneimitteldaten-ein-strategie-report-fuer-die-digitale-transformation-im-gesundheitswesen/",
    directional: true,
  },
  {
    name: "CGM Lauer",
    url: "https://portal.cgmlauer.cgm.com/LF/default.aspx?p=12000",
    directional: true,
  },
  { name: "NHSBSA", url: "https://www.nhsbsa.nhs.uk/" },
  { name: "CMS", url: "https://www.cms.gov/" },
  { name: "WHO", url: "https://www.who.int/" },
  { name: "Evaluate", url: "https://www.evaluate.com/", directional: true },
  { name: "Clarivate", url: "https://clarivate.com/", directional: true },
] as const;

export async function checkAssessmentSources() {
  return await Promise.all(
    ASSESSMENT_SOURCES.map(async (source) => {
      const checkedAt = Date.now();
      try {
        const response = await fetch(source.url, {
          signal: AbortSignal.timeout(12000),
          headers: { "User-Agent": "KemedicaResearch/1.2" },
        });
        // Read only a bounded preview; a 200 response may still be a login/challenge.
        const reader = response.body?.getReader();
        let preview = "";
        if (reader) {
          const decoder = new TextDecoder();
          while (preview.length < 32000) {
            const part = await reader.read();
            if (part.done) break;
            preview += decoder.decode(part.value, { stream: true });
          }
          await reader.cancel();
        }
        const restricted =
          [401, 403, 429].includes(response.status) ||
          /verify you are human|access denied|captcha|just a moment/i.test(
            preview,
          );
        const directional = "directional" in source && source.directional;
        return {
          name: source.name,
          url: source.url,
          finalUrl: response.url,
          checkedAt,
          httpStatus: response.status,
          status: restricted
            ? ("restricted" as const)
            : !response.ok
              ? ("unavailable" as const)
              : directional
                ? ("directional" as const)
                : ("accessible" as const),
          note: restricted
            ? "Access restricted; use an authorized export or documented manual check."
            : !response.ok
              ? `HTTP ${response.status}; no product conclusion.`
              : directional
                ? "Directional or licensed reference. No product price extracted from landing-page access."
                : response.url.includes("formulary")
                  ? "Redirects to formulary, not registration search. Use the EDA registration search for verification."
                  : "Landing page reachable. Product-level extraction and verification are separate steps.",
        };
      } catch (error) {
        return {
          name: source.name,
          url: source.url,
          checkedAt,
          status: "unavailable" as const,
          note:
            error instanceof Error
              ? error.message
              : "Access failed; no product conclusion.",
        };
      }
    }),
  );
}
