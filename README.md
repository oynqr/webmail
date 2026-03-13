<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/branding/Bulwark Logo with Lettering White and Color.svg" />
  <source media="(prefers-color-scheme: light)" srcset="public/branding/Bulwark Logo with Lettering Dark Color.svg" />
  <img src="public/branding/Bulwark Logo with Lettering Dark Color.svg" alt="Bulwark Webmail" width="280" />
</picture>

# Bulwark Webmail

A modern, self-hosted webmail client for [Stalwart Mail Server](https://stalw.art/).<br/>
Built with Next.js and the JMAP protocol.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.1.2-green.svg)](CHANGELOG.md)
[![Docker](https://img.shields.io/badge/docker-ghcr.io%2Fbulwarkmail%2Fwebmail-blue)](https://ghcr.io/bulwarkmail/webmail)

</div>

---

## Screenshots

<table>
<tr>
<td width="50%">

<img src="screenshots/02-inbox.png" width="100%" alt="Inbox — three-pane layout with sidebar, email list, and viewer">

</td>
<td width="50%">

<img src="screenshots/05-dark-mode.png" width="100%" alt="Dark mode">

</td>
</tr>
<tr>
<td width="50%">

<img src="screenshots/04-compose.png" width="100%" alt="Compose with templates and autocomplete">

</td>
<td width="50%">

<img src="screenshots/06-settings.png" width="100%" alt="Settings">

</td>
</tr>
</table>

<details>
<summary>More screenshots</summary>
<table>
<tr>
<td width="50%">

<img src="screenshots/01-login.png" width="100%" alt="Login page">

</td>
<td width="50%">

<img src="screenshots/03-email-viewer.png" width="100%" alt="Email viewer with thread expansion">

</td>
</tr>
</table>
</details>

## Features

### Mail

- **Read, compose, reply, reply-all, forward** with rich HTML rendering
- **Threading** — Gmail-style inline expansion with thread navigation
- **Draft auto-save** with discard confirmation
- **Attachments** — upload, download, and inline preview
- **Search** — full-text with JMAP filter panel, search chips, and cross-mailbox queries
- **Batch operations** — multi-select, archive, delete, move, tag
- **Color tags/labels** and star/unstar
- **Virtual scrolling** for large mailboxes
- **Quick reply** from the viewer

### Calendar

- **Month, week, day, and agenda views** with mini-calendar sidebar
- **Drag-and-drop rescheduling**, click-drag creation, edge-resize (15-min snap)
- **Recurring events** with edit/delete scope (this / this and following / all)
- **Participant scheduling** — iTIP invitations, organizer/attendee UI, RSVP
- **Inline calendar invitations** in email viewer — auto-detect `.ics`, RSVP, import
- **iCalendar import** with preview and bulk create
- **Notifications** with configurable sound and alert persistence
- **Real-time sync** via JMAP push

### Contacts

- **Contact management** with JMAP sync (RFC 9553/9610) and local fallback
- **Contact groups** with group expansion and member management
- **vCard import/export** (RFC 6350) with duplicate detection
- **Autocomplete** in composer (To/Cc/Bcc)
- **Bulk operations** — multi-select, delete, group add, export

### Filters & Automation

- **Server-side email filters** via JMAP Sieve Scripts (RFC 9661)
- **Visual rule builder** — conditions (From, To, Subject, Size, Body…) and actions (Move, Forward, Star, Discard…)
- **Raw Sieve editor** with syntax validation
- **Vacation responder** with date range scheduling and sidebar indicator
- **Email templates** — reusable, categorized, with placeholder auto-fill (`{{recipientName}}`, `{{date}}`, etc.)

### Security & Privacy

- **External content blocked** by default — trusted senders list for auto-load
- **HTML sanitization** via DOMPurify with XSS prevention
- **SPF/DKIM/DMARC** status indicators
- **OAuth2/OIDC with PKCE** for SSO (Keycloak, Authentik, or built-in)
- **TOTP two-factor authentication**
- **"Remember me"** — AES-256-GCM encrypted httpOnly cookie (opt-in)
- **Security headers** — CSP with per-request nonce, X-Frame-Options, Referrer-Policy
- **Newsletter unsubscribe** (RFC 2369)

### Interface

- **Three-pane layout** — sidebar, email list, viewer
- **Dark and light themes** with intelligent email color transformation
- **Responsive** — desktop sidebar + mobile bottom tab bar
- **Keyboard shortcuts** — full navigation without a mouse
- **Drag-and-drop** email organization between mailboxes
- **Right-click context menus**, toast notifications with undo, form validation with shake feedback
- **Accessibility** — WCAG AA contrast, reduced-motion support, focus trap, screen reader live regions

### Internationalization

8 languages: English · Français · 日本語 · Español · Italiano · Deutsch · Nederlands · Português

Automatic browser detection with persistent preference.

### Identity Management

- **Multiple sender identities** with per-identity signatures
- **Sub-addressing** — `user+tag@domain.com` with contextual tag suggestions
- **Identity badges** in viewer and email list

---

## Quick Start

### Docker (recommended)

```bash
docker run -d -p 3000:3000 \
  -e JMAP_SERVER_URL=https://mail.example.com \
  ghcr.io/bulwarkmail/webmail:latest
```

Or with Docker Compose:

```bash
cp .env.example .env.local
# Edit .env.local — set JMAP_SERVER_URL
docker compose up -d
```

### From Source

```bash
git clone https://github.com/bulwarkmail/webmail.git
cd webmail
npm install
cp .env.example .env.local
# Edit .env.local — set JMAP_SERVER_URL
npm run build && npm start
```

### Development

```bash
npm run dev        # Start dev server (mock JMAP server included)
npm run typecheck  # Type checking
npm run lint       # Linting
```

## Configuration

Edit `.env.local`:

```env
# Required
JMAP_SERVER_URL=https://mail.example.com

# Optional
APP_NAME=My Webmail
```

All variables are **runtime** — Docker deployments can be configured without rebuilding.

<details>
<summary>OAuth2/OIDC (SSO)</summary>

```env
OAUTH_ENABLED=true
OAUTH_CLIENT_ID=webmail
OAUTH_CLIENT_SECRET=              # optional, for confidential clients
OAUTH_ISSUER_URL=                 # optional, for external IdPs (Keycloak, Authentik)
```

Endpoints are auto-discovered via `.well-known/oauth-authorization-server` or `.well-known/openid-configuration`.

</details>

<details>
<summary>Remember Me</summary>

```env
SESSION_SECRET=your-secret-key    # Generate with: openssl rand -base64 32
```

Credentials encrypted with AES-256-GCM, stored in an httpOnly cookie (30-day expiry).

</details>

## Keyboard Shortcuts

| Key           | Action                  |
| ------------- | ----------------------- |
| `j` / `k`     | Navigate between emails |
| `Enter` / `o` | Open email              |
| `Esc`         | Close / deselect        |
| `c`           | Compose                 |
| `r` / `R`     | Reply / Reply all       |
| `f`           | Forward                 |
| `s`           | Star                    |
| `e`           | Archive                 |
| `#`           | Delete                  |
| `/`           | Search                  |
| `?`           | Show all shortcuts      |

## Tech Stack

|               |                                                   |
| ------------- | ------------------------------------------------- |
| **Framework** | [Next.js 16](https://nextjs.org/) with App Router |
| **Language**  | TypeScript                                        |
| **Styling**   | [Tailwind CSS v4](https://tailwindcss.com/)       |
| **State**     | [Zustand](https://zustand-demo.pmnd.rs/)          |
| **Protocol**  | Custom JMAP client (RFC 8620)                     |
| **i18n**      | [next-intl](https://next-intl-docs.vercel.app/)   |
| **Icons**     | [Lucide React](https://lucide.dev/)               |

## Why Stalwart?

[Stalwart](https://github.com/stalwartlabs/mail-server) is a mail server written in Rust with **native JMAP support** — not IMAP/SMTP with JMAP bolted on. It handles JMAP, IMAP, SMTP, and ManageSieve in a single binary. Self-hosted, no third-party dependencies.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Roadmap

See [ROADMAP.md](ROADMAP.md) for planned features and current status.

## License

[MIT](LICENSE)
