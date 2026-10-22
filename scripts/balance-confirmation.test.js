/*
 * Tests for the Balance Confirmation generator (TAX_DOCS_BALANCE_CONFIRMATION_SPEC
 * section 9). Run: npm test. Fills templates/balance-confirmation-template.docx with
 * the SAME core the browser uses (assets/js/balance-confirmation-core.js), reads the
 * Example sheet with the SAME SheetJS wrapper (balance-confirmation-xlsx.js), and
 * compares the generated text to the two reference letters.
 */
const fs = require("fs");
const path = require("path");
const PizZip = require("pizzip");
const PSGDocx = require("../assets/js/common/docx-engine.js");
const Core = require("../assets/js/balance-confirmation-core.js");
const Xlsx = require("../assets/js/balance-confirmation-xlsx.js");
const BSDate = require("../assets/js/common/psg-bsdate.js");
const XLSX = require("../assets/js/xlsx.full.min.js");

const ROOT = path.resolve(__dirname, "..");
const TPL = fs.readFileSync(path.join(ROOT, "templates", "balance-confirmation-template.docx"));
const REF_WL = path.join(ROOT, "docs", "tax-docs", "Balance_Confirmation_Template_With_Letterhead.docx");
const REF_NL = path.join(ROOT, "docs", "tax-docs", "Balance_Confirmation_Template_No_Letterhead.docx");
const XLSXFILE = fs.readFileSync(path.join(ROOT, "docs", "tax-docs", "Balance_Confirmation_Upload_Template.xlsx"));

let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log("  PASS  " + name); } else { fail++; console.log("  FAIL  " + name + (extra ? "\n        " + extra : "")); } }
function eq(name, a, b) { ok(name, a === b, "expected " + JSON.stringify(b) + ", got " + JSON.stringify(a)); }

function norm(s) { return s.replace(/&amp;/g, "&").replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"'); }
function linesOf(xml) {
  return [...xml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)].map(function (m) {
    return norm([...m[0].matchAll(/<w:t(?: [^>]*)?>([\s\S]*?)<\/w:t>/g)].map(function (z) { return z[1]; }).join(""));
  }).map(function (s) { return s.trim(); }).filter(Boolean);
}
function render(rows, settings, opts) { return PSGDocx.fillZip(TPL, Core.templateData(rows, settings), opts || {}); }
function textLines(zip, withHeader) {
  var body = zip.file("word/document.xml").asText();
  var head = withHeader ? zip.file("word/header1.xml").asText() : "";
  return linesOf(head).concat(linesOf(body));
}
function bodyText(zip) { return linesOf(zip.file("word/document.xml").asText()).join("\n"); }
function refLetters(file) {
  var xml = new PizZip(fs.readFileSync(file)).file("word/document.xml").asText().replace(/<w:highlight w:val="yellow"\/>/g, "");
  var body = xml.slice(xml.indexOf("<w:body"));
  var blocks = body.match(/<w:(p|tbl)\b[\s\S]*?<\/w:\1>/g) || [];
  var groups = [[]];
  blocks.forEach(function (b) {
    if (/^<w:p[ >]/.test(b) && /<w:br w:type="page"\/>/.test(b)) groups.push([]);
    else groups[groups.length - 1].push(b);
  });
  return groups.map(function (g) { return linesOf(g.join("")); });
}
function diff(a, b) {
  for (var i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) return "line " + i + "\n   ref: " + JSON.stringify(a[i]) + "\n   got: " + JSON.stringify(b[i]);
  return "";
}

var SETTINGS = {
  fy: "2082/83", letterDate: "2083/07/05", asOn: "2083/03/32", responseDays: 15, letterhead: true, vatRate: 0.13,
  senderName: "Himal Traders Private Limited", senderPan: "999999999", senderAddress: "Kathmandu-10, Kathmandu",
  signatoryName: "Ram Bahadur Thapa", signatoryDesignation: "Chairman", hideEmpty: true,
};
function settings(over) { return Object.assign({}, SETTINGS, over || {}); }

