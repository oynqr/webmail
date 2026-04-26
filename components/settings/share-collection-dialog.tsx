"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { X, Loader2, UserPlus, Trash2, Users, ChevronDown } from "lucide-react";
import type { IJMAPClient } from "@/lib/jmap/client-interface";
import type { Principal, CalendarRights, AddressBookRights } from "@/lib/jmap/types";
import { toast } from "@/stores/toast-store";

type ShareKind = "calendar" | "addressBook";
type AnyRights = CalendarRights | AddressBookRights;

type RolePreset = "freeBusy" | "read" | "readWrite" | "manager" | "custom";

const CALENDAR_PRESETS: Record<Exclude<RolePreset, "custom">, CalendarRights> = {
  freeBusy: {
    mayReadFreeBusy: true, mayReadItems: false, mayWriteAll: false, mayWriteOwn: false,
    mayUpdatePrivate: false, mayRSVP: false, mayShare: false, mayDelete: false,
  },
  read: {
    mayReadFreeBusy: true, mayReadItems: true, mayWriteAll: false, mayWriteOwn: false,
    mayUpdatePrivate: false, mayRSVP: false, mayShare: false, mayDelete: false,
  },
  readWrite: {
    mayReadFreeBusy: true, mayReadItems: true, mayWriteAll: true, mayWriteOwn: true,
    mayUpdatePrivate: true, mayRSVP: true, mayShare: false, mayDelete: false,
  },
  manager: {
    mayReadFreeBusy: true, mayReadItems: true, mayWriteAll: true, mayWriteOwn: true,
    mayUpdatePrivate: true, mayRSVP: true, mayShare: true, mayDelete: true,
  },
};

const ADDRESS_BOOK_PRESETS: Record<Exclude<RolePreset, "custom" | "freeBusy">, AddressBookRights> = {
  read: { mayRead: true, mayWrite: false, mayShare: false, mayDelete: false },
  readWrite: { mayRead: true, mayWrite: true, mayShare: false, mayDelete: false },
  manager: { mayRead: true, mayWrite: true, mayShare: true, mayDelete: true },
};

function detectCalendarPreset(r: CalendarRights): RolePreset {
  for (const [name, preset] of Object.entries(CALENDAR_PRESETS) as [Exclude<RolePreset, "custom">, CalendarRights][]) {
    if ((Object.keys(preset) as (keyof CalendarRights)[]).every((k) => preset[k] === r[k])) {
      return name;
    }
  }
  return "custom";
}

function detectAddressBookPreset(r: AddressBookRights): RolePreset {
  for (const [name, preset] of Object.entries(ADDRESS_BOOK_PRESETS) as [Exclude<RolePreset, "custom" | "freeBusy">, AddressBookRights][]) {
    const keys = Object.keys(preset) as (keyof AddressBookRights)[];
    if (keys.every((k) => preset[k] === (r[k] ?? false))) {
      return name;
    }
  }
  return "custom";
}

interface ShareCollectionDialogProps {
  client: IJMAPClient;
  kind: ShareKind;
  collectionName: string;
  shareWith: Record<string, AnyRights> | null | undefined;
  ownAccountId: string;
  onShare: (principalId: string, rights: AnyRights | null) => Promise<void>;
  onClose: () => void;
}

