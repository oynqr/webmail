'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { X, Mail, Pencil, Trash2, Plus, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { IdentityForm } from './identity-form';
import { useIdentityStore } from '@/stores/identity-store';
import { useAuthStore } from '@/stores/auth-store';
import type { Identity, EmailAddress } from '@/lib/jmap/types';
import { toast } from '@/stores/toast-store';
import { useFocusTrap } from '@/hooks/use-focus-trap';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';

interface IdentityFormData {
  name: string;
  email: string;
  replyTo?: EmailAddress[];
  bcc?: EmailAddress[];
  textSignature?: string;
  htmlSignature?: string;
}

interface IdentityManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function IdentityManagerModal({ isOpen, onClose }: IdentityManagerModalProps) {
  const t = useTranslations('identities');
  const tNotif = useTranslations('notifications');

  const client = useAuthStore((state) => state.client);
  const { identities, addIdentity, updateIdentityLocal, removeIdentity } = useIdentityStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { dialogProps: confirmDialogProps, confirm: confirmDialog } = useConfirmDialog();

  // Focus trap with Escape handling
  const modalRef = useFocusTrap({
    isActive: isOpen,
    onEscape: () => {
      if (isCreating || editingId) {
        setIsCreating(false);
        setEditingId(null);
      } else {
        onClose();
      }
    },
    restoreFocus: true,
  });

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose, modalRef]);

  const handleCreate = useCallback(async (data: IdentityFormData) => {
    if (!client) return;

    try {
      const newIdentity = await client.createIdentity(
        data.name,
        data.email,
        data.replyTo,
        data.bcc,
        data.textSignature,
        data.htmlSignature
      );

      addIdentity(newIdentity);
      setIsCreating(false);
      toast.success(tNotif('identity_created'));
    } catch (error) {
      const message = error instanceof Error ? error.message : t('validation_errors.unknown_error');
      toast.error(tNotif('identity_create_failed', { error: message }));
      throw error;
    }
  }, [client, addIdentity, t, tNotif]);

  const handleUpdate = useCallback(async (identity: Identity, data: IdentityFormData) => {
    if (!client) return;

    try {
      await client.updateIdentity(identity.id, {
        name: data.name,
        replyTo: data.replyTo,
        bcc: data.bcc,
        textSignature: data.textSignature,
        htmlSignature: data.htmlSignature,
      });

      updateIdentityLocal(identity.id, data);
      setEditingId(null);
      toast.success(tNotif('identity_updated'));
    } catch (error) {
      const message = error instanceof Error ? error.message : t('validation_errors.unknown_error');
      toast.error(tNotif('identity_update_failed', { error: message }));
      throw error;
    }
  }, [client, updateIdentityLocal, t, tNotif]);

  const handleDelete = useCallback(async (identity: Identity) => {
    if (!client) return;
    if (!identity.mayDelete) {
      toast.error(t('cannot_delete'));
      return;
    }

    const confirmed = await confirmDialog({
      title: t('delete_confirm_title'),
      message: t('delete_confirm'),
      confirmText: t('delete_button'),
      variant: "destructive",
    });
    if (!confirmed) return;

    setDeletingId(identity.id);

    try {
      await client.deleteIdentity(identity.id);
      removeIdentity(identity.id);
      toast.success(tNotif('identity_deleted'));
    } catch (error) {
      const message = error instanceof Error ? error.message : t('validation_errors.unknown_error');
      toast.error(tNotif('identity_delete_failed', { error: message }));
    } finally {
      setDeletingId(null);
    }
  }, [client, removeIdentity, t, tNotif, confirmDialog]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-[1px] flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="identity-modal-title"
        className={cn(
          'bg-background border border-border rounded-lg shadow-xl',
          'w-full max-w-3xl max-h-[90vh] overflow-hidden',
          'animate-in zoom-in-95 duration-200'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5 text-muted-foreground" />
            <h2 id="identity-modal-title" className="text-lg font-semibold text-foreground">
              {t('modal_title')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-muted transition-colors duration-150 text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {/* Create New Form */}
          {isCreating && (
            <div className="mb-6 p-4 border border-border rounded-lg bg-muted/30">
              <h3 className="text-sm font-semibold mb-4">{t('create_new')}</h3>
              <IdentityForm
                onSave={handleCreate}
                onCancel={() => setIsCreating(false)}
              />
            </div>
          )}

          {/* Create Button */}
          {!isCreating && !editingId && (
            <Button
              onClick={() => setIsCreating(true)}
              className="mb-6 w-full sm:w-auto"
            >
              <Plus className="w-4 h-4 mr-2" />
              {t('create_new')}
            </Button>
          )}

          {/* Identities List */}
          <div className="space-y-4">
            {identities.map((identity) => (
              <div
                key={identity.id}
                className="border border-border rounded-lg overflow-hidden"
              >
                {editingId === identity.id ? (
                  <div className="p-4 bg-muted/30">
                    <h3 className="text-sm font-semibold mb-4">
                      {t('edit_identity')}
                    </h3>
                    <IdentityForm
                      identity={identity}
                      onSave={(data) => handleUpdate(identity, data)}
                      onCancel={() => setEditingId(null)}
                    />
                  </div>
                ) : (
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-foreground truncate">
                            {identity.name}
                          </h3>
                          {identities[0]?.id === identity.id && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                              {t('primary_identity')}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {identity.email}
                        </p>

                        {/* Additional Info */}
                        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                          {identity.replyTo && identity.replyTo.length > 0 && (
                            <p>
                              {t('display.reply_to')} {identity.replyTo.map((a) => a.email).join(', ')}
                            </p>
                          )}
                          {identity.bcc && identity.bcc.length > 0 && (
                            <p>
                              {t('display.bcc')} {identity.bcc.map((a) => a.email).join(', ')}
                            </p>
                          )}
                          {identity.textSignature && (
                            <p className="line-clamp-2">
                              {t('display.signature')} {identity.textSignature}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingId(identity.id)}
                          disabled={!!editingId || isCreating}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(identity)}
                          disabled={
                            !identity.mayDelete ||
                            !!editingId ||
                            isCreating ||
                            deletingId === identity.id
                          }
                          className={!identity.mayDelete ? 'opacity-30' : ''}
                        >
                          {!identity.mayDelete ? (
                            <AlertTriangle className="w-4 h-4 text-yellow-500" />
                          ) : (
                            <Trash2 className="w-4 h-4 text-destructive" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {!identity.mayDelete && (
                      <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-2 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {t('cannot_delete')}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}

            {identities.length === 0 && !isCreating && (
              <div className="text-center py-12 text-muted-foreground">
                <Mail className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">{t('no_identities')}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog {...confirmDialogProps} />
    </div>
  );
}
