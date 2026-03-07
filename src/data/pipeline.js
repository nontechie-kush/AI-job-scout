// Stages must match the Supabase pipeline.stage CHECK constraint:
// applied|confirmed|messaged|replied|interviewing|offer|rejected|ghosted|prospect

export const initialPipeline = [];

export const stages = [
  {
    id: 'prospect',
    label: 'Prospect',
    color: 'bg-gray-100 dark:bg-slate-800/60',
    textColor: 'text-gray-600 dark:text-gray-400',
    dotColor: 'bg-gray-400',
  },
  {
    id: 'applied',
    label: 'Applied',
    color: 'bg-blue-100 dark:bg-blue-900/30',
    textColor: 'text-blue-700 dark:text-blue-300',
    dotColor: 'bg-blue-500',
  },
  {
    id: 'confirmed',
    label: 'Confirmed',
    color: 'bg-indigo-100 dark:bg-indigo-900/30',
    textColor: 'text-indigo-700 dark:text-indigo-300',
    dotColor: 'bg-indigo-500',
  },
  {
    id: 'messaged',
    label: 'Messaged',
    color: 'bg-violet-100 dark:bg-violet-900/30',
    textColor: 'text-violet-700 dark:text-violet-300',
    dotColor: 'bg-violet-500',
  },
  {
    id: 'replied',
    label: 'Replied',
    color: 'bg-amber-100 dark:bg-amber-900/30',
    textColor: 'text-amber-700 dark:text-amber-300',
    dotColor: 'bg-amber-500',
  },
  {
    id: 'interviewing',
    label: 'Interviewing',
    color: 'bg-emerald-100 dark:bg-emerald-900/30',
    textColor: 'text-emerald-700 dark:text-emerald-300',
    dotColor: 'bg-emerald-500',
  },
  {
    id: 'offer',
    label: 'Offer',
    color: 'bg-green-100 dark:bg-green-900/30',
    textColor: 'text-green-700 dark:text-green-300',
    dotColor: 'bg-green-500',
  },
  {
    id: 'rejected',
    label: 'Rejected',
    color: 'bg-red-100 dark:bg-red-900/30',
    textColor: 'text-red-700 dark:text-red-300',
    dotColor: 'bg-red-500',
  },
  {
    id: 'ghosted',
    label: 'Ghosted',
    color: 'bg-gray-100 dark:bg-slate-800/60',
    textColor: 'text-gray-500 dark:text-gray-500',
    dotColor: 'bg-gray-400 dark:bg-gray-600',
  },
];
