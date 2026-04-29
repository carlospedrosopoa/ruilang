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
  Table,
  TableRow,
  TableCell,
  WidthType,
  ShadingType,
  VerticalAlign,
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

function buildDocxAbnt(minuta: string, tipoContrato?: string) {
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

const VL_FONT = "Times New Roman";
const VL_BODY_PT = 11;
const VL_BODY_SIZE = VL_BODY_PT * 2;
const VL_TITLE_PT = 16;
const VL_TITLE_SIZE = VL_TITLE_PT * 2;
const VL_SMALL_PT = 9;
const VL_SMALL_SIZE = VL_SMALL_PT * 2;
const VL_LINE_SPACING = 276;
const VL_PARA_AFTER = 120;
const VL_SECTION_BEFORE = 240;
const VL_SECTION_AFTER = 160;
const VL_MARGIN_TOP = 1440;
const VL_MARGIN_BOTTOM = 1440;
const VL_MARGIN_LEFT = 1440;
const VL_MARGIN_RIGHT = 1440;
const VL_BLUE = "1F4E79";
const VL_LIGHT_GRAY = "F2F2F2";
const VL_LIGHT_BLUE = "DDEBF7";
const VL_GRAY = "666666";
const VL_GRAY_LIGHT = "999999";

function isAllCapsHeading(trimmed: string) {
  return (
    trimmed === trimmed.toUpperCase() &&
    trimmed.length > 3 &&
    trimmed.length < 120 &&
    !trimmed.startsWith("R$") &&
    !trimmed.startsWith("§") &&
    /[A-ZÀ-Ú]/.test(trimmed)
  );
}

function makeRuleParagraph() {
  return new Paragraph({
    spacing: { before: 80, after: 220 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: VL_BLUE, space: 2 },
    },
  });
}

function isEmentaHeading(trimmed: string) {
  const normalized = trimmed.replace(/[.\-:]/g, "").replace(/\s+/g, "").toUpperCase();
  return normalized === "EMENTA";
}

function stripEmentaPrefix(original: string) {
  const m = original.match(/^\s*(E\s*M\s*E\s*N\s*T\s*A|EMENTA)\s*[:\-]?\s*/i);
  if (!m) return original.trim();
  return original.slice(m[0].length).trim();
}

function normalizeHeadingKey(input: string) {
  try {
    return input
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^A-Za-z0-9]/g, "")
      .toUpperCase();
  } catch {
    return input.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  }
}

const VL_SKIP_TOP_HEADINGS = new Set([
  "MINUTA",
  "MINUTACONTRATUAL",
  "CONTRATOPARTICULARDE",
  "PROMESSADECOMPRAEVENDA",
  "PROMESSADECOMPRAEVENDADEIMOVEL",
  "COMINTERMEDIACAOIMOBILIARIA",
  "CONTRATOPARTICULARDEPROMESSADECOMPRAEVENDADEIMOVEL",
]);

function isSignatureStartKey(key: string) {
  return (
    key.startsWith("VENDEDOR") ||
    key.startsWith("COMPRADOR") ||
    key.startsWith("CONJUGE") ||
    key.startsWith("TESTEMUNHA") ||
    key.startsWith("IMOBILIARIAINTERMEDIADORA") ||
    key.startsWith("REPRESENTANTE") ||
    key === "ASSINATURAS" ||
    key.startsWith("ASSINATURA")
  );
}

function makeVisualSignatureCell(title: string) {
  return new TableCell({
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 260, after: 70, line: VL_LINE_SPACING },
        children: [new TextRun({ text: "__________________________________", size: VL_BODY_SIZE, font: VL_FONT, color: VL_BLUE })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 60, line: VL_LINE_SPACING },
        children: [new TextRun({ text: title, bold: true, size: VL_SMALL_SIZE, font: VL_FONT, color: VL_BLUE })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 0, line: VL_LINE_SPACING },
        children: [new TextRun({ text: "Nome:", size: VL_SMALL_SIZE, font: VL_FONT, color: VL_GRAY_LIGHT })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 0, line: VL_LINE_SPACING },
        children: [new TextRun({ text: "CPF:", size: VL_SMALL_SIZE, font: VL_FONT, color: VL_GRAY_LIGHT })],
      }),
    ],
  });
}

function normalizeTipoTitle(input: string) {
  const base = input.trim();
  if (!base) return "";
  const upper = base.toUpperCase();
  const normalized = normalizeHeadingKey(upper);
  const promessaKey = normalizeHeadingKey("PROMESSA DE COMPRA E VENDA");
  const imovelKey = normalizeHeadingKey("IMÓVEL");
  if (normalized.includes(promessaKey) && !normalized.includes(imovelKey)) return `${upper} DE IMÓVEL`;
  return upper;
}

