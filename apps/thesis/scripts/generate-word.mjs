// Word document generator (APA 7th edition with UNEG adaptations)
// for the "Proyecto Saecula" thesis proposal.
//
// Adaptations:
//   - 2.54 cm margins on all sides.
//   - Justified text.
//   - 1.5 line spacing.
// APA 7 base format: Times New Roman 12, first-line indent,
// hanging indent for references, and page number in the header.
//
// Usage:
//   node scripts/generate-word.mjs [input.md] [output.docx]
//
// The document text comes from the Markdown file "src/proposal.md",
// which starts with a metadata block (title page) delimited by "---".

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  AlignmentType,
  Document,
  Footer,
  Header,
  LineRuleType,
  PageBreak,
  PageNumber,
  Packer,
  Paragraph,
  TextRun,
  convertMillimetersToTwip,
} from 'docx';

const FUENTE = 'Times New Roman';
const TAMANO = 24; // half-points: 12pt -> 24
const INTERLINEADO = 1.5;
const MARGEN = convertMillimetersToTwip(25.4); // 2.54 cm
const SANGRIA_PRIMERA = convertMillimetersToTwip(12.7); // 0.5"
const SANGRIA_FRANCESA = convertMillimetersToTwip(12.7);
const HOJA = { ancho: convertMillimetersToTwip(210), alto: convertMillimetersToTwip(297) }; // A4

const DEFAULT_IN = 'src/proposal.md';
const DEFAULT_OUT = 'Saecula-Thesis-Proposal.docx';

function run(text, { bold = false, size = TAMANO } = {}) {
  return new TextRun({
    text,
    bold,
    font: FUENTE,
    size,
  });
}

function parrafo(texto = '', {
  alineacion = AlignmentType.JUSTIFIED,
  negrita = false,
  primera = null,
  izquierda = null,
  interlineado = INTERLINEADO,
  saltoPagina = false,
  mantenerConSiguiente = false,
} = {}) {
  return new Paragraph({
    alignment: alineacion,
    spacing: {
      line: Math.round(interlineado * 240),
      lineRule: LineRuleType.AUTO,
      before: 0,
      after: 0,
    },
    keepNext: mantenerConSiguiente,
    indent: {
      firstLine: primera ?? undefined,
      left: izquierda ?? undefined,
    },
    children: texto ? [run(texto, { negrita })] : [],
    ...(saltoPagina ? { pageBreakBefore: true } : {}),
  });
}

// leerMetadatos: parse the leading YAML block delimited by '---'.
function leerMetadatos(lineas) {
  if (!lineas.length || lineas[0].trim() !== '---') return [{}, lineas];
  const meta = {};
  let i = 1;
  while (i < lineas.length && lineas[i].trim() !== '---') {
    const texto = lineas[i].trim();
    const idx = texto.indexOf(':');
    if (idx !== -1) {
      const clave = texto.slice(0, idx).trim();
      const valor = texto.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      meta[clave] = valor;
    }
    i += 1;
  }
  return [meta, lineas.slice(i + 1)];
}

// dividirBloques: convert the markdown body into typed blocks.
function dividirBloques(lineas) {
  const bloques = [];
  let i = 0;
  const n = lineas.length;
  while (i < n) {
    const linea = lineas[i].trimEnd();
    if (!linea.trim()) {
      i += 1;
      continue;
    }
    if (linea.startsWith('### ')) {
      bloques.push(['h3', linea.slice(4).trim()]);
      i += 1;
    } else if (linea.startsWith('## ')) {
      bloques.push(['h2', linea.slice(3).trim()]);
      i += 1;
    } else if (linea.startsWith('# ')) {
      bloques.push(['h1', linea.slice(2).trim()]);
      i += 1;
    } else if (linea.startsWith('- ') || linea.startsWith('* ')) {
      const items = [];
      while (i < n) {
        const l = lineas[i].trimEnd();
        if (l.startsWith('- ') || l.startsWith('* ')) {
          items.push(l.slice(2).trim());
          i += 1;
        } else if (!l.trim()) {
          i += 1;
          break;
        } else {
          break;
        }
      }
      bloques.push(['bullet', items]);
    } else if (/^\d+\.\s/.test(linea)) {
      const items = [];
      while (i < n) {
        const l = lineas[i].trimEnd();
        const m = l.match(/^\d+\.\s*(.*)$/);
        if (m) {
          items.push(m[1].trim());
          i += 1;
        } else if (!l.trim()) {
          i += 1;
          break;
        } else {
          break;
        }
      }
      bloques.push(['numero', items]);
    } else {
      const parrafo = [];
      while (i < n) {
        const l = lineas[i].trimEnd();
        if (
          !l.trim() ||
          l.startsWith('#') ||
          l.startsWith('- ') ||
          l.startsWith('* ') ||
          /^\d+\.\s/.test(l)
        ) {
          break;
        }
        parrafo.push(l.trim());
        i += 1;
      }
      bloques.push(['parrafo', parrafo.join(' ')]);
    }
  }
  return bloques;
}

