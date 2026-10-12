/*
 * Generate four sample audit-letter .docx files (one per entity type) for review.
 * Names are obviously fake (spec: no real client or signatory names). Run: npm run samples
 */
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const AuditCore = require("../assets/js/audit-letters-core.js");
const AuditRender = require("../assets/js/audit-letters-render.js");

const ROOT = path.resolve(__dirname, "..");
const rules = yaml.load(fs.readFileSync(path.join(ROOT, "audit-letters.yaml"), "utf8"));
const OUT = path.join(ROOT, "samples");
fs.mkdirSync(OUT, { recursive: true });

const common = {
  entityAddress: "Kathmandu, Nepal",
  appointmentBS: { y: 2083, m0: 2, day: 25 }, // 25 Ashad 2083
  mrlBS: { y: 2083, m0: 5, day: 13 },          // 13 Ashoj 2083
  auditorName: "Gaurav Pokharel", auditorTitle: "Mr.", auditorDesignation: "Partner",
  firmName: "P.S.G. & Associates", firmCity: "Kathmandu",
  grouping: "international", highlight: false,
};

const samples = [
  { file: "1_Company", inp: {
      entityType: "Company", entityName: "Demo Widgets Pvt. Ltd.",
      signatoryName: "Sample Chairperson", signatoryDesignation: "Chairperson",
      fromFY: 2082, toFY: 2082, feeBasis: "total", fee: 140000, vat: "exclusive", framework: "NFRS" } },
  { file: "2_Partnership_Firm", inp: {
      entityType: "Partnership Firm", entityName: "Demo Trading Associates",
      signatoryName: "Sample Managing Partner", signatoryDesignation: "Managing Partner",
      fromFY: 2081, toFY: 2082, feeBasis: "peryear", fee: 150000, vat: "exclusive", framework: "NFRS for SMEs" } },
  { file: "3_Proprietorship_Firm", inp: {
      entityType: "Proprietorship Firm", entityName: "Demo Stationery Suppliers",
      signatoryName: "Sample Proprietor", signatoryDesignation: "Proprietor",
      fromFY: 2082, toFY: 2082, feeBasis: "total", fee: 90000, vat: "inclusive", framework: "NAS for MEs" } },
  { file: "4_NPO", inp: {
      entityType: "NPO", entityName: "Demo Community Foundation",
      signatoryName: "Sample Chairperson", signatoryDesignation: "Chairperson",
      fromFY: 2082, toFY: 2082, feeBasis: "total", fee: 120000, vat: "exclusive", framework: "NAS for NPOs" } },
];

(async function () {
  for (const s of samples) {
    const inp = Object.assign({}, common, s.inp);
    const gen = AuditCore.generate(inp, rules);
    const doc = AuditRender.combined(gen);
    const buf = await AuditRender.Packer.toBuffer(doc);
    const out = path.join(OUT, s.file + ".docx");
    fs.writeFileSync(out, buf);
    console.log("wrote " + path.relative(ROOT, out) + " (" + buf.length + " bytes)");
  }
  console.log("Done. 4 sample files in " + path.relative(ROOT, OUT) + "/");
})();
