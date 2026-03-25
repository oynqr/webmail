import type { InstalledTheme } from './plugin-types';

const quiCSS = `
:root {
  --color-border: #e4e4e7;
  --color-input: #e4e4e7;
  --color-ring: #3b82f6;
  --color-background: #ffffff;
  --color-foreground: #09090b;
  --color-primary: #3b82f6;
  --color-primary-foreground: #ffffff;
  --color-secondary: #f4f4f5;
  --color-secondary-foreground: #18181b;
  --color-muted: #f4f4f5;
  --color-muted-foreground: #71717a;
  --color-accent: #dbeafe;
  --color-accent-foreground: #1d4ed8;
  --color-destructive: #ef4444;
  --color-destructive-foreground: #ffffff;
  --color-popover: #ffffff;
  --color-popover-foreground: #09090b;
  --color-sidebar: #fafafa;
  --color-sidebar-foreground: #09090b;
  --color-sidebar-border: #e4e4e7;
  --color-sidebar-accent: #f4f4f5;
  --color-sidebar-accent-foreground: #18181b;
  --color-card: #ffffff;
  --color-card-foreground: #09090b;
  --color-success: #22c55e;
  --color-success-foreground: #ffffff;
  --color-warning: #eab308;
  --color-warning-foreground: #ffffff;
  --color-info: #3b82f6;
  --color-info-foreground: #ffffff;
  --color-selection: #dbeafe;
  --color-selection-foreground: #1d4ed8;
  --color-unread: #3b82f6;
  --color-chart-1: #3b82f6;
  --color-chart-2: #22c55e;
  --color-chart-3: #f59e0b;
  --color-chart-4: #ef4444;
  --color-chart-5: #8b5cf6;
}
.dark {
  --color-border: #27272a;
  --color-input: #27272a;
  --color-ring: #3b82f6;
  --color-background: #09090b;
  --color-foreground: #fafafa;
  --color-primary: #3b82f6;
  --color-primary-foreground: #ffffff;
  --color-secondary: #18181b;
  --color-secondary-foreground: #fafafa;
  --color-muted: #18181b;
  --color-muted-foreground: #a1a1aa;
  --color-accent: #172554;
  --color-accent-foreground: #93c5fd;
  --color-destructive: #ef4444;
  --color-destructive-foreground: #fafafa;
  --color-popover: #18181b;
  --color-popover-foreground: #fafafa;
  --color-sidebar: #09090b;
  --color-sidebar-foreground: #fafafa;
  --color-sidebar-border: #27272a;
  --color-sidebar-accent: #18181b;
  --color-sidebar-accent-foreground: #fafafa;
  --color-card: #141414;
  --color-card-foreground: #fafafa;
  --color-success: #16a34a;
  --color-success-foreground: #ffffff;
  --color-warning: #ca8a04;
  --color-warning-foreground: #ffffff;
  --color-info: #60a5fa;
  --color-info-foreground: #ffffff;
  --color-selection: rgba(59, 130, 246, 0.25);
  --color-selection-foreground: #93c5fd;
  --color-unread: #60a5fa;
  --color-chart-1: #60a5fa;
  --color-chart-2: #4ade80;
  --color-chart-3: #fbbf24;
  --color-chart-4: #f87171;
  --color-chart-5: #a78bfa;
}`;

