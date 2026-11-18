import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { emailMode, sendMail } from '@/lib/mail'

const MAIL = { to: 'sam@example.com', subject: 'Hello', text: 'Body', html: '<p>Body</p>' }

const ENV_KEYS = ['AUTH_EMAIL_MODE', 'BREVO_API_KEY', 'BREVO_SENDER_EMAIL', 'BREVO_SENDER_NAME', 'SMTP_HOST'] as const
let saved: Record<string, string | undefined>
let errorSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  saved = {}
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k]
    delete process.env[k]
  }
  vi.spyOn(console, 'log').mockImplementation(() => {})
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('emailMode', () => {
  it('defaults to console when unset', () => {
    expect(emailMode()).toBe('console')
  })

  it('returns smtp for AUTH_EMAIL_MODE=smtp', () => {
    process.env.AUTH_EMAIL_MODE = 'smtp'
    expect(emailMode()).toBe('smtp')
  })

  it('returns brevo for AUTH_EMAIL_MODE=brevo', () => {
    process.env.AUTH_EMAIL_MODE = 'brevo'
    expect(emailMode()).toBe('brevo')
  })

  it('falls back to console for unknown values', () => {
    process.env.AUTH_EMAIL_MODE = 'carrier-pigeon'
    expect(emailMode()).toBe('console')
  })
})

describe('sendMail — console mode (default)', () => {
  it('delivers a preview without any network call', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const res = await sendMail(MAIL)
    expect(res.delivered).toBe(true)
    expect(res.consolePreview).toContain(MAIL.subject)
    expect(res.consolePreview).toContain(MAIL.to)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('sendMail — brevo mode', () => {
  function stubBrevo(overrides: Record<string, string> = {}) {
    process.env.AUTH_EMAIL_MODE = 'brevo'
    process.env.BREVO_API_KEY = 'test-api-key'
    process.env.BREVO_SENDER_EMAIL = 'no-reply@example.com'
    process.env.BREVO_SENDER_NAME = 'My Revision'
    for (const [k, v] of Object.entries(overrides)) process.env[k] = v
  }

  it('returns delivered:false without calling fetch when the API key is missing', async () => {
    stubBrevo({ BREVO_API_KEY: '' })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const res = await sendMail(MAIL)
    expect(res.delivered).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
    // Never leak the config values in the error path either.
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain('no-reply@example.com')
  })

  it('returns delivered:false without calling fetch when the sender is missing', async () => {
    stubBrevo({ BREVO_SENDER_EMAIL: '' })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const res = await sendMail(MAIL)
    expect(res.delivered).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('posts the expected payload to the Brevo endpoint', async () => {
    stubBrevo()
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201, text: async () => '{}' })
    vi.stubGlobal('fetch', fetchMock)

    const res = await sendMail(MAIL)
    expect(res.delivered).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.brevo.com/v3/smtp/email')
    expect(init.method).toBe('POST')

    const headers = init.headers as Record<string, string>
    expect(headers['api-key']).toBe('test-api-key')
    expect(headers['Content-Type']).toBe('application/json')

    const payload = JSON.parse(String(init.body))
    expect(payload.sender).toEqual({ email: 'no-reply@example.com', name: 'My Revision' })
    expect(payload.to).toEqual([{ email: MAIL.to }])
    expect(payload.subject).toBe(MAIL.subject)
    expect(payload.textContent).toBe(MAIL.text)
    expect(payload.htmlContent).toBe(MAIL.html)
    // The secret must never travel inside the body.
    expect(String(init.body)).not.toContain('test-api-key')
  })

  it('omits htmlContent when no HTML is provided', async () => {
    stubBrevo()
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201, text: async () => '{}' })
    vi.stubGlobal('fetch', fetchMock)

    await sendMail({ to: MAIL.to, subject: MAIL.subject, text: MAIL.text })
    const payload = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body))
    expect(payload).not.toHaveProperty('htmlContent')
    expect(payload.textContent).toBe(MAIL.text)
  })

  it('returns delivered:false when Brevo replies with an error status', async () => {
    stubBrevo()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => 'invalid api key' }),
    )

    const res = await sendMail(MAIL)
    expect(res.delivered).toBe(false)
    // The API key must not appear in logs.
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain('test-api-key')
  })

  it('returns delivered:false when the network call throws', async () => {
    stubBrevo()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNRESET')))

    const res = await sendMail(MAIL)
    expect(res.delivered).toBe(false)
  })
})

describe('sendMail — smtp mode', () => {
  it('returns delivered:false when SMTP_HOST is not configured', async () => {
    process.env.AUTH_EMAIL_MODE = 'smtp'
    const res = await sendMail(MAIL)
    expect(res.delivered).toBe(false)
  })
})
