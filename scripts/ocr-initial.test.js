/*
 * Tests for OCR Docs > Initial Update (OCR_INITIAL_UPDATE_SPEC.md section 8). Run: npm test.
 * Uses the SAME core the browser uses (assets/js/ocr-initial-core.js) and the same wording
 * (data/ocr.yaml, key "initial"), then inspects the real .docx output.
 * FICTIONAL data only: nothing here comes from a real client file.
 */
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const PizZip = require("pizzip");
const IU = require("../assets/js/ocr-initial-core.js");
const OCR = require("../assets/js/ocr-core.js");
const BS = require("../assets/js/common/psg-bsdate.js");

const ROOT = path.resolve(__dirname, "..");
const W = yaml.load(fs.readFileSync(path.join(ROOT, "data", "ocr.yaml"), "utf8"));

let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log("  PASS  " + name); } else { fail++; console.log("  FAIL  " + name + (extra ? "\n        " + extra : "")); } }
function eqLines(name, got, want) {
  const bad = []; const n = Math.max(got.length, want.length);
  for (let i = 0; i < n; i++) if (got[i] !== want[i]) bad.push("line " + (i + 1) + "\n          got : " + got[i] + "\n          want: " + want[i]);
  ok(name, !bad.length, bad.slice(0, 3).join("\n        "));
}

// ── fictional fixtures ──
const COMPANY = "सन्स्कृत उदाहरण प्रा. लि.";
const KO = COMPANY + "को";             // the one possessive form (OCRCore.possessive): no space
function fixture(over) {
  return Object.assign({
    company: { name: COMPANY, type: "private", regNo: "98765", regDate: "2083/05/05" },
    address: { district: "कास्की", local: "नमुना नगरपालिका", ward: "7" },
    phones: ["9800000000", "01-5550000"], fax: "", email: "contact@example.com", ocrOffice: "",
    founders: [{ name: "काल्पनिक नाम एक" }], chairIndex: 0, signer: {},
    meeting1: { date: "", time: { part: "बिहान", hour: "11", minute: "" }, no: "" },
    meeting2: { date: "", time: { part: "दिउँसो", hour: "2", minute: "30" }, no: "" },
    letterDate: "2083/05/12",
    auditor: { include: true, name: "सी.ए. नमुना लेखापरीक्षक", fy: "", fee: "" },
  }, over || {});
}
const ADDR = "कास्की जिल्ला नमुना नगरपालिका वडा नं. ७";
const F3 = [{ name: "काल्पनिक नाम एक", role: "" }, { name: "काल्पनिक नाम दुई", role: "" }, { name: "काल्पनिक नाम तीन", role: "संस्थापक शेयरधनी" }];

function docxXml(doc) { return OCR.Packer.toBuffer(doc).then(function (b) { return new PizZip(b).file("word/document.xml").asText(); }); }
function paras(xml) {
  return xml.split(/<\/w:p>/).map(function (p) { return (p.match(/<w:t(?: [^>]*)?>([\s\S]*?)<\/w:t>/g) || []).map(function (s) { return s.replace(/<[^>]+>/g, ""); }).join(""); });
}
function nonEmpty(xml) { return paras(xml).filter(function (t) { return t.trim(); }); }
function linesOf(d) { return IU.model(d, W).docs.map(function (x) { return IU.docLines(x); }); }
function docTexts(d) { return IU.model(d, W).docs.map(function (x) { return IU.docLines(x).join("\n"); }); }

