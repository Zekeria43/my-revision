'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import {
  Database,
  Download,
  KeyRound,
  Laptop,
  LogOut,
  Monitor,
  Moon,
  Save,
  ShieldCheck,
  Sun,
  Trash2,
  User,
} from 'lucide-react'
import { changePasswordAction, deleteAccountAction, logoutAction } from '@/actions/auth'
import { revokeOtherSessions, revokeSession, saveUiPreferences, updateProfile } from '@/actions/settings'
import type { ActionState } from '@/actions/auth'
import { Badge, Button, Card, CardHeader, Dialog, Input, Select, Tabs, Textarea } from '@/components/ui'
import { DField, FormDialog } from '@/components/form-dialog'
import { useDateFormat } from '@/components/date-format'
import { cn } from '@/lib/utils'

export interface SessionRow {
  id: string
  isCurrent: boolean
  userAgent: string | null
  ip: string | null
  createdAt: string
  lastSeenAt: string
}

interface Props {
  user: {
    id: string
    name: string
    email: string
    role: string
    status: string
    emailVerifiedAt: string | null
  }
  profile: {
    school: string
    program: string
    timezone: string
    bio: string
    country: string
    city: string
    academicLevel: string
    academicYear: string
    preferredLanguage: string
  }
  prefs: { language: string; notificationsEnabled: boolean; emailEnabled: boolean }
  sessions: SessionRow[]
  locale: string
}

type Tab = 'profile' | 'security' | 'preferences' | 'data'

const THEMES = [
  { id: 'light', label: 'settings.theme', icon: Sun },
  { id: 'dark', label: 'settings.theme', icon: Moon },
  { id: 'system', label: 'settings.theme', icon: Monitor },
] as const

