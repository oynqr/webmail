import { NextRequest, NextResponse } from 'next/server';

/**
 * Mock JMAP server for local development.
 *
 * Enabled only when DEV_MOCK_JMAP=true. Provides realistic dummy data
 * so the UI can be developed without a real JMAP mail server.
 *
 * Accepts any username/password — no real authentication.
 */

const ACCOUNT_ID = 'dev-account-001';

// ---------------------------------------------------------------------------
// Mailboxes
// ---------------------------------------------------------------------------

interface MockMailbox {
  id: string;
  name: string;
  role: string | null;
  sortOrder: number;
  totalEmails: number;
  unreadEmails: number;
}

interface MockEmail {
  id: string;
  threadId: string;
  mailboxIds: Record<string, boolean>;
  keywords: Record<string, boolean>;
  size: number;
  receivedAt: string;
  from: { name: string; email: string }[];
  to: { name: string; email: string }[];
  cc: { name: string; email: string }[];
  subject: string;
  preview: string;
  hasAttachment: boolean;
  textBody: { partId: string; blobId: string; size: number; type: string }[];
  htmlBody: { partId: string; blobId: string; size: number; type: string }[];
  bodyValues: Record<string, { value: string }>;
  attachments?: { partId: string; blobId: string; size: number; name: string; type: string }[];
}

let stateCounter = 1;
function nextState(): string {
  return `mock-state-${++stateCounter}`;
}

const mailboxes: MockMailbox[] = [
  { id: 'mb-inbox', name: 'Inbox', role: 'inbox', sortOrder: 1, totalEmails: 5, unreadEmails: 2 },
  { id: 'mb-drafts', name: 'Drafts', role: 'drafts', sortOrder: 2, totalEmails: 1, unreadEmails: 0 },
  { id: 'mb-sent', name: 'Sent', role: 'sent', sortOrder: 3, totalEmails: 3, unreadEmails: 0 },
  { id: 'mb-junk', name: 'Junk', role: 'junk', sortOrder: 4, totalEmails: 1, unreadEmails: 1 },
  { id: 'mb-trash', name: 'Trash', role: 'trash', sortOrder: 5, totalEmails: 0, unreadEmails: 0 },
  { id: 'mb-archive', name: 'Archive', role: 'archive', sortOrder: 6, totalEmails: 2, unreadEmails: 0 },
];

function recomputeMailboxCounts(): void {
  for (const mb of mailboxes) {
    mb.totalEmails = emails.filter((e) => e.mailboxIds[mb.id]).length;
    mb.unreadEmails = emails.filter((e) => e.mailboxIds[mb.id] && !e.keywords.$seen).length;
  }
}

// ---------------------------------------------------------------------------
// Email fixtures
// ---------------------------------------------------------------------------

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

