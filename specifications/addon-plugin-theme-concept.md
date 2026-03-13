# Addons, Plugins & Themes — Architecture Concept

> **Status**: Draft Concept  
> **Date**: 2026-03-13

---

## Table of Contents

1. [Overview](#1-overview)
2. [Terminology](#2-terminology)
3. [Manifest Format](#3-manifest-format)
4. [Themes](#4-themes)
5. [Plugins](#5-plugins)
6. [Addon Lifecycle](#6-addon-lifecycle)
7. [Extension Points (Hooks & Slots)](#7-extension-points-hooks--slots)
8. [Security & Sandboxing](#8-security--sandboxing)
9. [Storage & Distribution](#9-storage--distribution)
10. [Settings Integration](#10-settings-integration)
11. [API Surface](#11-api-surface)
12. [Migration Path](#12-migration-path)

---

## 1. Overview

This document describes a system that allows the JMAP Webmail application to be extended through **themes** (visual customization) and **plugins** (functional extensions). Together, these are called **addons**.

### Design Goals

- **Safe by default** — addons cannot break core functionality or access data beyond their declared scope.
- **Zero-config for users** — install, enable, done. No code changes to the host app.
- **Declarative where possible** — prefer JSON/CSS-based customization over imperative code.
- **Aligned with existing architecture** — builds on Zustand stores, React context/providers, CSS variables, and the Next.js App Router patterns already in use.
- **Incrementally adoptable** — the core app can ship without any addons; the addon system is a layer on top.

### Non-Goals (for v1)

- Server-side plugin execution (all addons run client-side).
- A public addon marketplace (addons are self-hosted or bundled).
- Modifying JMAP protocol behavior (addons consume JMAP data, not intercept it).

---

## 2. Terminology

| Term | Definition |
|------|-----------|
| **Addon** | Any installable extension — umbrella term for themes and plugins. |
| **Theme** | An addon that only customizes visual appearance (colors, fonts, spacing, density). Ships as CSS + a manifest. Contains no executable code. |
| **Plugin** | An addon that adds or modifies functionality. Ships as a JS/TS module + a manifest. May include a theme. |
| **Slot** | A named insertion point in the UI where plugins can render components. |
| **Hook Point** | A named event or state transition where plugins can run logic. |
| **Manifest** | A `addon.json` file that declares metadata, permissions, and extension points. |

---

## 3. Manifest Format

Every addon has an `addon.json` at its root:

```jsonc
{
  // ── Identity ──
  "id": "com.example.my-addon",          // Reverse-domain unique ID
  "name": "My Addon",
  "version": "1.0.0",                    // Semver
  "description": "A brief description.",
  "author": {
    "name": "Jane Doe",
    "url": "https://example.com"
  },
  "license": "MIT",
  "homepage": "https://example.com/my-addon",

  // ── Compatibility ──
  "engine": {
    "webmail": ">=1.0.0"                 // Required host app version range
  },

  // ── Type ──
  "type": "plugin",                      // "theme" | "plugin"

  // ── Entry Points (plugins only) ──
  "main": "dist/index.js",              // Plugin entry module
  "styles": "dist/styles.css",          // Optional supplementary CSS

  // ── Theme Definition (themes, or plugins that include a theme) ──
  "theme": {
    "variables": "theme.css",            // CSS file with variable overrides
    "presets": ["light", "dark"],        // Which base modes it provides
    "preview": "preview.png"            // Screenshot for settings UI
  },

  // ── Permissions (plugins only) ──
  "permissions": [
    "emails:read",                       // Read email data from store
    "emails:write",                      // Modify email data (move, flag, etc.)
    "contacts:read",
    "calendar:read",
    "settings:read",
    "settings:write",
    "notifications",                     // Show toasts / browser notifications
    "compose:toolbar",                   // Add buttons to composer toolbar
    "sidebar:section",                   // Add sections to the sidebar
    "viewer:action",                     // Add actions to email viewer toolbar
    "navigation:tab",                    // Add a top-level navigation tab
    "context-menu:email",               // Extend email context menu
    "keyboard-shortcuts",               // Register keyboard shortcuts
    "external-fetch"                    // Fetch external URLs (declared origins)
  ],

  // ── External Origins (if external-fetch permission is declared) ──
  "allowedOrigins": [
    "https://api.example.com"
  ],

  // ── Slots (declares which UI slots the plugin uses) ──
  "slots": [
    "sidebar.bottom",
    "compose.toolbar",
    "viewer.actions"
  ],

  // ── Settings Schema (plugin-specific preferences) ──
  "settings": {
    "apiKey": {
      "type": "string",
      "label": "API Key",
      "description": "Your API key for the service.",
      "secret": true
    },
    "enabled": {
      "type": "boolean",
      "label": "Enable integration",
      "default": true
    }
  },

  // ── i18n ──
  "locales": "locales/"                  // Directory with {locale}.json files
}
```

---

## 4. Themes

Themes are the simplest addon type — pure CSS, no executable code.

### 4.1 How Themes Work

The app already uses CSS custom properties (variables) for all colors, defined in `globals.css` under `:root` and `.dark`. A theme overrides these variables:

```css
/* theme.css — "Nord" theme example */

:root[data-theme="com.example.nord"] {
  --color-background: #eceff4;
  --color-foreground: #2e3440;
  --color-primary: #5e81ac;
  --color-primary-foreground: #eceff4;
  --color-border: #d8dee9;
  --color-sidebar-bg: #e5e9f0;
  --color-sidebar-hover: #d8dee9;
  --color-muted: #4c566a;
  --color-accent: #88c0d0;
  --color-destructive: #bf616a;

  /* Extended variables for advanced customization */
  --font-family-base: "Inter", sans-serif;
  --font-family-mono: "JetBrains Mono", monospace;
  --radius-base: 8px;
  --spacing-density: 1;          /* 0.8 = compact, 1 = normal, 1.2 = comfortable */
  --shadow-elevation-1: 0 1px 3px rgba(0,0,0,0.08);
}

:root[data-theme="com.example.nord"].dark {
  --color-background: #2e3440;
  --color-foreground: #eceff4;
  --color-primary: #88c0d0;
  --color-border: #3b4252;
  --color-sidebar-bg: #3b4252;
  --color-sidebar-hover: #434c5e;
}
```

### 4.2 Theme Application

```
User selects theme in Settings → Appearance
  → ThemeStore sets `activeTheme: "com.example.nord"`
  → <html data-theme="com.example.nord" class="dark|light">
  → Theme CSS is loaded via a <link> tag with the theme's CSS file
  → CSS specificity ensures theme variables override defaults
```

### 4.3 Theme Capabilities

| Capability | Mechanism |
|-----------|-----------|
| Colors | Override `--color-*` CSS variables |
| Typography | Override `--font-family-*` variables |
| Spacing/density | Override `--spacing-density` multiplier |
| Border radius | Override `--radius-*` variables |
| Shadows | Override `--shadow-*` variables |
| Dark mode variant | Provide `.dark` overrides |
| Tag/label colors | Override `--tag-color-*` palette |
| Custom CSS | Additional rules scoped under `[data-theme="..."]` |

### 4.4 Theme Constraints

- Themes **cannot** add or remove DOM elements.
- Themes **cannot** execute JavaScript.
- Themes **cannot** override layout structure (flexbox directions, grid templates).
- Theme CSS is scoped by `[data-theme]` attribute — removing the attribute instantly reverts to defaults.
- A maximum CSS file size is enforced (e.g., 100 KB) to prevent abuse.

---

## 5. Plugins

Plugins are JavaScript modules that interact with the app through a controlled API.

### 5.1 Plugin Entry Point

A plugin exports a single `activate` function and optionally a `deactivate` function:

```ts
// index.ts — Plugin entry point
import type { PluginContext } from "@jmap-webmail/addon-api";

export function activate(ctx: PluginContext) {
  // Register a sidebar section
  ctx.slots.register("sidebar.bottom", {
    component: MySidebarWidget,
    priority: 10,
  });

  // Register a composer toolbar button
  ctx.slots.register("compose.toolbar", {
    component: EncryptButton,
    priority: 50,
  });

  // Listen to store changes
  ctx.hooks.on("email:selected", (email) => {
    // React to email selection
  });

  // Register a keyboard shortcut
  ctx.shortcuts.register({
    key: "g t",
    description: "Open translation panel",
    action: () => ctx.panels.open("translate"),
  });

  // Add a context menu item
  ctx.contextMenu.register("email", {
    label: ctx.i18n.t("translateEmail"),
    icon: "Languages",
    action: (emailId) => { /* ... */ },
  });
}

export function deactivate(ctx: PluginContext) {
  // Cleanup — called when the plugin is disabled or uninstalled.
  // All slot registrations and event subscriptions are
  // automatically cleaned up, so this is only needed
  // for external resource cleanup.
}
```

### 5.2 PluginContext API

The `PluginContext` object is the plugin's only interface to the host app. It is scoped and sandboxed based on the declared permissions:

```ts
interface PluginContext {
  /** Plugin metadata from manifest */
  manifest: AddonManifest;

  /** UI slot registration */
  slots: {
    register(slotId: string, registration: SlotRegistration): Disposable;
  };

  /** Event hooks */
  hooks: {
    on(event: HookEvent, handler: Function): Disposable;
    once(event: HookEvent, handler: Function): Disposable;
  };

  /** Store access (read-only or read-write based on permissions) */
  stores: {
    emails: PluginEmailStore;       // If emails:read or emails:write
    contacts: PluginContactStore;   // If contacts:read
    calendar: PluginCalendarStore;  // If calendar:read
    settings: PluginSettingsStore;  // If settings:read or settings:write
  };

  /** Plugin-specific settings (defined in manifest "settings" schema) */
  config: {
    get<T>(key: string): T;
    set(key: string, value: unknown): void;
    onChange(key: string, handler: (value: unknown) => void): Disposable;
  };

  /** Toast notifications */
  notifications: {
    success(message: string): void;
    error(message: string): void;
    info(message: string): void;
  };

  /** i18n — scoped to plugin's locale files */
  i18n: {
    t(key: string, params?: Record<string, string>): string;
    locale: string;
  };

  /** Keyboard shortcuts */
  shortcuts: {
    register(shortcut: ShortcutDefinition): Disposable;
  };

  /** Context menu extensions */
  contextMenu: {
    register(target: ContextMenuTarget, item: ContextMenuItem): Disposable;
  };

  /** Panel API — open side panels or modals */
  panels: {
    open(panelId: string, props?: Record<string, unknown>): void;
    close(panelId: string): void;
    register(panelId: string, component: React.ComponentType): Disposable;
  };

  /** Scoped fetch — only allowed origins from manifest */
  fetch(url: string, init?: RequestInit): Promise<Response>;
}
```

### 5.3 Disposable Pattern

All registrations return a `Disposable` object. On plugin deactivation, all disposables are automatically cleaned up:

```ts
interface Disposable {
  dispose(): void;
}
```

---

## 6. Addon Lifecycle

```
┌──────────────────────────────────────────────────────────┐
│                    Addon Lifecycle                        │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────┐   install    ┌───────────┐   enable         │
│  │  Store   │────────────▶│ Installed │──────────┐       │
│  │  / URL   │             │ (disabled) │          │       │
│  └─────────┘             └───────────┘          ▼       │
│                               ▲           ┌──────────┐  │
│                        disable│           │  Active  │  │
│                               │           │(running) │  │
│                               └───────────┤          │  │
│                                           └──────────┘  │
│                               │                ▲        │
│                        uninstall          update│        │
│                               │                │        │
│                               ▼           ┌────┴─────┐  │
│                          ┌────────┐       │ Updating │  │
│                          │Removed │       └──────────┘  │
│                          └────────┘                     │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 6.1 Loading Sequence

1. **Boot**: App starts, `AddonManager` reads the addon registry from `localStorage` (list of installed addons + enabled state).
2. **Resolve**: For each enabled addon, load its manifest and verify compatibility (`engine.webmail`).
3. **Load Themes**: Inject theme CSS `<link>` for the active theme.
4. **Load Plugins**: Dynamically import each plugin's `main` entry point.
5. **Activate**: Call `activate(ctx)` for each plugin, passing a scoped `PluginContext`.
6. **Ready**: Emit `app:ready` hook — plugins can now interact with stores.

### 6.2 Addon Manager Store

A new Zustand store manages addon state:

```ts
interface AddonManagerState {
  /** Registry of all installed addons */
  addons: Record<string, InstalledAddon>;

  /** Currently active theme ID (null = default) */
  activeTheme: string | null;

  /** Actions */
  installAddon(source: AddonSource): Promise<void>;
  uninstallAddon(id: string): void;
  enableAddon(id: string): void;
  disableAddon(id: string): void;
  setActiveTheme(id: string | null): void;
  getAddon(id: string): InstalledAddon | undefined;
  getEnabledPlugins(): InstalledAddon[];
}

interface InstalledAddon {
  manifest: AddonManifest;
  enabled: boolean;
  installedAt: string;        // ISO timestamp
  source: AddonSource;        // Where it was loaded from
  runtimeState: "inactive" | "active" | "error";
  error?: string;             // Last activation error
}

type AddonSource =
  | { type: "bundled" }                        // Shipped with the app
  | { type: "url"; url: string }               // Loaded from a URL
  | { type: "local"; path: string };           // Development: local file
```

---

## 7. Extension Points (Hooks & Slots)

### 7.1 UI Slots

Slots are named insertion points scattered across the UI. The host app renders a `<Slot>` component at each point; plugins register components into slots.

```tsx
// Host app — in sidebar.tsx
import { Slot } from "@/components/addons/slot";

function Sidebar() {
  return (
    <aside>
      {/* ... existing sidebar content ... */}
      <Slot name="sidebar.bottom" />
    </aside>
  );
}
```

```tsx
// Slot component implementation
function Slot({ name }: { name: string }) {
  const registrations = useAddonSlot(name);
  if (registrations.length === 0) return null;

  return (
    <>
      {registrations
        .sort((a, b) => a.priority - b.priority)
        .map((reg) => (
          <AddonErrorBoundary key={reg.addonId} addonId={reg.addonId}>
            <reg.component />
          </AddonErrorBoundary>
        ))}
    </>
  );
}
```

#### Available Slots

| Slot Name | Location | Use Case |
|-----------|----------|----------|
| `sidebar.top` | Top of sidebar, below compose button | Quick-access widgets |
| `sidebar.bottom` | Bottom of sidebar, above storage quota | Extra navigation, widgets |
| `navigation.tabs` | Navigation rail, below contacts icon | New top-level views |
| `compose.toolbar` | Composer toolbar (formatting bar) | Encrypt, translate, AI assist buttons |
| `compose.footer` | Below composer body, above send button | Send-time options (delay, schedule) |
| `viewer.actions` | Email viewer toolbar | Custom actions (translate, summarize) |
| `viewer.header` | Above email body in viewer | Banners, warnings, metadata |
| `viewer.footer` | Below email body in viewer | Related content, suggestions |
| `list.toolbar` | Above email list | Additional filters, bulk actions |
| `settings.sections` | Settings page, below existing sections | Plugin settings panels |
| `calendar.toolbar` | Calendar view toolbar | Calendar-specific actions |
| `contacts.toolbar` | Contacts view toolbar | Contact-specific actions |

### 7.2 Hook Events

Plugins can listen to app events and state transitions:

#### Email Hooks

| Event | Payload | Description |
|-------|---------|-------------|
| `email:selected` | `{ emailId, email }` | User selected an email |
| `email:opened` | `{ emailId, email }` | Email viewer rendered |
| `email:compose:open` | `{ mode, replyTo? }` | Composer opened |
| `email:compose:before-send` | `{ draft }` | Before sending — can modify draft |
| `email:compose:sent` | `{ emailId }` | Email sent successfully |
| `email:moved` | `{ emailId, from, to }` | Email moved between mailboxes |
| `email:deleted` | `{ emailId }` | Email deleted |
| `email:flagged` | `{ emailId, flags }` | Email flags changed |

#### Calendar Hooks

| Event | Payload | Description |
|-------|---------|-------------|
| `calendar:event:created` | `{ event }` | New event created |
| `calendar:event:updated` | `{ event, changes }` | Event modified |
| `calendar:event:deleted` | `{ eventId }` | Event deleted |
| `calendar:view:changed` | `{ view, date }` | Calendar view switched |

#### Contact Hooks

| Event | Payload | Description |
|-------|---------|-------------|
| `contact:selected` | `{ contactId }` | Contact selected |
| `contact:created` | `{ contact }` | New contact created |
| `contact:updated` | `{ contact }` | Contact modified |

#### App Hooks

| Event | Payload | Description |
|-------|---------|-------------|
| `app:ready` | `{}` | App fully loaded |
| `app:theme:changed` | `{ theme }` | Theme switched |
| `app:locale:changed` | `{ locale }` | Language changed |
| `app:navigation` | `{ from, to }` | User navigated between views |

---

## 8. Security & Sandboxing

### 8.1 Permission Model

Plugins declare required permissions in their manifest. On installation, the user sees a permission prompt:

```
"My Translation Plugin" requests:
  ✉️  Read your emails
  🔔  Show notifications
  🌐  Connect to https://api.translate.example.com

  [Allow]  [Cancel]
```

Permissions are enforced at the `PluginContext` level — if a plugin didn't declare `emails:read`, `ctx.stores.emails` is `undefined`.

### 8.2 Sandboxing Strategy

| Layer | Mechanism |
|-------|-----------|
| **Store access** | `PluginContext` exposes only permitted store slices. Write access returns proxied objects — mutations are validated before applying. |
| **DOM access** | Plugin components render inside an `<AddonErrorBoundary>`. They receive a scoped React tree — no direct `document` manipulation. |
| **Network** | `ctx.fetch()` is a controlled wrapper. Requests are only allowed to origins listed in `allowedOrigins`. All other `fetch` / `XMLHttpRequest` calls from plugin code are blocked via CSP headers. |
| **Storage** | Plugins use `ctx.config` (backed by a namespaced key in `localStorage`). No direct `localStorage` / `sessionStorage` access. |
| **Error isolation** | Each plugin slot is wrapped in an `AddonErrorBoundary`. A crashing plugin is caught and disabled without affecting the rest of the app. |
| **Resource limits** | Plugin CSS is limited to 100 KB. Plugin JS bundles are limited to 500 KB (configurable). |

### 8.3 Content Security Policy

Theme CSS is sanitized to disallow:
- `url()` references to external domains (only data URIs and same-origin).
- `@import` statements.
- `expression()` or `behavior:` (legacy IE attack vectors).

### 8.4 Error Boundary

```tsx
function AddonErrorBoundary({ addonId, children }) {
  return (
    <ErrorBoundary
      fallback={<AddonCrashedNotice addonId={addonId} />}
      onError={(error) => {
        console.error(`[Addon: ${addonId}] Crashed:`, error);
        addonManager.reportError(addonId, error);
        // Auto-disable after 3 crashes in 5 minutes
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
```

---

## 9. Storage & Distribution

### 9.1 Addon Formats

| Format | Description | Use Case |
|--------|-------------|----------|
| **Bundled** | Shipped inside the app's `/addons/` directory | Default themes, first-party plugins |
| **URL** | Loaded from a remote URL at runtime | Self-hosted or third-party addons |
| **Local file** | Loaded from a local path (dev mode only) | Plugin development |

### 9.2 Addon Bundle Structure

```
my-addon/
├── addon.json          # Manifest (required)
├── dist/
│   ├── index.js        # Plugin entry (plugins only)
│   └── styles.css      # Additional styles (optional)
├── theme.css           # Theme variables (themes only)
├── preview.png         # Theme preview image (optional)
└── locales/
    ├── en.json         # English strings
    ├── fr.json         # French strings
    └── ...
```

### 9.3 Built-in Addon Directory

```
addons/
├── themes/
│   ├── nord/
│   │   ├── addon.json
│   │   ├── theme.css
│   │   └── preview.png
│   ├── dracula/
│   ├── solarized/
│   ├── catppuccin/
│   └── high-contrast/
└── plugins/
    └── (none bundled by default)
```

### 9.4 Installation Flow

**From URL:**
1. User pastes addon URL into Settings → Addons → "Install from URL".
2. App fetches `{url}/addon.json`, validates schema and compatibility.
3. Manifest is stored in addon registry (`localStorage`).
4. On next activation, the addon's assets are fetched and cached.

**Bundled:**
1. Addons in `/addons/` are auto-discovered at build time.
2. A generated `addon-registry.json` maps addon IDs to their local paths.
3. Bundled addons appear pre-installed (but can be disabled).

---

## 10. Settings Integration

### 10.1 Addon Settings Page

A new page at `/settings/addons` integrates into the existing settings layout:

```
Settings
├── Appearance
├── Language & Region
├── Email
├── Composer
├── Calendar
├── Privacy & Security
├── Keyboard Shortcuts
├── Addons              ← NEW
│   ├── Themes
│   │   ├── Default (active)
│   │   ├── Nord
│   │   ├── Dracula
│   │   └── [Install Theme...]
│   ├── Plugins
│   │   ├── Translation Plugin (enabled) [Settings] [Disable]
│   │   ├── PGP Encryption (disabled) [Enable] [Uninstall]
│   │   └── [Install Plugin...]
│   └── Developer
│       └── [Load from local path...]
```

### 10.2 Plugin-Specific Settings

Plugins declare their settings schema in `addon.json`. The app auto-generates a settings UI:

```jsonc
// In addon.json
"settings": {
  "provider": {
    "type": "select",
    "label": "Translation Provider",
    "options": [
      { "value": "deepl", "label": "DeepL" },
      { "value": "google", "label": "Google Translate" }
    ],
    "default": "deepl"
  },
  "targetLanguage": {
    "type": "select",
    "label": "Default Target Language",
    "options": "locales",              // Special: populated from app locales
    "default": "en"
  },
  "autoTranslate": {
    "type": "boolean",
    "label": "Auto-translate foreign emails",
    "default": false
  }
}
```

Supported setting types: `string`, `boolean`, `number`, `select`, `multiselect`, `color`, `secret` (masked input).

### 10.3 Theme Selector

The existing Appearance settings page gains a theme gallery:

```
Appearance
├── Theme: [Default ▾]    ← dropdown with installed themes
│   Preview: [████████████████]  ← live color preview strip
├── Mode: Light / Dark / System
├── Font Size: Small / Medium / Large
└── ...
```

When a theme is selected, the app:
1. Sets `data-theme` attribute on `<html>`.
2. Loads the theme's CSS file.
3. Persists the choice in `ThemeStore`.

---

## 11. API Surface

### 11.1 Core Registry (`AddonRegistry`)

```ts
class AddonRegistry {
  /** Register a slot for plugin component injection */
  defineSlot(name: string, options?: SlotOptions): void;

  /** Get all registrations for a slot */
  getSlotRegistrations(name: string): SlotRegistration[];

  /** Subscribe to slot changes (for reactive rendering) */
  onSlotChange(name: string, cb: () => void): Disposable;

  /** Emit a hook event to all listening plugins */
  emitHook(event: string, payload: unknown): void;

  /** Emit a hook event that plugins can modify (pipeline) */
  emitHookPipeline<T>(event: string, value: T): T;
}
```

### 11.2 Hook Pipeline (Interceptors)

Some hooks allow plugins to transform data flowing through them. For example, `email:compose:before-send` lets plugins modify the draft before it's sent:

```ts
// Plugin: auto-add disclaimer
ctx.hooks.on("email:compose:before-send", (draft) => {
  return {
    ...draft,
    htmlBody: draft.htmlBody + "<p>Sent from JMAP Webmail</p>",
  };
});
```

Pipeline hooks execute in priority order. If any handler throws, the pipeline is aborted and the action is cancelled (with a notification to the user).

### 11.3 React Hooks for Addon Developers

```ts
// Available inside plugin components:

/** Access the plugin's scoped context */
usePluginContext(): PluginContext;

/** Access plugin-specific settings (reactive) */
usePluginConfig<T>(key: string): [T, (value: T) => void];

/** Access plugin's i18n */
usePluginI18n(): { t: (key: string, params?: Record<string, string>) => string };

/** Access host app theme info */
useHostTheme(): { mode: "light" | "dark"; resolvedMode: "light" | "dark" };
```

---

## 12. Migration Path

### Phase 1: Foundation

- [ ] Define the complete `addon.json` schema with JSON Schema validation.
- [ ] Create the `AddonManagerStore` (Zustand store for managing installed addons).
- [ ] Extend `ThemeStore` with `activeTheme` and `data-theme` attribute management.
- [ ] Implement CSS variable injection for themes.
- [ ] Add 3–5 bundled themes (Nord, Dracula, Solarized, Catppuccin, High Contrast).
- [ ] Add the theme selector to Settings → Appearance.

### Phase 2: Plugin Infrastructure

- [ ] Implement the `<Slot>` component and `AddonErrorBoundary`.
- [ ] Add `<Slot>` insertion points to the 12 defined locations in the UI.
- [ ] Build the `PluginContext` factory with permission-gated store access.
- [ ] Implement the hook event system (`emitHook`, `emitHookPipeline`).
- [ ] Create the Settings → Addons page with install/enable/disable/uninstall UI.
- [ ] Implement auto-generated settings UI from plugin settings schema.

### Phase 3: Developer Experience

- [ ] Create `@jmap-webmail/addon-api` — TypeScript type definitions package.
- [ ] Create `create-jmap-addon` CLI scaffolding tool.
- [ ] Write addon developer documentation with examples.
- [ ] Build a sample plugin (e.g., email translation) as a reference.
- [ ] Add dev mode: hot-reload addons from local filesystem.

### Phase 4: Hardening

- [ ] Security audit of the sandboxing layer.
- [ ] CSP header configuration for addon CSS/JS.
- [ ] Rate limiting for hook events (prevent infinite loops).
- [ ] Performance budgets: measure and enforce bundle size + render time limits.
- [ ] Auto-disable addons that crash repeatedly.

---

## Appendix: Example Addons

### A. Theme: "Nord"

```
nord-theme/
├── addon.json
├── theme.css
└── preview.png
```

`addon.json`:
```json
{
  "id": "org.nordtheme.jmap-webmail",
  "name": "Nord",
  "version": "1.0.0",
  "type": "theme",
  "description": "An arctic, north-bluish color palette.",
  "author": { "name": "Arctic Ice Studio" },
  "license": "MIT",
  "engine": { "webmail": ">=1.0.0" },
  "theme": {
    "variables": "theme.css",
    "presets": ["light", "dark"],
    "preview": "preview.png"
  }
}
```

### B. Plugin: "Email Translator"

```
email-translator/
├── addon.json
├── dist/
│   └── index.js
└── locales/
    ├── en.json
    └── fr.json
```

`addon.json`:
```json
{
  "id": "com.example.email-translator",
  "name": "Email Translator",
  "version": "1.0.0",
  "type": "plugin",
  "description": "Translate emails with one click.",
  "author": { "name": "JMAP Community" },
  "license": "MIT",
  "engine": { "webmail": ">=1.0.0" },
  "main": "dist/index.js",
  "permissions": [
    "emails:read",
    "notifications",
    "viewer:action",
    "external-fetch"
  ],
  "allowedOrigins": ["https://api.deepl.com"],
  "slots": ["viewer.actions"],
  "settings": {
    "apiKey": {
      "type": "secret",
      "label": "DeepL API Key"
    },
    "targetLanguage": {
      "type": "select",
      "label": "Target Language",
      "options": "locales",
      "default": "en"
    }
  },
  "locales": "locales/"
}
```

### C. Plugin: "Send Later"

Adds a "Schedule Send" button to the composer:

```ts
export function activate(ctx: PluginContext) {
  ctx.slots.register("compose.footer", {
    component: ScheduleSendPicker,
    priority: 10,
  });

  ctx.hooks.on("email:compose:before-send", (draft) => {
    const scheduledTime = ctx.config.get<string>("pendingSchedule");
    if (scheduledTime) {
      // Store the scheduled time — the host app handles deferred sending
      return { ...draft, deliverAt: scheduledTime };
    }
    return draft;
  });
}
```

---

## Open Questions

1. **Should plugins be able to define new routes (pages)?** Adding full pages (e.g., `/addons/my-plugin/dashboard`) would require deeper Next.js integration. Could use a `navigation:tab` slot that renders a full-pane view instead.

2. **Web Worker isolation?** Running plugin JS in a Web Worker would provide stronger isolation but prevents direct React rendering. A message-passing bridge is possible but adds complexity. Probably not worth it for v1.

3. **Server-side plugins?** Some use cases (email filtering, webhook integrations) need server execution. This is out of scope for v1 but could be explored as Sieve filter generation or JMAP push notification handlers.

4. **Addon signing?** For URL-installed addons, a signature verification system would prevent tampering. Worth considering for v2.

5. **Shared dependencies?** Should plugins be able to declare peer dependencies on the host app's packages (React, date-fns, Lucide icons)? This would reduce bundle sizes but creates coupling. Recommend providing these as globals via the plugin runtime.