const nordCSS = `
:root {
  --color-border: #d8dee9;
  --color-input: #d8dee9;
  --color-ring: #81a1c1;
  --color-background: #eceff4;
  --color-foreground: #2e3440;
  --color-primary: #5e81ac;
  --color-primary-foreground: #eceff4;
  --color-secondary: #e5e9f0;
  --color-secondary-foreground: #2e3440;
  --color-muted: #d8dee9;
  --color-muted-foreground: #4c566a;
  --color-accent: #81a1c1;
  --color-accent-foreground: #2e3440;
  --color-destructive: #bf616a;
  --color-destructive-foreground: #eceff4;
  --color-popover: #eceff4;
  --color-popover-foreground: #2e3440;
  --color-sidebar: #e5e9f0;
  --color-sidebar-foreground: #2e3440;
  --color-sidebar-border: #d8dee9;
  --color-sidebar-accent: #d8dee9;
  --color-sidebar-accent-foreground: #2e3440;
  --color-card: #eceff4;
  --color-card-foreground: #2e3440;
  --color-success: #a3be8c;
  --color-success-foreground: #2e3440;
  --color-warning: #ebcb8b;
  --color-warning-foreground: #2e3440;
  --color-info: #81a1c1;
  --color-info-foreground: #eceff4;
  --color-selection: #d8dee9;
  --color-selection-foreground: #5e81ac;
  --color-unread: #5e81ac;
  --color-chart-1: #5e81ac;
  --color-chart-2: #a3be8c;
  --color-chart-3: #ebcb8b;
  --color-chart-4: #bf616a;
  --color-chart-5: #b48ead;
}
.dark {
  --color-border: #3b4252;
  --color-input: #3b4252;
  --color-ring: #88c0d0;
  --color-background: #2e3440;
  --color-foreground: #eceff4;
  --color-primary: #88c0d0;
  --color-primary-foreground: #2e3440;
  --color-secondary: #3b4252;
  --color-secondary-foreground: #eceff4;
  --color-muted: #3b4252;
  --color-muted-foreground: #d8dee9;
  --color-accent: #434c5e;
  --color-accent-foreground: #88c0d0;
  --color-destructive: #bf616a;
  --color-destructive-foreground: #eceff4;
  --color-popover: #3b4252;
  --color-popover-foreground: #eceff4;
  --color-sidebar: #2e3440;
  --color-sidebar-foreground: #eceff4;
  --color-sidebar-border: #3b4252;
  --color-sidebar-accent: #3b4252;
  --color-sidebar-accent-foreground: #eceff4;
  --color-card: #3b4252;
  --color-card-foreground: #eceff4;
  --color-success: #a3be8c;
  --color-success-foreground: #2e3440;
  --color-warning: #ebcb8b;
  --color-warning-foreground: #2e3440;
  --color-info: #88c0d0;
  --color-info-foreground: #2e3440;
  --color-selection: rgba(136, 192, 208, 0.2);
  --color-selection-foreground: #88c0d0;
  --color-unread: #88c0d0;
  --color-chart-1: #88c0d0;
  --color-chart-2: #a3be8c;
  --color-chart-3: #ebcb8b;
  --color-chart-4: #bf616a;
  --color-chart-5: #b48ead;
}`;

const catppuccinCSS = `
:root {
  --color-border: #ccd0da;
  --color-input: #ccd0da;
  --color-ring: #8839ef;
  --color-background: #eff1f5;
  --color-foreground: #4c4f69;
  --color-primary: #8839ef;
  --color-primary-foreground: #eff1f5;
  --color-secondary: #e6e9ef;
  --color-secondary-foreground: #4c4f69;
  --color-muted: #dce0e8;
  --color-muted-foreground: #6c6f85;
  --color-accent: #8839ef;
  --color-accent-foreground: #eff1f5;
  --color-destructive: #d20f39;
  --color-destructive-foreground: #eff1f5;
  --color-popover: #eff1f5;
  --color-popover-foreground: #4c4f69;
  --color-sidebar: #e6e9ef;
  --color-sidebar-foreground: #4c4f69;
  --color-sidebar-border: #ccd0da;
  --color-sidebar-accent: #dce0e8;
  --color-sidebar-accent-foreground: #4c4f69;
  --color-card: #eff1f5;
  --color-card-foreground: #4c4f69;
  --color-success: #40a02b;
  --color-success-foreground: #eff1f5;
  --color-warning: #df8e1d;
  --color-warning-foreground: #eff1f5;
  --color-info: #1e66f5;
  --color-info-foreground: #eff1f5;
  --color-selection: #dce0e8;
  --color-selection-foreground: #8839ef;
  --color-unread: #8839ef;
  --color-chart-1: #8839ef;
  --color-chart-2: #40a02b;
  --color-chart-3: #df8e1d;
  --color-chart-4: #d20f39;
  --color-chart-5: #1e66f5;
}
.dark {
  --color-border: #45475a;
  --color-input: #45475a;
  --color-ring: #cba6f7;
  --color-background: #1e1e2e;
  --color-foreground: #cdd6f4;
  --color-primary: #cba6f7;
  --color-primary-foreground: #1e1e2e;
  --color-secondary: #313244;
  --color-secondary-foreground: #cdd6f4;
  --color-muted: #313244;
  --color-muted-foreground: #a6adc8;
  --color-accent: #45475a;
  --color-accent-foreground: #cba6f7;
  --color-destructive: #f38ba8;
  --color-destructive-foreground: #1e1e2e;
  --color-popover: #313244;
  --color-popover-foreground: #cdd6f4;
  --color-sidebar: #1e1e2e;
  --color-sidebar-foreground: #cdd6f4;
  --color-sidebar-border: #45475a;
  --color-sidebar-accent: #313244;
  --color-sidebar-accent-foreground: #cdd6f4;
  --color-card: #313244;
  --color-card-foreground: #cdd6f4;
  --color-success: #a6e3a1;
  --color-success-foreground: #1e1e2e;
  --color-warning: #f9e2af;
  --color-warning-foreground: #1e1e2e;
  --color-info: #89b4fa;
  --color-info-foreground: #1e1e2e;
  --color-selection: rgba(203, 166, 247, 0.2);
  --color-selection-foreground: #cba6f7;
  --color-unread: #cba6f7;
  --color-chart-1: #cba6f7;
  --color-chart-2: #a6e3a1;
  --color-chart-3: #f9e2af;
  --color-chart-4: #f38ba8;
  --color-chart-5: #89b4fa;
}`;