const emails: MockEmail[] = [
  {
    id: 'email-001',
    threadId: 'thread-001',
    mailboxIds: { 'mb-inbox': true },
    keywords: {},
    size: 4200,
    receivedAt: daysAgo(0),
    from: [{ name: 'Alice Johnson', email: 'alice@example.com' }],
    to: [{ name: 'Dev User', email: 'dev@localhost' }],
    cc: [],
    subject: 'Welcome to JMAP Webmail!',
    preview: 'Hi there! This is a sample email to help you get started with the JMAP Webmail development environment.',
    hasAttachment: false,
    textBody: [{ partId: 'p1', blobId: 'blob-001', size: 280, type: 'text/plain' }],
    htmlBody: [{ partId: 'p2', blobId: 'blob-002', size: 420, type: 'text/html' }],
    bodyValues: {
      p1: { value: 'Hi there!\n\nThis is a sample email to help you get started with the JMAP Webmail development environment.\n\nFeel free to explore the UI — all data here is mock data.\n\nBest,\nAlice' },
      p2: { value: '<p>Hi there!</p><p>This is a sample email to help you get started with the <strong>JMAP Webmail</strong> development environment.</p><p>Feel free to explore the UI — all data here is mock data.</p><p>Best,<br>Alice</p>' },
    },
  },
  {
    id: 'email-002',
    threadId: 'thread-002',
    mailboxIds: { 'mb-inbox': true },
    keywords: { $seen: true, $flagged: true },
    size: 5100,
    receivedAt: daysAgo(1),
    from: [{ name: 'Bob Smith', email: 'bob@example.org' }],
    to: [{ name: 'Dev User', email: 'dev@localhost' }],
    cc: [{ name: 'Charlie Brown', email: 'charlie@example.net' }],
    subject: 'Project Update — Q1 Review',
    preview: 'Hey team, I wanted to share the latest project numbers. We are on track to meet our targets for Q1.',
    hasAttachment: true,
    textBody: [{ partId: 'p1', blobId: 'blob-003', size: 640, type: 'text/plain' }],
    htmlBody: [{ partId: 'p2', blobId: 'blob-004', size: 820, type: 'text/html' }],
    bodyValues: {
      p1: { value: 'Hey team,\n\nI wanted to share the latest project numbers. We are on track to meet our targets for Q1.\n\nKey highlights:\n- Revenue up 12%\n- New signups increased by 8%\n- Customer satisfaction at 94%\n\nLet me know if you have questions.\n\nBob' },
      p2: { value: '<p>Hey team,</p><p>I wanted to share the latest project numbers. We are on track to meet our targets for Q1.</p><ul><li>Revenue up 12%</li><li>New signups increased by 8%</li><li>Customer satisfaction at 94%</li></ul><p>Let me know if you have questions.</p><p>Bob</p>' },
    },
    attachments: [
      { partId: 'att1', blobId: 'blob-att-001', size: 24500, name: 'Q1-Report.pdf', type: 'application/pdf' },
    ],
  },
  {
    id: 'email-003',
    threadId: 'thread-003',
    mailboxIds: { 'mb-inbox': true },
    keywords: { $seen: true },
    size: 3100,
    receivedAt: daysAgo(2),
    from: [{ name: 'Carol Davis', email: 'carol@example.com' }],
    to: [{ name: 'Dev User', email: 'dev@localhost' }],
    cc: [],
    subject: 'Lunch tomorrow?',
    preview: 'Hey! Are you free for lunch tomorrow? I was thinking we could try that new place downtown.',
    hasAttachment: false,
    textBody: [{ partId: 'p1', blobId: 'blob-005', size: 180, type: 'text/plain' }],
    htmlBody: [{ partId: 'p2', blobId: 'blob-006', size: 260, type: 'text/html' }],
    bodyValues: {
      p1: { value: 'Hey!\n\nAre you free for lunch tomorrow? I was thinking we could try that new place downtown.\n\nLet me know!\nCarol' },
      p2: { value: '<p>Hey!</p><p>Are you free for lunch tomorrow? I was thinking we could try that new place downtown.</p><p>Let me know!<br>Carol</p>' },
    },
  },
  {
    id: 'email-004',
    threadId: 'thread-004',
    mailboxIds: { 'mb-inbox': true },
    keywords: {},
    size: 6200,
    receivedAt: daysAgo(0),
    from: [{ name: 'GitHub Notifications', email: 'notifications@github.com' }],
    to: [{ name: 'Dev User', email: 'dev@localhost' }],
    cc: [],
    subject: '[jmap-webmail] New issue: Add dark mode toggle (#42)',
    preview: 'A new issue has been opened by @contributor. It would be great to have a dark mode toggle in the settings panel.',
    hasAttachment: false,
    textBody: [{ partId: 'p1', blobId: 'blob-007', size: 350, type: 'text/plain' }],
    htmlBody: [{ partId: 'p2', blobId: 'blob-008', size: 500, type: 'text/html' }],
    bodyValues: {
      p1: { value: 'A new issue has been opened by @contributor.\n\nTitle: Add dark mode toggle\n\nIt would be great to have a dark mode toggle in the settings panel. Currently users have to rely on system preferences.\n\n—\nReply to this email directly or view it on GitHub.' },
      p2: { value: '<p>A new issue has been opened by <strong>@contributor</strong>.</p><h3>Add dark mode toggle</h3><p>It would be great to have a dark mode toggle in the settings panel. Currently users have to rely on system preferences.</p><hr><p><em>Reply to this email directly or view it on GitHub.</em></p>' },
    },
  },
  {
    id: 'email-005',
    threadId: 'thread-005',
    mailboxIds: { 'mb-inbox': true },
    keywords: { $seen: true },
    size: 2800,
    receivedAt: daysAgo(4),
    from: [{ name: 'Newsletter', email: 'news@techdigest.example' }],
    to: [{ name: 'Dev User', email: 'dev@localhost' }],
    cc: [],
    subject: 'Your Weekly Tech Digest',
    preview: 'This week in tech: new JavaScript runtime benchmarks, WebAssembly reaches 3.0, and more.',
    hasAttachment: false,
    textBody: [{ partId: 'p1', blobId: 'blob-009', size: 900, type: 'text/plain' }],
    htmlBody: [{ partId: 'p2', blobId: 'blob-010', size: 1400, type: 'text/html' }],
    bodyValues: {
      p1: { value: 'This week in tech:\n\n1. New JavaScript runtime benchmarks show 30% improvement\n2. WebAssembly reaches version 3.0\n3. CSS container queries gain full browser support\n4. TypeScript 6.0 release candidate announced\n\nRead more at techdigest.example' },
      p2: { value: '<h2>Your Weekly Tech Digest</h2><ol><li>New JavaScript runtime benchmarks show 30% improvement</li><li>WebAssembly reaches version 3.0</li><li>CSS container queries gain full browser support</li><li>TypeScript 6.0 release candidate announced</li></ol><p><a href="#">Read more at techdigest.example</a></p>' },
    },
  },
  // Newsletter with full HTML
  {
    id: 'email-013',
    threadId: 'thread-012',
    mailboxIds: { 'mb-inbox': true },
    keywords: {},
    size: 18200,
    receivedAt: daysAgo(0),
    from: [{ name: 'Launchpad Weekly', email: 'hello@launchpad.example' }],
    to: [{ name: 'Dev User', email: 'dev@localhost' }],
    cc: [],
    subject: 'Launchpad Weekly #47 — The future of the open web',
    preview: 'This week: WebAssembly Components hit 1.0, a deep dive into privacy-first analytics, and 5 tools we can\'t stop using.',
    hasAttachment: false,
    textBody: [{ partId: 'p1', blobId: 'blob-020', size: 1200, type: 'text/plain' }],
    htmlBody: [{ partId: 'p2', blobId: 'blob-021', size: 16000, type: 'text/html' }],
    bodyValues: {
      p1: { value: 'LAUNCHPAD WEEKLY #47\nThe future of the open web\n\nWebAssembly Components hit 1.0\nThe Component Model spec has reached 1.0, unlocking language-agnostic modules that run anywhere.\n\nDeep dive: Privacy-first analytics\nCookie banners are on their way out. We explore the next generation of analytics tools that respect user privacy by design.\n\n5 tools we can\'t stop using\n1. Vite 7 — lightning-fast builds\n2. Biome — unified lint + format\n3. Deno 4 — batteries included runtime\n4. TailwindCSS 4 — zero config styling\n5. Playwright — end-to-end testing\n\nYou received this because you subscribed at launchpad.example.\nUnsubscribe: https://launchpad.example/unsubscribe' },
      p2: { value: '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head><body style="margin:0;padding:0;background-color:#1a1a2e;font-family:\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;color:#e0e0e0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#1a1a2e;"><tr><td align="center" style="padding:40px 16px;"><table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;"><tr><td style="padding:24px 32px;text-align:center;"><span style="font-size:20px;font-weight:700;color:#a78bfa;letter-spacing:2px;">&#9670; LAUNCHPAD WEEKLY</span><br><span style="font-size:13px;color:#9ca3af;letter-spacing:1px;">ISSUE #47 &bull; MARCH 2026</span></td></tr><tr><td style="background:linear-gradient(135deg,#4c1d95 0%,#7c3aed 50%,#2563eb 100%);border-radius:16px 16px 0 0;padding:48px 40px 40px 40px;text-align:center;"><h1 style="margin:0 0 12px 0;font-size:32px;font-weight:800;color:#ffffff;line-height:1.2;">The future of the open web</h1><p style="margin:0;font-size:16px;color:#e0e7ff;line-height:1.5;">WebAssembly Components hit 1.0, privacy-first analytics take center stage, and 5 tools we can&#8217;t stop using.</p></td></tr><tr><td style="background-color:#16213e;padding:0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:36px 40px 32px 40px;border-bottom:1px solid #1e3a5f;"><span style="display:inline-block;background-color:#7c3aed;color:#fff;font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;letter-spacing:1px;margin-bottom:12px;">FEATURED</span><h2 style="margin:12px 0 8px 0;font-size:22px;font-weight:700;color:#f1f5f9;">WebAssembly Components hit 1.0</h2><p style="margin:0 0 16px 0;font-size:15px;color:#94a3b8;line-height:1.6;">The Component Model specification has officially reached 1.0, unlocking language-agnostic modules that compose and run anywhere&#8202;&#8212;&#8202;from the browser to the edge. This is a watershed moment for portable computing.</p><a href="#" style="display:inline-block;background-color:#7c3aed;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:10px 24px;border-radius:8px;">Read the deep dive &rarr;</a></td></tr><tr><td style="padding:32px 40px;border-bottom:1px solid #1e3a5f;"><span style="display:inline-block;background-color:#2563eb;color:#fff;font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;letter-spacing:1px;margin-bottom:12px;">ANALYSIS</span><h2 style="margin:12px 0 8px 0;font-size:22px;font-weight:700;color:#f1f5f9;">Deep dive: Privacy-first analytics</h2><p style="margin:0 0 16px 0;font-size:15px;color:#94a3b8;line-height:1.6;">Cookie banners are on their way out. We explore the next generation of analytics platforms that respect user privacy by design&#8202;&#8212;&#8202;no consent dialogs required. From server-side aggregation to differential privacy, the landscape is shifting fast.</p><a href="#" style="display:inline-block;border:1px solid #7c3aed;color:#a78bfa;font-size:14px;font-weight:600;text-decoration:none;padding:10px 24px;border-radius:8px;">Explore the guide &rarr;</a></td></tr><tr><td style="padding:32px 40px;"><span style="display:inline-block;background-color:#0d9488;color:#fff;font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;letter-spacing:1px;margin-bottom:12px;">TOOLBOX</span><h2 style="margin:12px 0 16px 0;font-size:22px;font-weight:700;color:#f1f5f9;">5 tools we can&#8217;t stop using</h2><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:12px 16px;background-color:#1e293b;border-radius:10px;margin-bottom:8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="width:36px;vertical-align:top;"><span style="font-size:20px;font-weight:800;color:#7c3aed;">1</span></td><td><span style="font-size:15px;font-weight:600;color:#f1f5f9;">Vite 7</span><br><span style="font-size:13px;color:#94a3b8;">Lightning-fast builds with zero-config ESM support.</span></td></tr></table></td></tr><tr><td style="height:8px;"></td></tr><tr><td style="padding:12px 16px;background-color:#1e293b;border-radius:10px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="width:36px;vertical-align:top;"><span style="font-size:20px;font-weight:800;color:#7c3aed;">2</span></td><td><span style="font-size:15px;font-weight:600;color:#f1f5f9;">Biome</span><br><span style="font-size:13px;color:#94a3b8;">Unified linting and formatting in a single blazing-fast tool.</span></td></tr></table></td></tr><tr><td style="height:8px;"></td></tr><tr><td style="padding:12px 16px;background-color:#1e293b;border-radius:10px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="width:36px;vertical-align:top;"><span style="font-size:20px;font-weight:800;color:#7c3aed;">3</span></td><td><span style="font-size:15px;font-weight:600;color:#f1f5f9;">Deno 4</span><br><span style="font-size:13px;color:#94a3b8;">Batteries-included runtime with native TypeScript &amp; npm compat.</span></td></tr></table></td></tr><tr><td style="height:8px;"></td></tr><tr><td style="padding:12px 16px;background-color:#1e293b;border-radius:10px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="width:36px;vertical-align:top;"><span style="font-size:20px;font-weight:800;color:#7c3aed;">4</span></td><td><span style="font-size:15px;font-weight:600;color:#f1f5f9;">TailwindCSS 4</span><br><span style="font-size:13px;color:#94a3b8;">Zero-config utility-first CSS that just works.</span></td></tr></table></td></tr><tr><td style="height:8px;"></td></tr><tr><td style="padding:12px 16px;background-color:#1e293b;border-radius:10px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="width:36px;vertical-align:top;"><span style="font-size:20px;font-weight:800;color:#7c3aed;">5</span></td><td><span style="font-size:15px;font-weight:600;color:#f1f5f9;">Playwright</span><br><span style="font-size:13px;color:#94a3b8;">Reliable end-to-end testing across every browser.</span></td></tr></table></td></tr></table></td></tr></table></td></tr><tr><td style="background-color:#0f172a;border-radius:0 0 16px 16px;padding:28px 40px;text-align:center;border-top:1px solid #1e3a5f;"><p style="margin:0 0 6px 0;font-size:13px;color:#64748b;">You received this because you subscribed at <a href="#" style="color:#7c3aed;text-decoration:none;">launchpad.example</a></p><p style="margin:0;font-size:13px;color:#64748b;"><a href="#" style="color:#7c3aed;text-decoration:none;">Unsubscribe</a> &bull; <a href="#" style="color:#7c3aed;text-decoration:none;">Manage preferences</a> &bull; <a href="#" style="color:#7c3aed;text-decoration:none;">View in browser</a></p></td></tr></table></td></tr></table></body></html>' },
    },
  },
  // Sent
  {
    id: 'email-006',
    threadId: 'thread-003',
    mailboxIds: { 'mb-sent': true },
    keywords: { $seen: true },
    size: 1800,
    receivedAt: daysAgo(2),
    from: [{ name: 'Dev User', email: 'dev@localhost' }],
    to: [{ name: 'Carol Davis', email: 'carol@example.com' }],
    cc: [],
    subject: 'Re: Lunch tomorrow?',
    preview: 'Sounds great! Let\'s meet at noon.',
    hasAttachment: false,
    textBody: [{ partId: 'p1', blobId: 'blob-011', size: 80, type: 'text/plain' }],
    htmlBody: [],
    bodyValues: {
      p1: { value: 'Sounds great! Let\'s meet at noon.\n\n— Dev User' },
    },
  },
  {
    id: 'email-007',
    threadId: 'thread-006',
    mailboxIds: { 'mb-sent': true },
    keywords: { $seen: true },
    size: 2200,
    receivedAt: daysAgo(3),
    from: [{ name: 'Dev User', email: 'dev@localhost' }],
    to: [{ name: 'Bob Smith', email: 'bob@example.org' }],
    cc: [],
    subject: 'Re: Project Update — Q1 Review',
    preview: 'Thanks Bob, the numbers look great. I\'ll prepare the board presentation.',
    hasAttachment: false,
    textBody: [{ partId: 'p1', blobId: 'blob-012', size: 150, type: 'text/plain' }],
    htmlBody: [],
    bodyValues: {
      p1: { value: 'Thanks Bob, the numbers look great. I\'ll prepare the board presentation.\n\nCheers,\nDev User' },
    },
  },
  {
    id: 'email-008',
    threadId: 'thread-007',
    mailboxIds: { 'mb-sent': true },
    keywords: { $seen: true },
    size: 3100,
    receivedAt: daysAgo(5),
    from: [{ name: 'Dev User', email: 'dev@localhost' }],
    to: [{ name: 'Alice Johnson', email: 'alice@example.com' }],
    cc: [],
    subject: 'Design review feedback',
    preview: 'Hi Alice, I reviewed the new mockups and have a few suggestions.',
    hasAttachment: false,
    textBody: [{ partId: 'p1', blobId: 'blob-013', size: 300, type: 'text/plain' }],
    htmlBody: [],
    bodyValues: {
      p1: { value: 'Hi Alice,\n\nI reviewed the new mockups and have a few suggestions:\n\n1. The sidebar could use more contrast\n2. Consider adding breadcrumbs to the settings page\n3. The compose button placement looks good\n\nOverall great work!\n\nDev User' },
    },
  },
  // Draft
  {
    id: 'email-009',
    threadId: 'thread-008',
    mailboxIds: { 'mb-drafts': true },
    keywords: { $draft: true },
    size: 1200,
    receivedAt: daysAgo(0),
    from: [{ name: 'Dev User', email: 'dev@localhost' }],
    to: [{ name: 'Team', email: 'team@example.com' }],
    cc: [],
    subject: 'Meeting notes (draft)',
    preview: 'Notes from today\'s standup meeting...',
    hasAttachment: false,
    textBody: [{ partId: 'p1', blobId: 'blob-014', size: 200, type: 'text/plain' }],
    htmlBody: [],
    bodyValues: {
      p1: { value: 'Notes from today\'s standup meeting:\n\n- TODO: fill in details\n- Action items: ...' },
    },
  },
  // Junk
  {
    id: 'email-010',
    threadId: 'thread-009',
    mailboxIds: { 'mb-junk': true },
    keywords: {},
    size: 4500,
    receivedAt: daysAgo(1),
    from: [{ name: 'Totally Real Prince', email: 'prince@scam.example' }],
    to: [{ name: 'Dev User', email: 'dev@localhost' }],
    cc: [],
    subject: 'You have won $1,000,000!!!',
    preview: 'Congratulations! You have been selected as the winner of our international lottery.',
    hasAttachment: false,
    textBody: [{ partId: 'p1', blobId: 'blob-015', size: 500, type: 'text/plain' }],
    htmlBody: [],
    bodyValues: {
      p1: { value: 'Congratulations!\n\nYou have been selected as the winner of our international lottery. To claim your prize, please send your bank details to...\n\n(This is mock spam for development purposes.)' },
    },
  },
  // Archive
  {
    id: 'email-011',
    threadId: 'thread-010',
    mailboxIds: { 'mb-archive': true },
    keywords: { $seen: true },
    size: 3800,
    receivedAt: daysAgo(14),
    from: [{ name: 'HR Department', email: 'hr@company.example' }],
    to: [{ name: 'Dev User', email: 'dev@localhost' }],
    cc: [],
    subject: 'Updated PTO Policy',
    preview: 'Please review the updated paid time off policy effective next month.',
    hasAttachment: false,
    textBody: [{ partId: 'p1', blobId: 'blob-016', size: 600, type: 'text/plain' }],
    htmlBody: [],
    bodyValues: {
      p1: { value: 'Hi team,\n\nPlease review the updated paid time off policy effective next month. Key changes include:\n\n- Increased annual leave by 2 days\n- New flexible Friday policy\n- Simplified approval workflow\n\nFull details in the employee handbook.\n\nBest,\nHR Department' },
    },
  },
  {
    id: 'email-012',
    threadId: 'thread-011',
    mailboxIds: { 'mb-archive': true },
    keywords: { $seen: true, $flagged: true },
    size: 2600,
    receivedAt: daysAgo(30),
    from: [{ name: 'Alice Johnson', email: 'alice@example.com' }],
    to: [{ name: 'Dev User', email: 'dev@localhost' }],
    cc: [],
    subject: 'Conference talk accepted!',
    preview: 'Great news — your talk proposal for the JMAP Conf has been accepted!',
    hasAttachment: false,
    textBody: [{ partId: 'p1', blobId: 'blob-017', size: 350, type: 'text/plain' }],
    htmlBody: [],
    bodyValues: {
      p1: { value: 'Great news!\n\nYour talk proposal "Building Modern Webmail with JMAP" for the JMAP Conf has been accepted!\n\nThe conference is scheduled for next month. More details to follow.\n\nCongratulations!\nAlice' },
    },
  },
];

