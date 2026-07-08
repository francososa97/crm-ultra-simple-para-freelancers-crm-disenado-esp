import type { LeadId, LeadNote, LeadNoteRepository, NoteId } from './types';

/**
 * Implementación en memoria de LeadNoteRepository.
 * Útil para desarrollo, tests y como base para adaptadores persistentes.
 */
export class InMemoryLeadNoteRepository implements LeadNoteRepository {
  private readonly notes = new Map<NoteId, LeadNote>();

  async save(note: LeadNote): Promise<void> {
    this.notes.set(note.id, note);
  }

  async findById(id: NoteId): Promise<LeadNote | null> {
    return this.notes.get(id) ?? null;
  }

  async findByLeadId(leadId: LeadId): Promise<readonly LeadNote[]> {
    return [...this.notes.values()]
      .filter((note) => note.leadId === leadId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async delete(id: NoteId): Promise<void> {
    this.notes.delete(id);
  }
}