export function SettingsClient({ user, profile, prefs, sessions, locale }: Props) {
  const t = useTranslations()
  const fmt = useDateFormat()
  const [tab, setTab] = useState<Tab>('profile')
  const [isPending, startTransition] = useTransition()
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteText, setDeleteText] = useState('')
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [theme, setTheme] = useState<string>(() => {
    if (typeof document === 'undefined') return 'system'
    return localStorage.getItem('mv-theme') ?? 'system'
  })

  const flash = (kind: 'ok' | 'err', text: string) => {
    setToast({ kind, text })
    setTimeout(() => setToast(null), 4000)
  }

  const applyTheme = (next: string) => {
    setTheme(next)
    localStorage.setItem('mv-theme', next)
    const root = document.documentElement
    root.classList.remove('light', 'dark')
    if (next === 'system') {
      root.removeAttribute('data-theme')
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) root.classList.add('dark')
    } else {
      root.classList.add(next)
      root.setAttribute('data-theme', next)
    }
  }

  /* ── Delete account ── */
  const doDelete = async () => {
    if (deleteText !== 'DELETE') return
    setDeleteBusy(true)
    try {
      const r = await deleteAccountAction(deleteText)
      if (r.ok) {
        flash('ok', t('settings.accountDeleted'))
        setTimeout(() => window.location.assign(`/${locale}`), 900)
      } else {
        flash(
          'err',
          t((r.messageKey ?? 'errors.serverErrorTitle') as 'errors.serverErrorTitle'),
        )
      }
    } catch {
      flash('err', t('errors.serverErrorTitle'))
    } finally {
      setDeleteBusy(false)
    }
  }

  const revoke = (id: string) => {
    startTransition(async () => {
      const r = await revokeSession(id, locale)
      flash(
        r.ok ? 'ok' : 'err',
        r.ok ? t('settings.sessionRevoked') : t((r.messageKey ?? 'errors.serverErrorTitle') as 'errors.serverErrorTitle'),
      )
    })
  }

  const revokeAll = () => {
    startTransition(async () => {
      const r = await revokeOtherSessions(locale)
      flash(
        r.ok ? 'ok' : 'err',
        r.ok ? t('settings.sessionRevoked') : t((r.messageKey ?? 'errors.serverErrorTitle') as 'errors.serverErrorTitle'),
      )
    })
  }

  return (
    <div className="space-y-6">
      <Tabs
        value={tab}
        onChange={(v) => setTab(v as Tab)}
        tabs={[
          { id: 'profile', label: t('settings.profile') },
          { id: 'security', label: t('settings.security') },
          { id: 'preferences', label: t('settings.preferences') },
          { id: 'data', label: t('settings.data') },
        ]}
      />

      {/* ───────────── Profile ───────────── */}
      {tab === 'profile' && (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px] animate-fade-in">
          <Card>
            <CardHeader title={t('settings.profile')} />
            <ProfileForm profile={profile} locale={locale} name={user.name} />
          </Card>

          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <User size={16} /> {user.name}
                </span>
              }
            />
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">
                  {t('auth.email')}
                </p>
                <p className="truncate text-sm font-bold" dir="ltr">
                  {user.email}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge color={user.role === 'ADMIN' ? 'hsl(var(--accent))' : 'hsl(var(--primary))'}>
                  {user.role === 'ADMIN' ? t('nav.admin') : t('nav.dashboard')}
                </Badge>
                <Badge color={user.status === 'ACTIVE' ? 'hsl(var(--success))' : 'hsl(var(--warning))'}>
                  {user.status}
                </Badge>
                {user.emailVerifiedAt && (
                  <Badge color="hsl(var(--success))">
                    <ShieldCheck size={11} /> {t('auth.verified')}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                {fmt.date(user.emailVerifiedAt ?? new Date(), { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
              <form action={logoutAction}>
                <Button type="submit" variant="outline" className="w-full">
                  <LogOut size={15} /> {t('nav.logout')}
                </Button>
              </form>
            </div>
          </Card>
        </div>
      )}

      {/* ───────────── Security ───────────── */}
      {tab === 'security' && (
        <div className="grid gap-4 lg:grid-cols-[1fr_360px] animate-fade-in">
          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <KeyRound size={16} /> {t('settings.changePassword')}
                </span>
              }
            />
            <PasswordForm />
          </Card>

          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <Laptop size={16} /> {t('settings.sessions')}
                </span>
              }
              action={
                <Button size="sm" variant="outline" onClick={revokeAll} disabled={isPending}>
                  {t('settings.revokeSession')}
                </Button>
              }
            />
            <ul className="space-y-2">
              {sessions.map((s) => (
                <li key={s.id} className="rounded-xl border p-3">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold" dir="ltr">
                        {s.userAgent ?? '—'}
                      </p>
                      <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                        {s.ip ?? '—'} · {fmt.relative(s.lastSeenAt)}
                      </p>
                    </div>
                    {s.isCurrent ? (
                      <Badge color="hsl(var(--success))">{t('common.current')}</Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isPending}
                        onClick={() => revoke(s.id)}
                      >
                        {t('settings.revokeSession')}
                      </Button>
                    )}
                  </div>
                </li>
              ))}
              {sessions.length === 0 && (
                <li className="py-4 text-center text-sm text-[hsl(var(--muted-foreground))]">
                  {t('settings.sessions')}
                </li>
              )}
            </ul>
          </Card>
        </div>
      )}

      {/* ───────────── Preferences ───────────── */}
      {tab === 'preferences' && (
        <div className="grid gap-4 lg:grid-cols-2 animate-fade-in">
          <Card>
            <CardHeader title={t('settings.language')} description={t('settings.languageHint')} />
            <div className="flex gap-2">
              {(['ar', 'fr', 'en'] as const).map((l) => (
                <a
                  key={l}
                  href={`/${l}/settings`}
                  className={cn(
                    'btn-outline h-10 flex-1 justify-center',
                    locale === l && 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.1)] font-bold',
                  )}
                >
                  {l === 'ar' ? 'العربية' : l === 'fr' ? 'Français' : 'English'}
                </a>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title={t('settings.theme')} />
            <div className="flex gap-2">
              {THEMES.map((th) => {
                const Icon = th.icon
                return (
                  <button
                    key={th.id}
                    onClick={() => applyTheme(th.id)}
                    aria-pressed={theme === th.id}
                    className={cn(
                      'btn-outline h-10 flex-1 justify-center gap-2',
                      theme === th.id && 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.1)] font-bold',
                    )}
                  >
                    <Icon size={15} /> {th.id}
                  </button>
                )
              })}
            </div>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader title={t('settings.notifications')} />
            <PrefsForm prefs={prefs} locale={locale} />
          </Card>
        </div>
      )}

      {/* ───────────── Data ───────────── */}
      {tab === 'data' && (
        <div className="space-y-4 animate-fade-in">
          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <Download size={16} /> {t('settings.exportData')}
                </span>
              }
              description={t('settings.exportHint')}
            />
            <a href="/api/export/data" className="btn-primary self-start">
              <Download size={15} /> {t('settings.exportData')}
            </a>
          </Card>

          <Card className="border-[hsl(var(--danger)/0.4)]">
            <CardHeader
              title={
                <span className="flex items-center gap-2 text-[hsl(var(--danger))]">
                  <Trash2 size={16} /> {t('settings.dangerZone')}
                </span>
              }
              description={t('settings.deleteAccountHint')}
            />
            <div className="space-y-2">
              <p className="text-sm font-medium">{t('settings.deleteAccountFinal')}</p>
              <Button variant="danger" onClick={() => setDeleteOpen(true)}>
                <Trash2 size={15} /> {t('settings.deleteAccount')}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ───────────── Delete dialog ───────────── */}
      <Dialog
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false)
          setDeleteText('')
        }}
        title={t('settings.deleteAccount')}
      >
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
            {t('settings.deleteAccountFinal')}
          </p>
          <DField label={t('settings.deleteAccountConfirm')} htmlFor="confirmDelete" required>
            <Input
              id="confirmDelete"
              value={deleteText}
              onChange={(e) => setDeleteText(e.target.value)}
              dir="ltr"
              placeholder="DELETE"
              autoComplete="off"
            />
          </DField>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteOpen(false)
                setDeleteText('')
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              loading={deleteBusy}
              disabled={deleteText !== 'DELETE' || deleteBusy}
              onClick={doDelete}
            >
              <Trash2 size={15} /> {t('settings.deleteAccount')}
            </Button>
          </div>
        </div>
      </Dialog>

      {toast && (
        <div role="status" className="fixed bottom-5 inset-x-0 z-[70] flex justify-center px-4 animate-fade-in-up">
          <div
            className={cn(
              'flex items-center gap-2 rounded-xl border bg-[hsl(var(--card))] px-4 py-2.5 text-sm font-medium shadow-2xl',
              toast.kind === 'ok'
                ? 'border-[hsl(var(--success)/0.45)]'
                : 'border-[hsl(var(--danger)/0.45)]',
            )}
          >
            {toast.text}
          </div>
        </div>
      )}
    </div>
  )
}

