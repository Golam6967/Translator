import React, { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Languages,
  FileText,
  History,
  Settings,
  Moon,
  Sun,
  LogOut,
  Globe,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import { useTheme } from "../contexts/ThemeContext";

const navItems = [
  { id: "translate", label: "nav.translate", path: "/dashboard", icon: Languages, end: true },
  { id: "sentence", label: "nav.sentence", path: "/dashboard/sentence", icon: FileText },
  { id: "history", label: "nav.history", path: "/dashboard/history", icon: History },
  { id: "settings", label: "nav.settings", path: "/dashboard/settings", icon: Settings },
];

export default function TopNav() {
  const { logout, user } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const initial = (user?.displayName || user?.email || "?")[0]?.toUpperCase();

  return (
    <header className="sticky top-0 z-40 border-b border-primary/10 bg-surface/80 backdrop-blur-md">
      <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center gap-6">
        <h1 className="text-xl font-bold text-primary font-serif shrink-0 tracking-wide">
          المكتبة
        </h1>

        <nav className="flex-1 flex items-center gap-1 overflow-x-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.id}
                to={item.path}
                end={item.end}
                className={({ isActive }) =>
                  `relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors duration-200 ${
                    isActive
                      ? "text-primary"
                      : "text-text/60 hover:text-text hover:bg-primary/5"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className="w-4 h-4" />
                    <span>{t(item.label)}</span>
                    {isActive && (
                      <motion.div
                        layoutId="topnav-active"
                        className="absolute inset-0 -z-10 bg-primary/10 rounded-lg"
                        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                      />
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-primary/10 transition-colors focus-ring text-text/70 hover:text-primary"
            title={theme === "light" ? "Dark mode" : "Light mode"}
          >
            {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setLanguage(language === "en" ? "bn" : "en")}
            className="p-2 rounded-lg hover:bg-primary/10 transition-colors focus-ring text-text/70 hover:text-primary"
            title="Switch language"
          >
            <Globe className="w-4 h-4" />
          </button>

          <div className="relative ml-1" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full hover:bg-primary/10 transition-colors focus-ring"
            >
              <span className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent text-white flex items-center justify-center text-sm font-bold shrink-0">
                {initial}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-text/50 transition-transform duration-200 ${
                  menuOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute right-0 mt-2 w-56 bg-surface rounded-xl shadow-lift border border-primary/10 p-2 origin-top-right"
                >
                  <div className="px-3 py-2 border-b border-primary/10 mb-1">
                    <p className="text-sm font-semibold text-text truncate">
                      {user?.displayName || "User"}
                    </p>
                    <p className="text-xs text-text/50 truncate">{user?.email}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors focus-ring"
                  >
                    <LogOut className="w-4 h-4" />
                    {t("nav.logout")}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
}
