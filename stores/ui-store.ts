"use client";

import { create } from "zustand";

export type ActiveView = "sidebar" | "list" | "viewer";

// Column width constraints (in pixels)
const SIDEBAR_MIN = 180;
const SIDEBAR_MAX = 400;
const SIDEBAR_DEFAULT = 256;
const EMAIL_LIST_MIN = 240;
const EMAIL_LIST_MAX = 600;
const EMAIL_LIST_DEFAULT = 384;

interface UIState {
  // Mobile view state
  activeView: ActiveView;
  sidebarOpen: boolean;

  // Tablet list visibility (auto-hide when email selected)
  tabletListVisible: boolean;

  // Device detection (hydrated client-side)
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;

  // Resizable column widths (desktop only)
  sidebarWidth: number;
  emailListWidth: number;

  // Sidebar collapsed state (desktop)
  sidebarCollapsed: boolean;

  // Actions
  setActiveView: (view: ActiveView) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setTabletListVisible: (visible: boolean) => void;
  setDeviceType: (isMobile: boolean, isTablet: boolean, isDesktop: boolean) => void;
  setSidebarWidth: (width: number) => void;
  setEmailListWidth: (width: number) => void;
  resetSidebarWidth: () => void;
  resetEmailListWidth: () => void;
  persistColumnWidths: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebarCollapsed: () => void;

  // Navigation helpers
  showEmailList: () => void;
  showEmailViewer: () => void;
  goBack: () => void;
}

// Column widths are hydrated from localStorage by the page component on mount

export const useUIStore = create<UIState>((set, get) => ({
  // Initial state (SSR-safe defaults)
  activeView: "list",
  sidebarOpen: false,
  tabletListVisible: true,
  isMobile: false,
  isTablet: false,
  isDesktop: true,
  sidebarWidth: SIDEBAR_DEFAULT,
  emailListWidth: EMAIL_LIST_DEFAULT,
  sidebarCollapsed: false,

  // Actions
  setActiveView: (view) => set({ activeView: view }),

  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  setTabletListVisible: (visible) => set({ tabletListVisible: visible }),

  setDeviceType: (isMobile, isTablet, isDesktop) =>
    set({ isMobile, isTablet, isDesktop }),

  setSidebarWidth: (width) =>
    set({ sidebarWidth: Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, width)) }),

  setEmailListWidth: (width) =>
    set({ emailListWidth: Math.min(EMAIL_LIST_MAX, Math.max(EMAIL_LIST_MIN, width)) }),

  resetSidebarWidth: () => {
    set({ sidebarWidth: SIDEBAR_DEFAULT });
    const { emailListWidth } = get();
    try {
      localStorage.setItem("column-widths", JSON.stringify({ sidebarWidth: SIDEBAR_DEFAULT, emailListWidth }));
    } catch { /* localStorage may be unavailable */ }
  },

  resetEmailListWidth: () => {
    set({ emailListWidth: EMAIL_LIST_DEFAULT });
    const { sidebarWidth } = get();
    try {
      localStorage.setItem("column-widths", JSON.stringify({ sidebarWidth, emailListWidth: EMAIL_LIST_DEFAULT }));
    } catch { /* localStorage may be unavailable */ }
  },

  persistColumnWidths: () => {
    const { sidebarWidth, emailListWidth } = get();
    try {
      localStorage.setItem("column-widths", JSON.stringify({ sidebarWidth, emailListWidth }));
    } catch { /* localStorage may be unavailable */ }
  },

  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  toggleSidebarCollapsed: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  // Navigation helpers for mobile
  showEmailList: () => {
    const { isMobile } = get();
    if (isMobile) {
      set({ activeView: "list", sidebarOpen: false });
    }
  },

  showEmailViewer: () => {
    const { isMobile } = get();
    if (isMobile) {
      set({ activeView: "viewer" });
    }
  },

  goBack: () => {
    const { activeView, isMobile } = get();
    if (!isMobile) return;

    if (activeView === "viewer") {
      set({ activeView: "list" });
    } else if (activeView === "list") {
      set({ sidebarOpen: true });
    }
  },
}));
