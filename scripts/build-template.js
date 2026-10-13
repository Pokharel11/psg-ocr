/*
 * Rebuild templates/audit-letter-template.docx from the firm's reference letter.
 *
 * DEV-ONLY tooling (not deployed). The reference file contains real names and is
 * NOT stored in the repo, so you must pass its path:
 *
 *     node scripts/build-template.js "C:\\path\\to\\Audit_Letter_Reference.docx"
 *
 * It edits ONLY the text of runs in word/document.xml — inserting docxtemplater
 * {placeholders}, applying the agreed wording corrections, and replacing the 24
 * MRL items with three loops that share the reference's numId=8 numbering. All
 * paragraph properties, spacing, spacer paragraphs, the table, page breaks,
 * margins and styles are left exactly as the reference. After building, run
 * `npm test` — the template-vs-text parity tests will catch any drift.
 */
const fs = require("fs");
const path = require("path");
const PizZip = require("pizzip");

const refPath = process.argv[2];
if (!refPath || !fs.existsSync(refPath)) {
  console.error("Usage: node scripts/build-template.js <path to Audit_Letter_Reference.docx>");
  process.exit(1);
}
const ROOT = path.resolve(__dirname, "..");
const zip = new PizZip(fs.readFileSync(refPath));
let doc = zip.file("word/document.xml").asText();

const paras = [...doc.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)];
const RPR = '<w:rPr><w:rFonts w:asciiTheme="minorHAnsi" w:hAnsiTheme="minorHAnsi"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>';
const APOS = String.fromCharCode(39);
function pPrOf(xml) { const m = xml.match(/<w:pPr>[\s\S]*?<\/w:pPr>/); return m ? m[0] : ""; }
const numPPr = pPrOf(paras[81][0]);
function rebuild(xml, text) { return "<w:p>" + pPrOf(xml) + "<w:r>" + RPR + '<w:t xml:space="preserve">' + text + "</w:t></w:r></w:p>"; }
function sub(xml, pairs) { pairs.forEach(function (p) { xml = xml.split(p[0]).join(p[1]); }); return xml; }
function tagP(t) { return "<w:p><w:r>" + RPR + '<w:t xml:space="preserve">' + t + "</w:t></w:r></w:p>"; }
function loopItem() { return "<w:p>" + numPPr + "<w:r>" + RPR + '<w:t xml:space="preserve">{.}</w:t></w:r></w:p>'; }
function loop(tag) { return tagP("{#" + tag + "}") + loopItem() + tagP("{/" + tag + "}"); }

const E = [];
function one(i, fn) { E.push({ a: i, b: i, xml: fn(paras[i][0]) }); }
function range(a, b, xml) { E.push({ a: a, b: b, xml: xml }); }

// Appointment
one(3, function (x) { return sub(x, [["Ashad 25th, 2083", "{appointment_date}"]]); });
one(4, function (x) { return sub(x, [["Mr. Gaurav Pokharel,", "{auditor_title} {auditor_name},"]]); });
one(6, function (x) { return sub(x, [["Chartered Accountant</w:t>", "Chartered Accountants</w:t>"]]); });
one(7, function (x) { return sub(x, [["Kathmandu, Nepal", "{firm_city}, Nepal"]]); });
one(11, function (x) { return sub(x, [["Mr. Gaurav Pokharel", "{auditor_title} {auditor_name}"]]); });
one(13, function (x) {
  return sub(x, [
    ["auditor of our company,", "auditor of our {noun},"],
    ["PSG Private Limited", "{entity_name}"],
    ["FY 2082/83", "{fy_label}"],
    ["140,000.00", "{fee_figure}"],
    ["One Lakh Forty Thousand Only", "{fee_words}"],
    ["excluding VAT", "{vat_short}"],
    [". Applicable tax at source shall be deducted as prescribed by Income Tax Act 2058. We believe you will execute the job as required by the law of land.",
      "{per_year_suffix}. Applicable tax at source shall be deducted as prescribed by Income Tax Act, 2058. We believe you will execute the job as required by the law of the land."],
  ]);
});
one(22, function (x) { return sub(x, [["Sujan Timalsina", "{signatory_name}"]]); });
one(23, function (x) { return sub(x, [["Chairperson", "{signatory_designation}"]]); });
one(24, function (x) { return sub(x, [["PSG Private Limited", "{entity_name}"]]); });