// ---------------------------------------------------------------------------
// Identities
// ---------------------------------------------------------------------------

const IDENTITIES = [
  {
    id: 'identity-001',
    name: 'Dev User',
    email: 'dev@localhost',
    replyTo: null,
    bcc: null,
    textSignature: '-- \nDev User\nJMAP Webmail Developer',
    htmlSignature: '<p>--<br>Dev User<br><em>JMAP Webmail Developer</em></p>',
    mayDelete: false,
  },
];

// ---------------------------------------------------------------------------
// Threads
// ---------------------------------------------------------------------------

function buildThreads() {
  const map = new Map<string, string[]>();
  for (const e of emails) {
    const ids = map.get(e.threadId) || [];
    ids.push(e.id);
    map.set(e.threadId, ids);
  }
  return Array.from(map.entries()).map(([id, emailIds]) => ({ id, emailIds }));
}

// ---------------------------------------------------------------------------
// JMAP method handlers
// ---------------------------------------------------------------------------

type MethodArgs = Record<string, unknown>;
type MethodResult = [string, Record<string, unknown>, string];

function handleCoreEcho(args: MethodArgs, callId: string): MethodResult {
  return ['Core/echo', args, callId];
}

function handleMailboxGet(_args: MethodArgs, callId: string): MethodResult {
  recomputeMailboxCounts();
  return ['Mailbox/get', { accountId: ACCOUNT_ID, state: nextState(), list: mailboxes, notFound: [] }, callId];
}

