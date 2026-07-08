/**
 * Servicio del Pipeline Kanban.
 *
 * Responsable de la lógica pura (sin I/O) de la vista Kanban: agrupar leads en
 * columnas de etapas fijas y mover un lead de una etapa a otra. Al ser funciones
 * puras, son triviales de testear y de conectar a cualquier capa de persistencia
 * o UI (React, etc.) según ARCHITECTURE.md (features aislados, dominio sin efectos).
 */

import {
  type KanbanBoard,
  type KanbanColumn,
  type Lead,
  type LeadId,
  type PipelineStage,
  PIPELINE_STAGES,
  PipelineError,
  STAGE_LABELS,
} from './types';

/** Type guard: verifica que un string arbitrario sea una etapa válida. */
export function isPipelineStage(value: string): value is PipelineStage {
  return (PIPELINE_STAGES as readonly string[]).includes(value);
}

/**
 * Construye el board completo a partir de una lista plana de leads.
 *
 * Garantiza que SIEMPRE existan las 5 columnas en el orden canónico, incluso si
 * alguna etapa no tiene leads (columnas vacías). Los leads de cada columna se
 * ordenan por `updatedAt` descendente (los más recientes arriba).
 */
export function buildBoard(leads: readonly Lead[]): KanbanBoard {
  const byStage = new Map<PipelineStage, Lead[]>();
  for (const stage of PIPELINE_STAGES) {
    byStage.set(stage, []);
  }

  for (const lead of leads) {
    const bucket = byStage.get(lead.stage);
    if (bucket === undefined) {
      throw new PipelineError(
        `Lead "${lead.id}" tiene una etapa desconocida: "${lead.stage}".`,
      );
    }
    bucket.push(lead);
  }

  const columns: KanbanColumn[] = PIPELINE_STAGES.map((stage) => {
    const columnLeads = [...(byStage.get(stage) ?? [])].sort(
      (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
    );
    const totalValue = columnLeads.reduce(
      (sum, lead) => sum + (lead.estimatedValue ?? 0),
      0,
    );
    return {
      stage,
      label: STAGE_LABELS[stage],
      leads: columnLeads,
      count: columnLeads.length,
      totalValue,
    };
  });

  return { columns };
}

/**
 * Mueve un lead a una nueva etapa y devuelve una NUEVA lista de leads
 * (inmutable: no muta la entrada). Actualiza `updatedAt` al timestamp provisto.
 *
 * @param leads      lista actual de leads
 * @param leadId     id del lead a mover
 * @param toStage    etapa destino (debe ser una etapa válida del pipeline)
 * @param now        timestamp ISO 8601 para `updatedAt`; se inyecta para pureza/testabilidad
 * @throws PipelineError si el lead no existe o la etapa destino es inválida
 */
export function moveLead(
  leads: readonly Lead[],
  leadId: LeadId,
  toStage: PipelineStage,
  now: string,
): Lead[] {
  if (!isPipelineStage(toStage)) {
    throw new PipelineError(`Etapa destino inválida: "${toStage}".`);
  }

  const index = leads.findIndex((lead) => lead.id === leadId);
  if (index === -1) {
    throw new PipelineError(`No existe un lead con id "${leadId}".`);
  }

  const current = leads[index];
  if (current.stage === toStage) {
    // Sin cambios de etapa: devolvemos una copia sin tocar nada.
    return [...leads];
  }

  const updated: Lead = { ...current, stage: toStage, updatedAt: now };
  const next = [...leads];
  next[index] = updated;
  return next;
}

/** Resumen agregado del pipeline, útil para cabeceras/dashboards. */
export interface PipelineSummary {
  readonly totalLeads: number;
  readonly openLeads: number;
  readonly wonValue: number;
  readonly openValue: number;
}

/**
 * Calcula métricas rápidas del pipeline. Considera "abiertos" a los leads que no
 * están en un estado terminal (`ganado` / `perdido`).
 */
export function summarizePipeline(leads: readonly Lead[]): PipelineSummary {
  const terminal: ReadonlySet<PipelineStage> = new Set<PipelineStage>([
    'ganado',
    'perdido',
  ]);

  let openLeads = 0;
  let wonValue = 0;
  let openValue = 0;

  for (const lead of leads) {
    const value = lead.estimatedValue ?? 0;
    if (lead.stage === 'ganado') {
      wonValue += value;
    }
    if (!terminal.has(lead.stage)) {
      openLeads += 1;
      openValue += value;
    }
  }

  return {
    totalLeads: leads.length,
    openLeads,
    wonValue,
    openValue,
  };
}
