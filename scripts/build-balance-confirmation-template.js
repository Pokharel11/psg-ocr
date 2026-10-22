/*
 * Build templates/balance-confirmation-template.docx from the firm's reformatted
 * reference (docs/tax-docs/Balance_Confirmation_Reference.docx — the user's edited
 * single letter) by inserting docxtemplater placeholders, a {#letters} loop (one
 * letter per party) and a condition on every optional row and on the purchase /
 * sales blocks. The reference already carries the desired formatting, so we KEEP
 * all of it (Aptos body font, Georgia letterhead, the amount-table borders/widths,
 * the signature layout + signing space) and only swap run TEXT for tags.
 *
 * The letterhead lives in a first-page section header (word/header1.xml: company
 * name, address, VAT/PAN line, rule) shown only on each letter's first page and
 * never repeated; each letter is its own next-page section (shared header, since
 * the sender is constant per batch). When "letterhead off", the whole letterhead
 * is conditioned out and the header renders empty.
 *
 * Dev-only. Run: node scripts/build-balance-confirmation-template.js
 */
const fs = require("fs");
const path = require("path");
const PizZip = require("pizzip");

const ROOT = path.resolve(__dirname, "..");
const REF = path.join(ROOT, "docs", "tax-docs", "Balance_Confirmation_Reference.docx");
const OUT = path.join(ROOT, "templates", "balance-confirmation-template.docx");

const zip = new PizZip(fs.readFileSync(REF));
let docXml = zip.file("word/document.xml").asText();

const headEnd = docXml.indexOf(">", docXml.indexOf("<w:body")) + 1;
const bodyEnd = docXml.lastIndexOf("</w:body>");
const head = docXml.slice(0, headEnd);
const tail = "</w:body></w:document>";
const inner = docXml.slice(headEnd, bodyEnd);
const blocks = inner.match(/<w:(p|tbl)\b[\s\S]*?<\/w:\1>/g) || [];
if (blocks.length !== 15) throw new Error("Expected 15 reference blocks, got " + blocks.length);

function must(b, s) { if (b.indexOf(s) < 0) throw new Error("expected text not found: " + s); return b; }
function edit(block, pairs) {
  pairs.forEach(function (p) {
    if (block.indexOf(p[0]) < 0) throw new Error("literal not found: " + p[0].slice(0, 50));
    block = block.split(p[0]).join(p[1]);
  });
  return block;
}
function tagPara(t) { return '<w:p><w:r><w:t xml:space="preserve">' + t + "</w:t></w:r></w:p>"; }

// ---- section properties (reuse the reference's: first-page letterhead header) ----
const sectPr = (blocks[13].match(/<w:sectPr\b[\s\S]*?<\/w:sectPr>/) || [])[0];
if (!sectPr) throw new Error("reference body sectPr not found in block 13");
const SECT_INNER = sectPr.replace(/^<w:sectPr\b[^>]*>/, "").replace(/<\/w:sectPr>$/, "");
const SECT_PARA = "<w:p><w:pPr><w:sectPr>" + SECT_INNER + "</w:sectPr></w:pPr></w:p>";
const BODY_SECTPR = "<w:sectPr>" + SECT_INNER + "</w:sectPr>";

// ---- header1 (letterhead): tag + wrap in {#letterhead} ----
let header1 = zip.file("word/header1.xml").asText();
header1 = must(header1, "Himal Traders Private Limited");
header1 = header1.replace("Himal Traders Private Limited", "{#letterhead}{entity_name}");
header1 = header1.replace("Kathmandu-10, Kathmandu", "{entity_address}");
header1 = header1.replace(/VAT\/PAN:\s*222222222/, "VAT/PAN: {entity_pan}");
// close the condition at the end of the last header paragraph (the rule)
var lastP = header1.lastIndexOf("</w:p>");
header1 = header1.slice(0, lastP) + '<w:r><w:t xml:space="preserve">{/letterhead}</w:t></w:r>' + header1.slice(lastP);
zip.file("word/header1.xml", header1);

