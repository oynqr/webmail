"use client";

import { useCallback, useState, DragEvent } from "react";
import { Mailbox } from "@/lib/jmap/types";
import { useEmailStore } from "@/stores/email-store";
import { useAuthStore } from "@/stores/auth-store";
import { useDragDropContext } from "@/contexts/drag-drop-context";
import { toast } from "@/stores/toast-store";
import { getMailboxPath } from "@/lib/utils";

interface UseMailboxDropOptions {
  mailbox: Mailbox;
  onDropComplete?: () => void;
  // Translation callbacks for toast messages
  onSuccess?: (count: number, mailboxName: string) => void;
  onError?: (error: string) => void;
}

interface UseMailboxDropReturn {
  dropHandlers: {
    onDragOver: (e: DragEvent<HTMLDivElement>) => void;
    onDragEnter: (e: DragEvent<HTMLDivElement>) => void;
    onDragLeave: (e: DragEvent<HTMLDivElement>) => void;
    onDrop: (e: DragEvent<HTMLDivElement>) => void;
  };
  isDropTarget: boolean;
  isValidDropTarget: boolean;
  isInvalidDropTarget: boolean;
}

export function useMailboxDrop({ mailbox, onDropComplete, onSuccess, onError }: UseMailboxDropOptions): UseMailboxDropReturn {
  const [isOver, setIsOver] = useState(false);
  const { client } = useAuthStore();
  const { moveEmailsToMailbox, selectedEmailIds, clearSelection, refreshCurrentMailbox, mailboxes } = useEmailStore();
  const { isDragging, sourceMailboxId, draggedEmails, endDrag } = useDragDropContext();

  // Determine if this is a valid drop target
  const isValidTarget = useCallback(() => {
    if (!isDragging) return false;

    // Cannot drop on same mailbox
    if (mailbox.id === sourceMailboxId) return false;

    // Check if mailbox accepts items
    if (!mailbox.myRights?.mayAddItems) return false;

    // Virtual nodes (shared folder headers) cannot be drop targets
    if (mailbox.id.startsWith("shared-")) return false;

    // For shared mailboxes, check account compatibility
    if (mailbox.isShared && draggedEmails[0]) {
      // Get the source mailbox's account ID from the store
      const mailboxes = useEmailStore.getState().mailboxes;
      const sourceMb = mailboxes.find(mb => mb.id === sourceMailboxId);

      // Cross-account moves are not supported
      if (sourceMb?.accountId !== mailbox.accountId) {
        return false;
      }
    }

    return true;
  }, [isDragging, mailbox, sourceMailboxId, draggedEmails]);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (isValidTarget()) {
      e.dataTransfer.dropEffect = "move";
    } else {
      e.dataTransfer.dropEffect = "none";
    }
  }, [isValidTarget]);

  const handleDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    // Only leave if actually leaving the element (not entering a child)
    const relatedTarget = e.relatedTarget as Node | null;
    if (!e.currentTarget.contains(relatedTarget)) {
      setIsOver(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOver(false);

    if (!client || !isValidTarget()) {
      endDrag();
      return;
    }

    try {
      const emailIdsJson = e.dataTransfer.getData("application/x-email-ids");
      if (!emailIdsJson) {
        endDrag();
        return;
      }

      const emailIds: string[] = JSON.parse(emailIdsJson);

      // Move in a single bulk JMAP request (store handles counter updates).
      await moveEmailsToMailbox(client, emailIds, mailbox.id);

      // Clear selection if any selected emails were moved
      if (emailIds.some(id => selectedEmailIds.has(id))) {
        clearSelection();
      }

      // Refresh the current mailbox view (honors active search/filters)
      await refreshCurrentMailbox(client);

      const mailboxPath = getMailboxPath(mailbox, mailboxes);

      if (onSuccess) {
        onSuccess(emailIds.length, mailboxPath);
      } else {
        if (emailIds.length === 1) {
          toast.success("Email moved", `Moved to ${mailboxPath}`);
        } else {
          toast.success("Emails moved", `${emailIds.length} emails moved to ${mailboxPath}`);
        }
      }

      onDropComplete?.();
    } catch (error) {
      console.error("Failed to move emails:", error);

      // Call error callback if provided, otherwise use fallback
      if (onError) {
        onError(error instanceof Error ? error.message : 'Unknown error');
      } else {
        // Fallback for backward compatibility
        toast.error("Move failed", "Could not move emails to the selected folder");
      }
    } finally {
      endDrag();
    }
  }, [client, mailbox, mailboxes, isValidTarget, moveEmailsToMailbox, selectedEmailIds, clearSelection, refreshCurrentMailbox, endDrag, onDropComplete, onSuccess, onError]);

  const valid = isValidTarget();

  return {
    dropHandlers: {
      onDragOver: handleDragOver,
      onDragEnter: handleDragEnter,
      onDragLeave: handleDragLeave,
      onDrop: handleDrop,
    },
    isDropTarget: isOver && isDragging,
    isValidDropTarget: isOver && valid,
    isInvalidDropTarget: isOver && isDragging && !valid,
  };
}
