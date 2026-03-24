import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// docx-js via esm.sh
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
  LevelFormat,
  TabStopType,
  TabStopPosition,
} from "https://esm.sh/docx@9.5.0";

function parseMinutaToDocx(minuta: string, tipoContrato: string): typeof Document.prototype {
  const lines = minuta.split("\n");
  const children: any[] = [];

  // Detect title (first non-empty line, usually all caps or bold)
  let titleFound = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      children.push(new Paragraph({ spacing: { after: 60 } }));
      continue;
    }

    // Title detection: first substantial line or all-caps line
    if (!titleFound && (trimmed === trimmed.toUpperCase() && trimmed.length > 10)) {
      titleFound = true;
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 360, before: 240 },
          children: [
            new TextRun({
              text: trimmed,
              bold: true,
              size: 28, // 14pt
              font: "Times New Roman",
            }),
          ],
        })
      );
      continue;
    }

    // Clause headers: lines starting with "CLÁUSULA" or all-caps section headers
    const isClauseHeader = /^CL[ÁA]USULA\s/i.test(trimmed) || /^(DO|DA|DOS|DAS)\s/i.test(trimmed) && trimmed === trimmed.toUpperCase();
    const isSectionHeader = trimmed === trimmed.toUpperCase() && trimmed.length > 3 && trimmed.length < 100 && !trimmed.startsWith("R$") && /[A-ZÀ-Ú]/.test(trimmed);

    if (isClauseHeader || isSectionHeader) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { before: 300, after: 120 },
          children: [
            new TextRun({
              text: trimmed,
              bold: true,
              size: 24, // 12pt
              font: "Times New Roman",
            }),
          ],
        })
      );
      continue;
    }

    // Sub-items: lines starting with § or numbered like "1." "a)" etc.
    const isSubItem = /^[§]/.test(trimmed) || /^[a-z]\)/.test(trimmed) || /^[IVXLC]+\s*[-–.]/.test(trimmed);
    
    if (isSubItem) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 80 },
          indent: { left: 720 }, // 0.5 inch
          children: [
            new TextRun({
              text: trimmed,
              size: 24,
              font: "Times New Roman",
            }),
          ],
        })
      );
      continue;
    }

    // Regular paragraph
    children.push(
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 120, line: 360 }, // 1.5 line spacing
        indent: { firstLine: 720 }, // First line indent
        children: [
          new TextRun({
            text: trimmed,
            size: 24, // 12pt
            font: "Times New Roman",
          }),
        ],
      })
    );
  }

  // Signature block
  children.push(new Paragraph({ spacing: { before: 600 } }));
  children.push(new Paragraph({ spacing: { before: 200 } }));

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: "Times New Roman",
            size: 24,
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: 11906, // A4
              height: 16838,
            },
            margin: {
              top: 1701, // ~3cm
              right: 1134, // ~2cm
              bottom: 1134, // ~2cm
              left: 1701, // ~3cm
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
                    size: 16,
                    font: "Times New Roman",
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
                    size: 18,
                    font: "Times New Roman",
                    color: "888888",
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 18,
                    font: "Times New Roman",
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
    const { minuta, tipoContrato } = await req.json();

    if (!minuta) {
      return new Response(
        JSON.stringify({ error: "Minuta não fornecida" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const doc = parseMinutaToDocx(minuta, tipoContrato || "contrato");
    const buffer = await Packer.toBuffer(doc);

    // Convert to base64
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
