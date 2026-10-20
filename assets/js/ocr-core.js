/*
 * P.S.G. & Associates — OCR Docs builder (code-built .docx, Stage 1).
 * Pure logic shared by the browser (assets/js/app.js) and the Node tests/sample
 * generator. Builds the Office of the Company Registrar filing set from the form
 * data + the Nepali wording in data/ocr.yaml. A4 pages, justified body text,
 * AutoFit tables, consistent heading + signature blocks, optional letterhead.
 *
 * UMD: window.OCRCore in the browser (needs window.docx + window.PSGBSDate),
 * module.exports in Node (require 'docx' + the shared BS-date helper).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("docx"), require("./common/psg-bsdate"));
  } else {
    root.OCRCore = factory(root.docx, root.PSGBSDate);
  }
})(typeof self !== "undefined" ? self : this, function (docx, PSGBSDate) {
  "use strict";

  var Document = docx.Document, Packer = docx.Packer, Paragraph = docx.Paragraph,
    TextRun = docx.TextRun, Table = docx.Table, TableRow = docx.TableRow, TableCell = docx.TableCell,
    AlignmentType = docx.AlignmentType, BorderStyle = docx.BorderStyle, WidthType = docx.WidthType,
    ShadingType = docx.ShadingType, PageBreak = docx.PageBreak, TableLayoutType = docx.TableLayoutType,
    HeightRule = docx.HeightRule;

  var F = "Mangal";
  var A4 = { width: 11906, height: 16838 };          // A4 in twips (A1)
  var nepNums = ["०", "१", "२", "३", "४", "५", "६", "७", "८", "९"];
  function toNep(n) { return String(n).split("").map(function (c) { return /[0-9]/.test(c) ? nepNums[+c] : c; }).join(""); }
  function pad2(n) { n = String(n); return n.length < 2 ? "0" + n : n; }
  function fmt(s, v) { return String(s == null ? "" : s).replace(/\{(\w+)\}/g, function (m, k) { return v && v[k] != null ? v[k] : ""; }); }

  // ── Nepali amount in words (lakh/crore). New wording — verified:false. ──
  // Full Nepali 1–99 word table (verified:false — pending partner confirmation).
  var ONES = ["", "एक", "दुई", "तीन", "चार", "पाँच", "छ", "सात", "आठ", "नौ", "दश",
    "एघार", "बाह्र", "तेह्र", "चौध", "पन्ध्र", "सोह्र", "सत्र", "अठार", "उन्नाइस", "बीस",
    "एक्काइस", "बाइस", "तेइस", "चौबिस", "पच्चीस", "छब्बीस", "सत्ताइस", "अठ्ठाइस", "उनन्तीस", "तीस",
    "एकतीस", "बत्तीस", "तेत्तीस", "चौँतीस", "पैँतीस", "छत्तीस", "सैँतीस", "अठतीस", "उनन्चालीस", "चालीस",
    "एकचालीस", "बयालीस", "त्रिचालीस", "चवालीस", "पैंतालीस", "छयालीस", "सतचालीस", "अठचालीस", "उनन्चास", "पचास",
    "एकाउन्न", "बाउन्न", "त्रिपन्न", "चवन्न", "पचपन्न", "छपन्न", "सन्ताउन्न", "अन्ठाउन्न", "उनन्साठी", "साठी",
    "एकसट्ठी", "बयसट्ठी", "त्रिसट्ठी", "चौंसट्ठी", "पैंसट्ठी", "छयसट्ठी", "सतसट्ठी", "अठसट्ठी", "उनन्सत्तरी", "सत्तरी",
    "एकहत्तर", "बहत्तर", "त्रिहत्तर", "चौहत्तर", "पचहत्तर", "छयहत्तर", "सतहत्तर", "अठहत्तर", "उनासी", "असी",
    "एकासी", "बयासी", "त्रियासी", "चौरासी", "पचासी", "छयासी", "सतासी", "अठासी", "उनान्नब्बे", "नब्बे",
    "एकानब्बे", "बयानब्बे", "त्रियानब्बे", "चौरानब्बे", "पन्चानब्बे", "छयानब्बे", "सन्तानब्बे", "अन्ठानब्बे", "उनान्सय"];
  function two(n) { return ONES[n] || ""; }
  function amountWordsNep(num) {
    num = parseInt(String(num).replace(/[^0-9]/g, ""), 10);
    if (!num) return "शून्य";
    var parts = [], crore = Math.floor(num / 10000000); num %= 10000000;
    var lakh = Math.floor(num / 100000); num %= 100000;
    var thou = Math.floor(num / 1000); num %= 1000;
    var hund = Math.floor(num / 100); num %= 100;
    if (crore) parts.push(two(crore) + " करोड");
    if (lakh) parts.push(two(lakh) + " लाख");
    if (thou) parts.push(two(thou) + " हजार");
    if (hund) parts.push(two(hund) + " सय");
    if (num) parts.push(two(num));
    return parts.join(" ").trim();
  }
  // Nepali-grouped amount string (२५,००,०००) from a number or digit string.
  function groupNep(n) {
    var s = String(n == null ? "" : n).replace(/[^0-9]/g, "");
    if (!s) return "";
    var last3 = s.slice(-3), rest = s.slice(0, -3);
    if (rest) last3 = rest.replace(/\B(?=(\d\d)+(?!\d))/g, ",") + "," + last3;
    return toNep(last3);
  }

  // ── date helpers on the shared BS calendar (A4) ──
  function parseNepDate(str) {
    var ascii = String(str || "").replace(/[०-९]/g, function (c) { return nepNums.indexOf(c); });
    var m = ascii.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
    if (!m) return null;
    return { y: +m[1], mo: +m[2], d: +m[3] };
  }
  function addDays(nepStr, days) {
    var p = parseNepDate(nepStr);
    if (!p) throw new Error("Invalid date: " + nepStr);
    var days0 = PSGBSDate.bsMonthDays(p.y, p.mo - 1);
    if (!days0) throw new Error("Year " + p.y + " is outside the supported BS calendar.");
    var r = PSGBSDate.addBSDays(p.y, p.mo - 1, p.d, days);
    return toNep(r.y) + "/" + toNep(pad2(r.m0 + 1)) + "/" + toNep(pad2(r.day));
  }

  // ── paragraph + table builders ──
  var AL = { center: AlignmentType.CENTER, right: AlignmentType.RIGHT, left: AlignmentType.LEFT, justify: AlignmentType.JUSTIFIED };
  function P(text, o) {
    o = o || {};
    return new Paragraph({
      alignment: AL[o.align || "justify"],
      spacing: { before: o.before != null ? o.before : 0, after: o.after != null ? o.after : 120, line: 276 },
      border: o.line ? { bottom: { style: BorderStyle.SINGLE, size: 6, color: "000000", space: 1 } } : undefined,
      children: [new TextRun({ text: text || "", bold: !!o.bold, size: o.size || 22, font: F, underline: o.underline ? {} : undefined })],
    });
  }
  function heading(text, o) {
    o = o || {};
    return new Paragraph({ alignment: AL.center, spacing: { before: o.before != null ? o.before : 120, after: o.after != null ? o.after : 120, line: 276 },
      children: [new TextRun({ text: text, bold: true, size: o.size || 28, font: F })] });
  }
  function subHead(text) {
    return new Paragraph({ alignment: AL.left, spacing: { before: 160, after: 80, line: 276 },
      children: [new TextRun({ text: text, bold: true, size: 22, font: F, underline: {} })] });
  }
  function PB() { return new Paragraph({ children: [new PageBreak()] }); }
  var bdr = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
  var BORDERS = { top: bdr, bottom: bdr, left: bdr, right: bdr };
  function TC(text, o) {
    o = o || {};
    return new TableCell({
      borders: BORDERS,
      width: o.w ? { size: o.w, type: WidthType.DXA } : undefined,
      shading: o.header ? { fill: "D5D5D5", type: ShadingType.CLEAR, color: "auto" } : undefined,
      margins: { top: 60, bottom: 60, left: 110, right: 110 },
      children: [new Paragraph({ alignment: o.center ? AL.center : AL.left,
        children: [new TextRun({ text: text || "", bold: !!(o.header || o.bold), size: 20, font: F })] })],
    });
  }
  // AutoFit-to-window table (A1): spans the text width, columns fit content,
  // signature column keeps a minimum width, rows keep a minimum height.
  function autoTable(headerCells, bodyRows, opts) {
    opts = opts || {};
    var rows = [new TableRow({ tableHeader: true, children: headerCells })];
    bodyRows.forEach(function (cells) {
      rows.push(new TableRow({ children: cells, height: opts.rowMin ? { value: opts.rowMin, rule: HeightRule.ATLEAST } : undefined }));
    });
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.AUTOFIT,
      columnWidths: opts.columnWidths,
      rows: rows,
    });
  }

  // ── shared blocks ──
  function headerBlock(data, W) {
    var c = data.company, out = [];
    if (c.letterhead) {
      out.push(heading(c.name, { size: 48, after: 40 }));
      if (c.address) out.push(P(c.address, { align: "center", after: 0 }));
      out.push(P("", { align: "center", line: true, after: 120 }));       // the letterhead rule
      out.push(P(fmt(W.labels.regNo, { reg: c.reg }), { align: "center" }));
    } else {
      out.push(heading(c.name, { size: 28, after: 40 }));
      if (c.address) out.push(P(c.address, { align: "center", after: 0 }));
      out.push(P(fmt(W.labels.regNo, { reg: c.reg }), { align: "center" }));
    }
    return out;
  }
  function signature(name, role, company) {
    return [P(".....................................", { align: "left", before: 360, after: 0 }),
      P(name, { align: "left", after: 0 }), P(role, { align: "left", after: 0 }), P(company, { align: "left" })];
  }
  function members(data) {
    return (data.members || []).map(function (m) { return { name: m.name, address: m.address, role: m.role || "सञ्चालक" }; });
  }
  function chair(data) { var ms = members(data); return ms[data.chairIndex || 0] || ms[0] || { name: "", role: "अध्यक्ष" }; }
  function shareholders(data) {
    if (data.shareholdersSameAsDirectors !== false && !(data.shareholders && data.shareholders.length)) {
      return members(data).map(function (m) { return { name: m.name, address: m.address, shares: "" }; });
    }
    return data.shareholders || [];
  }
  function boardAttendance(data, W) {
    var H = W.tables.attendance;
    return autoTable(
      [TC(H[0], { header: true, center: true }), TC(H[1], { header: true }), TC(H[2], { header: true }), TC(H[3], { header: true, w: 2800 })],
      members(data).map(function (m, i) { return [TC(toNep(i + 1) + ".", { center: true }), TC(m.name), TC(m.role), TC("", { w: 2800 })]; }),
      { rowMin: 480, columnWidths: [900, 3400, 2200, 2800] });
  }
  function shareholderAttendance(data, W) {
    var H = W.tables.shareholders, sh = shareholders(data);
    return autoTable(
      [TC(H[0], { header: true, center: true }), TC(H[1], { header: true }), TC("पद/शेयर संख्या", { header: true }), TC(W.tables.attendance[3], { header: true, w: 2800 })],
      sh.map(function (s, i) { return [TC(toNep(i + 1) + ".", { center: true }), TC(s.name), TC(s.shares != null && s.shares !== "" ? toNep(s.shares) : (s.role || "")), TC("", { w: 2800 })]; }),
      { rowMin: 480, columnWidths: [900, 3700, 1900, 2800] });
  }

  // ── documents ──
  function doc_sgmBod(data, W) {
    var S = W.sgmBod, c = data.company, ch = chair(data), out = headerBlock(data, W);
    out.push(heading(W.headings.sgmBod, { size: 24 }));
    out.push(P(fmt(S.intro, { company: c.name, chair: ch.name }), {}));
    out.push(P(fmt(W.labels.place, { place: data.company.address }), { align: "left" }));
    out.push(P(fmt(W.labels.date, { date: data.dates.bodAuditor }), { align: "left" }));
    out.push(P(fmt(W.labels.time, { time: data.times.sgmBod }), { align: "left", after: 160 }));
    out.push(subHead(W.labels.attendance), boardAttendance(data, W));
    out.push(subHead(W.labels.proposals), P(S.prop1, { align: "left" }), P(S.prop2, { align: "left" }));
    out.push(subHead(S.dec1Head), P(fmt(S.dec1, { sgm: data.dates.sgm }), {}), P(S.dec1a, { align: "left" }), P(S.dec1b, { align: "left" }));
    out.push(subHead(S.dec2Head), P(S.dec2, {}));
    return out;
  }
  function doc_sgm(data, W) {
    var S = W.sgm, c = data.company, ch = chair(data), out = headerBlock(data, W);
    out.push(heading(W.headings.sgm, { size: 24 }));
    out.push(P(fmt(S.intro, { company: c.name, chair: ch.name }), {}));
    out.push(P(fmt(W.labels.place, { place: c.address }), { align: "left" }));
    out.push(P(fmt(W.labels.date, { date: data.dates.sgm }), { align: "left" }));
    out.push(P(fmt(W.labels.time, { time: data.times.sgm }), { align: "left", after: 160 }));
    out.push(subHead(W.labels.attendance), shareholderAttendance(data, W));
    out.push(subHead(W.labels.proposals), P(S.prop1, { align: "left" }), P(S.prop2, { align: "left" }));
    out.push(subHead(S.legalityHead), P(S.legality, {}));
    out.push(subHead(S.dec1Head), P(fmt(S.dec1, {
      fy: data.fiscal.current, prevFirm: data.auditors.prev.firm, prevAuditor: data.auditors.prev.name,
      reason: data.reasonPhrase, curFirm: data.auditors.cur.firm, curAuditor: data.auditors.cur.name }), {}));
    out.push(subHead(S.dec2Head), P(S.dec2, {}));
    return out;
  }
  function doc_bo(data, W) {
    var S = W.bo, c = data.company, out = headerBlock(data, W);
    out.push(heading(W.headings.bo, { size: 24, after: 40 }));
    out.push(P(W.headings.boSub, { align: "center", after: 160 }));
    out.push(P(S.line1, {}), P(S.line1b, {}));
    out.push(P(S.line2, { after: 100 }));
    var H = W.tables.bo;
    out.push(autoTable(H.map(function (h, i) { return TC(h, { header: true, center: i === 0 }); }),
      [H.map(function () { return TC(""); })], { rowMin: 360 }));
    out.push(P(S.note, { align: "left", before: 80 }));
    out.push.apply(out, signature(chair(data).name, chair(data).role, c.name));
    return out;
  }
  function doc_agmBod(data, W) {
    var S = W.agmBod, c = data.company, ch = chair(data), out = headerBlock(data, W);
    out.push(heading(W.headings.agmBod, { size: 24 }));
    out.push(P(fmt(S.intro, { date: data.dates.bod, time: data.times.agmBod, chair: ch.name }), {}));
    out.push(subHead(W.labels.attendanceColon), boardAttendance(data, W));
    out.push(subHead(S.dec1Head.indexOf("प्रस्ताव") >= 0 ? W.labels.proposalsDiscuss : W.labels.proposalsDiscuss));
    out.push(P(S.prop1, { align: "left" }), P(S.prop2, { align: "left" }));
    out.push(subHead(W.labels.decisions));
    out.push(subHead(S.dec1Head), P(fmt(S.dec1, { agm: data.dates.agm, agmTime: data.times.agm }), {}));
    out.push(subHead(W.labels.tapsil), P(S.tapsilA, { align: "left" }),
      P(fmt(S.tapsilB, { fy: data.fiscal.current }), { align: "left" }),
      P(fmt(S.tapsilC, { nextFy: data.fiscal.next }), { align: "left" }), P(S.tapsilD, { align: "left" }));
    out.push(subHead(S.dec2Head), P(S.dec2, {}));
    return out;
  }
  function doc_agm(data, W) {
    var S = W.agm, out = headerBlock(data, W), ch = chair(data);
    out.push(heading(W.headings.agm, { size: 24 }));
    out.push(P(fmt(S.intro, { agm: data.dates.agm, agmTime: data.times.agm, chair: ch.name }), {}));
    out.push(subHead(W.labels.attendanceColon), shareholderAttendance(data, W));
    out.push(subHead(S.quorumHead));
    out.push(P(fmt(data.quorumAllPresent === false ? S.quorumPartial : S.quorumAll, { agmBod: data.dates.bod }), {}));
    out.push(subHead(W.labels.proposals), P(S.prop1, { align: "left" }),
      P(fmt(S.prop2, { fy: data.fiscal.current }), { align: "left" }),
      P(fmt(S.prop3, { nextFy: data.fiscal.next }), { align: "left" }), P(S.prop4, { align: "left" }));
    out.push(subHead(W.labels.decisions));
    out.push(subHead(S.dec1Head), P(S.dec1, {}));
    out.push(subHead(S.dec2Head), P(fmt(S.dec2, { fy: data.fiscal.current, curFirm: data.auditors.cur.firm, curAuditor: data.auditors.cur.name }), {}));
    out.push(subHead(fmt(S.dec3Head, { nextFy: data.fiscal.next })), P(fmt(S.dec3, { nextFy: data.fiscal.next, nextFirm: data.auditors.next.firm, nextAuditor: data.auditors.next.name }), {}));
    out.push(subHead(S.dec4Head), P(S.dec4, {}));
    return out;
  }
  function doc_app50(data, W) {
    var S = W.app50, c = data.company, ch = chair(data), out = headerBlock(data, W);
    out.push(P(fmt(W.letters.dateLine, { date: data.dates.app }), { align: "right", before: 120 }));
    out.push(P(S.to1, { align: "left", after: 0 }), P(S.to2, { align: "left", after: 0 }), P(S.to3, { align: "left", after: 160 }));
    out.push(subHead(S.subject), P(W.labels.madhoday, { align: "left" }));
    out.push(P(fmt(S.body, { agm: data.dates.agm }), {}));
    out.push(P(S.nibedak, { align: "left", before: 160 }));
    out.push.apply(out, signature(ch.name, ch.role, c.name));
    return out;
  }
  function doc_sec92(data, W) {
    var out = [], ms = members(data), ans = data.sec92 || [];
    ms.forEach(function (m, idx) {
      if (idx > 0) out.push(PB());
      var a = ans[idx] || {};
      headerBlock(data, W).forEach(function (p) { out.push(p); });
      out.push(heading(W.headings.sec92, { size: 24 }));
      out.push(P(fmt(W.sec92.k, { ans: a.k || W.defaults.sec92 }), {}));
      out.push(P(fmt(W.sec92.kh, { ans: a.kh || W.defaults.sec92 }), {}));
      var g = a.g || W.defaults.sec92;
      out.push(P(fmt(W.sec92.g, { ans: g === "छ" && a.gNames ? "छ (" + a.gNames + ")" : g }), {}));
      out.push(P(fmt(W.sec92.gh, { ans: a.gh || W.defaults.sec92 }), {}));
      out.push.apply(out, signature(m.name, m.role, data.company.name));
    });
    return out;
  }
  function doc_sec51(data, W) {
    var S = W.s51, c = data.company, cap = data.capital, s = data.sec51 || {}, out = headerBlock(data, W);
    out.push(heading(W.headings.s51a, { size: 24, after: 40 }), heading(W.headings.s51b, { size: 24, after: 40 }), heading(W.headings.s51c, { size: 24 }));
    out.push(subHead(S.oneHead));
    if (s.shareholdersChanged) {
      out.push(P(fmt(S.oneChanged, { company: c.name }), {}));
      var H = W.tables.shareholders;
      out.push(autoTable(H.map(function (h, i) { return TC(h, { header: true, center: i === 0 }); }),
        shareholders(data).map(function (sh, i) { return [TC(toNep(i + 1), { center: true }), TC(sh.name), TC(sh.address || ""), TC(sh.shares != null ? toNep(sh.shares) : "")]; }),
        { rowMin: 360, columnWidths: [900, 3600, 3400, 1800] }));
    } else {
      out.push(P(fmt(S.oneUnchanged, { company: c.name }), {}));
    }
    out.push(subHead(S.twoHead));
    out.push(P(fmt(S.a, { authCapital: cap.authCapital, shares: toNep(cap.numShares || "") }), { align: "left" }));
    out.push(P(fmt(S.b, { issued: cap.issued }), { align: "left" }));
    out.push(P(fmt(S.c, { paidUp: cap.paidUp }), { align: "left" }));
    out.push(P(fmt(S.d, { faceValue: toNep(cap.faceValue || W.defaults.faceValue) }), { align: "left" }));
    out.push(P(fmt(S.e, { paidAmt: cap.paidAmt }), { align: "left" }));
    out.push(P(fmt(S.f, { unpaid: cap.unpaid }), { align: "left" }));
    out.push(P(fmt(S.g, { brokerage: s.brokerage || W.defaults.brokerage }), { align: "left" }));
    out.push(P(fmt(S.h, { forfeited: s.forfeited || W.defaults.forfeited }), { align: "left" }));
    out.push(P(fmt(S.i, { loans: s.loans || W.defaults.loans }), { align: "left" }));
    var inv = W.defaults.investments;
    if (Array.isArray(s.investments) && s.investments.length) {
      inv = s.investments.map(function (x) { return x.name + " (दर्ता नं. " + x.reg + ", रु. " + x.amount + ")"; }).join("; ");
    } else if (typeof s.investments === "string" && s.investments) { inv = s.investments; }
    out.push(P(fmt(S.j, { investments: inv }), { align: "left" }));
    out.push(subHead(S.dirHead));
    var DH = W.tables.directors51;
    out.push(autoTable(DH.map(function (h, i) { return TC(h, { header: true, center: i === 0 }); }),
      members(data).map(function (m, i) { return [TC(toNep(i + 1), { center: true }), TC(m.name), TC(m.role), TC(m.address || "")]; }),
      { rowMin: 420, columnWidths: [800, 3000, 2200, 3200] }));
    out.push.apply(out, signature(chair(data).name, chair(data).role, c.name));
    return out;
  }
  // ── auditor letters (Part C) ──
  function feeLine(W, fee) {
    if (!fee || fee.mode === "agreement") return W.letters.fee.agreement;
    var tmpl = fee.vat === "inclusive" ? W.letters.fee.inclusive : W.letters.fee.exclusive;
    return fmt(tmpl, { amount: groupNep(fee.amount), amountWords: amountWordsNep(fee.amount) });
  }
  function titleOf(W, aud) { return (aud && aud.title) || (W.defaults && W.defaults.auditorTitle) || "सी.ए."; }
  function auditorLetterHead(data, W, auditor, dateStr) {
    var out = headerBlock(data, W);
    out.push(P(fmt(W.letters.dateLine, { date: dateStr }), { align: "right", before: 120, after: 160 }));
    out.push(P(titleOf(W, auditor) + " " + auditor.name, { align: "left", after: 0 }));
    out.push(P(auditor.firm, { align: "left", after: 0 }));
    out.push(P(W.letters.firmLine2, { align: "left", after: 0 }));
    out.push(P(auditor.address || "", { align: "left", after: 160 }));
    return out;
  }
  function doc_c1(data, W) {
    var L = W.letters.c1, ch = chair(data), out = auditorLetterHead(data, W, data.auditors.next, data.dates.agm);
    out.push(subHead(L.subject), P(W.labels.madhoday, { align: "left" }));
    out.push(P(fmt(L.body, { company: data.company.name, agm: data.dates.agm, nextFy: data.fiscal.next }), {}));
    out.push(P(feeLine(W, data.fee && data.fee.c1), {}));
    out.push(P(L.close, {}));
    out.push(P(W.labels.bhabadiya, { align: "left", before: 120 }));
    out.push.apply(out, signature(ch.name, ch.role, data.company.name));
    return out;
  }
  function doc_c2(data, W) {
    var L = W.letters.c2, ch = chair(data), out = auditorLetterHead(data, W, data.auditors.cur, data.dates.sgm);
    out.push(subHead(L.subject), P(W.labels.madhoday, { align: "left" }));
    out.push(P(fmt(L.body, { company: data.company.name, fy: data.fiscal.current, prevFirm: data.auditors.prev.firm,
      prevTitle: titleOf(W, data.auditors.prev), prevAuditor: data.auditors.prev.name, reason: data.reasonPhrase, sgm: data.dates.sgm }), {}));
    out.push(P(feeLine(W, data.fee && data.fee.c2), {}));
    out.push(P(L.close, {}));
    out.push(P(W.labels.bhabadiya, { align: "left", before: 120 }));
    out.push.apply(out, signature(ch.name, ch.role, data.company.name));
    return out;
  }
  function doc_c3(data, W, which) {
    // acceptance of the C1 (next) or C2 (current) appointment
    var L = W.letters.c3, aud = which === "c2" ? data.auditors.cur : data.auditors.next;
    var fy = which === "c2" ? data.fiscal.current : data.fiscal.next;
    var letterDate = which === "c2" ? data.dates.sgm : data.dates.agm;
    var out = headerBlock(data, W);
    out.push(P(fmt(W.letters.dateLine, { date: addDays(letterDate, 1) }), { align: "right", before: 120, after: 160 }));
    out.push(P(L.to1, { align: "left", after: 0 }), P(data.company.name, { align: "left", after: 0 }), P(data.company.address || "", { align: "left", after: 160 }));
    out.push(subHead(L.subject), P(W.labels.madhoday, { align: "left" }));
    out.push(P(fmt(L.body, { letterDate: letterDate, fy: fy }), {}));
    out.push(P(W.labels.bhabadiya, { align: "left", before: 120 }));
    out.push.apply(out, signature(titleOf(W, aud) + " " + aud.name, aud.designation || "साझेदार", aud.firm));
    return out;
  }

  // ── assembly ──
  // Returns the ordered list of {id, title, children} to include, honouring
  // auditorChange, the acceptance checkbox and the per-document selection.
  function documentList(data, W) {
    var sel = data.docsSelected || {};
    var on = function (id) { return sel[id] !== false; };
    var list = [];
    if (data.auditorChange) {
      if (on("sgmBod")) list.push({ id: "sgmBod", children: doc_sgmBod(data, W) });
      if (on("sgm")) list.push({ id: "sgm", children: doc_sgm(data, W) });
      if (on("c2")) list.push({ id: "c2", children: doc_c2(data, W) });
      if (on("c3") && data.acceptance && data.acceptance.forC2) list.push({ id: "c3c2", children: doc_c3(data, W, "c2") });
    }
    if (on("bo")) list.push({ id: "bo", children: doc_bo(data, W) });
    if (on("agmBod")) list.push({ id: "agmBod", children: doc_agmBod(data, W) });
    if (on("agm")) list.push({ id: "agm", children: doc_agm(data, W) });
    if (on("c1")) list.push({ id: "c1", children: doc_c1(data, W) });
    if (on("c3") && data.acceptance && data.acceptance.forC1 !== false && data.acceptance.enabled) list.push({ id: "c3c1", children: doc_c3(data, W, "c1") });
    if (on("app50")) list.push({ id: "app50", children: doc_app50(data, W) });
    if (on("sec92")) list.push({ id: "sec92", children: doc_sec92(data, W) });
    if (on("sec51")) list.push({ id: "sec51", children: doc_sec51(data, W) });
    return list;
  }
  function sectionProps() { return { page: { size: { width: A4.width, height: A4.height } } }; }
  function buildCombined(data, W) {
    var list = documentList(data, W), children = [];
    list.forEach(function (d, i) { if (i > 0) children.push(PB()); d.children.forEach(function (p) { children.push(p); }); });
    return new Document({ sections: [{ properties: sectionProps(), children: children }] });
  }
  function buildSeparate(data, W) {
    return documentList(data, W).map(function (d) {
      return { id: d.id, doc: new Document({ sections: [{ properties: sectionProps(), children: d.children }] }) };
    });
  }

  // ── form helpers (shared with the browser; pure) ──
  function fyStartYear(fy) { var a = String(fy).replace(/[०-९]/g, function (c) { return nepNums.indexOf(c); }); var m = a.match(/(\d{4})/); return m ? +m[1] : null; }
  function fyLabel(startYear) { return toNep(startYear) + "/" + toNep(String(startYear + 1).slice(-3)); }
  function fyNext(fy) { var y = fyStartYear(fy); return y ? fyLabel(y + 1) : fy; }
  function calcAuthCapital(shares, faceValue) { return (parseInt(shares, 10) || 0) * (parseInt(faceValue, 10) || 0); }
  // Roll a saved client file forward one year (B7): both fiscal years +1, last
  // year's next-year auditor becomes this year's, previous = last year's current,
  // all dates cleared.
  function rollForward(state) {
    var ns = JSON.parse(JSON.stringify(state || {}));
    ns.fiscal = ns.fiscal || {};
    var oldNext = ns.fiscal.next;
    ns.fiscal.current = oldNext;
    ns.fiscal.next = fyNext(oldNext);
    ns.auditors = ns.auditors || {};
    ns.auditors.prev = ns.auditors.cur || ns.auditors.prev || {};
    ns.auditors.cur = ns.auditors.next || ns.auditors.cur || {};
    ns.dates = {};
    ns.auditorChange = false;
    return ns;
  }

  return {
    buildCombined: buildCombined, buildSeparate: buildSeparate, documentList: documentList,
    amountWordsNep: amountWordsNep, groupNep: groupNep, toNep: toNep, addDays: addDays, parseNepDate: parseNepDate,
    fyNext: fyNext, fyLabel: fyLabel, calcAuthCapital: calcAuthCapital, rollForward: rollForward,
    Packer: Packer,
  };
});
