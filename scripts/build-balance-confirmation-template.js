/*
 * Build templates/balance-confirmation-template.docx from the firm's reference
 * (docs/tax-docs/Balance_Confirmation_Template_With_Letterhead.docx) by inserting
 * docxtemplater placeholders, a {#letters} loop (one letter per party) and a
 * condition on every optional row and on the purchase / sales blocks.
 *
 * The letterhead (name, address, horizontal line) is moved OUT of the body and
 * into a first-page section header (word/header1.xml), shown only on the first
 * page of each letter and never repeated on continuation pages; word/header2.xml
 * is the empty default (continuation) header. Each letter is its own section
 * (a next-page section break between letters) so every letter's first page gets
 * the letterhead. All sections share the one header part (the sender is constant
 * per batch). When "letterhead off", the whole letterhead is conditioned out and
 * the header renders empty.
 *
 * Paragraph formatting, the amount-table borders / widths / cell margins, the
 * signature-table layout and all run fonts/sizes are taken verbatim from the
 * reference; only run TEXT is swapped for tags and a few tag-only boundary
 * paragraphs are inserted (docxtemplater removes those from the output).
 *
 * Dev-only. Run: node scripts/build-balance-confirmation-template.js
 */
const fs = require("fs");
const path = require("path");
const PizZip = require("pizzip");

const ROOT = path.resolve(__dirname, "..");
const REF = path.join(ROOT, "docs", "tax-docs", "Balance_Confirmation_Template_With_Letterhead.docx");
const OUT = path.join(ROOT, "templates", "balance-confirmation-template.docx");

const zip = new PizZip(fs.readFileSync(REF));
let docXml = zip.file("word/document.xml").asText();

// Namespaces from the reference document root, reused on the header parts (the
// letterhead line is a wps/v drawing that needs the full namespace set).
const rootOpen = docXml.match(/<w:document\b[^>]*>/)[0];
const nsAttrs = rootOpen.replace(/^<w:document/, "").replace(/>$/, "");

const headStart = docXml.indexOf("<w:body");
const headEnd = docXml.indexOf(">", headStart) + 1;
const bodyEnd = docXml.lastIndexOf("</w:body>");
const head = docXml.slice(0, headEnd);
const tail = "</w:body></w:document>";
const inner = docXml.slice(headEnd, bodyEnd);
const blocks = inner.match(/<w:(p|tbl)\b[\s\S]*?<\/w:\1>/g) || [];
if (blocks.length !== 33) throw new Error("Expected 33 reference blocks, got " + blocks.length);

// ---- helpers -------------------------------------------------------------
function edit(block, pairs) {
  pairs.forEach(function (p) {
    const pat = p[0], rep = p[1];
    if (typeof pat === "string") {
      if (block.indexOf(pat) < 0) throw new Error("literal not found: " + pat.slice(0, 60));
      block = block.split(pat).join(rep);
    } else {
      if (!pat.test(block)) throw new Error("pattern not found: " + pat);
      block = block.replace(pat, rep);
    }
  });
  return block;
}
function tagPara(t) { return '<w:p><w:r><w:t xml:space="preserve">' + t + "</w:t></w:r></w:p>"; }

// ---- header parts (letterhead) ------------------------------------------
// blocks[0] = name (24pt, centered, yellow), [1] = address, [2] = the line drawing.
let nameP = edit(blocks[0], [
  ["<w:lastRenderedPageBreak/>", ""],
  ["Himal Traders Private Limited", "{#letterhead}{entity_name}"],
]);
let addrP = edit(blocks[1], [["Kathmandu-10, Kathmandu", "{entity_address}"]]);
// Close the letterhead condition at the end of the line-drawing paragraph.
let lineP = blocks[2].replace("</w:p>", '<w:r><w:t xml:space="preserve">{/letterhead}</w:t></w:r></w:p>');

const header1 = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n'
  + "<w:hdr" + nsAttrs + ">" + nameP + addrP + lineP + "</w:hdr>";
const header2 = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n'
  + "<w:hdr" + nsAttrs + "><w:p/></w:hdr>";

// ---- section properties (shared by every letter's section) ---------------
// titlePg => the letterhead header (first) shows only on each section's first
// page; the empty default header on any continuation page.
const SECT_INNER =
  '<w:headerReference w:type="default" r:id="rId10"/>'
  + '<w:headerReference w:type="first" r:id="rId11"/>'
  + '<w:pgSz w:w="11906" w:h="16838" w:orient="portrait"/>'
  + '<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>'
  + '<w:pgNumType/><w:titlePg/><w:docGrid w:linePitch="360"/>';
const SECT_PARA = "<w:p><w:pPr><w:sectPr>" + SECT_INNER + "</w:sectPr></w:pPr></w:p>";
const BODY_SECTPR = "<w:sectPr>" + SECT_INNER + "</w:sectPr>";

