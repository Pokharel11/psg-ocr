/*
 * Tests for the Bank account-opening generator (BANK_DOCS_SPEC section 9). Run: npm test
 * Fills templates/bank-account-template.docx with the SAME core the browser uses
 * (assets/js/bank-core.js) and the SAME shared entity data (data/entities.yaml).
 */
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const BankCore = require("../assets/js/bank-core.js");

const ROOT = path.resolve(__dirname, "..");
const entities = yaml.load(fs.readFileSync(path.join(ROOT, "data", "entities.yaml"), "utf8")).entities;
const TPL = fs.readFileSync(path.join(ROOT, "templates", "bank-account-template.docx"));

let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log("  PASS  " + name); } else { fail++; console.log("  FAIL  " + name + (extra ? "\n        " + extra : "")); } }
function eq(name, a, b) { ok(name, a === b, "expected " + JSON.stringify(b) + ", got " + JSON.stringify(a)); }

function fillXml(inp) {
  const zip = new PizZip(TPL);
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: false });
  doc.render(BankCore.templateData(inp, entities));
  return new PizZip(doc.getZip().generate({ type: "nodebuffer" })).file("word/document.xml").asText();
}
function textOf(xml) {
  return [...xml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)].map(function (m) {
    return [...m[0].matchAll(/<w:t(?: [^>]*)?>([\s\S]*?)<\/w:t>/g)].map(function (z) { return z[1]; }).join("");
  }).join("\n").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/[‘’]/g, "'");
}
function resCount(xml) {
  // count numId=3 ilvl0 paragraphs (resolutions) by matching ilvl0 + numId3 in the same numPr
  return (xml.match(/<w:ilvl w:val="0"\/><w:numId w:val="3"\/>/g) || []).length;
}

const M3 = [{ title: "Mr.", name: "Ram Bahadur Thapa", designation: "Chairman" },
            { title: "Ms.", name: "Sita Kumari Shrestha", designation: "Director" },
            { title: "Mr.", name: "Hari Prasad Adhikari", designation: "Director" }];
function base(over) {
  return Object.assign({
    entityType: "Company", entityName: "Himal Traders Private Limited", entityAddress: "Kathmandu-10, Kathmandu",
    meetingDateAD: { y: 2026, m: 7, d: 28 }, meetingTime: "11:00 AM", meetingLocation: "Kathmandu-10, Kathmandu",
    members: M3, chairIndex: 0, signatories: M3.slice(), operatingKind: "any_two",
    bank: "XYZ Bank Limited", bankBranch: "Kathmandu, Nepal", accountType: "Current Account", currency: "NPR",
    internetBanking: true, letterhead: true, applicationDateAD: { y: 2026, m: 7, d: 28 }, applicationSigners: [M3[0]],
  }, over || {});
}

console.log("Bank account-opening tests (section 9):\n");

// 1) Single member, single signatory, letterhead, internet yes.
(function () {
  const x = fillXml(base({ members: [M3[0]], signatories: [M3[0]], applicationSigners: [M3[0]] }));
  const t = textOf(x);
  ok("1. single: 'Authorized Signatory:' (singular)", t.indexOf("Authorized Signatory:") !== -1 && t.indexOf("Authorized Signatories:") === -1);
  ok("1. single: 'His signature ... are compulsory' (section 5 #3)", t.indexOf("His signature and stamp of the company are compulsory for banking transactions.") !== -1);
  ok("1. single: one attendance member", (t.match(/Ram Bahadur Thapa/g) || []).length >= 1);
  eq("1. single: 3 resolutions (open/auth/internet)", resCount(x), 3);
})();

// 2) Reference case parity (3 members, any two). Matches the reference text apart
//    from the documented {Chair designation} substitution (Chairperson -> Chairman).
(function () {
  const t = textOf(fillXml(base()));
  ok("2. reference: attendance lists all three members", ["Ram Bahadur Thapa", "Sita Kumari Shrestha", "Hari Prasad Adhikari"].every(function (n) { return t.indexOf(n) !== -1; }));
  ok("2. reference: lettered signatories + any-two instruction", t.indexOf("any two of the above signatories, along with the stamp of the company.") !== -1);
  ok("2. reference: letter body in the name of our company", t.indexOf("in the name of our company, Himal Traders Private Limited,") !== -1);
})();

