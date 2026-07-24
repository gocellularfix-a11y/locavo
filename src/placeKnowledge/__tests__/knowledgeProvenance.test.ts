import { readFileSync } from 'fs';
import { join } from 'path';

import {
  ACQUISITION_LANGUAGE_MODEL,
  ACQUISITION_MANUAL_ENTRY,
  type AcquisitionMetadata,
} from '../model/acquisition';
import { DOCUMENT_FORMAT_HTML, type EvidenceSpan } from '../model/evidenceSpan';
import type { HoursException } from '../model/hoursException';
import { KNOWLEDGE_FIELD_KEYS, type KnowledgeFieldKey } from '../model/knowledgeField';
import {
  KNOWLEDGE_SCHEMA_VERSION,
  knowledgeFragmentIdOf,
  type KnowledgeFragment,
} from '../model/knowledgeFragment';
import {
  appendReview,
  currentReviewStatus,
  type ReviewEntry,
  type ReviewHistory,
} from '../model/review';
import {
  deserializeKnowledgeFragment,
  serializeKnowledgeFragment,
  serializeKnowledgeFragments,
  toCanonicalFragmentRecord,
} from '../model/serialization';

const SPAN: EvidenceSpan = {
  documentId: 'doc-cafe-rio',
  format: DOCUMENT_FORMAT_HTML,
  start: 10,
  end: 19,
  text: 'Free WiFi',
};

const ACQUISITION: AcquisitionMetadata = {
  method: ACQUISITION_LANGUAGE_MODEL,
  toolId: 'extractor-a',
  toolVersion: '1.4.0',
  acquiredAt: '2026-07-24',
};

function fragment(overrides: Partial<KnowledgeFragment> = {}): KnowledgeFragment {
  return {
    id: knowledgeFragmentIdOf('place-1', 'services', 'site-oficial', '2026-07-01'),
    schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
    placeId: 'place-1',
    field: 'services',
    value: ['wifi'],
    sourceId: 'site-oficial',
    evidence: {
      level: 'official_publication',
      method: 'website-extraction',
      capturedAt: '2026-07-01',
      span: SPAN,
    },
    retrievedAt: '2026-07-24',
    licenseTier: 'permissive-base',
    acquisition: ACQUISITION,
    validatorVersion: 'validator-0',
    reviewHistory: [],
    ...overrides,
  } as KnowledgeFragment;
}

describe('span de evidencia', () => {
  it('identifica documento, formato, límites y texto literal', () => {
    expect(SPAN.documentId).toBe('doc-cafe-rio');
    expect(SPAN.format).toBe('html');
    expect(SPAN.end).toBeGreaterThan(SPAN.start);
    expect(SPAN.text).toBe('Free WiFi');
  });

  it('los límites permiten la comprobación literal que hará la Fase B', () => {
    // El modelo no valida; esta prueba demuestra que porta lo necesario para
    // que un validador determinista pueda comprobar la cita sin IA.
    const document = 'Bienvenido. Free WiFi para clientes.';
    const span: EvidenceSpan = { ...SPAN, start: 12, end: 21 };
    expect(document.slice(span.start, span.end)).toBe(span.text);
  });

  it('la evidencia sin documento que citar sigue siendo representable', () => {
    // Una observación en campo o una captura manual no tienen span.
    const observed = fragment({
      evidence: { level: 'observed', method: 'site-visit', capturedAt: '2026-07-02' },
    });
    expect(observed.evidence.span).toBeUndefined();
  });
});

describe('metadatos de adquisición', () => {
  it('registran clase de mecanismo, herramienta y versión', () => {
    expect(ACQUISITION.method).toBe('language_model');
    expect(ACQUISITION.toolId).toBe('extractor-a');
    expect(ACQUISITION.toolVersion).toBe('1.4.0');
  });

  it('la versión de herramienta permite invalidar en bloque un lote defectuoso', () => {
    const log = [
      fragment({ id: 'f-1' }),
      fragment({ id: 'f-2', acquisition: { ...ACQUISITION, toolVersion: '1.5.0' } }),
      fragment({ id: 'f-3' }),
    ];
    const afectados = log.filter((f) => f.acquisition.toolVersion === '1.4.0').map((f) => f.id);
    expect(afectados).toEqual(['f-1', 'f-3']);
  });

  it('es independiente de la tecnología: ningún proveedor aparece en el modelo', () => {
    const modelSource = ['acquisition.ts', 'evidenceSpan.ts', 'knowledgeFragment.ts']
      .map((file) => readFileSync(join(__dirname, '..', 'model', file), 'utf8'))
      .join('\n');
    for (const vendor of ['GPT', 'Claude', 'Gemini', 'OpenAI', 'Anthropic', 'Llama']) {
      expect(modelSource).not.toContain(vendor);
    }
  });

  it('la captura manual usa la misma forma que un modelo de lenguaje', () => {
    const manual: AcquisitionMetadata = {
      method: ACQUISITION_MANUAL_ENTRY,
      toolId: 'captura-jorge',
      toolVersion: '1',
      acquiredAt: '2026-07-24',
    };
    expect(Object.keys(manual).sort()).toEqual(Object.keys(ACQUISITION).sort());
  });
});

