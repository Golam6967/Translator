import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import TopNav from "../components/TopNav";

// Pages
import TranslatePage from "./TranslatePage";
import SentencePage from "./SentencePage";
import NotesPage from "./NotesPage";
import SavedLibraryPage from "./SavedLibraryPage";
import HistoryPage from "./HistoryPage";
import SettingsPage from "./SettingsPage";

function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route
          path="/dashboard"
          element={<PageTransition><TranslatePage /></PageTransition>}
        />
        <Route
          path="/dashboard/sentence"
          element={<PageTransition><SentencePage /></PageTransition>}
        />
        <Route
          path="/dashboard/notes"
          element={<PageTransition><NotesPage /></PageTransition>}
        />
        <Route
          path="/dashboard/saved"
          element={<PageTransition><SavedLibraryPage /></PageTransition>}
        />
        <Route
          path="/dashboard/history"
          element={<PageTransition><HistoryPage /></PageTransition>}
        />
        <Route
          path="/dashboard/settings"
          element={<PageTransition><SettingsPage /></PageTransition>}
        />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

export default function DashboardLayout() {
  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main>
        <AnimatedRoutes />
      </main>
    </div>
  );
}
