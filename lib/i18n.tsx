'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

/**
 * TODO: Native speaker review required for the following Kannada translations:
 * 1. "Pending Verification" -> "ಪರಿಶೀಲನೆ ಬಾಕಿ ಇದೆ" (Parishīlane bāki ide)
 * 2. "Citizen Verified" -> "ನಾಗರಿಕರಿಂದ ದೃಢೀಕರಿಸಲಾಗಿದೆ" (Nāgarikarinda dr̥ḍhīkarisalāgide)
 * 3. "Civic Trust Index" -> "ನಾಗರಿಕ ನಂಬಿಕೆ ಸೂಚ್ಯಂಕ" (Nāgarika nambike sūcyāṅka)
 * 4. "Disputed - Admin Review" -> "ವಿವಾದ - ಆಡಳಿತ ಪರಿಶೀಲನೆ" (Vivāda - āḍaḷita parishīlane)
 * 5. "Upload proof of fix" -> "ಪರಿಹಾರದ ಪುರಾವೆ ಅಪ್‌ಲೋಡ್ ಮಾಡಿ" (Parihārada purāve aplōḍ māḍi)
 * 6. "Before and after fix" -> "ಪರಿಹಾರದ ಮೊದಲು ಮತ್ತು ನಂತರ" (Parihārada modalu mattu nantara)
 */

export type Language = 'en' | 'kn';

export interface Translations {
  // Actions
  reportProblem: string;
  supportReport: string;
  supported: string;
  markInProgress: string;
  uploadProofOfFix: string;
  yesFixed: string;
  notFixed: string;
  cancel: string;
  back: string;
  next: string;
  submitReport: string;
  takeLivePhoto: string;
  choosePhoto: string;
  changePhoto: string;
  differentProblem: string;
  viewDetails: string;
  share: string;
  openCamera: string;
  retake: string;
  confirmLocation: string;
  stepOf: (current: number, total: number) => string;

  // Statuses
  pending: string;
  inProgress: string;
  pendingVerification: string;
  resolvedCitizenVerified: string;
  resolvedAutoClosed: string;
  reopenedEscalated: string;
  disputedAdminReview: string;
  rejectedInvalid: string;

  // Categories
  roads: string;
  sanitation: string;
  streetlights: string;
  waterSupplyDrainage: string;
  others: string;

  // Verification & Audit
  citizenAuditTitle: string;
  citizenAuditSubtitle: (days: number) => string;
  before: string;
  afterFix: string;
  timelineTitle: string;
  reportedByOn: (name: string, date: string) => string;
  resolvedByOn: (name: string, date: string) => string;

  // Empty states & Prompts
  emptyNearYou: string;
  emptyMyComplaints: string;
  emptyTriage: string;
  emptyDisputes: string;

  // Errors & Instructions
  accuracyMeters: (meters: number) => string;
  tooFarError: (meters: number) => string;
  gpsAccuracyDegraded: (meters: number) => string;
  duplicateNotice: string;
  duplicateFoundTitle: string;

  // Nav
  explore: string;
  report: string;
  myComplaints: string;
  leaderboard: string;
  officer: string;
  admin: string;
  signIn: string;
  signOut: string;

  // Filters & General Labels
  allCategories: string;
  allWards: string;
  filterCategory: string;
  filterWard: string;
  waitingForRouting: string;
  civicTrustIndexExplain: string;
}

