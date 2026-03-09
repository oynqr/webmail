"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Inbox,
  Send,
  File,
  Star,
  Trash2,
  Archive,
  PenSquare,
  Search,
  Menu,
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  Users,
  User,
  Palmtree,
  SlidersHorizontal,
  Settings,
  X,
} from "lucide-react";
import { cn, buildMailboxTree, MailboxNode } from "@/lib/utils";
import { Mailbox } from "@/lib/jmap/types";
import { useDragDropContext } from "@/contexts/drag-drop-context";
import { useMailboxDrop } from "@/hooks/use-mailbox-drop";
import { useEmailStore } from "@/stores/email-store";
import { useUIStore } from "@/stores/ui-store";
import { activeFilterCount } from "@/lib/jmap/search-utils";
import { useVacationStore } from "@/stores/vacation-store";
import { toast } from "@/stores/toast-store";
import { debug } from "@/lib/debug";

interface SidebarProps {
  mailboxes: Mailbox[];
  selectedMailbox?: string;
  onMailboxSelect?: (mailboxId: string) => void;
  onCompose?: () => void;
  onSidebarClose?: () => void;
  onSearch?: (query: string) => void;
  onClearSearch?: () => void;
  activeSearchQuery?: string;
  className?: string;
}

const getIconForMailbox = (role?: string, name?: string, hasChildren?: boolean, isExpanded?: boolean, isShared?: boolean, id?: string) => {
  const lowerName = name?.toLowerCase() || "";

  if (id === 'shared-folders-root') {
    return isExpanded ? FolderOpen : Users;
  }

  if (id?.startsWith('shared-account-')) {
    return isExpanded ? FolderOpen : User;
  }

  if (isShared && hasChildren && !id?.startsWith('shared-')) {
    return isExpanded ? FolderOpen : Folder;
  }

  if (hasChildren) {
    return isExpanded ? FolderOpen : Folder;
  }

  if (role === "inbox" || lowerName.includes("inbox")) return Inbox;
  if (role === "sent" || lowerName.includes("sent")) return Send;
  if (role === "drafts" || lowerName.includes("draft")) return File;
  if (role === "trash" || lowerName.includes("trash")) return Trash2;
  if (role === "archive" || lowerName.includes("archive")) return Archive;
  if (lowerName.includes("star") || lowerName.includes("flag")) return Star;
  return Inbox;
};