function handleMailboxSet(args: MethodArgs, callId: string): MethodResult {
  const created: Record<string, { id: string }> = {};
  const updated: Record<string, null> = {};
  const destroyed: string[] = [];

  const create = args.create as Record<string, Record<string, unknown>> | undefined;
  if (create) {
    for (const [key, data] of Object.entries(create)) {
      const newId = `mb-${Date.now()}-${key}`;
      mailboxes.push({
        id: newId,
        name: (data.name as string) || 'New Folder',
        role: null,
        sortOrder: mailboxes.length + 1,
        totalEmails: 0,
        unreadEmails: 0,
      });
      created[key] = { id: newId };
    }
  }

  const update = args.update as Record<string, Record<string, unknown>> | undefined;
  if (update) {
    for (const [id, changes] of Object.entries(update)) {
      const mb = mailboxes.find((m) => m.id === id);
      if (mb) {
        if (changes.name !== undefined) mb.name = changes.name as string;
        if (changes.sortOrder !== undefined) mb.sortOrder = changes.sortOrder as number;
        updated[id] = null;
      }
    }
  }

  const destroy = args.destroy as string[] | undefined;
  if (destroy) {
    for (const id of destroy) {
      const idx = mailboxes.findIndex((m) => m.id === id);
      if (idx !== -1) {
        mailboxes.splice(idx, 1);
        // Move emails from deleted mailbox to trash
        const trash = mailboxes.find((m) => m.role === 'trash');
        for (const e of emails) {
          if (e.mailboxIds[id]) {
            delete e.mailboxIds[id];
            if (trash) e.mailboxIds[trash.id] = true;
          }
        }
        destroyed.push(id);
      }
    }
  }

  recomputeMailboxCounts();
  return ['Mailbox/set', { accountId: ACCOUNT_ID, oldState: nextState(), newState: nextState(), created, updated, destroyed, notCreated: null, notUpdated: null, notDestroyed: null }, callId];
}

