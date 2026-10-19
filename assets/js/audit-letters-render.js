/*
 * P.S.G. & Associates - audit letter rendering (thin wrapper over the shared
 * engine, assets/js/common/docx-engine.js). Fills the reference-based template
 * (templates/audit-letter-template.docx) and, for the three-file download, splits
 * it at the two letter-boundary page breaks into Appointment / Engagement / MRL.
 *
 * Kept as AuditRender.{combined,separate,fillZip} so the audit UI, tests and sample
 * script are unchanged. Shared by the browser and the Node scripts.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./common/docx-engine"));
  } else {
    root.AuditRender = factory(root.PSGDocx);
  }
})(typeof self !== "undefined" ? self : this, function (PSGDocx) {
  "use strict";
  return {
    fillZip: PSGDocx.fillZip,
    bytes: PSGDocx.bytes,
    combined: PSGDocx.combined,
    // Three letters -> three files: cut at the first two letter-boundary page breaks.
    separate: function (templateBytes, data, opts) {
      var s = PSGDocx.sections(templateBytes, data, opts, 2);
      return { appointment: s[0], engagement: s[1], mrl: s[2] };
    },
  };
});