// ---- amount table (built from the reference's table chrome) --------------
const amtTbl = blocks[12];
const tblOpen = amtTbl.slice(0, amtTbl.indexOf("<w:tr>"));          // tblPr + tblGrid
const headerRow = amtTbl.match(/<w:tr>[\s\S]*?<\/w:tr>/)[0];        // Particulars / Amount
// tcPr of the two cells of the Opening row (label 5400 / amount 2600).
const openingRow = (amtTbl.match(/<w:tr>[\s\S]*?<\/w:tr>/g) || [])[1];
const tcPrs = openingRow.match(/<w:tcPr>[\s\S]*?<\/w:tcPr>/g);
const TC_LABEL = tcPrs[0], TC_AMOUNT = tcPrs[1];

const TNR = '<w:rFonts w:ascii="Times New Roman" w:cs="Times New Roman" w:eastAsia="Times New Roman" w:hAnsi="Times New Roman"/>';
const SZ = '<w:sz w:val="24"/><w:szCs w:val="24"/>';
const B = "<w:b/><w:bCs/>";
const HL = '<w:highlight w:val="yellow"/>';
function rprLabel(bold) { return "<w:rPr>" + TNR + (bold ? B : "") + SZ + "</w:rPr>"; }
function rprAmount(bold) { return "<w:rPr>" + TNR + (bold ? B : "") + SZ + HL + "</w:rPr>"; }
function run(rpr, text) { return "<w:r>" + rpr + '<w:t xml:space="preserve">' + text + "</w:t></w:r>"; }
function cell(tcPr, jc, runXml) {
  return "<w:tc>" + tcPr + '<w:p><w:pPr><w:spacing w:after="0" w:before="0"/><w:jc w:val="' + jc + '"/></w:pPr>' + runXml + "</w:p></w:tc>";
}
function row(def) {
  const openTag = def.cond ? "{#" + def.cond + "}" : "";
  const closeTag = def.cond ? "{/" + def.cond + "}" : "";
  const label = cell(TC_LABEL, "left", run(rprLabel(def.bold), openTag + def.label));
  const amount = cell(TC_AMOUNT, "right", run(rprAmount(def.bold), def.amount + closeTag));
  return "<w:tr>" + label + amount + "</w:tr>";
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
const amountTable = tblOpen + headerRow + ROWS.map(row).join("") + "</w:tbl>";

// ---- letter body paragraphs ----------------------------------------------
const dateP = edit(blocks[4], [["2083/07/05", "{date}"]]);
const toP = blocks[5];
const partyNameP = edit(blocks[6], [["Sagarmatha Suppliers", "{party_name}"]]);
const partyAddrP = edit(blocks[7], [["Thimi, Bhaktapur", "{party_address}"]]);
const panP = edit(blocks[8], [["111111111", "{party_pan}"]]);
const subjectP = edit(blocks[9], [
  ["Himal Traders Private Limited", "{sender_name}"],
  ["Sagarmatha Suppliers", "{party_name}"],
]);
const greetingP = blocks[10];
const introP = edit(blocks[11], [["2082/83", "{fy}"], ["2083/03/32", "{as_on}"]]);
const spacerP = blocks[13];
const responseP = edit(blocks[14], [["15", "{response_days}"]]);
const signTbl = edit(blocks[15], [
  ["Himal Traders Private Limited", "{sender_name}"],
  ["Ram Bahadur Thapa", "{signatory_name}"],
  ["Chairman", "{signatory_designation}"],
  ["Sagarmatha Suppliers", "{party_name}"],
]);

const letterBody = dateP + toP + partyNameP + partyAddrP + panP + subjectP
  + greetingP + introP + amountTable + spacerP + responseP + signTbl;

// One letter per party; a next-page section break after every letter except the
// last, so each letter's first page carries the letterhead header.
const body = tagPara("{#letters}")
  + letterBody
  + tagPara("{^last}") + SECT_PARA + tagPara("{/last}")
  + tagPara("{/letters}")
  + BODY_SECTPR;

// ---- assemble package ----------------------------------------------------
zip.file("word/document.xml", head + body + tail);
zip.file("word/header1.xml", header1);
zip.file("word/header2.xml", header2);

// rels: add header1 (rId11) + header2 (rId10)
let rels = zip.file("word/_rels/document.xml.rels").asText();
const relAdd = '<Relationship Id="rId10" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header2.xml"/>'
  + '<Relationship Id="rId11" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>';
rels = rels.replace("</Relationships>", relAdd + "</Relationships>");
zip.file("word/_rels/document.xml.rels", rels);

// content types: header parts
let ct = zip.file("[Content_Types].xml").asText();
const ctAdd = '<Override ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml" PartName="/word/header1.xml"/>'
  + '<Override ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml" PartName="/word/header2.xml"/>';
ct = ct.replace("</Types>", ctAdd + "</Types>");
zip.file("[Content_Types].xml", ct);

fs.writeFileSync(OUT, zip.generate({ type: "nodebuffer" }));
console.log("wrote " + path.relative(ROOT, OUT) + " (" + fs.statSync(OUT).size + " bytes)");