function handleEmailQuery(args: MethodArgs, callId: string): MethodResult {
  const filter = args.filter as Record<string, string> | undefined;
  const limit = (args.limit as number) || 50;
  const position = (args.position as number) || 0;

  let filtered = [...emails];
  if (filter?.inMailbox) {
    filtered = filtered.filter((e) => e.mailboxIds[filter.inMailbox]);
  }
  if (filter?.text) {
    const q = (filter.text as string).toLowerCase();
    filtered = filtered.filter(
      (e) =>
        (e.subject?.toLowerCase().includes(q)) ||
        (e.preview?.toLowerCase().includes(q)) ||
        e.from?.some((f) => f.name?.toLowerCase().includes(q) || f.email.toLowerCase().includes(q)),
    );
  }

  // Sort newest first
  filtered.sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());

  const total = filtered.length;
  const ids = filtered.slice(position, position + limit).map((e) => e.id);

  return ['Email/query', { accountId: ACCOUNT_ID, queryState: nextState(), ids, total, position, canCalculateChanges: false }, callId];
}

function handleEmailGet(args: MethodArgs, callId: string): MethodResult {
  let ids = args.ids as string[] | undefined;
  const properties = args.properties as string[] | undefined;

  // Handle back-references (#ids)
  if (!ids && args['#ids']) {
    // Will be resolved by the caller
    ids = args['#ids'] as string[];
  }

  const list = ids
    ? emails.filter((e) => ids!.includes(e.id))
    : emails;

  // If specific properties requested, filter them
  let result: unknown[] = list;
  if (properties) {
    result = list.map((e) => {
      const filtered: Record<string, unknown> = { id: e.id };
      for (const prop of properties) {
        if (prop in e) {
          filtered[prop] = (e as unknown as Record<string, unknown>)[prop];
        }
      }
      return filtered;
    });
  }

  return ['Email/get', { accountId: ACCOUNT_ID, state: nextState(), list: result, notFound: [] }, callId];
}

