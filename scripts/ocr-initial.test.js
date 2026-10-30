/*
 * Tests for OCR Docs > Initial Update. Run: npm test.
 * Initial Update must match the annual OCR set in everything except the document wording, so
 * besides checking the wording these tests compare it with the annual set's own output and form.
 * Uses the SAME core the browser uses (assets/js/ocr-initial-core.js) and the same wording
 * (data/ocr.yaml, key "initial"), then inspects the real .docx output.
 * FICTIONAL data only: the example names are the ones the annual OCR tests and forms use.
 */
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const PizZip = require("pizzip");
const IU = require("../assets/js/ocr-initial-core.js");
const OCR = require("../assets/js/ocr-core.js");
const BS = require("../assets/js/common/psg-bsdate.js");

const ROOT = path.resolve(__dirname, "..");
const read = function (f) { return fs.readFileSync(path.join(ROOT, f), "utf8"); };
const W = yaml.load(read("data/ocr.yaml"));

let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log("  PASS  " + name); } else { fail++; console.log("  FAIL  " + name + (extra ? "\n        " + extra : "")); } }
function eqLines(name, got, want) {
  const bad = []; const n = Math.max(got.length, want.length);
  for (let i = 0; i < n; i++) if (got[i] !== want[i]) bad.push("line " + (i + 1) + "\n          got : " + got[i] + "\n          want: " + want[i]);
  ok(name, !bad.length, bad.slice(0, 3).join("\n        "));
}

// ── fictional fixtures (the annual set's example names) ──
const COMPANY = "हिमाल ट्रेडर्स प्रा.लि.";
const KO = COMPANY + " को";            // the annual set's possessive: company, one space, को
const A = "राम बहादुर थापा", B2 = "सीता देवी श्रेष्ठ", C3 = "हरि प्रसाद अधिकारी";
function fixture(over) {
  return Object.assign({
    company: { name: COMPANY, type: "private", regNo: "123456", regDate: "2083/05/05" },
    address: { district: "काठमाडौँ", local: "काठमाडौँ महानगरपालिका", ward: "10" },
    phones: ["9800000000", "01-5550000"], fax: "", email: "contact@example.com", ocrOffice: "",
    founders: [{ name: A }], chairIndex: 0, signer: {},
    meeting1: { date: "", time: "", no: "" },
    meeting2: { date: "", time: "दिउँसो १ बजे", no: "" },
    letterDate: "2083/05/12",
    auditor: { include: true, name: "गौरव पोखरेल", title: "सी.ए.", fy: "२०८३/०८४", fee: "" },
  }, over || {});
}
const ADDR = "काठमाडौँ जिल्ला काठमाडौँ महानगरपालिका वडा नं. १०";
const F3 = [{ name: A, role: "" }, { name: B2, role: "" }, { name: C3, role: "संस्थापक शेयरधनी" }];

function docxXml(doc) { return OCR.Packer.toBuffer(doc).then(function (b) { return new PizZip(b).file("word/document.xml").asText(); }); }
function paras(xml) {
  return xml.split(/<\/w:p>/).map(function (p) { return (p.match(/<w:t(?: [^>]*)?>([\s\S]*?)<\/w:t>/g) || []).map(function (s) { return s.replace(/<[^>]+>/g, ""); }).join(""); });
}
function nonEmpty(xml) { return paras(xml).filter(function (t) { return t.trim(); }); }
function linesOf(d) { return IU.model(d, W).docs.map(function (x) { return IU.docLines(x); }); }
function docTexts(d) { return IU.model(d, W).docs.map(function (x) { return IU.docLines(x).join("\n"); }); }
function paraXml(xml, text) { const p = xml.split("</w:p>").map(function (p) { return p + "</w:p>"; }).find(function (p) { return paras(p)[0] === text; }) || ""; return p.slice(p.lastIndexOf("<w:p>")); }

