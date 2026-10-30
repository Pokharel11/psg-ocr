/*
 * P.S.G. & Associates — OCR Docs: Initial Update set (first filing after registration).
 * Pure logic shared by the browser (assets/js/ocr-initial.js) and the Node tests/sample
 * generator. Four documents: cover letter, minutes of the first shareholders' meeting,
 * minutes of the auditor appointment meeting (optional) and the Section 184 statement.
 *
 * It reuses, and does not duplicate, what the annual filing set already has: the docx
 * builders and the company-name possessive from ocr-core.js (OCRCore), the BS calendar
 * from common/psg-bsdate.js (PSGBSDate) and the Nepali wording file data/ocr.yaml
 * (key "initial"). Text is Unicode in Mangal, exactly like the annual set (there is no
 * Preeti conversion anywhere in OCR Docs, and none is added here).
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
  // First financial year = the Nepali fiscal year (Shrawan to Ashadh) holding the registration date.
  // Shrawan is month 4: months 4-12 belong to year Y, months 1-3 to Y-1. Short form 2083/84, in Devanagari.
  function financialYear(regDate) {
    var p = parseDate(regDate);
    if (!p.y) return "";
    var start = p.mo >= 4 ? p.y : p.y - 1;
    return toNep(start) + "/" + toNep(String(start + 1).slice(-2));
  }

  // ── small text helpers ──
  function fmt(s, v) { return String(s == null ? "" : s).replace(/\{(\w+)\}/g, function (m, k) { return v && v[k] != null ? v[k] : ""; }); }
  function tidy(s) { return String(s).replace(/\s{2,}/g, " ").trim(); }
  function digitsOnly(s) { return /^[0-9०-९]+$/.test(String(s || "").trim()); }
  function timeText(t) {
    if (!t || t.hour === "" || t.hour == null) return "";
    var h = parseInt(toAscii(t.hour), 10), mi = t.minute === "" || t.minute == null ? 0 : parseInt(toAscii(t.minute), 10);
    var clock = toNep(h) + (mi ? ":" + toNep(pad2(mi)) : "");
    return tidy((t.part || "") + " " + clock + " बजे");
  }
  function addressText(a, W) { return tidy(fmt(W.initial.address, { district: a.district, local: a.local, ward: toNep(toAscii(a.ward)) })); }

  // ── defaults ──
  // Fills every defaulted field (spec section 2). Pure: returns a new object. `today` is a BS date
  // string used for the letter date when none is given (the browser passes today's date).
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
    var chairName = chair ? chair.name : "";
    d.signer.name = String(d.signer.name || "").trim() || chairName;
    d.signer.designation = String(d.signer.designation || "").trim() || D.signerDesignation;
    d.meeting1.date = d.meeting1.date || d.company.regDate || "";
    d.meeting1.no = String(d.meeting1.no || "").trim() || D.meeting1No;
    d.auditor.include = d.auditor.include !== false;
    d.meeting2.date = d.meeting2.date || d.meeting1.date;
    d.meeting2.no = String(d.meeting2.no || "").trim() || D.meeting2No;
    d.auditor.fy = String(d.auditor.fy || "").trim() || financialYear(d.company.regDate);
    d.auditor.fee = String(d.auditor.fee || "").trim() || D.fee;
    d.letterDate = d.letterDate || today || todayBS();
    return d;
  }

  // ── validation ──
  function validate(input, W, today) {
    var d = normalise(input, W, today), errors = [], warnings = [];
    function req(v, msg) { if (!String(v == null ? "" : v).trim()) errors.push(msg); }
    function date(v, label) {
      var p = parseDate(v);
      if (p.empty) { errors.push(label + " is required."); return null; }
      if (p.error) { errors.push(label + ": " + p.error + "."); return null; }
      return p;
    }
    req(d.company.name, "Company name is required.");
    if (!String(d.company.regNo || "").trim()) errors.push("Registration number is required.");
    else if (!digitsOnly(d.company.regNo)) errors.push("Registration number must be digits only.");
    var reg = date(d.company.regDate, "Registration date");
    req(d.address.district, "District is required.");
    req(d.address.local, "Local level (municipality) is required.");
    if (!String(d.address.ward || "").trim()) errors.push("Ward number is required.");
    else if (!digitsOnly(d.address.ward)) errors.push("Ward number must be digits only.");
    if (!d.phones.length) errors.push("Enter at least one phone number.");
    if (d.email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email) || /[^\x00-\x7F]/.test(d.email))) errors.push("Email must be a normal Latin-script address.");
    if (!d.email) warnings.push("No email entered: the Section 184 statement will show an empty email line.");
    if (!d.founders.length) errors.push("Add at least one founder shareholder.");
    var m1 = date(d.meeting1.date, "Meeting 1 date");
    var letter = date(d.letterDate, "Letter date");
    var m2 = null;
    if (d.auditor.include) {
      m2 = date(d.meeting2.date, "Auditor meeting date");
      req(d.auditor.name, "Auditor name is required when the auditor appointment is included.");
      if (reg && !d.auditor.fy) errors.push("Financial year is required.");
    }
    [["Meeting 1", m1], ["Auditor meeting", m2]].forEach(function (x) {
      if (!x[1]) return;
      if (reg && x[1].key < reg.key) warnings.push(x[0] + " date is earlier than the registration date.");
      if (letter && x[1].key > letter.key) warnings.push(x[0] + " date is later than the letter date.");
    });
    [["Meeting 1", d.meeting1], ["Auditor meeting", d.auditor.include ? d.meeting2 : null]].forEach(function (x) {
      var t = x[1] && x[1].time;
      if (!t || t.hour === "" || t.hour == null) return;
      var h = parseInt(toAscii(t.hour), 10);
      if (isNaN(h) || h < 1 || h > 12) errors.push(x[0] + " start hour must be 1 to 12.");
      if (t.minute !== "" && t.minute != null) { var mi = parseInt(toAscii(t.minute), 10); if (isNaN(mi) || mi < 0 || mi > 59) errors.push(x[0] + " start minute must be 0 to 59."); }
    });
    if (d.founders.length > 1) warnings.push("Several founders: the plural wording is new and needs review before it is used on a live file.");
    return { errors: errors, warnings: warnings, data: d };
  }

  // ── block model ──
  function P(text, o) { return Object.assign({ k: "p", text: text }, o || {}); }
  function numberedList(items, vars) { return items.map(function (t, i) { return P(toNep(i + 1) + ". " + fmt(t, vars), { align: "left", after: 60 }); }); }

  function attendeeRows(d, m2) {
    return d.founders.map(function (f, i) {
      return [toNep(i + 1), f.name, m2 && i === d.chairIndex ? "अध्यक्ष" : f.role, ""];
    });
  }

  function model(input, W, today) {
    var d = normalise(input, W, today), I = W.initial, L = I.labels, c = d.company;
    var address = addressText(d.address, W), companyKo = possessive(c.name);
    var chair = d.founders[d.chairIndex] || { name: "" };
    var plural = d.founders.length > 1;
    var docs = [];

    // 1. Cover letter
    var ocrLines = d.ocrOffice.split(/,\s*/);
    var line2 = ocrLines.shift() + (ocrLines.length ? "," : " ।");
    var cov = [
      P(fmt(L.date, { date: dateText(d.letterDate) }), { align: "left", after: 280 }),
      P(I.cover.to1, { align: "left", after: 0 }),
      P(line2, { align: "left", after: ocrLines.length ? 0 : 280 }),
    ];
    if (ocrLines.length) cov.push(P(ocrLines.join(", ") + " ।", { align: "left", after: 280 }));
    cov.push(
      P(I.cover.subject, { align: "left", bold: true, after: 200 }),
      P(I.cover.salute, { align: "left", after: 80 }),
      P(fmt(I.cover.body, { address: address }), { after: 200 }),
      P(I.cover.tapsil, { align: "left", after: 80 }));
    var encl = [I.cover.enclosures.decision, I.cover.enclosures.address];
    if (d.auditor.include) encl.push(I.cover.enclosures.auditor);
    encl.forEach(function (t, i) { cov.push(P(toNep(i + 1) + ") " + t, { align: "left", after: i === encl.length - 1 ? 280 : 0 })); });
    cov.push(
      P(I.cover.applicant, { align: "left", after: 800 }),
      P(c.name, { align: "left", after: 120 }),
      P(d.signer.name, { align: "left", after: 120 }),
      P(d.signer.designation, { align: "left", after: 800 }),
      P(I.cover.dots, { align: "left", after: 0 }));
    docs.push({ id: "cover", title: "Cover letter", blocks: cov });

    // 2. Minutes of the first shareholders' meeting
    var t1 = timeText(d.meeting1.time);
    var m1v = { date: dateText(d.meeting1.date), time: t1, company_ko: companyKo, address: address, founder: chair.name };
    // NEEDS REVIEW (Gaurav): plural founder wording is new, not in the sample. Single founder = sample wording.
    var intro1 = plural ? I.m1.introPlural : I.m1.introSingle;
    var dv = { company: c.name, reg_date: dateText(c.regDate), reg_no: toNep(toAscii(c.regNo)), address: address };
    var b1 = [
      P(fmt(I.meeting.no, { no: toNep(toAscii(d.meeting1.no)) }), { align: "left", underline: true, after: 280 }),
      { k: "h", text: I.meeting.title, size: 28, after: 200, keepNext: true },
      P(tidy(fmt(intro1, m1v)), { after: 200, review: plural }),
      { k: "sub", text: L.attendance1 },
      { k: "table", head: L.table, rows: attendeeRows(d, false), widths: [900, 3500, 2100, 2526] },
      P("", { after: 360 }),
      { k: "sub", text: L.proposals }].concat(numberedList(I.m1.proposals, {}));
    I.m1.decisions.forEach(function (t, i) {
      b1.push({ k: "sub", text: fmt(L.decision, { n: toNep(i + 1) }) }, P(tidy(fmt(t, dv)), { after: 200 }));
    });
    docs.push({ id: "minutes1", title: "Minutes of the first shareholders' meeting", blocks: b1 });

    // 3. Minutes of the auditor appointment meeting
    if (d.auditor.include) {
      var m2v = { date: dateText(d.meeting2.date), time: timeText(d.meeting2.time), company_ko: companyKo, chairman: chair.name, address: address };
      var fy = d.auditor.fy;
      var b2 = [
        P(fmt(I.meeting.no, { no: toNep(toAscii(d.meeting2.no)) }), { align: "left", underline: true, after: 280 }),
        { k: "h", text: I.meeting.title, size: 28, after: 200, keepNext: true },
        P(tidy(fmt(I.m2.intro, m2v)), { after: 200 }),
        { k: "sub", text: L.attendance2 },
        { k: "table", head: L.table, rows: attendeeRows(d, true), widths: [900, 3500, 2100, 2526] },
        P("", { after: 360 }),
        { k: "sub", text: L.proposals }].concat(numberedList(I.m2.proposals, { fy: fy }));
      I.m2.decisions.forEach(function (t, i) {
        b2.push({ k: "sub", text: fmt(L.decision, { n: toNep(i + 1) }) }, P(tidy(fmt(t, { fy: fy, auditor: d.auditor.name, fee: d.auditor.fee })), { after: 200 }));
      });
      docs.push({ id: "minutes2", title: "Minutes of the auditor appointment meeting", blocks: b2 });
    }

    // 4. Section 184 statement
    var S = I.s184;
    docs.push({ id: "section184", title: "Section 184 statement", blocks: [
      { k: "h", text: fmt(S.title1, { company_ko: companyKo }), size: 32, before: 360, after: 0 },
      { k: "h", text: S.title2, bold: false, size: 28, before: 0, after: 0 },
      { k: "h", text: S.title3, bold: false, size: 28, before: 0, after: 360 },
      P(S.body, { after: 280 }),
      { k: "h", text: S.tapsil, size: 24, before: 0, after: 200 },
      P(S.sofar, { align: "left", after: 120 }),
      P(fmt(S.address, { address: address }), { align: "left", after: 0 }),
      P(fmt(S.phone, { phones: d.phones.map(toNep).join(", ") }), { align: "left", after: 0 }),
      P(fmt(S.fax, { fax: toNep(d.fax) }), { align: "left", after: 0 }),
      P(S.email.replace("{email}", "").replace(/\s+$/, " "), { align: "left", after: 800, latin: d.email }),
      { k: "sig", left: [
          { label: S.certifier, bold: true, after: 120 },
          { label: S.name, value: d.signer.name },
          { label: S.rank, value: d.signer.designation },
          { label: S.date, value: dateText(d.letterDate) },
          { label: S.sign, value: S.dots }],
        right: S.stamp },
    ] });

    return { data: d, docs: docs, plural: plural };
  }

  // ── block -> plain text (preview and tests) ──
  function blockLines(b) {
    if (b.k === "table") return [b.head.join(" | ")].concat(b.rows.map(function (r) { return r.join(" | "); }));
    if (b.k === "sig") return b.left.map(function (x) { return x.value != null ? x.label + " : " + x.value : x.label; }).concat([b.right]);
    if (b.k === "p") return [b.text + (b.latin || "")];
    return [b.text];
  }
  function docLines(doc) { return doc.blocks.reduce(function (a, b) { return a.concat(blockLines(b)); }, []); }
  // Preview: the same blocks, with the kind of each line so the page can style headings and flag review.
  function preview(input, W, today) {
    var m = model(input, W, today);
    return {
      plural: m.plural,
      docs: m.docs.map(function (doc) {
        return { id: doc.id, title: doc.title, blocks: doc.blocks.map(function (b) {
          return { kind: b.k, bold: !!b.bold || b.k === "h" || b.k === "sub", review: !!b.review, lines: blockLines(b) };
        }) };
      }),
    };
  }

  // ── block -> Word ──
  function run(text, o) { o = o || {}; return new TextRun({ text: text, bold: !!o.bold, size: o.size || 22, font: o.font || B.F, underline: o.underline ? {} : undefined }); }
  function para(runs, o) {
    o = o || {};
    return new Paragraph({ alignment: B.AL[o.align || "left"], keepNext: o.keepNext ? true : undefined, pageBreakBefore: o.pageBreakBefore ? true : undefined,
      spacing: { before: o.before || 0, after: o.after != null ? o.after : 120, line: 276 }, children: runs });
  }
  var NONE = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  var NOBORDERS = { top: NONE, bottom: NONE, left: NONE, right: NONE };
  function sigTable(b) {
    var left = b.left.map(function (x, i) {
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
      return B.P(b.text, { align: b.align, bold: b.bold, underline: b.underline, before: b.before, after: b.after, keepNext: b.keepNext, pageBreakBefore: pb });
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
    parseDate: parseDate, dateText: dateText, todayBS: todayBS, financialYear: financialYear, timeText: timeText,
    addressText: addressText, normalise: normalise, validate: validate, model: model, docLines: docLines, preview: preview,
    buildCombined: buildCombined, buildSeparate: buildSeparate, Packer: OCRCore.Packer,
    PAGE: PAGE, BS_MIN: BS_MIN, BS_MAX: BS_MAX,
  };
});
