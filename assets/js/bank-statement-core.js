/*
 * P.S.G. & Associates - Bank Statement Request core (pure logic, no DOM/network).
 * Turns the form inputs + shared entity vocabulary (data/entities.yaml) into the
 * docxtemplater payload for templates/bank-statement-template.docx. Shared date
 * and signature-block helpers come from common/bank-common.js.
 *
 * UMD: window.BankStatementCore in the browser, module.exports in Node.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./common/bank-common"));
  else root.BankStatementCore = factory(root.BankCommon);
})(typeof self !== "undefined" ? self : this, function (BankCommon) {
  "use strict";

  var ordinalParts = BankCommon.ordinalParts;
  var fmtYMD = BankCommon.fmtYMD;
  var titleName = BankCommon.titleName;
  var group2 = BankCommon.group2;
  var shortName = BankCommon.shortName;
  var MONTHS = BankCommon.MONTHS;

  function cmp(a, b) { return (a.y - b.y) || (a.m - b.m) || (a.d - b.d); }

  // "Account No. X" / "Account Nos. X and Y" / "Account Nos. X, Y and Z"
  function accountList(nums) {
    if (nums.length <= 1) return "Account No. " + (nums[0] || "");
    if (nums.length === 2) return "Account Nos. " + nums[0] + " and " + nums[1];
    return "Account Nos. " + nums.slice(0, -1).join(", ") + " and " + nums[nums.length - 1];
  }

  // "A and B" / "A, B and C"
  function joinAnd(list) {
    if (list.length <= 1) return list[0] || "";
    if (list.length === 2) return list[0] + " and " + list[1];
    return list.slice(0, -1).join(", ") + " and " + list[list.length - 1];
  }

  function authorizationSentence(persons, statementWord, noun) {
    var names = persons.map(titleName);
    var verb = names.length > 1 ? "are" : "is";
    return joinAnd(names) + " " + verb + " hereby authorized to sign the application, submit it to the bank, "
      + "and collect the bank " + statementWord + " on behalf of the " + noun + ".";
  }

  function templateData(inp, entities) {
    var entity = entities[inp.entityType];
    var bank = entity.bank, st = entity.bank_statement || {};
    var noun = bank.noun;
    var hasMinute = st.minute_title != null;

    var nums = (inp.accounts || []).map(function (a) { return String(a.number || "").trim(); }).filter(Boolean);
    var plural = nums.length > 1;
    var accountWord = plural ? "accounts" : "account";
    var statementWord = plural ? "statements" : "statement";

    var ltr = ordinalParts(inp.letterDateAD || inp.meetingDateAD);
    var mtg = ordinalParts(inp.meetingDateAD);
    var bs = inp.dateSystem === "BS" ? " (B.S.)" : "";

    var members = (inp.members || []).map(function (m) {
      return { m_title: m.title, m_name: m.name, m_designation: m.designation };
    });
    var ci = inp.chairIndex != null ? inp.chairIndex : 0;
    var chair = (inp.members || [])[ci] || (inp.members || [])[0] || {};

    var auth = inp.authorized || [];
    var single = auth.length === 1;

    var data = {
      // letter
      letterhead: !!inp.letterhead,
      entity_name: inp.entityName, entity_address: inp.entityAddress,
      ltr_day: ltr.day, ltr_ord: ltr.ord, ltr_monthyear: ltr.monthyear,
      bank: inp.bank, bank_address: inp.bankAddress, branch: inp.branch,
      noun: noun, account_word: accountWord, statement_word: statementWord,
      from: fmtYMD(inp.fromDate), to: fmtYMD(inp.toDate), bs: bs,
      account_name: (inp.accountName && inp.accountName.trim()) || inp.entityName,
      accounts: nums.map(function (n) { return { number: n }; }),
      account_list: accountList(nums),
      purpose: inp.purpose,
      sig_single: single, sig_multi: !single,
      // minute
      has_minute: hasMinute,
      entity_name_caps: (inp.entityName || "").toUpperCase(),
      entity_address_caps: (inp.entityAddress || "").toUpperCase(),
      minute_title: st.minute_title || "",
      mtg_day: mtg.day, mtg_ord: mtg.ord, mtg_monthyear: mtg.monthyear,
      meeting_time: inp.meetingTime,
      present_word: st.present_word || "",
      meeting_of: st.meeting_of || "",
      office: st.office || "",
      members_word: st.members_word || "",
      members: members,
      chair_title: chair.title || "", chair_name: chair.name || "",
      presence_sentence: inp.allPresent
        ? "All " + (st.members_word || "members") + " were present"
        : "The " + (st.members_word || "members") + " listed above were present, forming the quorum",
      authorization: authorizationSentence(auth, statementWord, noun),
    };
    if (single) {
      data.sole_name = auth[0].name; data.sole_designation = auth[0].designation;
    } else {
      data.sig_rows = group2(auth.map(function (p) { return { name: p.name, designation: p.designation }; }));
    }
    return data;
  }

  function validate(inp, entities) {
    var errors = [], warnings = [];
    var entity = entities[inp.entityType] || {};
    var st = entity.bank_statement || {};
    var hasMinute = st.minute_title != null;

    if (!inp.entityName) errors.push("Entity name is required.");
    if (!inp.bank) errors.push("Bank name is required.");
    if (!inp.branch) errors.push("Branch name is required.");

    var nums = (inp.accounts || []).map(function (a) { return String(a.number || "").trim(); }).filter(Boolean);
    if (!nums.length) errors.push("Add at least one account number.");
    var seen = {};
    nums.forEach(function (n) { if (seen[n]) warnings.push("Duplicate account number: " + n + "."); seen[n] = 1; });

    if (inp.fromDate && inp.toDate && cmp(inp.fromDate, inp.toDate) > 0)
      errors.push("The 'from' date must not be after the 'to' date.");
    // Warn if the period end is after the letter date (AD periods only — same calendar).
    if (inp.dateSystem !== "BS" && inp.toDate && inp.letterDateAD && cmp(inp.toDate, inp.letterDateAD) > 0)
      warnings.push("The statement 'to' date is after the letter date.");

    var auth = inp.authorized || [];
    if (!auth.length) errors.push("Choose at least one authorized person.");
    if (hasMinute && (inp.members || []).length) {
      var names = {};
      (inp.members || []).forEach(function (m) { if (m.name) names[m.name.trim().toLowerCase()] = 1; });
      auth.forEach(function (p) {
        if (p.name && !names[p.name.trim().toLowerCase()]) warnings.push("Authorized person " + p.name + " is not on the member list.");
      });
      var ci = inp.chairIndex != null ? inp.chairIndex : 0;
      if (ci < 0 || ci >= inp.members.length) errors.push("The meeting chair must be one of the members.");
    }
    auth.forEach(function (p) { if (!p.designation) warnings.push("Authorized person " + (p.name || "") + " has no designation."); });
    if (st.verified !== true) warnings.push("Statement-request wording for " + inp.entityType + " is not yet verified.");
    return { errors: errors, warnings: warnings };
  }

  function fileTag(inp) {
    var d = inp.letterDateAD || inp.meetingDateAD;
    return shortName(inp.entityName) + "_" + MONTHS[d.m - 1] + "_" + d.d + "_" + d.y;
  }

  return {
    templateData: templateData, validate: validate, fileTag: fileTag,
    accountList: accountList, authorizationSentence: authorizationSentence,
  };
});
