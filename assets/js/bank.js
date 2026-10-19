/*
 * Bank Account Opening — portal tool module. Lazily initialised on first open.
 * Loads the shared entity data (data/entities.yaml) + the .docx template, builds
 * the form, validates (section 7) and fills the template via BankCore + the shared
 * engine (PSGDocx). The members editor, entity dropdown and designation list come
 * from the shared BankUI module. All ids/names prefixed "bank-". Nothing is stored.
 */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById("bank-" + id); };
  var ENTITIES = null, TEMPLATE = null, started = false, editor = null;
  var ENTITY_ORDER = ["Company", "NPO", "Partnership Firm", "Proprietorship Firm"];
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  function opt(sel, value, text) { var o = document.createElement("option"); o.value = value; o.textContent = text; sel.appendChild(o); }
  function radioVal(name) { var el = document.querySelector('input[name="bank-' + name + '"]:checked'); return el ? el.value : null; }

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
    BankUI.fillEntitySelect($("entityType"), ENTITIES, ENTITY_ORDER);
    [$("mM"), $("aM")].forEach(function (sel) { MONTHS.forEach(function (m, i) { opt(sel, i + 1, m); }); });
    $("mM").value = 7; // default; user sets the day
    var dl = document.createElement("datalist"); dl.id = "bank-desigs"; $("form").appendChild(dl);

    editor = new BankUI.MembersEditor({
      prefix: "bank", container: $("members"), addBtn: $("addMember"),
      extras: [
        { type: "checkbox", field: "sig", label: "Authorised signatory", checked: true },
        { type: "radio", field: "chair", label: "Chairs the meeting" },
        { type: "checkbox", field: "signs", label: "Signs the letter" },
      ],
      onChange: refresh,
    });
    editor.add(); // one to start
    applyEntity();

    $("entityType").addEventListener("change", applyEntity);
    $("addOther").addEventListener("click", function () { addOther(); refresh(); });
    $("form").addEventListener("input", refresh);
    $("form").addEventListener("change", refresh);
    $("others").addEventListener("click", function (e) {
      var rm = e.target.closest("[data-remove]");
      if (rm) { var b = rm.closest("[data-other]"); if (b) { b.remove(); refresh(); } }
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
    if (dl) BankUI.fillDesignations(dl, e);
    // proprietorship = application only (no minute): hide meeting + members
    var noMinute = b.minute_title == null;
    $("meetingCard").style.display = noMinute ? "none" : "";
    refresh();
  }

  function addOther() {
    var d = document.createElement("div"); d.className = "director-block"; d.setAttribute("data-other", "");
    d.innerHTML = '<button type="button" class="remove-btn" data-remove>&times;</button>' +
      '<div class="field-grid">' +
      '<div class="field-group"><label>Title</label><select data-f="title"><option>Mr.</option><option>Ms.</option><option>Mrs.</option></select></div>' +
      '<div class="field-group"><label>Full name</label><input data-f="name" placeholder="Full name"></div>' +
      '<div class="field-group"><label>Designation</label><input data-f="designation" placeholder="e.g. Chief Executive Officer"></div>' +
      "</div>";
    $("others").appendChild(d);
  }
  function f(b, name) { var el = b.querySelector('[data-f="' + name + '"]'); return el ? el.value.trim() : ""; }
  function others() {
    return Array.prototype.map.call($("others").querySelectorAll("[data-other]"), function (b) {
      return { title: f(b, "title"), name: f(b, "name"), designation: f(b, "designation") };
    });
  }
  function members() { return editor.members(); }
  function signatories() {
    var out = editor.where("sig");
    others().forEach(function (d) { if (d.name) out.push(d); });
    return out;
  }
  function signers() { return editor.where("signs"); }
  function chairIndex() { return editor.chairIndex(); }

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
      members: noMinute ? (ms.length && ms[0].name ? ms : sigs) : ms,
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

  function showMessages(v) {
    $("msgs").innerHTML = v.errors.map(function (x) { return '<div class="msg-err">' + x + "</div>"; })
      .concat(v.warnings.map(function (x) { return '<div class="msg-warn">' + x + "</div>"; })).join("");
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
