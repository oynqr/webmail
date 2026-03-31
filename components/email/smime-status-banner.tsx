"use client";

import React from "react";
import { ShieldCheck, ShieldAlert, ShieldX, Lock, LockOpen, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import type { SmimeStatus } from "@/lib/smime/types";

interface SmimeStatusBannerProps {
  status: SmimeStatus;
  onUnlockKey?: () => void;
  className?: string;
}

export function SmimeStatusBanner({ status, onUnlockKey, className }: SmimeStatusBannerProps) {
  const t = useTranslations('smime');

  const items: Array<{
    icon: React.ReactNode;
    text: string;
    variant: 'success' | 'warning' | 'error' | 'info';
  }> = [];

  // Encryption status
  if (status.isEncrypted) {
    if (status.decryptionError) {
      if (status.decryptionError === 'locked') {
        items.push({
          icon: <Lock className="w-4 h-4" />,
          text: t('unlock_key_desc'),
          variant: 'warning',
        });
      } else if (status.decryptionError === 'no-key') {
        items.push({
          icon: <Lock className="w-4 h-4" />,
          text: t('status_encrypted_no_key'),
          variant: 'warning',
        });
      } else {
        items.push({
          icon: <ShieldX className="w-4 h-4" />,
          text: t('status_encrypted_failed'),
          variant: 'error',
        });
      }
    } else {
      items.push({
        icon: <LockOpen className="w-4 h-4" />,
        text: t('status_encrypted_ok'),
        variant: 'success',
      });
    }
  }

  // Signature status
  if (status.isSigned) {
    if (status.signatureValid === true) {
      if (status.selfSigned) {
        items.push({
          icon: <AlertTriangle className="w-4 h-4" />,
          text: t('status_signed_self_signed'),
          variant: 'warning',
        });
      } else if (status.signerEmailMatch === false) {
        items.push({
          icon: <AlertTriangle className="w-4 h-4" />,
          text: t('status_signed_mismatch'),
          variant: 'warning',
        });
      } else {
        items.push({
          icon: <ShieldCheck className="w-4 h-4" />,
          text: t('status_signed_valid'),
          variant: 'success',
        });
      }
    } else if (status.signatureValid === false) {
      items.push({
        icon: <ShieldAlert className="w-4 h-4" />,
        text: status.signatureError || t('status_signed_invalid'),
        variant: 'error',
      });
    }
  }

  // Unsupported S/MIME
  if (status.unsupportedReason) {
    items.push({
      icon: <Info className="w-4 h-4" />,
      text: t('status_unsupported'),
      variant: 'info',
    });
  }

  if (items.length === 0) return null;

  const variantStyles = {
    success: 'bg-success/10 text-success border-success/30',
    warning: 'bg-warning/10 text-warning border-warning/30',
    error: 'bg-destructive/10 text-destructive border-destructive/30',
    info: 'bg-info/10 text-info border-info/30',
  };

  return (
    <div className={cn("flex flex-col gap-1.5 py-1", className)}>
      {items.map((item, i) => (
        <div
          key={i}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm border",
            variantStyles[item.variant],
          )}
        >
          {item.icon}
          <span className="flex-1">{item.text}</span>
          {item.variant === 'warning' && status.decryptionError === 'locked' && onUnlockKey && (
            <button
              onClick={onUnlockKey}
              className="text-xs font-medium underline hover:no-underline"
            >
              {t('unlock_key')}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
