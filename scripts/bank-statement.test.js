/*
 * Tests for the Bank Statement Request generator (BANK_STATEMENT_SPEC section 8).
 * Run: npm test. Fills templates/bank-statement-template.docx with the SAME core
 * the browser uses (assets/js/bank-statement-core.js) and the SAME shared entity
 * data (data/entities.yaml). Item 9 (visual comparison) is run in the browser.
 */
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const Core = require("../assets/js/bank-statement-core.js");
const BSDate = require("../assets/js/common/psg-bsdate.js");

const ROOT = path.resolve(__dirname, "..");
const entities = yaml.load(fs.readFileSync(path.join(ROOT, "data", "entities.yaml"), "utf8")).entities;
const TPL = fs.readFileSync(path.join(ROOT, "templates", "bank-statement-template.docx"));
const REF_WL = path.join(ROOT, "docs", "bank-docs", "Bank_Statement_Request_Template_With_Letterhead.docx");
const REF_NL = path.join(ROOT, "docs", "bank-docs", "Bank_Statement_Request_Template_No_Letterhead.docx");

let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log("  PASS  " + name); } else { fail++; console.log("  FAIL  " + name + (extra ? "\n        " + extra : "")); } }
function eq(name, a, b) { ok(name, a === b, "expected " + JSON.stringify(b) + ", got " + JSON.stringify(a)); }

function fillXml(inp, opts) {
  const zip = new PizZip(TPL);
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: false });
  doc.render(Core.templateData(inp, entities));
  let xml = new PizZip(doc.getZip().generate({ type: "nodebuffer" })).file("word/document.xml").asText();
  if (!opts || !opts.highlight) xml = xml.replace(/<w:highlight w:val="yellow"\/>/g, "");
  return xml;
}
function norm(s) {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
}
function lines(xml) {
  return [...xml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)].map(function (m) {
    return norm([...m[0].matchAll(/<w:t(?: [^>]*)?>([\s\S]*?)<\/w:t>/g)].map(function (z) { return z[1]; }).join(""));
  }).map(function (s) { return s.trim(); }).filter(Boolean);
}
function textOf(xml) { return lines(xml).join("\n"); }
function docText(file) {
  const xml = new PizZip(fs.readFileSync(file)).file("word/document.xml").asText().replace(/<w:highlight w:val="yellow"\/>/g, "");
  return lines(xml).join("\n");
}

const M3 = [{ title: "Mr.", name: "Ram Bahadur Thapa", designation: "Chairman" },
            { title: "Ms.", name: "Sita Kumari Shrestha", designation: "Director" },
            { title: "Mr.", name: "Hari Prasad Adhikari", designation: "Director" }];

function base(over) {
  return Object.assign({
    entityType: "Company", entityName: "Himal Traders Private Limited", entityAddress: "Kathmandu-10, Kathmandu",
    letterhead: true,
    bank: "XYZ Bank Limited", bankAddress: "Kathmandu, Nepal", branch: "Kathmandu Branch",
    accounts: [{ number: "00112233445566" }], accountName: "",
    dateSystem: "AD", fromDate: { y: 2025, m: 7, d: 17 }, toDate: { y: 2026, m: 10, d: 15 },
    purpose: "internal accounting",
    meetingDateAD: { y: 2026, m: 10, d: 16 }, meetingTime: "9:00 AM",
    members: M3.slice(), chairIndex: 0, allPresent: true,
    authorized: [M3[1]], // Ms. Sita Kumari Shrestha
    letterDateAD: { y: 2026, m: 10, d: 16 },
  }, over || {});
}

console.log("Bank statement-request tests (section 8):\n");

// 1) Parity: the reference case matches the With-Letterhead reference text.
(function () {
  const got = textOf(fillXml(base()));
  const ref = docText(REF_WL);
  ok("1. parity: generated reference case matches the reference text", got === ref,
    got === ref ? "" : diff(ref, got));
})();
function diff(a, b) {
  const A = a.split("\n"), B = b.split("\n");
  for (let i = 0; i < Math.max(A.length, B.length); i++) if (A[i] !== B[i]) return "line " + i + ":\n   ref: " + JSON.stringify(A[i]) + "\n   got: " + JSON.stringify(B[i]);
  return "";
}

