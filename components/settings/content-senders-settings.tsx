"use client";

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSettingsStore } from '@/stores/settings-store';
import { SettingsSection, SettingItem, Select, ToggleSwitch } from './settings-section';
import { TrustedSendersModal } from '@/components/trusted-senders-modal';
import { ChevronRight } from 'lucide-react';
import { usePolicyStore } from '@/stores/policy-store';
import { useContactStore } from '@/stores/contact-store';

export function ContentSendersSettings() {
  const t = useTranslations('settings.email_behavior');
  const [showTrustedModal, setShowTrustedModal] = useState(false);
  const { isSettingLocked, isSettingHidden } = usePolicyStore();

  const {
    externalContentPolicy,
    emailAlwaysLightMode,
    trustedSenders,
    trustedSendersAddressBook,
    updateSetting,
  } = useSettingsStore();
  const { trustedSenderEmails } = useContactStore();

  const getTrustedSendersCount = () => {
    const count = trustedSendersAddressBook ? trustedSenderEmails.length : trustedSenders.length;
    if (count === 0) return t('trusted_senders.count_zero');
    if (count === 1) return t('trusted_senders.count_one');
    return t('trusted_senders.count_other', { count });
  };

  return (
    <SettingsSection title={t('title')} description={t('description')}>
      {!isSettingHidden('externalContentPolicy') && (
      <SettingItem label={t('external_content.label')} description={t('external_content.description')} locked={isSettingLocked('externalContentPolicy')}>
        <Select
          value={externalContentPolicy}
          onChange={(value) =>
            updateSetting('externalContentPolicy', value as 'ask' | 'block' | 'allow')
          }
          options={[
            { value: 'ask', label: t('external_content.ask') },
            { value: 'block', label: t('external_content.block') },
            { value: 'allow', label: t('external_content.allow') },
          ]}
        />
      </SettingItem>
      )}

      <SettingItem label={t('always_light_mode.label')} description={t('always_light_mode.description')}>
        <ToggleSwitch
          checked={emailAlwaysLightMode}
          onChange={(checked) => updateSetting('emailAlwaysLightMode', checked)}
        />
      </SettingItem>

      <SettingItem label={t('trusted_senders.label')} description={t('trusted_senders.description')}>
        <button
          onClick={() => setShowTrustedModal(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-muted hover:bg-accent rounded-md transition-colors"
        >
          <span className="text-sm text-foreground">{getTrustedSendersCount()}</span>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
      </SettingItem>

      <SettingItem label={t('trusted_senders.use_address_book_label')} description={t('trusted_senders.use_address_book_description')}>
        <ToggleSwitch
          checked={trustedSendersAddressBook}
          onChange={(checked) => updateSetting('trustedSendersAddressBook', checked)}
        />
      </SettingItem>

      <TrustedSendersModal
        isOpen={showTrustedModal}
        onClose={() => setShowTrustedModal(false)}
      />
    </SettingsSection>
  );
}
