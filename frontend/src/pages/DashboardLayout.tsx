import React, { useState } from "react";
import { Routes, Route, Navigate, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import { useTheme } from "../contexts/ThemeContext";

// Pages
import TranslatePage from "./TranslatePage";
import NotesPage from "./NotesPage";
import SavedLibraryPage from "./SavedLibraryPage";
import HistoryPage from "./HistoryPage";
import SettingsPage from "./SettingsPage";

const navItems = [
  { id: "translate", label: "nav.translate", path: "/dashboard" },
  { id: "notes", label: "nav.notes", path: "/dashboard/notes" },
  { id: "saved", label: "nav.saved", path: "/dashboard/saved" },
  { id: "history", label: "nav.history", path: "/dashboard/history" },
  { id: "settings", label: "nav.settings", path: "/dashboard/settings" },
];

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { logout, user } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? "w-64" : "w-20"
        } bg-surface border-r border-primary/10 transition-all duration-300 flex flex-col`}
      >
        {/* Header */}
        <div className="p-6 border-b border-primary/10">
          <div className="flex items-center justify-between">
            {sidebarOpen && (
              <h1 className="text-2xl font-bold text-primary font-serif">
                المكتبة
              </h1>
            )}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-primary/10 rounded-lg transition-colors"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const iconMap: { [key: string]: string } = {
              translate: "🌐",
              notes: "📝",
              saved: "⭐",
              history: "🕐",
              settings: "⚙️",
            };
            return (
              <Link
                key={item.id}
                to={item.path}
                className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-primary/10 transition-colors text-text hover:text-primary"
              >
                <span className="text-xl">{iconMap[item.id]}</span>
                {sidebarOpen && <span>{t(item.label)}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-primary/10 space-y-2">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-primary/10 transition-colors text-sm"
            title={theme === "light" ? "Dark mode" : "Light mode"}
          >
            <span>{theme === "light" ? "🌙" : "☀️"}</span>
            {sidebarOpen && <span>{theme === "light" ? "Dark" : "Light"}</span>}
          </button>

          <button
            onClick={() => setLanguage(language === "en" ? "bn" : "en")}
            className="w-full flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-primary/10 transition-colors text-sm"
          >
            <span>🌐</span>
            {sidebarOpen && (
              <span>{language === "en" ? "বাংলা" : "English"}</span>
            )}
          </button>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors text-sm"
          >
            <span>🚪</span>
            {sidebarOpen && <span>{t("nav.logout")}</span>}
          </button>

          {sidebarOpen && (
            <div className="text-xs text-text/50 pt-2 border-t border-primary/10">
              <p className="font-semibold">{user?.email}</p>
              <p>Al-Maktaba v1.0</p>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <Routes>
          <Route path="/dashboard" element={<TranslatePage />} />
          <Route path="/dashboard/notes" element={<NotesPage />} />
          <Route path="/dashboard/saved" element={<SavedLibraryPage />} />
          <Route path="/dashboard/history" element={<HistoryPage />} />
          <Route path="/dashboard/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </div>
    </div>
  );
}
