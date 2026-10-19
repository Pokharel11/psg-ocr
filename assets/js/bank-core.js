/*
 * P.S.G. & Associates - Bank account-opening (Minute + application letter) core.
 * Pure logic shared by the browser (assets/js/bank.js) and the Node tests. Turns
 * the form inputs + the shared entity vocabulary (data/entities.yaml) into the
 * docxtemplater payload for templates/bank-account-template.docx. No DOM, no network.
 *
 * UMD: window.BankCore in the browser, module.exports in Node.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.BankCore = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var MONTHS = ["January", "February", "March", "April", "May", "June", "July",
    "August", "September", "October", "November", "December"];
  function ordSuffix(n) { var s = ["th", "st", "nd", "rd"], v = n % 100; return (s[(v - 20) % 10] || s[v] || s[0]); }
  function longAD(d) { return MONTHS[d.m - 1] + " " + d.d + ", " + d.y; }          // July 28, 2026
  function monthYear(d) { return MONTHS[d.m - 1] + " " + d.y; }                    // July 2026
  function adUTC(d) { return Date.UTC(d.y, d.m - 1, d.d); }
  function hisHer(title) { return /^mr/i.test(String(title || "").trim()) ? "His" : "Her"; }
  function titleName(p) { return ((p.title ? p.title + " " : "") + (p.name || "")).trim(); }

  // Operating instruction sentence (section 4). sigs = authorized signatories.
  function operatingInstruction(inp, entity) {
    var noun = entity.bank.noun;
    var kind = inp.operatingKind || "any_two";
    if (kind === "custom") return String(inp.operatingCustom || "").trim();
    var n = inp.signatories.length;
    var tail = ", along with the stamp of the " + noun + ".";
    var mand = (inp.mandatorySignatory != null && inp.signatories[inp.mandatorySignatory]) ? inp.signatories[inp.mandatorySignatory] : null;
    if (kind === "any_one") {
      return "The bank account shall be operated by the signature of any one of the above signatories" + tail;
    }
    // any_two or all
    var how;
    if (kind === "all") how = (n === 2) ? "both" : "all";
    else how = (n === 2) ? "both" : "any two";                 // any_two
    // "any two of the above" keeps the "of"; "all"/"both the above" drop it.
    var connector = (how === "any two") ? " of" : "";
    var core = "The bank account shall be operated by the joint signatures of " + how + connector + " the above signatories";
    if (mand) {
      if (kind === "any_two" && n > 2) {
        // "the signature of {Title} {Name} together with any one of the other signatories"
        core = "The bank account shall be operated by the signature of " + titleName(mand) + " together with any one of the other signatories";
      } else {
        core += ", one of whom shall be " + titleName(mand);
      }
    }
    return core + tail;
  }

  function group2(list) {
    var rows = [];
    for (var i = 0; i < list.length; i += 2) {
      var a = list[i], b = list[i + 1];
      rows.push({
        a_name: a.name, a_designation: a.designation,
        has_b: !!b, b_name: b ? b.name : "", b_designation: b ? b.designation : "",
      });
    }
    return rows;
  }

  function templateData(inp, entities) {
    var entity = entities[inp.entityType];
    var e = entity.bank;
    var chair = inp.members[inp.chairIndex != null ? inp.chairIndex : 0] || inp.members[0] || {};
    var single = inp.signatories.length === 1;
    var signers = (inp.applicationSigners && inp.applicationSigners.length) ? inp.applicationSigners : [chair];
    var appDate = inp.applicationDateAD || inp.meetingDateAD;

    var data = {
      has_minute: e.minute_title != null,
      minute_title: e.minute_title || "",
      noun: e.noun, noun_cap: e.noun_cap,
      entity_name: inp.entityName, entity_address: inp.entityAddress,
      meeting_date: longAD(inp.meetingDateAD), meeting_time: inp.meetingTime, meeting_location: inp.meetingLocation,
      chair_designation: chair.designation || e.chair_designation,
      members: inp.members.map(function (m) { return { m_title: m.title, m_name: m.name, m_designation: m.designation }; }),
      account_type: inp.accountType, currency: inp.currency, bank: inp.bank, bank_branch_address: inp.bankBranch,
      single_sig: single, multi_sig: !single,
      internet_banking: !!inp.internetBanking,
      letterhead: !!inp.letterhead,
      app_day: String(appDate.d), app_ord: ordSuffix(appDate.d), app_monthyear: monthYear(appDate),
      sig_rows: group2(signers),
    };
    if (single) {
      var s = inp.signatories[0];
      data.sole_title = s.title; data.sole_name = s.name; data.sole_hisher = hisHer(s.title);
    } else {
      data.signatories = inp.signatories.map(function (s) { return { s_title: s.title, s_name: s.name, s_designation: s.designation }; });
      data.operating_instruction = operatingInstruction(inp, entity);
    }
    return data;
  }

  function validate(inp, entities) {
    var errors = [], warnings = [];
    if (!inp.entityName) errors.push("Entity name is required.");
    if (!inp.members || !inp.members.length || !inp.members[0].name) errors.push("Add at least one member.");
    if (!inp.signatories || !inp.signatories.length) errors.push("Choose at least one authorized signatory.");
    if (!inp.bank) errors.push("Bank name is required.");
    if (!inp.bankBranch) errors.push("Bank branch address is required.");
    var entity = entities[inp.entityType], hasMinute = entity && entity.bank.minute_title != null;
    if (hasMinute && inp.members && inp.members.length) {
      var ci = inp.chairIndex != null ? inp.chairIndex : 0;
      if (ci < 0 || ci >= inp.members.length) errors.push("The meeting chair must be one of the members.");
    }
    // The operating instruction only applies with 2+ signatories; a single signatory
    // uses the single-signatory wording, so "any two" with one signatory is not an error.
    if (inp.applicationDateAD && inp.meetingDateAD && adUTC(inp.applicationDateAD) < adUTC(inp.meetingDateAD))
      errors.push("Application date must not be before the meeting date.");
    // duplicate member names
    var seen = {};
    (inp.members || []).forEach(function (m) { var k = (m.name || "").trim().toLowerCase(); if (k && seen[k]) warnings.push("Duplicate name: " + m.name + "."); if (k) seen[k] = 1; });
    (inp.signatories || []).forEach(function (s) { if (!s.designation) warnings.push("Signatory " + (s.name || "") + " has no designation."); });
    if (entity && entity.bank.verified !== true) warnings.push("Entity wording for " + inp.entityType + " is not yet verified.");
    return { errors: errors, warnings: warnings };
  }

  function shortName(name) { return (name || "Entity").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 28) || "Entity"; }
  function fileTag(inp) { var d = inp.meetingDateAD; return shortName(inp.entityName) + "_" + MONTHS[d.m - 1] + "_" + d.d + "_" + d.y; }

  return { templateData: templateData, validate: validate, operatingInstruction: operatingInstruction, longAD: longAD, ordSuffix: ordSuffix, fileTag: fileTag, shortName: shortName };
});
