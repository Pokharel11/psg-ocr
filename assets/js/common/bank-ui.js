/*
 * P.S.G. & Associates - shared Bank Docs UI helpers (browser only).
 * The members editor (title / name / designation + per-row toggles and the chair
 * radio), the entity dropdown + designation datalist, and the letterhead toggle,
 * shared by BOTH Bank Docs tools (Account Opening and Statement Request). Each
 * tool mounts the editor with its own id prefix so the two panes never collide.
 *
 * window.BankUI (no Node use).
 */
(function (root) {
  "use strict";
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function addOpt(sel, value, text) { var o = document.createElement("option"); o.value = value; o.textContent = text; sel.appendChild(o); }

  function fillEntitySelect(sel, entities, order) {
    order.forEach(function (k) { if (entities[k]) addOpt(sel, k, k); });
  }
  function fillDesignations(dl, entity) {
    var ds = (entity && entity.bank && entity.bank.member_designations) || [];
    dl.innerHTML = ds.map(function (d) { return "<option>" + esc(d) + "</option>"; }).join("");
  }

  // cfg: { prefix, container, addBtn, extras:[{type:'checkbox'|'radio', field, label, checked?}], onChange }
  // Every row has Title / Full name / Designation (datalist id "<prefix>-desigs").
  // A radio extra becomes a group named "<prefix>-<field>"; 'chair' is treated as
  // the chairing radio (exactly one selected).
  function MembersEditor(cfg) {
    this.p = cfg.prefix;
    this.box = cfg.container;
    this.extras = cfg.extras || [];
    this.onChange = cfg.onChange || function () {};
    var self = this;
    if (cfg.addBtn) cfg.addBtn.addEventListener("click", function () { self.add(); self.onChange(); });
    this.box.addEventListener("click", function (e) {
      var rm = e.target.closest("[data-remove]");
      if (rm) { var b = rm.closest("[data-member]"); if (b) { b.remove(); self.renumber(); self.onChange(); } }
    });
  }
  MembersEditor.prototype.rowHtml = function () {
    var p = this.p;
    var controls = this.extras.map(function (x) {
      if (x.type === "radio") {
        return '<label><input type="radio" name="' + p + "-" + x.field + '" data-f="' + x.field + '"> ' + x.label + "</label>";
      }
      return '<label><input type="checkbox" data-f="' + x.field + '"' + (x.checked ? " checked" : "") + "> " + x.label + "</label>";
    }).join("");
    return '<button type="button" class="remove-btn" data-remove>&times;</button>' +
      '<div class="director-block-title" data-num>Member</div>' +
      '<div class="field-grid">' +
      '<div class="field-group"><label>Title</label><select data-f="title"><option>Mr.</option><option>Ms.</option><option>Mrs.</option></select></div>' +
      '<div class="field-group"><label>Full name</label><input data-f="name" placeholder="Full name"></div>' +
      '<div class="field-group"><label>Designation</label><input data-f="designation" list="' + p + '-desigs" placeholder="Designation"></div>' +
      "</div>" +
      (controls ? '<div class="radios" style="margin-top:10px;">' + controls + "</div>" : "");
  };
  MembersEditor.prototype.add = function () {
    var d = document.createElement("div");
    d.className = "director-block"; d.setAttribute("data-member", "");
    d.innerHTML = this.rowHtml();
    this.box.appendChild(d);
    this.ensureChair();
    this.renumber();
    return d;
  };
  MembersEditor.prototype.rows = function () {
    return Array.prototype.slice.call(this.box.querySelectorAll("[data-member]"));
  };
  MembersEditor.prototype.ensureChair = function () {
    if (!this.extras.some(function (x) { return x.field === "chair"; })) return;
    if (!this.box.querySelector('input[name="' + this.p + '-chair"]:checked')) {
      var first = this.box.querySelector('[data-member] [data-f="chair"]');
      if (first) first.checked = true;
    }
  };
  MembersEditor.prototype.renumber = function () {
    this.rows().forEach(function (b, i) { var t = b.querySelector("[data-num]"); if (t) t.textContent = "Member " + (i + 1); });
    this.ensureChair();
  };
  function fval(b, name) { var el = b.querySelector('[data-f="' + name + '"]'); return el ? el.value.trim() : ""; }
  MembersEditor.prototype.rowData = function (b) { return { title: fval(b, "title"), name: fval(b, "name"), designation: fval(b, "designation") }; };
  MembersEditor.prototype.members = function () { var self = this; return this.rows().map(function (b) { return self.rowData(b); }); };
  MembersEditor.prototype.chairIndex = function () {
    var rows = this.rows();
    for (var i = 0; i < rows.length; i++) { var c = rows[i].querySelector('[data-f="chair"]'); if (c && c.checked) return i; }
    return 0;
  };
  // Members whose checkbox <field> is ticked (e.g. "sig", "auth", "signs").
  MembersEditor.prototype.where = function (field) {
    var self = this, out = [];
    this.rows().forEach(function (b) { var c = b.querySelector('[data-f="' + field + '"]'); if (c && c.checked) out.push(self.rowData(b)); });
    return out;
  };

  root.BankUI = {
    fillEntitySelect: fillEntitySelect,
    fillDesignations: fillDesignations,
    MembersEditor: MembersEditor,
  };
})(typeof self !== "undefined" ? self : this);
