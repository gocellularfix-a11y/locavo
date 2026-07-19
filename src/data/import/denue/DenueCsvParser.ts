import { DENUE_COLUMNS, type DenueParsedRow, type DenueRawRecord } from './DenueRawRecord';

/**
 * Parser del CSV oficial DENUE (V4B).
 *
 * Determinista y sin dependencias: soporta campos entrecomillados, comillas
 * escapadas (`""`) y saltos de línea dentro de comillas. La cabecera se
 * valida contra las columnas oficiales; columnas ausentes se materializan
 * como cadena vacía para que los registros con opcionales faltantes se
 * conserven (la validación de identidad/ubicación ocurre en el mapper).
 */

export class DenueCsvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DenueCsvError';
  }
}

/** Divide el texto CSV en registros lógicos (respetando comillas). */
function splitRecords(text: string): string[] {
  const records: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      inQ = !inQ;
      cur += c;
    } else if (!inQ && (c === '\n' || c === '\r')) {
      if (c === '\r' && text[i + 1] === '\n') {
        i++;
      }
      if (cur.length > 0) {
        records.push(cur);
      }
      cur = '';
    } else {
      cur += c;
    }
  }
  if (inQ) {
    throw new DenueCsvError('CSV malformado: comilla sin cerrar al final del archivo');
  }
  if (cur.length > 0) {
    records.push(cur);
  }
  return records;
}

function parseFields(record: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < record.length; i++) {
    const c = record[i];
    if (inQ) {
      if (c === '"') {
        if (record[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQ = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQ = true;
    } else if (c === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

/**
 * Parsea el CSV completo. Lanza `DenueCsvError` si la cabecera no contiene
 * las columnas mínimas de identidad/ubicación del formato oficial.
 */
export function parseDenueCsv(text: string): DenueParsedRow[] {
  const records = splitRecords(text.replace(/^﻿/, ''));
  if (records.length === 0) {
    throw new DenueCsvError('CSV vacío: sin cabecera');
  }
  const header = parseFields(records[0]).map((h) => h.trim());
  const required: string[] = ['id', 'nom_estab', 'codigo_act', 'latitud', 'longitud', 'cve_ent', 'cve_mun'];
  for (const column of required) {
    if (!header.includes(column)) {
      throw new DenueCsvError(`CSV malformado: falta la columna obligatoria "${column}"`);
    }
  }
  const index = new Map(header.map((h, i) => [h, i]));

  const rows: DenueParsedRow[] = [];
  for (let r = 1; r < records.length; r++) {
    const fields = parseFields(records[r]);
    const record = {} as DenueRawRecord;
    for (const column of DENUE_COLUMNS) {
      const i = index.get(column);
      record[column] = i === undefined ? '' : (fields[i] ?? '');
    }
    rows.push({ row: r, record });
  }
  return rows;
}