function MailboxTreeItem({
  node,
  selectedMailbox,
  expandedFolders,
  onMailboxSelect,
  onToggleExpand,
  isCollapsed,
}: {
  node: MailboxNode;
  selectedMailbox: string;
  expandedFolders: Set<string>;
  onMailboxSelect?: (id: string) => void;
  onToggleExpand: (id: string) => void;
  isCollapsed: boolean;
}) {
  const t = useTranslations('sidebar');
  const tNotifications = useTranslations('notifications');
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedFolders.has(node.id);
  const Icon = getIconForMailbox(node.role, node.name, hasChildren, isExpanded, node.isShared, node.id);
  const indentPixels = node.depth * 16;
  const isVirtualNode = node.id.startsWith('shared-');

  const { isDragging: globalDragging } = useDragDropContext();
  const { dropHandlers, isValidDropTarget, isInvalidDropTarget } = useMailboxDrop({
    mailbox: node,
    onSuccess: (count, mailboxName) => {
      if (count === 1) {
        toast.success(
          tNotifications('email_moved'),
          tNotifications('moved_to_mailbox', { mailbox: mailboxName })
        );
      } else {
        toast.success(
          tNotifications('emails_moved', { count }),
          tNotifications('moved_to_mailbox', { mailbox: mailboxName })
        );
      }
    },
    onError: () => {
      toast.error(tNotifications('move_failed'), tNotifications('move_error'));
    },
  });

  return (
    <>
      <div
        {...(globalDragging ? dropHandlers : {})}
        className={cn(
          "group w-full flex items-center px-2 py-1 lg:py-1 max-lg:py-3 max-lg:min-h-[44px] text-sm transition-all duration-200",
          isVirtualNode
            ? "text-muted-foreground"
            : selectedMailbox === node.id
              ? "bg-accent text-accent-foreground"
              : "hover:bg-muted text-foreground",
          node.depth === 0 && !isVirtualNode && "font-medium",
          isValidDropTarget && "bg-primary/20 ring-2 ring-primary ring-inset",
          isInvalidDropTarget && "bg-destructive/10 ring-2 ring-destructive/30 ring-inset opacity-50"
        )}
      >
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(node.id);
            }}
            className={cn(
              "p-0.5 rounded mr-1 transition-all duration-200",
              "hover:bg-muted active:bg-accent"
            )}
            style={{ marginLeft: indentPixels }}
            title={isExpanded ? t('collapse_tooltip') : t('expand_tooltip')}
          >
            {isExpanded ? (
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-3 h-3 text-muted-foreground" />
            )}
          </button>
        )}

        <button
          onClick={() => !isVirtualNode && onMailboxSelect?.(node.id)}
          disabled={isVirtualNode}
          className={cn(
            "flex-1 flex items-center text-left py-1 lg:py-1 max-lg:py-2 px-1 rounded",
            "transition-colors duration-150",
            isVirtualNode && "cursor-default select-none"
          )}
          style={{
            paddingLeft: hasChildren ? '4px' : `${indentPixels + 24}px`
          }}
          title={isCollapsed ? node.name : undefined}
        >
          <Icon className={cn(
            "w-4 h-4 mr-2 flex-shrink-0 transition-colors",
            hasChildren && isExpanded && "text-primary",
            selectedMailbox === node.id && "text-accent-foreground",
            !hasChildren && node.depth > 0 && "text-muted-foreground",
            node.isShared && "text-blue-500"
          )} />
          {!isCollapsed && (
            <>
              <span className="flex-1 truncate">{node.name}</span>
              <span className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                {node.unreadEmails > 0 && (
                  <span className={cn(
                    "text-xs rounded-full px-2 py-0.5 font-medium",
                    selectedMailbox === node.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-foreground text-background"
                  )}>
                    {node.unreadEmails}
                  </span>
                )}
                <span className="text-xs text-muted-foreground tabular-nums">
                  {node.totalEmails}
                </span>
              </span>
            </>
          )}
        </button>
      </div>

      {hasChildren && isExpanded && !isCollapsed && (
        <div className="relative">
          {node.children.map((child) => (
            <MailboxTreeItem
              key={child.id}
              node={child}
              selectedMailbox={selectedMailbox}
              expandedFolders={expandedFolders}
              onMailboxSelect={onMailboxSelect}
              onToggleExpand={onToggleExpand}
              isCollapsed={isCollapsed}
            />
          ))}
        </div>
      )}
    </>
  );
}

function VacationBanner() {
  const t = useTranslations('sidebar');
  const router = useRouter();
  const { isEnabled, isSupported } = useVacationStore();

  if (!isSupported || !isEnabled) return null;

  return (
    <button
      onClick={() => router.push('/settings')}
      className={cn(
        "flex items-center gap-2 w-full px-3 py-2 text-xs",
        "bg-amber-500/10 dark:bg-amber-400/10 text-amber-700 dark:text-amber-400",
        "hover:bg-amber-500/15 dark:hover:bg-amber-400/15 transition-colors"
      )}
    >
      <Palmtree className="w-3.5 h-3.5 flex-shrink-0" />
      <span className="truncate font-medium">{t("vacation_active")}</span>
      <Settings className="w-3 h-3 ml-auto flex-shrink-0 opacity-60" />
    </button>
  );
}

function AdvancedSearchToggle() {
  const tSearch = useTranslations("advanced_search");
  const { searchFilters, isAdvancedSearchOpen, toggleAdvancedSearch } = useEmailStore();
  const filterCount = activeFilterCount(searchFilters);

  return (
    <button
      type="button"
      onClick={toggleAdvancedSearch}
      className={cn(
        "relative flex-shrink-0 p-2 rounded-md transition-colors",
        isAdvancedSearchOpen || filterCount > 0
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
      )}
      title={tSearch("toggle_filters")}
    >
      <SlidersHorizontal className="w-4 h-4" />
      {filterCount > 0 && (
        <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 text-[10px] font-bold rounded-full bg-primary text-primary-foreground">
          {filterCount}
        </span>
      )}
    </button>
  );
}

