'use client';

/**
 * Zustand store — UI state only.
 *
 * Auth state is now managed by Supabase (see src/lib/supabase/).
 * Middleware handles route protection server-side.
 *
 * This store handles:
 * - darkMode (persisted to localStorage)
 * - Optimistic UI state for pipeline/jobs while transitioning to Supabase
 *   (pipeline/appliedJobIds/messagedReferralIds will be removed in Phase 5)
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { initialPipeline } from '@/data/pipeline';

const useStore = create(
  persist(
    (set) => ({
      // ── UI ───────────────────────────────────────────────
      darkMode: false,

      // ── Optimistic data (Phase 5: replaced by Supabase Realtime) ──
      pipeline: initialPipeline,
      appliedJobIds: [],
      messagedReferralIds: [],
      sentFollowUpIds: [],

      // ── UI Actions ────────────────────────────────────────
      toggleDarkMode: () =>
        set((state) => ({ darkMode: !state.darkMode })),

      // ── Optimistic Job Actions ────────────────────────────
      applyToJob: (job) =>
        set((state) => {
          if (state.appliedJobIds.includes(job.id)) return state;
          return {
            appliedJobIds: [...state.appliedJobIds, job.id],
            pipeline: [
              ...state.pipeline,
              {
                id: Date.now(),
                company: job.company,
                role: job.title,
                contact: null,
                lastActivity: 'Just now',
                stage: 'applied',
                logo: job.companyLogo,
                logoColor: job.logoColor,
              },
            ],
          };
        }),

      // ── Optimistic Referral Actions ───────────────────────
      messageReferral: (referral) =>
        set((state) => {
          if (state.messagedReferralIds.includes(referral.id)) return state;
          return {
            messagedReferralIds: [...state.messagedReferralIds, referral.id],
            pipeline: [
              ...state.pipeline,
              {
                id: Date.now() + 1,
                company: referral.company,
                role: `Referral – ${referral.name}`,
                contact: referral.name,
                lastActivity: 'Just now',
                stage: 'messaged',
                logo: referral.avatar.slice(0, 1),
                logoColor: referral.avatarColor,
              },
            ],
          };
        }),

      sendFollowUp: (followUpId) =>
        set((state) => ({
          sentFollowUpIds: [...state.sentFollowUpIds, followUpId],
        })),

      // ── Optimistic Pipeline Actions ───────────────────────
      updatePipelineStage: (cardId, newStage) =>
        set((state) => ({
          pipeline: state.pipeline.map((card) =>
            card.id === cardId
              ? { ...card, stage: newStage, lastActivity: 'Just now' }
              : card,
          ),
        })),
    }),
    {
      name: 'careerpilot-store',
      version: 2, // bumped — old auth keys cleared on hydration
    },
  ),
);

export default useStore;