// 2) No letterhead: matches the No-Letterhead reference; no 24pt heading, no line drawing.
(function () {
  const offXml = fillXml(base({ letterhead: false }));
  ok("2. no-letterhead: matches the No-Letterhead reference text", textOf(offXml) === docText(REF_NL), diff(docText(REF_NL), textOf(offXml)));
  ok("2. no-letterhead: no 24pt (sz=48) heading", offXml.indexOf('w:sz w:val="48"') === -1);
  ok("2. no-letterhead: no line drawing", offXml.indexOf("<w:drawing>") === -1 && offXml.indexOf("<v:line") === -1);
  ok("2. with-letterhead HAS the line drawing", fillXml(base({ letterhead: true })).indexOf("<v:line") !== -1);
})();

// 3) Two / three accounts: plural wording, Account Nos. list, one "Account Number" line each.
(function () {
  const t2 = textOf(fillXml(base({ accounts: [{ number: "001" }, { number: "002" }] })));
  ok("3. two accounts: plural 'accounts'", t2.indexOf("our company's bank accounts at your esteemed bank") !== -1);
  ok("3. two accounts: 'Account Nos. 001 and 002'", t2.indexOf("Account Nos. 001 and 002") !== -1);
  eq("3. two accounts: two 'Account Number' lines", (t2.match(/Account Number:/g) || []).length, 2);
  ok("3. two accounts: plural 'statements' in decision", t2.indexOf("to provide the bank statements of the company's") !== -1);
  const t3 = textOf(fillXml(base({ accounts: [{ number: "001" }, { number: "002" }, { number: "003" }] })));
  ok("3. three accounts: 'Account Nos. 001, 002 and 003'", t3.indexOf("Account Nos. 001, 002 and 003") !== -1);
})();

// 4) Two authorized persons: 'are hereby authorized' + side-by-side signature table.
(function () {
  const x = fillXml(base({ authorized: [M3[1], M3[2]] }));
  const t = textOf(x);
  ok("4. two authorized: 'are hereby authorized'", t.indexOf("Sita Kumari Shrestha and Mr. Hari Prasad Adhikari are hereby authorized") !== -1);
  ok("4. two authorized: a signature table is present (side by side)", (x.match(/<w:tbl\b/g) || []).length === 2); // attendance + signature
  ok("4. two authorized: no single-signature fallthrough duplicate", t.indexOf("collect the bank statement on behalf of the company.") !== -1);
})();

// 5) BS fiscal-year FY 2082/83: Shrawan 1 to the last day of Ashadh 2083 (from the calendar), with (B.S.).
(function () {
  const ASHADH_m0 = 2; // 0-based: Baishakh 0, Jestha 1, Ashadh 2, Shrawan 3
  const lastAshadh = BSDate.bsMonthDays(2083, ASHADH_m0);
  eq("5. calendar: Ashadh 2083 has 32 days", lastAshadh, 32);
  const t = textOf(fillXml(base({
    dateSystem: "BS", fromDate: { y: 2082, m: 4, d: 1 }, toDate: { y: 2083, m: 3, d: lastAshadh },
  })));
  ok("5. BS period in the letter with (B.S.)", t.indexOf("for the period from 2082/04/01 to 2083/03/32 (B.S.).") !== -1, firstPeriodLine(t));
  ok("5. BS period in the discussion", t.indexOf("for the period from 2082/04/01 to 2083/03/32 (B.S.) for the purpose of") !== -1);
})();
function firstPeriodLine(t) { return (t.split("\n").find(function (l) { return l.indexOf("for the period from") !== -1; }) || ""); }