function handleEmailSet(args: MethodArgs, callId: string): MethodResult {
  const updated: Record<string, null> = {};
  const created: Record<string, { id: string }> = {};
  const destroyed: string[] = [];

  // --- Handle updates (move, keywords, etc.) ---
  const update = args.update as Record<string, Record<string, unknown>> | undefined;
  if (update) {
    for (const [id, changes] of Object.entries(update)) {
      const email = emails.find((e) => e.id === id);
      if (!email) continue;

      // Full mailboxIds replacement (move)
      if (changes.mailboxIds) {
        email.mailboxIds = changes.mailboxIds as Record<string, boolean>;
      }

      // Full keywords replacement
      if (changes.keywords !== undefined) {
        email.keywords = changes.keywords as Record<string, boolean>;
      }

      // Patch-style keyword updates: "keywords/$seen", "keywords/$flagged", etc.
      for (const [key, value] of Object.entries(changes)) {
        if (key.startsWith('keywords/')) {
          const keyword = key.slice('keywords/'.length);
          if (value) {
            email.keywords[keyword] = true;
          } else {
            delete email.keywords[keyword];
          }
        }
      }

      // Subject / other fields (for drafts)
      if (changes.subject !== undefined) email.subject = changes.subject as string;

      updated[id] = null;
    }
  }

  // --- Handle creates ---
  const create = args.create as Record<string, Record<string, unknown>> | undefined;
  if (create) {
    for (const [key, data] of Object.entries(create)) {
      const newId = `email-new-${Date.now()}-${key}`;
      // Extract preview text from bodyValues using textBody partId
      let previewText = '';
      const textBodyArr = data.textBody as { partId: string }[] | undefined;
      const bodyVals = data.bodyValues as Record<string, { value: string }> | undefined;
      if (Array.isArray(textBodyArr) && textBodyArr[0]?.partId && bodyVals) {
        previewText = bodyVals[textBodyArr[0].partId]?.value || '';
      } else if (typeof data.textBody === 'string') {
        previewText = data.textBody;
      }

      const newEmail: MockEmail = {
        id: newId,
        threadId: `thread-new-${Date.now()}-${key}`,
        mailboxIds: (data.mailboxIds as Record<string, boolean>) || { 'mb-drafts': true },
        keywords: (data.keywords as Record<string, boolean>) || {},
        size: 1000,
        receivedAt: new Date().toISOString(),
        from: (data.from as MockEmail['from']) || [{ name: 'Dev User', email: 'dev@localhost' }],
        to: (data.to as MockEmail['to']) || [],
        cc: (data.cc as MockEmail['cc']) || [],
        subject: (data.subject as string) || '(no subject)',
        preview: (previewText || (data.subject as string) || '').slice(0, 120),
        hasAttachment: false,
        textBody: [],
        htmlBody: [],
        bodyValues: {},
      };
      emails.unshift(newEmail);
      created[key] = { id: newId };
    }
  }

  // --- Handle destroys (permanent delete) ---
  const destroy = args.destroy as string[] | undefined;
  if (destroy) {
    for (const id of destroy) {
      const idx = emails.findIndex((e) => e.id === id);
      if (idx !== -1) {
        emails.splice(idx, 1);
        destroyed.push(id);
      }
    }
  }

  recomputeMailboxCounts();
  return ['Email/set', { accountId: ACCOUNT_ID, oldState: nextState(), newState: nextState(), created, updated, destroyed, notCreated: null, notUpdated: null, notDestroyed: null }, callId];
}

function handleIdentityGet(_args: MethodArgs, callId: string): MethodResult {
  return ['Identity/get', { accountId: ACCOUNT_ID, state: nextState(), list: IDENTITIES, notFound: [] }, callId];
}

function handleIdentitySet(args: MethodArgs, callId: string): MethodResult {
  const created: Record<string, { id: string }> = {};
  const create = args.create as Record<string, unknown> | undefined;
  if (create) {
    for (const key of Object.keys(create)) {
      created[key] = { id: `identity-new-${Date.now()}-${key}` };
    }
  }
  return ['Identity/set', { accountId: ACCOUNT_ID, oldState: nextState(), newState: nextState(), created, updated: null, destroyed: null }, callId];
}

function handleThreadGet(args: MethodArgs, callId: string): MethodResult {
  const ids = args.ids as string[] | undefined;
  const threads = buildThreads();
  const list = ids ? threads.filter((t) => ids.includes(t.id)) : threads;
  return ['Thread/get', { accountId: ACCOUNT_ID, state: nextState(), list, notFound: [] }, callId];
}

function handleEmailSubmissionSet(_args: MethodArgs, callId: string): MethodResult {
  return ['EmailSubmission/set', { accountId: ACCOUNT_ID, oldState: nextState(), newState: nextState(), created: { 'sub-1': { id: 'sub-mock-1' } }, notCreated: null }, callId];
}

function handleQuotaGet(_args: MethodArgs, callId: string): MethodResult {
  return ['Quota/get', { accountId: ACCOUNT_ID, state: nextState(), list: [{ resourceType: 'mail', scope: 'mail', used: 52428800, hardLimit: 1073741824 }], notFound: [] }, callId];
}

function handleVacationResponseGet(_args: MethodArgs, callId: string): MethodResult {
  return ['VacationResponse/get', { accountId: ACCOUNT_ID, state: nextState(), list: [{ id: 'vacation-1', isEnabled: false, fromDate: null, toDate: null, subject: null, textBody: null, htmlBody: null }], notFound: [] }, callId];
}

function handleContactCardGet(_args: MethodArgs, callId: string): MethodResult {
  return ['ContactCard/get', {
    accountId: ACCOUNT_ID, state: nextState(), notFound: [],
    list: [
      { id: 'contact-001', addressBookIds: { 'ab-1': true }, kind: 'individual', name: { components: [{ kind: 'given', value: 'Alice' }, { kind: 'surname', value: 'Johnson' }] }, emails: { e1: { address: 'alice@example.com' } } },
      { id: 'contact-002', addressBookIds: { 'ab-1': true }, kind: 'individual', name: { components: [{ kind: 'given', value: 'Bob' }, { kind: 'surname', value: 'Smith' }] }, emails: { e1: { address: 'bob@example.org' } }, phones: { p1: { number: '+1-555-0123' } } },
      { id: 'contact-003', addressBookIds: { 'ab-1': true }, kind: 'individual', name: { components: [{ kind: 'given', value: 'Carol' }, { kind: 'surname', value: 'Davis' }] }, emails: { e1: { address: 'carol@example.com' } } },
    ],
  }, callId];
}

