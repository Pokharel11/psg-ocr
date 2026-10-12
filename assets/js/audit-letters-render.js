/*
 * P.S.G. & Associates - audit letter .docx renderer.
 * Turns the structured blocks from audit-letters-core.js into a Word document,
 * matching the reference formatting (A4; margins top 1.5", left 1.3", right 0.71",
 * bottom 0.6"; Times New Roman 11pt; justified body; bold "Sub:" and MRL headings;
 * numbered MRL list; each letter on a new page). Works in the browser (global
 * `docx`) and in Node (require("docx")).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("docx"));
  else root.AuditRender = factory(root.docx);
})(typeof self !== "undefined" ? self : this, function (docx) {
  "use strict";
  var Document = docx.Document, Paragraph = docx.Paragraph, TextRun = docx.TextRun,
    AlignmentType = docx.AlignmentType, LevelFormat = docx.LevelFormat, PageBreak = docx.PageBreak,
    Table = docx.Table, TableRow = docx.TableRow, TableCell = docx.TableCell,
    WidthType = docx.WidthType, BorderStyle = docx.BorderStyle, Packer = docx.Packer;

  var INCH = 1440;
  var ALIGN = { both: AlignmentType.JUSTIFIED, left: AlignmentType.LEFT, center: AlignmentType.CENTER, right: AlignmentType.RIGHT };

  function runs(list, bold) {
    return (list || []).map(function (r) {
      var o = { text: r.text };
      if (bold) o.bold = true;
      if (r.hl) o.highlight = "yellow";
      return new TextRun(o);
    });
  }
  function para(block) {
    var common = { spacing: { after: 120 } };
    switch (block.type) {
      case "blank": return new Paragraph({ children: [new TextRun("")] });
      case "sigline": return new Paragraph({ children: [new TextRun("_____________")] });
      case "subject": return new Paragraph(Object.assign({}, common, { children: runs(block.runs, true) }));
      case "heading": return new Paragraph(Object.assign({}, common, { children: runs(block.runs, true) }));
      case "numbered":
        return new Paragraph(Object.assign({}, common, {
          numbering: { reference: "mrl-list", level: 0 },
          alignment: AlignmentType.JUSTIFIED, children: runs(block.runs),
        }));
      case "para":
        return new Paragraph(Object.assign({}, common, { alignment: ALIGN[block.align] || AlignmentType.JUSTIFIED, children: runs(block.runs) }));
      case "line":
        return new Paragraph({ alignment: ALIGN[block.align] || AlignmentType.LEFT, children: runs(block.runs) });
      case "twocol": return twocol(block);
      default: return new Paragraph({ children: runs(block.runs) });
    }
  }
  var NO_BORDER = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  function cell(lines) {
    return new TableCell({
      width: { size: 50, type: WidthType.PERCENTAGE },
      borders: { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER },
      children: lines.map(function (ln) { return new Paragraph({ children: runs(ln) }); }),
    });
  }
  function twocol(block) {
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER, insideHorizontal: NO_BORDER, insideVertical: NO_BORDER },
      rows: [new TableRow({ children: [cell(block.left), cell(block.right)] })],
    });
  }

  // Build section children from a list of letters (each an array of blocks), with a
  // page break between letters.
  function sectionChildren(letters) {
    var out = [];
    letters.forEach(function (blocks, i) {
      if (i > 0) out.push(new Paragraph({ children: [new PageBreak()] }));
      blocks.forEach(function (b) { out.push(para(b)); });
    });
    return out;
  }

  function makeDoc(letters) {
    return new Document({
      styles: { default: { document: { run: { font: "Times New Roman", size: 22 } } } },
      numbering: {
        config: [{
          reference: "mrl-list",
          levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 540, hanging: 360 } } } }],
        }],
      },
      sections: [{
        properties: {
          page: {
            size: { width: 11906, height: 16838 }, // A4
            margin: { top: 1.5 * INCH, left: 1.3 * INCH, right: 0.71 * INCH, bottom: 0.6 * INCH },
          },
        },
        children: sectionChildren(letters),
      }],
    });
  }

  // Public: one combined document with all three letters.
  function combined(generated) { return makeDoc([generated.appointment, generated.engagement, generated.mrl]); }
  // Public: three separate documents.
  function separate(generated) {
    return {
      appointment: makeDoc([generated.appointment]),
      engagement: makeDoc([generated.engagement]),
      mrl: makeDoc([generated.mrl]),
    };
  }

  return { combined: combined, separate: separate, makeDoc: makeDoc, Packer: Packer };
});
