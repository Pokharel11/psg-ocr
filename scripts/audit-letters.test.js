/*
 * Tests for the audit letter generator (spec section 12). Run: npm test
 * Uses the SAME core the browser uses (assets/js/audit-letters-core.js) and the
 * SAME wording file (audit-letters.yaml).
 */
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const AuditCore = require("../assets/js/audit-letters-core.js");
const AuditRender = require("../assets/js/audit-letters-render.js");

const ROOT = path.resolve(__dirname, "..");
const rules = yaml.load(fs.readFileSync(path.join(ROOT, "audit-letters.yaml"), "utf8"));
// Entity vocabulary + partners live in the shared file (read by Audit and Bank Docs).
const shared = yaml.load(fs.readFileSync(path.join(ROOT, "data", "entities.yaml"), "utf8"));
rules.entities = shared.entities;
rules.partners = shared.partners;
const TEMPLATE = fs.readFileSync(path.join(ROOT, "templates", "audit-letter-template.docx"));

let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log("  PASS  " + name); } else { fail++; console.log("  FAIL  " + name + (extra ? "\n        " + extra : "")); } }
function eq(name, a, b) { ok(name, a === b, "expected: " + JSON.stringify(b) + "\n        got:      " + JSON.stringify(a)); }

function norm(s) {
  return s.split("\n").filter(function (l) { return !l.trim().startsWith("#"); }).join("\n")
    .replace(/[‘’′]/g, "'").replace(/[“”″]/g, '"').replace(/[–—]/g, "-")
    .replace(/\s+/g, " ").trim();
}
function fullText(doc) {
  return [AuditCore.letterText(doc.appointment), AuditCore.letterText(doc.engagement), AuditCore.letterText(doc.mrl)].join("\n");
}

// The agreed corrections (section 9 + #13 + a/b/c), applied to the anonymized reference
// so it equals what the generator should produce. Each is a fix the partner may reject.
const CORRECTIONS = [
  ["Chartered Accountant Kathmandu", "Chartered Accountants Kathmandu"],       // 1
  ["management of the PSG Private Limited This includes", "management of PSG Private Limited. This includes"], // 2 + 14
  ["law of land", "law of the land"],                                           // 3
  ["Company Act, 2063", "Companies Act, 2063"],                                 // 4
  ["Company Act 2063 (1st amendment 2074)", "Companies Act, 2063 (as amended)"],// 4 + decision 4
  ["Income Tax Act 2058", "Income Tax Act, 2058"],                              // 5
  ["Income tax act, 2058", "Income Tax Act, 2058"],                             // 5
  ["Yours Faithfully,", "Yours faithfully,"],                                   // 6
  ["disposed off", "disposed of"],                                             // 7
  ["who's right to receive", "whose right to receive"],                         // 8
  ["provided to staffs with are included", "provided to staff are included"],    // 15 (b)
  ["staffs", "staff"],                                                          // 9
  ["Dear Sir,", "Dear Sir/Madam,"],                                             // 10
  ["The Shareholder PSG", "The Shareholders PSG"],                              // 11
  ["and Statement of Income, Statement of Changes", "and Statement of Profit or Loss and Other Comprehensive Income, Statement of Changes"], // 13
  ["OTHER MATTERS", "Other Matters"],                                           // 16 (c)
  ["the Company's Board of Director", "the company's Board of Director"],        // {noun} is lower-case "company"
  // Dates -> section 5 format (12)
  ["Date: Ashad 25th, 2083", "Date: 25th Ashad, 2083"],
  ["32nd Ashad 2083", "32nd Ashad, 2083"],
  ["dated 25th Ashad 2083", "dated 25th Ashad, 2083"],
  ["Date: 26th Ashad 2083", "Date: 26th Ashad, 2083"],
  ["13th Ashoj 2083", "13th Ashoj, 2083"],
];
function applyCorrections(s) { CORRECTIONS.forEach(function (c) { s = s.split(c[0]).join(c[1]); }); return s; }

const base = {
  entityType: "Company", entityName: "PSG Private Limited", entityAddress: "Kathmandu, Nepal",
  signatoryName: "Sujan Timalsina", signatoryDesignation: "Chairperson",
  appointmentBS: { y: 2083, m0: 2, day: 25 }, fromFY: 2082, toFY: 2082,
  fee: 140000, feeBasis: "total", vat: "exclusive", framework: "NFRS",
  auditorName: "Gaurav Pokharel", auditorTitle: "Mr.", auditorDesignation: "Partner",
  firmName: "P.S.G. & Associates", firmCity: "Kathmandu",
  mrlBS: { y: 2083, m0: 5, day: 13 }, grouping: "international", highlight: false,
};

console.log("Audit letter tests (spec section 12):\n");