export function ShareCollectionDialog({
  client,
  kind,
  collectionName,
  shareWith,
  ownAccountId,
  onShare,
  onClose,
}: ShareCollectionDialogProps) {
  const t = useTranslations("sharing");
  const tCommon = useTranslations("common");
  const modalRef = useRef<HTMLDivElement>(null);
  const [principals, setPrincipals] = useState<Principal[]>([]);
  const [loadingPrincipals, setLoadingPrincipals] = useState(true);
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  // Load principals on mount
  useEffect(() => {
    let cancelled = false;
    setLoadingPrincipals(true);
    client.getPrincipals().then((list) => {
      if (cancelled) return;
      // Exclude the user themselves and any principal that already has a share
      const existing = new Set(Object.keys(shareWith || {}));
      const filtered = list.filter((p) => p.id !== ownAccountId && !existing.has(p.id));
      setPrincipals(filtered);
      setLoadingPrincipals(false);
    }).catch(() => {
      if (!cancelled) setLoadingPrincipals(false);
    });
    return () => { cancelled = true; };
  }, [client, ownAccountId, shareWith]);

  // Map principal id -> Principal for displayed shares
  const allPrincipalsById = useMemo(() => {
    const map = new Map<string, Principal>();
    for (const p of principals) map.set(p.id, p);
    return map;
  }, [principals]);

  // Close on Escape, focus trap, click outside
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleSetRights = async (principalId: string, preset: RolePreset) => {
    if (preset === "custom") return; // custom is read-only here
    const rights = kind === "calendar"
      ? CALENDAR_PRESETS[preset as keyof typeof CALENDAR_PRESETS]
      : ADDRESS_BOOK_PRESETS[preset as keyof typeof ADDRESS_BOOK_PRESETS];
    if (!rights) return;
    setSavingId(principalId);
    try {
      await onShare(principalId, rights);
      toast.success(t("share_updated"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("share_failed"));
    } finally {
      setSavingId(null);
    }
  };

  const handleRemove = async (principalId: string) => {
    setSavingId(principalId);
    try {
      await onShare(principalId, null);
      toast.success(t("share_removed"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("share_failed"));
    } finally {
      setSavingId(null);
    }
  };

  const handleAdd = async (principal: Principal) => {
    const defaultPreset: RolePreset = "read";
    const rights = kind === "calendar"
      ? CALENDAR_PRESETS[defaultPreset]
      : ADDRESS_BOOK_PRESETS[defaultPreset];
    setSavingId(principal.id);
    try {
      await onShare(principal.id, rights);
      // Move principal out of the "to add" list
      setPrincipals((prev) => prev.filter((p) => p.id !== principal.id));
      setShowAdd(false);
      setSearch("");
      toast.success(t("share_added"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("share_failed"));
    } finally {
      setSavingId(null);
    }
  };

  const filteredPrincipals = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return principals;
    return principals.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q) ||
      p.description?.toLowerCase().includes(q)
    );
  }, [principals, search]);

  const sharedEntries = useMemo(() => {
    return Object.entries(shareWith || {}) as [string, AnyRights][];
  }, [shareWith]);

  const presetOptions = kind === "calendar"
    ? ["freeBusy", "read", "readWrite", "manager"] as const
    : ["read", "readWrite", "manager"] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[1px]" onClick={onClose} aria-hidden="true" />
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("title", { name: collectionName })}
        className="relative bg-background border border-border rounded-lg shadow-xl w-full max-w-lg mx-4 animate-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">{t("title", { name: collectionName })}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-muted transition-colors duration-150 text-muted-foreground hover:text-foreground"
            aria-label={tCommon("close")}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4 overflow-y-auto">
          <p className="text-sm text-muted-foreground">{t("description")}</p>

          {sharedEntries.length === 0 && !showAdd && (
            <div className="text-sm text-muted-foreground italic py-4 text-center">
              {t("no_shares")}
            </div>
          )}

          {sharedEntries.length > 0 && (
            <ul className="divide-y divide-border rounded-md border border-border overflow-hidden">
              {sharedEntries.map(([principalId, rights]) => {
                const principal = allPrincipalsById.get(principalId);
                const preset = kind === "calendar"
                  ? detectCalendarPreset(rights as CalendarRights)
                  : detectAddressBookPreset(rights as AddressBookRights);
                return (
                  <li key={principalId} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {principal?.name || principal?.email || principalId}
                      </div>
                      {principal?.description && (
                        <div className="text-xs text-muted-foreground truncate">
                          {principal.description}
                        </div>
                      )}
                    </div>
                    <div className="relative">
                      <select
                        value={preset}
                        onChange={(e) => handleSetRights(principalId, e.target.value as RolePreset)}
                        disabled={savingId === principalId}
                        className="appearance-none rounded-md border border-input bg-background pl-3 pr-8 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                      >
                        {presetOptions.map((p) => (
                          <option key={p} value={p}>{t(`preset.${p}`)}</option>
                        ))}
                        {preset === "custom" && (
                          <option value="custom">{t("preset.custom")}</option>
                        )}
                      </select>
                      <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
                    </div>
                    <button
                      onClick={() => handleRemove(principalId)}
                      disabled={savingId === principalId}
                      className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                      aria-label={t("remove")}
                      title={t("remove")}
                    >
                      {savingId === principalId
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Trash2 className="w-4 h-4" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {!showAdd && (
            <Button
              variant="outline"
              onClick={() => setShowAdd(true)}
              className="w-full"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              {t("add_person")}
            </Button>
          )}

          {showAdd && (
            <div className="space-y-2 border border-border rounded-md p-3">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("search_placeholder")}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                autoFocus
              />
              <div className="max-h-48 overflow-y-auto -mx-1">
                {loadingPrincipals && (
                  <div className="flex items-center justify-center py-4 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    {t("loading_principals")}
                  </div>
                )}
                {!loadingPrincipals && filteredPrincipals.length === 0 && (
                  <div className="text-xs text-muted-foreground text-center py-3">
                    {search.trim() ? t("no_match") : t("no_principals")}
                  </div>
                )}
                {!loadingPrincipals && filteredPrincipals.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleAdd(p)}
                    disabled={savingId === p.id}
                    className="w-full text-left px-3 py-2 rounded-md hover:bg-muted disabled:opacity-50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate flex items-center gap-2">
                          {p.name}
                          {p.type === "group" && (
                            <span className="text-[10px] uppercase font-normal text-muted-foreground bg-muted rounded px-1 py-0.5">
                              {t("group")}
                            </span>
                          )}
                        </div>
                        {p.email && p.email !== p.name && (
                          <div className="text-xs text-muted-foreground truncate">{p.email}</div>
                        )}
                      </div>
                      {savingId === p.id && <Loader2 className="w-4 h-4 animate-spin" />}
                    </div>
                  </button>
                ))}
              </div>
              <div className="flex justify-end pt-1">
                <Button variant="ghost" size="sm" onClick={() => { setShowAdd(false); setSearch(""); }}>
                  {tCommon("cancel")}
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
          <Button onClick={onClose}>{tCommon("close")}</Button>
        </div>
      </div>
    </div>
  );
}