// 6) 'All members present' off -> quorum sentence.
(function () {
  const t = textOf(fillXml(base({ allPresent: false })));
  ok("6. quorum sentence when not all present", t.indexOf("The board members listed above were present, forming the quorum, and the following matter") !== -1);
  ok("6. no 'All ... were present' when off", t.indexOf("All board members were present") === -1);
})();

// 7) NPO and Partnership wording from the data file; Proprietorship = letter only.
(function () {
  const npoM = [{ title: "Mr.", name: "Kiran Shakya", designation: "Chairperson" }, { title: "Ms.", name: "Deepa Rai", designation: "Secretary" }];
  const npo = textOf(fillXml(base({ entityType: "NPO", entityName: "Shanti Social Foundation", members: npoM, chairIndex: 0, authorized: [npoM[0]] })));
  ok("7. NPO: executive committee minute title", npo.indexOf("MINUTES OF THE EXECUTIVE COMMITTEE MEETING") !== -1);
  ok("7. NPO: 'Members Present:'", npo.indexOf("Members Present:") !== -1);
  ok("7. NPO: narrative meeting-of + office + noun", npo.indexOf("A meeting of the executive committee of Shanti Social Foundation was held on the above date and time at the organization's office") !== -1);
  ok("7. NPO: 'committee members' + 'organization' agenda", npo.indexOf("The committee members discussed the need to obtain the organization's bank statement") !== -1);

  const ptM = [{ title: "Mr.", name: "Gopal Thapa", designation: "Managing Partner" }, { title: "Mr.", name: "Nabin Karki", designation: "Partner" }];
  const pt = textOf(fillXml(base({ entityType: "Partnership Firm", entityName: "Everest Trading Associates", members: ptM, chairIndex: 0, authorized: [ptM[0]] })));
  ok("7. Partnership: partners' meeting minute title", pt.indexOf("MINUTES OF THE PARTNERS' MEETING") !== -1);
  ok("7. Partnership: 'Partners Present:'", pt.indexOf("Partners Present:") !== -1);
  ok("7. Partnership: narrative 'the partners' + firm office + firm noun", pt.indexOf("A meeting of the partners of Everest Trading Associates was held on the above date and time at the firm's office") !== -1);

  const pm = [{ title: "Mr.", name: "Suresh Lama", designation: "Proprietor" }];
  const prop = fillXml(base({ entityType: "Proprietorship Firm", entityName: "Suresh Stores", members: pm, chairIndex: 0, authorized: [pm[0]] }));
  const pt2 = textOf(prop);
  ok("7. Proprietorship: no minute (no MINUTES heading)", pt2.indexOf("MINUTES OF") === -1);
  ok("7. Proprietorship: letter present (REF line)", pt2.indexOf("REF: Request for Account Statements") !== -1);
  ok("7. Proprietorship: signature present", pt2.indexOf("Suresh Lama") !== -1);
})();

// 8) Account Opening core still produces its reference wording (its full suite runs in bank.test.js).
(function () {
  const BankCore = require("../assets/js/bank-core.js");
  const data = BankCore.templateData({
    entityType: "Company", entityName: "Himal Traders Private Limited", entityAddress: "Kathmandu-10, Kathmandu",
    meetingDateAD: { y: 2026, m: 7, d: 28 }, meetingTime: "11:00 AM", meetingLocation: "Kathmandu",
    members: M3, chairIndex: 0, signatories: M3.slice(), operatingKind: "any_two",
    bank: "XYZ Bank Limited", bankBranch: "Kathmandu, Nepal", accountType: "Current Account", currency: "NPR",
    internetBanking: true, letterhead: true, applicationDateAD: { y: 2026, m: 7, d: 28 }, applicationSigners: [M3[0]],
  }, entities);
  ok("8. Account Opening core unchanged (operating instruction)", data.operating_instruction.indexOf("any two of the above signatories, along with the stamp of the company.") !== -1);
})();

console.log("\n" + pass + " passed, " + fail + " failed.");
process.exit(fail ? 1 : 0);