function handleAddressBookGet(_args: MethodArgs, callId: string): MethodResult {
  return ['AddressBook/get', { accountId: ACCOUNT_ID, state: nextState(), list: [{ id: 'ab-1', name: 'Personal', isDefault: true }], notFound: [] }, callId];
}

function handleCalendarGet(_args: MethodArgs, callId: string): MethodResult {
  return ['Calendar/get', { accountId: ACCOUNT_ID, state: nextState(), list: [{ id: 'cal-1', name: 'Personal', color: '#4285f4', isVisible: true, isDefault: true }], notFound: [] }, callId];
}

function handleCalendarEventGet(_args: MethodArgs, callId: string): MethodResult {
  return ['CalendarEvent/get', { accountId: ACCOUNT_ID, state: nextState(), list: [], notFound: [] }, callId];
}

function handleCalendarEventQuery(_args: MethodArgs, callId: string): MethodResult {
  return ['CalendarEvent/query', { accountId: ACCOUNT_ID, queryState: nextState(), ids: [], total: 0, position: 0, canCalculateChanges: false }, callId];
}

function handleSieveScriptGet(_args: MethodArgs, callId: string): MethodResult {
  return ['SieveScript/get', { accountId: ACCOUNT_ID, state: nextState(), list: [], notFound: [] }, callId];
}

// Catch-all for unknown methods
function handleUnknown(method: string, _args: MethodArgs, callId: string): MethodResult {
  return ['error', { type: 'unknownMethod', description: `Mock server does not implement ${method}` }, callId];
}

const METHOD_HANDLERS: Record<string, (args: MethodArgs, callId: string) => MethodResult> = {
  'Core/echo': handleCoreEcho,
  'Mailbox/get': handleMailboxGet,
  'Mailbox/set': handleMailboxSet,
  'Email/query': handleEmailQuery,
  'Email/get': handleEmailGet,
  'Email/set': handleEmailSet,
  'Email/changes': (_args, callId) => ['Email/changes', { accountId: ACCOUNT_ID, oldState: nextState(), newState: nextState(), hasMoreChanges: false, created: [], updated: [], destroyed: [] }, callId],
  'Thread/get': handleThreadGet,
  'Identity/get': handleIdentityGet,
  'Identity/set': handleIdentitySet,
  'EmailSubmission/set': handleEmailSubmissionSet,
  'Quota/get': handleQuotaGet,
  'VacationResponse/get': handleVacationResponseGet,
  'VacationResponse/set': (_args, callId) => ['VacationResponse/set', { accountId: ACCOUNT_ID, oldState: nextState(), newState: nextState(), updated: { 'vacation-1': null } }, callId],
  'ContactCard/get': handleContactCardGet,
  'ContactCard/set': (_args, callId) => ['ContactCard/set', { accountId: ACCOUNT_ID, oldState: nextState(), newState: nextState(), created: null, updated: null, destroyed: null }, callId],
  'ContactCard/query': (_args, callId) => ['ContactCard/query', { accountId: ACCOUNT_ID, queryState: nextState(), ids: ['contact-001', 'contact-002', 'contact-003'], total: 3, position: 0 }, callId],
  'AddressBook/get': handleAddressBookGet,
  'Calendar/get': handleCalendarGet,
  'CalendarEvent/get': handleCalendarEventGet,
  'CalendarEvent/query': handleCalendarEventQuery,
  'CalendarEvent/set': (_args, callId) => ['CalendarEvent/set', { accountId: ACCOUNT_ID, oldState: nextState(), newState: nextState(), created: null, updated: null, destroyed: null }, callId],
  'SieveScript/get': handleSieveScriptGet,
  'SieveScript/set': (_args, callId) => ['SieveScript/set', { accountId: ACCOUNT_ID, oldState: nextState(), newState: nextState(), created: null, updated: null, destroyed: null }, callId],
};

// ---------------------------------------------------------------------------
// Resolve back-references between method calls
// ---------------------------------------------------------------------------