// Engagement
one(28, function (x) { return sub(x, [[">26</w:t>", ">{engagement_date}</w:t>"], [">th</w:t>", "></w:t>"], ["> Ashad, 2083</w:t>", "></w:t>"]]); });
one(29, function (x) { return sub(x, [["The Shareholder</w:t>", "{engagement_addressee}</w:t>"]]); });
one(30, function (x) { return sub(x, [["PSG Private Limited", "{entity_name}"]]); });
one(31, function (x) { return sub(x, [["Kathmandu, Nepal", "{entity_address}"]]); });
one(32, function (x) { return sub(x, [["FY 2082/83", "{fy_label}"]]); });
one(34, function (x) { return sub(x, [["Dear Sir,", "Dear Sir/Madam,"]]); });
one(35, function (x) { return rebuild(x, "We have been appointed to audit the {fs_lead} of {entity_name}{fy_of} and {fs_rest} {period_clause} as per your appointment letter dated {appointment_date_short}. We are pleased to confirm our acceptance and our understanding of this engagement by means of this letter. Our audit will be made with the objective of our expressing an opinion on the financial statements."); });
one(36, function (x) { return sub(x, [["Company Act, 2063 and", "{statute} and"]]); });
one(39, function (x) {
  return sub(x, [
    ["Nepal Financial Reporting Standards (NFRS)</w:t>", "{framework_full}</w:t>"],
    ["is that of the management of the PSG Private Limited This includes", "is that of the management of {entity_name}. This includes"],
    ["safeguarding of the assets of the company.", "safeguarding of the assets of the {noun}."],
  ]);
});
one(41, function (x) { return rebuild(x, "Our fees for statutory audit {vat_long}{per_year_suffix}, will be NRs {fee_figure_short}."); });
one(44, function (x) { return sub(x, [["Yours Faithfully,", "Yours faithfully,"]]); });
one(49, function (x) { return sub(x, [["CA Gaurav Pokharel", "{auditor_prefix_name}"]]); });
one(50, function (x) { return sub(x, [["Partner</w:t>", "{auditor_designation}</w:t>"]]); });
one(54, function (x) { return sub(x, [["PSG Private Limited", "{entity_name}"]]); });
one(59, function (x) { return sub(x, [["Sujan Timalsina", "{signatory_name}"]]); });
one(60, function (x) { return sub(x, [["Date: 26</w:t>", "Date: {engagement_date}</w:t>"], [">th</w:t>", "></w:t>"], ["> Ashad 2083</w:t>", "></w:t>"]]); });

// MRL header + opening
one(70, function (x) { return sub(x, [[">13</w:t>", ">{mrl_date}</w:t>"], [">th</w:t>", "></w:t>"], ["> Ashoj 2083</w:t>", "></w:t>"]]); });
one(72, function (x) { return sub(x, [["CA Gaurav Pokharel", "{auditor_prefix_name}"]]); });
one(73, function (x) { return sub(x, [["M/s P.S.G. &amp; Associates,", "M/s {firm_name},"]]); });
one(75, function (x) { return sub(x, [["Kathmandu, Nepal", "{firm_city}, Nepal"]]); });
one(77, function (x) { return sub(x, [["Dear Sir,", "Dear Sir/Madam,"]]); });
one(78, function (x) { return rebuild(x, "This representation letter is provided in connection with your audit of the Financial Statements of {entity_name} {period_ended} for the purpose of expressing an opinion as to whether the financial statements present fairly, in all material respects, the financial position of the {noun} as at {fy_end_ad_last} and results of operations, statement of changes in equity, its statement of cash flows, accounting policy and notes to the account for the year then ended in accordance with {framework_full} and comply with {statute_with_amendment} and other applicable acts. We appreciate that all the information you require to form an opinion on the financial statements may not be available from an examination of the accounting records and other documents, and that you have obtained representations from the {noun}" + APOS + "s {representation_givers}. The {representation_givers_short} acknowledge full responsibility for the fair preparation of the financial statements in accordance with the {framework_full} and comply with {statute_with_amendment} and other applicable Acts. We further acknowledge our responsibility for the design and implementation of internal control to prevent and detect fraud. We confirm, to the best of our knowledge and belief the following representations:"); });

// MRL headings + loops
one(97, function (x) { return sub(x, [["OTHER MATTERS", "Other Matters"]]); });
range(81, 85, loop("liabilities"));
range(89, 95, loop("assets"));
range(98, 109, loop("other"));

// MRL signature table
one(118, function (x) { return sub(x, [["Sujan Timalsina", "{signatory_name}"]]); });
one(119, function (x) { return sub(x, [["Chairperson", "{signatory_designation}"]]); });
one(120, function (x) { return sub(x, [["PSG Private Limited", "{entity_name}"]]); });

E.sort(function (p, q) { return q.a - p.a; });
let result = doc;
E.forEach(function (e) {
  const start = paras[e.a].index;
  const end = paras[e.b].index + paras[e.b][0].length;
  result = result.slice(0, start) + e.xml + result.slice(end);
});

zip.file("word/document.xml", result);
const outDir = path.join(ROOT, "templates");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "audit-letter-template.docx"), zip.generate({ type: "nodebuffer" }));
console.log("Built templates/audit-letter-template.docx (edits: " + E.length + ")");
console.log("Now run: npm test");
