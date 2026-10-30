/* P.S.G. & Associates — OCR Docs > Initial Update (portal tool module).
   The form/UX layer, built the same way as assets/js/app.js (OCR Automation): five steps,
   the same fiscal-year dropdown, date and time inputs, validation messages, document choices,
   output choice and download names. Documents are built by assets/js/ocr-initial-core.js
   (OCRInitial) from the Nepali wording in data/ocr.yaml. Everything runs in the browser;
   nothing is uploaded or stored. All ids prefixed "oiu-". */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById("oiu-" + id); };
  var W = null, started = false, step = 0;

  // ── small helpers (same as app.js) ──
  function nepDigits(s) { return String(s).replace(/[0-9]/g, function (d) { return "०१२३४५६७८९"[+d]; }); }
  function val(id) { var e = $(id); return e ? e.value.trim() : ""; }
  function radio(name) { var e = document.querySelector('input[name="oiu-' + name + '"]:checked'); return e ? e.value : null; }
  function msg(box, errs, warns) {
    $(box).innerHTML = (errs || []).map(function (x) { return '<div class="msg-err">' + x + "</div>"; })
      .concat((warns || []).map(function (x) { return '<div class="msg-warn">' + x + "</div>"; })).join("");
  }
  function opt(sel, v, t) { var o = document.createElement("option"); o.value = v; o.textContent = t || v; sel.appendChild(o); }

  function load() {
    fetch("data/ocr.yaml").then(function (r) { return r.text(); }).then(function (txt) {
      W = jsyaml.load(txt);
      build();
    }).catch(function () { msg("globalMsgs", ["Could not load the OCR wording file (data/ocr.yaml)."]); });
  }

  // ── repeating rows ──
  function addPhone(v) {
    var d = document.createElement("div"); d.className = "mini-row"; d.setAttribute("data-phone", "");
    d.innerHTML = '<input type="text" class="np dig" data-f="phone" placeholder="९८०००००००१"> <button type="button" class="remove-btn" data-oiu-remove>&times;</button>';
    if (v) d.querySelector("input").value = v;
    $("phones").appendChild(d);
  }
  function addFounder(v) {
    var d = document.createElement("div"); d.className = "director-block"; d.setAttribute("data-founder", "");
    d.innerHTML = '<button type="button" class="remove-btn" data-oiu-remove>&times;</button>' +
      '<div class="reorder"><button type="button" data-oiu-up title="Move up">▲</button><button type="button" data-oiu-down title="Move down">▼</button></div>' +
      '<div class="field-grid">' +
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

  // ── fiscal year dropdown (same options and default as OCR Automation) ──
  function buildFY() {
    var sel = $("fy"); sel.innerHTML = "";
    for (var y = 2089; y >= 2060; y--) opt(sel, OCRCore.fyLabel(y), OCRCore.fyLabel(y));
    sel.value = OCRCore.fyLabel(Math.min(2089, Math.max(2060, OCRInitial.currentFYStart())));
  }

  // Auditor firm selector (same as OCR Automation: PSG auto-fills the partner and title).
  function setupFirmSelector() {
    var fsel = $("curFirmSel"), psel = $("curPartner"), wrap = $("partnerWrap");
    fsel.innerHTML = ""; opt(fsel, "psg", (W.firm && W.firm.name) || "पी.एस.जी. एण्ड एसोसिएट्स"); opt(fsel, "other", "Other firm");
    psel.innerHTML = ""; (W.firm && W.firm.partners || []).forEach(function (p, i) { opt(psel, i, p.name); });
    function applyPartner() { var p = (W.firm.partners || [])[+psel.value]; if (!p) return; $("curName").value = p.name; $("curTitle").value = p.title || "सी.ए."; }
    function applyFirm() {
      if (fsel.value === "psg") { wrap.hidden = false; applyPartner(); }
      else { wrap.hidden = true; $("curName").value = ""; $("curTitle").value = ""; }
    }
    fsel.addEventListener("change", applyFirm);
    psel.addEventListener("change", applyPartner);
    applyFirm(); // default PSG
  }

  // ── document choices (same as OCR Automation) ──
  var DOC_LABELS = { cover: "Cover letter to the Company Registrar (निवेदन)", minutes1: "Minutes of the first shareholders' meeting", minutes2: "Minutes of the auditor appointment meeting", section184: "Section 184 statement (दफा १८४)" };
  function buildDocChoices() {
    var box = $("docChoices"); box.innerHTML = "";
    Object.keys(DOC_LABELS).forEach(function (id) {
      if (id === "minutes2" && !$("auditInclude").checked) return;
      var g = document.createElement("div"); g.className = "field-group";
      g.innerHTML = '<label class="mini"><input type="checkbox" data-doc="' + id + '" checked> ' + DOC_LABELS[id] + "</label>";
      box.appendChild(g);
    });
  }
  function docsSelected() {
    var sel = {};
    Array.prototype.forEach.call($("docChoices").querySelectorAll("[data-doc]"), function (c) { sel[c.getAttribute("data-doc")] = c.checked; });
    return sel;
  }

  // ── collect the form into the builder's data shape ──
  function collect() {
    var phones = Array.prototype.map.call($("phones").querySelectorAll('[data-f="phone"]'), function (i) { return i.value.trim(); }).filter(Boolean);
    return {
      company: { name: val("companyName"), type: $("companyType").value, regNo: val("regNo"), regDate: val("regDate") },
      address: { district: val("district"), local: val("local"), ward: val("ward") },
      phones: phones, fax: val("fax"), email: val("email"), ocrOffice: val("ocrOffice"),
      founders: founders(), chairIndex: +($("chair").value || 0),
      signer: { name: val("signerName"), designation: val("signerDesignation") },
      meeting1: { date: val("m1Date"), time: val("m1Time"), no: val("m1No") },
      meeting2: { date: val("m2Date"), time: val("m2Time"), no: val("m2No") },
      letterDate: val("letterDate"),
      auditor: { include: $("auditInclude").checked, name: val("curName"), title: val("curTitle"), fy: $("fy").value, fee: val("fee") },
      docsSelected: $("docChoices").children.length ? docsSelected() : {},
    };
  }

  // ── validation, step by step (messages as in OCR Automation) ──
  function validateStep(s) {
    var res = OCRInitial.validate(collect(), W, OCRInitial.todayBS()), errs = [];
    var groups = [
      /^(Company name|Registration number|Missing date: registration|Invalid date \(registration|District|Local level|Ward|Phone|Email)/,
      /^Add at least one founder/,
      /^(Missing date: (meeting|auditor|letter)|Invalid date \((meeting|auditor|letter))/,
      /^(Current fiscal year|Auditor name)/,
    ];
    if (s <= 3) errs = res.errors.filter(function (e) { return groups[s].test(e); });
    var dot = $("nav-" + s) && $("nav-" + s).querySelector(".warn-dot"); if (dot) dot.hidden = errs.length === 0;
    return errs;
  }
  function goTo(s) {
    document.querySelectorAll("[id^='oiu-step-']").forEach(function (p) { p.classList.remove("active"); });
    [0, 1, 2, 3, 4].forEach(function (i) { $("nav-" + i).classList.remove("active"); });
    $("step-" + s).classList.add("active"); $("nav-" + s).classList.add("active");
    document.querySelectorAll("#oiu-m-steps .ms").forEach(function (m, i) { m.classList.toggle("active", i === s); });
    if (s === 4) buildDocChoices();
    step = s; window.scrollTo(0, 0);
  }

  // ── save / load client file (same as OCR Automation) ──
  function download(bytes, name, mime) {
    var blob = bytes instanceof Blob ? bytes : new Blob([bytes], { type: mime || "application/octet-stream" });
    var a = document.createElement("a"), url = URL.createObjectURL(blob);
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
  }
  function saveClient() { var d = collect(); delete d.docsSelected; download(JSON.stringify(d, null, 2), (val("companyName") || "client").replace(/[^\wऀ-ॿ]+/g, "_") + "_InitialUpdate.json", "application/json"); }
  function fillForm(d) {
    if (!d) return;
    var c = d.company || {}, a = d.address || {}, m1 = d.meeting1 || {}, m2 = d.meeting2 || {}, au = d.auditor || {}, sg = d.signer || {};
    $("companyName").value = c.name || ""; $("regNo").value = c.regNo || ""; $("regDate").value = c.regDate || "";
    $("district").value = a.district || ""; $("local").value = a.local || ""; $("ward").value = a.ward || "";
    $("phones").innerHTML = ""; (d.phones || []).forEach(addPhone); if (!$("phones").children.length) addPhone();
    $("fax").value = d.fax || ""; $("email").value = d.email || ""; $("ocrOffice").value = d.ocrOffice || W.initial.defaults.ocrOffice;
    $("founders").innerHTML = ""; (d.founders || []).forEach(addFounder); if (!$("founders").children.length) addFounder();
    refreshChair(); $("chair").value = d.chairIndex || 0;
    $("signerName").value = sg.name || ""; $("signerDesignation").value = sg.designation || W.initial.defaults.signerDesignation;
    $("m1Date").value = m1.date || ""; $("m1Time").value = m1.time || W.defaults.times.sgm; $("m1No").value = m1.no || W.initial.defaults.meeting1No;
    $("m2Date").value = m2.date || ""; $("m2Time").value = m2.time || W.defaults.times.sgm; $("m2No").value = m2.no || W.initial.defaults.meeting2No;
    $("letterDate").value = d.letterDate || "";
    $("auditInclude").checked = au.include !== false; toggleAudit();
    if (au.fy) $("fy").value = au.fy;
    $("curName").value = au.name || ""; $("curTitle").value = au.title || ""; $("fee").value = au.fee || W.initial.defaults.fee;
    convertDigitsAll();
  }
  function loadClient(file) { var r = new FileReader(); r.onload = function () { try { fillForm(JSON.parse(r.result)); } catch (e) { msg("globalMsgs", ["Could not read that client file."]); } }; r.readAsText(file); }

  function convertDigitsAll() { Array.prototype.forEach.call(document.querySelectorAll("[id^='oiu-step-'] .dig"), function (el) { if (el.classList.contains("np")) el.value = nepDigits(el.value); }); }
  function toggleAudit() { $("auditorCard").hidden = !$("auditInclude").checked; }

  // ── generate (same output choice and file names as OCR Automation) ──
  function generate() {
    var all = [];[0, 1, 2, 3].forEach(function (s) { all = all.concat(validateStep(s)); });
    var res = OCRInitial.validate(collect(), W, OCRInitial.todayBS());
    if (all.length) { msg("msgs", all); return; }
    var data = collect(), today = OCRInitial.todayBS();
    try {
      var out = radio("output");
      if (out === "zip") {
        var sep = OCRInitial.buildSeparate(data, W, today), zip = new PizZip();
        var i = 0;
        (function next() {
          if (i >= sep.length) { download(zip.generate({ type: "uint8array" }), (val("companyName") || "OCR") + "_initial_update.zip", "application/zip"); return; }
          OCRInitial.Packer.toBlob(sep[i].doc).then(function (blob) { return blob.arrayBuffer(); }).then(function (ab) { zip.file((i + 1) + "_" + sep[i].id + ".docx", ab); i++; next(); });
        })();
      } else {
        OCRInitial.Packer.toBlob(OCRInitial.buildCombined(data, W, today)).then(function (blob) { download(blob, (val("companyName") || "OCR") + "_initial_update.docx"); });
      }
      msg("msgs", [], res.warnings);
    } catch (e) { msg("msgs", ["Could not build the documents: " + (e && e.message ? e.message : e)]); }
  }

  function build() {
    $("verifyBanner").hidden = W.meta && W.meta.verified === true;
    buildFY();
    $("ocrOffice").value = W.initial.defaults.ocrOffice; $("fee").value = W.initial.defaults.fee;
    $("m1Time").value = W.defaults.times.sgm; $("m2Time").value = W.defaults.times.sgm;
    $("letterDate").value = nepDigits(OCRInitial.todayBS());
    addPhone(); addFounder(); refreshChair(); setupFirmSelector();

    // events
    document.addEventListener("click", function (e) {
      var g = e.target.closest("[data-oiu-goto]"); if (g) {
        var to = +g.getAttribute("data-oiu-goto");
        if (to > step && step <= 3) validateStep(step); // refresh the warning dot; allow navigation regardless
        goTo(to); return;
      }
      var rm = e.target.closest("[data-oiu-remove]"); if (rm) { var b = rm.closest("[data-phone],[data-founder]"); if (b) { b.remove(); refreshChair(); } return; }
      var up = e.target.closest("[data-oiu-up]"); if (up) { var blk = up.closest("[data-founder]"); if (blk && blk.previousElementSibling) blk.parentNode.insertBefore(blk, blk.previousElementSibling); refreshChair(); return; }
      var dn = e.target.closest("[data-oiu-down]"); if (dn) { var bl = dn.closest("[data-founder]"); if (bl && bl.nextElementSibling) bl.parentNode.insertBefore(bl.nextElementSibling, bl); refreshChair(); return; }
    });
    $("founders").addEventListener("input", refreshChair);
    $("addPhone").addEventListener("click", function () { addPhone(); });
    $("addFounder").addEventListener("click", function () { addFounder(); });
    $("auditInclude").addEventListener("change", toggleAudit);
    $("save").addEventListener("click", saveClient);
    $("load").addEventListener("change", function (e) { if (e.target.files[0]) loadClient(e.target.files[0]); });
    $("generate").addEventListener("click", generate);
    // English digits -> Nepali on blur for .dig.np fields
    document.addEventListener("blur", function (e) { if (e.target.matches && e.target.matches("[id^='oiu-'].dig.np")) e.target.value = nepDigits(e.target.value); }, true);
    toggleAudit();
  }

  window.PortalTools = window.PortalTools || {};
  window.PortalTools["ocr-initial"] = { init: function () { if (started) return; started = true; load(); } };
})();
