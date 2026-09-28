import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";

export interface DropdownOption {
  value: string;
  label: string;
  description?: string;
  leading?: React.ReactNode;
}

function useDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return { open, setOpen, ref };
}

function Trigger({
  label,
  open,
  onClick,
  children,
}: {
  label: string;
  open: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <span className="block text-[11px] font-semibold uppercase tracking-wide text-text/50 mb-1.5">
        {label}
      </span>
      <button
        type="button"
        onClick={onClick}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border bg-surface text-left transition-colors focus-ring ${
          open ? "border-accent" : "border-primary/15 hover:border-accent"
        }`}
      >
        <span className="flex-1 min-w-0 flex items-center gap-3">{children}</span>
        <ChevronDown
          className={`w-4 h-4 text-text/50 shrink-0 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
    </div>
  );
}

function Menu({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.98 }}
      transition={{ duration: 0.12 }}
      className="absolute left-0 right-0 top-full mt-2 z-30 bg-surface rounded-xl shadow-lift border border-primary/10 p-1.5 max-h-80 overflow-y-auto"
    >
      {children}
    </motion.div>
  );
}

function OptionRow({
  option,
  active,
  multiple,
  disabled,
  onClick,
}: {
  option: DropdownOption;
  active: boolean;
  multiple: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      disabled={disabled}
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-left transition-colors focus-ring disabled:opacity-40 disabled:cursor-not-allowed ${
        active ? "bg-primary/10" : "hover:bg-primary/5"
      }`}
    >
      {option.leading}
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium truncate">{option.label}</span>
        {option.description && (
          <span className="block text-xs text-text/45 truncate">{option.description}</span>
        )}
      </span>
      {multiple ? (
        <span
          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
            active ? "bg-accent border-accent" : "border-primary/25"
          }`}
        >
          {active && <Check className="w-3 h-3 text-white" />}
        </span>
      ) : (
        active && <Check className="w-4 h-4 text-accent shrink-0" />
      )}
    </button>
  );
}

export function Dropdown({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  const { open, setOpen, ref } = useDropdown();
  const selected = options.find((o) => o.value === value);

  return (
    <div className="relative" ref={ref}>
      <Trigger label={label} open={open} onClick={() => setOpen((o) => !o)}>
        {selected?.leading}
        <span className="min-w-0">
          <span className="block text-sm font-semibold truncate">{selected?.label}</span>
          {selected?.description && (
            <span className="block text-xs text-text/45 truncate">{selected.description}</span>
          )}
        </span>
      </Trigger>
      <AnimatePresence>
        {open && (
          <Menu>
            <div role="listbox">
              {options.map((o) => (
                <OptionRow
                  key={o.value}
                  option={o}
                  multiple={false}
                  active={o.value === value}
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                />
              ))}
            </div>
          </Menu>
        )}
      </AnimatePresence>
    </div>
  );
}

export function MultiDropdown({
  label,
  options,
  values,
  onChange,
  placeholder = "Select…",
  lockedValues = [],
}: {
  label: string;
  options: DropdownOption[];
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  lockedValues?: string[];
}) {
  const { open, setOpen, ref } = useDropdown();
  const selected = options.filter((o) => values.includes(o.value));
  const toggleable = options.filter((o) => !lockedValues.includes(o.value));
  const allSelected = toggleable.every((o) => values.includes(o.value));

  const toggle = (v: string) =>
    onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);

  const toggleAll = () =>
    onChange(
      allSelected
        ? values.filter((v) => lockedValues.includes(v))
        : [...new Set([...values, ...toggleable.map((o) => o.value)])],
    );

  return (
    <div className="relative" ref={ref}>
      <Trigger label={label} open={open} onClick={() => setOpen((o) => !o)}>
        {selected.length === 0 ? (
          <span className="text-sm text-text/40">{placeholder}</span>
        ) : (
          <>
            <span className="flex -space-x-1.5 shrink-0">
              {selected.slice(0, 3).map((o) => (
                <span key={o.value} className="ring-2 ring-surface rounded-full inline-flex">
                  {o.leading}
                </span>
              ))}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold truncate">
                {selected.length <= 2
                  ? selected.map((o) => o.label).join(", ")
                  : `${selected.length} selected`}
              </span>
              {selected.length > 2 && (
                <span className="block text-xs text-text/45 truncate">
                  {selected.map((o) => o.label).join(", ")}
                </span>
              )}
            </span>
          </>
        )}
      </Trigger>
      <AnimatePresence>
        {open && (
          <Menu>
            <div className="flex items-center justify-between px-2.5 py-1.5 mb-1 border-b border-primary/10">
              <span className="text-xs text-text/50">{selected.length} selected</span>
              <button
                type="button"
                onClick={toggleAll}
                className="text-xs font-semibold text-accent hover:text-primary transition-colors focus-ring rounded"
              >
                {allSelected ? "Clear all" : "Select all"}
              </button>
            </div>
            <div role="listbox" aria-multiselectable="true">
              {options.map((o) => (
                <OptionRow
                  key={o.value}
                  option={o}
                  multiple
                  active={values.includes(o.value)}
                  disabled={lockedValues.includes(o.value)}
                  onClick={() => toggle(o.value)}
                />
              ))}
            </div>
          </Menu>
        )}
      </AnimatePresence>
    </div>
  );
}
