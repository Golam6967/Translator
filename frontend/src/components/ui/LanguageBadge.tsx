import { LanguageMeta } from "../../lib/languages";

export default function LanguageBadge({
  lang,
  size = "md",
}: {
  lang?: LanguageMeta;
  size?: "sm" | "md" | "lg";
}) {
  if (!lang) return null;
  const sizeClasses = {
    sm: "w-6 h-6 text-[10px]",
    md: "w-9 h-9 text-xs",
    lg: "w-12 h-12 text-sm",
  }[size];

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full bg-gradient-to-br ${lang.gradient} text-white font-bold shrink-0 shadow-soft ${sizeClasses}`}
    >
      {lang.badge}
    </span>
  );
}
