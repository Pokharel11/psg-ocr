/*
 * P.S.G. & Associates - audit letter rendering.
 * Fills the reference-based Word template (templates/audit-letter-template.docx)
 * with docxtemplater + PizZip, so the output matches the firm's reference file in
 * font, spacing and layout. Entity-specific wording and the dropping of MRL items
 * 12 and 21 for non-company entities are handled by template loops/placeholders;
 * MRL numbering stays native Word numbering and re-flows with no gaps.
 *
 * Shared by the browser UI (assets/js/audit-letters.js) and the Node scripts
 * (make-samples.js, tests). Nothing is sent or stored; data stays in memory.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("pizzip"), require("docxtemplater"));
  } else {
    root.AuditRender = factory(root.PizZip, root.docxtemplater);
  }
})(typeof self !== "undefined" ? self : this, function (PizZip, DocxtemplaterMod) {
  "use strict";
  var Docxtemplater = DocxtemplaterMod && (DocxtemplaterMod.default || DocxtemplaterMod);

  // Fill the template and return a PizZip instance (filled doc).
  function fillZip(templateBytes, data, opts) {
    opts = opts || {};
    var zip = new PizZip(templateBytes);
    var doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: false });
    doc.render(data);
    var out = doc.getZip();
    if (!opts.highlight) {
      // Normal output: no yellow highlights. (Review mode keeps them, as in the reference.)
      var xml = out.file("word/document.xml").asText().replace(/<w:highlight w:val="yellow"\/>/g, "");
      out.file("word/document.xml", xml);
    }
    return out;
  }

  function bytes(zip) { return zip.generate({ type: "uint8array" }); }

  // One combined .docx (three letters, page breaks between them).
  function combined(templateBytes, data, opts) { return bytes(fillZip(templateBytes, data, opts)); }

  // Split the filled document into three .docx (Appointment / Engagement / MRL),
  // cutting at the two letter-boundary page breaks (the first two empty
  // page-break paragraphs; any later page break stays inside its letter).
  function separate(templateBytes, data, opts) {
    var filled = fillZip(templateBytes, data, opts);
    var xml = filled.file("word/document.xml").asText();
    var bodyOpenEnd = xml.indexOf(">", xml.indexOf("<w:body")) + 1;
    var bodyEnd = xml.lastIndexOf("</w:body>");
    var head = xml.slice(0, bodyOpenEnd);
    var tail = xml.slice(bodyEnd); // "</w:body></w:document>"
    var inner = xml.slice(bodyOpenEnd, bodyEnd);

    // body-level section properties (direct child of body, after the last block)
    var sect = "";
    var sectM = inner.match(/<w:sectPr\b[\s\S]*<\/w:sectPr>\s*$/);
    if (sectM) { sect = sectM[0]; inner = inner.slice(0, sectM.index); }

    // top-level blocks: paragraphs and the signature table
    var blocks = (inner.match(/<w:(p|tbl)\b[\s\S]*?<\/w:\1>/g)) || [];
    function isBreak(b) {
      if (!/^<w:p[ >]/.test(b)) return false;
      if (!/<w:br w:type="page"\/>/.test(b)) return false;
      var t = (b.match(/<w:t(?: [^>]*)?>([\s\S]*?)<\/w:t>/g) || [])
        .map(function (s) { return s.replace(/<[^>]+>/g, ""); }).join("");
      return !t.trim();
    }
    var cuts = [];
    for (var i = 0; i < blocks.length && cuts.length < 2; i++) if (isBreak(blocks[i])) cuts.push(i);
    var g1 = blocks.slice(0, cuts[0]);
    var g2 = blocks.slice(cuts[0] + 1, cuts[1]);
    var g3 = blocks.slice(cuts[1] + 1);

    function build(group) {
      var z = new PizZip(bytes(filled)); // clone the filled package
      z.file("word/document.xml", head + group.join("") + sect + tail);
      return z.generate({ type: "uint8array" });
    }
    return { appointment: build(g1), engagement: build(g2), mrl: build(g3) };
  }

  return { fillZip: fillZip, bytes: bytes, combined: combined, separate: separate };
});