// construirPortada: UNEG title page.
function construirPortada(meta) {
  const hijos = [];
  for (const clave of ['universidad', 'vicerrectorado', 'coordinacion', 'carrera']) {
    if (meta[clave]) hijos.push(parrafo(meta[clave], { alineacion: AlignmentType.CENTER }));
  }
  for (let k = 0; k < 3; k += 1) hijos.push(parrafo());

  const titulo = meta.titulo || '';
  for (const parte of titulo.split('. ')) {
    hijos.push(parrafo(parte.trim(), { alineacion: AlignmentType.CENTER, negrita: true }));
  }
  for (let k = 0; k < 3; k += 1) hijos.push(parrafo());

  if (meta.autores) hijos.push(parrafo(`Autores: ${meta.autores}`, { alineacion: AlignmentType.CENTER }));
  if (meta.tutor) hijos.push(parrafo(`Tutor(a): ${meta.tutor}`, { alineacion: AlignmentType.CENTER }));
  for (let k = 0; k < 3; k += 1) hijos.push(parrafo());

  if (meta.lugar && meta.fecha) {
    hijos.push(parrafo(`${meta.lugar}, ${meta.fecha}`, { alineacion: AlignmentType.CENTER }));
  }
  return hijos;
}

// construirCuerpo: render the body blocks.
function construirCuerpo(bloques) {
  const hijos = [];
  let enReferencias = false;

  for (const [tipo, contenido] of bloques) {
    if (tipo === 'h1') {
      enReferencias = false;
      const partes = contenido.split(' - ');
      if (partes.length === 2) {
        hijos.push(parrafo(partes[0].toUpperCase(), {
          alineacion: AlignmentType.CENTER, negrita: true, saltoPagina: true, mantenerConSiguiente: true,
        }));
        hijos.push(parrafo(partes[1].toUpperCase(), {
          alineacion: AlignmentType.CENTER, negrita: true, mantenerConSiguiente: true,
        }));
      } else {
        hijos.push(parrafo(contenido.toUpperCase(), {
          alineacion: AlignmentType.CENTER, negrita: true, saltoPagina: true, mantenerConSiguiente: true,
        }));
      }
    } else if (tipo === 'h2') {
      const texto = contenido.trim().toUpperCase();
      hijos.push(parrafo(texto, {
        alineacion: AlignmentType.CENTER, negrita: true,
        saltoPagina: texto === 'REFERENCIAS', mantenerConSiguiente: true,
      }));
      enReferencias = texto === 'REFERENCIAS';
    } else if (tipo === 'h3') {
      hijos.push(parrafo(contenido, { alineacion: AlignmentType.LEFT, negrita: true, mantenerConSiguiente: true }));
    } else if (tipo === 'parrafo') {
      if (enReferencias) {
        // Hanging indent: left margin + hanging indent.
        hijos.push(new Paragraph({
          alignment: AlignmentType.LEFT,
          indent: { left: SANGRIA_FRANCESA, hanging: SANGRIA_FRANCESA },
          children: [run(contenido)],
        }));
      } else {
        hijos.push(new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          indent: { firstLine: SANGRIA_PRIMERA },
          children: [run(contenido)],
        }));
      }
    } else if (tipo === 'bullet') {
      for (const item of contenido) {
        hijos.push(new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          indent: { left: SANGRIA_PRIMERA, hanging: convertMillimetersToTwip(6.3) },
          children: [run(`• ${item}`)],
        }));
      }
    } else if (tipo === 'numero') {
      contenido.forEach((item, idx) => {
        hijos.push(new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          indent: { left: SANGRIA_PRIMERA, hanging: convertMillimetersToTwip(6.3) },
          children: [run(`${idx + 1}. ${item}`)],
        }));
      });
    }
  }
  return hijos;
}

// numeroPagina: APA 7 page number, top right.
function numeroPagina() {
  return new Paragraph({
    alignment: AlignmentType.RIGHT,
    children: [
      new TextRun({ children: [PageNumber.CURRENT], font: FUENTE, size: TAMANO }),
    ],
  });
}

async function generar(archivoMd, archivoSalida) {
  const texto = await readFile(resolve(archivoMd), 'utf-8');
  const lineas = texto.split(/\r?\n/);
  const [meta, cuerpo] = leerMetadatos(lineas);
  const bloques = dividirBloques(cuerpo);

  const doc = new Document({
    creator: meta.autores || '',
    title: meta.titulo || 'Propuesta de Trabajo de Grado',
    styles: {
      default: {
        document: {
          run: { font: FUENTE, size: TAMANO },
          paragraph: { spacing: { line: Math.round(INTERLINEADO * 240), lineRule: LineRuleType.AUTO } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: HOJA.ancho, height: HOJA.alto },
            margin: { top: MARGEN, bottom: MARGEN, left: MARGEN, right: MARGEN },
          },
        },
        headers: {
          default: new Header({ children: [numeroPagina()] }),
        },
        footers: {
          default: new Footer({ children: [] }),
        },
        children: [...construirPortada(meta), new Paragraph({ children: [new PageBreak()] }), ...construirCuerpo(bloques)],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const { writeFile } = await import('node:fs/promises');
  await writeFile(resolve(archivoSalida), buffer);
  return archivoSalida;
}

const entrada = process.argv[2] || DEFAULT_IN;
const salida = process.argv[3] || DEFAULT_OUT;
generar(entrada, salida).then((ruta) => console.log(`Documento generado correctamente: ${ruta}`));
