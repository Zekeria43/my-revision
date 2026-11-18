import ar from '@messages/ar.json'
import fr from '@messages/fr.json'
import en from '@messages/en.json'
import { isLocale, routing, type Locale } from '@/i18n/routing'

/**
 * Transactional email templates (verification, resend, password reset,
 * security notice).
 *
 * - Every locale has its own copy from `messages/*.json` (parity gate:
 *   `scripts/build-messages.mjs`) — user-facing text is never machine
 *   translated at runtime.
 * - Arabic renders `dir="rtl"`, French/English `dir="ltr"`.
 * - All interpolated values are HTML-escaped; the plain-text variant is
 *   sent alongside the HTML for deliverability and accessibility.
 */

export type EmailKind = 'verify' | 'resend' | 'reset' | 'security'

const messages = { ar, fr, en }

/** hsl(217 91% 53%) — matches --primary in globals.css */
const PRIMARY = '#1a6ef4'
const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Tahoma,Arial,sans-serif"

export interface EmailTemplateParams {
  /** Recipient display name (user-controlled → escaped). */
  name: string
  /** Recipient address, shown in the footer (user-controlled → escaped). */
  email: string
  /** Absolute action link, used as the CTA href. */
  link: string
  /** BCP-47-ish app locale; unknown values fall back to the default. */
  locale?: string
}

export interface RenderedEmail {
  subject: string
  html: string
  text: string
  locale: Locale
  dir: 'rtl' | 'ltr'
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c] ?? c)
}

/** Replaces `{name}`-style placeholders; unknown placeholders are kept as-is. */
function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => vars[key] ?? match)
}

export function renderEmail(
  kind: EmailKind,
  params: EmailTemplateParams,
): RenderedEmail {
  const locale: Locale =
    params.locale && isLocale(params.locale) ? params.locale : routing.defaultLocale
  const dir: 'rtl' | 'ltr' = locale === 'ar' ? 'rtl' : 'ltr'

  const m = messages[locale]
  const t = m.email

  const vars: Record<string, string> = {
    name: params.name,
    email: params.email,
    link: params.link,
  }

  const subject = interpolate(t[`${kind}Subject`], vars)
  const title = interpolate(t[`${kind}Title`], vars)
  const body = interpolate(t[`${kind}Body`], vars)
  const cta = interpolate(t[`${kind}Cta`], vars)
  const note = interpolate(t[`${kind}Note`], vars)
  const ignore = interpolate(t.ignore, vars)
  const footer = interpolate(t.footer, vars)

  const html = `<!doctype html>
<html lang="${locale}" dir="${dir}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:${FONT};-webkit-font-smoothing:antialiased;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;">
<tr><td style="background:${PRIMARY};padding:24px 28px;">
<div style="font-size:20px;font-weight:700;color:#ffffff;">${esc(m.brand.fullName)}</div>
<div style="font-size:13px;color:#dbeafe;margin-top:4px;">${esc(m.brand.tagline)}</div>
</td></tr>
<tr><td style="padding:28px;">
<h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#0f172a;">${esc(title)}</h1>
<p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#334155;">${esc(body)}</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;"><tr><td style="background:${PRIMARY};border-radius:10px;">
<a href="${esc(params.link)}" style="display:inline-block;padding:12px 24px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;">${esc(cta)}</a>
</td></tr></table>
<p style="margin:0 0 20px;font-size:13px;color:#64748b;">${esc(note)}</p>
<hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 16px;" />
<p style="margin:0 0 8px;font-size:12px;color:#94a3b8;">${esc(ignore)}</p>
<p style="margin:0;font-size:12px;color:#94a3b8;">${esc(footer)}</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`

  const text = [
    m.brand.fullName,
    '',
    title,
    '',
    body,
    '',
    `${cta}: ${params.link}`,
    '',
    note,
    ignore,
    footer,
  ].join('\n')

  return { subject, html, text, locale, dir }
}
