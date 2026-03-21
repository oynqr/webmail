"use client";

import { Email } from "@/lib/jmap/types";
import { useSettingsStore } from "@/stores/settings-store";
import type { HoverAction } from "@/stores/settings-store";
import { cn } from "@/lib/utils";
import { Trash2, Star, Mail, MailOpen, Archive, Tag, ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";

interface EmailHoverActionsProps {
  email: Email;
  onToggleStar?: () => void;
  onMarkAsRead?: (read: boolean) => void;
  onDelete?: () => void;
  onArchive?: () => void;
  onSetColorTag?: (color: string | null) => void;
  onMarkAsSpam?: () => void;
}

const ACTION_CONFIG: Record<HoverAction, {
  icon: typeof Trash2;
  titleKey: string;
  className?: string;
}> = {
  delete: {
    icon: Trash2,
    titleKey: "delete",
    className: "hover:text-red-600 dark:hover:text-red-400",
  },
  star: {
    icon: Star,
    titleKey: "star",
    className: "hover:text-amber-500 dark:hover:text-amber-400",
  },
  markRead: {
    icon: Mail,
    titleKey: "mark_read",
    className: "hover:text-blue-600 dark:hover:text-blue-400",
  },
  archive: {
    icon: Archive,
    titleKey: "archive",
    className: "hover:text-green-600 dark:hover:text-green-400",
  },
  tag: {
    icon: Tag,
    titleKey: "tag",
    className: "hover:text-purple-600 dark:hover:text-purple-400",
  },
  spam: {
    icon: ShieldAlert,
    titleKey: "spam",
    className: "hover:text-orange-600 dark:hover:text-orange-400",
  },
};

export function EmailHoverActions({
  email,
  onToggleStar,
  onMarkAsRead,
  onDelete,
  onArchive,
  onSetColorTag,
  onMarkAsSpam,
}: EmailHoverActionsProps) {
  const hoverActions = useSettingsStore((state) => state.hoverActions);
  const t = useTranslations("settings.email_behavior.hover_actions");

  const isUnread = !email.keywords?.$seen;
  const isStarred = email.keywords?.$flagged;

  if (hoverActions.length === 0) return null;

  const handleAction = (e: React.MouseEvent, action: HoverAction) => {
    e.stopPropagation();
    e.preventDefault();
    switch (action) {
      case "delete":
        onDelete?.();
        break;
      case "star":
        onToggleStar?.();
        break;
      case "markRead":
        onMarkAsRead?.(!isUnread);
        break;
      case "archive":
        onArchive?.();
        break;
      case "tag":
        onSetColorTag?.(null);
        break;
      case "spam":
        onMarkAsSpam?.();
        break;
    }
  };

  return (
    <div
      className="absolute right-0 top-0 bottom-0 z-10 hidden group-hover:flex items-center"
    >
      <div className="w-8 h-full bg-gradient-to-r from-transparent to-muted" />
      <div className="flex items-center gap-0.5 h-full bg-muted pr-3 pl-0.5">
        {hoverActions.map((actionId) => {
          const config = ACTION_CONFIG[actionId];
          if (!config) return null;
        const Icon = config.icon;

          const DisplayIcon = actionId === "markRead"
            ? (isUnread ? MailOpen : Mail)
            : actionId === "star" && isStarred
              ? Star
              : Icon;

          return (
            <button
              key={actionId}
              onClick={(e) => handleAction(e, actionId)}
              title={t(config.titleKey)}
              className={cn(
                "p-1.5 rounded-md transition-colors duration-100 text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10",
                config.className,
              )}
            >
              <DisplayIcon
                className={cn(
                  "w-4 h-4",
                  actionId === "star" && isStarred && "fill-amber-400 text-amber-400",
                )}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
