/*
 * Build templates/bank-statement-template.docx from the firm's reference
 * (docs/bank-docs/Bank_Statement_Request_Template_With_Letterhead.docx) by
 * inserting docxtemplater placeholders, loops and conditions into a COPY of the
 * reference. Paragraph formatting, spacing, the attendance table's widths and
 * borders, the bullet lists, the letterhead line and the page break are left
 * exactly as the reference has them — only run text is swapped for tags and a
 * few tag-only boundary paragraphs are inserted.
 *
 * The letterhead block and the multi-signatory signature table are reused from
 * the Account Opening template so both bank tools render an identical letterhead
 * and signature layout.
 *
 * Dev-only. Run: node scripts/build-bank-statement-template.js
 */
const fs = require("fs");
const path = require("path");
const PizZip = require("pizzip");

const ROOT = path.resolve(__dirname, "..");
const REF = path.join(ROOT, "docs", "bank-docs", "Bank_Statement_Request_Template_With_Letterhead.docx");
const AO = path.join(ROOT, "templates", "bank-account-template.docx");
const OUT = path.join(ROOT, "templates", "bank-statement-template.docx");

const refZip = new PizZip(fs.readFileSync(REF));
let xml = refZip.file("word/document.xml").asText();

const bodyOpen = xml.indexOf("<w:body");
const headEnd = xml.indexOf(">", bodyOpen) + 1;
const bodyEnd = xml.lastIndexOf("</w:body>");
const head = xml.slice(0, headEnd);
const tail = xml.slice(bodyEnd);
let inner = xml.slice(headEnd, bodyEnd);

const blocks = inner.match(/<w:(p|tbl)\b[\s\S]*?<\/w:\1>/g) || [];
if (blocks.length !== 49) throw new Error("Expected 49 reference blocks, got " + blocks.length);

// ---- helpers -------------------------------------------------------------
function tagPara(t) { return '<w:p><w:r><w:t xml:space="preserve">' + t + "</w:t></w:r></w:p>"; }
function splice(hay, needle, repl) {
  const i = hay.indexOf(needle);
  if (i < 0) throw new Error("block not found in body: " + needle.slice(0, 80));
  return hay.slice(0, i) + repl + hay.slice(i + needle.length);
}
// Apply [pattern, replacement] pairs to a block; strings must be found (RegExp may be global).
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
const AP = "[\\u2019']"; // straight or curly apostrophe

// ---- reused XML from the Account Opening template ------------------------
const aoInner = new PizZip(fs.readFileSync(AO)).file("word/document.xml").asText();
const SIG_TABLE = (aoInner.match(/<w:tbl\b[\s\S]*?<\/w:tbl>/g) || []).find(function (t) { return t.indexOf("{#sig_rows}") >= 0; });
if (!SIG_TABLE) throw new Error("Could not find the Account Opening signature table to reuse.");

// ---- block transforms ----------------------------------------------------
const EMPTY = blocks[3]; // an empty sz=22 paragraph, used for the no-letterhead blanks

// Letterhead: name(48)/address(48)/line + 1 blank when on; 3 blanks when off.
const b0 = edit(blocks[0], [["<w:lastRenderedPageBreak/>", ""], ["Himal Traders Private Limited", "{entity_name}"]]);
const b1 = edit(blocks[1], [["Kathmandu-10, Kathmandu", "{entity_address}"]]);
inner = splice(inner, blocks[0], tagPara("{#letterhead}") + b0);
inner = splice(inner, blocks[1], b1);
// close the on-branch after the single blank that follows the line, then the off-branch
inner = splice(inner, blocks[3],
  blocks[3] + tagPara("{/letterhead}") + tagPara("{^letterhead}") + EMPTY + EMPTY + EMPTY + tagPara("{/letterhead}"));

// Letter date (superscript ordinal)
inner = splice(inner, blocks[4], edit(blocks[4], [
  [/(<w:t[^>]*>)16(<\/w:t>)/, "$1{ltr_day}$2"],
  [/(<w:t[^>]*>)th(<\/w:t>)/, "$1{ltr_ord}$2"],
  [/(<w:t[^>]*>) October 2026(<\/w:t>)/, "$1 {ltr_monthyear}$2"],
]));

inner = splice(inner, blocks[6], edit(blocks[6], [["XYZ Bank Limited", "{bank}"]]));
inner = splice(inner, blocks[7], edit(blocks[7], [["Kathmandu, Nepal", "{bank_address}"]]));

// Opening sentence: noun + account{s} + period (dates bold as in the reference)
inner = splice(inner, blocks[12], edit(blocks[12], [
  ["our company", "our {noun}"],              // -> our {noun}'s
  ["bank account at", "bank {account_word} at"],
  ["2025/07/17", "{from}"],
  ["2026/10/15", "{to}{bs}"],
]));

inner = splice(inner, blocks[13], edit(blocks[13], [["Himal Traders Private Limited", "{account_name}"]]));

// Account Number: one line per account
inner = splice(inner, blocks[14], tagPara("{#accounts}")
  + edit(blocks[14], [["00112233445566", "{number}"]]) + tagPara("{/accounts}"));

inner = splice(inner, blocks[15], edit(blocks[15], [["Kathmandu Branch", "{branch}"]]));

// Letter signature: single -> two paragraphs (reference); multiple -> the shared table
const sigName = edit(blocks[24], [["Sita Kumari Shrestha", "{sole_name}"]]);
const sigDes = edit(blocks[25], [["Director", "{sole_designation}"]]);
inner = splice(inner, blocks[24], tagPara("{#sig_single}") + sigName);
inner = splice(inner, blocks[25], sigDes + tagPara("{/sig_single}")
  + tagPara("{#sig_multi}") + SIG_TABLE + tagPara("{/sig_multi}"));