/* ───────────────────────── Sub-forms ───────────────────────── */

function ProfileForm({ profile, locale, name }: { profile: Props['profile']; locale: string; name: string }) {
  const t = useTranslations()
  const [state, setState] = useState<ActionState | null>(null)
  const [pending, startTransition] = useTransition()

  const submit = (fd: FormData) => {
    startTransition(async () => {
      const r = await updateProfile({ ok: false }, fd)
      setState(r)
    })
  }

  return (
    <form action={submit} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />

      <div className="grid gap-4 sm:grid-cols-2">
        <DField label={t('settings.fullName')} htmlFor="name" required>
          <Input id="name" name="name" required defaultValue={name} />
        </DField>
        <DField label={t('settings.school')} htmlFor="school">
          <Input id="school" name="school" defaultValue={profile.school} />
        </DField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <DField label={t('settings.program')} htmlFor="program">
          <Input id="program" name="program" defaultValue={profile.program} />
        </DField>
        <DField label={t('settings.timezone')} htmlFor="timezone">
          <Input id="timezone" name="timezone" dir="ltr" defaultValue={profile.timezone} />
        </DField>
      </div>

      {/* Academic information */}
      <p className="pt-2 text-sm font-bold">{t('auth.academicInfo')}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <DField label={t('settings.country')} htmlFor="country">
          <Input id="country" name="country" maxLength={80} defaultValue={profile.country} />
        </DField>
        <DField label={t('settings.city')} htmlFor="city">
          <Input id="city" name="city" maxLength={80} defaultValue={profile.city} />
        </DField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <DField label={t('settings.academicLevel')} htmlFor="academicLevel">
          <Input id="academicLevel" name="academicLevel" maxLength={80} defaultValue={profile.academicLevel} />
        </DField>
        <DField label={t('settings.academicYear')} htmlFor="academicYear">
          <Input id="academicYear" name="academicYear" maxLength={40} defaultValue={profile.academicYear} />
        </DField>
      </div>

      <DField label={t('settings.preferredLanguage')} htmlFor="preferredLanguage">
        <Select id="preferredLanguage" name="preferredLanguage" defaultValue={profile.preferredLanguage}>
          <option value="">{t('common.none')}</option>
          <option value="ar">العربية</option>
          <option value="fr">Français</option>
          <option value="en">English</option>
        </Select>
      </DField>

      <DField label={t('settings.bio')} htmlFor="bio">
        <Textarea id="bio" name="bio" rows={4} defaultValue={profile.bio} />
      </DField>

      <Button type="submit" loading={pending}>
        <Save size={15} /> {t('common.save')}
      </Button>

      {state && (
        <p
          className={cn(
            'text-sm font-medium',
            state.ok ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--danger))]',
          )}
        >
          {state.ok
            ? t((state.messageKey ?? 'settings.profileSaved') as 'settings.profileSaved')
            : t((state.messageKey ?? 'errors.serverErrorTitle') as 'errors.serverErrorTitle')}
        </p>
      )}
    </form>
  )
}

