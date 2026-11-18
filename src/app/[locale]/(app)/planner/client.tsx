'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { CalendarClock, Check, Clock, Plus, Sparkles, Trash2, X } from 'lucide-react'
import {
  addAvailability,
  confirmPlan,
  previewPlan,
  removeAvailability,
  savePreferences,
} from '@/actions/sessions'
import type { ActionState } from '@/actions/auth'
import type { PlanPreview } from '@/actions/sessions'
import { Badge, Button, Card, CardHeader, EmptyState, Input, Progress, Select } from '@/components/ui'
import { DField, FormDialog } from '@/components/form-dialog'
import { useDateFormat } from '@/components/date-format'
import { cn } from '@/lib/utils'

export interface AvailabilityRow {
  id: string
  weekday: number
  startTime: string
  endTime: string
  dayKey: string
}
export interface PrefRow {
  maxDailyMinutes: number
  preferredSessionMin: number
  breakMinutes: number
  remindBeforeMin: number
  pomodoroStudyMin: number
  pomodoroBreakMin: number
  pomodoroLongBreakMin: number
  pomodoroCycles: number
  notificationsEnabled: boolean
  emailEnabled: boolean
}
interface SubjectRow {
  id: string
  name: string
  color: string
  priority: number
  importance: string
  examDate: string | null
  unscheduledLessons: number
}

const initial: ActionState = { ok: false }
const WEEKDAY_KEYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const

