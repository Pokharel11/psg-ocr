/*
 * Generate Bank Statement Request sample .docx files for review (BANK_STATEMENT_SPEC
 * section 8). Uses the browser's core (bank-statement-core.js), the shared entity
 * data and the built template. Fake data only (spec: no real client names).
 * Run: npm run statement-samples
 */
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const Core = require("../assets/js/bank-statement-core.js");
const PSGDocx = require("../assets/js/common/docx-engine.js");
const BSDate = require("../assets/js/common/psg-bsdate.js");

const ROOT = path.resolve(__dirname, "..");
const entities = yaml.load(fs.readFileSync(path.join(ROOT, "data", "entities.yaml"), "utf8")).entities;
const TPL = fs.readFileSync(path.join(ROOT, "templates", "bank-statement-template.docx"));
const OUT = path.join(ROOT, "samples");
fs.mkdirSync(OUT, { recursive: true });

const M3 = [{ title: "Mr.", name: "Ram Bahadur Thapa", designation: "Chairman" },
            { title: "Ms.", name: "Sita Kumari Shrestha", designation: "Director" },
            { title: "Mr.", name: "Hari Prasad Adhikari", designation: "Director" }];

function b(over) {
  return Object.assign({
    entityType: "Company", entityName: "Himal Traders Private Limited", entityAddress: "Kathmandu-10, Kathmandu",
    letterhead: true,
    bank: "XYZ Bank Limited", bankAddress: "Kathmandu, Nepal", branch: "Kathmandu Branch",
    accounts: [{ number: "00112233445566" }], accountName: "",
    dateSystem: "AD", fromDate: { y: 2025, m: 7, d: 17 }, toDate: { y: 2026, m: 10, d: 15 },
    purpose: "internal accounting",
    meetingDateAD: { y: 2026, m: 10, d: 16 }, meetingTime: "9:00 AM",
    members: M3.slice(), chairIndex: 0, allPresent: true,
    authorized: [M3[1]], letterDateAD: { y: 2026, m: 10, d: 16 },
  }, over || {});
}

const lastAshadh = BSDate.bsMonthDays(2083, 2); // Ashadh 2083

const samples = [
  { file: "1_Statement_Reference_Company", inp: b() },
  { file: "2_Statement_TwoAccounts_NoLetterhead", inp: b({
      letterhead: false,
      accounts: [{ number: "00112233445566" }, { number: "00998877665544" }],
      authorized: [M3[1], M3[2]],
    }) },
  { file: "3_Statement_BS_FY2082_83", inp: b({
      dateSystem: "BS", fromDate: { y: 2082, m: 4, d: 1 }, toDate: { y: 2083, m: 3, d: lastAshadh },
      purpose: "statutory audit",
    }) },
  { file: "4_Statement_NPO", inp: b({
      entityType: "NPO", entityName: "Demo Community Foundation", entityAddress: "Lalitpur-5, Lalitpur",
      members: [
        { title: "Mr.", name: "Kiran Shakya", designation: "Chairperson" },
        { title: "Ms.", name: "Deepa Rai", designation: "Secretary" },
        { title: "Mr.", name: "Prakash Thapa", designation: "Treasurer" },
      ],
      authorized: [{ title: "Mr.", name: "Kiran Shakya", designation: "Chairperson" }],
    }) },
];

for (const s of samples) {
  const v = Core.validate(s.inp, entities);
  const data = Core.templateData(s.inp, entities);
  const buf = Buffer.from(PSGDocx.combined(TPL, data, { highlight: false }));
  const out = path.join(OUT, s.file + ".docx");
  fs.writeFileSync(out, buf);
  console.log("wrote " + path.relative(ROOT, out) + " (" + buf.length + " bytes)"
    + (v.warnings.length ? "  [warnings: " + v.warnings.join("; ") + "]" : ""));
}
console.log("Done. " + samples.length + " statement samples in " + path.relative(ROOT, OUT) + "/");
