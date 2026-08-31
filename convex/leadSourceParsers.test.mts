import assert from "node:assert/strict";
import test from "node:test";
import {
  parseEtimadTenderHtml,
  parseEgyptEprocurementHtml,
  parseNupcoTendersHtml,
  parseSfdaShortageHtml,
} from "./leadSourceParsers.ts";

test("parses a current SFDA shortage row as an official product signal", () => {
  const signals = parseSfdaShortageHtml({
    html: `
      <table><tr><th>Generic Name</th><th>Availability Status</th><th>Trade name number</th></tr>
      <tr><td>ABIRATERONE ACETATE</td><td>Unavailable</td><td>4</td></tr></table>
    `,
    sourceUrl: "https://www.sfda.gov.sa/en/currentlyInShortageList",
  });

  assert.equal(signals.length, 1);
  assert.equal(signals[0]?.signalType, "shortage");
  assert.deepEqual(signals[0]?.productTerms, ["ABIRATERONE ACETATE"]);
  assert.equal(signals[0]?.parsedFacts.tradeNumber, "4");
});

test("parses NUPCO tender identifiers and deadlines", () => {
  const signals = parseNupcoTendersHtml({
    html: `
      Tender ID NDP0654/26 Direct Purchase Supply of oncology medicines
      Submission Deadline: 28/07/2026 Bid Opening: 28/07/2026
    `,
    sourceUrl: "https://www.nupco.com/tenders/tenders-list/",
  });

  assert.equal(signals.length, 1);
  assert.equal(signals[0]?.externalId, "NDP0654/26");
  assert.equal(signals[0]?.signalType, "tender");
  assert.equal(signals[0]?.deadline, Date.UTC(2026, 6, 28));
});

test("requires both a public Etimad competition identifier and name", () => {
  const signals = parseEtimadTenderHtml({
    html: "Competition Number: PHA-2026-08-01 | Competition Name: Supply of hospital medicines | Submission Deadline: 29/03/2026",
    sourceUrl: "https://tenders.etimad.sa/Tender/example",
  });

  assert.equal(signals.length, 1);
  assert.equal(signals[0]?.externalId, "PHA-2026-08-01");
  assert.equal(signals[0]?.title, "Supply of hospital medicines");
});

test("fails closed for incomplete Etimad details", () => {
  const signals = parseEtimadTenderHtml({
    html: "Competition Number: PHA-2026-08-01",
    sourceUrl: "https://tenders.etimad.sa/Tender/example",
  });

  assert.deepEqual(signals, []);
});

test("keeps only product-specific Egyptian public procurement notices", () => {
  const signals = parseEgyptEprocurementHtml({
    html: `
      <a onclick="fnMoveOpDetail('PUP/123/2026/000001-00', 'O')">
        <div class="subject">Procurement of medicines: abiraterone acetate</div>
        <div class="data2">29/08/2026</div>
      </a>
      <a onclick="fnMoveOpDetail('PUP/123/2026/000002-00', 'O')">
        <div class="subject">Consultancy services for a new building</div>
        <div class="data2">29/08/2026</div>
      </a>
    `,
    sourceUrl: "https://www.eps-gags.gov.eg/pt/main.do",
  });

  assert.equal(signals.length, 1);
  assert.equal(signals[0]?.country, "Egypt");
  assert.equal(signals[0]?.signalType, "procurement");
  assert.equal(signals[0]?.externalId, "PUP/123/2026/000001-00");
  assert.ok(signals[0]?.productTerms.includes("abiraterone acetate"));
});
