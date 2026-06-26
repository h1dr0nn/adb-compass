import { create } from "zustand";
import { translations, type Language } from "../translations";

const STORAGE_KEY = "language";

function loadLanguage(): Language {
  const stored = localStorage.getItem(STORAGE_KEY) as Language | null;
  if (stored && translations[stored]) return stored;
  return "en";
}

interface LangState {
  language: Language;
  t: (typeof translations)["en"];
  setLanguage: (lang: Language) => void;
}

export const useLangStore = create<LangState>((set) => {
  const initial = loadLanguage();
  return {
    language: initial,
    t: translations[initial],
    setLanguage: (lang) => {
      localStorage.setItem(STORAGE_KEY, lang);
      set({ language: lang, t: translations[lang] });
    },
  };
});
