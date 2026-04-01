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
  TabStopType,
  TabStopPosition,
} from "https://esm.sh/docx@9.5.0";

// ═══════════════════════════════════════════════════════
// ABNT NBR 14724 - Normas de Formatação
// ═══════════════════════════════════════════════════════
// Fonte: Arial 12pt
// Espaçamento: 1,5 entre linhas
// Margens: Superior 3cm, Inferior 2cm, Esquerda 3cm, Direita 2cm
// Recuo 1ª linha: 1,25cm
// Texto justificado
// Papel A4 (21cm x 29,7cm)
// ═══════════════════════════════════════════════════════

const FONT = "Arial";
const BODY_PT = 12;
const BODY_SIZE = BODY_PT * 2;        // 24 half-points
const TITLE_PT = 14;
const TITLE_SIZE = TITLE_PT * 2;      // 28 half-points
const SMALL_PT = 10;
const SMALL_SIZE = SMALL_PT * 2;      // 20 half-points
const HEADER_SIZE = 16;               // 8pt
const FOOTER_SIZE = 18;               // 9pt

// ABNT Margins (1cm ≈ 567 DXA)
const MARGIN_TOP = 1701;    // 3cm
const MARGIN_BOTTOM = 1134; // 2cm
const MARGIN_LEFT = 1701;   // 3cm
const MARGIN_RIGHT = 1134;  // 2cm

// A4 page size in DXA
const PAGE_WIDTH = 11906;   // 21cm
const PAGE_HEIGHT = 16838;  // 29,7cm

// ABNT first-line indent: 1,25cm = 709 DXA
const FIRST_LINE_INDENT = 709;

// Line spacing: 1.5 = 360 (in 240ths of a line)
const LINE_SPACING = 360;

// Spacing between paragraphs
const PARA_AFTER = 120;
const SECTION_BEFORE = 480;
const SECTION_AFTER = 240;

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/`/g, "");
}

function getTipoLabel(tipo?: string): string {
  const labels: Record<string, string> = {
    promessa_compra_venda: "PROMESSA DE COMPRA E VENDA",
    compra_venda: "CONTRATO DE COMPRA E VENDA",
    locacao: "CONTRATO DE LOCAÇÃO",
    permuta: "CONTRATO DE PERMUTA",
    proposta_comercial: "PROPOSTA COMERCIAL",
  };
  return labels[tipo || ""] || "MINUTA CONTRATUAL";
}

function buildDocx(minuta: string, tipoContrato?: string) {
  const cleaned = stripMarkdown(minuta);
  const lines = cleaned.split("\n");
  const children: any[] = [];
  const headerLabel = getTipoLabel(tipoContrato);

  let titleFound = false;
  let i = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trim();

    if (!trimmed) {
      children.push(new Paragraph({ spacing: { after: 60 } }));
      i++;
      continue;
    }

    // ── Título principal (primeira linha ALL-CAPS substancial) ──
    if (!titleFound && trimmed === trimmed.toUpperCase() && trimmed.length > 10 && /[A-ZÀ-Ú]/.test(trimmed)) {
      titleFound = true;
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: SECTION_AFTER, before: SECTION_BEFORE },
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

    // ── Bloco IMÓVEL (itálico, indentado) ──
    if (/^IM[ÓO]VEL\s*:/i.test(trimmed)) {
      const imovelLines: string[] = [trimmed.replace(/^IM[ÓO]VEL\s*:\s*/i, "")];
      i++;
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
            spacing: { before: 200, after: 200, line: LINE_SPACING },
            indent: { left: MARGIN_LEFT },
            children: [
              new TextRun({ text: "IMÓVEL: ", bold: true, italics: true, size: BODY_SIZE, font: FONT }),
              new TextRun({ text: imovelText, italics: true, size: BODY_SIZE, font: FONT }),
            ],
          })
        );
      }
      continue;
    }

    // ── Cabeçalho de cláusula ──
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
          spacing: { before: SECTION_BEFORE, after: SECTION_AFTER, line: LINE_SPACING },
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

    // ── Sub-itens: §, a), b), I -, II - ──
    const isSubItem = /^[§]/.test(trimmed) || /^[a-z]\)/.test(trimmed) || /^[IVXLC]+\s*[-–.]/.test(trimmed);
    if (isSubItem) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: PARA_AFTER, line: LINE_SPACING },
          indent: { left: FIRST_LINE_INDENT },
          children: [
            new TextRun({ text: trimmed, size: BODY_SIZE, font: FONT }),
          ],
        })
      );
      i++;
      continue;
    }

    // ── Parágrafo normal – justificado com recuo ABNT ──
    children.push(
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: PARA_AFTER, line: LINE_SPACING },
        indent: { firstLine: FIRST_LINE_INDENT },
        children: [
          new TextRun({ text: trimmed, size: BODY_SIZE, font: FONT }),
        ],
      })
    );
    i++;
  }

  // ── Bloco de assinaturas ──
  children.push(new Paragraph({ spacing: { before: 720 } }));

  const signatureBlock = (label: string) => [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 600 },
      children: [
        new TextRun({ text: "___________________________________________", size: BODY_SIZE, font: FONT }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [
        new TextRun({ text: label, bold: true, size: BODY_SIZE, font: FONT }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({ text: "CPF:", size: SMALL_SIZE, font: FONT, color: "666666" }),
      ],
    }),
  ];

  children.push(...signatureBlock("VENDEDOR(A) / PROMITENTE VENDEDOR(A)"));
  children.push(...signatureBlock("COMPRADOR(A) / PROMITENTE COMPRADOR(A)"));
  children.push(...signatureBlock("TESTEMUNHA 1"));
  children.push(...signatureBlock("TESTEMUNHA 2"));

  // ── Local e data ──
  children.push(
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { before: 480, after: 120 },
      children: [
        new TextRun({
          text: `________________, _____ de _______________ de ${new Date().getFullYear()}.`,
          size: BODY_SIZE,
          font: FONT,
        }),
      ],
    })
  );

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: FONT, size: BODY_SIZE },
          paragraph: {
            spacing: { line: LINE_SPACING },
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE_WIDTH, height: PAGE_HEIGHT },
            margin: {
              top: MARGIN_TOP,
              right: MARGIN_RIGHT,
              bottom: MARGIN_BOTTOM,
              left: MARGIN_LEFT,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
                children: [
                  new TextRun({
                    text: headerLabel,
                    size: HEADER_SIZE,
                    font: FONT,
                    color: "888888",
                    italics: true,
                  }),
                  new TextRun({
                    text: "\t",
                  }),
                  new TextRun({
                    text: "ABNT NBR 14724",
                    size: HEADER_SIZE,
                    font: FONT,
                    color: "BBBBBB",
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
                  new TextRun({
                    text: " — Documento gerado eletronicamente",
                    size: FOOTER_SIZE,
                    font: FONT,
                    color: "BBBBBB",
                    italics: true,
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

    const doc = buildDocx(minuta, tipoContrato);
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
