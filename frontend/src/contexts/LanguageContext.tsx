import React, { createContext, useContext, useState, useEffect } from "react";

type Language = "en" | "bn";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const translations = {
  en: {
    "nav.home": "Home",
    "nav.translate": "Translate",
    "nav.sentence": "Sentence",
    "nav.notes": "Notes",
    "nav.saved": "Saved",
    "nav.documents": "Documents",
    "nav.references": "References",
    "nav.history": "History",
    "nav.settings": "Settings",
    "nav.logout": "Logout",
    
    "common.loading": "Loading...",
    "common.error": "Error",
    "common.success": "Success",
    "common.save": "Save",
    "common.delete": "Delete",
    "common.cancel": "Cancel",
    "common.close": "Close",
    "common.search": "Search",
    
    "auth.login": "Login",
    "auth.register": "Register",
    "auth.email": "Email",
    "auth.password": "Password",
    "auth.displayName": "Display Name",
    "auth.resetPassword": "Reset Password",
    "auth.noAccount": "Don't have an account?",
    "auth.haveAccount": "Already have an account?",
    
    "translate.title": "Text Translation",
    "translate.sourceLang": "Source Language",
    "translate.targetLangs": "Target Languages",
    "translate.enterText": "Enter text to translate...",
    "translate.translate": "Translate",
    "translate.save": "Save Translation",
    "translate.copy": "Copy",
    "translate.speak": "Speak",
    
    "notes.title": "My Notes",
    "notes.new": "New Note",
    "notes.title_label": "Note Title",
    "notes.content": "Note Content",
    "notes.tags": "Tags (comma-separated)",
    "notes.language": "Language",
    "notes.save": "Save Note",
    "notes.delete": "Delete Note",
    
    "saved.title": "Saved Translations",
    "saved.empty": "No saved translations yet",
    "saved.export": "Export as PDF",
    "saved.filters": "Filters",
    
    "history.title": "Activity History",
    "history.empty": "No history yet",
    "history.clear": "Clear History",
    "history.clearConfirm": "Are you sure you want to clear all history?",
    
    "settings.title": "Settings",
    "settings.language": "Language",
    "settings.theme": "Theme",
    "settings.light": "Light",
    "settings.dark": "Dark",
    "settings.fontSize": "Font Size",
    "settings.defaultLang": "Default Source Language",
  },
  bn: {
    "nav.home": "হোম",
    "nav.translate": "অনুবাদ",
    "nav.sentence": "বাক্য",
    "nav.notes": "নোট",
    "nav.saved": "সংরক্ষিত",
    "nav.documents": "নথি",
    "nav.references": "রেফারেন্স",
    "nav.history": "ইতিহাস",
    "nav.settings": "সেটিংস",
    "nav.logout": "লগ আউট",
    
    "common.loading": "লোড হচ্ছে...",
    "common.error": "ত্রুটি",
    "common.success": "সফল",
    "common.save": "সংরক্ষণ করুন",
    "common.delete": "মুছুন",
    "common.cancel": "বাতিল করুন",
    "common.close": "বন্ধ করুন",
    "common.search": "অনুসন্ধান করুন",
    
    "auth.login": "লগইন করুন",
    "auth.register": "রেজিস্টার করুন",
    "auth.email": "ইমেল",
    "auth.password": "পাসওয়ার্ড",
    "auth.displayName": "প্রদর্শনের নাম",
    "auth.resetPassword": "পাসওয়ার্ড রিসেট করুন",
    "auth.noAccount": "কোন অ্যাকাউন্ট নেই?",
    "auth.haveAccount": "ইতিমধ্যে অ্যাকাউন্ট আছে?",
    
    "translate.title": "পাঠ্য অনুবাদ",
    "translate.sourceLang": "উৎস ভাষা",
    "translate.targetLangs": "লক্ষ্য ভাষা",
    "translate.enterText": "অনুবাদ করার জন্য পাঠ্য লিখুন...",
    "translate.translate": "অনুবাদ করুন",
    "translate.save": "অনুবাদ সংরক্ষণ করুন",
    "translate.copy": "অনুলিপি করুন",
    "translate.speak": "কথা বলুন",
    
    "notes.title": "আমার নোট",
    "notes.new": "নতুন নোট",
    "notes.title_label": "নোট শিরোনাম",
    "notes.content": "নোট বিষয়বস্তু",
    "notes.tags": "ট্যাগ (কমা দ্বারা পৃথক)",
    "notes.language": "ভাষা",
    "notes.save": "নোট সংরক্ষণ করুন",
    "notes.delete": "নোট মুছুন",
    
    "saved.title": "সংরক্ষিত অনুবাদ",
    "saved.empty": "এখনও কোনো সংরক্ষিত অনুবাদ নেই",
    "saved.export": "PDF হিসাবে রপ্তানি করুন",
    "saved.filters": "ফিল্টার",
    
    "history.title": "কার্যকলাপ ইতিহাস",
    "history.empty": "এখনও কোন ইতিহাস নেই",
    "history.clear": "ইতিহাস পরিষ্কার করুন",
    "history.clearConfirm": "আপনি কি সমস্ত ইতিহাস সাফ করতে নিশ্চিত?",
    
    "settings.title": "সেটিংস",
    "settings.language": "ভাষা",
    "settings.theme": "থিম",
    "settings.light": "হালকা",
    "settings.dark": "অন্ধকার",
    "settings.fontSize": "ফন্ট আকার",
    "settings.defaultLang": "ডিফল্ট উৎস ভাষা",
  },
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem("language") as Language;
    return saved || "en";
  });

  useEffect(() => {
    localStorage.setItem("language", language);
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const t = (key: string): string => {
    return translations[language][key as keyof typeof translations.en] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