const solarizedCSS = `
:root {
  --color-border: #eee8d5;
  --color-input: #eee8d5;
  --color-ring: #268bd2;
  --color-background: #fdf6e3;
  --color-foreground: #657b83;
  --color-primary: #268bd2;
  --color-primary-foreground: #fdf6e3;
  --color-secondary: #eee8d5;
  --color-secondary-foreground: #586e75;
  --color-muted: #eee8d5;
  --color-muted-foreground: #93a1a1;
  --color-accent: #268bd2;
  --color-accent-foreground: #fdf6e3;
  --color-destructive: #dc322f;
  --color-destructive-foreground: #fdf6e3;
  --color-popover: #fdf6e3;
  --color-popover-foreground: #657b83;
  --color-sidebar: #eee8d5;
  --color-sidebar-foreground: #657b83;
  --color-sidebar-border: #eee8d5;
  --color-sidebar-accent: #eee8d5;
  --color-sidebar-accent-foreground: #586e75;
  --color-card: #fdf6e3;
  --color-card-foreground: #657b83;
  --color-success: #859900;
  --color-success-foreground: #fdf6e3;
  --color-warning: #b58900;
  --color-warning-foreground: #fdf6e3;
  --color-info: #268bd2;
  --color-info-foreground: #fdf6e3;
  --color-selection: #eee8d5;
  --color-selection-foreground: #268bd2;
  --color-unread: #268bd2;
  --color-chart-1: #268bd2;
  --color-chart-2: #859900;
  --color-chart-3: #b58900;
  --color-chart-4: #dc322f;
  --color-chart-5: #6c71c4;
}
.dark {
  --color-border: #073642;
  --color-input: #073642;
  --color-ring: #268bd2;
  --color-background: #002b36;
  --color-foreground: #839496;
  --color-primary: #268bd2;
  --color-primary-foreground: #002b36;
  --color-secondary: #073642;
  --color-secondary-foreground: #93a1a1;
  --color-muted: #073642;
  --color-muted-foreground: #586e75;
  --color-accent: #073642;
  --color-accent-foreground: #268bd2;
  --color-destructive: #dc322f;
  --color-destructive-foreground: #fdf6e3;
  --color-popover: #073642;
  --color-popover-foreground: #93a1a1;
  --color-sidebar: #002b36;
  --color-sidebar-foreground: #839496;
  --color-sidebar-border: #073642;
  --color-sidebar-accent: #073642;
  --color-sidebar-accent-foreground: #93a1a1;
  --color-card: #073642;
  --color-card-foreground: #93a1a1;
  --color-success: #859900;
  --color-success-foreground: #002b36;
  --color-warning: #b58900;
  --color-warning-foreground: #002b36;
  --color-info: #268bd2;
  --color-info-foreground: #002b36;
  --color-selection: rgba(38, 139, 210, 0.2);
  --color-selection-foreground: #268bd2;
  --color-unread: #268bd2;
  --color-chart-1: #268bd2;
  --color-chart-2: #859900;
  --color-chart-3: #b58900;
  --color-chart-4: #dc322f;
  --color-chart-5: #6c71c4;
}`;

export const BUILTIN_THEMES: InstalledTheme[] = [
  {
    id: 'builtin-qui',
    name: 'Qui',
    version: '1.0.0',
    author: 'Built-in',
    description: 'Clean, modern zinc-and-blue theme inspired by autobrr/qui',
    css: quiCSS,
    variants: ['light', 'dark'],
    enabled: true,
    builtIn: true,
  },
  {
    id: 'builtin-nord',
    name: 'Nord',
    version: '1.0.0',
    author: 'Built-in',
    description: 'Arctic, north-bluish color palette inspired by nordtheme.com',
    css: nordCSS,
    variants: ['light', 'dark'],
    enabled: true,
    builtIn: true,
  },
  {
    id: 'builtin-catppuccin',
    name: 'Catppuccin',
    version: '1.0.0',
    author: 'Built-in',
    description: 'Soothing pastel theme with Latte (light) and Mocha (dark) variants',
    css: catppuccinCSS,
    variants: ['light', 'dark'],
    enabled: true,
    builtIn: true,
  },
  {
    id: 'builtin-solarized',
    name: 'Solarized',
    version: '1.0.0',
    author: 'Built-in',
    description: 'Precision colors for machines and people by Ethan Schoonover',
    css: solarizedCSS,
    variants: ['light', 'dark'],
    enabled: true,
    builtIn: true,
  },
];
