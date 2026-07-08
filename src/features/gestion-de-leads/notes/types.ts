// Tipos para la funcionalidad de notas rápidas por lead (E2-T2).
// Se definen aquí porque src/shared/types/index.ts aún no expone estos modelos;
// cuando exista, LeadId debería reexportarse desde ahí.

/** Identificador único de un lead. */
export type LeadId = string;

/** Identificador único de una nota. */
export type NoteId = string;

/**
 * Nota rápida asociada a un lead. Texto libre para registrar el contexto
 * de conversaciones (llamadas, emails, reuniones) sin estructura rígida.
 */
export interface LeadNote {
  readonly id: NoteId;
  readonly leadId: LeadId;
  /** Contenido de texto libre. Nunca vacío tras la validación del servicio. */
  readonly content: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Datos de entrada para crear una nota. */
export interface CreateNoteInput {
  readonly leadId: LeadId;
  readonly content: string;
}

/** Datos de entrada para actualizar el contenido de una nota existente. */
export interface UpdateNoteInput {
  readonly id: NoteId;
  readonly content: string;
}

/** Error de dominio para operaciones de notas. */
export class NoteValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NoteValidationError';
  }
}

export class NoteNotFoundError extends Error {
  constructor(id: NoteId) {
    super(`No existe una nota con id "${id}".`);
    this.name = 'NoteNotFoundError';
  }
}

/**
 * Puerto de persistencia. Permite intercambiar la implementación
 * (memoria, localStorage, API) sin tocar la lógica del servicio.
 */
export interface LeadNoteRepository {
  save(note: LeadNote): Promise<void>;
  findById(id: NoteId): Promise<LeadNote | null>;
  findByLeadId(leadId: LeadId): Promise<readonly LeadNote[]>;
  delete(id: NoteId): Promise<void>;
}

/** Genera identificadores únicos. Inyectable para tests deterministas. */
export type IdGenerator = () => NoteId;

/** Provee la fecha actual. Inyectable para tests deterministas. */
export type Clock = () => Date;
