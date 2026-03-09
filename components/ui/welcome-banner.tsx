"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { X, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";

const ONBOARDING_KEY = "onboarding_completed";

export function WelcomeBanner() {
  const t = useTranslations("welcome");
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(ONBOARDING_KEY)) {
        setVisible(true);
      }
    } catch { /* localStorage unavailable */ }
  }, []);

  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      localStorage.setItem(ONBOARDING_KEY, "true");
    } catch { /* localStorage unavailable */ }
  }, []);

  useEffect(() => {
    if (!visible) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [visible, dismiss]);

  if (!visible) return null;

  return (
    <div
      role="complementary"
      aria-label={t("title")}
      className={`mx-4 mt-3 mb-1 rounded-lg border border-border bg-background shadow-sm transition-all duration-300 ease-out ${
        dismissed ? "opacity-0 scale-95 pointer-events-none" : "opacity-100 scale-100"
      }`}
      onTransitionEnd={() => {
        if (dismissed) setVisible(false);
      }}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5 p-1.5 rounded-md bg-primary/10">
              <Lightbulb className="w-4 h-4 text-primary" />
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-foreground">
                {t("title")}
              </h3>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li>{t("tip_compose")}</li>
                <li>{t("tip_shortcuts")}</li>
                <li>{t("tip_sidebar")}</li>
                <li>{t("tip_settings")}</li>
              </ul>
            </div>
          </div>
          <button
            onClick={dismiss}
            className="flex-shrink-0 p-1.5 rounded-md hover:bg-muted transition-colors duration-150 text-muted-foreground hover:text-foreground"
            aria-label={t("dismiss")}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="mt-3 flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={dismiss}
            className="text-xs"
          >
            {t("got_it")}
          </Button>
        </div>
      </div>
    </div>
  );
}
