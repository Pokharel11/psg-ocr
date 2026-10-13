/*
 * P.S.G. & Associates - audit letter generation core.
 * Pure logic shared by the browser UI (assets/js/audit-letters.js) and the Node
 * tests (scripts/audit-letters.test.js). No DOM, no network, nothing stored.
 *
 * Reuses the SAME Bikram Sambat calendar as the website compliance calendar
 * (nepali-date-converter). Produces structured "blocks" of "runs" ({text, hl})
 * that the renderer turns into a .docx. `hl` marks a filled-in value for the
 * optional review highlight; it never affects the text.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("nepali-date-converter"));
  } else {
    root.AuditCore = factory(root.NepaliDate);
  }
})(typeof self !== "undefined" ? self : this, function (ndModule) {
  "use strict";

  var NepaliDate = ndModule.default || ndModule;
  var CONFIG = ndModule.dateConfigMap;

  // Display month names (section 5) and the library's config keys (for day counts).
  var BS_MONTHS = ["Baisakh", "Jestha", "Ashad", "Shrawan", "Bhadra", "Ashoj", "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra"];
  var BS_CFG = ["Baisakh", "Jestha", "Asar", "Shrawan", "Bhadra", "Aswin", "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra"];
  var AD_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var ASHAD = 2; // month index of Ashad (FY end month)
  var DAY = 86400000;

  // Values that count as "filled in" (highlighted in review mode), matching the reference.
  var FILL_KEYS = {
    appointment_date_bs: 1, appointment_date_bs_short: 1, engagement_date_bs: 1,
    engagement_date_bs_short: 1, mrl_date_bs: 1, auditor_name_title: 1, firm_name: 1,
    entity_name: 1, fy_label: 1, fee_figure: 1, fee_figure_short: 1, fee_words: 1,
    vat_short: 1, vat_long: 1, signatory_name: 1, signatory_designation: 1, framework_full: 1,
  };

  // ---- numbers ----
  function ordinal(n) {
    var s = ["th", "st", "nd", "rd"], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }
  function groupIntl(intStr) { return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function groupNepali(intStr) {
    if (intStr.length <= 3) return intStr;
    var last3 = intStr.slice(-3), rest = intStr.slice(0, -3);
    return rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3;
  }
  function formatMoney(amount, decimals, grouping) {
    var neg = amount < 0; amount = Math.abs(amount);
    var fixed = amount.toFixed(decimals);
    var parts = fixed.split(".");
    var intPart = (grouping === "nepali" ? groupNepali : groupIntl)(parts[0]);
    return (neg ? "-" : "") + intPart + (parts[1] ? "." + parts[1] : "");
  }

  var ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  var TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  function twoWords(n) {
    if (n < 20) return ONES[n];
    var t = TENS[Math.floor(n / 10)], o = n % 10;
    return o ? t + " " + ONES[o] : t;
  }
  function threeWords(n) {
    var h = Math.floor(n / 100), r = n % 100, out = [];
    if (h) out.push(ONES[h] + " Hundred");
    if (r) out.push(twoWords(r));
    return out.join(" ");
  }
  // Nepali numbering (Thousand, Lakh, Crore, Arab), ending "Only"; paisa as "and Paisa NN".
  function amountInWords(amount) {
    var rupees = Math.floor(Math.abs(amount) + 1e-9);
    var paisa = Math.round((Math.abs(amount) - rupees) * 100);
    var parts = [];
    var arab = Math.floor(rupees / 1000000000); rupees %= 1000000000;
    var crore = Math.floor(rupees / 10000000); rupees %= 10000000;
    var lakh = Math.floor(rupees / 100000); rupees %= 100000;
    var thousand = Math.floor(rupees / 1000); rupees %= 1000;
    if (arab) parts.push(twoWords(arab) + " Arab");
    if (crore) parts.push(twoWords(crore) + " Crore");
    if (lakh) parts.push(twoWords(lakh) + " Lakh");
    if (thousand) parts.push(twoWords(thousand) + " Thousand");
    if (rupees) parts.push(threeWords(rupees));
    var words = parts.join(" ");
    if (!words) words = "Zero";
    if (paisa > 0) words += " and Paisa " + twoWords(paisa);
    return words + " Only";
  }

  // ---- BS/AD dates ----
  function bsMonthDays(y, m0) { var row = CONFIG[String(y)]; return row ? row[BS_CFG[m0]] : 32; }
  function bsToAdUTC(y, m0, day) { var ad = new NepaliDate(y, m0, day).getAD(); return Date.UTC(ad.year, ad.month, ad.date); }
  function adUTCtoBS(utc) { var d = new NepaliDate(new Date(utc + 12 * 3600000)); return { y: d.getYear(), m0: d.getMonth(), day: d.getDate() }; }
  function formatBS(y, m0, day) { return ordinal(day) + " " + BS_MONTHS[m0] + ", " + y; }
  function formatAD(utc) { var d = new Date(utc); return ordinal(d.getUTCDate()) + " " + AD_MONTHS[d.getUTCMonth()] + " " + d.getUTCFullYear(); }
  function addBSDays(y, m0, day, n) { return adUTCtoBS(bsToAdUTC(y, m0, day) + n * DAY); }

  // FY start year -> its Ashad end {bs, adUTC}
  function fyEnd(startYear) {
    var endY = startYear + 1, day = bsMonthDays(endY, ASHAD);
    return { y: endY, m0: ASHAD, day: day, adUTC: bsToAdUTC(endY, ASHAD, day) };
  }
  function fyShort(startYear) { return "FY " + startYear + "/" + String(startYear + 1).slice(-2); }
  function fyLabel(fromY, toY) { return fromY === toY ? fyShort(fromY) : fyShort(fromY) + " to " + fyShort(toY); }

  // ---- runs / placeholder resolution ----
  // ctx values are run-arrays. resolve() splices them into template literals.
  function run(text, hl) { return { text: text, hl: !!hl }; }
  function fill(value, key, hi) { return [run(value, hi && FILL_KEYS[key])]; }
  function resolve(template, ctx) {
    var out = [], re = /\{(\w+)\}/g, last = 0, m;
    while ((m = re.exec(template))) {
      if (m.index > last) out.push(run(template.slice(last, m.index), false));
      var v = ctx[m[1]];
      if (v == null) out.push(run(m[0], false));
      else if (typeof v === "string") out.push(run(v, false));
      else out.push.apply(out, v);
      last = re.lastIndex;
    }
    if (last < template.length) out.push(run(template.slice(last), false));
    return out;
  }
  function runsText(runs) { return runs.map(function (r) { return r.text; }).join(""); }
  function collapse(s) { return String(s).replace(/\s+/g, " ").trim(); }

  // ---- vocabulary ----
  function framework(rules, key, entity) {
    var f = rules.frameworks[key];
    var stmts = f.statements.map(function (s) { return s === "{equity_statement}" ? entity.equity_statement : s; });
    return { full: f.full, statements: stmts };
  }
  function joinList(arr) {
    if (arr.length === 1) return arr[0];
    return arr.slice(0, -1).join(", ") + " and " + arr[arr.length - 1];
  }

  // ---- build context ----
  function buildContext(inputs, rules, hi) {
    var entity = rules.entities[inputs.entityType];
    var fw = framework(rules, inputs.framework, entity);
    var ctx = {};
    // vocab (not highlighted)
    ["noun", "our_noun", "owners", "owners_short", "governance_body", "representation_givers",
      "representation_givers_short", "statute", "statute_with_amendment", "equity_statement"].forEach(function (k) {
      ctx[k] = [run(entity[k], false)];
    });
    ctx.engagement_addressee = [run(entity.engagement_addressee, false)];
    ctx.framework_full = fill(fw.full, "framework_full", hi);
    ctx.entity_name = fill(inputs.entityName, "entity_name", hi);
    ctx.firm_name = fill(inputs.firmName, "firm_name", hi);
    ctx.signatory_name = fill(inputs.signatoryName, "signatory_name", hi);
    ctx.signatory_designation = fill(inputs.signatoryDesignation, "signatory_designation", hi);

    // FY
    var fromY = inputs.fromFY, toY = inputs.toFY, isRange = fromY !== toY;
    ctx.fy_label = fill(fyLabel(fromY, toY), "fy_label", hi);
    var ends = [];
    for (var y = fromY; y <= toY; y++) ends.push(fyEnd(y));
    var lastEnd = ends[ends.length - 1];

    // dates
    var ap = inputs.appointmentBS; // {y, m0, day}
    var eng = inputs.engagementBS || addBSDays(ap.y, ap.m0, ap.day, 1);
    var mrl = inputs.mrlBS;
    ctx.appointment_date_bs = fill(formatBS(ap.y, ap.m0, ap.day), "appointment_date_bs", hi);
    ctx.appointment_date_bs_short = fill(formatBS(ap.y, ap.m0, ap.day), "appointment_date_bs_short", hi);
    ctx.engagement_date_bs = fill(formatBS(eng.y, eng.m0, eng.day), "engagement_date_bs", hi);
    ctx.engagement_date_bs_short = fill(formatBS(eng.y, eng.m0, eng.day), "engagement_date_bs_short", hi);
    ctx.mrl_date_bs = fill(formatBS(mrl.y, mrl.m0, mrl.day), "mrl_date_bs", hi);
    ctx.fy_end_ad_last = fill(formatAD(lastEnd.adUTC), "appointment_date_bs", hi); // highlighted date

    // engagement statement list + period clause
    ctx.fs_lead = [run(fw.statements[0], false)];
    ctx.fs_rest = [run(joinList(fw.statements.slice(1)), false)];
    if (isRange) {
      ctx.fy_of = [run("", false)];
      var endBsList = ends.map(function (e) { return formatBS(e.y, e.m0, e.day); });
      ctx.period_clause = [run("for the fiscal years " + fyShort(fromY) + " to " + fyShort(toY) + ", ending on " + joinList(endBsList) + " respectively", false)];
      var endAdList = ends.map(function (e) { return formatAD(e.adUTC); });
      ctx.period_ended = [run("for the periods ended on " + joinList(endAdList), false)];
    } else {
      ctx.fy_of = [run(" of " + fyLabel(fromY, toY), false)];
      ctx.period_clause = [run("for the year ending on " + formatBS(lastEnd.y, lastEnd.m0, lastEnd.day), false)];
      ctx.period_ended = [run("for the period ended on " + formatAD(lastEnd.adUTC), false)];
    }

    // fee + vat
    var grouping = inputs.grouping || "international";
    ctx.fee_figure = fill(formatMoney(inputs.fee, 2, grouping), "fee_figure", hi);
    ctx.fee_figure_short = fill(formatMoney(inputs.fee, 0, grouping), "fee_figure_short", hi);
    ctx.fee_words = fill(amountInWords(inputs.fee), "fee_words", hi);
    ctx.vat_short = fill(inputs.vat === "inclusive" ? "including VAT" : "excluding VAT", "vat_short", hi);
    ctx.vat_long = fill(inputs.vat === "inclusive" ? "inclusive of Value Added Tax" : "exclusive of Value Added Tax", "vat_long", hi);
    var pys = "";
    if (isRange) pys = inputs.feeBasis === "peryear" ? " per fiscal year" : " for all the above fiscal years";
    ctx.per_year_suffix = [run(pys, false)];

    // auditor
    var baseName = inputs.auditorName.replace(/^CA\s+/i, "");
    ctx.auditor_name_title = fill(inputs.auditorTitle + " " + baseName, "auditor_name_title", hi);
    ctx.auditor_prefix_name = fill("CA " + baseName, "auditor_name_title", hi);
    ctx.auditor_designation = [run(inputs.auditorDesignation, false)];
    ctx.firm_city = [run(inputs.firmCity, false)];
    ctx.entity_address = fill(inputs.entityAddress, "entity_name", hi);

    return { ctx: ctx, entity: entity, framework: fw, ends: ends, lastEnd: lastEnd, isRange: isRange };
  }

  // ---- helpers to make blocks ----
  function P(runs, align) { return { type: "para", runs: runs, align: align || "both" }; }
  function L(runs, align) { return { type: "line", runs: runs, align: align || "left" }; }
  function TXT(s) { return [run(s, false)]; }

  // ---- letter builders ----
  function appointment(inputs, rules, c) {
    var ctx = c.ctx, b = [];
    b.push(L(resolve("Date: {appointment_date_bs}", ctx)));
    b.push({ type: "blank" });
    b.push(L(resolve("{auditor_name_title},", ctx)));
    b.push(L(resolve("{firm_name},", ctx)));
    b.push(L(TXT("Chartered Accountants")));
    b.push(L(resolve("{firm_city}, Nepal", ctx)));
    b.push({ type: "blank" });
    b.push({ type: "subject", runs: TXT("Sub: " + rules.appointment.subject) });
    b.push({ type: "blank" });
    b.push(P(resolve("Dear {auditor_name_title},", ctx), "left"));
    b.push({ type: "blank" });
    b.push(P(resolve(collapse(rules.appointment.body), ctx)));
    b.push({ type: "blank" });
    b.push(L(TXT(rules.appointment.closing)));
    b.push({ type: "blank" });
    b.push({ type: "sigline" });
    b.push(L(resolve("{signatory_name}", ctx)));
    b.push(L(resolve("{signatory_designation}", ctx)));
    b.push(L(resolve("{entity_name}", ctx)));
    return b;
  }

  function engagement(inputs, rules, c) {
    var ctx = c.ctx, e = rules.engagement, b = [];
    b.push(L(resolve("{engagement_date_bs}", ctx)));
    b.push(L(resolve(c.entity.engagement_addressee, {})));
    b.push(L(resolve("{entity_name}", ctx)));
    b.push(L(resolve("{entity_address}", ctx)));
    b.push({ type: "subject", runs: resolve("Sub: " + e.subject, ctx) });
    b.push({ type: "blank" });
    b.push(P(resolve(e.salutation, ctx), "left"));
    e.paragraphs.forEach(function (p) { b.push(P(resolve(collapse(p), ctx))); });
    b.push({ type: "blank" });
    b.push(L(TXT(e.closing)));
    b.push({ type: "blank" });
    // two-column acknowledgement
    b.push({
      type: "twocol",
      left: [resolve("{auditor_prefix_name}", ctx), resolve("{auditor_designation}", ctx)],
      right: [TXT(e.acknowledgement), resolve("{entity_name}", ctx), resolve("{signatory_name}", ctx), resolve("Date: {engagement_date_bs_short}", ctx)],
    });
    return b;
  }

  function mrl(inputs, rules, c) {
    var ctx = c.ctx, m = rules.mrl, b = [];
    b.push(L(resolve("Date: {mrl_date_bs}", ctx)));
    b.push(L(TXT("To,")));
    b.push(L(resolve("{auditor_prefix_name}", ctx)));
    b.push(L(resolve("M/s {firm_name},", ctx)));
    b.push(L(TXT("Chartered Accountants")));
    b.push(L(resolve("{firm_city}, Nepal", ctx)));
    b.push({ type: "blank" });
    b.push(P(resolve(m.salutation, ctx), "left"));
    b.push(P(resolve(collapse(m.opening), ctx)));
    // numbered representations, grouped
    var groups = [["liabilities", m.headings.liabilities], ["assets", m.headings.assets], ["other", m.headings.other]];
    var paras = m.paragraphs.slice();
    if (m.npo_optional && m.npo_optional.enabled && m.npo_optional.verified && inputs.entityType === "NPO") {
      paras = paras.concat(m.npo_optional.paragraphs);
    }
    groups.forEach(function (g) {
      var inGroup = paras.filter(function (p) {
        if (p.group !== g[0]) return false;
        return !p.applies_to || p.applies_to.indexOf(inputs.entityType) !== -1;
      });
      if (!inGroup.length) return;
      b.push({ type: "heading", runs: TXT(g[1]) });
      inGroup.forEach(function (p) {
        var txt = (p.variants && p.variants[inputs.entityType]) || p.text;
        b.push({ type: "numbered", runs: resolve(collapse(txt), ctx) });
      });
    });
    b.push({ type: "blank" });
    b.push(P(resolve(collapse(m.closing_sentence), ctx)));
    b.push({ type: "blank" });
    b.push(L(TXT(m.closing)));
    b.push({ type: "blank" });
    b.push(L(resolve("{signatory_name}", ctx)));
    b.push(L(resolve("{signatory_designation}", ctx)));
    b.push(L(resolve("{entity_name}", ctx)));
    return b;
  }

  // ---- public API ----
  // Collapse a doubled period at a run boundary, e.g. a value ending "Ltd." followed
  // by a literal ". This..." -> "Ltd. This...". Leaves ellipses (...) untouched.
  function tidyRuns(rs) {
    for (var i = 1; i < rs.length; i++) {
      if (/\.$/.test(rs[i - 1].text) && /^\.(?!\.)/.test(rs[i].text)) rs[i] = run(rs[i].text.slice(1), rs[i].hl);
    }
    return rs;
  }
  function tidy(blocks) {
    blocks.forEach(function (bl) {
      if (bl.runs) tidyRuns(bl.runs);
      if (bl.type === "twocol") { bl.left.forEach(tidyRuns); bl.right.forEach(tidyRuns); }
    });
    return blocks;
  }

  function generate(inputs, rules, opts) {
    opts = opts || {};
    var hi = !!inputs.highlight;
    var c = buildContext(inputs, rules, hi);
    return {
      appointment: tidy(appointment(inputs, rules, c)),
      engagement: tidy(engagement(inputs, rules, c)),
      mrl: tidy(mrl(inputs, rules, c)),
      context: c,
    };
  }
  // ---- docxtemplater payload ----
  // Flat values + MRL group arrays for the reference-based .docx template
  // (templates/audit-letter-template.docx). Uses the SAME computations and the
  // SAME YAML as generate()/letterText(), so the filled template reads identically.
  function resolveText(tmpl, ctx) { return runsText(resolve(tmpl, ctx)); }
  function templateData(inputs, rules) {
    var c = buildContext(inputs, rules, false), ctx = c.ctx, t = {};
    function s(k) { return runsText(ctx[k]); }
    ["entity_name", "fy_label", "fee_figure", "fee_figure_short", "fee_words", "vat_short", "vat_long",
      "framework_full", "signatory_name", "signatory_designation", "statute", "statute_with_amendment",
      "representation_givers", "representation_givers_short", "auditor_designation", "firm_name", "firm_city",
      "entity_address", "engagement_addressee", "noun", "per_year_suffix", "fs_lead", "fy_of", "fs_rest",
      "period_clause", "period_ended", "fy_end_ad_last"].forEach(function (k) { t[k] = s(k); });
    t.appointment_date = s("appointment_date_bs");
    t.appointment_date_short = s("appointment_date_bs_short");
    t.engagement_date = s("engagement_date_bs");
    t.mrl_date = s("mrl_date_bs");
    t.auditor_title = inputs.auditorTitle;
    t.auditor_name = (inputs.auditorName || "").replace(/^CA\s+/i, "");
    t.auditor_prefix_name = s("auditor_prefix_name");
    // MRL groups: same filter/variant selection as mrl()
    var m = rules.mrl, paras = m.paragraphs.slice();
    if (m.npo_optional && m.npo_optional.enabled && m.npo_optional.verified && inputs.entityType === "NPO")
      paras = paras.concat(m.npo_optional.paragraphs);
    function grp(g) {
      return paras.filter(function (p) {
        return p.group === g && (!p.applies_to || p.applies_to.indexOf(inputs.entityType) !== -1);
      }).map(function (p) {
        var txt = (p.variants && p.variants[inputs.entityType]) || p.text;
        return collapse(resolveText(collapse(txt), ctx));
      });
    }
    t.liabilities = grp("liabilities"); t.assets = grp("assets"); t.other = grp("other");
    return t;
  }

  // Flatten one letter's blocks to plain text (for tests).
  function letterText(blocks) {
    var lines = [];
    blocks.forEach(function (bl) {
      if (bl.type === "blank") return;
      if (bl.type === "sigline") { lines.push("_____________"); return; }
      if (bl.type === "twocol") {
        bl.left.forEach(function (r) { lines.push(runsText(r)); });
        bl.right.forEach(function (r) { lines.push(runsText(r)); });
        return;
      }
      lines.push(runsText(bl.runs));
    });
    return lines.join("\n");
  }

  function validate(inputs) {
    var errors = [], warnings = [];
    if (!inputs.entityName) errors.push("Entity name is required.");
    if (!(inputs.fee > 0)) errors.push("Audit fee must be greater than zero.");
    if (inputs.fromFY > inputs.toFY) errors.push("From FY must not be after To FY.");
    if (inputs.toFY - inputs.fromFY + 1 > 5) warnings.push("The fiscal-year range exceeds 5 years.");
    var lastEnd = fyEnd(inputs.toFY);
    var mrlUTC = bsToAdUTC(inputs.mrlBS.y, inputs.mrlBS.m0, inputs.mrlBS.day);
    if (mrlUTC <= lastEnd.adUTC) errors.push("MRL date must be after the last fiscal-year end.");
    var apUTC = bsToAdUTC(inputs.appointmentBS.y, inputs.appointmentBS.m0, inputs.appointmentBS.day);
    var engIn = inputs.engagementBS ? bsToAdUTC(inputs.engagementBS.y, inputs.engagementBS.m0, inputs.engagementBS.day) : apUTC + DAY;
    if (engIn <= apUTC) errors.push("Engagement date must be after the appointment date.");
    if (apUTC - lastEnd.adUTC > 366 * DAY) warnings.push("Appointment date is more than 12 months after the last fiscal-year end.");
    var ent = inputs.entityType;
    var fw = inputs.framework;
    if (ent === "NPO" && fw !== "NAS for NPOs") warnings.push("NFRS / NAS for MEs is unusual for an NPO; NAS for NPOs is expected.");
    if (ent !== "NPO" && fw === "NAS for NPOs") warnings.push("NAS for NPOs is intended for NPOs, not a " + (ent || "non-NPO") + ".");
    return { errors: errors, warnings: warnings };
  }

  return {
    generate: generate, letterText: letterText, templateData: templateData, runsText: runsText, validate: validate,
    amountInWords: amountInWords, formatMoney: formatMoney, ordinal: ordinal,
    formatBS: formatBS, formatAD: formatAD, fyEnd: fyEnd, fyLabel: fyLabel, fyShort: fyShort,
    addBSDays: addBSDays, bsMonthDays: bsMonthDays, BS_MONTHS: BS_MONTHS, collapse: collapse,
  };
});