const en: Translations = {
  reportProblem: 'Report a problem',
  supportReport: 'Support this report',
  supported: 'Supported',
  markInProgress: 'Mark in progress',
  uploadProofOfFix: 'Upload proof of fix',
  yesFixed: "Yes, it's fixed",
  notFixed: 'Not fixed',
  cancel: 'Cancel',
  back: 'Back',
  next: 'Next',
  submitReport: 'Submit report',
  takeLivePhoto: 'Take a live photo',
  choosePhoto: 'Choose photo',
  changePhoto: 'Change photo',
  differentProblem: 'My problem is different',
  viewDetails: 'View details',
  share: 'Share',
  openCamera: 'Open camera',
  retake: 'Retake photo',
  confirmLocation: 'Confirm location',
  stepOf: (current, total) => `Step ${current} of ${total}`,

  pending: 'Pending',
  inProgress: 'In progress',
  pendingVerification: 'Pending verification',
  resolvedCitizenVerified: 'Resolved - Citizen verified',
  resolvedAutoClosed: 'Resolved - Auto closed',
  reopenedEscalated: 'Reopened - Escalated',
  disputedAdminReview: 'Disputed - Admin review',
  rejectedInvalid: 'Rejected - Invalid',

  roads: 'Roads',
  sanitation: 'Sanitation',
  streetlights: 'Streetlights',
  waterSupplyDrainage: 'Water supply & drainage',
  others: 'Others',

  citizenAuditTitle: 'Citizen audit',
  citizenAuditSubtitle: (days) => `${days} days remaining to confirm or contest this resolution`,
  before: 'Before',
  afterFix: 'After fix',
  timelineTitle: 'Timeline of actions',
  reportedByOn: (name, date) => `Reported by ${name} on ${date}`,
  resolvedByOn: (name, date) => `Fixed by ${name} on ${date}`,

  emptyNearYou: 'Nothing reported near you yet. Report the first problem.',
  emptyMyComplaints: "You haven't reported any problems yet. Report a problem to track it here.",
  emptyTriage: 'No unassigned complaints in the triage queue.',
  emptyDisputes: 'No complaints in the dispute arbitration queue.',

  accuracyMeters: (meters) => `GPS accuracy: ±${meters} m`,
  tooFarError: (meters) => `You're ${meters} m from the site. Move closer to upload proof.`,
  gpsAccuracyDegraded: (meters) => `GPS accuracy is ±${meters} m. Move to an open area with a clear view of the sky.`,
  duplicateNotice: 'Matching reports nearby',
  duplicateFoundTitle: 'A similar problem was already reported nearby',

  explore: 'Explore',
  report: 'Report',
  myComplaints: 'My complaints',
  leaderboard: 'Leaderboard',
  officer: 'Officer',
  admin: 'Admin',
  signIn: 'Sign in',
  signOut: 'Sign out',

  allCategories: 'All categories',
  allWards: 'All wards',
  filterCategory: 'Category',
  filterWard: 'Ward',
  waitingForRouting: 'Waiting for routing',
  civicTrustIndexExplain:
    'The Civic Trust Index measures how reliably and promptly municipal complaints are resolved and verified by citizens.',
};

