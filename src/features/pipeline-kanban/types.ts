/**
 * Tipos del feature Pipeline Kanban.
 *
 * NOTA: Idealmente estos tipos base (Lead, LeadId) viven en
 * `src/shared/types/index.ts` y se reexportan desde acá. Mientras ese módulo
 * compartido no exista en el repo, se definen localmente para que el feature
 * sea autocontenido y compile en strict mode. Cuando el shared type exista,
 * reemplazar las definiciones de `Lead`/`LeadId` por un `import`.
 */

/** Identificador único de un lead. */
export type LeadId = string;

/**
 * Etapas fijas del pipeline. El orden del union refleja el orden visual
 * de las columnas del Kanban, de izquierda a derecha.
 */
export type PipelineStage =
  | 'nuevo'
  | 'contactado'
  | 'propuesta_enviada'
  | 'ganado'
  | 'perdido';

/**
 * Orden canónico de las columnas. Es la única fuente de verdad del layout
 * y se usa para construir el board y validar movimientos.
 */
export const PIPELINE_STAGES: readonly PipelineStage[] = [
  'nuevo',
  'contactado',
  'propuesta_enviada',
  'ganado',
  'perdido',
] as const;

/** Etiquetas legibles (español) para renderizar los encabezados de columna. */
export const STAGE_LABELS: Readonly<Record<PipelineStage, string>> = {
  nuevo: 'Nuevo',
  contactado: 'Contactado',
  propuesta_enviada: 'Propuesta enviada',
  ganado: 'Ganado',
  perdido: 'Perdido',
};

/**
 * Lead mínimo necesario para posicionarlo en el board. Se mantiene acotado a
 * lo que el Kanban consume; el modelo completo del lead vive en su propio feature.
 */
export interface Lead {
  readonly id: LeadId;
  readonly name: string;
  readonly stage: PipelineStage;
  /** Valor estimado del proyecto en la moneda base del freelancer. */
  readonly estimatedValue?: number;
  /** ISO 8601. Fecha del último cambio de etapa. */
  readonly updatedAt: string;
}

/** Una columna del Kanban con sus leads ya agrupados y un resumen. */
export interface KanbanColumn {
  readonly stage: PipelineStage;
  readonly label: string;
  readonly leads: readonly Lead[];
  /** Cantidad de leads en la columna. */
  readonly count: number;
  /** Suma de `estimatedValue` de los leads de la columna. */
  readonly totalValue: number;
}

/** Representación completa del board: columnas en orden canónico. */
export interface KanbanBoard {
  readonly columns: readonly KanbanColumn[];
}

/** Error de dominio del pipeline (movimientos inválidos, etapas inexistentes). */
export class PipelineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PipelineError';
  }
}