export function PlannerClient({
  availability,
  prefs,
  subjects,
  scheduledCount,
  locale,
}: {
  availability: AvailabilityRow[]
  prefs: PrefRow
  subjects: SubjectRow[]
  scheduledCount: number
  locale: string
}) {
  const t = useTranslations()
  const fmt = useDateFormat()
  const [isPending, startTransition] = useTransition()

  const [availDialog, setAvailDialog] = useState(false)
  const [selected, setSelected] = useState<string[]>(
    () => subjects.filter((s) => s.unscheduledLessons > 0).map((s) => s.id),
  )
  const [days, setDays] = useState(14)
  const [sessionMinutes, setSessionMinutes] = useState(prefs.preferredSessionMin)
  const [replaceExisting, setReplaceExisting] = useState(false)
  const [preview, setPreview] = useState<PlanPreview | null>(null)
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const withVars = (key: string, vars?: Record<string, string | number>) => {
    try {
      return t(key as 'planner.generated', vars)
    } catch {
      return key
    }
  }

  const runPreview = async () => {
    const fd = new FormData()
    selected.forEach((id) => fd.append('subjectIds', id))
    fd.set('days', String(days))
    fd.set('sessionMinutes', String(sessionMinutes))
    if (replaceExisting) fd.set('replaceExisting', 'on')
    setBusy(true)
    setMessage(null)
    try {
      const r = (await previewPlan(fd)) as ActionState & { preview?: PlanPreview }
      if (r.preview && r.preview.slots.length) {
        setPreview(r.preview)
        setMessage({
          kind: r.messageKey === 'planner.noAvailableTime' ? 'err' : 'ok',
          text: withVars(r.messageKey ?? 'planner.generated', r.vars),
        })
      } else {
        setPreview(null)
        setMessage({
          kind: r.ok ? 'err' : 'err',
          text: withVars(r.messageKey ?? 'planner.nothingToSchedule', r.vars),
        })
      }
    } catch {
      setMessage({ kind: 'err', text: t('errors.serverErrorTitle') })
    } finally {
      setBusy(false)
    }
  }

  const runConfirm = async () => {
    if (!preview) return
    const fd = new FormData()
    fd.set('slots', JSON.stringify(preview.slots))
    if (replaceExisting) fd.set('replaceExisting', 'on')
    fd.set('locale', locale)
    setBusy(true)
    try {
      const r = await confirmPlan(fd)
      if (r.ok) {
        setPreview(null)
        setMessage({ kind: 'ok', text: withVars(r.messageKey ?? 'planner.saved', r.vars) })
      } else {
        setMessage({ kind: 'err', text: withVars(r.messageKey ?? 'errors.serverErrorTitle', r.vars) })
      }
    } finally {
      setBusy(false)
    }
  }

  const removeAvail = async (id: string) => {
    setBusy(true)
    try {
      await removeAvailability(id, locale)
    } finally {
      setBusy(false)
    }
  }

  const totalLessons = subjects.reduce((a, s) => a + s.unscheduledLessons, 0)
  const plannedMinutes = preview?.slots.reduce((a, s) => a + s.durationMinutes, 0) ?? 0

  return (
    <div className="space-y-6">
      {/* ───────────── Availability + preferences ───────────── */}
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <Clock size={16} className="text-[hsl(var(--primary))]" />
                {t('planner.availability')}
              </span>
            }
            description={t('planner.availabilityHint')}
            action={
              <Button size="sm" onClick={() => setAvailDialog(true)} disabled={isPending}>
                <Plus size={14} /> {t('planner.addAvailability')}
              </Button>
            }
          />

          {availability.length === 0 ? (
            <EmptyState
              icon={<CalendarClock size={22} />}
              title={t('planner.noAvailability')}
              action={
                <Button size="sm" onClick={() => setAvailDialog(true)}>
                  <Plus size={14} /> {t('planner.addAvailability')}
                </Button>
              }
            />
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {availability.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-3 rounded-xl border bg-[hsl(var(--surface))] p-3"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary))]">
                    <Clock size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">
                      {t(`weekdays.${a.dayKey}` as 'weekdays.monday')}
                    </p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]" dir="ltr">
                      {a.startTime} – {a.endTime}
                    </p>
                  </div>
                  <button
                    aria-label={t('common.delete')}
                    disabled={busy}
                    onClick={() => removeAvail(a.id)}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[hsl(var(--danger))] hover:bg-[hsl(var(--danger)/0.12)]"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <Sparkles size={16} className="text-[hsl(var(--accent))]" />
                {t('planner.title')}
              </span>
            }
          />
          <PrefsForm prefs={prefs} locale={locale} />
        </Card>
      </div>

      {/* ───────────── Generation ───────────── */}
      <Card>
        <CardHeader
          title={t('planner.selectSubjects')}
          description={t('planner.algorithmNote')}
          action={
            <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
              <Badge color="hsl(var(--primary))">
                {scheduledCount} {t('planner.scheduled')}
              </Badge>
              <Badge color="hsl(var(--warning))">
                {totalLessons} {t('planner.unscheduled')}
              </Badge>
            </div>
          }
        />

        {subjects.length === 0 ? (
          <EmptyState
            icon={<Sparkles size={22} />}
            title={t('subjects.empty')}
            description={t('subjects.emptyHint')}
            action={
              <a href="/subjects" className="btn-primary">
                {t('dashboard.emptyCta')}
              </a>
            }
          />
        ) : (
          <>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {subjects.map((s) => {
                const on = selected.includes(s.id)
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setSelected((cur) =>
                        cur.includes(s.id) ? cur.filter((x) => x !== s.id) : [...cur, s.id],
                      )
                    }
                    className={cn(
                      'flex items-center gap-3 rounded-xl border p-3 text-start transition',
                      on
                        ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.08)] ring-1 ring-[hsl(var(--primary)/0.3)]'
                        : 'hover:bg-[hsl(var(--surface))]',
                    )}
                  >
                    <span
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xs font-extrabold text-white"
                      style={{ background: s.color }}
                    >
                      {on ? <Check size={14} /> : s.name.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{s.name}</p>
                      <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                        {s.unscheduledLessons} {t('planner.unscheduled')} ·{' '}
                        {t(`exams.importanceLevel.${s.importance}` as 'exams.importanceLevel.LOW')}
                      </p>
                    </div>
                    {s.examDate && (
                      <Badge color="hsl(var(--danger))">{fmt.monthDay(s.examDate)}</Badge>
                    )}
                  </button>
                )
              })}
            </div>

            <div className="mt-5 grid gap-4 border-t pt-5 sm:grid-cols-3">
              <div>
                <label htmlFor="days" className="label">
                  {t('planner.period')} ({days} {t('planner.periodDays')})
                </label>
                <input
                  id="days"
                  type="range"
                  min={1}
                  max={60}
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                  className="w-full accent-[hsl(var(--primary))]"
                />
              </div>
              <div>
                <label htmlFor="sess" className="label">
                  {t('planner.preferredSession')} ({sessionMinutes})
                </label>
                <input
                  id="sess"
                  type="range"
                  min={15}
                  max={180}
                  step={5}
                  value={sessionMinutes}
                  onChange={(e) => setSessionMinutes(Number(e.target.value))}
                  className="w-full accent-[hsl(var(--primary))]"
                />
              </div>
              <div className="flex items-end">
                <label className="flex cursor-pointer items-center gap-2.5 pb-2 text-sm">
                  <input
                    type="checkbox"
                    checked={replaceExisting}
                    onChange={(e) => setReplaceExisting(e.target.checked)}
                    className="h-4 w-4 rounded accent-[hsl(var(--accent))]"
                  />
                  {t('planner.clearExisting')}
                </label>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <Button
                onClick={runPreview}
                disabled={busy || selected.length === 0}
                loading={busy}
              >
                <Sparkles size={16} /> {preview ? t('planner.regenerate') : t('planner.generate')}
              </Button>
              {selected.length === 0 && (
                <p className="self-center text-sm text-[hsl(var(--danger))]">
                  {t('planner.noLessonsSelected')}
                </p>
              )}
            </div>

            {message && (
              <div
                role={message.kind === 'ok' ? 'status' : 'alert'}
                className={cn(
                  'mt-4 rounded-xl border p-3.5 text-sm font-medium',
                  message.kind === 'ok'
                    ? 'border-[hsl(var(--success)/0.4)] bg-[hsl(var(--success)/0.1)]'
                    : 'border-[hsl(var(--warning)/0.45)] bg-[hsl(var(--warning)/0.1)]',
                )}
              >
                {message.text}
              </div>
            )}
          </>
        )}
      </Card>

      {/* ───────────── Preview ───────────── */}
      {preview && preview.slots.length > 0 && (
        <Card className="border-[hsl(var(--primary)/0.45)] ring-1 ring-[hsl(var(--primary)/0.2)] animate-fade-in">
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <CalendarClock size={16} className="text-[hsl(var(--primary))]" />
                {t('planner.previewTitle')}
              </span>
            }
            description={t('planner.previewHint')}
            action={
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setPreview(null)} disabled={busy}>
                  <X size={15} /> {t('planner.cancelPreview')}
                </Button>
                <Button onClick={runConfirm} loading={busy}>
                  <Check size={15} /> {t('planner.confirmSchedule')}
                </Button>
              </div>
            }
          />

          <div className="mb-4 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-[hsl(var(--surface))] p-3">
              <p className="text-xl font-extrabold tabular-nums text-[hsl(var(--primary))]">
                {preview.slots.length}
              </p>
              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                {t('calendar.scheduledSessions')}
              </p>
            </div>
            <div className="rounded-xl bg-[hsl(var(--surface))] p-3">
              <p className="text-xl font-extrabold tabular-nums">
                {(plannedMinutes / 60).toFixed(1)}
              </p>
              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">{t('common.hours')}</p>
            </div>
            <div className="rounded-xl bg-[hsl(var(--surface))] p-3">
              <p className="text-xl font-extrabold tabular-nums">{preview.daysUsed}</p>
              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">{t('common.days')}</p>
            </div>
          </div>

          {preview.unscheduledCount > 0 && (
            <div className="mb-4 rounded-xl border border-[hsl(var(--warning)/0.45)] bg-[hsl(var(--warning)/0.1)] p-3 text-sm">
              {withVars('planner.noAvailableTime', { n: preview.unscheduledCount })}
            </div>
          )}

          <div className="space-y-3">
            {[...new Set(preview.slots.map((s) => s.date))].map((date) => (
              <div key={date}>
                <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                  {fmt.date(date, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
                <div className="space-y-1.5">
                  {preview.slots
                    .filter((s) => s.date === date)
                    .sort((a, b) => a.startTime.localeCompare(b.startTime))
                    .map((s, i) => (
                      <div
                        key={`${s.lessonId}-${i}`}
                        className="flex items-center gap-3 rounded-xl border bg-[hsl(var(--surface))] p-2.5"
                      >
                        <div className="w-20 shrink-0 text-center text-xs font-extrabold tabular-nums" dir="ltr">
                          {s.startTime}
                          <span className="block font-normal text-[hsl(var(--muted-foreground))]">
                            {s.endTime}
                          </span>
                        </div>
                        <span
                          className="h-9 w-1 shrink-0 rounded-full"
                          style={{ background: s.subjectColor }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{s.subjectName}</p>
                          <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                            {s.lessonTitle}
                          </p>
                        </div>
                        <Badge>{s.durationMinutes} {t('common.minutes')}</Badge>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5">
            <Progress
              value={
                totalLessons
                  ? Math.round((preview.slots.length / (preview.slots.length + preview.unscheduledCount)) * 100)
                  : 100
              }
              showLabel
            />
          </div>
        </Card>
      )}

      {/* ───────────── Availability dialog ───────────── */}
      <FormDialog
        open={availDialog}
        onClose={() => setAvailDialog(false)}
        title={t('planner.addAvailability')}
        action={addAvailability}
      >
        <input type="hidden" name="locale" value={locale} />
        <DField label={t('planner.weekday')} htmlFor="weekday" required>
          <Select id="weekday" name="weekday" required defaultValue="1">
            {WEEKDAY_KEYS.map((k, i) => (
              <option key={k} value={i}>
                {t(`weekdays.${k}` as 'weekdays.monday')}
              </option>
            ))}
          </Select>
        </DField>
        <div className="grid gap-4 sm:grid-cols-2">
          <DField label={t('planner.from')} htmlFor="startTime" required>
            <Input id="startTime" name="startTime" type="time" required dir="ltr" defaultValue="08:00" />
          </DField>
          <DField label={t('planner.to')} htmlFor="endTime" required>
            <Input id="endTime" name="endTime" type="time" required dir="ltr" defaultValue="12:00" />
          </DField>
        </div>
      </FormDialog>
    </div>
  )
}

/* ───────────────────────── Preferences form ───────────────────────── */

function PrefsForm({ prefs, locale }: { prefs: PrefRow; locale: string }) {
  const t = useTranslations()
  const [state, setState] = useState<ActionState | null>(null)
  const [pending, startTransition] = useTransition()

  const submit = (fd: FormData) => {
    startTransition(async () => {
      const r = await savePreferences({ ok: false }, fd)
      setState(r)
    })
  }

  return (
    <form action={submit} className="space-y-3">
      <input type="hidden" name="locale" value={locale} />

      <div className="grid gap-3 sm:grid-cols-2">
        <DField label={t('planner.maxDaily')} htmlFor="maxDailyMinutes">
          <Input
            id="maxDailyMinutes"
            name="maxDailyMinutes"
            type="number"
            min={30}
            max={960}
            defaultValue={prefs.maxDailyMinutes}
          />
        </DField>
        <DField label={t('planner.preferredSession')} htmlFor="preferredSessionMin">
          <Input
            id="preferredSessionMin"
            name="preferredSessionMin"
            type="number"
            min={10}
            max={240}
            defaultValue={prefs.preferredSessionMin}
          />
        </DField>
        <DField label={t('planner.breakDuration')} htmlFor="breakMinutes">
          <Input
            id="breakMinutes"
            name="breakMinutes"
            type="number"
            min={0}
            max={120}
            defaultValue={prefs.breakMinutes}
          />
        </DField>
        <DField label={t('notifications.remindBefore')} htmlFor="remindBeforeMin">
          <Input
            id="remindBeforeMin"
            name="remindBeforeMin"
            type="number"
            min={0}
            max={240}
            defaultValue={prefs.remindBeforeMin}
          />
        </DField>
      </div>

      <input type="hidden" name="pomodoroStudyMin" value={prefs.pomodoroStudyMin} />
      <input type="hidden" name="pomodoroBreakMin" value={prefs.pomodoroBreakMin} />
      <input type="hidden" name="pomodoroLongBreakMin" value={prefs.pomodoroLongBreakMin} />
      <input type="hidden" name="pomodoroCycles" value={prefs.pomodoroCycles} />

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

      <Button type="submit" size="sm" loading={pending} className="w-full">
        {t('common.save')}
      </Button>

      {state?.ok && (
        <p className="text-center text-xs font-medium text-[hsl(var(--success))]">
          {t('common.save')}
        </p>
      )}
      {state && !state.ok && state.messageKey && (
        <p className="text-center text-xs font-medium text-[hsl(var(--danger))]">
          {t(state.messageKey as 'errors.serverErrorTitle')}
        </p>
      )}
    </form>
  )
}
