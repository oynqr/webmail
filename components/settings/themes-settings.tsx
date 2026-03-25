'use client';

import { useState, useRef, useEffect } from 'react';
import { useThemeStore } from '@/stores/theme-store';
import { SettingsSection, SettingItem } from './settings-section';
import { cn } from '@/lib/utils';
import { Upload, Trash2, Check, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/stores/toast-store';
import type { InstalledTheme } from '@/lib/plugin-types';
import { usePolicyStore } from '@/stores/policy-store';

export function ThemesSettings() {
  const { installedThemes, activeThemeId, installTheme, uninstallTheme, activateTheme } = useThemeStore();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isFeatureEnabled, isThemeDisabled, getThemePolicy } = usePolicyStore();
  const canUpload = isFeatureEnabled('userThemesEnabled');
  const themePolicy = getThemePolicy();

  // Filter out themes disabled by admin policy
  const visibleThemes = installedThemes.filter(
    theme => !isThemeDisabled(theme.id, !!theme.builtIn)
  );

  // If the active theme was disabled by admin, fall back to default
  useEffect(() => {
    if (activeThemeId) {
      const activeTheme = installedThemes.find(t => t.id === activeThemeId);
      if (activeTheme && isThemeDisabled(activeThemeId, !!activeTheme.builtIn)) {
        activateTheme(null);
      }
    }
  }, [activeThemeId, installedThemes, isThemeDisabled, activateTheme]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const result = await installTheme(file);
      if (result.success) {
        toast.success('Theme installed');
        if (result.warnings?.length) {
          toast.warning('Theme warnings', { message: result.warnings.join('\n') });
        }
      } else {
        toast.error('Theme installation failed', { message: result.error });
      }
    } catch (err) {
      toast.error('Theme installation failed', { message: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleActivate = (id: string | null) => {
    activateTheme(id);
    toast.success(id ? 'Theme activated' : 'Default theme restored');
  };

  const handleUninstall = (theme: InstalledTheme) => {
    if (theme.builtIn) return;
    uninstallTheme(theme.id);
    toast.success('Theme removed');
  };

  return (
    <SettingsSection title="Themes" description="Customize the appearance with color themes. Upload .zip theme files or activate built-in presets." experimental experimentalDescription="Themes is an experimental feature. Custom themes may not cover all UI elements, and theme formats could change in future updates. Built-in presets are stable, but uploaded themes may require updates after application upgrades.">

      {/* Theme Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {/* Default theme card */}
        <ThemeCard
          name="Default"
          author="Bulwark"
          isActive={activeThemeId === null}
          isBuiltIn
          isDefault={!themePolicy.defaultThemeId}
          onActivate={() => handleActivate(null)}
        />

        {/* Installed themes */}
        {visibleThemes.map(theme => (
          <ThemeCard
            key={theme.id}
            name={theme.name}
            author={theme.author}
            preview={theme.preview}
            isActive={activeThemeId === theme.id}
            isBuiltIn={theme.builtIn}
            isDefault={themePolicy.defaultThemeId === theme.id}
            variants={theme.variants}
            onActivate={() => handleActivate(theme.id)}
            onRemove={!theme.builtIn ? () => handleUninstall(theme) : undefined}
          />
        ))}
      </div>

      {/* Upload */}
      {canUpload && (
      <SettingItem label="Upload Theme" description="Install a custom theme from a .zip file containing manifest.json and theme.css">
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip"
          onChange={handleUpload}
          className="hidden"
          aria-label="Upload theme file"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          <Upload className="w-4 h-4 mr-1.5" />
          {isUploading ? 'Installing...' : 'Upload .zip'}
        </Button>
      </SettingItem>
      )}
    </SettingsSection>
  );
}

// ─── Theme Card ──────────────────────────────────────────────

interface ThemeCardProps {
  name: string;
  author: string;
  preview?: string;
  isActive: boolean;
  isBuiltIn: boolean;
  isDefault?: boolean;
  variants?: ('light' | 'dark')[];
  onActivate: () => void;
  onRemove?: () => void;
}

function ThemeCard({ name, author, preview, isActive, isDefault, variants, onActivate, onRemove }: ThemeCardProps) {
  return (
    <button
      onClick={onActivate}
      className={cn(
        'relative flex flex-col items-center p-3 rounded-xl border-2 transition-all text-left w-full',
        isActive
          ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
          : 'border-border hover:border-primary/40 bg-card'
      )}
    >
      {/* Preview / Placeholder */}
      <div className="w-full aspect-[16/10] rounded-lg mb-2 overflow-hidden bg-muted flex items-center justify-center">
        {preview ? (
          <img src={preview} alt={name} className="w-full h-full object-cover" />
        ) : (
          <Palette className="w-8 h-8 text-muted-foreground/40" />
        )}
      </div>

      {/* Info */}
      <div className="w-full">
        <div className="flex items-center justify-between gap-1">
          <span className="text-sm font-medium text-foreground truncate">{name}</span>
          <div className="flex items-center gap-1 flex-shrink-0">
            {isDefault && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">Default</span>
            )}
            {isActive && <Check className="w-4 h-4 text-primary" />}
          </div>
        </div>
        <span className="text-xs text-muted-foreground truncate block">{author}</span>
        {variants && (
          <div className="flex gap-1 mt-1">
            {variants.map(v => (
              <span key={v} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                {v}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Remove button */}
      {onRemove && !isActive && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="absolute top-2 right-2 p-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
          title="Remove theme"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </button>
  );
}
