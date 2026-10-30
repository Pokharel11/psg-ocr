/*
 * Staff portal shell. Three compartments (OCR Docs, Audit Docs, Bank Docs) on one
 * page; switching compartments or opening a tool happens here with no change of
 * address. Each tool's heavy scripts load only the first time it is opened, then its
 * init() runs once. Tool panes stay in the DOM (just hidden) so half-filled forms
 * survive switching. The last-used compartment is remembered in localStorage.
 *
 * To add a tool: drop its markup partial into the compartment (lib/ui.php), give its
 * card data-open-tool="<id>", register window.PortalTools["<id>"] = { init } in its
 * module, and list the module's scripts under SCRIPTS below. One entry, no layout
 * change — that is how "Statement Request" will be added to Bank Docs later.
 */
(function () {
  "use strict";
  var V = "20261030";

  // Registry: tool id -> ordered list of scripts to load on first open. The last
  // script in each list registers window.PortalTools[id] = { init }. Dependencies
  // first. Bank Account Opening is a Stage-2 stub for now (no scripts).
  var SCRIPTS = {
    ocr: [
      "assets/js/docx.min.js",
      "assets/js/js-yaml.min.js",
      "assets/js/pizzip.min.js",
      "assets/js/nepali-date.umd.js",
      "assets/js/common/psg-num.js",
      "assets/js/common/psg-bsdate.js",
      "assets/js/ocr-core.js",
      "assets/js/app.js?v=" + V
    ],
    "ocr-initial": [
      "assets/js/docx.min.js",
      "assets/js/js-yaml.min.js",
      "assets/js/pizzip.min.js",
      "assets/js/nepali-date.umd.js",
      "assets/js/common/psg-num.js",
      "assets/js/common/psg-bsdate.js",
      "assets/js/ocr-core.js",
      "assets/js/ocr-initial-core.js?v=" + V,
      "assets/js/ocr-initial.js?v=" + V
    ],
    audit: [
      "assets/js/js-yaml.min.js",
      "assets/js/nepali-date.umd.js",
      "assets/js/pizzip.min.js",
      "assets/js/docxtemplater.min.js",
      "assets/js/common/psg-num.js",
      "assets/js/common/psg-bsdate.js",
      "assets/js/common/docx-engine.js",
      "assets/js/audit-letters-core.js",
      "assets/js/audit-letters-render.js",
      "assets/js/audit-letters.js?v=" + V
    ],
    "bank-account": [
      "assets/js/js-yaml.min.js",
      "assets/js/pizzip.min.js",
      "assets/js/docxtemplater.min.js",
      "assets/js/common/docx-engine.js",
      "assets/js/common/bank-common.js",
      "assets/js/common/bank-ui.js",
      "assets/js/bank-core.js",
      "assets/js/bank.js?v=" + V
    ],
    "bank-statement": [
      "assets/js/js-yaml.min.js",
      "assets/js/nepali-date.umd.js",
      "assets/js/pizzip.min.js",
      "assets/js/docxtemplater.min.js",
      "assets/js/common/psg-num.js",
      "assets/js/common/psg-bsdate.js",
      "assets/js/common/docx-engine.js",
      "assets/js/common/bank-common.js",
      "assets/js/common/bank-ui.js",
      "assets/js/bank-statement-core.js",
      "assets/js/bank-statement.js?v=" + V
    ],
    "tax-balance": [
      "assets/js/pizzip.min.js",
      "assets/js/docxtemplater.min.js",
      "assets/js/xlsx.full.min.js",
      "assets/js/nepali-date.umd.js",
      "assets/js/common/psg-num.js",
      "assets/js/common/psg-bsdate.js",
      "assets/js/common/docx-engine.js",
      "assets/js/balance-confirmation-core.js",
      "assets/js/balance-confirmation-xlsx.js",
      "assets/js/balance-confirmation.js?v=" + V
    ]
  };

  var LS_KEY = "psgocr.compartment";
  var loaded = {};
  function qs(s, r) { return (r || document).querySelector(s); }
  function qsa(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

  // A shared library listed by two tools (docx, ocr-core, the date helpers) is loaded once.
  var scriptLoads = {};
  function loadScript(src) {
    var key = src.split("?")[0];
    if (scriptLoads[key]) return scriptLoads[key];
    return scriptLoads[key] = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src; s.async = false; // keep order
      s.onload = resolve;
      s.onerror = function () { delete scriptLoads[key]; reject(new Error("Failed to load " + src)); };
      document.body.appendChild(s);
    });
  }
  function loadSeq(list) {
    return list.reduce(function (p, src) { return p.then(function () { return loadScript(src); }); }, Promise.resolve());
  }

  var VALID = { "ocr-docs": 1, "audit-docs": 1, "bank-docs": 1, "tax-docs": 1 };

  function showCompartment(id, save) {
    if (!VALID[id]) id = "ocr-docs";
    qsa("[data-compartments] .comp-tab").forEach(function (t) {
      t.classList.toggle("is-active", t.getAttribute("data-compartment") === id);
    });
    qsa(".portal > .compartment").forEach(function (sec) {
      sec.hidden = sec.getAttribute("data-compartment") !== id;
    });
    if (save !== false) { try { localStorage.setItem(LS_KEY, id); } catch (e) {} }
  }

  function openTool(section, tool) {
    if (!section) return;
    var cards = qs(".tool-cards", section); if (cards) cards.hidden = true;
    var head = qs(".compartment-head", section); if (head) head.hidden = true;
    var pane = qs('.tool-pane[data-tool="' + tool + '"]', section);
    if (!pane) return;
    pane.hidden = false;
    if (loaded[tool]) return;
    loaded[tool] = true;
    var scripts = SCRIPTS[tool] || [];
    if (!scripts.length) return; // stub tool (no code yet)
    loadSeq(scripts).then(function () {
      if (window.PortalTools && window.PortalTools[tool] && typeof window.PortalTools[tool].init === "function") {
        window.PortalTools[tool].init();
      }
    }).catch(function (e) {
      loaded[tool] = false; // allow a retry on next open
      if (window.console) console.error(e);
    });
  }

  function backToCards(section) {
    if (!section) return;
    var cards = qs(".tool-cards", section); if (cards) cards.hidden = false;
    var head = qs(".compartment-head", section); if (head) head.hidden = false;
    qsa(".tool-pane", section).forEach(function (p) { p.hidden = true; });
  }

  document.addEventListener("click", function (e) {
    var tab = e.target.closest("[data-compartments] .comp-tab");
    if (tab) { showCompartment(tab.getAttribute("data-compartment")); return; }
    var openBtn = e.target.closest("[data-open-tool]");
    if (openBtn) { openTool(openBtn.closest(".compartment"), openBtn.getAttribute("data-open-tool")); return; }
    var back = e.target.closest("[data-back]");
    if (back) { backToCards(back.closest(".compartment")); return; }
  });

  // Initial compartment: the URL's default wins (so / -> OCR, /audit-letters.php ->
  // Audit keep working as before); otherwise the remembered one; otherwise OCR.
  var forced = (document.body.getAttribute("data-default-compartment") || "").trim();
  var last = ""; try { last = localStorage.getItem(LS_KEY) || ""; } catch (e) {}
  showCompartment(VALID[forced] ? forced : (VALID[last] ? last : "ocr-docs"));
})();