(async function () {
  console.log("OCR Docs > Initial Update tests:\n");

  // ── 1. one founder: line by line against the templates ──
  const one = fixture();
  const want = {
    cover: [
      "मिति: २०८३/०५/१२",
      "श्रीमान रजिष्ट्रार ज्यू,",
      "कम्पनी रजिष्ट्रारको कार्यालय,",
      "त्रिपुरेश्वर, काठमाण्डौ ।",
      "विषय : कार्यालय खोलिएको जानकारी तथा शुरु अवस्थाको जानकारी गरी पाउँ भन्ने बारे ।",
      "महोदय,",
      "उपरोक्त विषयमा यस कम्पनीको कार्यालय " + ADDR + " मा खोलिएको जानकारी गराउँदै तपसिल बमोजिमको उल्लेखित कागजात विवरणहरू अभिलेखको लागि पेश गरेको व्यहोरा अनुरोध छ ।",
      "तपसिल",
      "१) शेयरधनीको बैठकको निर्णयको प्रतिलिपि ।",
      "२) ठेगानाको जानकारी ।",
      "३) लेखापरीक्षक नियुक्ति ।",
      "निवेदक",
      ".....................................",
      A,
      "अध्यक्ष",
      COMPANY,
    ],
    minutes1: [
      "शेयरधनीको बैठक नं. ०१",
      "शेयरधनीको बैठक",
      "आज मिति २०८३/०५/०५ गते ११.०० बजे " + KO + " शेयरधनीको बैठक, संस्थापक, श्री " + A + " ज्यूको उपस्थितिमा, " + ADDR + " मा अवस्थित कम्पनीको रजिष्टर्ड कार्यालयमा बसी निम्नलिखित निर्णयहरू गरियो ।",
      "उपस्थिति :",
      "क्र.सं. | नाम | पद | हस्ताक्षर",
      "१. | " + A + " | संस्थापक शेयरधनी | ",
      "प्रस्तावहरू",
      "१. कम्पनी दर्ता भएको जानकारी तथा कम्पनी स्थापना खर्च सम्बन्धमा ।",
      "२. कम्पनीको कार्यालय स्थापना सम्बन्धमा ।",
      "३. विविध ।",
      "निर्णय नं. १",
      "हाम्रो " + COMPANY + " नामको कम्पनी स्थापना गरी सञ्चालन गर्ने इच्छा भै आवश्यक कागजात प्रबन्धपत्र नियमावली लगायतका कागजहरू तयार गरी सम्बन्धित कार्यालयमा चलाइएको कारबाही अनुसार यही मिति २०८३/०५/०५ गते कम्पनी दर्ता नं. १२३४५६ मा कम्पनी रीत पूर्वक दर्ता भएको कुरा खुशीसाथ बैठकमा जानकारी गराइयो । यसको साथै कम्पनी दर्ता प्रयोजन तथा स्थापना सम्बन्धमा भएको खर्चलाई कम्पनीले अनुमोदन गरी व्यहोर्ने निर्णय गरियो ।",
      "निर्णय नं. २",
      "कम्पनी दर्ता भइसकेकोले कम्पनीको काम सञ्चालन तथा जनसम्पर्क गर्न सुरुमा नै कार्यालयको आवश्यकता पर्ने भएको हुँदा सोको लागि " + ADDR + " मा कम्पनीको कार्यालय राखी आवश्यक काम कारबाहीहरू तथा आवश्यक पुर्वाधारहरू तयार गर्दै जाने निर्णय गरियो ।",
      "निर्णय नं. ३",
      "बैठकमा छलफलको लागि अन्य विषय बस्तु केहि नहुँदा आजको बैठक यही समाप्त गरियो ।",
    ],
    minutes2: [
      "शेयरधनीको बैठक नं. ०२",
      "शेयरधनीको बैठक",
      "आज मिति २०८३/०५/०५ गते दिउँसो १ बजे " + KO + " शेयरधनीको बैठक " + A + " ज्यूको अध्यक्षतामा " + ADDR + " मा निम्नलिखित व्यक्तिहरूको उपस्थितिमा बसेकोमा निम्नलिखित निर्णयहरू गरियो ।",
      "उपस्थिति :",
      "क्र.सं. | नाम | पद | हस्ताक्षर",
      "१. | " + A + " | अध्यक्ष | ",
      "प्रस्तावहरू",
      "१. आर्थिक वर्ष २०८३/०८४ को आय विवरण लेखापरीक्षणको लागि लेखापरीक्षक नियुक्त गर्ने तथा पारिश्रमिक तोक्ने सम्बन्धमा ।",
      "२. विविध ।",
      "निर्णय नं. १",
      "कम्पनीको आर्थिक वर्ष २०८३/०८४ को लागि यस कम्पनीको हिसाब किताब तथा आय विवरणको लेखापरीक्षण गर्नको लागि कसलाई नियुक्त गर्ने र पारिश्रमिक कति दिने भन्ने विषयमा छलफल हुँदा लेखापरीक्षक श्री सी.ए. गौरव पोखरेल ज्यूलाई नियुक्त गर्ने र पारिश्रमिक स्वरुपको रकम निजसँग आपसी सहमतिमा दिने निर्णय गरियो ।",
      "निर्णय नं. २",
      "बैठकमा छलफलको लागि अन्य विषय बस्तु केहि नहुँदा आजको बैठक यही समाप्त गरियो ।",
    ],
    section184: [
      KO,
      "कम्पनी ऐन २०६३ को",
      "दफा १८४ बमोजिमको विवरण",
      "तहाँ कार्यालयमा कम्पनी दर्ता पश्चात कम्पनी ऐन २०६३ को दफा १८४ को उपदफा (२) र (४) बमोजिमको जानकारी कम्पनीले कार्यालयलाई गराउनु पर्ने व्यवस्था भएकोले तपसिल बमोजिमको जानकारी गराउँदछु ।",
      "तपसिल",
      "कम्पनीको हाल सम्मको जानकारी",
      "कम्पनीको ठेगाना : " + ADDR,
      "टेलिफोन नं : ९८००००००००, ०१-५५५००००",
      "फ्याक्स : छैन",
      "ईमेल : contact@example.com",
      "प्रमाणित गर्नेको",
      "नाम : " + A,
      "दर्जा : अध्यक्ष",
      "मिति : २०८३/०५/१२",
      "दस्तखत : ....................",
      "कम्पनीको छाप",
    ],
  };
  const got1 = linesOf(one);
  ["cover", "minutes1", "minutes2", "section184"].forEach(function (id, i) { eqLines("1. " + id + " text matches the templates (one founder)", got1[i], want[id]); });
  ok("1. exactly four documents, in the order of the spec", IU.model(one, W).docs.map(function (d) { return d.id; }).join(",") === "cover,minutes1,minutes2,section184");

  // output parity: the Word paragraphs are the model's text, in order
  const xml1 = await docxXml(IU.buildCombined(one, W));
  const expectParas = [];
  IU.model(one, W).docs.forEach(function (doc) {
    doc.blocks.forEach(function (b) {
      if (b.k === "table") b.head.concat([].concat.apply([], b.rows)).forEach(function (c) { if (c) expectParas.push(c); });
      else if (b.k === "sig") { b.left.forEach(function (x) { expectParas.push(x.value != null ? x.label + " : " + x.value : x.label); }); expectParas.push(b.right); }
      else if (b.k === "p") { if ((b.text + (b.latin || "")).trim()) expectParas.push(b.text + (b.latin || "")); }
      else expectParas.push(b.text);
    });
  });
  eqLines("1. the Word file carries exactly the same text as the model (nothing added or lost)", nonEmpty(xml1).map(function (t) { return t.replace(/\s+$/, ""); }), expectParas.map(function (t) { return t.replace(/\s+$/, ""); }));

  // ── 2. three founders ──
  const three = fixture({ founders: F3, chairIndex: 0 });
  const t3 = linesOf(three);
  ok("2. plural opening line in meeting 1", t3[1][2] === "आज मिति २०८३/०५/०५ गते ११.०० बजे " + KO + " शेयरधनीको बैठक, संस्थापक शेयरधनीहरूको उपस्थितिमा, " + ADDR + " मा अवस्थित कम्पनीको रजिष्टर्ड कार्यालयमा बसी निम्नलिखित निर्णयहरू गरियो ।", t3[1][2]);
  ok("2. meeting 1: one row per founder, default role filled", t3[1][5] === "१. | " + A + " | संस्थापक शेयरधनी | " && t3[1][6] === "२. | " + B2 + " | संस्थापक शेयरधनी | " && t3[1][7] === "३. | " + C3 + " | संस्थापक शेयरधनी | ", t3[1].slice(5, 8).join(" // "));
  ok("2. auditor meeting: chairman presides and shows अध्यक्ष, the others keep their role", new RegExp(A + " ज्यूको अध्यक्षतामा").test(t3[2][2]) && t3[2][5] === "१. | " + A + " | अध्यक्ष | " && t3[2][6] === "२. | " + B2 + " | संस्थापक शेयरधनी | " && t3[2][7] === "३. | " + C3 + " | संस्थापक शेयरधनी | ", t3[2].slice(2, 8).join(" // "));
  const t32 = linesOf(fixture({ founders: F3, chairIndex: 2 }));
  ok("2. a different chairman: presides, shows अध्यक्ष, is the default signer", new RegExp(C3 + " ज्यूको अध्यक्षतामा").test(t32[2][2]) && t32[2][7] === "३. | " + C3 + " | अध्यक्ष | " && t32[0][13] === C3, t32[0][13]);
  const m1 = IU.model(one, W), m3 = IU.model(three, W);
  ok("2. the plural wording is flagged for review in the model (and only the plural case)", !m1.plural && m3.plural && m3.docs[1].blocks.some(function (b) { return b.review; }) && !m1.docs[1].blocks.some(function (b) { return b.review; }));
  const srcCore = read("assets/js/ocr-initial-core.js"), srcYaml = read("data/ocr.yaml"), srcUi = read("assets/js/ocr-initial.js"), srcApp = read("assets/js/app.js");
  ok("2. plural wording is marked NEEDS REVIEW in the code and in the wording file", /NEEDS REVIEW[^\n]*plural/.test(srcCore) && /NEEDS REVIEW[^\n]*plural/.test(srcYaml));
  ok("2. a warning is raised for several founders (shown like the annual set's warnings)", IU.validate(three, W).warnings.some(function (w) { return /plural wording/.test(w); }) && /msg-warn/.test(srcUi));
  ok("2. the Word file does not carry the review marker", !/NEEDS REVIEW|needs review/i.test(await docxXml(IU.buildCombined(three, W))));

  // ── 3. financial year: the annual selector, not derived ──
  const fyBody = function (src) { const m = src.match(/for \(var y = 2089; y >= 2060; y--\) opt\(sel, OCRCore\.fyLabel\(y\), OCRCore\.fyLabel\(y\)\);\s*sel\.value = OCRCore\.fyLabel\(2082\);/); return m ? m[0].replace(/\s+/g, " ") : null; };
  ok("3. same options (2060/61 to 2089/90, annual labels) and same default as the annual form", fyBody(srcUi) && fyBody(srcUi) === fyBody(srcApp), String(fyBody(srcUi)));
  ok("3. the annual label format is printed (२०८३/०८४), exactly as selected", /आर्थिक वर्ष २०८३\/०८४ को आय/.test(got1[2][7]) && OCR.fyLabel(2083) === "२०८३/०८४");
  ok("3. the year is NOT derived from the registration date", /आर्थिक वर्ष २०८३\/०८४ को आय/.test(linesOf(fixture({ company: { name: COMPANY, regNo: "1", regDate: "2085/01/05" } }))[2][7]) && !/financialYear|fyOf/.test(srcCore));
  ok("3. the fiscal year is required when the auditor appointment is included", IU.validate(fixture({ auditor: { include: true, name: "x", fy: "" } }), W).errors.some(function (e) { return /Current fiscal year required/.test(e); }));

  // ── 4. dates: same inputs, Devanagari BS, validated ──
  const ash31 = [2080, 2081, 2082, 2083, 2084].find(function (y) { return BS.bsMonthDays(y, 2) === 31; });
  const bad = [ash31 + "/03/32", "2083/13/01", "2083/00/10", "2083/05/00", "1999/05/05", "2091/01/01", "abcd", "2083/5", "2083/02/31x"];
  bad.forEach(function (b) { ok("4. rejected: " + b, !!IU.parseDate(b).error, JSON.stringify(IU.parseDate(b))); });
  ok("4. Devanagari digits are accepted and printed with slashes", IU.dateText("२०८३-०५-२५") === "२०८३/०५/२५" && IU.dateText("2083/5/5") === "२०८३/०५/०५");
  const vb = IU.validate(fixture({ company: { name: COMPANY, regNo: "1", regDate: ash31 + "/03/32" } }), W);
  ok("4. an impossible registration date is an error", vb.errors.some(function (e) { return /Invalid date \(registration date\)/.test(e) && /does not exist/.test(e); }), vb.errors.join(" | "));
  ok("4. a missing date reads like the annual set's: Missing date: x.", IU.validate(fixture({ company: { name: COMPANY, regNo: "1", regDate: "" } }), W).errors.indexOf("Missing date: registration date.") >= 0);
  const vw = IU.validate(fixture({ meeting1: { date: "2083/04/01" } }), W);
  ok("4. a meeting before the registration date only warns", !vw.errors.length && vw.warnings.some(function (w) { return /earlier than the registration/.test(w); }), JSON.stringify(vw));
  const vw2 = IU.validate(fixture({ meeting2: { date: "2083/06/20" } }), W);
  ok("4. a meeting after the letter date only warns", !vw2.errors.length && vw2.warnings.some(function (w) { return /later than the letter/.test(w); }));
  ok("4. a clean fixture has no errors", IU.validate(one, W).errors.length === 0);
  ok("4. date inputs use the annual markup (class, placeholder)", /class="nepali-date dig" id="oiu-regDate" placeholder="२०८३\/०८\/०१"/.test(read("partials/tool-ocr-initial.html")) && /class="nepali-date dig" id="ocr-bod" placeholder="२०८३\/०८\/०१"/.test(read("partials/tool-ocr.html")));
  [["company.name", "Company name required."], ["company.regNo", "Registration number required."], ["address.district", "District required."], ["address.local", "Local level required."], ["address.ward", "Ward number required."], ["phones", "Phone number required."], ["founders", "Add at least one founder shareholder."]].forEach(function (k) {
    const f = fixture(); const parts = k[0].split("."); if (parts.length === 2) f[parts[0]] = Object.assign({}, f[parts[0]], { [parts[1]]: "" }); else f[k[0]] = [];
    ok("4. required: " + k[0] + " -> \"" + k[1] + "\"", IU.validate(f, W).errors.indexOf(k[1]) >= 0, IU.validate(f, W).errors.join(" | "));
  });

  // ── 5. auditor appointment off ──
  const off = fixture({ auditor: { include: false } });
  const m5 = IU.model(off, W), t5 = linesOf(off);
  ok("5. auditor off: three documents, no auditor minutes", m5.docs.length === 3 && m5.docs.map(function (d) { return d.id; }).join() === "cover,minutes1,section184");
  ok("5. auditor off: enclosure 3 is gone, 1 and 2 stay numbered", t5[0].filter(function (l) { return /^[१२३]\) /.test(l); }).join("|") === "१) शेयरधनीको बैठकको निर्णयको प्रतिलिपि ।|२) ठेगानाको जानकारी ।");
  const xOff = await docxXml(IU.buildCombined(off, W));
  ok("5. auditor off: nothing about the auditor in the Word file", !/लेखापरीक्षक/.test(xOff) && !/शेयरधनीको बैठक नं. ०२/.test(xOff));
  ok("5. auditor off: no auditor, no fiscal year is required", !IU.validate(fixture({ auditor: { include: false } }), W).errors.length);
  const nodoc = IU.model(fixture({ docsSelected: { section184: false, minutes1: false } }), W);
  ok("5. document choices (as in the annual set): unticked documents are left out", nodoc.docs.map(function (d) { return d.id; }).join() === "cover,minutes2");

  // ── 6. decision numbers are sequential in both minutes ──
  function decisionNos(lines) { return lines.filter(function (l) { return /^निर्णय नं\. /.test(l); }).map(function (l) { return l.replace("निर्णय नं. ", ""); }); }
  ok("6. meeting 1 decisions १ २ ३ (no gap)", decisionNos(got1[1]).join(" ") === "१ २ ३", decisionNos(got1[1]).join(" "));
  ok("6. auditor meeting decisions १ २", decisionNos(got1[2]).join(" ") === "१ २");
  ok("6. the sample's gap (a decision 4) never appears", !got1.some(function (d) { return d.some(function (l) { return /निर्णय नं\. ४/.test(l); }); }));

  // ── 7. combined file: page order, page breaks, no orphan headings ──
  const x7 = await docxXml(IU.buildCombined(three, W));
  const bodyParas = x7.split("</w:p>");
  const firstOf = function (text) { return bodyParas.findIndex(function (p) { return p.indexOf(text) >= 0; }); };
  const iCover = firstOf("तपसिल"), iM1 = firstOf("शेयरधनीको बैठक नं. ०१"), iM2 = firstOf("शेयरधनीको बैठक नं. ०२"), i184 = firstOf("दफा १८४ बमोजिमको विवरण");
  ok("7. page order: cover letter, meeting 1, auditor meeting, Section 184", iCover > 0 && iCover < iM1 && iM1 < iM2 && iM2 < i184);
  const pbb = function (text, back) { const p = bodyParas[firstOf(text) - (back || 0)]; return /<w:pageBreakBefore/.test(p); };
  ok("7. meeting 1, the auditor meeting and the statement each start on a new page", pbb("शेयरधनीको बैठक नं. ०१") && pbb("शेयरधनीको बैठक नं. ०२") && pbb("दफा १८४ बमोजिमको विवरण", 2));
  ok("7. the cover letter does not start with a page break (no blank first page)", !/<w:pageBreakBefore/.test(bodyParas[firstOf("मिति: २०८३/०५/१२")]));
  ok("7. no stray page-break paragraphs (a long document cannot get a blank page)", !/<w:br w:type="page"/.test(x7));
  const keepHeads = ["उपस्थिति :", "प्रस्तावहरू", "निर्णय नं. १", "निर्णय नं. २", "निर्णय नं. ३", "तपसिल"];
  ok("7. every heading is kept with the text after it (keepNext)", keepHeads.every(function (h) { return bodyParas.filter(function (p) { return paras(p + "</w:p>")[0] === h; }).every(function (p) { return /<w:keepNext/.test(p); }); }));
  ok("7. each meeting title is kept with the paragraph after it", bodyParas.filter(function (p) { return paras(p + "</w:p>")[0] === "शेयरधनीको बैठक"; }).every(function (p) { return /<w:keepNext/.test(p); }));
  const sep = IU.buildSeparate(three, W);
  ok("7. each document is also available separately, none starting with a page break", sep.length === 4 && (await Promise.all(sep.map(function (s) { return docxXml(s.doc); }))).every(function (x) { return !/<w:pageBreakBefore/.test(x); }));

  // ── 8. page, fonts, sizes, spacing, headings, tables and signature: the annual set's ──
  const annualData = { company: { name: "क", address: "ख", reg: "१", letterhead: false }, members: [{ name: "ग", role: "अध्यक्ष" }], chairIndex: 0, dates: { bod: "२०८३/०८/०१", agm: "२०८३/०८/२९", app: "२०८३/०९/२९" }, times: {}, fiscal: { current: "२०८२/०८३", next: "२०८३/०८४" }, auditors: { prev: {}, cur: { name: "घ", firm: "ङ" }, next: { name: "घ", firm: "ङ" } }, capital: {}, sec92: [], sec51: {}, acceptance: {}, fee: {}, docsSelected: { agm: true, app50: true, sec92: false, sec51: false, bo: false, agmBod: true, c1: false } };
  const xo = await docxXml(OCR.buildCombined(annualData, W));
  const pg = function (x) { return (x.match(/<w:pgSz[^>]*>/) || [""])[0]; };
  ok("8. A4 page, as the annual set", pg(x7) === pg(xo) && /w:w="11906"/.test(pg(x7)) && /w:h="16838"/.test(pg(x7)), pg(x7) + " vs " + pg(xo));
  ok("8. 1 inch margins (the annual set sets none: Word's default 1 inch)", /<w:pgMar[^>]*w:top="1440"[^>]*w:right="1440"[^>]*w:bottom="1440"[^>]*w:left="1440"/.test(x7));
  const fontsOf = function (x) { return Array.from(new Set((x.match(/w:ascii="([^"]+)"/g) || []).map(function (s) { return s.slice(9, -1); }))).sort(); };
  ok("8. Nepali text is Mangal, as in the annual set; only the email address is Arial", fontsOf(xo).join() === "Mangal" && fontsOf(x7).join() === "Arial,Mangal" && (x7.match(/w:ascii="Arial"/g) || []).length === 1 && /w:ascii="Arial"[\s\S]{0,300}contact@example\.com/.test(x7));
  const strip = function (p) { return p.replace(/<w:keepNext\/>/g, ""); };
  ok("8. attendance heading: same bold underlined heading as the annual minutes (font, size, spacing)", strip(paraXml(x7, "उपस्थिति :")) === strip(paraXml(xo, "उपस्थिति :")) && paraXml(x7, "उपस्थिति :").length > 100);
  ok("8. proposals heading: same as the annual minutes", strip(paraXml(x7, "प्रस्तावहरू")) === strip(paraXml(xo, "प्रस्तावहरू")) && paraXml(x7, "प्रस्तावहरू").length > 100);
  const dots = ".....................................";
  ok("8. signature block: the annual set's dotted line (same spacing and font)", strip(paraXml(x7, dots)) === strip(paraXml(xo, dots)) && paraXml(x7, dots).length > 100);
  ok("8. letter: salutation and the right aligned date line laid out as the annual application letter", strip(paraXml(x7, "महोदय,")) === strip(paraXml(xo, "महोदय,")) && strip(paraXml(x7, "मिति: २०८३/०५/१२")).replace(/मिति[^<]*/, "") === strip(paraXml(xo, "मिति: २०८३/०९/२९")).replace(/मिति[^<]*/, "") && /w:val="right"/.test(paraXml(x7, "मिति: २०८३/०५/१२")));
  const tc = function (x, label) { const i = x.indexOf(label); return x.slice(x.lastIndexOf("<w:tc>", i), x.indexOf("</w:tc>", i) + 7); };
  ok("8. attendance table: same header cell (grey shading, borders, bold) as the annual one", tc(x7, "क्र.सं.") === tc(xo, "क्र.सं.") && tc(x7, "क्र.सं.").length > 150);
  ok("8. attendance table: same column widths as the annual one", (x7.match(/<w:tblGrid>[\s\S]*?<\/w:tblGrid>/) || [""])[0] === (xo.match(/<w:tblGrid>[\s\S]*?<\/w:tblGrid>/) || [""])[0] && /<w:gridCol w:w="2800"/.test(x7));
  ok("8. attendance table: the annual table headers are used", got1[1][4] === W.tables.attendance.join(" | "));
  ok("8. same builders, not a copy: the core takes P, heading, subHead, TC and autoTable from ocr-core", /OCRCore\.builders/.test(srcCore) && !/new TableCell\(\{[^}]*shading/.test(srcCore));

  // ── 9. possessive: the annual form ──
  const all = docTexts(three).join("\n");
  ok("9. company + one space + को, as the annual wording writes it", OCR.possessive(COMPANY) === KO && all.split(KO).length - 1 === 3, String(all.split(KO).length - 1));
  ok("9. the annual wording uses the same form (\"{company} को\")", /\{company\} को /.test(srcYaml.slice(0, srcYaml.indexOf("\ninitial:"))));
  ok("9. never attached: no company name directly followed by को", !/प्रा\.लि\.को/.test(all));

  // ── 10. addresses and signatures ──
  ok("10. the address is built from three fields and is identical in every document", IU.addressText(one.address, W) === ADDR && got1.every(function (d) { return d.join("\n").indexOf(ADDR) >= 0; }));
  ok("10. meeting 1 decision 2 uses the full address", got1[1].some(function (l) { return l.indexOf("सोको लागि " + ADDR + " मा कम्पनीको कार्यालय") >= 0; }));
  ok("10. the district is printed once in the cover letter", got1[0].join("\n").split("काठमाडौँ जिल्ला").length - 1 === 1);
  ok("10. phone numbers are Devanagari, the email stays Latin", /टेलिफोन नं : ९८००००००००, ०१-५५५००००/.test(got1[3].join("\n")) && /contact@example\.com/.test(got1[3].join("\n")));
  ok("10. the statement ends with the certifier block and the company seal", got1[3].slice(-6).join("|") === "प्रमाणित गर्नेको|नाम : " + A + "|दर्जा : अध्यक्ष|मिति : २०८३/०५/१२|दस्तखत : ....................|कम्पनीको छाप");

  // ── 11. meeting time, numbers and other defaults ──
  ok("11. meeting time: a plain text field defaulting to the annual SGM time, written as typed", got1[1][2].indexOf("गते " + W.defaults.times.sgm + " ") > 0 && got1[2][2].indexOf("गते दिउँसो १ बजे ") > 0);
  ok("11. the time field is the annual markup (class np, no hour/part fields)", /<input type="text" class="np" id="oiu-m1Time">/.test(read("partials/tool-ocr-initial.html")) && /class="np" id="ocr-timeSgm"/.test(read("partials/tool-ocr.html")) && !/m1Hour|dayPart/.test(read("partials/tool-ocr-initial.html")));
  const ed = fixture({ meeting1: { no: "5", time: "बिहान १० बजे" }, meeting2: { no: "03", date: "2083/05/09" }, signer: { name: "अर्को हस्ताक्षरकर्ता", designation: "प्रबन्ध सञ्चालक" }, fax: "०१-५५५११११", ocrOffice: "कम्पनी रजिष्ट्रारको कार्यालय, काठमाण्डौ" });
  const ted = linesOf(ed);
  ok("11. meeting numbers default to 01 and 02, and can be changed", got1[1][0].endsWith("०१") && got1[2][0].endsWith("०२") && ted[1][0].endsWith("५") && ted[2][0].endsWith("०३"));
  ok("11. meeting 1 time can be changed", ted[1][2].indexOf("गते बिहान १० बजे ") > 0);
  ok("11. second meeting date default = meeting 1, and can differ", got1[2][2].indexOf("२०८३/०५/०५") >= 0 && ted[2][2].indexOf("२०८३/०५/०९") >= 0);
  ok("11. signer, designation and fax can be changed", ted[0][13] === "अर्को हस्ताक्षरकर्ता" && ted[0][14] === "प्रबन्ध सञ्चालक" && ted[3].indexOf("फ्याक्स : ०१-५५५११११") >= 0, ted[0].slice(12, 16).join("|"));
  ok("11. a one-part OCR office line prints on one line with the stop mark", ted[0][2] === "कम्पनी रजिष्ट्रारको कार्यालय," && ted[0][3] === "काठमाण्डौ ।");
  ok("11. letter date defaults to the date given for today", IU.model(fixture({ letterDate: "" }), W, "2083/06/01").docs[0].blocks[0].text === "मिति: २०८३/०६/०१");
  ok("11. the auditor is printed as title + name, like the annual letters", /लेखापरीक्षक श्री सी\.ए\. गौरव पोखरेल ज्यूलाई/.test(got1[2][10]) && /लेखापरीक्षक श्री गौरव पोखरेल ज्यूलाई/.test(linesOf(fixture({ auditor: { include: true, name: "गौरव पोखरेल", fy: "२०८३/०८४" } }))[2][10]));

  // ── 12. spellings: the annual set's ──
  const initPart = srcYaml.slice(srcYaml.indexOf("\ninitial:")), annPart = srcYaml.slice(0, srcYaml.indexOf("\ninitial:"));
  const toks = function (t) { return t.match(/[ऀ-ॿ]+/g) || []; };
  const skel = function (t) { return t.replace(/ू/g, "ु").replace(/ी/g, "ि").replace(/[ंँ]/g, "").replace(/‍/g, ""); };
  const annTok = new Set(toks(annPart)), bySkel = {};
  annTok.forEach(function (t) { (bySkel[skel(t)] = bySkel[skel(t)] || []).push(t); });
  const clash = Array.from(new Set(toks(initPart))).filter(function (t) { return !annTok.has(t) && bySkel[skel(t)]; });
  ok("12. no word is spelled differently from the annual set's spelling of it", !clash.length, clash.join(", "));
  ok("12. the annual spellings are used: हरू, यही, निम्नलिखित, उपस्थिति, तपसिल, कारबाही, व्यहोर", !/हरु|यहि|निम्न लिखित|उपस्थिती|तपसील|कारवाही|ब्यहोर/.test(initPart + all) && /हरू/.test(all) && /यही/.test(all) && /निम्नलिखित/.test(all) && /उपस्थिति/.test(all) && /तपसिल/.test(all) && /कारबाही/.test(all));
  ok("12. ज्यू is a separate word, as in most annual wording", /श्री .* ज्यूको/.test(got1[1][2]) && !/[^ ]ज्यू/.test(all));
  const sample = ["सचालन", "रर्जिष्टर्ड", "ईच्छा", "लगाएतका", "हुदाँ", "बिषय", "बिवरण"];
  ok("12. none of the sample's typing errors appears", !sample.some(function (w) { return all.indexOf(w) >= 0 || initPart.indexOf(w) >= 0; }));

  // ── 13. form and tool: same pattern as OCR Automation ──
  const pOcr = read("partials/tool-ocr.html"), pIu = read("partials/tool-ocr-initial.html");
  const cls = function (h, re) { return (h.match(re) || []).length; };
  ok("13. five step panels, sidebar and mobile steps like the annual tool", cls(pIu, /class="step-panel/g) === 5 && /class="sidebar"/.test(pIu) && /id="oiu-m-steps"/.test(pIu) && cls(pOcr, /class="step-panel/g) === 5);
  ok("13. Review & Generate: choose documents, output choice, generate panel and PDF note in the annual wording", ["Choose documents", "One combined Word file", "Separate files (.zip)", "Ready to Generate", "Generate Word Documents", "Need a PDF? Open the downloaded"].every(function (t) { return pIu.indexOf(t) >= 0 && pOcr.indexOf(t) >= 0; }));
  ok("13. Back / Next buttons and the save/load client file buttons as in the annual tool", ["← Back", "Next: ", "Save client file", "Load client file", "Runs in your browser"].every(function (t) { return pIu.indexOf(t) >= 0 && pOcr.indexOf(t) >= 0; }));
  ok("13. the company-name example is the annual one (हिमाल ट्रेडर्स प्रा.लि.), in the form", /id="oiu-companyName" placeholder="हिमाल ट्रेडर्स प्रा\.लि\."/.test(pIu) && /id="ocr-companyName" placeholder="हिमाल ट्रेडर्स प्रा\.लि\."/.test(pOcr));
  ok("13. no preview, as the annual tool has none", !/preview/i.test(pIu + srcUi) && !/preview/i.test(pOcr));
  ok("13. step buttons use their own attribute so they never trigger the annual tool's handler", !/data-goto=/.test(pIu) && /data-oiu-goto/.test(pIu));
  ok("13. download names follow the annual pattern: {company}_documents.docx / .zip, entries N_id.docx", /"_documents\.docx"/.test(srcUi) && /"_documents\.zip"/.test(srcUi) && /\(i \+ 1\) \+ "_" \+ sep\[i\]\.id \+ "\.docx"/.test(srcUi) && /"_documents\.docx"/.test(srcApp));
  const port = read("assets/js/portal.js");
  ok("13. registered in the portal like the other tools; shared scripts load once", /"ocr-initial": \[/.test(port) && /scriptLoads\[key\]/.test(port));

  // ── 14. nothing from a real client in the repository ──
  const scanned = ["data/ocr.yaml", "assets/js/ocr-initial-core.js", "assets/js/ocr-initial.js", "partials/tool-ocr-initial.html", "scripts/ocr-initial.test.js", "scripts/make-ocr-initial-samples.js"];
  ok("14. fixtures use the annual example names only (no template or sample file is committed)", scanned.every(function (f) { return fs.existsSync(path.join(ROOT, f)); }) && !fs.readdirSync(ROOT).some(function (f) { return /Initial-Update-Template|\.pdf$/i.test(f); }));

  console.log("\n" + pass + " passed, " + fail + " failed.");
  process.exit(fail ? 1 : 0);
})();
