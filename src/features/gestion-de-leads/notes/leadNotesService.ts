import {
  type Clock,
  type CreateNoteInput,
  type IdGenerator,
  type LeadId,
  type LeadNote,
  type LeadNoteRepository,
  type NoteId,
  NoteNotFoundError,
  NoteValidationError,
  type UpdateNoteInput,
} from './types';

/** Longitud máxima permitida para el texto de una nota. */
export const MAX_NOTE_LENGTH = 5000;

interface LeadNotesServiceDeps {
  readonly repository: LeadNoteRepository;
  /** Por defecto usa crypto.randomUUID(). Inyectable para tests. */
  readonly generateId?: IdGenerator;
  /** Por defecto usa () => new Date(). Inyectable para tests. */
  readonly clock?: Clock;
}

function defaultIdGenerator(): NoteId {
  // crypto.randomUUID está disponible en Node >= 19 y navegadores modernos.
  return crypto.randomUUID();
}

function normalizeContent(raw: string): string {
  const content = raw.trim();
  if (content.length === 0) {
    throw new NoteValidationError('La nota no puede estar vacía.');
  }
  if (content.length > MAX_NOTE_LENGTH) {
    throw new NoteValidationError(
      `La nota no puede superar los ${MAX_NOTE_LENGTH} caracteres.`,
    );
  }
  return content;
}

/**
 * Servicio de dominio para las notas rápidas de un lead (E2-T2).
 * Encapsula validación y orquesta la persistencia a través del repositorio.
 */
export class LeadNotesService {
  private readonly repository: LeadNoteRepository;
  private readonly generateId: IdGenerator;
  private readonly clock: Clock;

  constructor(deps: LeadNotesServiceDeps) {
    this.repository = deps.repository;
    this.generateId = deps.generateId ?? defaultIdGenerator;
    this.clock = deps.clock ?? ((): Date => new Date());
  }

  /** Crea una nota de texto libre para un lead. */
  async addNote(input: CreateNoteInput): Promise<LeadNote> {
    const leadId = input.leadId.trim();
    if (leadId.length === 0) {
      throw new NoteValidationError('leadId es obligatorio.');
    }
    const content = normalizeContent(input.content);
    const now = this.clock();

    const note: LeadNote = {
      id: this.generateId(),
      leadId,
      content,
      createdAt: now,
      updatedAt: now,
    };

    await this.repository.save(note);
    return note;
  }

  /** Lista las notas de un lead, de la más reciente a la más antigua. */
  async listNotes(leadId: LeadId): Promise<readonly LeadNote[]> {
    return this.repository.findByLeadId(leadId);
  }

  /** Devuelve una nota puntual o null si no existe. */
  async getNote(id: NoteId): Promise<LeadNote | null> {
    return this.repository.findById(id);
  }

  /** Actualiza el contenido de una nota existente. */
  async updateNote(input: UpdateNoteInput): Promise<LeadNote> {
    const existing = await this.repository.findById(input.id);
    if (existing === null) {
      throw new NoteNotFoundError(input.id);
    }
    const content = normalizeContent(input.content);

    const updated: LeadNote = {
      ...existing,
      content,
      updatedAt: this.clock(),
    };

    await this.repository.save(updated);
    return updated;
  }

  /** Elimina una nota. Idempotente: no falla si la nota ya no existe. */
  async deleteNote(id: NoteId): Promise<void> {
    await this.repository.delete(id);
  }
}
