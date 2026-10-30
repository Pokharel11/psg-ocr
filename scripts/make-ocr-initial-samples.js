/*
 * Generate OCR Docs > Initial Update sample sets for review. Uses the browser's core
 * (assets/js/ocr-initial-core.js) and the shared wording (data/ocr.yaml). FICTIONAL data
 * only. Writes to samples/initial-update/ (gitignored). Run: npm run initial-update-samples
 */
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const IU = require("../assets/js/ocr-initial-core.js");

const ROOT = path.resolve(__dirname, "..");
const W = yaml.load(fs.readFileSync(path.join(ROOT, "data", "ocr.yaml"), "utf8"));
const OUT = path.join(ROOT, "samples", "initial-update");
fs.mkdirSync(OUT, { recursive: true });

function fixture(over) {
  return Object.assign({
    company: { name: "हिमाल ट्रेडर्स प्रा.लि.", type: "private", regNo: "123456", regDate: "2083/05/05" },
    address: { district: "काठमाडौँ", local: "काठमाडौँ महानगरपालिका", ward: "10" },
    phones: ["9800000000", "01-5550000"], fax: "", email: "contact@example.com", ocrOffice: "",
    founders: [{ name: "राम बहादुर थापा" }], chairIndex: 0, signer: {},
    meeting1: { date: "", time: "", no: "" },
    meeting2: { date: "", time: "दिउँसो १ बजे", no: "" },
    letterDate: "2083/05/12",
    auditor: { include: true, name: "गौरव पोखरेल", title: "सी.ए.", fy: "२०८३/०८४", fee: "" },
  }, over || {});
}
const FOUNDERS3 = [{ name: "राम बहादुर थापा" }, { name: "सीता देवी श्रेष्ठ" }, { name: "हरि प्रसाद अधिकारी" }];
const FILES = { cover: "1_cover", minutes1: "2_minutes1", minutes2: "3_minutes2", section184: "4_section184" };

(async function () {
  const sets = [
    { dir: "one-founder", data: fixture() },
    { dir: "three-founders", data: fixture({ founders: FOUNDERS3 }) },
    { dir: "no-auditor", data: fixture({ auditor: { include: false } }) },
  ];
  for (const s of sets) {
    const dir = path.join(OUT, s.dir); fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "Initial_Update_combined.docx"), await IU.Packer.toBuffer(IU.buildCombined(s.data, W)));
    for (const x of IU.buildSeparate(s.data, W)) fs.writeFileSync(path.join(dir, FILES[x.id] + ".docx"), await IU.Packer.toBuffer(x.doc));
    console.log("wrote", path.join("samples", "initial-update", s.dir));
  }
})();
