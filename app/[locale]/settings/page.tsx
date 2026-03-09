"use client";

import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Settings as SettingsIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AppearanceSettings } from '@/components/settings/appearance-settings';
import { EmailSettings } from '@/components/settings/email-settings';
import { AccountSettings } from '@/components/settings/account-settings';
import { IdentitySettings } from '@/components/settings/identity-settings';
import { VacationSettings } from '@/components/settings/vacation-settings';
import { CalendarSettings } from '@/components/settings/calendar-settings';
import { FilterSettings } from '@/components/settings/filter-settings';
import { TemplateSettings } from '@/components/settings/template-settings';
import { AdvancedSettings } from '@/components/settings/advanced-settings';
import { FolderSettings } from '@/components/settings/folder-settings';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';

type Tab = 'appearance' | 'email' | 'account' | 'identities' | 'vacation' | 'calendar' | 'filters' | 'templates' | 'folders' | 'advanced';

export default function SettingsPage() {
  const router = useRouter();
  const t = useTranslations('settings');
  const { client } = useAuthStore();
  const [activeTab, setActiveTab] = useState<Tab>('appearance');

  const supportsVacation = client?.supportsVacationResponse() ?? false;
  const supportsCalendar = client?.supportsCalendars() ?? false;
  const supportsSieve = client?.supportsSieve() ?? false;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'appearance', label: t('tabs.appearance') },
    { id: 'email', label: t('tabs.email') },
    { id: 'account', label: t('tabs.account') },
    { id: 'identities', label: t('tabs.identities') },
    ...(supportsVacation ? [{ id: 'vacation' as Tab, label: t('tabs.vacation') }] : []),
    ...(supportsCalendar ? [{ id: 'calendar' as Tab, label: t('tabs.calendar') }] : []),
    ...(supportsSieve ? [{ id: 'filters' as Tab, label: t('tabs.filters') }] : []),
    { id: 'templates', label: t('tabs.templates') },
    { id: 'folders', label: t('tabs.folders') },
    { id: 'advanced', label: t('tabs.advanced') },
  ];

  return (
    <div className="flex h-screen bg-background">
      {/* Settings Sidebar */}
      <div className="w-64 border-r border-border bg-secondary flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/')}
            className="w-full justify-start"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('back_to_mail')}
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex-1 overflow-y-auto py-2">
          <div className="px-2 space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-md text-sm transition-colors duration-150',
                  activeTab === tab.id
                    ? 'bg-accent text-accent-foreground font-medium'
                    : 'hover:bg-muted text-foreground'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Settings Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-8">
          {/* Page Header */}
          <div className="mb-6">
            <div className="flex items-center gap-2.5 mb-2">
              <SettingsIcon className="w-6 h-6 text-muted-foreground" />
              <h1 className="text-2xl font-semibold text-foreground">{t('title')}</h1>
            </div>
          </div>

          {/* Active Tab Content */}
          <div className="bg-card border border-border rounded-lg p-6">
            {activeTab === 'appearance' && <AppearanceSettings />}
            {activeTab === 'email' && <EmailSettings />}
            {activeTab === 'account' && <AccountSettings />}
            {activeTab === 'identities' && <IdentitySettings />}
            {activeTab === 'vacation' && <VacationSettings />}
            {activeTab === 'calendar' && <CalendarSettings />}
            {activeTab === 'filters' && <FilterSettings />}
            {activeTab === 'templates' && <TemplateSettings />}
            {activeTab === 'folders' && <FolderSettings />}
            {activeTab === 'advanced' && <AdvancedSettings />}
          </div>
        </div>
      </div>
    </div>
  );
}