function PasswordForm() {
  const t = useTranslations()
  const [state, setState] = useState<ActionState | null>(null)
  const [pending, startTransition] = useTransition()

  const submit = (fd: FormData) => {
    startTransition(async () => {
      const r = await changePasswordAction({ ok: false }, fd)
      setState(r)
      if (r.ok) {
        const form = document.getElementById('pw-form') as HTMLFormElement | null
        form?.reset()
      }
    })
  }

  return (
    <form id="pw-form" action={submit} className="space-y-4">
      <DField label={t('auth.currentPassword')} htmlFor="currentPassword" required>
        <Input id="currentPassword" name="currentPassword" type="password" required autoComplete="current-password" />
      </DField>
      <div className="grid gap-4 sm:grid-cols-2">
        <DField label={t('auth.newPassword')} htmlFor="newPassword" required>
          <Input id="newPassword" name="newPassword" type="password" required autoComplete="new-password" />
        </DField>
        <DField label={t('auth.confirmPassword')} htmlFor="confirmPassword" required>
          <Input id="confirmPassword" name="confirmPassword" type="password" required autoComplete="new-password" />
        </DField>
      </div>

      <Button type="submit" loading={pending}>
        <KeyRound size={15} /> {t('settings.changePassword')}
      </Button>

      {state && (
        <p
          className={cn(
            'text-sm font-medium',
            state.ok ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--danger))]',
          )}
        >
          {state.ok
            ? t('auth.passwordChanged')
            : (state.errors?.newPassword?.[0]
                ? t(state.errors.newPassword[0] as 'auth.errWeakPassword')
                : t((state.messageKey ?? 'errors.serverErrorTitle') as 'errors.serverErrorTitle'))}
        </p>
      )}
    </form>
  )
}

function PrefsForm({ prefs, locale }: { prefs: Props['prefs']; locale: string }) {
  const t = useTranslations()
  const [state, setState] = useState<ActionState | null>(null)
  const [pending, startTransition] = useTransition()

  const submit = (fd: FormData) => {
    startTransition(async () => {
      const r = await saveUiPreferences({ ok: false }, fd)
      setState(r)
    })
  }

  return (
    <form action={submit} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <label className="flex cursor-pointer items-center gap-2.5 text-sm">
        <input
          type="checkbox"
          name="notificationsEnabled"
          defaultChecked={prefs.notificationsEnabled}
          className="h-4 w-4 rounded accent-[hsl(var(--primary))]"
        />
        {t('notifications.enable')}
      </label>
      <label className="flex cursor-pointer items-center gap-2.5 text-sm">
        <input
          type="checkbox"
          name="emailEnabled"
          defaultChecked={prefs.emailEnabled}
          className="h-4 w-4 rounded accent-[hsl(var(--primary))]"
        />
        {t('notifications.emailEnabled')}
      </label>
      <Button type="submit" size="sm" loading={pending}>
        <Database size={14} /> {t('common.save')}
      </Button>
      {state?.ok && (
        <p className="text-sm font-medium text-[hsl(var(--success))]">{t('common.save')}</p>
      )}
    </form>
  )
}
