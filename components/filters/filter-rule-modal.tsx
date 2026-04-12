"use client";

import { useState, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Plus, Trash2 } from "lucide-react";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { toast } from "@/stores/toast-store";
import type {
  FilterRule,
  FilterCondition,
  FilterAction,
  FilterConditionField,
  FilterComparator,
  FilterActionType,
} from "@/lib/jmap/sieve-types";
import type { Mailbox } from "@/lib/jmap/types";
import { buildMailboxTree, flattenMailboxTree, type MailboxNode, generateUUID } from "@/lib/utils";
import { useSettingsStore } from "@/stores/settings-store";

interface FilterRuleModalProps {
  rule?: FilterRule;
  mailboxes: Mailbox[];
  onSave: (rule: FilterRule) => void;
  onClose: () => void;
}

const ALL_FIELDS: FilterConditionField[] = [
  "from", "to", "cc", "subject", "header", "size", "body",
];

const TEXT_COMPARATORS: FilterComparator[] = [
  "contains", "not_contains", "is", "not_is", "starts_with", "ends_with", "matches",
];

const SIZE_COMPARATORS: FilterComparator[] = ["greater_than", "less_than"];

const ALL_ACTION_TYPES: FilterActionType[] = [
  "move", "copy", "forward", "mark_read", "star", "add_label", "discard", "reject", "keep", "stop",
];

const ACTIONS_WITH_VALUE = new Set<FilterActionType>(["move", "copy", "forward", "reject", "add_label"]);
const ACTIONS_WITH_MAILBOX = new Set<FilterActionType>(["move", "copy"]);

function makeEmptyCondition(): FilterCondition {
  return { field: "from", comparator: "contains", value: "" };
}

function makeEmptyAction(): FilterAction {
  return { type: "move", value: "" };
}