// 3) No letterhead: no 24pt heading runs and no line drawing; minutes unchanged.
(function () {
  const on = fillXml(base({ letterhead: true }));
  const off = fillXml(base({ letterhead: false }));
  ok("3. no-letterhead: no 24pt (sz=48) heading", off.indexOf('w:sz w:val="48"') === -1);
  ok("3. no-letterhead: no line drawing", off.indexOf("<w:drawing>") === -1 && off.indexOf("<v:line") === -1);
  ok("3. with-letterhead HAS the line drawing", on.indexOf("<v:line") !== -1);
  ok("3. no-letterhead: entity name still in the letter body", textOf(off).indexOf("in the name of our company, Himal Traders Private Limited,") !== -1);
})();

// 4) Two signatories, any two -> "both the above signatories".
(function () {
  const t = textOf(fillXml(base({ signatories: M3.slice(0, 2), operatingKind: "any_two" })));
  ok("4. two signatories: 'both the above signatories'", t.indexOf("joint signatures of both the above signatories") !== -1);
})();

// 5) Single signatory, title Ms. -> "Her signature".
(function () {
  const t = textOf(fillXml(base({ members: [M3[1]], signatories: [M3[1]], applicationSigners: [M3[1]] })));
  ok("5. single Ms.: 'Her signature'", t.indexOf("Her signature and stamp of the company are compulsory") !== -1);
})();

// 6) Internet banking No: resolution 3 absent; numbering 1..2 with no gap.
(function () {
  const x = fillXml(base({ internetBanking: false }));
  const t = textOf(x);
  ok("6. internet off: no 'Internet Banking:'", t.indexOf("Internet Banking:") === -1);
  eq("6. internet off: 2 resolutions (open/auth)", resCount(x), 2);
})();

// 7) Mandatory signatory + outside signatory (CEO) + two application signers (side by side).
(function () {
  const ceo = { title: "Mr.", name: "Bibek Gurung", designation: "Chief Executive Officer" };
  const sigs = [M3[0], M3[1], ceo];
  const x = fillXml(base({ signatories: sigs, mandatorySignatory: 2, operatingKind: "any_two", applicationSigners: [M3[0], ceo] }));
  const t = textOf(x);
  ok("7. mandatory in any-two (n>2): 'signature of Mr. Bibek Gurung together with any one'", t.indexOf("the signature of Mr. Bibek Gurung together with any one of the other signatories") !== -1);
  ok("7. outside signatory CEO listed", t.indexOf("Chief Executive Officer") !== -1);
  ok("7. side-by-side signature table (two signers)", (x.match(/<w:tbl\b/g) || []).length === 1 && t.indexOf("Bibek Gurung") !== -1 && t.indexOf("Ram Bahadur Thapa") !== -1);
})();

// 8) NPO: title, noun and designations from the data file.
(function () {
  const npoM = [{ title: "Mr.", name: "Kiran Shakya", designation: "Chairperson" }, { title: "Ms.", name: "Deepa Rai", designation: "Secretary" }];
  const x = fillXml(base({ entityType: "NPO", entityName: "Shanti Social Foundation", members: npoM, signatories: npoM.slice(), applicationSigners: [npoM[0]] }));
  const t = textOf(x);
  ok("8. NPO: executive committee minute title", t.indexOf("MINUTES OF EXECUTIVE COMMITTEE MEETING") !== -1);
  ok("8. NPO: noun 'organization' in the letter", t.indexOf("in the name of our organization, Shanti Social Foundation,") !== -1);
  ok("8. NPO: noun_cap 'Organization' in resolution", t.indexOf("The Organization decided to open") !== -1);
})();

// Proprietorship: no minute (application only).
(function () {
  const pm = [{ title: "Mr.", name: "Suresh Lama", designation: "Proprietor" }];
  const x = fillXml(base({ entityType: "Proprietorship Firm", entityName: "Suresh Stores", members: pm, signatories: pm, applicationSigners: [pm[0]] }));
  const t = textOf(x);
  ok("P. proprietorship: no minute (no MINUTES heading)", t.indexOf("MINUTES OF") === -1);
  ok("P. proprietorship: application letter present", t.indexOf("Request for opening a Bank Account") !== -1);
})();

console.log("\n" + pass + " passed, " + fail + " failed.");
process.exit(fail ? 1 : 0);
