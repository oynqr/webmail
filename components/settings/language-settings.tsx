"use client";

import { useTranslations } from 'next-intl';
import { LanguageSwitcher } from '@/components/ui/language-switcher';
import { SettingsSection, SettingItem } from './settings-section';

export function LanguageSettings() {
  const t = useTranslations('settings.appearance');

  return (
    <SettingsSection title={t('language.label')} description={t('language.description')}>
      <SettingItem label={t('language.label')} description={t('language.description')}>
        <LanguageSwitcher />
      </SettingItem>
    </SettingsSection>
  );
}