export function FilterRuleModal({
  rule,
  mailboxes,
  onSave,
  onClose,
}: FilterRuleModalProps) {
  const t = useTranslations("settings.filters");
  const isEdit = !!rule;
  const emailKeywords = useSettingsStore((state) => state.emailKeywords);

  const [name, setName] = useState(rule?.name || "");
  const [matchType, setMatchType] = useState<"all" | "any">(rule?.matchType || "all");
  const [conditions, setConditions] = useState<FilterCondition[]>(
    rule?.conditions.length ? [...rule.conditions] : [makeEmptyCondition()]
  );
  const [actions, setActions] = useState<FilterAction[]>(
    rule?.actions.length ? [...rule.actions] : [makeEmptyAction()]
  );
  const [stopProcessing, setStopProcessing] = useState(rule?.stopProcessing ?? false);

  const modalRef = useFocusTrap({ isActive: true, onEscape: onClose });

  const { hierarchicalMailboxes, mailboxPathMap } = useMemo(() => {
    const tree = buildMailboxTree(mailboxes.filter((mb) => !mb.isShared));
    const pathMap = new Map<string, string>();
    const buildPaths = (nodes: MailboxNode[], parentPath = "") => {
      for (const node of nodes) {
        const fullPath = parentPath ? `${parentPath}/${node.name}` : node.name;
        pathMap.set(node.id, fullPath);
        if (node.children.length > 0) buildPaths(node.children, fullPath);
      }
    };
    buildPaths(tree);
    return { hierarchicalMailboxes: flattenMailboxTree(tree), mailboxPathMap: pathMap };
  }, [mailboxes]);

  const handleSave = useCallback(() => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error(t("validation_empty_name"));
      return;
    }

    const validConditions = conditions.filter(
      (c) => c.value.trim()
    );
    if (validConditions.length === 0) {
      toast.error(t("validation_empty_conditions"));
      return;
    }

    const validActions = actions.filter(
      (a) => !ACTIONS_WITH_VALUE.has(a.type) || a.value?.trim()
    );
    if (validActions.length === 0) {
      toast.error(t("validation_empty_actions"));
      return;
    }

    onSave({
      id: rule?.id || generateUUID(),
      name: trimmedName,
      enabled: rule?.enabled ?? true,
      matchType,
      conditions: validConditions,
      actions: validActions,
      stopProcessing,
    });
  }, [name, matchType, conditions, actions, stopProcessing, rule, onSave, t]);

  const updateCondition = (index: number, updates: Partial<FilterCondition>) => {
    setConditions((prev) =>
      prev.map((c, i) => {
        if (i !== index) return c;
        const updated = { ...c, ...updates };
        if (updates.field === "size" && !SIZE_COMPARATORS.includes(c.comparator)) {
          updated.comparator = "greater_than";
        }
        if (updates.field && updates.field !== "size" && SIZE_COMPARATORS.includes(c.comparator)) {
          updated.comparator = "contains";
        }
        if (updates.field && updates.field !== "header") {
          delete updated.headerName;
        }
        return updated;
      })
    );
  };

  const removeCondition = (index: number) => {
    if (conditions.length <= 1) return;
    setConditions((prev) => prev.filter((_, i) => i !== index));
  };

  const updateAction = (index: number, updates: Partial<FilterAction>) => {
    setActions((prev) =>
      prev.map((a, i) => {
        if (i !== index) return a;
        const updated = { ...a, ...updates };
        if (updates.type && !ACTIONS_WITH_VALUE.has(updates.type)) {
          delete updated.value;
        }
        if (updates.type && ACTIONS_WITH_MAILBOX.has(updates.type) && !updated.value) {
          const firstMb = hierarchicalMailboxes[0];
          updated.value = firstMb ? (mailboxPathMap.get(firstMb.id) || firstMb.name) : "";
        }
        return updated;
      })
    );
  };

  const removeAction = (index: number) => {
    if (actions.length <= 1) return;
    setActions((prev) => prev.filter((_, i) => i !== index));
  };

  const selectClass =
    "px-2.5 py-1.5 text-sm rounded-md bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors duration-150 cursor-pointer hover:border-muted-foreground";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[1px]" onClick={onClose} aria-hidden="true" />
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? t("edit_rule") : t("new_rule")}
        className="relative bg-background border border-border rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">
            {isEdit ? t("edit_rule") : t("new_rule")}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-muted transition-colors duration-150 text-muted-foreground hover:text-foreground"
            aria-label={t("cancel")}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-6">
          <div>
            <label className="text-sm font-medium mb-1 block text-foreground">
              {t("rule_name")}
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("rule_name_placeholder")}
              maxLength={200}
              autoFocus
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block text-foreground">
              {t("match_type")}
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMatchType("all")}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors duration-150 ${
                  matchType === "all"
                    ? "bg-primary text-primary-foreground font-medium"
                    : "bg-muted hover:bg-accent text-foreground"
                }`}
              >
                {t("match_all")}
              </button>
              <button
                type="button"
                onClick={() => setMatchType("any")}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors duration-150 ${
                  matchType === "any"
                    ? "bg-primary text-primary-foreground font-medium"
                    : "bg-muted hover:bg-accent text-foreground"
                }`}
              >
                {t("match_any")}
              </button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block text-foreground">
              {t("conditions")}
            </label>
            <div className="space-y-2">
              {conditions.map((condition, index) => (
                <div key={index} className="flex items-center gap-2 flex-wrap">
                  <select
                    value={condition.field}
                    onChange={(e) =>
                      updateCondition(index, { field: e.target.value as FilterConditionField })
                    }
                    className={selectClass}
                    aria-label={t("conditions")}
                  >
                    {ALL_FIELDS.map((f) => (
                      <option key={f} value={f}>
                        {t(`condition_fields.${f}`)}
                      </option>
                    ))}
                  </select>

                  {condition.field === "header" && (
                    <Input
                      value={condition.headerName || ""}
                      onChange={(e) =>
                        updateCondition(index, { headerName: e.target.value })
                      }
                      placeholder={t("header_name")}
                      className="w-28"
                    />
                  )}

                  <select
                    value={condition.comparator}
                    onChange={(e) =>
                      updateCondition(index, { comparator: e.target.value as FilterComparator })
                    }
                    className={selectClass}
                    aria-label={t("comparators.contains")}
                  >
                    {(condition.field === "size" ? SIZE_COMPARATORS : TEXT_COMPARATORS).map(
                      (c) => (
                        <option key={c} value={c}>
                          {t(`comparators.${c}`)}
                        </option>
                      )
                    )}
                  </select>

                  <Input
                    value={condition.value}
                    onChange={(e) => updateCondition(index, { value: e.target.value })}
                    placeholder={
                      condition.field === "size" ? t("size_placeholder") : t("header_placeholder")
                    }
                    className="flex-1 min-w-[120px]"
                    type={condition.field === "size" ? "number" : "text"}
                  />

                  <button
                    type="button"
                    onClick={() => removeCondition(index)}
                    disabled={conditions.length <= 1}
                    className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-destructive transition-colors disabled:opacity-30 disabled:pointer-events-none"
                    aria-label={t("delete_rule")}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setConditions((prev) => [...prev, makeEmptyCondition()])}
              className="flex items-center gap-1 mt-2 text-sm text-primary hover:underline"
            >
              <Plus className="w-3.5 h-3.5" />
              {t("add_condition")}
            </button>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block text-foreground">
              {t("actions")}
            </label>
            <div className="space-y-2">
              {actions.map((action, index) => (
                <div key={index} className="flex items-center gap-2 flex-wrap">
                  <select
                    value={action.type}
                    onChange={(e) =>
                      updateAction(index, { type: e.target.value as FilterActionType })
                    }
                    className={selectClass}
                    aria-label={t("actions")}
                  >
                    {ALL_ACTION_TYPES.map((a) => (
                      <option key={a} value={a}>
                        {t(`action_types.${a}`)}
                      </option>
                    ))}
                  </select>

                  {ACTIONS_WITH_MAILBOX.has(action.type) && (
                    <select
                      value={action.value || ""}
                      onChange={(e) => updateAction(index, { value: e.target.value })}
                      className={`${selectClass} flex-1 min-w-[140px]`}
                      aria-label={t("move_to_folder")}
                    >
                      <option value="">{t("move_to_folder")}</option>
                      {hierarchicalMailboxes.map((mb) => (
                        <option key={mb.id} value={mailboxPathMap.get(mb.id) || mb.name}>
                          {"\u00A0".repeat(mb.depth * 3)}{mb.name}
                        </option>
                      ))}
                    </select>
                  )}

                  {action.type === "forward" && (
                    <Input
                      value={action.value || ""}
                      onChange={(e) => updateAction(index, { value: e.target.value })}
                      placeholder={t("forward_placeholder")}
                      type="email"
                      className="flex-1 min-w-[180px]"
                    />
                  )}

                  {action.type === "reject" && (
                    <Input
                      value={action.value || ""}
                      onChange={(e) => updateAction(index, { value: e.target.value })}
                      placeholder={t("reject_placeholder")}
                      className="flex-1 min-w-[180px]"
                    />
                  )}

                  {action.type === "add_label" && (
                    <select
                      value={action.value || ""}
                      onChange={(e) => updateAction(index, { value: e.target.value })}
                      className={`${selectClass} flex-1 min-w-[140px]`}
                      aria-label={t("label_placeholder")}
                    >
                      <option value="">{t("label_placeholder")}</option>
                      {emailKeywords.map((kw) => (
                        <option key={kw.id} value={kw.id}>{kw.label}</option>
                      ))}
                    </select>
                  )}

                  <button
                    type="button"
                    onClick={() => removeAction(index)}
                    disabled={actions.length <= 1}
                    className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-destructive transition-colors disabled:opacity-30 disabled:pointer-events-none"
                    aria-label={t("delete_rule")}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setActions((prev) => [...prev, makeEmptyAction()])}
              className="flex items-center gap-1 mt-2 text-sm text-primary hover:underline"
            >
              <Plus className="w-3.5 h-3.5" />
              {t("add_action")}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="stopProcessing"
              checked={stopProcessing}
              onChange={(e) => setStopProcessing(e.target.checked)}
              className="rounded border-input"
            />
            <label htmlFor="stopProcessing" className="text-sm text-foreground">
              {t("stop_processing")}
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
          <Button variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            {t("save")}
          </Button>
        </div>
      </div>
    </div>
  );
}
