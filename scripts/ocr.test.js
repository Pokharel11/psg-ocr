/*
 * Tests for the OCR Docs generator (OCR_DOCS_IMPROVEMENT_SPEC Part E). Run: npm test.
 * Builds the filing set with the SAME core the browser uses (assets/js/ocr-core.js)
 * and the SAME Nepali wording (data/ocr.yaml), then inspects the real .docx output.
 */
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const PizZip = require("pizzip");
const OCR = require("../assets/js/ocr-core.js");

const ROOT = path.resolve(__dirname, "..");
const W = yaml.load(fs.readFileSync(path.join(ROOT, "data", "ocr.yaml"), "utf8"));

let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log("  PASS  " + name); } else { fail++; console.log("  FAIL  " + name + (extra ? "\n        " + extra : "")); } }

function xmlOf(data) {
  const doc = OCR.buildCombined(data, W);
  // Packer.toBuffer is async; tests await via the runner below.
  return OCR.Packer.toBuffer(doc).then(function (buf) {
    return new PizZip(buf).file("word/document.xml").asText();
  });
}
function paras(xml) {
  return xml.split(/<\/w:p>/).map(function (p) {
    return (p.match(/<w:t(?: [^>]*)?>([\s\S]*?)<\/w:t>/g) || []).map(function (s) { return s.replace(/<[^>]+>/g, ""); }).join("");
  });
}
function textOf(xml) { return paras(xml).filter(function (t) { return t.trim(); }).join("\n"); }

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
      prev: { name: "अशोक शर्मा", firm: "ए बी सी एण्ड एसोसिएट्स", title: "सी.ए." },
      cur: { name: "दिपक शर्मा", firm: "एक्स वाई जेड एण्ड एसोसिएट्स", address: "नयाँ बानेश्वर, काठमाडौँ", designation: "साझेदार", title: "सी.ए." },
      next: { name: "दिपक शर्मा", firm: "एक्स वाई जेड एण्ड एसोसिएट्स", address: "नयाँ बानेश्वर, काठमाडौँ", designation: "साझेदार", title: "सी.ए." },
    },
    capital: { numShares: 25000, faceValue: 100, authCapital: "२५,००,०००", issued: "२५,००,०००", paidUp: "२५,००,०००", paidAmt: "२५,००,०००", unpaid: "छैन" },
    sec92: [], sec51: {}, quorumAllPresent: true, acceptance: { enabled: false }, fee: { c1: { mode: "agreement" }, c2: { mode: "amount", amount: 100000, vat: "exclusive" } },
    docsSelected: {},
  }, over || {});
}

const OLD = ["प्रस्तावबहरु", "गाणपुरक", "गणपुरक", "साधरण", "निर्णय न ", "लेखापरिक्षककोको", "आपिस सहमतिमा", "बिक्की",
  "शेयधनीहरु", "निम्नाअनुसार", "सर्बसम्मितबाट", "बिशेष", "जानकारि", "उपस्थिती", "पूँजि र", "लेखा परिक्षक", "लेखापरिक्षक",
  "संचालक", "संचालन", "तपशिल", "डिवेन्चर", "बिषय", "सुचना", "बर्ष", "सवै", "ज्यु ", "ज्युले", "हरु ", "सि.ए."];
const NEW = ["प्रस्तावहरू", "गणपूरक", "साधारण", "निर्णय नं.", "लेखापरीक्षकको", "आपसी सहमतिमा", "बिक्री", "शेयरधनीहरू",
  "निम्नानुसार", "सर्वसम्मतिबाट", "विशेष", "जानकारी", "पूँजी", "लेखापरीक्षक", "सञ्चालक", "तपसिल", "डिबेञ्चर", "ज्यूले"];

