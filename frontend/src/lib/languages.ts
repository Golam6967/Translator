export interface LanguageMeta {
  code: string;
  name: string;
  native: string;
  badge: string;
  gradient: string;
}

export const languages: LanguageMeta[] = [
  { code: "ar", name: "Arabic", native: "العربية", badge: "AR", gradient: "from-amber-500 to-orange-600" },
  { code: "fa", name: "Persian", native: "فارسی", badge: "FA", gradient: "from-rose-500 to-pink-600" },
  { code: "ur", name: "Urdu", native: "اردو", badge: "UR", gradient: "from-green-600 to-emerald-700" },
  { code: "en", name: "English", native: "English", badge: "EN", gradient: "from-blue-500 to-indigo-600" },
  { code: "tr", name: "Turkish", native: "Türkçe", badge: "TR", gradient: "from-red-500 to-rose-600" },
];

export const getLanguage = (code: string) =>
  languages.find((l) => l.code === code);
