/*
 * Balance Confirmation — Tax Docs portal tool module. Lazily initialised on first
 * open. Loads the .docx template, builds the form, and generates letters in the
 * browser via BalanceConfirmationCore + the shared engine (PSGDocx). Individual
 * mode uses the on-screen form; Bulk mode reads an uploaded Excel file with the
 * vendored SheetJS (BalanceConfirmationXlsx), shows a preview grid, and produces
 * the combined document / zip / confirmation register / Annexure 13 export.
 * The fiscal-year dropdown and BS "as on" date reuse the shared PSGBSDate helpers.
 * All ids/names are prefixed "tax-bc-". Nothing is sent or stored.
 */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById("tax-bc-" + id); };
  var TEMPLATE = null, started = false;
  var rows = [], verdicts = [], vatRate = null;
  var asOnAuto = true;

  function radioVal(name) { var el = document.querySelector('input[name="tax-bc-' + name + '"]:checked'); return el ? el.value : null; }
  function opt(sel, value, text) { var o = document.createElement("option"); o.value = value; o.textContent = text; sel.appendChild(o); }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  function load() {
    fetch("templates/balance-confirmation-template.docx").then(function (r) {
      if (!r.ok) throw new Error("template"); return r.arrayBuffer();
    }).then(function (buf) { TEMPLATE = buf; build(); })
      .catch(function () { $("msgs").innerHTML = '<div class="msg-err">Could not load the letter template.</div>'; });
  }

  function build() {
    // Fiscal year dropdown: 2060/61 .. 2089/90 (capped at BS 2090, the shared calendar's end).
    var sel = $("fy");
    for (var y = 2089; y >= 2060; y--) opt(sel, String(y), PSGBSDate.fyShort(y).replace("FY ", ""));
    sel.value = "2082";
    applyAsOn();
    $("letterDate").value = todayBS();

    sel.addEventListener("change", function () { if (asOnAuto) applyAsOn(); });
    $("asOn").addEventListener("input", function () { asOnAuto = false; $("asOnNote").hidden = false; });
    document.querySelectorAll('input[name="tax-bc-mode"]').forEach(function (r) { r.addEventListener("change", applyMode); });
    $("copy").addEventListener("click", copySender);
    $("genIndividual").addEventListener("click", genIndividual);
    $("genCombined").addEventListener("click", function () { genBulk("combined"); });
    $("genZip").addEventListener("click", function () { genBulk("zip"); });
    $("genRegister").addEventListener("click", function () { genBulk("register"); });
    $("genAnnexure").addEventListener("click", function () { genBulk("annexure"); });
    $("file").addEventListener("change", onFile);
    applyMode();
  }

  function applyAsOn() { $("asOn").value = PSGBSDate.fyAshadEndYMD(+$("fy").value); $("asOnNote").hidden = true; }
  function todayBS() { var b = PSGBSDate.adUTCtoBS(Date.now()); function p(n) { return n < 10 ? "0" + n : "" + n; } return b.y + "/" + p(b.m0 + 1) + "/" + p(b.day); }

  function applyMode() {
    var bulk = radioVal("mode") === "bulk";
    $("individualCard").hidden = bulk;
    $("bulkCard").hidden = !bulk;
    $("actionsIndividual").hidden = bulk;
    $("actionsBulk").hidden = !bulk;
    $("msgs").innerHTML = "";
  }

  function settings() {
    return {
      fy: PSGBSDate.fyShort(+$("fy").value).replace("FY ", ""),
      asOn: $("asOn").value.trim(),
      letterDate: $("letterDate").value.trim() || todayBS(),
      responseDays: parseInt($("responseDays").value, 10) || 15,
      letterhead: radioVal("letterhead") === "yes",
      hideEmpty: $("hideEmpty").checked,
      highlight: $("highlight").checked,
      vatRate: vatRate != null ? vatRate : BalanceConfirmationCore.DEFAULT_VAT_RATE,
      senderName: $("senderName").value.trim(),
      senderPan: $("senderPan").value.trim(),
      senderAddress: $("senderAddress").value.trim(),
      signatoryName: $("signatoryName").value.trim(),
      signatoryDesignation: $("signatoryDesignation").value.trim(),
    };
  }

  function individualRow() {
    var obj = {};
    $("individualCard").querySelectorAll("[data-f]").forEach(function (el) { obj[el.getAttribute("data-f")] = el.value; });
    return obj;
  }

  function senderErrors(s) {
    var e = [];
    if (!s.senderName) e.push("Sender company name is required.");
    if (!s.signatoryName) e.push("Signatory name is required.");
    if (!s.asOn) e.push('The "as on" date is required.');
    return e;
  }
  function showMessages(errors, warnings) {
    $("msgs").innerHTML = (errors || []).map(function (x) { return '<div class="msg-err">' + esc(x) + "</div>"; })
      .concat((warnings || []).map(function (x) { return '<div class="msg-warn">' + esc(x) + "</div>"; })).join("");
  }

  // Copy sender company fields from the Bank Docs Account Opening form, if filled.
  function copySender() {
    function v(id) { var el = document.getElementById(id); return el ? el.value : ""; }
    if (v("bank-entityName")) $("senderName").value = v("bank-entityName");
    if (v("bank-entityAddress")) $("senderAddress").value = v("bank-entityAddress");
  }

  var DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  var XLS = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  function save(bytes, name, mime) {
    var blob = new Blob([bytes], { type: mime });
    var a = document.createElement("a"), url = URL.createObjectURL(blob);
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
  }

  function genIndividual() {
    if (!TEMPLATE) { showMessages(["The template is still loading; try again in a moment."]); return; }
    var s = settings();
    var row = individualRow();
    var v = BalanceConfirmationCore.validateRow(row, s);
    var errs = senderErrors(s).concat(v.errors);
    showMessages(errs, v.warnings);
    if (errs.length) return;
    try {
      var bytes = PSGDocx.combined(TEMPLATE, BalanceConfirmationCore.templateData([row], s), { highlight: s.highlight });
      save(bytes, BalanceConfirmationCore.fileName(row, s), DOCX);
    } catch (e) { showMessages(["Could not build the document: " + (e && e.message ? e.message : e)]); }
  }

  function onFile(e) {
    var f = e.target.files && e.target.files[0]; if (!f) return;
    f.arrayBuffer().then(function (buf) {
      var res = BalanceConfirmationXlsx.readWorkbook(new Uint8Array(buf));
      rows = res.rows; vatRate = res.vatRate;
      if (!rows.length) { $("preview").innerHTML = '<div class="msg-err">No data rows found. Check that the sheet has the template headers.</div>'; return; }
      renderPreview();
    }).catch(function () { $("preview").innerHTML = '<div class="msg-err">Could not read the Excel file.</div>'; });
  }

  function renderPreview() {
    var s = settings();
    verdicts = BalanceConfirmationCore.validateAll(rows, s);
    var head = "<tr><th></th><th>Party</th><th>PAN</th><th>Opening</th><th>Rep. purchase</th><th>Rep. sales</th><th>Closing</th><th>Status</th></tr>";
    var body = rows.map(function (r, i) {
      var f = BalanceConfirmationCore.figures(r, s), v = verdicts[i];
      var tick = v.status === "error" ? '<input type="checkbox" data-row="' + i + '" disabled>' : '<input type="checkbox" data-row="' + i + '" checked>';
      var msg = (v.errors.concat(v.warnings)).map(esc).join("<br>");
      var badge = v.status === "error" ? '<span class="msg-err">error</span>' : (v.status === "warning" ? '<span class="msg-warn">warning</span>' : "OK");
      return "<tr><td>" + tick + "</td><td>" + esc(r.tradename) + "</td><td>" + esc(String(r.pan || "")) + "</td><td>"
        + esc(BalanceConfirmationCore.fmtBalance(f.opening, f.openingDrCr)) + "</td><td>" + esc(BalanceConfirmationCore.fmt(f.reportablePurchase))
        + "</td><td>" + esc(BalanceConfirmationCore.fmt(f.reportableSales)) + "</td><td>" + esc(BalanceConfirmationCore.fmtBalance(f.closing, f.closingDrCr))
        + "</td><td>" + badge + (msg ? '<div class="hint">' + msg + "</div>" : "") + "</td></tr>";
    }).join("");
    $("preview").innerHTML = '<table class="preview-grid" style="width:100%;border-collapse:collapse;font-size:14px;">' + head + body + "</table>";
  }

  function selectedRows() {
    var out = [];
    $("preview").querySelectorAll("input[data-row]:checked").forEach(function (c) { out.push(rows[+c.getAttribute("data-row")]); });
    return out;
  }

  function sanitizeFy(s) { return (s.fy || "").replace(/[^A-Za-z0-9]+/g, "_"); }

  function genBulk(kind) {
    if (!TEMPLATE) { showMessages(["The template is still loading; try again in a moment."]); return; }
    var s = settings();
    var se = senderErrors(s);
    if (se.length) { showMessages(se); return; }
    if (!rows.length) { showMessages(["Upload an Excel file first."]); return; }
    var sel = selectedRows();
    if (!sel.length) { showMessages(["Tick at least one row without errors to generate."]); return; }
    try {
      if (kind === "combined") {
        save(PSGDocx.combined(TEMPLATE, BalanceConfirmationCore.templateData(sel, s), { highlight: s.highlight }),
          "Balance_Confirmation_" + sanitizeFy(s) + ".docx", DOCX);
      } else if (kind === "zip") {
        var zip = new PizZip();
        sel.forEach(function (r) {
          zip.file(BalanceConfirmationCore.fileName(r, s), PSGDocx.bytes(PSGDocx.fillZip(TEMPLATE, BalanceConfirmationCore.templateData([r], s), { highlight: s.highlight })));
        });
        save(zip.generate({ type: "uint8array" }), "Balance_Confirmation_" + sanitizeFy(s) + ".zip", "application/zip");
      } else if (kind === "register") {
        save(BalanceConfirmationXlsx.registerBytes(sel, s, false), "Confirmation_Register_" + sanitizeFy(s) + ".xlsx", XLS);
      } else if (kind === "annexure") {
        save(BalanceConfirmationXlsx.annexure13Bytes(sel, false), "Annexure_13_" + sanitizeFy(s) + ".xlsx", XLS);
      }
    } catch (e) { showMessages(["Could not build the output: " + (e && e.message ? e.message : e)]); }
  }

  window.PortalTools = window.PortalTools || {};
  window.PortalTools["tax-balance"] = { init: function () { if (started) return; started = true; load(); } };
})();
