import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  Header,
  Footer,
  PageNumber,
  BorderStyle,
} from "https://esm.sh/docx@9.5.0";

const FONT = "Arial";
const BODY_SIZE = 24; // 12pt
const TITLE_SIZE = 28; // 14pt
const HEADER_SIZE = 16; // 8pt
const FOOTER_SIZE = 18; // 9pt

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/`/g, "");
}

function parseMinutaToDocx(minuta: string): typeof Document.prototype {
  const cleaned = stripMarkdown(minuta);
  const lines = cleaned.split("\n");
  const children: any[] = [];

  let titleFound = false;
  let i = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trim();

    if (!trimmed) {
      children.push(new Paragraph({ spacing: { after: 60 } }));
      i++;
      continue;
    }

    // Title detection: first substantial all-caps line
    if (!titleFound && trimmed === trimmed.toUpperCase() && trimmed.length > 10 && /[A-ZÀ-Ú]/.test(trimmed)) {
      titleFound = true;
      children.push(
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { after: 360, before: 240 },
          children: [
            new TextRun({
              text: trimmed,
              bold: true,
              size: TITLE_SIZE,
              font: FONT,
            }),
          ],
        })
      );
      i++;
      continue;
    }

    // IMÓVEL description block: italic and indented
    if (/^IM[ÓO]VEL\s*:/i.test(trimmed)) {
      // Collect the property description block (italic, indented)
      const imovelLines: string[] = [trimmed.replace(/^IM[ÓO]VEL\s*:\s*/i, "")];
      i++;
      // Gather continuation lines until next §, CLÁUSULA, or empty line after content
      while (i < lines.length) {
        const nextTrimmed = lines[i].trim();
        if (!nextTrimmed || /^[§]/.test(nextTrimmed) || /^CL[ÁA]USULA\s/i.test(nextTrimmed)) break;
        imovelLines.push(nextTrimmed);
        i++;
      }
      const imovelText = imovelLines.join(" ").trim();
      if (imovelText) {
        children.push(
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { before: 200, after: 200, line: 360 },
            indent: { left: 1440 }, // 1 inch indent
            children: [
              new TextRun({
                text: "IMÓVEL: ",
                bold: true,
                italics: true,
                size: BODY_SIZE,
                font: FONT,
              }),
              new TextRun({
                text: imovelText,
                italics: true,
                size: BODY_SIZE,
                font: FONT,
              }),
            ],
          })
        );
      }
      continue;
    }

    // Clause headers: "CLÁUSULA PRIMEIRA", section headers in ALL CAPS
    const isClauseHeader = /^CL[ÁA]USULA\s/i.test(trimmed);
    const isSectionHeader =
      !isClauseHeader &&
      trimmed === trimmed.toUpperCase() &&
      trimmed.length > 3 &&
      trimmed.length < 100 &&
      !trimmed.startsWith("R$") &&
      !trimmed.startsWith("§") &&
      /[A-ZÀ-Ú]/.test(trimmed);

    if (isClauseHeader || isSectionHeader) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { before: 360, after: 200 },
          children: [
            new TextRun({
              text: trimmed,
              bold: true,
              size: BODY_SIZE,
              font: FONT,
            }),
          ],
        })
      );
      i++;
      continue;
    }

    // Sub-items: §, a), b), I -, II -, etc.
    const isSubItem = /^[§]/.test(trimmed) || /^[a-z]\)/.test(trimmed) || /^[IVXLC]+\s*[-–.]/.test(trimmed);

    if (isSubItem) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 120, line: 360 },
          children: [
            new TextRun({
              text: trimmed,
              size: BODY_SIZE,
              font: FONT,
            }),
          ],
        })
      );
      i++;
      continue;
    }

    // Regular paragraph - justified with first-line indent
    children.push(
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 120, line: 360 },
        indent: { firstLine: 720 },
        children: [
          new TextRun({
            text: trimmed,
            size: BODY_SIZE,
            font: FONT,
          }),
        ],
      })
    );
    i++;
  }

  // Signature spacing
  children.push(new Paragraph({ spacing: { before: 600 } }));
  children.push(new Paragraph({ spacing: { before: 200 } }));

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: FONT,
            size: BODY_SIZE,
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: 11906,
              height: 16838,
            },
            margin: {
              top: 1701,
              right: 1134,
              bottom: 1134,
              left: 1701,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: "MINUTA CONTRATUAL",
                    size: HEADER_SIZE,
                    font: FONT,
                    color: "999999",
                    italics: true,
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                border: {
                  top: {
                    style: BorderStyle.SINGLE,
                    size: 1,
                    color: "CCCCCC",
                    space: 4,
                  },
                },
                children: [
                  new TextRun({
                    text: "Página ",
                    size: FOOTER_SIZE,
                    font: FONT,
                    color: "888888",
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: FOOTER_SIZE,
                    font: FONT,
                    color: "888888",
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  return doc;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { minuta } = await req.json();

    if (!minuta) {
      return new Response(
        JSON.stringify({ error: "Minuta não fornecida" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const doc = parseMinutaToDocx(minuta);
    const buffer = await Packer.toBuffer(doc);

    const uint8 = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < uint8.length; i++) {
      binary += String.fromCharCode(uint8[i]);
    }
    const base64 = btoa(binary);

    return new Response(
      JSON.stringify({ docx: base64 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error generating DOCX:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
