/*
 * Generate the three Bank account-opening sample .docx for review (obviously fake
 * names). Uses the shared engine + the reference-based template. Run: npm run bank-samples
 *   1_Company_one_director_one_signatory
 *   2_Company_three_directors_any_two_no_letterhead
 *   3_NPO
 */
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const BankCore = require("../assets/js/bank-core.js");
const PSGDocx = require("../assets/js/common/docx-engine.js");

const ROOT = path.resolve(__dirname, "..");
const entities = yaml.load(fs.readFileSync(path.join(ROOT, "data", "entities.yaml"), "utf8")).entities;
const TEMPLATE = fs.readFileSync(path.join(ROOT, "templates", "bank-account-template.docx"));
const OUT = path.join(ROOT, "samples");
fs.mkdirSync(OUT, { recursive: true });

const common = {
  meetingDateAD: { y: 2026, m: 7, d: 28 }, meetingTime: "11:00 AM",
  bank: "Demo Commercial Bank Limited", bankBranch: "New Road, Kathmandu",
  accountType: "Current Account", currency: "NPR",
  applicationDateAD: { y: 2026, m: 7, d: 28 },
};

const samples = [
  { file: "1_Company_one_director_one_signatory", inp: {
      entityType: "Company", entityName: "Demo Widgets Pvt. Ltd.", entityAddress: "Lalitpur-10, Lalitpur",
      meetingLocation: "Lalitpur-10, Lalitpur",
      members: [{ title: "Mr.", name: "Demo Chairperson", designation: "Chairman" }],
      chairIndex: 0,
      signatories: [{ title: "Mr.", name: "Demo Chairperson", designation: "Chairman" }],
      operatingKind: "any_two", internetBanking: true, letterhead: true,
      applicationSigners: [{ title: "Mr.", name: "Demo Chairperson", designation: "Chairman" }] } },

  { file: "2_Company_three_directors_any_two_no_letterhead", inp: {
      entityType: "Company", entityName: "Demo Trading Pvt. Ltd.", entityAddress: "Kathmandu-10, Kathmandu",
      meetingLocation: "Kathmandu-10, Kathmandu",
      members: [
        { title: "Mr.", name: "Demo Director One", designation: "Chairman" },
        { title: "Ms.", name: "Demo Director Two", designation: "Director" },
        { title: "Mr.", name: "Demo Director Three", designation: "Director" }],
      chairIndex: 0,
      signatories: [
        { title: "Mr.", name: "Demo Director One", designation: "Chairman" },
        { title: "Ms.", name: "Demo Director Two", designation: "Director" },
        { title: "Mr.", name: "Demo Director Three", designation: "Director" }],
      operatingKind: "any_two", internetBanking: true, letterhead: false,
      applicationSigners: [
        { title: "Mr.", name: "Demo Director One", designation: "Chairman" },
        { title: "Ms.", name: "Demo Director Two", designation: "Director" }] } },

  { file: "3_NPO", inp: {
      entityType: "NPO", entityName: "Demo Community Foundation", entityAddress: "Bhaktapur-5, Bhaktapur",
      meetingLocation: "Bhaktapur-5, Bhaktapur",
      members: [
        { title: "Mr.", name: "Demo Chairperson", designation: "Chairperson" },
        { title: "Ms.", name: "Demo Secretary", designation: "Secretary" },
        { title: "Mr.", name: "Demo Treasurer", designation: "Treasurer" }],
      chairIndex: 0,
      signatories: [
        { title: "Mr.", name: "Demo Chairperson", designation: "Chairperson" },
        { title: "Ms.", name: "Demo Secretary", designation: "Secretary" }],
      operatingKind: "any_two", internetBanking: false, letterhead: true,
      applicationSigners: [{ title: "Mr.", name: "Demo Chairperson", designation: "Chairperson" }] } },
];

for (const s of samples) {
  const inp = Object.assign({}, common, s.inp);
  const data = BankCore.templateData(inp, entities);
  const buf = Buffer.from(PSGDocx.combined(TEMPLATE, data, { highlight: false }));
  const out = path.join(OUT, s.file + ".docx");
  fs.writeFileSync(out, buf);
  console.log("wrote " + path.relative(ROOT, out) + " (" + buf.length + " bytes)");
}
console.log("Done. 3 bank sample files in " + path.relative(ROOT, OUT) + "/");
