"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useUIStore } from "@/stores/ui-store";

// Tailwind v4 breakpoints
const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
} as const;

const getMediaQueryServerSnapshot = () => false;

/**
 * SSR-safe media query hook. On SSR and the first hydration pass we report
 * `false`; on all subsequent client renders (including client-side navigation
 * remounts) we read `matchMedia` synchronously, so components don't flash
 * through a one-frame "mobile" layout on desktop.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (callback: () => void) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", callback);
      return () => mq.removeEventListener("change", callback);
    },
    [query],
  );

  const getSnapshot = useCallback(
    () => window.matchMedia(query).matches,
    [query],
  );

  return useSyncExternalStore(subscribe, getSnapshot, getMediaQueryServerSnapshot);
}

/**
 * Hook to detect device type and sync with UI store
 * Uses Tailwind breakpoints: mobile < 768px, tablet 768-1024px, desktop > 1024px
 */
export function useDeviceDetection() {
  const { setDeviceType, isMobile, isTablet, isDesktop } = useUIStore();

  const isMobileQuery = useMediaQuery(`(max-width: ${BREAKPOINTS.md - 1}px)`);
  const isTabletQuery = useMediaQuery(
    `(min-width: ${BREAKPOINTS.md}px) and (max-width: ${BREAKPOINTS.lg - 1}px)`
  );
  const isDesktopQuery = useMediaQuery(`(min-width: ${BREAKPOINTS.lg}px)`);

  useEffect(() => {
    setDeviceType(isMobileQuery, isTabletQuery, isDesktopQuery);
  }, [isMobileQuery, isTabletQuery, isDesktopQuery, setDeviceType]);

  return { isMobile, isTablet, isDesktop };
}

/**
 * Convenience hooks for specific breakpoints
 */
export function useIsMobile() {
  return useMediaQuery(`(max-width: ${BREAKPOINTS.md - 1}px)`);
}

export function useIsTablet() {
  return useMediaQuery(
    `(min-width: ${BREAKPOINTS.md}px) and (max-width: ${BREAKPOINTS.lg - 1}px)`
  );
}

export function useIsDesktop() {
  return useMediaQuery(`(min-width: ${BREAKPOINTS.lg}px)`);
}

export function useBreakpoint(breakpoint: keyof typeof BREAKPOINTS) {
  return useMediaQuery(`(min-width: ${BREAKPOINTS[breakpoint]}px)`);
}
