/*
 * P.S.G. & Associates — OCR Docs: Initial Update set (first filing after registration).
 * Pure logic shared by the browser (assets/js/ocr-initial.js) and the Node tests/sample
 * generator. Four documents: cover letter, minutes of the first shareholders' meeting,
 * minutes of the auditor appointment meeting (optional) and the Section 184 statement.
 *
 * It matches the annual filing set in everything except the document wording: the docx
 * builders (A4, 1 inch margins, Mangal, sizes, spacing, tables, signature layout) come from
 * ocr-core.js (OCRCore), the BS calendar from common/psg-bsdate.js (PSGBSDate), and the shared
 * labels, table headers and default meeting time from the annual keys of data/ocr.yaml. Only
 * the four documents' wording is new (key "initial"). Text is Unicode in Mangal, like the
 * annual set (there is no Preeti conversion anywhere in OCR Docs).
 *
 * Each document is first described as a list of neutral blocks; the SAME blocks give the
 * Word file and the on-screen preview text, so the preview cannot differ from the output.
 *
 * UMD: window.OCRInitial in the browser (needs window.docx, PSGBSDate, OCRCore),
 * module.exports in Node.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("docx"), require("./common/psg-bsdate"), require("./ocr-core"));
  } else {
    root.OCRInitial = factory(root.docx, root.PSGBSDate, root.OCRCore);
  }
})(typeof self !== "undefined" ? self : this, function (docx, PSGBSDate, OCRCore) {
  "use strict";

  var Document = docx.Document, Paragraph = docx.Paragraph, TextRun = docx.TextRun, Table = docx.Table,
    TableRow = docx.TableRow, TableCell = docx.TableCell, WidthType = docx.WidthType, BorderStyle = docx.BorderStyle,
    TableLayoutType = docx.TableLayoutType, AlignmentType = docx.AlignmentType;
  var B = OCRCore.builders, toNep = OCRCore.toNep, possessive = OCRCore.possessive;

  // A4 with 1 inch margins (owner decision; the sample was Letter). Text width = 11906 - 2880 = 9026.
  var PAGE = { width: 11906, height: 16838 }, MARGIN = 1440, TEXT_W = 9026;
  var BS_MIN = 2000, BS_MAX = 2090; // range of the shared BS calendar (see HANDOFF.md)

  // ── dates (shared BS calendar) ──
  function toAscii(s) { return String(s == null ? "" : s).replace(/[०-९]/g, function (c) { return "०१२३४५६७८९".indexOf(c); }); }
  function pad2(n) { n = String(n); return n.length < 2 ? "0" + n : n; }
  // Strict BS date: four digit year, 1-12 month, a day that exists in that month.
  function parseDate(str) {
    var a = toAscii(str).trim();
    if (!a) return { empty: true };
    var m = a.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
    if (!m) return { error: "not a date in the form YYYY/MM/DD" };
    var y = +m[1], mo = +m[2], d = +m[3];
    if (y < BS_MIN || y > BS_MAX) return { error: "year " + y + " is outside the supported BS calendar (" + BS_MIN + " to " + BS_MAX + ")" };
    if (mo < 1 || mo > 12) return { error: "month " + mo + " does not exist" };
    var days = PSGBSDate.bsMonthDays(y, mo - 1);
    if (d < 1 || d > days) return { error: "day " + d + " does not exist in month " + mo + " of " + y + " (it has " + days + " days)" };
    return { y: y, mo: mo, d: d, key: y * 10000 + mo * 100 + d, text: toNep(y) + "/" + toNep(pad2(mo)) + "/" + toNep(pad2(d)) };
  }
  function dateText(str) { var p = parseDate(str); return p.text || ""; }
  function todayBS(nowMs) { var b = PSGBSDate.adUTCtoBS(nowMs == null ? Date.now() : nowMs); return b.y + "/" + pad2(b.m0 + 1) + "/" + pad2(b.day); }
  // ── small text helpers ──
  function fmt(s, v) { return String(s == null ? "" : s).replace(/\{(\w+)\}/g, function (m, k) { return v && v[k] != null ? v[k] : ""; }); }
  function tidy(s) { return String(s).replace(/\s{2,}/g, " ").trim(); }
  function digitsOnly(s) { return /^[0-9०-९]+$/.test(String(s || "").trim()); }
  function addressText(a, W) { return tidy(fmt(W.initial.address, { district: a.district, local: a.local, ward: toNep(toAscii(a.ward)) })); }

  // ── defaults ──
  // Fills every defaulted field (spec section 2). Pure: returns a new object. Meeting times are
  // free text exactly as in the annual set, defaulting to its SGM time. `today` is a BS date string
  // used for the letter date when none is given (the browser passes today's date).
  function normalise(input, W, today) {
    var D = W.initial.defaults, d = JSON.parse(JSON.stringify(input || {}));
    d.company = d.company || {}; d.address = d.address || {}; d.meeting1 = d.meeting1 || {}; d.meeting2 = d.meeting2 || {};
    d.auditor = d.auditor || {}; d.signer = d.signer || {};
    d.company.type = d.company.type || "private";
    d.founders = (d.founders || []).filter(function (f) { return f && String(f.name || "").trim(); }).map(function (f) {
      return { name: String(f.name).trim(), role: String(f.role || "").trim() || D.founderRole };
    });
    d.chairIndex = d.chairIndex >= 0 && d.chairIndex < d.founders.length ? d.chairIndex : 0;
    d.phones = (d.phones || []).map(function (p) { return String(p).trim(); }).filter(Boolean);
    d.fax = String(d.fax || "").trim() || D.fax;
    d.ocrOffice = String(d.ocrOffice || "").trim() || D.ocrOffice;
    var chair = d.founders[d.chairIndex];
    d.signer.name = String(d.signer.name || "").trim() || (chair ? chair.name : "");
    d.signer.designation = String(d.signer.designation || "").trim() || D.signerDesignation;
    d.meeting1.date = d.meeting1.date || d.company.regDate || "";
    d.meeting1.no = String(d.meeting1.no || "").trim() || D.meeting1No;
    d.meeting1.time = String(d.meeting1.time || "").trim() || W.defaults.times.sgm;
    d.auditor.include = d.auditor.include !== false;
    d.meeting2.date = d.meeting2.date || d.meeting1.date;
    d.meeting2.no = String(d.meeting2.no || "").trim() || D.meeting2No;
    d.meeting2.time = String(d.meeting2.time || "").trim() || W.defaults.times.sgm;
    d.auditor.title = String(d.auditor.title || "").trim();
    d.auditor.fy = String(d.auditor.fy || "").trim();
    d.auditor.fee = String(d.auditor.fee || "").trim() || D.fee;
    d.letterDate = d.letterDate || today || todayBS();
    d.docsSelected = d.docsSelected || {};
    return d;
  }
  // Honorific prefix, as the annual set does: "<title> " when a title is given, else "".
  function honor(aud) { var t = aud && aud.title ? String(aud.title).trim() : ""; return t ? t + " " : ""; }

  // ── validation (messages in the annual set's style: "X required.", "Missing date: x.") ──
  function validate(input, W, today) {
    var d = normalise(input, W, today), errors = [], warnings = [];
    function req(v, msg) { if (!String(v == null ? "" : v).trim()) errors.push(msg); }
    function date(v, label) {
      var p = parseDate(v);
      if (p.empty) { errors.push("Missing date: " + label + "."); return null; }
      if (p.error) { errors.push("Invalid date (" + label + "): " + p.error + "."); return null; }
      return p;
    }
    req(d.company.name, "Company name required.");
    if (!String(d.company.regNo || "").trim()) errors.push("Registration number required.");
    else if (!digitsOnly(d.company.regNo)) errors.push("Registration number must be digits only.");
    var reg = date(d.company.regDate, "registration date");
    req(d.address.district, "District required.");
    req(d.address.local, "Local level required.");
    if (!String(d.address.ward || "").trim()) errors.push("Ward number required.");
    else if (!digitsOnly(d.address.ward)) errors.push("Ward number must be digits only.");
    if (!d.phones.length) errors.push("Phone number required.");
    if (d.email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email) || /[^\x00-\x7F]/.test(d.email))) errors.push("Email must be a normal Latin-script address.");
    if (!d.founders.length) errors.push("Add at least one founder shareholder.");
    var m1 = date(d.meeting1.date, "meeting 1");
    var letter = date(d.letterDate, "letter date");
    var m2 = null;
    if (d.auditor.include) {
      m2 = date(d.meeting2.date, "auditor meeting");
      req(d.auditor.fy, "Current fiscal year required.");
      req(d.auditor.name, "Auditor name required.");
    }
    [["Meeting 1", m1], ["Auditor meeting", m2]].forEach(function (x) {
      if (!x[1]) return;
      if (reg && x[1].key < reg.key) warnings.push(x[0] + " date is earlier than the registration date.");
      if (letter && x[1].key > letter.key) warnings.push(x[0] + " date is later than the letter date.");
    });
    if (d.founders.length > 1) warnings.push("Several founders: the plural wording is new and needs review before it is used on a live file.");
    return { errors: errors, warnings: warnings, data: d };
  }

  // ── block model ──
  // Spacing is left to the annual builders' defaults (P: after 120, subHead: before 160 / after 80).
  function P(text, o) { return Object.assign({ k: "p", text: text }, o || {}); }
  function numberedList(items, vars) { return items.map(function (t, i) { return P(toNep(i + 1) + ". " + fmt(t, vars), { align: "left" }); }); }
  // Same signature block as the annual set: space, dotted line, name, designation, company.
  function signature(name, role, company) {
    return [P(".....................................", { align: "left", before: 900, after: 0 }),
      P(name, { align: "left", after: 0 }), P(role, { align: "left", after: 0 }), P(company, { align: "left" })];
  }
  function attendeeRows(d, m2) {
    return d.founders.map(function (f, i) {
      return [toNep(i + 1) + ".", f.name, m2 && i === d.chairIndex ? "अध्यक्ष" : f.role, ""];
    });
  }
  var ATT_WIDTHS = [900, 3400, 2200, 2800];

  function model(input, W, today) {
    var d = normalise(input, W, today), I = W.initial, c = d.company;
    var address = addressText(d.address, W), companyKo = possessive(c.name);
    var chair = d.founders[d.chairIndex] || { name: "" };
    var plural = d.founders.length > 1;
    var docs = [];

    // 1. Cover letter (laid out like the annual Section 50 application letter)
    var ocrLines = d.ocrOffice.split(/,\s*/);
    var line2 = ocrLines.shift() + (ocrLines.length ? "," : " ।");
    var cov = [
      P(fmt(W.letters.dateLine, { date: dateText(d.letterDate) }), { align: "right", before: 120 }),
      P(I.cover.to1, { align: "left", after: 0 }),
      P(line2, { align: "left", after: ocrLines.length ? 0 : 160 }),
    ];
    if (ocrLines.length) cov.push(P(ocrLines.join(", ") + " ।", { align: "left", after: 160 }));
    cov.push(
      { k: "sub", text: I.cover.subject },
      P(W.labels.madhoday, { align: "left" }),
      P(fmt(I.cover.body, { address: address })),
      { k: "sub", text: W.labels.tapsil });
    var encl = [I.cover.enclosures.decision, I.cover.enclosures.address];
    if (d.auditor.include) encl.push(I.cover.enclosures.auditor);
    encl.forEach(function (t, i) { cov.push(P(toNep(i + 1) + ") " + t, { align: "left", after: 60 })); });
    cov.push(P(I.cover.applicant, { align: "left", before: 160 }));
    signature(d.signer.name, d.signer.designation, c.name).forEach(function (b) { cov.push(b); });
    docs.push({ id: "cover", title: "Cover letter", blocks: cov });

    // 2. Minutes of the first shareholders' meeting
    var m1v = { date: dateText(d.meeting1.date), time: d.meeting1.time, company_ko: companyKo, address: address, founder: chair.name };
    // NEEDS REVIEW (Gaurav): plural founder wording is new, not in the sample. Single founder = sample wording.
    var intro1 = plural ? I.m1.introPlural : I.m1.introSingle;
    var dv = { company: c.name, reg_date: dateText(c.regDate), reg_no: toNep(toAscii(c.regNo)), address: address };
    var b1 = [
      P(fmt(I.meeting.no, { no: toNep(toAscii(d.meeting1.no)) }), { align: "left", underline: true }),
      { k: "h", text: I.meeting.title, size: 24, keepNext: true },
      P(tidy(fmt(intro1, m1v)), { review: plural }),
      { k: "sub", text: W.labels.attendanceColon },
      { k: "table", head: W.tables.attendance, rows: attendeeRows(d, false), widths: ATT_WIDTHS },
      { k: "sub", text: W.labels.proposals }].concat(numberedList(I.m1.proposals, {}));
    I.m1.decisions.forEach(function (t, i) {
      b1.push({ k: "sub", text: fmt(I.labels.decision, { n: toNep(i + 1) }) }, P(tidy(fmt(t, dv))));
    });
    docs.push({ id: "minutes1", title: "Minutes of the first shareholders' meeting", blocks: b1 });

    // 3. Minutes of the auditor appointment meeting
    if (d.auditor.include) {
      var m2v = { date: dateText(d.meeting2.date), time: d.meeting2.time, company_ko: companyKo, chairman: chair.name, address: address };
      var fy = toNep(toAscii(d.auditor.fy));
      var b2 = [
        P(fmt(I.meeting.no, { no: toNep(toAscii(d.meeting2.no)) }), { align: "left", underline: true }),
        { k: "h", text: I.meeting.title, size: 24, keepNext: true },
        P(tidy(fmt(I.m2.intro, m2v))),
        { k: "sub", text: W.labels.attendanceColon },
        { k: "table", head: W.tables.attendance, rows: attendeeRows(d, true), widths: ATT_WIDTHS },
        { k: "sub", text: W.labels.proposals }].concat(numberedList(I.m2.proposals, { fy: fy }));
      I.m2.decisions.forEach(function (t, i) {
        b2.push({ k: "sub", text: fmt(I.labels.decision, { n: toNep(i + 1) }) }, P(tidy(fmt(t, { fy: fy, auditor: honor(d.auditor) + d.auditor.name, fee: d.auditor.fee }))));
      });
      docs.push({ id: "minutes2", title: "Minutes of the auditor appointment meeting", blocks: b2 });
    }

    // 4. Section 184 statement
    var S = I.s184;
    docs.push({ id: "section184", title: "Section 184 statement", blocks: [
      { k: "h", text: fmt(S.title1, { company_ko: companyKo }), size: 24, after: 40 },
      { k: "h", text: S.title2, size: 24, bold: false, before: 0, after: 40 },
      { k: "h", text: S.title3, size: 24, bold: false, before: 0 },
      P(S.body),
      { k: "h", text: W.labels.tapsil, size: 24, before: 160 },
      P(S.sofar, { align: "left" }),
      P(fmt(S.address, { address: address }), { align: "left", after: 0 }),
      P(fmt(S.phone, { phones: d.phones.map(toNep).join(", ") }), { align: "left", after: 0 }),
      P(fmt(S.fax, { fax: toNep(d.fax) }), { align: "left", after: 0 }),
      P(S.email.replace("{email}", "").replace(/\s+$/, " "), { align: "left", after: 900, latin: d.email }),
      { k: "sig", left: [
          { label: S.certifier, bold: true, after: 120 },
          { label: S.name, value: d.signer.name },
          { label: S.rank, value: d.signer.designation },
          { label: S.date, value: dateText(d.letterDate) },
          { label: S.sign, value: S.dots }],
        right: S.stamp },
    ] });

    // the document choices of the annual set: any document can be switched off
    docs = docs.filter(function (x) { return d.docsSelected[x.id] !== false; });
    return { data: d, docs: docs, plural: plural };
  }

  // ── block -> plain text (tests) ──
  function blockLines(b) {
    if (b.k === "table") return [b.head.join(" | ")].concat(b.rows.map(function (r) { return r.join(" | "); }));
    if (b.k === "sig") return b.left.map(function (x) { return x.value != null ? x.label + " : " + x.value : x.label; }).concat([b.right]);
    if (b.k === "p") return [b.text + (b.latin || "")];
    return [b.text];
  }
  function docLines(doc) { return doc.blocks.reduce(function (a, b) { return a.concat(blockLines(b)); }, []); }

  // ── block -> Word ──
  function run(text, o) { o = o || {}; return new TextRun({ text: text, bold: !!o.bold, size: o.size || 22, font: o.font || B.F }); }
  function para(runs, o) {
    o = o || {};
    return new Paragraph({ alignment: B.AL[o.align || "left"], pageBreakBefore: o.pageBreakBefore ? true : undefined,
      spacing: { before: o.before || 0, after: o.after != null ? o.after : 120, line: 276 }, children: runs });
  }
  var NONE = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  var NOBORDERS = { top: NONE, bottom: NONE, left: NONE, right: NONE };
  function sigTable(b) {
    var left = b.left.map(function (x) {
      var runs = x.value != null ? [run(x.label, { bold: true }), run(" : " + x.value)] : [run(x.label, { bold: true })];
      return para(runs, { after: x.after != null ? x.after : 40 });
    });
    function cell(children, w) { return new TableCell({ borders: NOBORDERS, width: { size: w, type: WidthType.DXA }, children: children }); }
    return new Table({
      width: { size: TEXT_W, type: WidthType.DXA }, layout: TableLayoutType.FIXED, columnWidths: [5800, 3226],
      rows: [new TableRow({ children: [cell(left, 5800), cell([para([run(b.right)], { align: "center" })], 3226)] })],
    });
  }
  function renderBlock(b, first, brk) {
    var pb = first && brk;
    if (b.k === "p") {
      if (b.latin != null && b.latin !== "") {
        return para([run(b.text), run(b.latin, { font: "Arial" })], { align: b.align, after: b.after, pageBreakBefore: pb });
      }
      return B.P(b.text, { align: b.align, bold: b.bold, underline: b.underline, before: b.before, after: b.after, pageBreakBefore: pb });
    }
    if (b.k === "h") return B.heading(b.text, { size: b.size, bold: b.bold, before: b.before, after: b.after, keepNext: true, pageBreakBefore: pb });
    if (b.k === "sub") return B.subHead(b.text, { keepNext: true, pageBreakBefore: pb });
    if (b.k === "table") {
      return B.autoTable(b.head.map(function (h, i) { return B.TC(h, { header: true, center: i === 0, w: i === 3 ? b.widths[3] : undefined }); }),
        b.rows.map(function (r) { return r.map(function (t, i) { return B.TC(t, { center: i === 0, w: i === 3 ? b.widths[3] : undefined }); }); }),
        { rowMin: 480, columnWidths: b.widths });
    }
    if (b.k === "sig") return sigTable(b);
    throw new Error("Unknown block " + b.k);
  }
  function docChildren(doc, brk) {
    return doc.blocks.map(function (b, i) { return renderBlock(b, i === 0, brk); });
  }
  // A4, default 1 inch margins: the same page as the annual set.
  function section(children) {
    return { properties: { page: { size: { width: PAGE.width, height: PAGE.height }, margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } } }, children: children };
  }
  // One Word file: every document after the first starts on a new page (pageBreakBefore on its
  // first paragraph, so there is never a blank page and no stray break paragraph).
  function buildCombined(input, W, today) {
    var children = [];
    model(input, W, today).docs.forEach(function (doc, i) { docChildren(doc, i > 0).forEach(function (x) { children.push(x); }); });
    return new Document({ sections: [section(children)] });
  }
  function buildSeparate(input, W, today) {
    return model(input, W, today).docs.map(function (doc) {
      return { id: doc.id, title: doc.title, doc: new Document({ sections: [section(docChildren(doc, false))] }) };
    });
  }

  return {
    parseDate: parseDate, dateText: dateText, todayBS: todayBS, addressText: addressText, honor: honor,
    normalise: normalise, validate: validate, model: model, docLines: docLines,
    buildCombined: buildCombined, buildSeparate: buildSeparate, Packer: OCRCore.Packer,
    PAGE: PAGE, BS_MIN: BS_MIN, BS_MAX: BS_MAX,
  };
});
