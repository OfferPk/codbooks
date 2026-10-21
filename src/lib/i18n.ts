export type Locale = "en" | "ur";

export interface TranslationDictionary {
  appName: string;
  // Nav
  settlementHealth: string;
  aging: string;
  lossReport: string;
  uploads: string;
  matches: string;
  exports: string;
  audit: string;
  team: string;
  logOut: string;
  // Theme & Language
  darkMode: string;
  lightMode: string;
  toggleTheme: string;
  toggleLanguage: string;
  // Common
  loading: string;
  noItems: string;
  total: string;
  days: string;
  expected: string;
  remitted: string;
  disputed: string;
  reason: string;
  status: string;
  courier: string;
  orderId: string;
  tracking: string;
  exportCsv: string;
  draftComplaint: string;
  // Statuses
  matched: string;
  short: string;
  unpaid: string;
  unmatched: string;
  double_paid: string;
}

export const DICTIONARY: Record<Locale, TranslationDictionary> = {
  en: {
    appName: "CodBooks",
    settlementHealth: "Settlement Health",
    aging: "Aging",
    lossReport: "Loss Report",
    uploads: "Uploads",
    matches: "Matches",
    exports: "Exports",
    audit: "Audit",
    team: "Team",
    logOut: "Log out",
    darkMode: "Dark Mode",
    lightMode: "Light Mode",
    toggleTheme: "Toggle theme",
    toggleLanguage: "اردو میں دیکھیں",
    loading: "Loading…",
    noItems: "No items found",
    total: "Total",
    days: "days",
    expected: "Expected",
    remitted: "Remitted",
    disputed: "Disputed Claim",
    reason: "Reason",
    status: "Status",
    courier: "Courier",
    orderId: "Order ID",
    tracking: "Tracking / AWB",
    exportCsv: "Export CSV",
    draftComplaint: "Draft Complaint",
    matched: "Matched",
    short: "Short",
    unpaid: "Unpaid",
    unmatched: "Unmatched",
    double_paid: "Double Paid",
  },
  ur: {
    appName: "کوڈ بکس",
    settlementHealth: "سیٹلمنٹ صورتحال",
    aging: "بقایا جات کی مدت",
    lossReport: "نقصان اور تنازعات",
    uploads: "فائل اپ لوڈ",
    matches: "میچنگ ریکارڈ",
    exports: "ڈیٹا برآمد",
    audit: "آڈٹ لاگ",
    team: "ٹیم",
    logOut: "لاگ آؤٹ",
    darkMode: "ڈارک موڈ",
    lightMode: "لائٹ موڈ",
    toggleTheme: "تھیم تبدیل کریں",
    toggleLanguage: "Switch to English",
    loading: "لوڈ ہو رہا ہے…",
    noItems: "کوئی ریکارڈ نہیں ملا",
    total: "کل رقم",
    days: "دن",
    expected: "مطلوبہ رقم",
    remitted: "موصولہ رقم",
    disputed: "متنازع دعویٰ",
    reason: "وجہ",
    status: "حیثیت",
    courier: "کورئیر",
    orderId: "آرڈر نمبر",
    tracking: "ٹریکنگ نمبر",
    exportCsv: "سی ایس وی ڈاؤن لوڈ",
    draftComplaint: "شکایت تیار کریں",
    matched: "مکمل ادا شدہ",
    short: "کم ادا شدہ",
    unpaid: "غیر ادا شدہ",
    unmatched: "غیر مماثل",
    double_paid: "دوبارہ ادائیگی",
  },
};

export function t(key: keyof TranslationDictionary, locale: Locale = "en"): string {
  const dict = DICTIONARY[locale] || DICTIONARY.en;
  return dict[key] || DICTIONARY.en[key] || key;
}