(async function () {
  console.log("OCR Docs tests (Part E):\n");

  // 1. A4 page size
  const xOn = await xmlOf(base({ auditorChange: true, acceptance: { enabled: true, forC1: true, forC2: true } }));
  const xOff = await xmlOf(base());
  ok("1. page size A4 (11906 x 16838)", /<w:pgSz[^>]*w:w="11906"[^>]*w:h="16838"/.test(xOn));

  // 2. spelling: new present, none of the old remain
  const tOn = textOf(xOn);
  NEW.forEach(function (n) { ok("2. new spelling present: " + n, tOn.indexOf(n) !== -1); });
  const stillOld = OLD.filter(function (b) { return tOn.indexOf(b) !== -1; });
  ok("2. no old spellings remain", stillOld.length === 0, "still present: " + JSON.stringify(stillOld));
  // name-handling: no doubled honorifics
  ok("1b. no doubled honorifics (श्री श्री / सी.ए. श्री / सि.ए. श्री)", tOn.indexOf("श्री श्री") === -1 && tOn.indexOf("सी.ए. श्री") === -1 && tOn.indexOf("सि.ए. श्री") === -1);
  // auditor title (सी.ए.) used in the letters instead of श्री
  ok("1c. letter recipient uses the title: 'सी.ए. दिपक शर्मा'", tOn.indexOf("सी.ए. दिपक शर्मा") !== -1);
  ok("1c. C2 body previous auditor uses title: 'का सी.ए. अशोक शर्मा'", tOn.indexOf("का सी.ए. अशोक शर्मा") !== -1);
  // 1d. title is never assumed: an auditor with no title gets no honorific (no CA, no श्री)
  var noTitle = base({ docsSelected: { c1: true, sgmBod: false, sgm: false, bo: false, agmBod: false, agm: false, c2: false, c3: false, app50: false, sec92: false, sec51: false },
    auditors: Object.assign(JSON.parse(JSON.stringify(base().auditors)), { next: { name: "दिपक शर्मा", firm: "एक्स वाई जेड एण्ड एसोसिएट्स", address: "नयाँ बानेश्वर, काठमाडौँ", designation: "साझेदार", title: "" } }) });
  var tNoTitle = textOf(await xmlOf(noTitle));
  ok("1d. no title -> recipient is the bare name (no CA, no श्री)", tNoTitle.indexOf("दिपक शर्मा") !== -1 && tNoTitle.indexOf("सी.ए. दिपक शर्मा") === -1 && tNoTitle.indexOf("श्री दिपक शर्मा") === -1);
  // 1e. acceptance letter (C3) sits on the audit firm's letterhead, not the company's
  var sep3 = OCR.buildSeparate(base({ auditorChange: true, acceptance: { enabled: true, forC1: true, forC2: true } }), W);
  var c3doc = sep3.filter(function (d) { return d.id === "c3c2"; })[0];
  var c3xml = new PizZip(await OCR.Packer.toBuffer(c3doc.doc)).file("word/document.xml").asText();
  var c3paras = paras(c3xml).filter(function (t) { return t.trim(); });
  ok("1e. C3 top is the audit firm name (not the company)", c3paras[0] === "एक्स वाई जेड एण्ड एसोसिएट्स" && c3paras[0].indexOf("हिमाल") === -1);
  ok("1e. C3 header has no company registration number", c3xml.indexOf("दर्ता नं:") === -1);

  // 3. §92 defaults छैन for all four items, every director; §51 defaults
  const only92 = base({ docsSelected: { sgmBod: false, sgm: false, bo: false, agmBod: false, agm: false, c1: false, c2: false, c3: false, app50: false, sec51: false } });
  const t92 = textOf(await xmlOf(only92));
  const chhaina92 = (t92.match(/भएमा - छैन|विषयमा - छैन|रहेमा- छैन/g) || []).length;
  ok("3. §92: 4 items × 3 directors = 12 'छैन'", chhaina92 === 12, "got " + chhaina92);
  const t92g = textOf(await xmlOf(base({ docsSelected: { sec92: true, sgmBod: false, sgm: false, bo: false, agmBod: false, agm: false, c1: false, c2: false, c3: false, app50: false, sec51: false },
    sec92: [{ g: "छ", gNames: "एबीसी प्रा.लि." }, {}, {}] })));
  ok("3. §92: ग=छ prints the other company names", t92g.indexOf("रहेमा- छ (एबीसी प्रा.लि.)") !== -1);
  const t51 = textOf(await xmlOf(base({ docsSelected: { sec51: true, sgmBod: false, sgm: false, bo: false, agmBod: false, agm: false, c1: false, c2: false, c3: false, app50: false, sec92: false } })));
  ok("3. §51: loans नभएको; investments/brokerage/forfeited छैन",
    t51.indexOf("जमानत:- नभएको") !== -1 && t51.indexOf("लगानी गरेको रकम: छैन") !== -1 &&
    t51.indexOf("दलाली दस्तुर वापत दिएको जम्मा रकम: छैन") !== -1 && t51.indexOf("जफत भएको कारण र मिति: छैन") !== -1);

  // 3a. format: justified body + AutoFit tables (100% width) + min signature column
  ok("3a. body paragraphs justified (w:jc both present, many)", (xOn.match(/<w:jc w:val="both"\/>/g) || []).length > 20);
  ok("3a. tables AutoFit to window", (xOn.match(/<w:tblLayout w:type="autofit"\/>/g) || []).length >= 1 &&
    (xOn.match(/<w:tblW w:type="pct" w:w="100%"\/>/g) || []).length >= 1);
  ok("3a. signature column keeps a minimum width", xOn.indexOf('<w:gridCol w:w="2800"/>') !== -1);

  // 4. face value 1000 -> authorized capital = shares × 1000; loan + investment details print
  ok("4. calcAuthCapital(25000, 1000) = 25000000", OCR.calcAuthCapital(25000, 1000) === 25000000);
  const t51d = textOf(await xmlOf(base({
    docsSelected: { sec51: true, sgmBod: false, sgm: false, bo: false, agmBod: false, agm: false, c1: false, c2: false, c3: false, app50: false, sec92: false },
    capital: Object.assign(base().capital, { faceValue: 1000, authCapital: OCR.groupNep(OCR.calcAuthCapital(25000, 1000)) }),
    sec51: { loans: "नेपाल बैंकबाट रु. ५,००,०००", investments: [{ name: "सगरमाथा प्रा.लि.", reg: "९९९", amount: "१,००,०००" }] },
  })));
  ok("4. §51: face value 1000 -> authorized capital २,५०,००,०००", t51d.indexOf("अधिकृत पूँजी रु. २,५०,००,०००/-") !== -1);
  ok("4. §51: loan details print", t51d.indexOf("नेपाल बैंकबाट रु. ५,००,०००") !== -1);
  ok("4. §51: investment details print", t51d.indexOf("सगरमाथा प्रा.लि. (दर्ता नं. ९९९, रु. १,००,०००)") !== -1);

  // 5. date math via the shared calendar; year outside range errors
  ok("5. 2083/03/25 + 21 days crosses into Shrawan (month 04)", /^२०८३\/०४\//.test(OCR.addDays("२०८३/०३/२५", 21)), OCR.addDays("२०८३/०३/२५", 21));
  let threw = false; try { OCR.addDays("२२००/०१/०१", 21); } catch (e) { threw = true; }
  ok("5. a year outside the calendar throws", threw);

  // 6. auditor change on -> SGM minute + C2 + C3(for C2) in order; off -> none
  const idsOn = OCR.documentList(base({ auditorChange: true, acceptance: { enabled: true, forC1: true, forC2: true } }), W).map(function (d) { return d.id; });
  ok("6. on: order sgmBod, sgm, c2, c3c2 … c1, c3c1", idsOn.indexOf("sgm") < idsOn.indexOf("c2") && idsOn.indexOf("c2") < idsOn.indexOf("c3c2") && idsOn.indexOf("c1") < idsOn.indexOf("c3c1") && idsOn.indexOf("c3c2") < idsOn.indexOf("c1"));
  const idsOff = OCR.documentList(base({ auditorChange: false }), W).map(function (d) { return d.id; });
  ok("6. off: no sgm / c2 / c3c2", idsOff.indexOf("sgm") === -1 && idsOff.indexOf("c2") === -1 && idsOff.indexOf("c3c2") === -1);
  ok("6. off: c1 still present", idsOff.indexOf("c1") !== -1);

  // 7. C1 dated the AGM date; fee by agreement + amount variants; Nepali words
  ok("7. C1 dated the AGM date", tOn.indexOf("मिति: २०८३/०८/२९") !== -1);
  ok("7. fee by agreement renders", tOn.indexOf("पारिश्रमिक आपसी सहमतिमा निर्धारण गरिनेछ") !== -1);
  ok("7. fee amount (exclusive) renders with words एक लाख", tOn.indexOf("कर बाहेक रु. १,००,०००/- (अक्षरेपी एक लाख रुपैयाँ मात्र)") !== -1);
  ok("7. amount words: 1,00,000 = 'एक लाख'", OCR.amountWordsNep(100000) === "एक लाख");
  ok("7. amount words: 2,50,000 = 'दुई लाख पचास हजार'", OCR.amountWordsNep(250000) === "दुई लाख पचास हजार", OCR.amountWordsNep(250000));
  ok("7. VAT inclusive variant renders", textOf(await xmlOf(base({ auditorChange: true, acceptance: { enabled: false }, fee: { c1: { mode: "agreement" }, c2: { mode: "amount", amount: 250000, vat: "inclusive" } } }))).indexOf("कर सहित रु. २,५०,०००/- (अक्षरेपी दुई लाख पचास हजार रुपैयाँ मात्र)") !== -1);

  // 8. save / reload / roll-forward form state
  const s = base({ fiscal: { current: "२०८२/०८३", next: "२०८३/०८४" } });
  const json = JSON.stringify(s); const loaded = JSON.parse(json);
  ok("8. save/reload round-trips", loaded.fiscal.next === "२०८३/०८४" && loaded.company.name === s.company.name);
  const rf = OCR.rollForward(s);
  ok("8. roll-forward: fiscal years move +1", rf.fiscal.current === "२०८३/०८४" && rf.fiscal.next === "२०८४/०८५");
  ok("8. roll-forward: next-year auditor becomes this year's; prev = old current; dates cleared",
    rf.auditors.cur.name === "दिपक शर्मा" && rf.auditors.prev.name === "दिपक शर्मा" && Object.keys(rf.dates).length === 0 && rf.auditorChange === false);

  // 9. choose documents + separate files
  const sel = base({ docsSelected: { sgmBod: false, sgm: false, bo: true, agmBod: false, agm: true, c1: false, c2: false, c3: false, app50: false, sec92: false, sec51: false } });
  const selIds = OCR.documentList(sel, W).map(function (d) { return d.id; });
  ok("9. choosing documents limits the set", selIds.length === 2 && selIds.indexOf("bo") !== -1 && selIds.indexOf("agm") !== -1);
  const sep = OCR.buildSeparate(base({ auditorChange: false }), W);
  ok("9. separate-files build returns one Document per selected doc", sep.length === OCR.documentList(base({ auditorChange: false }), W).length && sep.every(function (d) { return d.doc && d.id; }));

  // 10. amount-in-words: full 1–99 table + composites
  ok("10. ४५ = पैंतालीस", OCR.amountWordsNep(45) === "पैंतालीस", OCR.amountWordsNep(45));
  ok("10. ७८ = अठहत्तर", OCR.amountWordsNep(78) === "अठहत्तर", OCR.amountWordsNep(78));
  ok("10. ९९ = उनान्सय", OCR.amountWordsNep(99) === "उनान्सय", OCR.amountWordsNep(99));
  ok("10. १,१५,५०० = एक लाख पन्ध्र हजार पाँच सय", OCR.amountWordsNep(115500) === "एक लाख पन्ध्र हजार पाँच सय", OCR.amountWordsNep(115500));
  ok("10. १,२५,००,००० = एक करोड पच्चीस लाख", OCR.amountWordsNep(12500000) === "एक करोड पच्चीस लाख", OCR.amountWordsNep(12500000));

  // 11. fiscal-year range 2060/61 … 2089/90; date math at both ends; outside throws
  ok("11. FY labels at both ends", OCR.fyLabel(2060) === "२०६०/०६१" && OCR.fyLabel(2089) === "२०८९/०९०");
  ok("11. date math works at 2060", /^२०६०\//.test(OCR.addDays("२०६०/०८/०१", 21)));
  ok("11. date math works at 2089", /^२०८९\//.test(OCR.addDays("२०८९/०८/०१", 21)));
  var threw90 = false; try { OCR.addDays("२०९१/०१/०१", 1); } catch (e) { threw90 = true; }
  ok("11. year beyond the calendar (2091) throws", threw90);

  // 12. PSG firm data present in the shared file
  ok("12. shared firm data: PSG name + address + two partners", W.firm && W.firm.name === "पी.एस.जी. एण्ड एसोसिएट्स" && W.firm.address === "मध्य बानेश्वर, काठमाडौँ" && (W.firm.partners || []).length === 2 && W.firm.partners[0].name === "गौरव पोखरेल" && W.firm.partners[0].title === "सी.ए.");

  // 13. defaults: a form at its defaults produces the default text
  var dflt = base({ auditorChange: false, fee: { c1: { mode: "agreement" }, c2: { mode: "agreement" } } });
  var tDflt = textOf(await xmlOf(dflt));
  ok("13. default times render (बिहान १० बजे AGM, दिउँसो १ बजे AGM-call)", tDflt.indexOf("बिहान १० बजे") !== -1 && tDflt.indexOf("दिउँसो १ बजे") !== -1);
  ok("13. default §51 answers (नभएको loans, छैन investments)", tDflt.indexOf("जमानत:- नभएको") !== -1 && tDflt.indexOf("लगानी गरेको रकम: छैन") !== -1);
  ok("13. default fee by agreement (C1)", tDflt.indexOf("पारिश्रमिक आपसी सहमतिमा निर्धारण गरिनेछ") !== -1);
  ok("13. default face value १०० (authorized = shares × 100)", tDflt.indexOf("प्रतिकित्ता रु. १००/-का दरले") !== -1);

  console.log("\n" + pass + " passed, " + fail + " failed.");
  process.exit(fail ? 1 : 0);
})().catch(function (e) { console.error(e); process.exit(1); });