// Sagarmatha / Manaslu as canonical rows (matching the corrected Example sheet).
var SAGAR = {
  pan: "111111111", tradename: "Sagarmatha Suppliers", opening: "10152.2", openingDrCr: "Cr.",
  servicePurchaseCapital: "0", servicePurchaseOthers: "56203.21", goodPurchaseCapital: "0", goodPurchaseOthers: "90000",
  serviceSales: "0", goodSales: "25000", closing: "212.32", closingDrCr: "Dr.",
  salesReturn: "100", purchaseReturn: "150", receiverAddress: "Thimi, Bhaktapur",
  vatPurchase: "13010.43", vatSales: "3250", exemptPurchase: "46123", tdsUs: "111", retention: "1245",
  senderName: "Himal Traders Private Limited", senderPan: "999999999", senderAddress: "Kathmandu-10, Kathmandu",
};
var MANASLU = {
  pan: "222222222", tradename: "Manaslu Traders", opening: "212.32", openingDrCr: "Dr.",
  serviceSales: "2369.36", goodSales: "56203.21", closing: "10152.2", closingDrCr: "Dr.",
  salesReturn: "0", vatSales: "7614.43", tdsParty: "444", receiverAddress: "Tripureshwor, Kathmandu",
  senderName: "Himal Traders Private Limited", senderPan: "999999999", senderAddress: "Kathmandu-10, Kathmandu",
};

console.log("Balance Confirmation tests (section 9):\n");

// 1) Parity: the Example sheet reproduces both reference letters (letterhead on / off).
(function () {
  var rows = Xlsx.rowsFromNamedSheet(XLSXFILE, "Example");
  eq("1. Example sheet has 2 rows", rows.length, 2);
  var wl = refLetters(REF_WL), nl = refLetters(REF_NL);
  rows.forEach(function (r, i) {
    var on = textLines(render([r], settings()), true);
    ok("1. letterhead-on letter " + (i + 1) + " matches With-Letterhead reference", on.join("\n") === wl[i].join("\n"), diff(wl[i], on));
    var off = textLines(render([r], settings({ letterhead: false })), false);
    ok("1. letterhead-off letter " + (i + 1) + " matches No-Letterhead reference", off.join("\n") === nl[i].join("\n"), diff(nl[i], off));
  });
})();

// 2) Individual Sagarmatha values produce letter 1 exactly.
(function () {
  var got = textLines(render([SAGAR], settings()), true);
  var ref = refLetters(REF_WL)[0];
  ok("2. individual Sagarmatha == reference letter 1", got.join("\n") === ref.join("\n"), diff(ref, got));
})();

// 3) Each optional row hides at 0/blank and shows at non-zero; label switches.
(function () {
  var t0 = bodyText(render([Object.assign({}, SAGAR, { exemptPurchase: "0" })], settings()));
  ok("3. exempt purchase 0 -> row hidden", t0.indexOf("Exempt Purchase (B)") === -1);
  ok("3. exempt purchase 0 -> label (A)", t0.indexOf("Reportable Purchase as per Annexure 13 (A)") !== -1);
  var tb = bodyText(render([Object.assign({}, SAGAR, { exemptPurchase: "" })], settings()));
  ok("3. exempt purchase blank -> row hidden", tb.indexOf("Exempt Purchase (B)") === -1);
  var t1 = bodyText(render([Object.assign({}, SAGAR, { exemptPurchase: "46123" })], settings()));
  ok("3. exempt purchase non-zero -> row shown", t1.indexOf("Exempt Purchase (B)") !== -1);
  ok("3. exempt purchase non-zero -> label (A+B)", t1.indexOf("Reportable Purchase as per Annexure 13 (A+B)") !== -1);
  var ts = bodyText(render([Object.assign({}, SAGAR, { exemptSales: "500", goodSales: "25000" })], settings()));
  ok("3. exempt sales non-zero -> row shown + label (C+D)", ts.indexOf("Exempt Sales (D)") !== -1 && ts.indexOf("Reportable Sales as per Annexure 13 (C+D)") !== -1);
  ok("3. exempt sales 0 (Sagarmatha) -> label (C)", bodyText(render([SAGAR], settings())).indexOf("Reportable Sales as per Annexure 13 (C)") !== -1);
})();

