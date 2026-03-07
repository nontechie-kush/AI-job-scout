'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, Edit3, Paperclip } from 'lucide-react';
import useStore from '@/store/useStore';

const STEPS = ['opening', 'filling', 'form', 'success'];

function LoadingStep({ message, submessage }) {
  return (
    <motion.div
      key="loading"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex flex-col items-center gap-4 py-8"
    >
      <div className="w-14 h-14 spinner" />
      <div className="text-center">
        <p className="font-semibold text-gray-900 dark:text-white">{message}</p>
        {submessage && <p className="text-gray-400 text-sm mt-1">{submessage}</p>}
      </div>
      <div className="w-48 bg-gray-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-violet-500 to-blue-500 rounded-full"
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{ duration: 1.4, ease: 'easeInOut' }}
        />
      </div>
    </motion.div>
  );
}

export default function ApplicationFlow({ job, onClose }) {
  const applyToJob = useStore((s) => s.applyToJob);
  const user = useStore((s) => s.user);
  const [step, setStep] = useState(0); // 0=opening 1=filling 2=form 3=success
  const [formData, setFormData] = useState({
    name: user?.name || 'Alex Johnson',
    email: user?.email || 'alex@example.com',
    coverAnswer: `I'm excited to apply for the ${job?.title} role at ${job?.company}. With 5 years of experience in frontend engineering, specializing in TypeScript and React, I've led complex projects including a full Angular-to-React migration that improved load time by 35%. I'm particularly drawn to ${job?.company}'s mission and the scale of engineering challenges your team tackles. I'm confident I'd make an immediate impact on your team.`,
  });

  useEffect(() => {
    // Auto-advance loading steps
    if (step === 0) {
      const t = setTimeout(() => setStep(1), 1800);
      return () => clearTimeout(t);
    }
    if (step === 1) {
      const t = setTimeout(() => setStep(2), 1800);
      return () => clearTimeout(t);
    }
  }, [step]);

  const handleSubmit = async () => {
    setStep(3);
    applyToJob(job);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={step === 3 ? onClose : undefined}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />

      {/* Sheet */}
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="relative w-full max-w-[430px] bg-white dark:bg-slate-900 rounded-t-3xl max-h-[90dvh] overflow-y-auto"
      >
        {/* Handle + header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-4 border-b border-gray-100 dark:border-slate-800">
          <div>
            <div className="w-10 h-1 bg-gray-300 dark:bg-slate-700 rounded-full mx-auto mb-4" />
            <h2 className="font-bold text-gray-900 dark:text-white text-lg">
              {step < 2 ? 'Applying to ' + job?.company : step === 2 ? 'Review Application' : 'Application Sent! 🎉'}
            </h2>
            {step < 2 && (
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">{job?.title}</p>
            )}
          </div>
          {step !== 3 && (
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center">
              <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            </button>
          )}
        </div>

        {/* Step content */}
        <div className="px-5 py-5">
          <AnimatePresence mode="wait">
            {/* Step 0: Opening portal */}
            {step === 0 && (
              <LoadingStep
                key="opening"
                message="Opening job portal…"
                submessage={`Navigating to ${job?.company}'s application system`}
              />
            )}

            {/* Step 1: Filling */}
            {step === 1 && (
              <LoadingStep
                key="filling"
                message="Filling your application…"
                submessage="AI is pre-populating fields from your resume"
              />
            )}

            {/* Step 2: Form review */}
            {step === 2 && (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  Application pre-filled by AI — review before submitting
                </div>

                {/* Name */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">
                    Full Name
                  </label>
                  <input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input-field"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">
                    Email
                  </label>
                  <input
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="input-field"
                    type="email"
                  />
                </div>

                {/* Resume */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">
                    Resume
                  </label>
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700">
                    <Paperclip className="w-4 h-4 text-violet-500" />
                    <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">
                      Alex_Johnson_Resume_2024.pdf
                    </span>
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">✓ Attached</span>
                  </div>
                </div>

                {/* Cover answer */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      AI-Generated Cover Answer
                    </label>
                    <div className="flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400">
                      <Edit3 className="w-3 h-3" />
                      Editable
                    </div>
                  </div>
                  <textarea
                    value={formData.coverAnswer}
                    onChange={(e) => setFormData({ ...formData, coverAnswer: e.target.value })}
                    rows={5}
                    className="input-field resize-none text-sm leading-relaxed"
                  />
                  <p className="text-gray-400 text-xs mt-1">Generated based on your profile and this role's requirements.</p>
                </div>

                <button
                  onClick={handleSubmit}
                  className="btn-gradient w-full py-4 rounded-xl text-white font-semibold text-sm"
                >
                  Submit Application
                </button>
              </motion.div>
            )}

            {/* Step 3: Success */}
            {step === 3 && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-5 py-6 text-center"
              >
                {/* Success icon */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.1 }}
                  className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-xl shadow-emerald-500/30"
                >
                  <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                    <path
                      d="M10 20L17 27L30 14"
                      stroke="white"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="checkmark-path"
                    />
                  </svg>
                </motion.div>

                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Application Submitted!</h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm mt-2 leading-relaxed">
                    Your application to <strong className="text-gray-800 dark:text-gray-200">{job?.company}</strong> has been sent.
                    Confirmation email detected in inbox.
                  </p>
                </div>

                <div className="w-full card p-4 text-left space-y-2">
                  {[
                    { icon: '📧', text: 'Confirmation email sent to ' + formData.email },
                    { icon: '📊', text: 'Added to your pipeline under "Applied"' },
                    { icon: '🔔', text: 'AI will monitor for a response in 5–7 days' },
                  ].map((item) => (
                    <div key={item.text} className="flex items-start gap-2.5">
                      <span className="text-base leading-none mt-0.5">{item.icon}</span>
                      <span className="text-sm text-gray-600 dark:text-gray-300">{item.text}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={onClose}
                  className="btn-gradient w-full py-4 rounded-xl text-white font-semibold text-sm"
                >
                  Done
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