// Minute section is conditional on has_minute (proprietorship = letter only).
inner = splice(inner, blocks[26], tagPara("{#has_minute}") + blocks[26]);

inner = splice(inner, blocks[27], edit(blocks[27], [
  ["<w:lastRenderedPageBreak/>", ""], ["HIMAL TRADERS PRIVATE LIMITED", "{entity_name_caps}"],
]));
inner = splice(inner, blocks[28], edit(blocks[28], [["KATHMANDU-10, KATHMANDU", "{entity_address_caps}"]]));
inner = splice(inner, blocks[29], edit(blocks[29], [["MINUTES OF THE BOARD OF DIRECTORS", "{minute_title}"]]));

// Minute date + time
inner = splice(inner, blocks[31], edit(blocks[31], [
  [/(<w:t[^>]*>)16(<\/w:t>)/, "$1{mtg_day}$2"],
  [/(<w:t[^>]*>)th(<\/w:t>)/, "$1{mtg_ord}$2"],
  [/(<w:t[^>]*>) October 2026(<\/w:t>)/, "$1 {mtg_monthyear}$2"],
]));
inner = splice(inner, blocks[32], edit(blocks[32], [["9:00 AM", "{meeting_time}"]]));

// "Directors Present:" -> "{present_word} Present:"
inner = splice(inner, blocks[34], edit(blocks[34], [[/(<w:t[^>]*>)Directors(<\/w:t>)/, "$1{present_word}$2"]]));

// Attendance table -> one looped row
(function () {
  const tbl = blocks[35];
  const m = tbl.match(/<w:tr\b[\s\S]*?<\/w:tr>/);
  const pre = tbl.slice(0, m.index);
  let row = m[0];
  row = edit(row, [
    [/(<w:t[^>]*>)Mr\. (<\/w:t>)/, "$1{m_title} $2"],
    [/(<w:t[^>]*>)Ram Bahadur Thapa(<\/w:t>)/, "$1{m_name}$2"],
    [/(<w:t[^>]*>)Chairman(<\/w:t>)/, "$1{m_designation}$2"],
  ]);
  const op = row.indexOf("</w:pPr>") + "</w:pPr>".length;
  row = row.slice(0, op) + '<w:r><w:t xml:space="preserve">{#members}</w:t></w:r>' + row.slice(op);
  const cp = row.lastIndexOf("</w:p>");
  row = row.slice(0, cp) + '<w:r><w:t xml:space="preserve">{/members}</w:t></w:r>' + row.slice(cp);
  inner = splice(inner, tbl, pre + row + "</w:tbl>");
})();

// Narrative
inner = splice(inner, blocks[36], edit(blocks[36], [
  ["the board of directors", "{meeting_of}"],
  [new RegExp("the company" + AP + "s office"), "{office}"],
  ["Himal Traders Private Limited", "{entity_name}"],
  [/(<w:t[^>]*>)Mr\. (<\/w:t>)/, "$1{chair_title} $2"],
  ["Ram Bahadur Thapa", "{chair_name}"],
  ["All board members were present", "{presence_sentence}"],
]));

// Agenda item (numbered)
inner = splice(inner, blocks[38], edit(blocks[38], [
  [new RegExp("the company" + AP + "s account"), "the {noun}\u2019s {account_word}"],
  ["XYZ Bank Limited", "{bank}"],
  ["Kathmandu Branch", "{branch}"],
]));

// Discussion item (numbered)
inner = splice(inner, blocks[41], edit(blocks[41], [
  ["The board members", "The {members_word}"],
  [new RegExp("the company" + AP + "s bank statement"), "the {noun}\u2019s bank {statement_word}"],
  ["2025/07/17", "{from}"],
  ["2026/10/15", "{to}{bs}"],
  ["internal accounting", "{purpose}"],
]));

// Decision
inner = splice(inner, blocks[44], edit(blocks[44], [
  ["XYZ Bank Limited", "{bank}"],
  ["Kathmandu Branch", "{branch}"],
  [new RegExp("the bank statement of the company" + AP + "s Account No\\. "), "the bank {statement_word} of the {noun}\u2019s "],
  ["00112233445566", "{account_list}"],
  ["2025/07/17", "{from}"],
  ["2026/10/15", "{to}{bs}"],
]));

// Authorization sentence (computed, like Account Opening's operating instruction)
(function () {
  const pPr = (blocks[45].match(/<w:pPr>[\s\S]*?<\/w:pPr>/) || [""])[0];
  const newP = "<w:p>" + pPr + '<w:r><w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>'
    + '<w:t xml:space="preserve">{authorization}</w:t></w:r></w:p>';
  inner = splice(inner, blocks[45], newP);
})();

// Service-charge line
inner = splice(inner, blocks[46], edit(blocks[46], [
  [new RegExp("the company" + AP + "s account"), "the {noun}\u2019s {account_word}"],
]));

// close has_minute at the very end (before the body sectPr)
inner = splice(inner, blocks[48], blocks[48] + tagPara("{/has_minute}"));

// ---- write ---------------------------------------------------------------
refZip.file("word/document.xml", head + inner + tail);
fs.writeFileSync(OUT, refZip.generate({ type: "nodebuffer" }));
console.log("wrote " + path.relative(ROOT, OUT) + " (" + fs.statSync(OUT).size + " bytes)");
