import { describe, expect, it } from 'vitest'
import { renderEmail, type EmailKind } from '@/lib/email-templates'

const KINDS: EmailKind[] = ['verify', 'resend', 'reset', 'security']
const LOCALES = ['ar', 'fr', 'en']
const PARAMS = {
  name: 'Sam',
  email: 'sam@example.com',
  link: 'https://example.com/verify?token=abc123',
}

describe('renderEmail', () => {
  it.each(KINDS.flatMap((kind) => LOCALES.map((locale) => [kind, locale] as const)))(
    'renders %s/%s with subject, html and text',
    (kind, locale) => {
      const out = renderEmail(kind, { ...PARAMS, locale })
      expect(out.subject.length).toBeGreaterThan(0)
      expect(out.html.length).toBeGreaterThan(0)
      expect(out.text.length).toBeGreaterThan(0)
      expect(out.locale).toBe(locale)
    },
  )

  it('sets dir="rtl" for Arabic and dir="ltr" for French/English', () => {
    expect(renderEmail('verify', { ...PARAMS, locale: 'ar' }).dir).toBe('rtl')
    expect(renderEmail('verify', { ...PARAMS, locale: 'fr' }).dir).toBe('ltr')
    expect(renderEmail('verify', { ...PARAMS, locale: 'en' }).dir).toBe('ltr')
    expect(renderEmail('verify', { ...PARAMS, locale: 'ar' }).html).toContain('dir="rtl"')
    expect(renderEmail('verify', { ...PARAMS, locale: 'fr' }).html).toContain('dir="ltr"')
    expect(renderEmail('verify', { ...PARAMS, locale: 'en' }).html).toContain('dir="ltr"')
  })

  it.each(KINDS)('includes the action link in html and text for %s', (kind) => {
    for (const locale of LOCALES) {
      const out = renderEmail(kind, { ...PARAMS, locale })
      expect(out.html).toContain(`href="${PARAMS.link}"`)
      expect(out.text).toContain(PARAMS.link)
    }
  })

  it.each(KINDS)('leaves no unresolved {placeholders} for %s', (kind) => {
    for (const locale of LOCALES) {
      const out = renderEmail(kind, { ...PARAMS, locale })
      expect(out.subject).not.toMatch(/\{\w+\}/)
      expect(out.html).not.toMatch(/\{\w+\}/)
      expect(out.text).not.toMatch(/\{\w+\}/)
    }
  })

  it('interpolates the recipient name into the body', () => {
    const out = renderEmail('verify', { ...PARAMS, locale: 'en', name: 'Alex' })
    expect(out.text).toContain('Alex')
    expect(out.html).toContain('Alex')
  })

  it('HTML-escapes user-controlled values', () => {
    const out = renderEmail('verify', {
      ...PARAMS,
      locale: 'en',
      name: '<script>alert("x")</script>',
      email: 'a&b@example.com',
    })
    expect(out.html).not.toContain('<script>')
    expect(out.html).toContain('&lt;script&gt;')
    expect(out.html).toContain('a&amp;b@example.com')
    // Plain text stays readable — no escaping needed there.
    expect(out.text).toContain('<script>alert("x")</script>')
  })

  it('falls back to the default locale for unknown locales', () => {
    const out = renderEmail('verify', { ...PARAMS, locale: 'de' })
    expect(out.locale).toBe('ar')
    expect(out.dir).toBe('rtl')
  })

  it('falls back to the default locale when locale is omitted', () => {
    const out = renderEmail('reset', PARAMS)
    expect(out.locale).toBe('ar')
  })

  it('renders locale-specific subjects (no shared string across locales)', () => {
    const ar = renderEmail('verify', { ...PARAMS, locale: 'ar' }).subject
    const fr = renderEmail('verify', { ...PARAMS, locale: 'fr' }).subject
    const en = renderEmail('verify', { ...PARAMS, locale: 'en' }).subject
    expect(new Set([ar, fr, en]).size).toBe(3)
  })

  it('builds a full branded HTML document', () => {
    const out = renderEmail('security', { ...PARAMS, locale: 'en' })
    expect(out.html).toContain('<!doctype html>')
    expect(out.html).toContain('</html>')
    expect(out.html).toContain('My Revision')
  })
})