function buildDocxVisualLaw(minuta: string, tipoContrato?: string, tipoContratoNome?: string | null) {
  const cleaned = stripMarkdown(minuta);
  const lines = cleaned.split("\n");
  const children: any[] = [];

  const hasIntermediacao = (() => {
    for (let idx = 0; idx < Math.min(lines.length, 30); idx++) {
      const t = String(lines[idx] || "").trim();
      if (!t) continue;
      if (normalizeHeadingKey(t) === "COMINTERMEDIACAOIMOBILIARIA") return true;
    }
    return false;
  })();

  const tipoLabel = getTipoLabel(tipoContrato);
  const tituloPrincipal =
    tipoContrato === "promessa_compra_venda"
      ? "PROMESSA DE COMPRA E VENDA DE IMÓVEL"
      : typeof tipoContratoNome === "string" && tipoContratoNome.trim()
        ? normalizeTipoTitle(tipoContratoNome)
        : tipoLabel;

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 60, line: VL_LINE_SPACING },
      children: [new TextRun({ text: "CONTRATO PARTICULAR DE", size: VL_SMALL_SIZE, font: VL_FONT, color: VL_GRAY })],
    })
  );
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 40, line: VL_LINE_SPACING },
      children: [new TextRun({ text: tituloPrincipal, bold: true, size: VL_TITLE_SIZE, font: VL_FONT, color: VL_BLUE })],
    })
  );
  if (tipoContrato === "promessa_compra_venda" || hasIntermediacao) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 140, line: VL_LINE_SPACING },
        children: [new TextRun({ text: "com Intermediação Imobiliária", italics: true, size: VL_SMALL_SIZE, font: VL_FONT, color: VL_BLUE })],
      })
    );
  } else {
    children.push(new Paragraph({ spacing: { after: 140 } }));
  }
  children.push(makeRuleParagraph());

  let i = 0;
  while (i < lines.length) {
    const trimmed = lines[i].trim();

    if (!trimmed) {
      children.push(new Paragraph({ spacing: { after: 80 } }));
      i++;
      continue;
    }

    const key = normalizeHeadingKey(trimmed);
    if (i < 12 && VL_SKIP_TOP_HEADINGS.has(key)) {
      i++;
      continue;
    }

    const signatureWindowStart = Math.max(12, lines.length - 120);
    if (i >= signatureWindowStart && isSignatureStartKey(key)) {
      break;
    }

    if (isEmentaHeading(trimmed)) {
      const ementaParts: string[] = [];
      const afterLabel = stripEmentaPrefix(lines[i]);
      if (afterLabel) ementaParts.push(afterLabel);
      i++;
      while (i < lines.length) {
        const nextTrimmed = lines[i].trim();
        if (!nextTrimmed) break;
        if (/^CL[ÁA]USULA\s/i.test(nextTrimmed)) break;
        if (isAllCapsHeading(nextTrimmed)) break;
        ementaParts.push(nextTrimmed);
        i++;
      }
      const ementaText = ementaParts.join(" ").trim();

      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  shading: { type: ShadingType.CLEAR, color: "auto", fill: VL_LIGHT_BLUE },
                  children: [
                    new Paragraph({
                      spacing: { before: 120, after: 80, line: VL_LINE_SPACING },
                      children: [new TextRun({ text: "E M E N T A", bold: true, size: VL_SMALL_SIZE, font: VL_FONT, color: VL_BLUE })],
                    }),
                    new Paragraph({
                      alignment: AlignmentType.JUSTIFIED,
                      spacing: { after: 120, line: VL_LINE_SPACING },
                      children: [new TextRun({ text: ementaText, size: VL_BODY_SIZE, font: VL_FONT })],
                    }),
                  ],
                  margins: { top: 120, bottom: 120, left: 200, right: 200 },
                  borders: {
                    top: { style: BorderStyle.SINGLE, size: 6, color: VL_BLUE },
                    bottom: { style: BorderStyle.SINGLE, size: 6, color: VL_BLUE },
                    left: { style: BorderStyle.SINGLE, size: 6, color: VL_BLUE },
                    right: { style: BorderStyle.SINGLE, size: 6, color: VL_BLUE },
                  },
                }),
              ],
            }),
          ],
        })
      );
      children.push(new Paragraph({ spacing: { after: 200 } }));
      continue;
    }

    const isClauseHeader = /^CL[ÁA]USULA\s/i.test(trimmed);
    if (isClauseHeader) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { before: VL_SECTION_BEFORE, after: VL_SECTION_AFTER, line: VL_LINE_SPACING },
          border: {
            left: { style: BorderStyle.SINGLE, size: 14, color: VL_BLUE, space: 6 },
          },
          indent: { left: 200 },
          children: [new TextRun({ text: trimmed, bold: true, size: VL_SMALL_SIZE, font: VL_FONT, color: VL_BLUE })],
        })
      );
      i++;
      continue;
    }

    if (isAllCapsHeading(trimmed)) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { before: VL_SECTION_BEFORE, after: 80, line: VL_LINE_SPACING },
          children: [new TextRun({ text: trimmed, bold: true, size: VL_SMALL_SIZE, font: VL_FONT, color: VL_BLUE })],
        })
      );
      children.push(
        new Paragraph({
          spacing: { before: 0, after: 160 },
          border: {
            bottom: { style: BorderStyle.SINGLE, size: 6, color: VL_BLUE, space: 2 },
          },
        })
      );
      i++;
      continue;
    }

    const romanMatch = trimmed.match(/^([IVXLC]+)\s*[-–.]\s*(.*)$/);
    if (romanMatch) {
      const numeral = romanMatch[1];
      const rest = romanMatch[2] || "";
      children.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: VL_PARA_AFTER, line: VL_LINE_SPACING },
          indent: { left: 360, hanging: 360 },
          children: [
            new TextRun({ text: `${numeral} — `, bold: true, size: VL_BODY_SIZE, font: VL_FONT, color: VL_BLUE }),
            new TextRun({ text: rest, size: VL_BODY_SIZE, font: VL_FONT }),
          ],
        })
      );
      i++;
      continue;
    }

    const paragrafoUnicoMatch = trimmed.match(/^Par[aá]grafo\s+único\.\s*(.*)$/i);
    if (paragrafoUnicoMatch) {
      const rest = paragrafoUnicoMatch[1] || "";
      children.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: VL_PARA_AFTER, line: VL_LINE_SPACING },
          children: [
            new TextRun({ text: "Parágrafo único.", bold: true, size: VL_BODY_SIZE, font: VL_FONT, color: VL_BLUE }),
            new TextRun({ text: rest ? ` ${rest}` : "", italics: true, size: VL_BODY_SIZE, font: VL_FONT }),
          ],
        })
      );
      i++;
      continue;
    }

    const isSubItem = /^[§]/.test(trimmed) || /^[a-z]\)/.test(trimmed) || /^[0-9]+\.[0-9]+\.?/.test(trimmed);
    if (isSubItem) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: VL_PARA_AFTER, line: VL_LINE_SPACING },
          indent: { left: 360 },
          children: [new TextRun({ text: trimmed, size: VL_BODY_SIZE, font: VL_FONT })],
        })
      );
      i++;
      continue;
    }

    children.push(
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: VL_PARA_AFTER, line: VL_LINE_SPACING },
        children: [new TextRun({ text: trimmed, size: VL_BODY_SIZE, font: VL_FONT })],
      })
    );
    i++;
  }

  children.push(new Paragraph({ spacing: { before: 360 } }));
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [makeVisualSignatureCell("VENDEDOR(A)"), makeVisualSignatureCell("COMPRADOR(A)")],
        }),
        new TableRow({
          children: [makeVisualSignatureCell("CÔNJUGE/COMP. DO VENDEDOR"), makeVisualSignatureCell("CÔNJUGE/COMP. DO COMPRADOR")],
        }),
      ],
    })
  );

  children.push(new Paragraph({ spacing: { before: 260 } }));
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 70, line: VL_LINE_SPACING },
      children: [new TextRun({ text: "__________________________________", size: VL_BODY_SIZE, font: VL_FONT, color: VL_BLUE })],
    })
  );
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40, line: VL_LINE_SPACING },
      children: [new TextRun({ text: "IMOBILIÁRIA INTERMEDIADORA", bold: true, size: VL_SMALL_SIZE, font: VL_FONT, color: VL_BLUE })],
    })
  );

  children.push(new Paragraph({ spacing: { before: 220, after: 80 } }));
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 80, line: VL_LINE_SPACING },
      children: [new TextRun({ text: "TESTEMUNHAS", bold: true, size: VL_SMALL_SIZE, font: VL_FONT, color: VL_BLUE })],
    })
  );
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [new TableRow({ children: [makeVisualSignatureCell("1ª TESTEMUNHA"), makeVisualSignatureCell("2ª TESTEMUNHA")] })],
    })
  );

  const currentYear = new Date().getFullYear();
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: VL_FONT, size: VL_BODY_SIZE },
          paragraph: { spacing: { line: VL_LINE_SPACING } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE_WIDTH, height: PAGE_HEIGHT },
            margin: { top: VL_MARGIN_TOP, right: VL_MARGIN_RIGHT, bottom: VL_MARGIN_BOTTOM, left: VL_MARGIN_LEFT },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
                border: {
                  top: { style: BorderStyle.SINGLE, size: 6, color: VL_BLUE, space: 4 },
                },
                children: [
                  new TextRun({ text: `© ${currentYear} — Documento de uso restrito`, size: VL_SMALL_SIZE, font: VL_FONT, color: VL_GRAY }),
                  new TextRun({ text: "\t" }),
                  new TextRun({ text: "Página ", size: VL_SMALL_SIZE, font: VL_FONT, color: VL_GRAY }),
                  new TextRun({ children: [PageNumber.CURRENT], size: VL_SMALL_SIZE, font: VL_FONT, color: VL_GRAY }),
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
    const { minuta, tipoContrato, tipoContratoNome, format } = await req.json();

    if (!minuta) {
      return new Response(
        JSON.stringify({ error: "Minuta não fornecida" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const doc = format === "visual_law" ? buildDocxVisualLaw(minuta, tipoContrato, tipoContratoNome) : buildDocxAbnt(minuta, tipoContrato);
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