describe('historial de revisión append-only', () => {
  const accepted: ReviewEntry = {
    status: 'accepted',
    reviewer: 'jorge',
    reviewedAt: '2026-07-24T10:00:00.000Z',
    version: KNOWLEDGE_SCHEMA_VERSION,
  };
  const rejected: ReviewEntry = {
    status: 'rejected',
    reviewer: 'jorge',
    reviewedAt: '2026-07-25T10:00:00.000Z',
    reason: 'cita fuera de contexto',
    version: KNOWLEDGE_SCHEMA_VERSION,
  };

  it('un historial vacío está pendiente, nunca aceptado', () => {
    expect(currentReviewStatus([])).toBe('pending');
  });

  it('el estado vigente es la última decisión', () => {
    expect(currentReviewStatus([accepted, rejected])).toBe('rejected');
    expect(currentReviewStatus([rejected, accepted])).toBe('accepted');
  });

  it('agregar una decisión no muta ni borra el historial previo', () => {
    const history: ReviewHistory = [accepted];
    const next = appendReview(history, rejected);
    expect(history).toEqual([accepted]);
    expect(next).toHaveLength(2);
    expect(next[0]).toBe(accepted);
  });

  it('el rechazo persiste: se puede detectar una propuesta ya rechazada', () => {
    const rejectedFragment = fragment({ id: 'f-malo', reviewHistory: [rejected] });
    const propuestaRepetida = fragment({ id: 'f-malo' });
    const yaRechazados = new Set(
      [rejectedFragment].filter((f) => currentReviewStatus(f.reviewHistory) === 'rejected').map((f) => f.id),
    );
    expect(yaRechazados.has(propuestaRepetida.id)).toBe(true);
  });
});

describe('versión de validador', () => {
  it('cada fragmento la porta', () => {
    expect(fragment().validatorVersion).toBe('validator-0');
  });

  it('permite reevaluar en bloque lo aceptado por una versión concreta', () => {
    const log = [
      fragment({ id: 'f-1', validatorVersion: 'validator-0' }),
      fragment({ id: 'f-2', validatorVersion: 'validator-1' }),
    ];
    expect(log.filter((f) => f.validatorVersion === 'validator-0').map((f) => f.id)).toEqual(['f-1']);
  });
});

describe('atributos nuevos del catálogo', () => {
  it('incorpora idiomas, productos, tipo de negocio, año y excepciones de horario', () => {
    for (const key of [
      'languages',
      'products',
      'businessType',
      'establishedYear',
      'hoursExceptions',
    ] as KnowledgeFieldKey[]) {
      expect(KNOWLEDGE_FIELD_KEYS).toContain(key);
    }
  });

  it('las excepciones expresan cierre temporal y horario de festivo', () => {
    const cierre: HoursException = {
      startDate: '2026-12-24',
      endDate: '2026-12-26',
      kind: 'closed',
      label: 'Navidad',
    };
    const especial: HoursException = {
      startDate: '2027-01-01',
      endDate: '2027-01-01',
      kind: 'special_hours',
      hours: [{ open: '10:00', close: '14:00' }],
    };
    expect(cierre.hours).toBeUndefined();
    expect(especial.hours).toEqual([{ open: '10:00', close: '14:00' }]);
  });

  it('reutiliza el tri-estado de DayHours en vez de un tipo nuevo', () => {
    const sinConfirmar: HoursException = {
      startDate: '2027-05-01',
      endDate: '2027-05-01',
      kind: 'special_hours',
      hours: null,
    };
    expect(sinConfirmar.hours).toBeNull();
  });
});

