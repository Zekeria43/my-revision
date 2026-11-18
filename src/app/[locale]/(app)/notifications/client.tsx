'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import {
  Bell,
  BellOff,
  BellRing,
  CalendarClock,
  CalendarX,
  CheckCheck,
  FlaskConical,
  GraduationCap,
  Mail,
  Sparkles,
  Timer,
  Trash2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  clearReadNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  setNotificationPreference,
} from '@/actions/notifications'
import { Badge, Button, Card, CardHeader, EmptyState, Input, Progress } from '@/components/ui'
import { DField } from '@/components/form-dialog'
import { useDateFormat } from '@/components/date-format'
import { cn } from '@/lib/utils'

export interface NotificationRow {
  id: string
  type: string
  titleKey: string
  bodyKey: string
  params: Record<string, string | number>
  link: string | null
  readAt: string | null
  createdAt: string
}

const TYPE_ICON: Record<string, LucideIcon> = {
  SESSION_REMINDER: BellRing,
  SESSION_MISSED: CalendarX,
  EXAM_UPCOMING: FlaskConical,
  PROGRESS_SUMMARY: GraduationCap,
  GOAL_ACHIEVED: Sparkles,
  LESSON_OVERDUE: Timer,
  RESCHEDULE_SUGGESTION: CalendarClock,
}

const TYPE_COLOR: Record<string, string> = {
  SESSION_REMINDER: 'hsl(var(--primary))',
  SESSION_MISSED: 'hsl(var(--danger))',
  EXAM_UPCOMING: '#a855f7',
  PROGRESS_SUMMARY: 'hsl(var(--success))',
  GOAL_ACHIEVED: 'hsl(var(--accent))',
  LESSON_OVERDUE: 'hsl(var(--warning))',
  RESCHEDULE_SUGGESTION: '#06b6d4',
}