// ---- amount table (built from the reference table's own rows) ----
const amtTbl = blocks[9];
const tblOpen = amtTbl.slice(0, amtTbl.indexOf("<w:tr "));
const trs = amtTbl.match(/<w:tr\b[\s\S]*?<\/w:tr>/g);
const headerRow = must(trs[0], "Particulars");
function rowWithLabel(txt) { var r = trs.find(function (t) { return t.indexOf(">" + txt + "<") >= 0; }); if (!r) throw new Error("prototype row not found: " + txt); return r; }
const NONBOLD = rowWithLabel("Opening Balance (Dr/Cr)");           // non-bold data row
const BOLD = rowWithLabel("Closing Balance (Dr/Cr)");              // bold data row
function setCellText(tc, text) { return tc.replace(/(<w:t(?: [^>]*)?>)[\s\S]*?(<\/w:t>)/, "$1" + text + "$2"); }
function makeRow(def) {
  var proto = def.bold ? BOLD : NONBOLD;
  var tcs = proto.match(/<w:tc>[\s\S]*?<\/w:tc>/g);
  var open = def.cond ? "{#" + def.cond + "}" : "";
  var close = def.cond ? "{/" + def.cond + "}" : "";
  var labelTc = setCellText(tcs[0], open + def.label);
  var amountTc = setCellText(tcs[1], def.amount + close);
  return proto.replace(tcs[0], labelTc).replace(tcs[1], amountTc);
}
const ROWS = [
  { cond: null, label: "Opening Balance (Dr/Cr)", amount: "{opening}", bold: false },
  { cond: "show_purchase", label: "Net Taxable Purchase (A)", amount: "{net_taxable_purchase}", bold: false },
  { cond: "show_purchase", label: "VAT on Purchase", amount: "{vat_purchase}", bold: false },
  { cond: "has_exempt_purchase", label: "Exempt Purchase (B)", amount: "{exempt_purchase}", bold: false },
  { cond: "show_purchase", label: "{reportable_purchase_label}", amount: "{reportable_purchase}", bold: true },
  { cond: "has_purchase_return", label: "Purchase Return (already adjusted above)", amount: "{purchase_return}", bold: false },
  { cond: "show_sales", label: "Net Taxable Sales (C)", amount: "{net_taxable_sales}", bold: false },
  { cond: "show_sales", label: "VAT on Sales", amount: "{vat_sales}", bold: false },
  { cond: "has_exempt_sales", label: "Exempt Sales (D)", amount: "{exempt_sales}", bold: false },
  { cond: "show_sales", label: "{reportable_sales_label}", amount: "{reportable_sales}", bold: true },
  { cond: "has_sales_return", label: "Sales Return (already adjusted above)", amount: "{sales_return}", bold: false },
  { cond: "has_tds_party", label: "TDS Deducted by Party", amount: "{tds_party}", bold: false },
  { cond: "has_tds_us", label: "TDS Deducted by us", amount: "{tds_us}", bold: false },
  { cond: "has_retention", label: "Retention Money", amount: "{retention}", bold: false },
  { cond: null, label: "Closing Balance (Dr/Cr)", amount: "{closing}", bold: true },
];
const amountTable = tblOpen + headerRow + ROWS.map(makeRow).join("") + "</w:tbl>";

// ---- letter body (one letter; the subject is now static, names dropped) ----
const emptyTop = blocks[0];
const dateP = edit(must(blocks[1], "2083/07/05"), [["2083/07/05", "{date}"]]);
const toP = must(blocks[2], "To,");
const partyNameP = edit(must(blocks[3], "Sagarmatha Suppliers"), [["Sagarmatha Suppliers", "{party_name}"]]);
const partyAddrP = edit(must(blocks[4], "Thimi, Bhaktapur"), [["Thimi, Bhaktapur", "{party_address}"]]);
const panP = edit(must(blocks[5], "111111111"), [["111111111", "{party_pan}"]]);
const subjectP = must(blocks[6], "Balance Confirmation and Transaction details");
const greetingP = must(blocks[7], "Dear Sir/Madam");
const introP = edit(must(must(blocks[8], "2082/83"), "2083/03/32"), [["2082/83", "{fy}"], ["2083/03/32", "{as_on}"]]);
const emptyMid = blocks[10];
const responseP = edit(must(blocks[11], "within 15 days"), [["within 15 days", "within {response_days} days"]]);
const signTbl = edit(must(blocks[12], "Ram Bahadur Thapa"), [
  ["Himal Traders Private Limited", "{sender_name}"],
  ["Ram Bahadur Thapa", "{signatory_name}"],
  ["Chairman", "{signatory_designation}"],
  ["Sagarmatha Suppliers", "{party_name}"],
]);
const trailing = blocks[14];

const letterBody = emptyTop + dateP + toP + partyNameP + partyAddrP + panP + subjectP
  + greetingP + introP + amountTable + emptyMid + responseP + signTbl + trailing;

// {#letters}: one letter per party; a next-page section break after each letter
// except the last (so each letter's first page carries the letterhead header).
const body = tagPara("{#letters}")
  + letterBody
  + tagPara("{^last}") + SECT_PARA + tagPara("{/last}")
  + tagPara("{/letters}")
  + BODY_SECTPR;

zip.file("word/document.xml", head + body + tail);
fs.writeFileSync(OUT, zip.generate({ type: "nodebuffer", compression: "DEFLATE" }));
console.log("wrote " + path.relative(ROOT, OUT) + " (" + fs.statSync(OUT).size + " bytes)");
