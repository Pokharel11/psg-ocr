/*
 * Bank Account Opening — portal tool module. Lazily initialised on first open.
 * Loads the shared entity data (data/entities.yaml) + the .docx template, builds the
 * form, validates (section 7) and fills the template via BankCore + the shared engine
 * (PSGDocx). All ids/names prefixed "bank-". Nothing is sent or stored.
 */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById("bank-" + id); };
  var ENTITIES = null, TEMPLATE = null, started = false;
  var ENTITY_ORDER = ["Company", "NPO", "Partnership Firm", "Proprietorship Firm"];
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  function opt(sel, value, text) { var o = document.createElement("option"); o.value = value; o.textContent = text; sel.appendChild(o); }
  function radioVal(name) { var el = document.querySelector('input[name="bank-' + name + '"]:checked'); return el ? el.value : null; }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  function load() {
    Promise.all([
      fetch("data/entities.yaml").then(function (r) { return r.text(); }),
      fetch("templates/bank-account-template.docx").then(function (r) { return r.arrayBuffer(); })
    ]).then(function (res) {
      ENTITIES = jsyaml.load(res[0]).entities;
      TEMPLATE = res[1];
      build();
    }).catch(function () {
      $("msgs").innerHTML = '<div class="msg-err">Could not load the template or entity data.</div>';
    });
  }

  function build() {
    ENTITY_ORDER.forEach(function (k) { if (ENTITIES[k]) opt($("entityType"), k, k); });
    [$("mM"), $("aM")].forEach(function (sel) { MONTHS.forEach(function (m, i) { opt(sel, i + 1, m); }); });
    $("mM").value = 7; // default; user sets the day
    // designation datalist
    var dl = document.createElement("datalist"); dl.id = "bank-desigs"; $("form").appendChild(dl);

    addMember(); // one to start
    applyEntity();

    $("entityType").addEventListener("change", applyEntity);
    $("addMember").addEventListener("click", function () { addMember(); refresh(); });
    $("addOther").addEventListener("click", function () { addOther(); refresh(); });
    $("form").addEventListener("input", refresh);
    $("form").addEventListener("change", refresh);
    $("form").addEventListener("click", function (e) {
      var rm = e.target.closest("[data-remove]");
      if (rm) { var b = rm.closest("[data-member],[data-other]"); if (b) { b.remove(); renumber(); refresh(); } }
    });
    document.querySelectorAll('input[name="bank-op"]').forEach(function (el) { el.addEventListener("change", function () { $("opCustom").hidden = radioVal("op") !== "custom"; }); });
    $("generate").addEventListener("click", generate);
    refresh();
  }

  function applyEntity() {
    var e = ENTITIES[$("entityType").value]; if (!e) return;
    var b = e.bank;
    $("verifyBanner").hidden = b.verified === true;
    var dl = document.getElementById("bank-desigs");
    if (dl) dl.innerHTML = (b.member_designations || []).map(function (d) { return '<option>' + esc(d) + '</option>'; }).join("");
    // proprietorship = application only (no minute): hide meeting + members
    var noMinute = b.minute_title == null;
    $("meetingCard").style.display = noMinute ? "none" : "";
    refresh();
  }

  function memberRowHtml() {
    return '<button type="button" class="remove-btn" data-remove>&times;</button>' +
      '<div class="director-block-title" data-num>Member</div>' +
      '<div class="field-grid">' +
      '<div class="field-group"><label>Title</label><select data-f="title"><option>Mr.</option><option>Ms.</option><option>Mrs.</option></select></div>' +
      '<div class="field-group"><label>Full name</label><input data-f="name" placeholder="Full name"></div>' +
      '<div class="field-group"><label>Designation</label><input data-f="designation" list="bank-desigs" placeholder="Designation"></div>' +
      '</div>' +
      '<div class="radios" style="margin-top:10px;">' +
      '<label><input type="checkbox" data-f="sig" checked> Authorised signatory</label>' +
      '<label><input type="radio" name="bank-chair" data-f="chair"> Chairs the meeting</label>' +
      '<label><input type="checkbox" data-f="signs"> Signs the letter</label>' +
      '</div>';
  }
  function addMember() {
    var d = document.createElement("div"); d.className = "director-block"; d.setAttribute("data-member", "");
    d.innerHTML = memberRowHtml(); $("members").appendChild(d);
    if (!document.querySelector('input[name="bank-chair"]:checked')) d.querySelector('[data-f="chair"]').checked = true;
    renumber();
  }
  function addOther() {
    var d = document.createElement("div"); d.className = "director-block"; d.setAttribute("data-other", "");
    d.innerHTML = '<button type="button" class="remove-btn" data-remove>&times;</button>' +
      '<div class="field-grid">' +
      '<div class="field-group"><label>Title</label><select data-f="title"><option>Mr.</option><option>Ms.</option><option>Mrs.</option></select></div>' +
      '<div class="field-group"><label>Full name</label><input data-f="name" placeholder="Full name"></div>' +
      '<div class="field-group"><label>Designation</label><input data-f="designation" placeholder="e.g. Chief Executive Officer"></div>' +
      '</div>';
    $("others").appendChild(d);
  }
  function renumber() {
    Array.prototype.forEach.call(document.querySelectorAll('#bank-members [data-member]'), function (b, i) {
      var t = b.querySelector("[data-num]"); if (t) t.textContent = "Member " + (i + 1);
    });
    if (!document.querySelector('input[name="bank-chair"]:checked')) {
      var first = document.querySelector('#bank-members [data-member] [data-f="chair"]'); if (first) first.checked = true;
    }
  }
  function rowData(b) { return { title: f(b, "title"), name: f(b, "name"), designation: f(b, "designation") }; }
  function f(b, name) { var el = b.querySelector('[data-f="' + name + '"]'); return el ? el.value.trim() : ""; }
  function members() { return Array.prototype.map.call(document.querySelectorAll('#bank-members [data-member]'), rowData); }
  function signatories() {
    var out = [];
    Array.prototype.forEach.call(document.querySelectorAll('#bank-members [data-member]'), function (b) {
      if (b.querySelector('[data-f="sig"]').checked) out.push(rowData(b));
    });
    Array.prototype.forEach.call(document.querySelectorAll('#bank-others [data-other]'), function (b) {
      var d = rowData(b); if (d.name) out.push(d);
    });
    return out;
  }
  function signers() {
    var out = [];
    Array.prototype.forEach.call(document.querySelectorAll('#bank-members [data-member]'), function (b) {
      if (b.querySelector('[data-f="signs"]').checked) out.push(rowData(b));
    });
    return out;
  }
  function chairIndex() {
    var ms = document.querySelectorAll('#bank-members [data-member]');
    for (var i = 0; i < ms.length; i++) if (ms[i].querySelector('[data-f="chair"]').checked) return i;
    return 0;
  }

  // Keep the operating-instruction visibility + mandatory dropdown in sync.
  function refresh() {
    var sigs = signatories();
    $("opGroup").style.display = sigs.length >= 2 ? "" : "none";
    var sel = $("mandatory"), prev = sel.value;
    sel.innerHTML = '<option value="">None</option>';
    sigs.forEach(function (s, i) { opt(sel, i, (s.title ? s.title + " " : "") + s.name); });
    if (prev && +prev < sigs.length) sel.value = prev;
  }

  function collect() {
    var e = $("entityType").value, b = ENTITIES[e].bank;
    var noMinute = b.minute_title == null;
    var ms = members();
    var md = { y: +$("mY").value, m: +$("mM").value, d: +$("mD").value };
    var appY = +$("aY").value, appD = +$("aD").value;
    var appDate = (appY && appD) ? { y: appY, m: +$("aM").value, d: appD } : null;
    var acc = $("accountType").value;
    var sigs = signatories(), sgn = signers();
    var mand = $("mandatory").value;
    return {
      entityType: e, entityName: $("entityName").value.trim(), entityAddress: $("entityAddress").value.trim(),
      meetingDateAD: md, meetingTime: $("mTime").value.trim(),
      meetingLocation: $("mLocation").value.trim() || $("entityAddress").value.trim(),
      members: noMinute ? (ms.length ? ms : signatoriesAsMembers(sigs)) : ms,
      chairIndex: chairIndex(),
      signatories: sigs,
      operatingKind: radioVal("op"), operatingCustom: $("opCustom").value.trim(),
      mandatorySignatory: mand === "" ? null : +mand,
      bank: $("bankName").value.trim(), bankBranch: $("branch").value.trim(),
      accountType: acc === "Fixed Deposit" ? "Fixed Deposit Account" : acc + " Account",
      currency: $("currency").value,
      internetBanking: radioVal("internet") === "yes",
      letterhead: radioVal("letterhead") === "yes",
      applicationDateAD: appDate,
      applicationSigners: sgn,
    };
  }
  function signatoriesAsMembers(sigs) { return sigs.length ? sigs : [{ title: "Mr.", name: "", designation: "" }]; }

  function showMessages(v) {
    $("msgs").innerHTML = v.errors.map(function (x) { return '<div class="msg-err">' + esc(x) + "</div>"; })
      .concat(v.warnings.map(function (x) { return '<div class="msg-warn">' + esc(x) + "</div>"; })).join("");
  }

  var DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  function saveBlob(bytes, name) {
    var blob = new Blob([bytes], { type: DOCX_MIME });
    var a = document.createElement("a"), url = URL.createObjectURL(blob);
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
  }

  function generate() {
    if (!TEMPLATE) { showMessages({ errors: ["The template is still loading; try again in a moment."], warnings: [] }); return; }
    var inp = collect();
    var v = BankCore.validate(inp, ENTITIES);
    showMessages(v);
    if (v.errors.length) return;
    try {
      var data = BankCore.templateData(inp, ENTITIES);
      var bytes = PSGDocx.combined(TEMPLATE, data, { highlight: $("highlight").checked });
      saveBlob(bytes, BankCore.fileTag(inp) + "_Bank_Account_Opening.docx");
    } catch (e) {
      showMessages({ errors: ["Could not build the document: " + (e && e.message ? e.message : e)], warnings: [] });
    }
  }

  window.PortalTools = window.PortalTools || {};
  window.PortalTools["bank-account"] = { init: function () { if (started) return; started = true; load(); } };
})();