function resolveBackReferences(
  methodCalls: Array<[string, MethodArgs, string]>,
  responses: MethodResult[],
): Array<[string, MethodArgs, string]> {
  return methodCalls.map((call) => {
    const [method, args, callId] = call;
    const resolved = { ...args };

    // Handle #ids back-reference (used by Email/get after Email/query)
    if (resolved['#ids']) {
      const ref = resolved['#ids'] as { resultOf: string; name: string; path: string };
      const refResponse = responses.find((r) => r[2] === ref.resultOf && r[0] === ref.name);
      if (refResponse) {
        const path = ref.path.replace(/^\//, '');
        resolved.ids = refResponse[1][path] as string[];
      }
      delete resolved['#ids'];
    }

    return [method, resolved, callId] as [string, MethodArgs, string];
  });
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

function isDevMockEnabled(): boolean {
  return process.env.DEV_MOCK_JMAP === 'true';
}

function getBaseUrl(request: NextRequest): string {
  const proto = request.headers.get('x-forwarded-proto') || 'http';
  const host = request.headers.get('host') || 'localhost:3000';
  return `${proto}://${host}`;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  if (!isDevMockEnabled()) {
    return NextResponse.json({ error: 'Mock JMAP server is disabled' }, { status: 404 });
  }

  const { path } = await params;
  const joined = path.join('/');

  // Session endpoint: /.well-known/jmap
  if (joined === '.well-known/jmap') {
    const base = getBaseUrl(request);
    return NextResponse.json({
      capabilities: {
        'urn:ietf:params:jmap:core': {
          maxSizeUpload: 50000000,
          maxConcurrentUpload: 4,
          maxSizeRequest: 10000000,
          maxConcurrentRequests: 4,
          maxCallsInRequest: 16,
          maxObjectsInGet: 500,
          maxObjectsInSet: 500,
          collationAlgorithms: ['i;ascii-casemap', 'i;ascii-numeric', 'i;unicode-casemap'],
        },
        'urn:ietf:params:jmap:mail': {},
        'urn:ietf:params:jmap:submission': {},
        'urn:ietf:params:jmap:quota': {},
        'urn:ietf:params:jmap:vacationresponse': {},
        'urn:ietf:params:jmap:contacts': {},
        'urn:ietf:params:jmap:calendars': {},
        'urn:ietf:params:jmap:sieve': {},
      },
      accounts: {
        [ACCOUNT_ID]: {
          name: 'Dev User',
          isPersonal: true,
          isReadOnly: false,
          accountCapabilities: {
            'urn:ietf:params:jmap:mail': {},
            'urn:ietf:params:jmap:submission': {},
            'urn:ietf:params:jmap:quota': {},
            'urn:ietf:params:jmap:vacationresponse': {},
            'urn:ietf:params:jmap:contacts': {},
            'urn:ietf:params:jmap:calendars': {},
            'urn:ietf:params:jmap:sieve': {},
          },
        },
      },
      primaryAccounts: {
        'urn:ietf:params:jmap:mail': ACCOUNT_ID,
        'urn:ietf:params:jmap:submission': ACCOUNT_ID,
        'urn:ietf:params:jmap:quota': ACCOUNT_ID,
        'urn:ietf:params:jmap:vacationresponse': ACCOUNT_ID,
        'urn:ietf:params:jmap:contacts': ACCOUNT_ID,
        'urn:ietf:params:jmap:calendars': ACCOUNT_ID,
        'urn:ietf:params:jmap:sieve': ACCOUNT_ID,
      },
      username: 'dev@localhost',
      apiUrl: `${base}/api/dev-jmap/api`,
      downloadUrl: `${base}/api/dev-jmap/download/{accountId}/{blobId}/{name}?accept={type}`,
      uploadUrl: `${base}/api/dev-jmap/upload/{accountId}/`,
      eventSourceUrl: `${base}/api/dev-jmap/eventsource?types={types}&closeafter={closeafter}&ping={ping}`,
      state: 'mock-session-state-1',
    });
  }

  // Download endpoint: /download/{accountId}/{blobId}/{name}
  if (joined.startsWith('download/')) {
    const segments = joined.split('/');
    // segments: ['download', accountId, blobId, name]
    const blobId = segments[2] || 'unknown';
    const name = decodeURIComponent(segments[3] || 'attachment');
    const accept = new URL(request.url).searchParams.get('accept') || 'application/octet-stream';

    // Find matching attachment across all emails
    let attachmentData: { name: string; type: string; size: number } | undefined;
    for (const email of emails) {
      const att = email.attachments?.find(a => a.blobId === blobId);
      if (att) {
        attachmentData = att;
        break;
      }
    }

    // Generate placeholder content for the blob
    const contentType = attachmentData?.type || accept;
    const fileName = attachmentData?.name || name;
    const body = `[Mock file content for blob ${blobId}: ${fileName}]`;

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  }

  // EventSource endpoint: /eventsource
  if (joined === 'eventsource') {
    const ping = parseInt(new URL(request.url).searchParams.get('ping') || '0', 10);
    const pingInterval = ping > 0 ? ping : 30;

    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        // Send initial state event
        const stateEvent = JSON.stringify({
          '@type': 'StateChange',
          changed: {
            [ACCOUNT_ID]: {
              'Email': nextState(),
              'Mailbox': nextState(),
              'Thread': nextState(),
            },
          },
        });
        controller.enqueue(encoder.encode(`event: state\ndata: ${stateEvent}\n\n`));

        // Send periodic pings to keep the connection alive
        const interval = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(`event: ping\ndata: ${JSON.stringify({ interval: pingInterval })}\n\n`));
          } catch {
            clearInterval(interval);
          }
        }, pingInterval * 1000);

        // Close after 5 minutes to prevent indefinite connections in dev
        setTimeout(() => {
          clearInterval(interval);
          try { controller.close(); } catch { /* already closed */ }
        }, 5 * 60 * 1000);
      },
    });

    return new NextResponse(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  if (!isDevMockEnabled()) {
    return NextResponse.json({ error: 'Mock JMAP server is disabled' }, { status: 404 });
  }

  const { path } = await params;
  const joined = path.join('/');

  // JMAP API endpoint
  if (joined === 'api') {
    try {
      const body = await request.json();
      const methodCalls = body.methodCalls as Array<[string, MethodArgs, string]>;

      if (!methodCalls || !Array.isArray(methodCalls)) {
        return NextResponse.json({ error: 'Invalid request: missing methodCalls' }, { status: 400 });
      }

      const responses: MethodResult[] = [];

      // Process method calls sequentially (to support back-references)
      const resolved = resolveBackReferences(methodCalls, responses);
      for (let i = 0; i < methodCalls.length; i++) {
        const [method, , callId] = methodCalls[i];
        // Use resolved args if available, otherwise original
        const args = i < resolved.length ? resolved[i][1] : methodCalls[i][1];

        const handler = METHOD_HANDLERS[method];
        if (handler) {
          const result = handler(args, callId);
          responses.push(result);
        } else {
          responses.push(handleUnknown(method, args, callId));
        }

        // Re-resolve remaining calls with new responses
        if (i < methodCalls.length - 1) {
          const remaining = methodCalls.slice(i + 1);
          const reResolved = resolveBackReferences(remaining, responses);
          for (let j = 0; j < reResolved.length; j++) {
            resolved[i + 1 + j] = reResolved[j];
          }
        }
      }

      return NextResponse.json({ methodResponses: responses });
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
  }

  // Upload endpoint (accept but return a fake blob)
  if (joined.startsWith('upload/')) {
    return NextResponse.json({
      accountId: ACCOUNT_ID,
      blobId: `blob-upload-${Date.now()}`,
      type: request.headers.get('content-type') || 'application/octet-stream',
      size: Number(request.headers.get('content-length') || 0),
    });
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