// 4) Purchase block hidden for a sales-only party; shown with 0.00 when setting off.
(function () {
  var on = bodyText(render([MANASLU], settings()));
  ok("4. sales-only: purchase block hidden (setting on)", on.indexOf("Net Taxable Purchase (A)") === -1 && on.indexOf("Reportable Purchase") === -1);
  ok("4. sales-only: sales block present", on.indexOf("Net Taxable Sales (C)") !== -1);
  var off = bodyText(render([MANASLU], settings({ hideEmpty: false })));
  ok("4. sales-only: purchase block shown with 0.00 (setting off)", off.indexOf("Net Taxable Purchase (A)") !== -1);
  ok("4. sales-only: purchase rows are 0.00 (setting off)", /Net Taxable Purchase \(A\)[\s\S]*?0\.00/.test(off.split("\n").join("\n")) && off.indexOf("Reportable Purchase as per Annexure 13 (A)") !== -1);
})();

// 5) VAT calculated when U/V blank; entered value used and warning raised when it differs by > Rs 1.
(function () {
  var f = Core.figures(Object.assign({}, SAGAR, { vatSales: "" }), settings());
  eq("5. VAT on Sales computed when blank", Core.fmt(f.vatSales), Core.fmt(25000 * 0.13));
  var t = bodyText(render([Object.assign({}, SAGAR, { vatSales: "" })], settings()));
  ok("5. computed VAT on Sales printed (3,250.00)", t.indexOf("3,250.00") !== -1);
  var v = Core.validateRow(Object.assign({}, SAGAR, { vatSales: "4000" }), settings()); // 4000 vs 3250 -> >1
  ok("5. warning when entered VAT differs by > Rs 1", v.warnings.some(function (w) { return /VAT on Sales differs/.test(w); }));
  var t2 = bodyText(render([Object.assign({}, SAGAR, { vatSales: "4000" })], settings()));
  ok("5. letter uses the entered VAT figure (4,000.00)", t2.indexOf("4,000.00") !== -1);
  var v2 = Core.validateRow(Object.assign({}, SAGAR, { vatSales: "3250.50" }), settings()); // within Rs 1
  ok("5. no warning when entered VAT within Rs 1", !v2.warnings.some(function (w) { return /VAT on Sales differs/.test(w); }));
})();

// 6) Validation: bad PAN, exempt greater than total, invalid Dr/Cr, duplicate PAN.
(function () {
  var badPan = Core.validateRow(Object.assign({}, SAGAR, { pan: "12345678" }), settings());
  ok("6. bad PAN (8 digits) -> error", badPan.errors.some(function (e) { return /PAN must be exactly 9 digits/.test(e); }));
  var exc = Core.validateRow(Object.assign({}, SAGAR, { exemptPurchase: "999999" }), settings());
  ok("6. exempt purchase > total -> error", exc.errors.some(function (e) { return /Exempt Purchase is greater/.test(e); }));
  var drcr = Core.validateRow(Object.assign({}, SAGAR, { openingDrCr: "" }), settings());
  ok("6. opening non-zero with blank Dr/Cr -> error", drcr.errors.some(function (e) { return /Opening Dr\/Cr/.test(e); }));
  var dup = Core.validateAll([SAGAR, Object.assign({}, MANASLU, { pan: "111111111" })], settings());
  ok("6. duplicate PAN -> warning on both rows", dup[0].warnings.some(function (w) { return /Duplicate PAN/.test(w); }) && dup[1].warnings.some(function (w) { return /Duplicate PAN/.test(w); }));
  var neg = Core.validateRow(Object.assign({}, SAGAR, { goodSales: "-5" }), settings());
  ok("6. negative amount -> error", neg.errors.some(function (e) { return /negative/.test(e); }));
})();

