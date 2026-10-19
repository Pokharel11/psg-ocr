/*
 * Bank Statement Request — portal tool module. Lazily initialised on first open.
 * Loads the shared entity data (data/entities.yaml) + the .docx template, builds
 * the form, validates (section 7) and fills the template via BankStatementCore +
 * the shared engine (PSGDocx). The members editor, entity dropdown and designation
 * list come from the shared BankUI module; the BS/AD calendar from PSGBSDate. All
 * ids/names prefixed "bank-st-". Nothing is sent or stored.
 */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById("bank-st-" + id); };
  var ENTITIES = null, TEMPLATE = null, started = false, editor = null;
  var ENTITY_ORDER = ["Company", "NPO", "Partnership Firm", "Proprietorship Firm"];
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var ASHADH = 2, SHRAWAN = 3; // 0-based BS month indexes

  function opt(sel, value, text) { var o = document.createElement("option"); o.value = value; o.textContent = text; sel.appendChild(o); }
  function radioVal(name) { var el = document.querySelector('input[name="bank-st-' + name + '"]:checked'); return el ? el.value : null; }

  function load() {
    Promise.all([
      fetch("data/entities.yaml").then(function (r) { return r.text(); }),
      fetch("templates/bank-statement-template.docx").then(function (r) { return r.arrayBuffer(); })
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
    [$("mM"), $("lM")].forEach(function (sel) { MONTHS.forEach(function (m, i) { opt(sel, i + 1, m); }); });
    $("mM").value = 10;
    var dl = document.createElement("datalist"); dl.id = "bank-st-desigs"; $("form").appendChild(dl);

    editor = new BankUI.MembersEditor({
      prefix: "bank-st", container: $("members"), addBtn: $("addMember"),
      extras: [
        { type: "checkbox", field: "auth", label: "Authorized to sign &amp; collect", checked: true },
        { type: "radio", field: "chair", label: "Chairs the meeting" },
      ],
      onChange: function () {},
    });
    editor.add();
    addAccount();
    applyEntity();

    $("entityType").addEventListener("change", applyEntity);
    $("addAccount").addEventListener("click", addAccount);
    $("accounts").addEventListener("click", function (e) {
      var rm = e.target.closest("[data-remove]");
      if (rm) { var b = rm.closest("[data-account]"); if (b) b.remove(); }
    });
    $("fillFY").addEventListener("click", fillFiscalYear);
    $("purpose").addEventListener("change", function () { $("purposeCustom").hidden = $("purpose").value !== "custom"; });
    $("copy").addEventListener("click", copyFromAccountOpening);
    $("generate").addEventListener("click", generate);
  }

  function applyEntity() {
    var e = ENTITIES[$("entityType").value]; if (!e) return;
    var st = e.bank_statement || {};
    $("verifyBanner").hidden = st.verified === true;
    var dl = document.getElementById("bank-st-desigs");
    if (dl) BankUI.fillDesignations(dl, e);
    var noMinute = st.minute_title == null; // proprietorship: letter only
    $("meetingCard").style.display = noMinute ? "none" : "";
  }

  function addAccount() {
    var d = document.createElement("div"); d.className = "director-block"; d.setAttribute("data-account", "");
    d.innerHTML = '<button type="button" class="remove-btn" data-remove>&times;</button>' +
      '<div class="field-grid"><div class="field-group full"><label>Account number</label>' +
      '<input data-f="number" placeholder="e.g. 00112233445566"></div></div>';
    $("accounts").appendChild(d);
  }
  function accounts() {
    return Array.prototype.map.call($("accounts").querySelectorAll("[data-account]"), function (b) {
      var el = b.querySelector('[data-f="number"]'); return { number: el ? el.value.trim() : "" };
    });
  }

  function adParts(utc) { var d = new Date(utc); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() }; }
  function setYMD(pfx, y, m, d) { $(pfx + "Y").value = y; $(pfx + "M").value = m; $(pfx + "D").value = d; }
  function fillFiscalYear() {
    var fy = +$("fy").value; if (!fy) return;
    var ds = radioVal("ds") || "AD";
    var lastAshadh = PSGBSDate.bsMonthDays(fy + 1, ASHADH);
    if (ds === "BS") {
      setYMD("f", fy, 4, 1);              // Shrawan 1 (month 4, 1-based)
      setYMD("t", fy + 1, 3, lastAshadh); // last day of Ashadh (month 3, 1-based)
    } else {
      var from = adParts(PSGBSDate.bsToAdUTC(fy, SHRAWAN, 1));
      var to = adParts(PSGBSDate.bsToAdUTC(fy + 1, ASHADH, lastAshadh));
      setYMD("f", from.y, from.m, from.d);
      setYMD("t", to.y, to.m, to.d);
    }
  }

  function num3(pfx) { return { y: +$(pfx + "Y").value, m: +$(pfx + "M").value, d: +$(pfx + "D").value }; }
  function collect() {
    var md = num3("m");
    var lY = +$("lY").value, lD = +$("lD").value;
    var letterDate = (lY && lD) ? { y: lY, m: +$("lM").value, d: lD } : md;
    var purpose = $("purpose").value === "custom" ? $("purposeCustom").value.trim() : $("purpose").value;
    return {
      entityType: $("entityType").value,
      entityName: $("entityName").value.trim(),
      entityAddress: $("entityAddress").value.trim(),
      letterhead: radioVal("letterhead") === "yes",
      bank: $("bankName").value.trim(), bankAddress: $("bankAddress").value.trim(), branch: $("branch").value.trim(),
      accounts: accounts(), accountName: $("accountName").value.trim(),
      dateSystem: radioVal("ds") || "AD",
      fromDate: num3("f"), toDate: num3("t"),
      purpose: purpose,
      meetingDateAD: md, meetingTime: $("mTime").value.trim(),
      members: editor.members(), chairIndex: editor.chairIndex(),
      allPresent: $("allPresent").checked,
      authorized: editor.where("auth"),
      letterDateAD: letterDate,
    };
  }

  // Copy entity, address, members and bank name from the Account Opening form, if
  // it has been filled this session (both panes live in the Bank Docs compartment).
  function copyFromAccountOpening() {
    var ao = document.getElementById("bank-form"); if (!ao) return;
    function v(id) { var el = document.getElementById(id); return el ? el.value : ""; }
    if (v("bank-entityType")) { $("entityType").value = v("bank-entityType"); applyEntity(); }
    $("entityName").value = v("bank-entityName");
    $("entityAddress").value = v("bank-entityAddress");
    if (v("bank-bankName")) $("bankName").value = v("bank-bankName");
    // members
    var rows = ao.querySelectorAll("#bank-members [data-member]");
    if (rows.length) {
      $("members").innerHTML = "";
      Array.prototype.forEach.call(rows, function (b, i) {
        function f(n) { var el = b.querySelector('[data-f="' + n + '"]'); return el ? el.value : ""; }
        var row = editor.add();
        row.querySelector('[data-f="title"]').value = f("title");
        row.querySelector('[data-f="name"]').value = f("name");
        row.querySelector('[data-f="designation"]').value = f("designation");
        // first member authorized + chairs by default
        row.querySelector('[data-f="auth"]').checked = (i === 0);
        if (i === 0) { var c = row.querySelector('[data-f="chair"]'); if (c) c.checked = true; }
      });
      editor.renumber();
    }
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
    var v = BankStatementCore.validate(inp, ENTITIES);
    showMessages(v);
    if (v.errors.length) return;
    try {
      var data = BankStatementCore.templateData(inp, ENTITIES);
      var bytes = PSGDocx.combined(TEMPLATE, data, { highlight: $("highlight").checked });
      saveBlob(bytes, BankStatementCore.fileTag(inp) + "_Bank_Statement_Request.docx");
    } catch (e) {
      showMessages({ errors: ["Could not build the document: " + (e && e.message ? e.message : e)], warnings: [] });
    }
  }

  window.PortalTools = window.PortalTools || {};
  window.PortalTools["bank-statement"] = { init: function () { if (started) return; started = true; load(); } };
})();
