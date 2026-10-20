/* P.S.G. & Associates — OCR Document Generator (portal tool module).
   The form/UX layer. Documents are built by assets/js/ocr-core.js (OCRCore) from
   the Nepali wording in data/ocr.yaml. Everything runs in the browser; nothing is
   uploaded. All ids prefixed "ocr-". */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById("ocr-" + id); };
  var W = null, started = false, step = 0;
  var toNep = OCRCore.toNep, groupNep = OCRCore.groupNep;

  // ── small helpers ──
  function nepDigits(s) { return String(s).replace(/[0-9]/g, function (d) { return "०१२३४५६७८९"[+d]; }); }
  function val(id) { var e = $(id); return e ? e.value.trim() : ""; }
  function radio(name) { var e = document.querySelector('input[name="ocr-' + name + '"]:checked'); return e ? e.value : null; }
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

  // ── people editors ──
  function personRow(kind, withShares) {
    var roleOpts = W.roles.map(function (r) { return "<option>" + r + "</option>"; }).join("");
    var extra = withShares
      ? '<div class="field-group"><label>Shares</label><input class="np dig" data-f="shares" placeholder="१००००"></div>'
      : '<div class="field-group"><label>Role</label><select data-f="role">' + roleOpts + "</select></div>";
    var d = document.createElement("div");
    d.className = "director-block"; d.setAttribute("data-" + kind, "");
    d.innerHTML = '<button type="button" class="remove-btn" data-remove>&times;</button>' +
      '<div class="reorder"><button type="button" data-up title="Move up">▲</button><button type="button" data-down title="Move down">▼</button></div>' +
      '<div class="field-grid">' +
      '<div class="field-group"><label>Full name (नेपाली)</label><input class="np" data-f="name" placeholder="राम बहादुर थापा"></div>' +
      '<div class="field-group"><label>Address</label><input class="np" data-f="address" placeholder="काठमाडौँ-१०, काठमाडौँ"> <label class="mini"><input type="checkbox" data-sameaddr> same as company</label></div>' +
      extra + "</div>";
    return d;
  }
  function addDirector() { var d = personRow("director", false); $("directors").appendChild(d); if ($("directors").children.length === 1) d.querySelector('[data-f="role"]').value = "अध्यक्ष"; }
  function addShareholder() { $("shareholders").appendChild(personRow("shareholder", true)); }
  function rows(box, kind) {
    return Array.prototype.map.call($(box).querySelectorAll("[data-" + kind + "]"), function (b) {
      function f(n) { var e = b.querySelector('[data-f="' + n + '"]'); return e ? e.value.trim() : ""; }
      return { name: f("name"), address: f("address"), role: f("role") || "सञ्चालक", shares: f("shares") };
    });
  }
  function directors() { return rows("directors", "director"); }

  // ── Section 92 per-director editor (default छैन; tick ग + names) ──
  function buildSec92() {
    var wrap = $("sec92wrap"); wrap.innerHTML = "";
    directors().forEach(function (m, i) {
      var row = document.createElement("div");
      row.className = "mini-row"; row.setAttribute("data-s92", "");
      row.innerHTML = '<span class="muted">' + (m.name || ("Director " + (i + 1))) + "</span>" +
        ' <label class="mini"><input type="checkbox" data-g> ग = छ (director of another company)</label>' +
        ' <input class="np" data-gnames placeholder="other company names" hidden>';
      wrap.appendChild(row);
    });
    wrap.addEventListener("change", function (e) { var g = e.target.closest("[data-s92]"); if (g) { var gn = g.querySelector("[data-gnames]"); gn.hidden = !g.querySelector("[data-g]").checked; } });
  }
  function sec92Data() {
    return Array.prototype.map.call($("sec92wrap").querySelectorAll("[data-s92]"), function (r) {
      var g = r.querySelector("[data-g]").checked;
      return { g: g ? "छ" : "छैन", gNames: g ? r.querySelector("[data-gnames]").value.trim() : "" };
    });
  }

  // ── capital helpers (B6) ──
  function calcCapital() {
    var auth = OCRCore.calcAuthCapital(val("numShares"), val("faceValue") || 100);
    $("authCapital").value = auth ? groupNep(auth) : "";
    if (!val("paidAmt") && val("paidUp")) $("paidAmt").value = $("paidUp").value;
    var paidUp = parseInt(String(val("paidUp")).replace(/[^0-9]/g, "") || nepToAscii(val("paidUp")), 10);
    var paid = parseInt(String(val("paidAmt")).replace(/[^0-9]/g, "") || nepToAscii(val("paidAmt")), 10);
    if (!isNaN(paidUp)) { var up = paidUp - (isNaN(paid) ? 0 : paid); $("unpaid").value = up > 0 ? groupNep(up) : "छैन"; }
  }
  function nepToAscii(s) { return String(s || "").replace(/[०-९]/g, function (c) { return "०१२३४५६७८९".indexOf(c); }); }

  // ── fiscal year dropdown (B4) ──
  function buildFY() {
    // 2060/61 … 2089/90 — capped at BS 2090, the end of the shared calendar's range.
    var sel = $("fy"); sel.innerHTML = "";
    for (var y = 2089; y >= 2060; y--) opt(sel, OCRCore.fyLabel(y), OCRCore.fyLabel(y));
    sel.value = OCRCore.fyLabel(2082);
    $("nextFy").value = OCRCore.fyNext(sel.value);
    sel.addEventListener("change", function () { $("nextFy").value = OCRCore.fyNext(sel.value); });
  }

  // Auditor firm selector (B): PSG auto-fills firm/address/partner/title/designation.
  function setupFirmSelector(which) {
    var fsel = $(which + "FirmSel"), psel = $(which + "Partner"), wrap = document.querySelector('[data-partnerwrap="' + which + '"]');
    if (!fsel) return;
    fsel.innerHTML = ""; opt(fsel, "psg", (W.firm && W.firm.name) || "पी.एस.जी. एण्ड एसोसिएट्स"); opt(fsel, "other", "Other firm");
    psel.innerHTML = ""; (W.firm && W.firm.partners || []).forEach(function (p, i) { opt(psel, i, p.name); });
    function applyPartner() { var p = (W.firm.partners || [])[+psel.value]; if (!p) return; $(which + "Name").value = p.name; $(which + "Title").value = p.title || "सी.ए."; $(which + "Desig").value = p.designation || "साझेदार"; }
    function applyFirm() {
      if (fsel.value === "psg") { $(which + "Firm").value = W.firm.name; $(which + "Addr").value = W.firm.address || ""; wrap.hidden = false; applyPartner(); }
      else { wrap.hidden = true; $(which + "Firm").value = ""; $(which + "Name").value = ""; $(which + "Title").value = ""; $(which + "Addr").value = ""; }
    }
    fsel.addEventListener("change", applyFirm);
    psel.addEventListener("change", applyPartner);
    applyFirm(); // default PSG
  }

  // ── document choices (B8) ──
  var DOC_LABELS = { sgmBod: "SGM-call BOD minute", sgm: "SGM minute", c2: "Appointment letter (new current-year auditor)", c3: "Auditor acceptance letter(s)", bo: "Beneficiary Owner detail", agmBod: "AGM-call BOD minute", agm: "AGM minute", c1: "Appointment letter (next-year auditor)", app50: "Application letter (दफा ५०)", sec92: "Section 92 (दफा ९२)", sec51: "Section 51 (दफा ५१)" };
  function buildDocChoices() {
    var box = $("docChoices"); box.innerHTML = "";
    Object.keys(DOC_LABELS).forEach(function (id) {
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
    var ms = directors();
    var chairIdx = 0; ms.forEach(function (m, i) { if (m.role === "अध्यक्ष") chairIdx = i; });
    var change = $("auditorChange").checked;
    var reasonPhrase = val("reasonCustom") || (($("reason").value) || "");
    var nextSame = $("nextSame").checked;
    // Titles are taken as entered — never defaulted to CA (not every auditor is a CA).
    var cur = { name: val("curName"), firm: val("curFirm"), address: val("curAddr"), designation: $("curDesig").value, title: val("curTitle") };
    var next = nextSame ? Object.assign({}, cur) : { name: val("nextName"), firm: val("nextFirm"), address: val("nextAddr"), designation: $("nextDesig").value, title: val("nextTitle") };
    var feeOf = function (p) { var mode = $("fee" + p + "mode").value; return { mode: mode, amount: nepToAscii(val("fee" + p + "val")), vat: $("fee" + p + "vat").value }; };
    return {
      company: { name: val("companyName"), address: val("companyAddress"), reg: val("regNumber"), letterhead: radio("letterhead") === "yes" },
      members: ms, chairIndex: chairIdx,
      shareholdersSameAsDirectors: $("shSame").checked,
      shareholders: $("shSame").checked ? [] : rows("shareholders", "shareholder"),
      dates: { bodAuditor: val("bodAuditor"), sgm: val("sgm"), bod: val("bod"), agm: val("agm"), app: val("app") },
      times: { sgmBod: val("timeSgm") || W.defaults.times.sgmBod, sgm: val("timeSgm") || W.defaults.times.sgm, agmBod: val("timeAgmBod") || W.defaults.times.agmBod, agm: val("timeAgm") || W.defaults.times.agm },
      fiscal: { current: $("fy").value, next: $("nextFy").value },
      auditorChange: change,
      reasonPhrase: reasonPhrase,
      auditors: { prev: { name: val("prevName"), firm: val("prevFirm"), title: val("prevTitle") }, cur: cur, next: next },
      capital: { numShares: nepToAscii(val("numShares")), faceValue: nepToAscii(val("faceValue")) || 100, authCapital: val("authCapital"), issued: val("issued"), paidUp: val("paidUp"), paidAmt: val("paidAmt") || val("paidUp"), unpaid: val("unpaid") || "छैन" },
      sec92: sec92Data(),
      sec51: { shareholdersChanged: $("shChanged").checked, loans: val("loans"), brokerage: val("brokerage"), forfeited: val("forfeited"), investments: val("investments") },
      quorumAllPresent: $("quorumAll") ? $("quorumAll").checked : true,
      acceptance: { enabled: $("acceptance").checked, forC1: true, forC2: change },
      fee: { c1: feeOf("C1"), c2: feeOf("C2") },
      docsSelected: docsSelected(),
    };
  }

  // ── validation (B9) ──
  function validateStep(s) {
    var errs = [];
    if (s === 0) { if (!val("companyName")) errs.push("Company name required."); if (!val("companyAddress")) errs.push("Company address required."); if (!val("regNumber")) errs.push("Registration number required."); }
    if (s === 1) { if (!directors().some(function (m) { return m.name; })) errs.push("Add at least one director."); }
    if (s === 2) {
      ["bod", "agm", "app"].forEach(function (d) { if (!val(d)) errs.push("Missing date: " + d + "."); });
      try { if (val("bod") && val("agm") && OCRCore.addDays(val("bod"), 21) > val("agm")) errs.push("AGM should be at least 21 days after the BOD meeting."); } catch (e) { errs.push(e.message); }
      if ($("auditorChange").checked) { if (!val("sgm")) errs.push("SGM date required for an auditor change."); }
    }
    if (s === 3) { if (!val("curName") || !val("curFirm")) errs.push("This year's auditor is required."); if (!val("numShares")) errs.push("Number of shares required."); }
    var dot = $("nav-" + s) && $("nav-" + s).querySelector(".warn-dot"); if (dot) dot.hidden = errs.length === 0;
    return errs;
  }

  function goTo(s) {
    document.querySelectorAll(".step-panel").forEach(function (p) { p.classList.remove("active"); });
    document.querySelectorAll(".sidebar-step").forEach(function (x) { x.classList.remove("active"); });
    $("step-" + s).classList.add("active"); $("nav-" + s).classList.add("active");
    document.querySelectorAll("#ocr-m-steps .ms").forEach(function (m, i) { m.classList.toggle("active", i === s); });
    if (s === 3) buildSec92();
    if (s === 4) buildDocChoices();
    step = s; window.scrollTo(0, 0);
  }

  // ── save / load / roll-forward (B7) ──
  function download(bytes, name, mime) {
    var blob = bytes instanceof Blob ? bytes : new Blob([bytes], { type: mime || "application/octet-stream" });
    var a = document.createElement("a"), url = URL.createObjectURL(blob);
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
  }
  function saveClient() { download(JSON.stringify(collect(), null, 2), (val("companyName") || "client").replace(/[^\wऀ-ॿ]+/g, "_") + "_OCR.json", "application/json"); }
  function fillForm(d) {
    if (!d) return;
    $("companyName").value = d.company.name || ""; $("companyAddress").value = d.company.address || ""; $("regNumber").value = d.company.reg || "";
    (document.querySelector('input[name="ocr-letterhead"][value="' + (d.company.letterhead === false ? "no" : "yes") + '"]') || {}).checked = true;
    $("directors").innerHTML = ""; (d.members || []).forEach(function (m) { addDirector(); var b = $("directors").lastChild; b.querySelector('[data-f="name"]').value = m.name || ""; b.querySelector('[data-f="address"]').value = m.address || ""; b.querySelector('[data-f="role"]').value = m.role || "सञ्चालक"; });
    if (!$("directors").children.length) addDirector();
    $("shSame").checked = d.shareholdersSameAsDirectors !== false; $("shWrap").hidden = $("shSame").checked;
    $("shareholders").innerHTML = ""; (d.shareholders || []).forEach(function (s) { addShareholder(); var b = $("shareholders").lastChild; b.querySelector('[data-f="name"]').value = s.name || ""; b.querySelector('[data-f="address"]').value = s.address || ""; b.querySelector('[data-f="shares"]').value = s.shares || ""; });
    var dt = d.dates || {}; ["bodAuditor", "sgm", "bod", "agm", "app"].forEach(function (k) { if ($(k)) $(k).value = dt[k] || ""; });
    var tm = d.times || {}; if ($("timeSgm")) $("timeSgm").value = tm.sgm || ""; if ($("timeAgmBod")) $("timeAgmBod").value = tm.agmBod || ""; if ($("timeAgm")) $("timeAgm").value = tm.agm || "";
    if (d.fiscal && d.fiscal.current) { $("fy").value = d.fiscal.current; $("nextFy").value = d.fiscal.next || OCRCore.fyNext(d.fiscal.current); }
    $("auditorChange").checked = !!d.auditorChange; toggleChange();
    var a = d.auditors || {}; $("prevName").value = (a.prev || {}).name || ""; $("prevFirm").value = (a.prev || {}).firm || "";
    $("curName").value = (a.cur || {}).name || ""; $("curFirm").value = (a.cur || {}).firm || ""; $("curAddr").value = (a.cur || {}).address || "";
    var c = d.capital || {}; $("numShares").value = c.numShares || ""; $("faceValue").value = c.faceValue || 100; $("issued").value = c.issued || ""; $("paidUp").value = c.paidUp || ""; $("paidAmt").value = c.paidAmt || ""; calcCapital();
    convertDigitsAll();
  }
  function loadClient(file) { var r = new FileReader(); r.onload = function () { try { fillForm(JSON.parse(r.result)); } catch (e) { msg("globalMsgs", ["Could not read that client file."]); } }; r.readAsText(file); }
  function rollForward(file) { var r = new FileReader(); r.onload = function () { try { fillForm(OCRCore.rollForward(JSON.parse(r.result))); msg("globalMsgs", [], ["Rolled forward. Review the dates (cleared) and auditors before generating."]); } catch (e) { msg("globalMsgs", ["Could not roll that client file forward."]); } }; r.readAsText(file); }

  function convertDigitsAll() { Array.prototype.forEach.call(document.querySelectorAll("#ocr-step-0 .dig, .step-panel .dig"), function (el) { if (el.classList.contains("np")) el.value = nepDigits(el.value); }); }

  function toggleChange() {
    var on = $("auditorChange").checked;
    $("reasonWrap").hidden = !on; $("prevAuditorCard").hidden = !on; $("sgmDatesCard").hidden = !on; $("feeC2wrap").style.display = on ? "" : "none";
  }

  function generate() {
    var all = [];[0, 1, 2, 3].forEach(function (s) { all = all.concat(validateStep(s)); });
    if (all.length) { msg("msgs", all); return; }
    var data = collect();
    try {
      var out = radio("output");
      if (out === "zip") {
        var sep = OCRCore.buildSeparate(data, W), zip = new PizZip();
        var i = 0;
        (function next() {
          if (i >= sep.length) { download(zip.generate({ type: "uint8array" }), (val("companyName") || "OCR") + "_documents.zip", "application/zip"); return; }
          OCRCore.Packer.toBlob(sep[i].doc).then(function (blob) { return blob.arrayBuffer(); }).then(function (ab) { zip.file((i + 1) + "_" + sep[i].id + ".docx", ab); i++; next(); });
        })();
      } else {
        OCRCore.Packer.toBlob(OCRCore.buildCombined(data, W)).then(function (blob) { download(blob, (val("companyName") || "OCR") + "_documents.docx"); });
      }
      msg("msgs", [], []);
    } catch (e) { msg("msgs", ["Could not build the documents: " + (e && e.message ? e.message : e)]); }
  }

  function build() {
    $("verifyBanner").hidden = W.meta && W.meta.verified === true;
    buildFY();
    $("reason").innerHTML = ""; W.reasons.forEach(function (r) { opt($("reason"), r.phrase, r.label); }); opt($("reason"), "", "Custom…");
    // a quorum toggle in the shareholders card
    var q = document.createElement("div"); q.className = "field-group full"; q.innerHTML = '<div class="radios"><label><input type="checkbox" id="ocr-quorumAll" checked> All shareholders present at the AGM</label></div>';
    $("shWrap").parentNode.insertBefore(q, $("shWrap"));
    addDirector(); // one to start

    // events
    document.addEventListener("click", function (e) {
      var g = e.target.closest("[data-goto]"); if (g) {
        var to = +g.getAttribute("data-goto");
        if (to > step) validateStep(step); // refresh the warning dot; allow navigation regardless
        goTo(to); return;
      }
      var auto = e.target.closest("[data-auto]");
      if (auto) { var which = auto.getAttribute("data-auto"); try { if (which === "agm" && val("bod")) $("agm").value = OCRCore.addDays(val("bod"), 21); if (which === "sgm" && val("bodAuditor")) $("sgm").value = OCRCore.addDays(val("bodAuditor"), 15); } catch (err) { msg("msgs", [err.message]); } return; }
      var rm = e.target.closest("[data-remove]"); if (rm) { var b = rm.closest("[data-director],[data-shareholder]"); if (b) b.remove(); return; }
      var up = e.target.closest("[data-up]"); if (up) { var blk = up.closest("[data-director],[data-shareholder]"); if (blk && blk.previousElementSibling) blk.parentNode.insertBefore(blk, blk.previousElementSibling); return; }
      var dn = e.target.closest("[data-down]"); if (dn) { var bl = dn.closest("[data-director],[data-shareholder]"); if (bl && bl.nextElementSibling) bl.parentNode.insertBefore(bl.nextElementSibling, bl); return; }
    });
    $("addDirector").addEventListener("click", addDirector);
    $("addShareholder").addEventListener("click", addShareholder);
    $("shSame").addEventListener("change", function () { $("shWrap").hidden = $("shSame").checked; });
    document.addEventListener("change", function (e) {
      if (e.target.matches("[data-sameaddr]")) { var b = e.target.closest("[data-director],[data-shareholder]"); if (e.target.checked) b.querySelector('[data-f="address"]').value = val("companyAddress"); }
    });
    $("auditorChange").addEventListener("change", toggleChange);
    $("nextSame").addEventListener("change", function () { $("nextAuditorGrid").hidden = $("nextSame").checked; });
    $("reason").addEventListener("change", function () { $("reasonCustom").hidden = $("reason").value !== ""; });
    $("feeC1mode").addEventListener("change", function () { $("feeC1amt").hidden = $("feeC1mode").value !== "amount"; });
    $("feeC2mode").addEventListener("change", function () { $("feeC2amt").hidden = $("feeC2mode").value !== "amount"; });
    setupFirmSelector("cur"); setupFirmSelector("next");
    ["numShares", "faceValue", "paidUp", "paidAmt"].forEach(function (id) { $(id).addEventListener("input", calcCapital); });
    $("save").addEventListener("click", saveClient);
    $("load").addEventListener("change", function (e) { if (e.target.files[0]) loadClient(e.target.files[0]); });
    $("rollfwd").addEventListener("change", function () {});
    // roll-forward reuses the load picker via a hidden input
    var rfInput = document.createElement("input"); rfInput.type = "file"; rfInput.accept = "application/json"; rfInput.hidden = true; document.body.appendChild(rfInput);
    $("rollfwd").addEventListener("click", function () { rfInput.click(); });
    rfInput.addEventListener("change", function (e) { if (e.target.files[0]) rollForward(e.target.files[0]); e.target.value = ""; });
    $("generate").addEventListener("click", generate);
    // English digits -> Nepali on blur for .dig.np fields
    document.addEventListener("blur", function (e) { if (e.target.matches && e.target.matches(".dig.np")) { e.target.value = nepDigits(e.target.value); if (["issued", "paidUp", "paidAmt"].indexOf((e.target.id || "").replace("ocr-", "")) >= 0) calcCapital(); } }, true);
    toggleChange();
  }

  window.PortalTools = window.PortalTools || {};
  window.PortalTools.ocr = { init: function () { if (started) return; started = true; load(); } };
  window.goTo = goTo; // sidebar legacy
})();
