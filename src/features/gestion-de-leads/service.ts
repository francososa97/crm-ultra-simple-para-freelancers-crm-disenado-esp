/**
 * Servicio de alta rápida de leads (E2-T1).
 *
 * Objetivo: permitir crear un lead con el mínimo de campos
 * (nombre, contacto, valor estimado, etapa) en menos de 30 segundos,
 * validando y normalizando la entrada antes de persistir.
 */

import {
  LEAD_STAGES,
  LeadValidationError,
  type ContactChannel,
  type Lead,
  type LeadContact,
  type LeadRepository,
  type LeadStage,
  type QuickAddLeadInput,
} from './types';

const DEFAULT_STAGE: LeadStage = 'nuevo';
const MAX_NAME_LENGTH = 120;

// Validación pragmática: no busca ser un parser RFC 5322, solo descartar
// entradas evidentemente inválidas del formulario rápido.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[0-9]{6,15}$/;

/** Genera un identificador único sin dependencias externas. */
function generateId(now: Date): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `lead_${now.getTime().toString(36)}_${random}`;
}

function isLeadStage(value: string): value is LeadStage {
  return (LEAD_STAGES as readonly string[]).includes(value);
}

/** Detecta el canal de contacto y normaliza el valor. */
function parseContact(raw: string): LeadContact | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }

  if (EMAIL_PATTERN.test(trimmed)) {
    return { channel: 'email' satisfies ContactChannel, value: trimmed.toLowerCase() };
  }

  const compactPhone = trimmed.replace(/[\s().-]/g, '');
  if (PHONE_PATTERN.test(compactPhone)) {
    return { channel: 'telefono' satisfies ContactChannel, value: compactPhone };
  }

  return null;
}

function validate(input: QuickAddLeadInput): {
  name: string;
  contact: LeadContact;
  estimatedValue: number;
  stage: LeadStage;
} {
  const fieldErrors: Record<string, string> = {};

  const name = input.name?.trim() ?? '';
  if (name.length === 0) {
    fieldErrors.name = 'El nombre es obligatorio.';
  } else if (name.length > MAX_NAME_LENGTH) {
    fieldErrors.name = `El nombre no puede superar los ${MAX_NAME_LENGTH} caracteres.`;
  }

  const contact = parseContact(input.contact ?? '');
  if (contact === null) {
    fieldErrors.contact = 'Ingresá un email o teléfono válido.';
  }

  const estimatedValue = input.estimatedValue;
  if (typeof estimatedValue !== 'number' || !Number.isFinite(estimatedValue)) {
    fieldErrors.estimatedValue = 'El valor estimado debe ser un número.';
  } else if (estimatedValue < 0) {
    fieldErrors.estimatedValue = 'El valor estimado no puede ser negativo.';
  }

  const stage: LeadStage = input.stage ?? DEFAULT_STAGE;
  if (!isLeadStage(stage)) {
    fieldErrors.stage = 'La etapa seleccionada no es válida.';
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new LeadValidationError(fieldErrors);
  }

  // En este punto los campos ya fueron validados.
  return {
    name,
    contact: contact as LeadContact,
    estimatedValue: estimatedValue as number,
    stage,
  };
}

/**
 * Crea un lead a partir del formulario de alta rápida.
 *
 * @throws {LeadValidationError} si algún campo no pasa validación.
 */
export async function quickAddLead(
  input: QuickAddLeadInput,
  repository: LeadRepository,
): Promise<Lead> {
  const clean = validate(input);
  const now = new Date();

  const lead: Lead = {
    id: generateId(now),
    name: clean.name,
    contact: clean.contact,
    estimatedValue: clean.estimatedValue,
    stage: clean.stage,
    createdAt: now,
    updatedAt: now,
  };

  return repository.save(lead);
}

/**
 * Repositorio en memoria útil para pruebas y prototipado local.
 * Sustituible por una implementación real (DB/API) que cumpla `LeadRepository`.
 */
export class InMemoryLeadRepository implements LeadRepository {
  private readonly leads = new Map<string, Lead>();

  async save(lead: Lead): Promise<Lead> {
    this.leads.set(lead.id, lead);
    return lead;
  }

  async list(): Promise<readonly Lead[]> {
    return Array.from(this.leads.values());
  }
}