describe('serialización determinista', () => {
  it('el orden de claves no depende del orden de construcción', () => {
    const a = fragment();
    const b: KnowledgeFragment = {
      reviewHistory: [],
      validatorVersion: 'validator-0',
      acquisition: ACQUISITION,
      licenseTier: 'permissive-base',
      retrievedAt: '2026-07-24',
      evidence: a.evidence,
      sourceId: 'site-oficial',
      value: ['wifi'],
      field: 'services',
      placeId: 'place-1',
      schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
      id: a.id,
    } as KnowledgeFragment;
    expect(serializeKnowledgeFragment(b)).toBe(serializeKnowledgeFragment(a));
  });

  it('los parámetros de adquisición se ordenan por clave', () => {
    const uno = fragment({
      acquisition: { ...ACQUISITION, parameters: { zeta: 1, alfa: 'x' } },
    });
    const otro = fragment({
      acquisition: { ...ACQUISITION, parameters: { alfa: 'x', zeta: 1 } },
    });
    expect(serializeKnowledgeFragment(otro)).toBe(serializeKnowledgeFragment(uno));
    expect(serializeKnowledgeFragment(uno)).toContain('"parameters":{"alfa":"x","zeta":1}');
  });

  it('serializar dos veces produce los mismos bytes', () => {
    const f = fragment();
    expect(serializeKnowledgeFragment(f)).toBe(serializeKnowledgeFragment(f));
    expect(serializeKnowledgeFragments([f, f])).toBe(serializeKnowledgeFragments([f, f]));
  });

  it('los campos opcionales ausentes no aparecen en la salida', () => {
    const sinSpan = fragment({
      evidence: { level: 'observed', method: 'site-visit', capturedAt: '2026-07-02' },
    });
    const record = toCanonicalFragmentRecord(sinSpan);
    expect(serializeKnowledgeFragment(sinSpan)).not.toContain('"span"');
    expect(record.supersedes).toBeUndefined();
  });
});

describe('deserialización estructural', () => {
  it('el viaje de ida y vuelta conserva el fragmento', () => {
    const f = fragment({ supersedes: 'f-anterior', reviewHistory: [
      { status: 'accepted', reviewer: 'jorge', reviewedAt: '2026-07-24T10:00:00.000Z', version: 2 },
    ] });
    const back = deserializeKnowledgeFragment(serializeKnowledgeFragment(f));
    expect(back).not.toBeNull();
    expect(serializeKnowledgeFragment(back as KnowledgeFragment)).toBe(serializeKnowledgeFragment(f));
  });

  it('acepta tanto una cadena JSON como un objeto ya parseado', () => {
    const f = fragment();
    const text = serializeKnowledgeFragment(f);
    expect(deserializeKnowledgeFragment(text)).toEqual(deserializeKnowledgeFragment(JSON.parse(text)));
  });

  it('devuelve null ante formas inválidas en vez de lanzar', () => {
    expect(deserializeKnowledgeFragment('{no es json')).toBeNull();
    expect(deserializeKnowledgeFragment(null)).toBeNull();
    expect(deserializeKnowledgeFragment({ id: 'x' })).toBeNull();
    expect(deserializeKnowledgeFragment(42)).toBeNull();
  });

  it('rechaza un fragmento sin procedencia completa', () => {
    const f = fragment();
    const sinAdquisicion = { ...toCanonicalFragmentRecord(f) };
    delete sinAdquisicion.acquisition;
    expect(deserializeKnowledgeFragment(sinAdquisicion)).toBeNull();

    const sinValidador = { ...toCanonicalFragmentRecord(f) };
    delete sinValidador.validatorVersion;
    expect(deserializeKnowledgeFragment(sinValidador)).toBeNull();

    const sinHistorial = { ...toCanonicalFragmentRecord(f) };
    delete sinHistorial.reviewHistory;
    expect(deserializeKnowledgeFragment(sinHistorial)).toBeNull();
  });

  it('un span malformado invalida el fragmento completo', () => {
    const record = toCanonicalFragmentRecord(fragment()) as Record<string, unknown>;
    (record.evidence as Record<string, unknown>).span = { documentId: 'd', format: 'html' };
    expect(deserializeKnowledgeFragment(record)).toBeNull();
  });

  it('no verifica la cita: eso corresponde al validador de la Fase B', () => {
    // Una cita cuyo texto NO existe en documento alguno se deserializa igual;
    // el modelo transporta, no valida.
    const mentira = fragment({
      evidence: {
        level: 'official_publication',
        method: 'website-extraction',
        capturedAt: '2026-07-01',
        span: { ...SPAN, text: 'texto inventado' },
      },
    });
    expect(deserializeKnowledgeFragment(serializeKnowledgeFragment(mentira))).not.toBeNull();
  });
});