// 1) PARITY
(function () {
  const doc = AuditCore.generate(base, rules);
  const got = norm(fullText(doc));
  const expected = applyCorrections(norm(fs.readFileSync(path.join(ROOT, "scripts", "reference-anonymized.txt"), "utf8")));
  if (got === expected) { pass++; console.log("  PASS  1. Parity with corrected reference (Company + NFRS)"); }
  else {
    fail++;
    // Find first divergence for a readable message.
    let i = 0; while (i < got.length && i < expected.length && got[i] === expected[i]) i++;
    console.log("  FAIL  1. Parity with corrected reference");
    console.log("        first diff at char " + i + ":");
    console.log("        expected: ..." + JSON.stringify(expected.slice(Math.max(0, i - 40), i + 60)));
    console.log("        got:      ..." + JSON.stringify(got.slice(Math.max(0, i - 40), i + 60)));
  }
  // engagement date + FY end facts
  const engText = AuditCore.letterText(doc.engagement);
  ok("1. engagement date 26th Ashad, 2083", engText.indexOf("26th Ashad, 2083") !== -1);
  ok("1. FY end 32nd Ashad, 2083", engText.indexOf("32nd Ashad, 2083") !== -1);
  ok("1. FY end 16th July 2026 (MRL)", AuditCore.letterText(doc.mrl).indexOf("16th July 2026") !== -1);
})();

// 2) ROLLOVER
(function () {
  const a = AuditCore.addBSDays(2083, 2, 32, 1); // last day Ashad -> 1 Shrawan
  eq("2. last day Ashad -> 1 Shrawan", AuditCore.BS_MONTHS[a.m0] + " " + a.day, "Shrawan 1");
  const b = AuditCore.addBSDays(2082, 11, AuditCore.bsMonthDays(2082, 11), 1); // last day Chaitra -> 1 Baisakh next year
  eq("2. last day Chaitra -> 1 Baisakh next year", AuditCore.BS_MONTHS[b.m0] + " " + b.day + " " + b.y, "Baisakh 1 2083");
})();

// 3) RANGE
(function () {
  const r = Object.assign({}, base, { fromFY: 2079, toFY: 2082 });
  const doc = AuditCore.generate(r, rules);
  const eng = AuditCore.letterText(doc.engagement);
  // BS and AD year-ends computed from the calendar table (Ashad can be 31 or 32 days)
  const bsEnds = [2079, 2080, 2081, 2082].map(function (y) { var e = AuditCore.fyEnd(y); return AuditCore.formatBS(e.y, e.m0, e.day); });
  const adEnds = [2079, 2080, 2081, 2082].map(function (y) { return AuditCore.formatAD(AuditCore.fyEnd(y).adUTC); });
  ok("3. four distinct year-ends", new Set(bsEnds).size === 4);
  bsEnds.forEach(function (d) { ok("3. BS year-end " + d + " listed", eng.indexOf(d) !== -1); });
  const mrl = AuditCore.letterText(doc.mrl);
  adEnds.forEach(function (d) { ok("3. AD year-end " + d + " listed (MRL)", mrl.indexOf(d) !== -1); });
})();

// 4) FEE WORDS
[[140000, "One Lakh Forty Thousand Only"], [2550000.5, "Twenty Five Lakh Fifty Thousand and Paisa Fifty Only"],
 [10000000, "One Crore Only"], [100000, "One Lakh Only"], [99999, "Ninety Nine Thousand Nine Hundred Ninety Nine Only"]]
  .forEach(function (t) { eq("4. amountInWords(" + t[0] + ")", AuditCore.amountInWords(t[0]), t[1]); });

// 5) ORDINALS
eq("5. ordinals", [1, 2, 3, 11, 12, 13, 21, 22, 23, 31, 32].map(AuditCore.ordinal).join(" "),
  "1st 2nd 3rd 11th 12th 13th 21st 22nd 23rd 31st 32nd");

// 6) EACH ENTITY TYPE
[["Partnership Firm", "Sample Trading Firm"], ["Proprietorship Firm", "Example Proprietorship"], ["NPO", "Demo Social Organization"]]
  .forEach(function (pair) {
    const type = pair[0];
    const inp = Object.assign({}, base, {
      entityType: type, entityName: pair[1], signatoryName: "Test Signatory",
      framework: type === "NPO" ? "NAS for NPOs" : "NFRS",
    });
    const doc = AuditCore.generate(inp, rules);
    const txt = fullText(doc);
    // strip entity name and any statute title before scanning for "company"
    const ent = rules.entities[type];
    let scan = txt.split(pair[1]).join("").split(ent.statute).join("").split(ent.statute_with_amendment).join("");
    ok("6. no 'company' in " + type + " output", !/\bcompan/i.test(scan), (scan.match(/\bcompan\w*/i) || [""])[0]);
    // MRL 12 (bonus shares) and 21 (directors' declaration) absent
    ok("6. " + type + ": bonus-shares para absent", txt.indexOf("bonus shares/ dividend whose right") === -1);
    ok("6. " + type + ": directors' declaration para absent", txt.indexOf("declaration from the directors and senior management") === -1);
    // numbering continuous: count numbered blocks and ensure = 22 (24 - 2 company-only)
    const n = doc.mrl.filter(function (bl) { return bl.type === "numbered"; }).length;
    eq("6. " + type + ": numbered items", n, 22);
  });