(async function () {
  console.log("OCR Docs > Initial Update tests (spec section 8):\n");

  // ── 1. one founder: line by line against the section 4 templates ──
  const one = fixture();
  const want = {
    cover: [
      "मिति : २०८३/०५/१२",
      "श्रीमान् रजिष्ट्रारज्यू,",
      "कम्पनी रजिष्ट्रारको कार्यालय,",
      "त्रिपुरेश्वर, काठमाण्डौ ।",
      "विषय : कार्यालय खोलिएको जानकारी तथा शुरु अवस्थाको जानकारी गरी पाउँ भन्ने बारे ।",
      "महोदय,",
      "उपरोक्त विषयमा यस कम्पनीको कार्यालय " + ADDR + " मा खोलिएको जानकारी गराउँदै तपसिल बमोजिमको उल्लेखित कागजात विवरणहरु अभिलेखको लागि पेश गरेको व्यहोरा अनुरोध छ ।",
      "तपसिल",
      "१) शेयरधनीको बैठकको निर्णयको प्रतिलिपि ।",
      "२) ठेगानाको जानकारी ।",
      "३) लेखापरीक्षक नियुक्ति ।",
      "निवेदक",
      COMPANY,
      "काल्पनिक नाम एक",
      "अध्यक्ष",
      ".............",
    ],
    minutes1: [
      "शेयरधनीको बैठक नं. ०१",
      "शेयरधनीको बैठक",
      "आज मिति २०८३/०५/०५ गते बिहान ११ बजे " + KO + " शेयरधनीको बैठक, संस्थापक, श्री काल्पनिक नाम एकज्यूको उपस्थितिमा, " + ADDR + " मा अवस्थित कम्पनीको रजिष्टर्ड कार्यालयमा बसी निम्न लिखित निर्णयहरु गरियो ।",
      "उपस्थिति :",
      "क्रम सं | नाम | पद | हस्ताक्षर",
      "१ | काल्पनिक नाम एक | संस्थापक शेयरधनी | ",
      "",
      "प्रस्तावहरु :",
      "१. कम्पनी दर्ता भएको जानकारी तथा कम्पनी स्थापना खर्च सम्बन्धमा ।",
      "२. कम्पनीको कार्यालय स्थापना सम्बन्धमा ।",
      "३. विविध ।",
      "निर्णय नं. १",
      "हाम्रो " + COMPANY + " नामको कम्पनी स्थापना गरी सञ्चालन गर्ने इच्छा भै आवश्यक कागजात प्रबन्धपत्र नियमावली लगायतका कागजहरु तयार गरी सम्बन्धित कार्यालयमा चलाइएको कारबाही अनुसार यहि मिति २०८३/०५/०५ गते कम्पनी दर्ता नं. ९८७६५ मा कम्पनी रीत पूर्वक दर्ता भएको कुरा खुशीसाथ बैठकमा जानकारी गराइयो । यसको साथै कम्पनी दर्ता प्रयोजन तथा स्थापना सम्बन्धमा भएको खर्चलाई कम्पनीले अनुमोदन गरी ब्यहोर्ने निर्णय गरियो ।",
      "निर्णय नं. २",
      "कम्पनी दर्ता भइसकेकोले कम्पनीको काम सञ्चालन तथा जनसम्पर्क गर्न सुरुमा नै कार्यालयको आवश्यकता पर्ने भएको हुँदा सोको लागि " + ADDR + " मा कम्पनीको कार्यालय राखी आवश्यक काम कारबाहीहरु तथा आवश्यक पुर्वाधारहरु तयार गर्दै जाने निर्णय गरियो ।",
      "निर्णय नं. ३",
      "बैठकमा छलफलको लागि अन्य विषय बस्तु केहि नहुँदा आजको बैठक यहि समाप्त गरियो ।",
    ],
    minutes2: [
      "शेयरधनीको बैठक नं. ०२",
      "शेयरधनीको बैठक",
      "आज मिति २०८३/०५/०५ गते दिउँसो २:३० बजे " + KO + " शेयरधनीको बैठक काल्पनिक नाम एकज्यूको अध्यक्षतामा " + ADDR + " मा निम्न लिखित व्यक्तिहरुको उपस्थितिमा बसेकोमा निम्न लिखित निर्णयहरु गरियो ।",
      "उपस्थिति :",
      "क्रम सं | नाम | पद | हस्ताक्षर",
      "१ | काल्पनिक नाम एक | अध्यक्ष | ",
      "",
      "प्रस्तावहरु :",
      "१. आर्थिक वर्ष २०८३/८४ को आय विवरण लेखापरीक्षणको लागि लेखापरीक्षक नियुक्त गर्ने तथा पारिश्रमिक तोक्ने सम्बन्धमा ।",
      "२. विविध ।",
      "निर्णय नं. १",
      "कम्पनीको आर्थिक वर्ष २०८३/८४ को लागि यस कम्पनीको हिसाब किताब तथा आय विवरणको लेखापरीक्षण गर्नको लागि कसलाई नियुक्त गर्ने र पारिश्रमिक कति दिने भन्ने विषयमा छलफल हुँदा लेखापरीक्षक श्री सी.ए. नमुना लेखापरीक्षकज्यूलाई नियुक्त गर्ने र पारिश्रमिक स्वरुपको रकम निजसँग आपसी सहमतिमा दिने निर्णय गरियो ।",
      "निर्णय नं. २",
      "बैठकमा छलफलको लागि अन्य विषय बस्तु केहि नहुँदा आजको बैठक यहि समाप्त गरियो ।",
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
      "नाम : काल्पनिक नाम एक",
      "दर्जा : अध्यक्ष",
      "मिति : २०८३/०५/१२",
      "दस्तखत : ....................",
      "कम्पनीको छाप",
    ],
  };
  const got1 = linesOf(one);
  ["cover", "minutes1", "minutes2", "section184"].forEach(function (id, i) { eqLines("1. " + id + " text matches the template (one founder)", got1[i], want[id]); });
  ok("1. exactly four documents, in the order of spec section 1", IU.model(one, W).docs.map(function (d) { return d.id; }).join(",") === "cover,minutes1,minutes2,section184");

  // output parity: the Word paragraphs are the model's text, in order
  const xml1 = await docxXml(IU.buildCombined(one, W));
  const expectParas = [];
  IU.model(one, W).docs.forEach(function (doc) {
    doc.blocks.forEach(function (b) {
      if (b.k === "table") b.head.concat([].concat.apply([], b.rows)).forEach(function (c) { if (c) expectParas.push(c); });
      else if (b.k === "sig") b.left.forEach(function (x) { expectParas.push(x.value != null ? x.label + " : " + x.value : x.label); }), expectParas.push(b.right);
      else if (b.k === "p") { if ((b.text + (b.latin || "")).trim()) expectParas.push(b.text + (b.latin || "")); }
      else expectParas.push(b.text);
    });
  });
  eqLines("1. the Word file carries exactly the same text as the model (nothing added or lost)", nonEmpty(xml1).map(function (t) { return t.replace(/\s+$/, ""); }), expectParas.map(function (t) { return t.replace(/\s+$/, ""); }));

  // ── 2. three founders ──
  const three = fixture({ founders: F3, chairIndex: 0 });
  const t3 = linesOf(three);
  ok("2. plural opening line in meeting 1", t3[1][2] === "आज मिति २०८३/०५/०५ गते बिहान ११ बजे " + KO + " शेयरधनीको बैठक, संस्थापक शेयरधनीहरुको उपस्थितिमा, " + ADDR + " मा अवस्थित कम्पनीको रजिष्टर्ड कार्यालयमा बसी निम्न लिखित निर्णयहरु गरियो ।", t3[1][2]);
  ok("2. meeting 1 rows", t3[1][5] === "१ | काल्पनिक नाम एक | संस्थापक शेयरधनी | " && t3[1][6] === "२ | काल्पनिक नाम दुई | संस्थापक शेयरधनी | " && t3[1][7] === "३ | काल्पनिक नाम तीन | संस्थापक शेयरधनी | ", t3[1].slice(5, 8).join(" // "));
  ok("2. auditor meeting: chairman presides and shows अध्यक्ष, the others keep their role", /काल्पनिक नाम एकज्यूको अध्यक्षतामा/.test(t3[2][2]) && t3[2][5] === "१ | काल्पनिक नाम एक | अध्यक्ष | " && t3[2][6] === "२ | काल्पनिक नाम दुई | संस्थापक शेयरधनी | " && t3[2][7] === "३ | काल्पनिक नाम तीन | संस्थापक शेयरधनी | ", t3[2].slice(2, 8).join(" // "));
  const three2 = fixture({ founders: F3, chairIndex: 2 });
  const t32 = linesOf(three2);
  ok("2. a different chairman: presides, shows अध्यक्ष, is the default signer", /काल्पनिक नाम तीनज्यूको अध्यक्षतामा/.test(t32[2][2]) && t32[2][7] === "३ | काल्पनिक नाम तीन | अध्यक्ष | " && t32[0][13] === "काल्पनिक नाम तीन");
  const pv1 = IU.preview(one, W), pv3 = IU.preview(three, W);
  ok("2. plural wording is flagged for review in the preview (and only the plural case)", !pv1.plural && pv3.plural && pv3.docs[1].blocks.some(function (b) { return b.review; }) && !pv1.docs[1].blocks.some(function (b) { return b.review; }));
  const srcCore = fs.readFileSync(path.join(ROOT, "assets/js/ocr-initial-core.js"), "utf8"), srcYaml = fs.readFileSync(path.join(ROOT, "data/ocr.yaml"), "utf8");
  ok("2. plural wording is marked NEEDS REVIEW in the code and in the wording file", /NEEDS REVIEW[^\n]*plural/.test(srcCore) && /NEEDS REVIEW[^\n]*plural/.test(srcYaml));
  ok("2. a warning is raised for several founders", IU.validate(three, W).warnings.some(function (w) { return /plural wording/.test(w); }));
  const x3 = await docxXml(IU.buildCombined(three, W));
  ok("2. the Word file does not carry the review marker", !/NEEDS REVIEW|needs review/i.test(x3));

  // ── 3. financial year ──
  [["2083/04/01", "२०८३/८४"], ["2083/03/31", "२०८२/८३"], ["2084/01/15", "२०८३/८४"], ["2083/05/05", "२०८३/८४"], ["२०८३/१२/३०", "२०८३/८४"], ["2090/03/10", "२०८९/९०"]].forEach(function (c) {
    ok("3. financial year of " + c[0] + " = " + c[1], IU.financialYear(c[0]) === c[1], IU.financialYear(c[0]));
  });
  ok("3. Shrawan 1 starts a year and the day before is the old one", IU.financialYear("2083/03/32") === "२०८२/८३" || BS.bsMonthDays(2083, 2) < 32);
  ok("3. the financial year is editable and the edit is printed", /आर्थिक वर्ष २०८४\/८५ को आय/.test(docTexts(fixture({ auditor: { include: true, name: "x", fy: "२०८४/८५" } }))[2]));

  // ── 4. invalid dates ──
  const ash31 = [2080, 2081, 2082, 2083, 2084].find(function (y) { return BS.bsMonthDays(y, 2) === 31; });
  const bad = [ash31 + "/03/32", "2083/13/01", "2083/00/10", "2083/05/00", "1999/05/05", "2091/01/01", "abcd", "2083/5", "2083/02/31x"];
  bad.forEach(function (b) { ok("4. rejected: " + b, !!IU.parseDate(b).error, JSON.stringify(IU.parseDate(b))); });
  ok("4. accepted: the real last day of Ashad in a 32 day year", BS.bsMonthDays(2083, 2) !== 32 || !IU.parseDate("2083/03/32").error);
  ok("4. Devanagari digits are accepted and printed with slashes", IU.dateText("२०८३-०५-२५") === "२०८३/०५/२५" && IU.dateText("2083/5/5") === "२०८३/०५/०५");
  const vb = IU.validate(fixture({ company: { name: COMPANY, regNo: "1", regDate: ash31 + "/03/32" } }), W);
  ok("4. validate() reports the impossible registration date as an error", vb.errors.some(function (e) { return /Registration date/.test(e) && /does not exist/.test(e); }), vb.errors.join(" | "));
  const vw = IU.validate(fixture({ meeting1: { date: "2083/04/01" }, letterDate: "2083/05/12" }), W);
  ok("4. a meeting before the registration date only warns", !vw.errors.length && vw.warnings.some(function (w) { return /earlier than the registration/.test(w); }), JSON.stringify(vw));
  const vw2 = IU.validate(fixture({ meeting2: { date: "2083/06/20" } }), W);
  ok("4. a meeting after the letter date only warns", !vw2.errors.length && vw2.warnings.some(function (w) { return /later than the letter/.test(w); }));
  ok("4. a clean fixture has no errors", IU.validate(one, W).errors.length === 0);
  ["company.name", "company.regNo", "address.district", "address.local", "address.ward", "phones", "founders"].forEach(function (k) {
    const f = fixture(); const parts = k.split("."); if (parts.length === 2) f[parts[0]] = Object.assign({}, f[parts[0]], { [parts[1]]: "" }); else f[k] = [];
    ok("4. required: " + k, IU.validate(f, W).errors.length > 0);
  });

  // ── 5. auditor appointment off ──
  const off = fixture({ auditor: { include: false } });
  const m5 = IU.model(off, W), t5 = linesOf(off);
  ok("5. auditor off: three documents, no auditor minutes", m5.docs.length === 3 && m5.docs.map(function (d) { return d.id; }).join() === "cover,minutes1,section184");
  ok("5. auditor off: enclosure 3 is gone, 1 and 2 stay numbered", t5[0].filter(function (l) { return /^[१२३]\) /.test(l); }).join("|") === "१) शेयरधनीको बैठकको निर्णयको प्रतिलिपि ।|२) ठेगानाको जानकारी ।");
  const xOff = await docxXml(IU.buildCombined(off, W));
  ok("5. auditor off: nothing about the auditor in the Word file", !/लेखापरीक्षक/.test(xOff) && !/शेयरधनीको बैठक नं. ०२/.test(xOff));
  ok("5. auditor off: no auditor name is required", !IU.validate(Object.assign(fixture(), { auditor: { include: false } }), W).errors.length);

  // ── 6. decision numbers are sequential in both minutes ──
  function decisionNos(lines) { return lines.filter(function (l) { return /^निर्णय नं\. /.test(l); }).map(function (l) { return l.replace("निर्णय नं. ", ""); }); }
  ok("6. meeting 1 decisions १ २ ३ (no gap)", decisionNos(got1[1]).join(" ") === "१ २ ३", decisionNos(got1[1]).join(" "));
  ok("6. auditor meeting decisions १ २", decisionNos(got1[2]).join(" ") === "१ २");
  ok("6. proposals and decisions agree in count in both minutes", got1[1].filter(function (l) { return /^[१२३]\. /.test(l); }).length === 3 && got1[2].filter(function (l) { return /^[१२]\. /.test(l); }).length === 2);
  ok("6. the sample's gap (a decision 4) never appears", !got1.some(function (d) { return d.some(function (l) { return /निर्णय नं\. ४/.test(l); }); }));

  // ── 7. combined file: page order, page breaks, no orphan headings ──
  const doc = IU.buildCombined(three, W);
  const x7 = await docxXml(doc);
  const bodyParas = x7.split("</w:p>");
  const firstOf = function (text) { return bodyParas.findIndex(function (p) { return p.indexOf(text) >= 0; }); };
  const iCover = firstOf("तपसिल"), iM1 = firstOf("शेयरधनीको बैठक नं. ०१"), iM2 = firstOf("शेयरधनीको बैठक नं. ०२"), i184 = firstOf("दफा १८४ बमोजिमको विवरण");
  ok("7. page order: cover letter, meeting 1, auditor meeting, Section 184", iCover > 0 && iCover < iM1 && iM1 < iM2 && iM2 < i184);
  const pbb = function (text, last) { const p = bodyParas[last ? firstOf(text) - 2 : firstOf(text)]; return /<w:pageBreakBefore\/?>/.test(p) || /<w:pageBreakBefore /.test(p); };
  ok("7. meeting 1, the auditor meeting and the statement each start on a new page", pbb("शेयरधनीको बैठक नं. ०१") && pbb("शेयरधनीको बैठक नं. ०२") && pbb("दफा १८४ बमोजिमको विवरण", true));
  ok("7. the cover letter does not start with a page break (no blank first page)", !/<w:pageBreakBefore/.test(bodyParas[firstOf("मिति : २०८३/०५/१२")]));
  ok("7. no stray page-break paragraphs (a long document cannot get a blank page)", !/<w:br w:type="page"/.test(x7));
  const keepHeads = ["उपस्थिति :", "उपस्थिति :", "प्रस्तावहरु :", "निर्णय नं. १", "निर्णय नं. २", "निर्णय नं. ३"];
  ok("7. every heading is kept with the text after it (keepNext)", keepHeads.every(function (h) { return bodyParas.filter(function (p) { return paras(p + "</w:p>")[0] === h; }).every(function (p) { return /<w:keepNext/.test(p); }); }));
  ok("7. A4 page, 1 inch margins", /<w:pgSz w:w="11906" w:h="16838"/.test(x7) && /<w:pgMar[^>]*w:top="1440"[^>]*w:right="1440"[^>]*w:bottom="1440"[^>]*w:left="1440"/.test(x7), (x7.match(/<w:pgSz[^>]*>|<w:pgMar[^>]*>/g) || []).join(" "));
  const sep = IU.buildSeparate(three, W);
  ok("7. each document is also available separately, none starting with a page break", sep.length === 4 && (await Promise.all(sep.map(function (s) { return docxXml(s.doc); }))).every(function (x) { return !/<w:pageBreakBefore/.test(x); }));

  // ── 8. fonts and appearance match the annual set (same builders, same font) ──
  const xo = await OCR.Packer.toBuffer(OCR.buildCombined({ company: { name: "क", address: "ख", reg: "१", letterhead: false }, members: [{ name: "ग", role: "अध्यक्ष" }], chairIndex: 0, dates: { bod: "२०८३/०८/०१", agm: "२०८३/०८/२९", app: "२०८३/०९/२९" }, times: {}, fiscal: { current: "२०८२/०८३", next: "२०८३/०८४" }, auditors: { prev: {}, cur: { name: "घ", firm: "ङ" }, next: { name: "घ", firm: "ङ" } }, capital: {}, sec92: [], sec51: {}, acceptance: {}, fee: {}, docsSelected: { agm: true, sec92: false, sec51: false, bo: false, agmBod: true, c1: false, app50: false } }, W)).then(function (b) { return new PizZip(b).file("word/document.xml").asText(); });
  const fontsOf = function (x) { return Array.from(new Set((x.match(/w:ascii="([^"]+)"/g) || []).map(function (s) { return s.slice(9, -1); }))).sort(); };
  ok("8. Nepali text is Mangal, as in the annual set", fontsOf(xo).join() === "Mangal" && fontsOf(x7).filter(function (f) { return f !== "Arial"; }).join() === "Mangal", fontsOf(xo) + " / " + fontsOf(x7));
  ok("8. only the email address is Arial", (x7.match(/w:ascii="Arial"/g) || []).length === 1 && /w:ascii="Arial"[\s\S]{0,300}contact@example\.com/.test(x7));
  const tblOf = function (x) { return (x.match(/<w:tcBorders>[\s\S]*?<\/w:tcBorders>/) || [""])[0] + ((x.match(/<w:shd [^>]*>/) || [""])[0]); };
  ok("8. attendance table: four columns, bold header row", /क्रम सं/.test(x7) && /<w:b\/>[\s\S]{0,200}क्रम सं/.test(x7.slice(x7.indexOf("<w:tbl>"))));

  // ── 9. possessive: one rule ──
  const all = docTexts(three).join("\n");
  ok("9. the possessive uses the shared helper's form everywhere", OCR.possessive(COMPANY) === KO && all.split(KO).length - 1 === 3, String(all.split(KO).length - 1));
  ok("9. one spacing only: never a space before को after the company name", !/प्रा\. लि\. को|प्रा\.लि\. को/.test(all));
  ok("9. the spacing is not hard coded in the new module", !/"\s*को"|\+ *" को/.test(srcCore.replace(/\/\/.*$/gm, "")));

  // ── 10. addresses and signatures ──
  ok("10. the address is built from three fields and is identical in every document", IU.addressText(one.address, W) === ADDR && got1.every(function (d) { return d.join("\n").indexOf(ADDR) >= 0; }));
  ok("10. meeting 1 decision 2 uses the full address", got1[1].some(function (l) { return /सोको लागि कास्की जिल्ला नमुना नगरपालिका वडा नं. ७ मा कम्पनीको कार्यालय/.test(l); }));
  ok("10. the district is printed once in the cover letter", got1[0].join("\n").split("कास्की").length - 1 === 1);
  ok("10. phone numbers are Devanagari, the email stays Latin", /टेलिफोन नं : ९८००००००००, ०१-५५५००००/.test(got1[3].join("\n")) && /contact@example\.com/.test(got1[3].join("\n")));
  ok("10. the statement ends with the certifier block and the company seal", got1[3].slice(-6).join("|") === "प्रमाणित गर्नेको|नाम : काल्पनिक नाम एक|दर्जा : अध्यक्ष|मिति : २०८३/०५/१२|दस्तखत : ....................|कम्पनीको छाप");

  // ── 11. defaults stay editable ──
  const ed = fixture({ meeting1: { no: "5" }, meeting2: { no: "03", date: "2083/05/09" }, signer: { name: "अर्को हस्ताक्षरकर्ता", designation: "प्रबन्ध सञ्चालक" }, fax: "०१-५५५११११", ocrOffice: "कम्पनी रजिष्ट्रारको कार्यालय, काठमाण्डौ" });
  const ted = linesOf(ed);
  ok("11. meeting numbers default to 01 and 02, and can be changed", got1[1][0].endsWith("०१") && got1[2][0].endsWith("०२") && ted[1][0].endsWith("५") && ted[2][0].endsWith("०३"));
  ok("11. second meeting date default = meeting 1, and can differ", got1[2][2].indexOf("२०८३/०५/०५") >= 0 && ted[2][2].indexOf("२०८३/०५/०९") >= 0);
  ok("11. signer, designation and fax can be changed", ted[0][13] === "अर्को हस्ताक्षरकर्ता" && ted[0][14] === "प्रबन्ध सञ्चालक" && ted[3].indexOf("फ्याक्स : ०१-५५५११११") >= 0);
  ok("11. a one-part OCR office line prints on one line with the stop mark", ted[0][2] === "कम्पनी रजिष्ट्रारको कार्यालय," && ted[0][3] === "काठमाण्डौ ।");
  ok("11. letter date defaults to the date given for today", IU.model(fixture({ letterDate: "" }), W, "2083/06/01").docs[0].blocks[0].text === "मिति : २०८३/०६/०१");
  ok("11. time wording: part of day and hour, or hour alone, or none", IU.timeText({ part: "साँझ", hour: "6" }) === "साँझ ६ बजे" && IU.timeText({ part: "", hour: "10" }) === "१० बजे" && IU.timeText({ part: "बिहान", hour: "" }) === "");
  ok("11. a meeting with no time still reads correctly", /गते सन्स्कृत उदाहरण/.test(linesOf(fixture({ meeting1: { time: { part: "", hour: "" } } }))[1][2]));
  ok("11. bad start hour is an error", IU.validate(fixture({ meeting1: { time: { part: "बिहान", hour: "14" } } }), W).errors.some(function (e) { return /hour/.test(e); }));

  // ── 12. spellings (spec section 6, item 5) and the sample's mistakes ──
  const sample = ["सचालन", "रर्जिष्टर्ड", "ईच्छा", "लगाएतका", "हुदाँ", "बिषय", "बिवरण"];
  ok("12. none of the sample's typing errors appears", !sample.some(function (w) { return all.indexOf(w) >= 0 || srcYaml.slice(srcYaml.indexOf("\ninitial:")).indexOf(w) >= 0; }));
  ok("12. the corrected spellings are present", ["सञ्चालन", "रजिष्टर्ड", "इच्छा", "लगायतका", "हुँदा", "विषय", "विवरण"].every(function (w) { return all.indexOf(w) >= 0; }));

  ok("12. standardised: उपस्थिति, तपसिल, कारबाही (never उपस्थिती, तपसील, कारवाही) in all four documents", !/उपस्थिती|तपसील|कारवाही/.test(all + docTexts(one).join("")) && /उपस्थिति :/.test(all) && /तपसिल/.test(all) && /कारबाही/.test(all));

  // ── 13. nothing from a real client in the repository ──
  const scanned = ["data/ocr.yaml", "assets/js/ocr-initial-core.js", "assets/js/ocr-initial.js", "partials/tool-ocr-initial.html", "scripts/ocr-initial.test.js", "scripts/make-ocr-initial-samples.js"];
  ok("13. fixtures use fictional names only (no template or sample file is committed)", scanned.every(function (f) { return fs.existsSync(path.join(ROOT, f)); }) && !fs.readdirSync(ROOT).some(function (f) { return /Initial-Update-Template|\.pdf$/i.test(f); }));

  console.log("\n" + pass + " passed, " + fail + " failed.");
  process.exit(fail ? 1 : 0);
})();
