/*
 * Generate OCR Docs sample sets for review (OCR_DOCS_IMPROVEMENT_SPEC Part D).
 * Uses the browser's core (assets/js/ocr-core.js) + the shared Nepali wording
 * (data/ocr.yaml). Fake data only (spec). Run: npm run ocr-samples
 */
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const OCR = require("../assets/js/ocr-core.js");

const ROOT = path.resolve(__dirname, "..");
const W = yaml.load(fs.readFileSync(path.join(ROOT, "data", "ocr.yaml"), "utf8"));
const OUT = path.join(ROOT, "samples");
fs.mkdirSync(OUT, { recursive: true });

const M3 = [
  { name: "राम बहादुर थापा", address: "काठमाडौँ-१०, काठमाडौँ", role: "अध्यक्ष" },
  { name: "सीता देवी श्रेष्ठ", address: "ललितपुर-५, ललितपुर", role: "सञ्चालक" },
  { name: "हरि प्रसाद अधिकारी", address: "भक्तपुर-३, भक्तपुर", role: "सञ्चालक" },
];
function base(over) {
  return Object.assign({
    company: { name: "हिमाल ट्रेडर्स प्रा.लि.", address: "काठमाडौँ महानगरपालिका वडा नं. १०, काठमाडौँ", reg: "१२३४५६", letterhead: true },
    members: M3.map(function (m) { return Object.assign({}, m); }), chairIndex: 0, shareholdersSameAsDirectors: true,
    dates: { bodAuditor: "२०८३/०२/०१", sgm: "२०८३/०२/१५", bod: "२०८३/०८/०१", agm: "२०८३/०८/२९", app: "२०८३/०९/२९" },
    times: { sgmBod: "११.०० बजे", sgm: "११.०० बजे", agmBod: "दिउँसो १ बजे", agm: "बिहान १० बजे" },
    fiscal: { current: "२०८२/०८३", next: "२०८३/०८४" }, auditorChange: false, reasonPhrase: "कार्यव्यस्तताको कारण",
    auditors: {
      prev: { name: "अशोक शर्मा", firm: "ए बी सी एण्ड एसोसिएट्स" },
      cur: { name: "दिपक शर्मा", firm: "एक्स वाई जेड एण्ड एसोसिएट्स", address: "नयाँ बानेश्वर, काठमाडौँ", designation: "साझेदार" },
      next: { name: "दिपक शर्मा", firm: "एक्स वाई जेड एण्ड एसोसिएट्स", address: "नयाँ बानेश्वर, काठमाडौँ", designation: "साझेदार" },
    },
    capital: { numShares: 25000, faceValue: 100, authCapital: "२५,००,०००", issued: "२५,००,०००", paidUp: "२५,००,०००", paidAmt: "२५,००,०००", unpaid: "छैन" },
    sec92: [], sec51: {}, quorumAllPresent: true, acceptance: { enabled: false }, fee: { c1: { mode: "agreement" }, c2: { mode: "amount", amount: 100000, vat: "exclusive" } },
    docsSelected: {},
  }, over || {});
}

const samples = [
  { file: "OCR_1_AuditorChange_Off", data: base() },
  { file: "OCR_2_AuditorChange_On", data: base({
      auditorChange: true,
      acceptance: { enabled: true, forC1: true, forC2: true },
      // show a real change: previous auditor differs from the new one
      auditors: Object.assign(base().auditors, {
        cur: { name: "दिपक शर्मा", firm: "एक्स वाई जेड एण्ड एसोसिएट्स", address: "नयाँ बानेश्वर, काठमाडौँ", designation: "साझेदार" },
        next: { name: "दिपक शर्मा", firm: "एक्स वाई जेड एण्ड एसोसिएट्स", address: "नयाँ बानेश्वर, काठमाडौँ", designation: "साझेदार" },
      }),
    }) },
  { file: "OCR_3_Shareholders_Different", data: base({
      shareholdersSameAsDirectors: false,
      shareholders: [
        { name: "राम बहादुर थापा", address: "काठमाडौँ-१०, काठमाडौँ", shares: 12000 },
        { name: "गीता देवी थापा", address: "काठमाडौँ-१०, काठमाडौँ", shares: 8000 },
        { name: "सीता देवी श्रेष्ठ", address: "ललितपुर-५, ललितपुर", shares: 5000 },
      ],
      quorumAllPresent: false,
      sec51: { shareholdersChanged: true },
    }) },
];

(async function () {
  for (const s of samples) {
    const buf = await OCR.Packer.toBuffer(OCR.buildCombined(s.data, W));
    const out = path.join(OUT, s.file + ".docx");
    fs.writeFileSync(out, buf);
    const n = OCR.documentList(s.data, W).length;
    console.log("wrote " + path.relative(ROOT, out) + " (" + buf.length + " bytes, " + n + " documents)");
  }
  console.log("Done. " + samples.length + " OCR sample sets in " + path.relative(ROOT, OUT) + "/");
})().catch(function (e) { console.error(e); process.exit(1); });