const kn: Translations = {
  reportProblem: 'ಸಮಸ್ಯೆ ವರದಿ ಮಾಡಿ',
  supportReport: 'ಈ ವರದಿಯನ್ನು ಬೆಂಬಲಿಸಿ',
  supported: 'ಬೆಂಬಲಿಸಲಾಗಿದೆ',
  markInProgress: 'ಪ್ರಗತಿಯಲ್ಲಿದೆ ಎಂದು ಗುರುತಿಸಿ',
  uploadProofOfFix: 'ಪರಿಹಾರದ ಪುರಾವೆ ಅಪ್‌ಲೋಡ್ ಮಾಡಿ',
  yesFixed: 'ಹೌದು, ಪರಿಹರಿಸಲಾಗಿದೆ',
  notFixed: 'ಪರಿಹರಿಸಲಾಗಿಲ್ಲ',
  cancel: 'ರದ್ದುಮಾಡಿ',
  back: 'ಹಿಂದೆ',
  next: 'ಮುಂದೆ',
  submitReport: 'ವರದಿ ಸಲ್ಲಿಸಿ',
  takeLivePhoto: 'ಲೈವ್ ಫೋಟೋ ತೆಗೆಯಿರಿ',
  choosePhoto: 'ಫೋಟೋ ಆಯ್ಕೆಮಾಡಿ',
  changePhoto: 'ಫೋಟೋ ಬದಲಾಯಿಸಿ',
  differentProblem: 'ನನ್ನ ಸಮಸ್ಯೆ ಬೇರೆಯಾಗಿದೆ',
  viewDetails: 'ವಿವರಗಳನ್ನು ನೋಡಿ',
  share: 'ಹಂಚಿಕೊಳ್ಳಿ',
  openCamera: 'ಕ್ಯಾಮೆರಾ ತೆರೆಯಿರಿ',
  retake: 'ಮತ್ತೆ ಫೋಟೋ ತೆಗೆಯಿರಿ',
  confirmLocation: 'ಸ್ಥಳ ದೃಢೀಕರಿಸಿ',
  stepOf: (current, total) => `ಹಂತ ${current} / ${total}`,

  pending: 'ಬಾಕಿ ಇದೆ',
  inProgress: 'ಪ್ರಗತಿಯಲ್ಲಿದೆ',
  pendingVerification: 'ಪರಿಶೀಲನೆ ಬಾಕಿ ಇದೆ',
  resolvedCitizenVerified: 'ಪರಿಹರಿಸಲಾಗಿದೆ - ನಾಗರಿಕ ದೃಢೀಕರಣ',
  resolvedAutoClosed: 'ಪರಿಹರಿಸಲಾಗಿದೆ - ಸ್ವಯಂ ಮುಕ್ತಾಯ',
  reopenedEscalated: 'ಮರುತೆರೆಯಲಾಗಿದೆ - ತೀವ್ರಗೊಳಿಸಲಾಗಿದೆ',
  disputedAdminReview: 'ವಿವಾದ - ಆಡಳಿತ ಪರಿಶೀಲನೆ',
  rejectedInvalid: 'ತಿರಸ್ಕರಿಸಲಾಗಿದೆ - ಅಮಾನ್ಯ',

  roads: 'ರಸ್ತೆಗಳು',
  sanitation: 'ನೈರ್ಮಲ್ಯ',
  streetlights: 'ಬೀದಿ ದೀಪಗಳು',
  waterSupplyDrainage: 'ನೀರು ಸರಬರಾಜು ಮತ್ತು ಒಳಚರಂಡಿ',
  others: 'ಇತರ',

  citizenAuditTitle: 'ನಾಗರಿಕ ಪರಿಶೀಲನೆ',
  citizenAuditSubtitle: (days) => `ಪರಿಹಾರವನ್ನು ಖಚಿತಪಡಿಸಲು ಅಥವಾ ಆಕ್ಷೇಪಿಸಲು ${days} ದಿನಗಳು ಬಾಕಿ ಇವೆ`,
  before: 'ಮೊದಲು',
  afterFix: 'ಪರಿಹಾರದ ನಂತರ',
  timelineTitle: 'ಕ್ರಮಗಳ ಇತಿಹಾಸ',
  reportedByOn: (name, date) => `${date} ರಂದು ${name} ರಿಂದ ವರದಿ ಮಾಡಲಾಗಿದೆ`,
  resolvedByOn: (name, date) => `${date} ರಂದು ${name} ರಿಂದ ಪರಿಹರಿಸಲಾಗಿದೆ`,

  emptyNearYou: 'ನಿಮ್ಮ ಹತ್ತಿರ ಇನ್ನೂ ಯಾವುದೇ ಸಮಸ್ಯೆ ವರದಿಯಾಗಿಲ್ಲ. ಮೊದಲ ಸಮಸ್ಯೆಯನ್ನು ವರದಿ ಮಾಡಿ.',
  emptyMyComplaints: 'ನೀವು ಇನ್ನೂ ಯಾವುದೇ ಸಮಸ್ಯೆಯನ್ನು ವರದಿ ಮಾಡಿಲ್ಲ. ಟ್ರ್ಯಾಕ್ ಮಾಡಲು ಸಮಸ್ಯೆಯನ್ನು ವರದಿ ಮಾಡಿ.',
  emptyTriage: 'ನಿಯೋಜಿಸದ ಯಾವುದೇ ದೂರುಗಳಿಲ್ಲ.',
  emptyDisputes: 'ಯಾವುದೇ ವಿವಾದಿತ ದೂರುಗಳಿಲ್ಲ.',

  accuracyMeters: (meters) => `ಜಿಪಿಎಸ್ ನಿಖರತೆ: ±${meters} ಮೀ`,
  tooFarError: (meters) => `ನೀವು ಸ್ಥಳದಿಂದ ${meters} ಮೀ ದೂರದಲ್ಲಿದ್ದೀರಿ. ಪುರಾವೆ ಅಪ್‌ಲೋಡ್ ಮಾಡಲು ಹತ್ತಿರ ಹೋಗಿ.`,
  gpsAccuracyDegraded: (meters) => `ಜಿಪಿಎಸ್ ನಿಖರತೆ ±${meters} ಮೀ ಇದೆ. ಆಕಾಶ ಸ್ಪಷ್ಟವಾಗಿ ಕಾಣುವ ತೆರೆದ ಜಾಗಕ್ಕೆ ಹೋಗಿ.`,
  duplicateNotice: 'ಹತ್ತಿರದಲ್ಲಿ ದಾಖಲಾದ ವರದಿಗಳು',
  duplicateFoundTitle: 'ಇದೇ ರೀತಿಯ ಸಮಸ್ಯೆ ಈಗಾಗಲೇ ಹತ್ತಿರದಲ್ಲಿ ವರದಿಯಾಗಿದೆ',

  explore: 'ನಕ್ಷೆ ನೋಡಿ',
  report: 'ವರದಿ ಮಾಡಿ',
  myComplaints: 'ನನ್ನ ದೂರುಗಳು',
  leaderboard: 'ಶ್ರೇಯಾಂಕ',
  officer: 'ಅಧಿಕಾರಿ',
  admin: 'ಆಡಳಿತ',
  signIn: 'ಸೈನ್ ಇನ್',
  signOut: 'ಸೈನ್ ಔಟ್',

  allCategories: 'ಎಲ್ಲಾ ವರ್ಗಗಳು',
  allWards: 'ಎಲ್ಲಾ ವಾರ್ಡ್‌ಗಳು',
  filterCategory: 'ವರ್ಗ',
  filterWard: 'ವಾರ್ಡ್',
  waitingForRouting: 'ರೂಟಿಂಗ್ ಬಾಕಿ ಇದೆ',
  civicTrustIndexExplain:
    'ನಾಗರಿಕ ನಂಬಿಕೆ ಸೂಚ್ಯಂಕವು ಪುರಸಭೆಯ ದೂರುಗಳನ್ನು ನಾಗರಿಕರು ಎಷ್ಟು ವಿಶ್ವಾಸಾರ್ಹವಾಗಿ ಮತ್ತು ತ್ವರಿತವಾಗಿ ಪರಿಹರಿಸುತ್ತಾರೆ ಮತ್ತು ದೃಢೀಕರಿಸುತ್ತಾರೆ ಎಂಬುದನ್ನು ಅಳೆಯುತ್ತದೆ.',
};

interface I18nContextValue {
  lang: Language;
  setLang: (lang: Language) => void;
  t: Translations;
}

const I18nContext = createContext<I18nContextValue>({
  lang: 'en',
  setLang: () => {},
  t: en,
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>('en');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('jaago_lang') as Language;
      if (saved === 'en' || saved === 'kn') {
        setLangState(saved);
        document.documentElement.lang = saved;
      }
    } catch {
      // Local storage unavailable
    }
  }, []);

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    try {
      localStorage.setItem('jaago_lang', newLang);
      document.documentElement.lang = newLang;
    } catch {
      // Local storage unavailable
    }
  };

  const t = lang === 'kn' ? kn : en;

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      <div className={lang === 'kn' ? 'kannada-text' : ''}>{children}</div>
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  return useContext(I18nContext);
}
