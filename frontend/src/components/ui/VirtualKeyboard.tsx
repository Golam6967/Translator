import { RefObject } from "react";
import { Delete, X } from "lucide-react";

const KEYBOARD_LAYOUTS: Record<string, string[]> = {
  en: "abcdefghijklmnopqrstuvwxyz".split(""),
  ar: "ا ب ت ث ج ح خ د ذ ر ز س ش ص ض ط ظ ع غ ف ق ك ل م ن ه و ي ء ة ى إ أ آ ؤ ئ"
    .split(" "),
  fa: "ا ب پ ت ث ج چ ح خ د ذ ر ز ژ س ش ص ض ط ظ ع غ ف ق ک گ ل م ن و ه ی ء"
    .split(" "),
  ur: "ا آ ب پ ت ٹ ث ج چ ح خ د ڈ ذ ر ڑ ز ژ س ش ص ض ط ظ ع غ ف ق ک گ ل م ن ں و ہ ھ ء ی ے"
    .split(" "),
  tr: "a b c ç d e f g ğ h ı i j k l m n o ö p r s ş t u ü v y z".split(" "),
};

const RTL_LANGS = new Set(["ar", "fa", "ur"]);

interface VirtualKeyboardProps {
  langCode: string;
  value: string;
  onChange: (value: string) => void;
  inputRef: RefObject<HTMLInputElement>;
}

export default function VirtualKeyboard({
  langCode,
  value,
  onChange,
  inputRef,
}: VirtualKeyboardProps) {
  const letters = KEYBOARD_LAYOUTS[langCode] ?? KEYBOARD_LAYOUTS.en;
  const rtl = RTL_LANGS.has(langCode);

  const focusAndSelect = (pos: number) => {
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };

  const insertChar = (char: string) => {
    const el = inputRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    onChange(value.slice(0, start) + char + value.slice(end));
    focusAndSelect(start + char.length);
  };

  const handleBackspace = () => {
    const el = inputRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;

    if (start === end) {
      if (start === 0) return;
      onChange(value.slice(0, start - 1) + value.slice(end));
      focusAndSelect(start - 1);
    } else {
      onChange(value.slice(0, start) + value.slice(end));
      focusAndSelect(start);
    }
  };

  const handleClear = () => {
    onChange("");
    focusAndSelect(0);
  };

  return (
    <div className="mt-3 mb-4 p-3 rounded-xl border border-primary/10 bg-primary/[0.03]">
      <div
        dir={rtl ? "rtl" : "ltr"}
        className="grid grid-cols-6 sm:grid-cols-8 gap-2"
      >
        {letters.map((letter, i) => (
          <button
            key={`${letter}-${i}`}
            type="button"
            onClick={() => insertChar(letter)}
            className="h-12 rounded-lg text-xl font-medium bg-surface border border-primary/10 hover:border-accent hover:bg-primary/5 transition-colors focus-ring active:scale-[0.95]"
          >
            {letter}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-2">
        <button
          type="button"
          onClick={handleBackspace}
          className="flex-1 h-12 rounded-lg text-base font-medium bg-surface border border-primary/10 hover:border-accent hover:bg-primary/5 transition-colors focus-ring active:scale-[0.97] flex items-center justify-center gap-2"
        >
          <Delete className="w-5 h-5" />
          Backspace
        </button>
        <button
          type="button"
          onClick={handleClear}
          className="h-12 px-4 rounded-lg text-base font-medium bg-surface border border-primary/10 hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors focus-ring active:scale-[0.97] flex items-center justify-center gap-2"
        >
          <X className="w-5 h-5" />
          Clear
        </button>
      </div>
    </div>
  );
}
