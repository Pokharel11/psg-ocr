/*
 * Audit letter generator - browser wiring. Loads audit-letters.yaml, fills the
 * form, validates (section 11) and builds the .docx in the browser via the shared
 * core (AuditCore) and renderer (AuditRender). Nothing is sent or stored.
 */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var RULES = null;

  function opt(sel, value, text) { var o = document.createElement("option"); o.value = value; o.textContent = text; sel.appendChild(o); }
  function monthOptions(sel) { AuditCore.BS_MONTHS.forEach(function (m, i) { opt(sel, i, m); }); }
  function val(id) { return $(id).value.trim(); }
  function radio(name) { var el = document.querySelector('input[name="' + name + '"]:checked'); return el ? el.value : null; }

  fetch("audit-letters.yaml").then(function (r) { return r.text(); }).then(function (txt) {
    RULES = jsyaml.load(txt);
    init();
  }).catch(function () {
    $("msgs").innerHTML = '<div class="msg-err">Could not load the wording file (audit-letters.yaml).</div>';
  });

  function init() {
    if (!RULES.meta || RULES.meta.verified !== true) $("verifyBanner").hidden = false;

    Object.keys(RULES.entities).forEach(function (k) { opt($("entityType"), k, k); });
    Object.keys(RULES.frameworks).forEach(function (k) { opt($("framework"), k, k); });
    [$("apM"), $("enM"), $("mrlM")].forEach(monthOptions);
    for (var y = 2075; y <= 2092; y++) { opt($("fromFY"), y, AuditCore.fyShort(y)); opt($("toFY"), y, AuditCore.fyShort(y)); }
    $("fromFY").value = 2082; $("toFY").value = 2082;
    (RULES.partners || []).forEach(function (p, i) { opt($("auditorPick"), i, "CA " + p.name); });
    applyPartner();
    applyEntityDefaults();

    $("entityType").addEventListener("change", applyEntityDefaults);
    $("framework").addEventListener("change", render);
    $("auditorPick").addEventListener("change", applyPartner);
    ["apY", "apM", "apD"].forEach(function (id) { $(id).addEventListener("input", autoEngagement); });
    ["fromFY", "toFY"].forEach(function (id) { $(id).addEventListener("change", onFY); });
    $("fee").addEventListener("input", liveFee);
    document.querySelectorAll('input[name="grouping"]').forEach(function (el) { el.addEventListener("change", liveFee); });
    $("genCombined").addEventListener("click", function () { generate(false); });
    $("genSeparate").addEventListener("click", function () { generate(true); });
    onFY();
  }

  function applyPartner() {
    var p = (RULES.partners || [])[+$("auditorPick").value] || {};
    $("auditorTitle").value = p.title || "Mr.";
    $("auditorName").value = p.name || "";
    $("auditorDesignation").value = p.designation || "Partner";
  }
  function applyEntityDefaults() {
    var e = RULES.entities[$("entityType").value];
    if (e) {
      $("signatoryDesignation").value = e.default_designation || "";
      // framework guard: default NPO to NAS for NPOs
      if ($("entityType").value === "NPO" && RULES.frameworks["NAS for NPOs"]) $("framework").value = "NAS for NPOs";
    }
    render();
  }
  function onFY() {
    var range = +$("fromFY").value !== +$("toFY").value;
    $("feeBasisWrap").hidden = !range;
    $("feeBasisRadios").hidden = !range;
    render();
  }
  function bsFrom(pre) { var y = +val(pre + "Y"), m0 = +$(pre + "M").value, d = +val(pre + "D"); return y && d ? { y: y, m0: m0, day: d } : null; }
  function autoEngagement() {
    var ap = bsFrom("ap");
    if (!ap) return;
    try {
      var e = AuditCore.addBSDays(ap.y, ap.m0, ap.day, 1);
      $("enY").value = e.y; $("enM").value = e.m0; $("enD").value = e.day;
      $("engWarn").textContent = "";
    } catch (x) {}
    render();
  }
  function liveFee() {
    var f = parseFloat($("fee").value);
    $("feeWords").textContent = f > 0 ? "Rs. " + AuditCore.formatMoney(f, 2, radio("grouping")) + " (" + AuditCore.amountInWords(f) + ")" : "";
  }

  function collect() {
    var ap = bsFrom("ap"), en = bsFrom("en"), mrl = bsFrom("mrl");
    return {
      entityType: $("entityType").value, entityName: val("entityName"), entityAddress: val("entityAddress"),
      signatoryName: val("signatoryName"), signatoryDesignation: val("signatoryDesignation"),
      appointmentBS: ap, engagementBS: en, mrlBS: mrl,
      fromFY: +$("fromFY").value, toFY: +$("toFY").value,
      fee: parseFloat($("fee").value) || 0, feeBasis: radio("feeBasis") || "total", vat: radio("vat"),
      framework: $("framework").value, grouping: radio("grouping"),
      auditorTitle: val("auditorTitle"), auditorName: val("auditorName"), auditorDesignation: val("auditorDesignation"),
      firmName: val("firmName"), firmCity: val("firmCity"), highlight: $("highlight").checked,
    };
  }
  function render() { /* live hooks only; kept for future preview */ }

  function showMessages(v) {
    var html = v.errors.map(function (e) { return '<div class="msg-err">' + esc(e) + "</div>"; })
      .concat(v.warnings.map(function (w) { return '<div class="msg-warn">' + esc(w) + "</div>"; })).join("");
    $("msgs").innerHTML = html;
  }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  function shortName(name) { return (name || "Entity").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 28) || "Entity"; }
  function fyTag(inp) { return AuditCore.fyLabel(inp.fromFY, inp.toFY).replace(/FY\s*/g, "").replace(/\s*to\s*/g, "_to_").replace(/\//g, "-"); }

  function saveBlob(blob, name) {
    var a = document.createElement("a"), url = URL.createObjectURL(blob);
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
  }

  function generate(separate) {
    var inp = collect();
    if (!inp.appointmentBS || !inp.mrlBS) { showMessages({ errors: ["Enter the appointment and MRL dates (year, month, day)."], warnings: [] }); return; }
    var v = AuditCore.validate(inp);
    showMessages(v);
    if (v.errors.length) return;
    var gen = AuditCore.generate(inp, RULES);
    var tag = shortName(inp.entityName) + "_" + fyTag(inp);
    if (!separate) {
      AuditRender.Packer.toBlob(AuditRender.combined(gen)).then(function (b) { saveBlob(b, tag + "_Audit_Letters.docx"); });
    } else {
      var d = AuditRender.separate(gen);
      AuditRender.Packer.toBlob(d.appointment).then(function (b) { saveBlob(b, tag + "_Appointment.docx"); });
      AuditRender.Packer.toBlob(d.engagement).then(function (b) { saveBlob(b, tag + "_Engagement.docx"); });
      AuditRender.Packer.toBlob(d.mrl).then(function (b) { saveBlob(b, tag + "_MRL.docx"); });
    }
  }
})();
