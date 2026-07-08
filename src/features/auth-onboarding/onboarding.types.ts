/**
 * Types for the guided 3-minute onboarding flow (E1-T2).
 *
 * These types are intentionally framework-agnostic so the flow can be driven
 * from a wizard UI, an API controller, or tests. When `src/shared/types` becomes
 * available, `LeadDraft` should be aligned with the shared `Lead` entity.
 */

/** Identifier of each step in the guided onboarding wizard. */
export type OnboardingStepId = 'welcome' | 'profile' | 'first-lead' | 'done';

/** Ordered list of steps the user walks through, front to back. */
export const ONBOARDING_STEP_ORDER: readonly OnboardingStepId[] = [
  'welcome',
  'profile',
  'first-lead',
  'done',
] as const;

/** Minimal profile captured during onboarding to personalize the CRM. */
export interface OnboardingProfile {
  /** Display name of the freelancer. */
  readonly fullName: string;
  /** Optional business or brand name shown on quotes. */
  readonly businessName: string | null;
}

/** The first lead the user creates as the activation action of onboarding. */
export interface LeadDraft {
  /** Contact name of the potential client. */
  readonly name: string;
  /** Optional email used for follow-ups. */
  readonly email: string | null;
  /** Optional free-form note about the opportunity. */
  readonly note: string | null;
}

/** Persistent state of a user's onboarding progress. */
export interface OnboardingState {
  readonly userId: string;
  /** The step currently presented to the user. */
  readonly currentStep: OnboardingStepId;
  /** Steps the user has already completed, in completion order. */
  readonly completedSteps: readonly OnboardingStepId[];
  /** Captured profile, or null until the profile step is completed. */
  readonly profile: OnboardingProfile | null;
  /** The first lead draft, or null until the first-lead step is completed. */
  readonly firstLead: LeadDraft | null;
  /** True once the flow reaches `done` (either finished or skipped). */
  readonly isComplete: boolean;
  /** True if the user skipped rather than completing every step. */
  readonly skipped: boolean;
}

/** Discriminated result type: no exceptions for expected validation failures. */
export type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const err = <T>(error: string): Result<T> => ({ ok: false, error });