export function NotificationsClient({
  notifications,
  unreadCount,
  byType,
  prefs,
  locale,
}: {
  notifications: NotificationRow[]
  unreadCount: number
  byType: { type: string; count: number }[]
  prefs: { notificationsEnabled: boolean; emailEnabled: boolean; remindBeforeMin: number }
  locale: string
}) {
  const t = useTranslations()
  const fmt = useDateFormat()
  const [isPending, startTransition] = useTransition()
  const [toast, setToast] = useState<string | null>(null)

  const flash = (m: string) => {
    setToast(m)
    setTimeout(() => setToast(null), 3500)
  }

  /** Best-effort translation: stored keys may live in either namespace. */
  const translate = (key: string, params?: Record<string, string | number>) => {
    try {
      return t(key as 'notifications.empty', params)
    } catch {
      return key
    }
  }

  const markOne = (n: NotificationRow) => {
    const fd = new FormData()
    fd.set('id', n.id)
    fd.set('locale', locale)
    startTransition(async () => {
      const r = await markNotificationRead(fd)
      if (!r.ok && r.messageKey) flash(t(r.messageKey as 'errors.serverErrorTitle'))
    })
  }

  const markAll = () => {
    startTransition(async () => {
      const r = await markAllNotificationsRead(locale)
      flash(r.ok ? t('notifications.markAllRead') : t('errors.serverErrorTitle'))
    })
  }

  const clearRead = () => {
    if (!window.confirm(t('notes.deleteConfirm'))) return
    startTransition(async () => {
      const r = await clearReadNotifications(locale)
      flash(r.ok ? t('common.delete') : t('errors.serverErrorTitle'))
    })
  }

  const totalUnreadByType = byType.reduce((a, x) => a + x.count, 0)
  const readCount = notifications.length - notifications.filter((n) => !n.readAt).length
  const readPercent = notifications.length
    ? Math.round((readCount / notifications.length) * 100)
    : 100

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        {/* ─────────── List ─────────── */}
        <div className="space-y-4">
          <Card>
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={cn(
                  'grid h-11 w-11 shrink-0 place-items-center rounded-xl',
                  unreadCount > 0
                    ? 'bg-[hsl(var(--primary)/0.14)] text-[hsl(var(--primary))]'
                    : 'bg-[hsl(var(--success)/0.14)] text-[hsl(var(--success))]',
                )}
              >
                {unreadCount > 0 ? <BellRing size={20} /> : <Bell size={20} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-extrabold">
                  {unreadCount > 0
                    ? t('notifications.unread', { n: unreadCount })
                    : t('notifications.empty')}
                </p>
                <div className="mt-1.5 max-w-56">
                  <Progress value={readPercent} showLabel={false} />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={markAll}
                  disabled={isPending || unreadCount === 0}
                >
                  <CheckCheck size={14} /> {t('notifications.markAllRead')}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={clearRead}
                  disabled={isPending || readCount === 0}
                >
                  <Trash2 size={14} /> {t('common.delete')}
                </Button>
              </div>
            </div>
          </Card>

          {notifications.length === 0 ? (
            <EmptyState
              icon={<Bell size={22} />}
              title={t('notifications.empty')}
              description={t('dashboard.subtitle')}
            />
          ) : (
            <ul className="space-y-2.5">
              {notifications.map((n) => {
                const Icon = TYPE_ICON[n.type] ?? Bell
                const color = TYPE_COLOR[n.type] ?? 'hsl(var(--primary))'
                const isUnread = !n.readAt
                return (
                  <li key={n.id}>
                    <div
                      className={cn(
                        'relative flex items-start gap-3 rounded-xl border p-3.5 transition',
                        isUnread
                          ? 'border-[hsl(var(--primary)/0.35)] bg-[hsl(var(--primary)/0.05)]'
                          : 'opacity-75 hover:opacity-100',
                      )}
                    >
                      {isUnread && (
                        <span
                          className="absolute inset-y-3 start-0 w-1 rounded-full"
                          style={{ background: color }}
                        />
                      )}
                      <span
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                        style={{ background: `${color}1f`, color }}
                      >
                        <Icon size={17} />
                      </span>

                      <div className="min-w-0 flex-1 ps-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-bold">
                            {translate(n.titleKey, n.params)}
                          </p>
                          <Badge color={color}>
                            {t(`notifications.type.${n.type}` as 'notifications.type.SESSION_REMINDER')}
                          </Badge>
                        </div>
                        <p className="mt-0.5 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">
                          {translate(n.bodyKey, n.params)}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <span className="text-[11px] text-[hsl(var(--muted-foreground))]">
                            {fmt.relative(n.createdAt)}
                          </span>
                          {n.link && (
                            <a
                              href={n.link}
                              className="text-[11px] font-semibold text-[hsl(var(--primary))] hover:underline"
                            >
                              {t('common.more')}
                            </a>
                          )}
                        </div>
                      </div>

                      {isUnread && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0"
                          disabled={isPending}
                          onClick={() => markOne(n)}
                        >
                          {t('notifications.markRead')}
                        </Button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* ─────────── Preferences ─────────── */}
        <div className="space-y-4">
          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <Bell size={16} className="text-[hsl(var(--primary))]" />
                  {t('notifications.preferences')}
                </span>
              }
            />
            <PrefsForm prefs={prefs} locale={locale} />
          </Card>

          <Card>
            <CardHeader title={t('notifications.title')} />
            {byType.length === 0 ? (
              <p className="py-4 text-center text-sm text-[hsl(var(--muted-foreground))]">
                {t('notifications.empty')}
              </p>
            ) : (
              <ul className="space-y-2">
                {byType.map((b) => {
                  const Icon = TYPE_ICON[b.type] ?? Bell
                  const color = TYPE_COLOR[b.type] ?? 'hsl(var(--primary))'
                  const pct = totalUnreadByType ? (b.count / totalUnreadByType) * 100 : 0
                  return (
                    <li key={b.type} className="flex items-center gap-3">
                      <span
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
                        style={{ background: `${color}1f`, color }}
                      >
                        <Icon size={14} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold">
                          {t(`notifications.type.${b.type}` as 'notifications.type.SESSION_REMINDER')}
                        </p>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[hsl(var(--muted))]">
                          <span
                            className="block h-full rounded-full"
                            style={{ width: `${pct}%`, background: color }}
                          />
                        </div>
                      </div>
                      <span className="text-xs font-extrabold tabular-nums">{b.count}</span>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {toast && (
        <div role="status" className="fixed bottom-5 inset-x-0 z-[70] flex justify-center px-4 animate-fade-in-up">
          <div className="flex items-center gap-2 rounded-xl border bg-[hsl(var(--card))] px-4 py-2.5 text-sm font-medium shadow-2xl">
            {toast}
          </div>
        </div>
      )}
    </div>
  )
}

/* ───────────────────────── Preferences ───────────────────────── */

function PrefsForm({
  prefs,
  locale,
}: {
  prefs: { notificationsEnabled: boolean; emailEnabled: boolean; remindBeforeMin: number }
  locale: string
}) {
  const t = useTranslations()
  const [state, setState] = useState<{ ok: boolean; messageKey?: string } | null>(null)
  const [pending, startTransition] = useTransition()

  const submit = (fd: FormData) => {
    startTransition(async () => {
      const r = await setNotificationPreference({ ok: false }, fd)
      setState({ ok: r.ok, messageKey: r.messageKey })
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
        <span className="flex items-center gap-1.5">
          <Mail size={14} /> {t('notifications.emailEnabled')}
        </span>
      </label>

      <DField label={t('notifications.remindBefore')} htmlFor="remindBeforeMin">
        <Input
          id="remindBeforeMin"
          name="remindBeforeMin"
          type="number"
          min={0}
          max={1440}
          defaultValue={prefs.remindBeforeMin}
        />
      </DField>

      <Button type="submit" size="sm" loading={pending} className="w-full">
        <BellOff size={14} /> {t('common.save')}
      </Button>

      {state && (
        <p
          className={cn(
            'text-center text-xs font-medium',
            state.ok ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--danger))]',
          )}
        >
          {state.ok
            ? t('common.save')
            : t((state.messageKey ?? 'errors.serverErrorTitle') as 'errors.serverErrorTitle')}
        </p>
      )}
    </form>
  )
}