export function Sidebar({
  mailboxes = [],
  selectedMailbox = "",
  onMailboxSelect,
  onCompose,
  onSidebarClose,
  onSearch,
  onClearSearch,
  activeSearchQuery = "",
  className,
}: SidebarProps) {
  const { sidebarCollapsed: isCollapsed, toggleSidebarCollapsed } = useUIStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const t = useTranslations('sidebar');

  useEffect(() => {
    setSearchQuery(activeSearchQuery);
  }, [activeSearchQuery]);

  useEffect(() => {
    const stored = localStorage.getItem('expandedMailboxes');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setExpandedFolders(new Set(parsed));
      } catch (e) {
        debug.error('Failed to parse expanded mailboxes:', e);
      }
    } else {
      const tree = buildMailboxTree(mailboxes);
      const defaultExpanded = tree
        .filter(node => node.children.length > 0)
        .map(node => node.id);
      setExpandedFolders(new Set(defaultExpanded));
    }
  }, [mailboxes]);

  const handleToggleExpand = (mailboxId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(mailboxId)) {
        next.delete(mailboxId);
      } else {
        next.add(mailboxId);
      }
      try {
        localStorage.setItem('expandedMailboxes', JSON.stringify(Array.from(next)));
      } catch { /* storage full or unavailable */ }
      return next;
    });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim() && onSearch) {
      onSearch(searchQuery);
    }
  };

  const mailboxTree = buildMailboxTree(mailboxes);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedMailbox || isCollapsed) return;

      const findNode = (nodes: MailboxNode[]): MailboxNode | null => {
        for (const node of nodes) {
          if (node.id === selectedMailbox) return node;
          const found = findNode(node.children);
          if (found) return found;
        }
        return null;
      };

      const selectedNode = findNode(mailboxTree);
      if (!selectedNode) return;

      if (e.key === 'ArrowRight' && selectedNode.children.length > 0) {
        if (!expandedFolders.has(selectedMailbox)) {
          handleToggleExpand(selectedMailbox);
        }
      } else if (e.key === 'ArrowLeft' && selectedNode.children.length > 0) {
        if (expandedFolders.has(selectedMailbox)) {
          handleToggleExpand(selectedMailbox);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedMailbox, isCollapsed, expandedFolders, mailboxTree]);

  return (
    <div
      className={cn(
        "relative flex flex-col h-full border-r transition-all duration-300 overflow-hidden",
        "bg-secondary border-border",
        "max-lg:w-full",
        isCollapsed ? "lg:w-16" : "lg:w-full",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Button
          variant="ghost"
          size="icon"
          onClick={onSidebarClose}
          className="lg:hidden h-11 w-11 flex-shrink-0"
          aria-label={t("close")}
        >
          <X className="w-5 h-5" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebarCollapsed}
          className="hidden lg:flex"
        >
          <Menu className="w-5 h-5" />
        </Button>

        {!isCollapsed && (
          <Button onClick={onCompose} className="flex-1" title={t("compose_hint")}>
            <PenSquare className="w-4 h-4 mr-2" />
            {t("compose")}
          </Button>
        )}
      </div>

      {/* Vacation Banner */}
      {!isCollapsed && <VacationBanner />}

      {/* Search + Advanced Filter Toggle */}
      {!isCollapsed && (
        <div className="px-4 py-3">
          <div className="flex items-center gap-1.5">
            <form onSubmit={handleSearch} className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder={t("search_placeholder_hint")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn("pl-9", searchQuery && "pr-8")}
                data-search-input
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    onClearSearch?.();
                  }}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={t('clear_search')}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </form>
            <AdvancedSearchToggle />
          </div>
        </div>
      )}

      {/* Mailbox List */}
      <div className="flex-1 overflow-y-auto">
        <div className="py-1">
          {mailboxes.length === 0 ? (
            <div className="px-4 py-2 text-sm text-muted-foreground">
              {!isCollapsed && t("loading_mailboxes")}
            </div>
          ) : (
            <>
              {mailboxTree.map((node) => (
                <MailboxTreeItem
                  key={node.id}
                  node={node}
                  selectedMailbox={selectedMailbox}
                  expandedFolders={expandedFolders}
                  onMailboxSelect={onMailboxSelect}
                  onToggleExpand={handleToggleExpand}
                  isCollapsed={isCollapsed}
                />
              ))}
            </>
          )}
        </div>
      </div>

      {/* Footer removed - storage quota and sign out moved to NavigationRail */}
    </div>
  );
}
