/**
 * Tipos del dominio de Gestión de Leads.
 *
 * Nota: idealmente estos tipos vivirían en `src/shared/types/index.ts`,
 * pero ese módulo aún no existe en el proyecto. Se definen aquí de forma
 * local y se re-exportan para que el resto de features puedan reutilizarlos.
 */

/** Etapas del pipeline de un lead, en orden de avance. */
export const LEAD_STAGES = [
  'nuevo',
  'contactado',
  'propuesta',
  'negociacion',
  'ganado',
  'perdido',
] as const;

export type LeadStage = (typeof LEAD_STAGES)[number];

/** Medio de contacto principal del lead. */
export type ContactChannel = 'email' | 'telefono';

/** Contacto normalizado del lead. */
export interface LeadContact {
  readonly channel: ContactChannel;
  readonly value: string;
}

/** Entidad Lead persistida. */
export interface Lead {
  readonly id: string;
  readonly name: string;
  readonly contact: LeadContact;
  /** Valor estimado del proyecto en la moneda base del usuario. */
  readonly estimatedValue: number;
  readonly stage: LeadStage;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Payload del formulario de alta rápida (mínimo indispensable). */
export interface QuickAddLeadInput {
  readonly name: string;
  /** Email o teléfono en texto libre; el servicio lo normaliza. */
  readonly contact: string;
  readonly estimatedValue: number;
  /** Si se omite, el lead arranca en la etapa `nuevo`. */
  readonly stage?: LeadStage;
}

/** Puerto de persistencia. Desacopla el servicio del almacenamiento concreto. */
export interface LeadRepository {
  save(lead: Lead): Promise<Lead>;
}

/** Error de validación con detalle por campo, apto para pintar en el form. */
export class LeadValidationError extends Error {
  public readonly fieldErrors: Readonly<Record<string, string>>;

  constructor(fieldErrors: Readonly<Record<string, string>>) {
    super('El lead no pudo crearse por errores de validación.');
    this.name = 'LeadValidationError';
    this.fieldErrors = fieldErrors;
    Object.setPrototypeOf(this, LeadValidationError.prototype);
  }
}
