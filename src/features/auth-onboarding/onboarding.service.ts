/**
 * Guided 3-minute onboarding service (E1-T2).
 *
 * Drives a short, low-friction post-registration flow that ends with the user
 * having created their first lead. Pure and deterministic: every transition
 * takes the current state and returns a new state (or a validation error),
 * which makes it trivial to wire into a wizard UI or an API layer and to test.
 */

import {
  LeadDraft,
  ONBOARDING_STEP_ORDER,
  OnboardingProfile,
  OnboardingState,
  OnboardingStepId,
  Result,
  err,
  ok,
} from './onboarding.types';

/** Fields returned to a UI to render a progress bar / step counter. */
export interface OnboardingProgress {
  readonly currentStep: OnboardingStepId;
  readonly stepNumber: number;
  readonly totalSteps: number;
  readonly percentComplete: number;
  readonly isComplete: boolean;
}

const indexOfStep = (step: OnboardingStepId): number =>
  ONBOARDING_STEP_ORDER.indexOf(step);

const nextStep = (step: OnboardingStepId): OnboardingStepId => {
  const idx = indexOfStep(step);
  const next = ONBOARDING_STEP_ORDER[idx + 1];
  return next ?? 'done';
};

const withStepCompleted = (
  state: OnboardingState,
  step: OnboardingStepId,
): readonly OnboardingStepId[] =>
  state.completedSteps.includes(step)
    ? state.completedSteps
    : [...state.completedSteps, step];

export class OnboardingService {
  /** Creates a fresh onboarding state positioned at the welcome step. */
  start(userId: string): Result<OnboardingState> {
    const trimmed = userId.trim();
    if (trimmed.length === 0) {
      return err('userId is required to start onboarding');
    }
    return ok({
      userId: trimmed,
      currentStep: 'welcome',
      completedSteps: [],
      profile: null,
      firstLead: null,
      isComplete: false,
      skipped: false,
    });
  }

  /** Advances from the welcome screen to the profile step. */
  acknowledgeWelcome(state: OnboardingState): Result<OnboardingState> {
    if (state.currentStep !== 'welcome') {
      return err(`Cannot acknowledge welcome from step "${state.currentStep}"`);
    }
    return ok({
      ...state,
      currentStep: nextStep('welcome'),
      completedSteps: withStepCompleted(state, 'welcome'),
    });
  }

  /** Captures the profile and moves the user to the first-lead step. */
  submitProfile(
    state: OnboardingState,
    input: { fullName: string; businessName?: string | null },
  ): Result<OnboardingState> {
    if (state.currentStep !== 'profile') {
      return err(`Cannot submit profile from step "${state.currentStep}"`);
    }
    const fullName = input.fullName.trim();
    if (fullName.length === 0) {
      return err('fullName is required');
    }
    const businessNameRaw = (input.businessName ?? '').trim();
    const profile: OnboardingProfile = {
      fullName,
      businessName: businessNameRaw.length > 0 ? businessNameRaw : null,
    };
    return ok({
      ...state,
      profile,
      currentStep: nextStep('profile'),
      completedSteps: withStepCompleted(state, 'profile'),
    });
  }

  /**
   * The activation action: create the first lead. On success the flow reaches
   * the `done` step and onboarding is marked complete.
   */
  createFirstLead(
    state: OnboardingState,
    input: { name: string; email?: string | null; note?: string | null },
  ): Result<OnboardingState> {
    if (state.currentStep !== 'first-lead') {
      return err(`Cannot create first lead from step "${state.currentStep}"`);
    }
    const name = input.name.trim();
    if (name.length === 0) {
      return err('Lead name is required');
    }
    const emailRaw = (input.email ?? '').trim();
    if (emailRaw.length > 0 && !this.isValidEmail(emailRaw)) {
      return err('Lead email is not a valid email address');
    }
    const noteRaw = (input.note ?? '').trim();
    const firstLead: LeadDraft = {
      name,
      email: emailRaw.length > 0 ? emailRaw : null,
      note: noteRaw.length > 0 ? noteRaw : null,
    };
    return ok({
      ...state,
      firstLead,
      currentStep: 'done',
      completedSteps: withStepCompleted(state, 'first-lead'),
      isComplete: true,
      skipped: false,
    });
  }

  /**
   * Escape hatch: let the user bail out at any point. Keeps whatever data was
   * already captured, jumps straight to `done`, and flags the flow as skipped
   * so the product can nudge them to finish later.
   */
  skip(state: OnboardingState): Result<OnboardingState> {
    if (state.isComplete) {
      return err('Onboarding is already complete');
    }
    return ok({
      ...state,
      currentStep: 'done',
      isComplete: true,
      skipped: true,
    });
  }

  /** Derives UI-facing progress information from a state. */
  progress(state: OnboardingState): OnboardingProgress {
    const totalSteps = ONBOARDING_STEP_ORDER.length - 1; // exclude terminal 'done'
    const stepNumber = Math.min(indexOfStep(state.currentStep) + 1, totalSteps);
    const percentComplete = state.isComplete
      ? 100
      : Math.round((state.completedSteps.length / totalSteps) * 100);
    return {
      currentStep: state.currentStep,
      stepNumber,
      totalSteps,
      percentComplete,
      isComplete: state.isComplete,
    };
  }

  private isValidEmail(value: string): boolean {
    // Pragmatic check: one @, non-empty local and domain, a dot in the domain.
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }
}

export const onboardingService = new OnboardingService();
