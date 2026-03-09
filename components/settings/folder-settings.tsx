"use client";

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useEmailStore } from '@/stores/email-store';
import { useAuthStore } from '@/stores/auth-store';
import { SettingsSection, SettingItem, Select } from './settings-section';
import { Plus, Pencil, Trash2, Check, X, FolderPlus } from 'lucide-react';
import { cn } from '@/lib/utils';

const STANDARD_ROLES = ['inbox', 'drafts', 'sent', 'trash', 'junk', 'archive'] as const;

export function FolderSettings() {
  const t = useTranslations('settings.folders');
  const { client } = useAuthStore();
  const { mailboxes, createMailbox, renameMailbox, deleteMailbox, setMailboxRole } = useEmailStore();

  const [isCreating, setIsCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Only show own (non-shared) mailboxes
  const ownMailboxes = mailboxes.filter(mb => !mb.isShared);

  const getRoleMailboxId = (role: string): string => {
    const mb = ownMailboxes.find(m => m.role === role);
    return mb?.id ?? '';
  };

  const handleCreate = async () => {
    if (!client || !newFolderName.trim()) return;
    setIsLoading(true);
    try {
      await createMailbox(client, newFolderName.trim());
      setNewFolderName('');
      setIsCreating(false);
    } catch {
      // error is set in the store
    } finally {
      setIsLoading(false);
    }
  };

  const handleRename = async (mailboxId: string) => {
    if (!client || !editingName.trim()) return;
    setIsLoading(true);
    try {
      await renameMailbox(client, mailboxId, editingName.trim());
      setEditingId(null);
      setEditingName('');
    } catch {
      // error is set in the store
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (mailboxId: string) => {
    if (!client) return;
    setIsLoading(true);
    try {
      await deleteMailbox(client, mailboxId);
      setDeletingId(null);
    } catch {
      // error is set in the store
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoleChange = async (role: string, mailboxId: string) => {
    if (!client) return;
    setIsLoading(true);
    try {
      if (mailboxId === '') {
        // Clear the role from whatever mailbox currently has it
        const current = ownMailboxes.find(m => m.role === role);
        if (current) {
          await setMailboxRole(client, current.id, null);
        }
      } else {
        await setMailboxRole(client, mailboxId, role);
      }
    } catch {
      // error is set in the store
    } finally {
      setIsLoading(false);
    }
  };

  const startEdit = (mb: { id: string; name: string }) => {
    setEditingId(mb.id);
    setEditingName(mb.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName('');
  };

  return (
    <div className="space-y-8">
      {/* Standard Folder Roles */}
      <SettingsSection title={t('standard_roles')} description={t('standard_roles_description')}>
        {STANDARD_ROLES.map((role) => (
          <SettingItem key={role} label={t(`role_${role}`)}>
            <Select
              value={getRoleMailboxId(role)}
              onChange={(value) => handleRoleChange(role, value)}
              options={[
                { value: '', label: t('role_none') },
                ...ownMailboxes.map(mb => ({
                  value: mb.id,
                  label: mb.name,
                })),
              ]}
            />
          </SettingItem>
        ))}
      </SettingsSection>

      {/* Folder List */}
      <SettingsSection title={t('folder_list')}>
        <div className="space-y-1">
          {ownMailboxes.map((mb) => (
            <div
              key={mb.id}
              className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50 group"
            >
              {editingId === mb.id ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRename(mb.id);
                      if (e.key === 'Escape') cancelEdit();
                    }}
                    className="flex-1 px-2 py-1 text-sm rounded border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    autoFocus
                    disabled={isLoading}
                  />
                  <button
                    onClick={() => handleRename(mb.id)}
                    disabled={isLoading || !editingName.trim()}
                    className="p-1 text-primary hover:bg-accent rounded disabled:opacity-50"
                    title={t('rename')}
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="p-1 text-muted-foreground hover:bg-accent rounded"
                    title={t('cancel')}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : deletingId === mb.id ? (
                <div className="flex items-center gap-2 flex-1">
                  <p className="text-sm text-destructive flex-1">
                    {t('confirm_delete', { name: mb.name })}
                  </p>
                  <button
                    onClick={() => handleDelete(mb.id)}
                    disabled={isLoading}
                    className="px-2 py-1 text-xs bg-destructive text-destructive-foreground rounded hover:bg-destructive/90 disabled:opacity-50"
                  >
                    {t('delete')}
                  </button>
                  <button
                    onClick={() => setDeletingId(null)}
                    className="px-2 py-1 text-xs bg-muted text-foreground rounded hover:bg-accent"
                  >
                    {t('cancel')}
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-foreground">{mb.name}</span>
                    {mb.role && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                        {mb.role}
                      </span>
                    )}
                  </div>
                  <div className={cn(
                    "flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity",
                  )}>
                    {mb.myRights?.mayRename && (
                      <button
                        onClick={() => startEdit(mb)}
                        className="p-1 text-muted-foreground hover:text-foreground hover:bg-accent rounded"
                        title={t('rename')}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {mb.myRights?.mayDelete && !mb.role && (
                      <button
                        onClick={() => setDeletingId(mb.id)}
                        className="p-1 text-muted-foreground hover:text-destructive hover:bg-accent rounded"
                        title={t('delete')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Create folder */}
        {isCreating ? (
          <div className="flex items-center gap-2 mt-3">
            <FolderPlus className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') {
                  setIsCreating(false);
                  setNewFolderName('');
                }
              }}
              placeholder={t('new_folder_name')}
              className="flex-1 px-2 py-1 text-sm rounded border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
              disabled={isLoading}
            />
            <button
              onClick={handleCreate}
              disabled={isLoading || !newFolderName.trim()}
              className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
            >
              {t('create')}
            </button>
            <button
              onClick={() => {
                setIsCreating(false);
                setNewFolderName('');
              }}
              className="px-3 py-1 text-xs bg-muted text-foreground rounded hover:bg-accent"
            >
              {t('cancel')}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 mt-3 px-3 py-2 text-sm text-primary hover:bg-accent rounded-md transition-colors w-full"
          >
            <Plus className="w-4 h-4" />
            {t('create_folder')}
          </button>
        )}
      </SettingsSection>
    </div>
  );
}