// 7) NPO + NAS for NPOs
(function () {
  const inp = Object.assign({}, base, { entityType: "NPO", entityName: "Demo Social Organization", signatoryName: "Test Signatory", framework: "NAS for NPOs" });
  const txt = fullText(AuditCore.generate(inp, rules));
  ok("7. Income and Expenditure statement named", txt.indexOf("Statement of Income and Expenditure") !== -1);
  ok("7. Association Registration Act appears", txt.indexOf("Association Registration Act, 2034") !== -1);
})();

// 8) TEMPLATE PARITY: the reference-based .docx template, filled via the SAME
// data (AuditCore.templateData), must read identically to AuditCore.letterText()
// for every entity type and for a range. This ties the Word template (which the
// browser downloads) to the text that tests 1-7 verify against the reference.
(function () {
  function docxText(bytes) {
    const xml = new PizZip(bytes).file("word/document.xml").asText();
    return [...xml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)].map(function (m) {
      return [...m[0].matchAll(/<w:t(?: [^>]*)?>([\s\S]*?)<\/w:t>/g)].map(function (z) { return z[1]; }).join("");
    }).join("\n").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&quot;/g, '"');
  }
  function coreAll(inp) {
    const g = AuditCore.generate(inp, rules);
    return [AuditCore.letterText(g.appointment), AuditCore.letterText(g.engagement), AuditCore.letterText(g.mrl)].join("\n");
  }
  function numberedCount(bytes) {
    const xml = new PizZip(bytes).file("word/document.xml").asText();
    return (xml.match(/<w:numId w:val="8"\/>/g) || []).length;
  }
  const cases = [
    ["Company/NFRS", base, 24],
    ["Partnership", Object.assign({}, base, { entityType: "Partnership Firm", entityName: "Sample Trading Firm", signatoryDesignation: "Managing Partner" }), 22],
    ["Proprietorship", Object.assign({}, base, { entityType: "Proprietorship Firm", entityName: "Example Proprietorship", framework: "NAS for MEs", signatoryDesignation: "Proprietor" }), 22],
    ["NPO", Object.assign({}, base, { entityType: "NPO", entityName: "Demo Social Organization", framework: "NAS for NPOs" }), 22],
    ["Company range 2079-2082", Object.assign({}, base, { fromFY: 2079, toFY: 2082, feeBasis: "peryear" }), 24],
  ];
  cases.forEach(function (c) {
    const name = c[0], inp = c[1], wantNum = c[2];
    const bytes = AuditRender.combined(TEMPLATE, AuditCore.templateData(inp, rules), { highlight: false });
    const got = norm(docxText(bytes)), exp = norm(coreAll(inp));
    if (got === exp) { pass++; console.log("  PASS  8. template text parity: " + name); }
    else {
      fail++;
      let i = 0; while (i < got.length && i < exp.length && got[i] === exp[i]) i++;
      console.log("  FAIL  8. template text parity: " + name + " (first diff at " + i + ")");
      console.log("        core: ..." + JSON.stringify(exp.slice(Math.max(0, i - 40), i + 60)));
      console.log("        docx: ..." + JSON.stringify(got.slice(Math.max(0, i - 40), i + 60)));
    }
    eq("8. " + name + ": MRL numbered items (numId=8)", numberedCount(bytes), wantNum);
  });
  // Highlight toggle: review mode keeps the reference's yellow highlights; normal strips them.
  const onBytes = AuditRender.combined(TEMPLATE, AuditCore.templateData(base, rules), { highlight: true });
  const offBytes = AuditRender.combined(TEMPLATE, AuditCore.templateData(base, rules), { highlight: false });
  const onN = (new PizZip(onBytes).file("word/document.xml").asText().match(/w:highlight w:val="yellow"/g) || []).length;
  const offN = (new PizZip(offBytes).file("word/document.xml").asText().match(/w:highlight w:val="yellow"/g) || []).length;
  ok("8. review highlight present when on", onN > 0);
  eq("8. no highlight when off", offN, 0);
  // Separate download: three valid letters, each starting correctly.
  const three = AuditRender.separate(TEMPLATE, AuditCore.templateData(base, rules), { highlight: false });
  ok("8. separate: appointment has Sub line", docxText(three.appointment).indexOf("Sub: Appointment Letter") !== -1);
  ok("8. separate: engagement has Sub line", docxText(three.engagement).indexOf("Statutory Audit Engagement Letter") !== -1);
  ok("8. separate: MRL has representation letter opening", docxText(three.mrl).indexOf("This representation letter is provided") !== -1);
  ok("8. separate: appointment has no MRL text", docxText(three.appointment).indexOf("This representation letter") === -1);
})();

console.log("\n" + pass + " passed, " + fail + " failed.");
process.exit(fail ? 1 : 0);