// 7) Header matching: a file in the original sample layout (row 1 banners, headers
//    in row 2, columns in a DIFFERENT order, no Instructions sheet) reads correctly.
(function () {
  var headers = ["Tradename", "PAN", "Receiver Company's Address", "OpeningBalance", "Opening Dr/Cr",
    "ClosingBalance", "Closing Dr/Cr", "ServiceSales", "GoodSales", "VAT on Sales", "TDS Deducted By Party"];
  var banner = ["Some banner spanning the sheet"];
  var dataRow = ["Manaslu Traders", "222222222", "Tripureshwor, Kathmandu", 212.32, "Dr.",
    10152.2, "Dr.", 2369.36, 56203.21, 7614.43, 444];
  var ws = XLSX.utils.aoa_to_sheet([banner, headers, dataRow]);
  var wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  var res = Xlsx.readWorkbook(wb);
  eq("7. reads one data row by header name", res.rows.length, 1);
  var r = res.rows[0] || {};
  ok("7. columns mapped by name, not position", r.pan === "222222222" && r.tradename === "Manaslu Traders" && String(r.goodSales) === "56203.21" && String(r.tdsParty) === "444");
})();

// 8) As-on date: FY 2080/81 -> 2081/03/31; FY 2082/83 -> 2083/03/32.
(function () {
  eq("8. as-on FY 2080/81 = 2081/03/31", BSDate.fyAshadEndYMD(2080), "2081/03/31");
  eq("8. as-on FY 2082/83 = 2083/03/32", BSDate.fyAshadEndYMD(2082), "2083/03/32");
})();

// 9) Combined and zip outputs, the register and the Annexure 13 export.
(function () {
  var rows = [SAGAR, MANASLU];
  var combined = render(rows, settings());
  eq("9. combined: two letters (two To, lines)", (combined.file("word/document.xml").asText().match(/<w:t[^>]*>To,<\/w:t>/g) || []).length, 2);
  eq("9. combined: two sections (one break + body)", (combined.file("word/document.xml").asText().match(/<w:sectPr>/g) || []).length, 2);
  // zip: one file per letter
  var zip = new PizZip();
  rows.forEach(function (r) { zip.file(Core.fileName(r, settings()), PSGDocx.bytes(render([r], settings()))); });
  var names = Object.keys(zip.files).filter(function (n) { return /\.docx$/.test(n); });
  eq("9. zip: one .docx per letter", names.length, 2);
  ok("9. zip: file names sanitised", names[0] === "Sagarmatha_Suppliers_111111111_Balance_Confirmation_2082_83.docx");
  // register
  var regWb = XLSX.read(Xlsx.registerBytes(rows, settings(), true), { type: "buffer" });
  var reg = XLSX.utils.sheet_to_json(regWb.Sheets[regWb.SheetNames[0]], { header: 1, raw: false, defval: "" });
  ok("9. register: header row", reg[0].join("|") === Core.REGISTER_HEADERS.join("|"));
  eq("9. register: one row per letter", reg.length - 1, 2);
  ok("9. register: Sagarmatha row values", reg[1][0] === "Sagarmatha Suppliers" && reg[1][1] === "111111111" && reg[1][2] === "10,152.20 Cr." && reg[1][3] === "1,46,203.21" && reg[1][5] === "212.32 Dr." && reg[1][6] === "2083/07/05");
  ok("9. register: follow-up columns blank", reg[1][7] === "" && reg[1][8] === "" && reg[1][9] === "" && reg[1][10] === "" && reg[1][11] === "");
  // Annexure 13
  var annWb = XLSX.read(Xlsx.annexure13Bytes(rows, true), { type: "buffer" });
  var ann = XLSX.utils.sheet_to_json(annWb.Sheets[annWb.SheetNames[0]], { header: 1, raw: true, defval: "" });
  ok("9. Annexure 13: headers A..J exactly", ann[0].join("|") === Core.ANNEXURE13.join("|"));
  ok("9. Annexure 13: Sagarmatha values (net of returns, as entered)", ann[1][0] === "111111111" && ann[1][2] === 10152.2 && ann[1][4] === 56203.21 && ann[1][6] === 90000 && ann[1][8] === 25000 && ann[1][9] === 212.32);
})();

console.log("\n" + pass + " passed, " + fail + " failed.");
process.exit(fail ? 1 : 0);
