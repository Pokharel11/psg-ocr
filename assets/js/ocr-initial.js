/* P.S.G. & Associates — OCR Docs > Initial Update (portal tool module).
   The form/UX layer. Documents are built by assets/js/ocr-initial-core.js (OCRInitial)
   from the Nepali wording in data/ocr.yaml (key "initial"). Everything runs in the
   browser; nothing is uploaded or stored. All ids prefixed "oiu-". */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById("oiu-" + id); };
  var W = null, started = false;

  function val(id) { var e = $(id); return e ? e.value.trim() : ""; }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function opt(sel, v, t) { var o = document.createElement("option"); o.value = v; o.textContent = t == null ? v : t; sel.appendChild(o); }
  function msg(errs, warns) {
    $("msgs").innerHTML = (errs || []).map(function (x) { return '<div class="msg-err">' + esc(x) + "</div>"; })
      .concat((warns || []).map(function (x) { return '<div class="msg-warn">' + esc(x) + "</div>"; })).join("");
  }

  function load() {
    fetch("data/ocr.yaml").then(function (r) { return r.text(); }).then(function (txt) {
      W = jsyaml.load(txt);
      build();
    }).catch(function () { $("globalMsgs").innerHTML = '<div class="msg-err">Could not load the wording file (data/ocr.yaml).</div>'; });
  }

  // ── repeating rows ──
  function addPhone(v) {
    var d = document.createElement("div"); d.className = "mini-row"; d.setAttribute("data-phone", "");
    d.innerHTML = '<input type="text" class="np" data-f="phone" placeholder="९८०००००००१" inputmode="tel"> <button type="button" class="remove-btn" data-remove title="Remove">&times;</button>';
    if (v) d.querySelector("input").value = v;
    $("phones").appendChild(d);
  }
  function addFounder(v) {
    var d = document.createElement("div"); d.className = "director-block"; d.setAttribute("data-founder", "");
    d.innerHTML = '<button type="button" class="remove-btn" data-remove title="Remove">&times;</button><div class="field-grid">' +
      '<div class="field-group"><label>Full name (नेपाली)</label><input class="np" data-f="name" placeholder="राम बहादुर थापा"></div>' +
      '<div class="field-group"><label>Role</label><input class="np" data-f="role"></div></div>';
    d.querySelector('[data-f="role"]').value = (v && v.role) || W.initial.defaults.founderRole;
    if (v) d.querySelector('[data-f="name"]').value = v.name || "";
    $("founders").appendChild(d);
  }
  function founders() {
    return Array.prototype.map.call($("founders").querySelectorAll("[data-founder]"), function (b) {
      return { name: b.querySelector('[data-f="name"]').value.trim(), role: b.querySelector('[data-f="role"]').value.trim() };
    }).filter(function (f) { return f.name; });
  }
  function refreshChair() {
    var sel = $("chair"), cur = sel.value; sel.innerHTML = "";
    founders().forEach(function (f, i) { opt(sel, i, f.name); });
    if (cur && sel.querySelector('option[value="' + cur + '"]')) sel.value = cur;
  }

  function collect() {
    var phones = Array.prototype.map.call($("phones").querySelectorAll('[data-f="phone"]'), function (i) { return i.value.trim(); }).filter(Boolean);
    function time(p) { return { part: val(p + "Part"), hour: val(p + "Hour"), minute: val(p + "Min") }; }
    return {
      company: { name: val("companyName"), type: $("companyType").value, regNo: val("regNo"), regDate: val("regDate") },
      address: { district: val("district"), local: val("local"), ward: val("ward") },
      phones: phones, fax: val("fax"), email: val("email"), ocrOffice: val("ocrOffice"),
      founders: founders(), chairIndex: +($("chair").value || 0),
      signer: { name: val("signerName"), designation: val("signerDesignation") },
      meeting1: { date: val("m1Date"), time: time("m1"), no: val("m1No") },
      meeting2: { date: val("m2Date"), time: time("m2"), no: val("m2No") },
      letterDate: val("letterDate"),
      auditor: { include: $("auditInclude").checked, name: val("auditorName"), fy: val("fy"), fee: val("fee") },
    };
  }

  // ── preview: the same blocks as the Word file ──
  function renderPreview(data) {
    var pv = OCRInitial.preview(data, W), html = "";
    if (pv.plural) html += '<div class="banner">Needs review: several founders. The plural wording (meeting 1 opening line, marked below) is new and not in the sample. Gaurav to approve before it is used on a live file.</div>';
    pv.docs.forEach(function (doc) {
      html += '<div class="section-card" style="font-family:\'Noto Sans Devanagari\',Mangal,sans-serif;"><div class="section-card-title">' + esc(doc.title) + "</div>";
      doc.blocks.forEach(function (b) {
        if (b.kind === "table") { html += '<table style="border-collapse:collapse;width:100%;margin:6px 0;">' + b.lines.map(function (l, i) { return "<tr>" + l.split(" | ").map(function (c) { return '<td style="border:1px solid #444;padding:4px 8px;' + (i === 0 ? "font-weight:700;" : "") + '">' + esc(c) + "</td>"; }).join("") + "</tr>"; }).join("") + "</table>"; return; }
        b.lines.forEach(function (l) {
          html += '<p style="margin:4px 0;' + (b.bold ? "font-weight:700;" : "") + (b.review ? "background:#fff7e6;border-left:3px solid #b8860b;padding:2px 6px;" : "") + '">' + (esc(l) || "&nbsp;") + (b.review ? ' <span style="font-family:var(--body);font-size:.75rem;color:#8a6410;">[needs review: plural wording]</span>' : "") + "</p>";
        });
      });
      html += "</div>";
    });
    $("preview").innerHTML = html;
  }

  function check() {
    var res = OCRInitial.validate(collect(), W, OCRInitial.todayBS());
    msg(res.errors, res.warnings);
    return res;
  }

  function download(bytes, name, mime) {
    var blob = bytes instanceof Blob ? bytes : new Blob([bytes], { type: mime || "application/octet-stream" });
    var a = document.createElement("a"), url = URL.createObjectURL(blob);
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
  }
  var FILES = { cover: "1_Cover_letter", minutes1: "2_Minutes_meeting_1", minutes2: "3_Minutes_auditor_meeting", section184: "4_Section_184_statement" };
  function baseName() { return (val("companyName") || "Initial_Update").replace(/[^\wऀ-ॿ]+/g, "_"); }

  function generate(kind) {
    var res = check();
    if (res.errors.length) return;
    var data = collect();
    try {
      if (kind === "zip") {
        var sep = OCRInitial.buildSeparate(data, W, OCRInitial.todayBS()), zip = new PizZip(), i = 0;
        (function next() {
          if (i >= sep.length) { download(zip.generate({ type: "uint8array" }), baseName() + "_Initial_Update.zip", "application/zip"); return; }
          OCRInitial.Packer.toBlob(sep[i].doc).then(function (blob) { return blob.arrayBuffer(); }).then(function (ab) { zip.file(FILES[sep[i].id] + ".docx", ab); i++; next(); });
        })();
      } else {
        OCRInitial.Packer.toBlob(OCRInitial.buildCombined(data, W, OCRInitial.todayBS())).then(function (blob) { download(blob, baseName() + "_Initial_Update.docx"); });
      }
      renderPreview(data);
    } catch (e) { msg(["Could not build the documents: " + (e && e.message ? e.message : e)]); }
  }

  function toggleAudit() { $("auditWrap").hidden = !$("auditInclude").checked; }

  function build() {
    var D = W.initial.defaults;
    $("verifyBanner").hidden = W.meta && W.meta.verified === true;
    ["m1Part", "m2Part"].forEach(function (id) { var s = $(id); opt(s, "", "(no part of day)"); W.initial.dayParts.forEach(function (p) { opt(s, p, p); }); });
    $("ocrOffice").value = D.ocrOffice; $("fee").value = D.fee; $("m1No").value = D.meeting1No; $("m2No").value = D.meeting2No;
    $("letterDate").value = OCRInitial.todayBS();
    var as = $("auditorSel"); opt(as, "", "Other (type below)");
    ((W.firm && W.firm.partners) || []).forEach(function (p) { opt(as, (p.title ? p.title + " " : "") + p.name, (p.title ? p.title + " " : "") + p.name); });
    as.addEventListener("change", function () { if (as.value) $("auditorName").value = as.value; });
    if (as.options.length > 1) { as.selectedIndex = 1; $("auditorName").value = as.value; }
    addPhone(); addFounder();

    // financial year follows the registration date until the user edits it
    var fyAuto = true;
    $("fy").addEventListener("input", function () { fyAuto = false; });
    $("regDate").addEventListener("input", function () { if (fyAuto) $("fy").value = OCRInitial.financialYear($("regDate").value); });

    document.addEventListener("click", function (e) {
      var rm = e.target.closest("#oiu-form [data-remove]");
      if (rm) { var b = rm.closest("[data-phone],[data-founder]"); if (b) { b.remove(); refreshChair(); } }
    });
    $("form").addEventListener("input", function (e) { if (e.target.matches('[data-f="name"]')) refreshChair(); });
    $("form").addEventListener("change", function (e) { if (e.target.matches('[data-f="name"]')) refreshChair(); });
    $("addPhone").addEventListener("click", function () { addPhone(); });
    $("addFounder").addEventListener("click", function () { addFounder(); });
    $("auditInclude").addEventListener("change", toggleAudit);
    $("genCombined").addEventListener("click", function () { generate("combined"); });
    $("genZip").addEventListener("click", function () { generate("zip"); });
    $("showPreview").addEventListener("click", function () { var r = check(); if (!r.errors.length) renderPreview(collect()); });
    toggleAudit();
  }

  window.PortalTools = window.PortalTools || {};
  window.PortalTools["ocr-initial"] = { init: function () { if (started) return; started = true; load(); } };
})();
