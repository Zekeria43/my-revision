'use client'

import { useMemo, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  RotateCcw,
  Trash2,
  CheckCircle2,
  XCircle,
  History,
} from 'lucide-react'
import {
  createSession,
  deleteSession,
  rescheduleSession,
  setSessionStatus,
  suggestReschedule,
  updateSession,
} from '@/actions/sessions'
import type { ActionState } from '@/actions/auth'
import { Badge, Button, Card, EmptyState, Input, Select, Tabs, Textarea } from '@/components/ui'
import { DField, FormDialog } from '@/components/form-dialog'
import { useDateFormat } from '@/components/date-format'
import { cn } from '@/lib/utils'

export interface SessionRow {
  id: string
  date: string
  startTime: string
  endTime: string
  durationMinutes: number
  status: string
  priority: string
  source: string
  notes: string | null
  subjectId: string
  subjectName: string
  subjectColor: string
  chapterId: string | null
  chapterTitle: string | null
  lessonId: string | null
  lessonTitle: string | null
}

interface SubjectOption {
  id: string
  name: string
  color: string
  chapters: { id: string; title: string; lessons: { id: string; title: string }[] }[]
}

export interface HistoryRow {
  id: string
  reason: string | null
  rescheduledAt: string
  originalStatus: string
  newStatus: string | null
  originalDate: string
  newDate: string | null
  original: { id: string; startTime: string; endTime: string; subjectName: string; subjectColor: string; lessonTitle: string | null }
  next: { id: string; startTime: string; endTime: string; status: string; subjectName: string; subjectColor: string; lessonTitle: string | null } | null
}

type View = 'day' | 'week' | 'month'

const STATUS_COLOR: Record<string, string> = {
  SCHEDULED: 'hsl(var(--primary))',
  COMPLETED: 'hsl(var(--success))',
  MISSED: 'hsl(var(--danger))',
  POSTPONED: 'hsl(var(--warning))',
  CANCELLED: 'hsl(var(--muted-foreground))',
}

const initial: ActionState = { ok: false }
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function CalendarClient({
  sessions,
  subjects,
  history,
  locale,
}: {
  sessions: SessionRow[]
  subjects: SubjectOption[]
  history: HistoryRow[]
  locale: string
}) {
  const t = useTranslations()
  const fmt = useDateFormat()
  const [isPending, startTransition] = useTransition()

  const [view, setView] = useState<View>('week')
  const [cursor, setCursor] = useState(() => new Date())
  const [tab, setTab] = useState('calendar')

  const [form, setForm] = useState<{ open: boolean; edit?: SessionRow; date?: string }>({ open: false })
  const [detail, setDetail] = useState<SessionRow | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [suggestion, setSuggestion] = useState<{ date: string; startTime: string; endTime: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const flash = (m: string) => {
    setToast(m)
    setTimeout(() => setToast(null), 3000)
  }

  const byDate = useMemo(() => {
    const m = new Map<string, SessionRow[]>()
    for (const s of sessions) {
      const arr = m.get(s.date) ?? []
      arr.push(s)
      m.set(s.date, arr)
    }
    for (const arr of m.values()) arr.sort((a, b) => a.startTime.localeCompare(b.startTime))
    return m
  }, [sessions])

  const missed = useMemo(
    () => sessions.filter((s) => s.status === 'MISSED').sort((a, b) => b.date.localeCompare(a.date)),
    [sessions],
  )

  const shift = (n: number) => {
    const d = new Date(cursor)
    if (view === 'day') d.setDate(d.getDate() + n)
    else if (view === 'week') d.setDate(d.getDate() + n * 7)
    else d.setMonth(d.getMonth() + n)
    setCursor(d)
  }

  const changeStatus = (s: SessionRow, status: string) => {
    const fd = new FormData()
    fd.set('id', s.id)
    fd.set('status', status)
    fd.set('locale', locale)
    startTransition(async () => {
      const r = await setSessionStatus(fd)
      if (r.ok) {
        flash(t('common.save'))
        setDetail(null)
      } else if (r.messageKey) flash(t(r.messageKey as 'errors.serverErrorTitle'))
    })
  }

  const remove = async (s: SessionRow) => {
    if (!window.confirm(t('calendar.deleteConfirm'))) return
    setBusy(true)
    try {
      await deleteSession(s.id, locale)
      setDetail(null)
      flash(t('common.delete'))
    } finally {
      setBusy(false)
    }
  }

  const loadSuggestion = async (s: SessionRow) => {
    setBusy(true)
    try {
      const r = await suggestReschedule(s.id)
      if (r.ok && r.suggestion) setSuggestion(r.suggestion)
      else flash(t((r.messageKey ?? 'planner.noAvailableTime') as 'planner.noAvailableTime'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'calendar', label: t('calendar.title') },
          { id: 'missed', label: t('missed.title'), count: missed.length },
        ]}
      />

      {tab === 'calendar' ? (
        <div className="space-y-4 animate-fade-in">
          {/* ── Toolbar ── */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1">
              <button
                onClick={() => shift(-1)}
                aria-label={t('calendar.prev')}
                className="grid h-10 w-10 place-items-center rounded-xl border hover:bg-[hsl(var(--muted))]"
              >
                <ChevronLeft size={17} />
              </button>
              <button
                onClick={() => setCursor(new Date())}
                className="btn-outline h-10 px-4"
              >
                {t('calendar.today')}
              </button>
              <button
                onClick={() => shift(1)}
                aria-label={t('calendar.next')}
                className="grid h-10 w-10 place-items-center rounded-xl border hover:bg-[hsl(var(--muted))]"
              >
                <ChevronRight size={17} />
              </button>
            </div>

            <p className="min-w-0 flex-1 truncate font-bold">
              {view === 'day'
                ? fmt.date(cursor, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
                : view === 'week'
                  ? fmt.date(cursor, { year: 'numeric', month: 'long', day: 'numeric' })
                  : fmt.date(cursor, { year: 'numeric', month: 'long' })}
            </p>

            <Tabs
              value={view}
              onChange={(v) => setView(v as View)}
              tabs={[
                { id: 'day', label: t('calendar.day') },
                { id: 'week', label: t('calendar.week') },
                { id: 'month', label: t('calendar.month') },
              ]}
            />

            <Button onClick={() => setForm({ open: true })}>
              <Plus size={16} /> {t('calendar.addSession')}
            </Button>
          </div>

          {view === 'month' ? (
            <MonthView
              cursor={cursor}
              byDate={byDate}
              fmt={fmt}
              onOpen={setDetail}
              onAdd={(d) => setForm({ open: true, date: d })}
            />
          ) : view === 'week' ? (
            <WeekView
              cursor={cursor}
              byDate={byDate}
              fmt={fmt}
              onOpen={setDetail}
              onAdd={(d) => setForm({ open: true, date: d })}
            />
          ) : (
            <DayView
              cursor={cursor}
              byDate={byDate}
              fmt={fmt}
              onOpen={setDetail}
              onAdd={() => setForm({ open: true, date: iso(cursor) })}
            />
          )}
        </div>
      ) : (
        <div className="space-y-4 animate-fade-in">
          <Card>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-base font-bold">
                  <XCircle size={16} className="text-[hsl(var(--danger))]" />
                  {t('missed.title')}
                </h2>
                <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                  {t('missed.subtitle')}
                </p>
              </div>
            </div>

            {missed.length === 0 ? (
              <EmptyState
                icon={<CheckCircle2 size={22} />}
                title={t('missed.empty')}
                description={t('dashboard.subtitle')}
              />
            ) : (
              <ul className="space-y-3">
                {missed.map((s) => (
                  <li key={s.id} className="rounded-xl border p-4">
                    <div className="flex flex-wrap items-start gap-3">
                      <span
                        className="h-11 w-1.5 shrink-0 rounded-full"
                        style={{ background: s.subjectColor }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold">{s.subjectName}</p>
                          <Badge color={STATUS_COLOR.MISSED}>
                            {t('calendar.status.MISSED')}
                          </Badge>
                          <Badge>{fmt.date(s.date)}</Badge>
                          <Badge>{s.startTime} – {s.endTime}</Badge>
                        </div>
                        {s.lessonTitle && (
                          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                            {s.lessonTitle}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => loadSuggestion(s)}
                        >
                          <Clock size={14} /> {t('missed.reschedule')}
                        </Button>
                        <Button size="sm" onClick={() => setDetail(s)}>
                          {t('missed.reschedule')}
                        </Button>
                      </div>
                    </div>

                    {suggestion && (
                      <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-[hsl(var(--primary)/0.4)] bg-[hsl(var(--primary)/0.08)] p-3 text-sm">
                        <span className="font-semibold">
                          {t('missed.suggested', {
                            date: fmt.date(suggestion.date),
                            start: suggestion.startTime,
                            end: suggestion.endTime,
                          })}
                        </span>
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={async () => {
                            const fd = new FormData()
                            fd.set('sessionId', s.id)
                            fd.set('date', suggestion.date)
                            fd.set('startTime', suggestion.startTime)
                            fd.set('endTime', suggestion.endTime)
                            fd.set('reason', 'auto')
                            fd.set('locale', locale)
                            setBusy(true)
                            try {
                              const r = await rescheduleSession(initial, fd)
                              flash(r.ok ? t('missed.saved') : t((r.messageKey ?? 'errors.serverErrorTitle') as 'errors.serverErrorTitle'))
                              if (r.ok) setSuggestion(null)
                            } finally {
                              setBusy(false)
                            }
                          }}
                        >
                          {t('missed.acceptSuggestion')}
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* ── Rescheduling history ── */}
          <Card>
            <h2 className="mb-4 flex items-center gap-2 text-base font-bold">
              <History size={16} className="text-[hsl(var(--accent))]" />
              {t('missed.history')}
            </h2>
            {history.length === 0 ? (
              <p className="py-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
                {t('missed.noHistory')}
              </p>
            ) : (
              <ol className="relative space-y-4 border-e-2 border-dashed ps-0 pe-5">
                {history.map((h) => (
                  <li key={h.id} className="relative">
                    <span className="absolute -end-[27px] top-3 h-3 w-3 rounded-full border-2 border-[hsl(var(--background))] bg-[hsl(var(--accent))]" />
                    <div className="rounded-xl border p-3.5">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
                        <Badge color={STATUS_COLOR[h.originalStatus]}>
                          {t(`calendar.status.${h.originalStatus}` as 'calendar.status.SCHEDULED')}
                        </Badge>
                        <span>→</span>
                        {h.newStatus && (
                          <Badge color={STATUS_COLOR[h.newStatus]}>
                            {t(`calendar.status.${h.newStatus}` as 'calendar.status.SCHEDULED')}
                          </Badge>
                        )}
                        <span className="ms-auto">{fmt.relative(h.rescheduledAt)}</span>
                      </div>

                      <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                        <div className="rounded-lg bg-[hsl(var(--surface))] p-2.5">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                            {t('missed.originalSession')}
                          </p>
                          <p className="mt-1 truncate text-sm font-semibold">
                            {h.original.subjectName}
                          </p>
                          <p className="text-xs text-[hsl(var(--muted-foreground))]">
                            {fmt.date(h.originalDate)} · {h.original.startTime}–{h.original.endTime}
                          </p>
                        </div>
                        <div className="rounded-lg border border-[hsl(var(--success)/0.4)] bg-[hsl(var(--success)/0.08)] p-2.5">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-[hsl(var(--success))]">
                            {t('missed.newSession')}
                          </p>
                          <p className="mt-1 truncate text-sm font-semibold">
                            {h.next?.subjectName ?? h.original.subjectName}
                          </p>
                          <p className="text-xs text-[hsl(var(--muted-foreground))]">
                            {h.newDate ? fmt.date(h.newDate) : '—'} ·{' '}
                            {h.next ? `${h.next.startTime}–${h.next.endTime}` : '—'}
                          </p>
                        </div>
                      </div>

                      {h.reason && (
                        <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
                          {t('missed.reason')}: {h.reason}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      )}

      {/* ── Create / edit session ── */}
      <FormDialog
        open={form.open}
        onClose={() => setForm({ open: false })}
        title={form.edit?.id ? t('calendar.editSession') : t('calendar.addSession')}
        action={
          form.edit?.id ? (p, fd) => updateSession(form.edit!.id, p, fd) : createSession
        }
      >
        <SessionFields
          subjects={subjects}
          locale={locale}
          defaults={form.edit}
          defaultDate={form.date ?? form.edit?.date ?? iso(cursor)}
        />
      </FormDialog>

      {/* ── Detail / actions ── */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setDetail(null)} />
          <div className="relative max-h-[90vh] w-full overflow-y-auto rounded-t-3xl border bg-[hsl(var(--card))] p-5 shadow-2xl animate-fade-in-up sm:max-w-lg sm:rounded-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className="h-11 w-1.5 shrink-0 rounded-full"
                  style={{ background: detail.subjectColor }}
                />
                <div className="min-w-0">
                  <p className="truncate font-extrabold">{detail.subjectName}</p>
                  <p className="truncate text-sm text-[hsl(var(--muted-foreground))]">
                    {detail.lessonTitle ?? detail.chapterTitle ?? '—'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDetail(null)}
                aria-label={t('common.close')}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg hover:bg-[hsl(var(--muted))]"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Badge color={STATUS_COLOR[detail.status]}>
                {t(`calendar.status.${detail.status}` as 'calendar.status.SCHEDULED')}
              </Badge>
              <Badge>{fmt.date(detail.date, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</Badge>
              <Badge>
                {detail.startTime} – {detail.endTime} · {detail.durationMinutes} {t('common.minutes')}
              </Badge>
              <Badge color="hsl(var(--accent))">
                {t(`lessons.priority.${detail.priority}` as 'lessons.priority.LOW')}
              </Badge>
              {detail.source === 'AUTO' && <Badge>{t('planner.autoMode')}</Badge>}
            </div>

            {detail.notes && (
              <p className="mt-3 rounded-xl bg-[hsl(var(--surface))] p-3 text-sm leading-relaxed">
                {detail.notes}
              </p>
            )}

            <div className="mt-5 grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                disabled={isPending || detail.status === 'COMPLETED'}
                onClick={() => changeStatus(detail, 'COMPLETED')}
              >
                <CheckCircle2 size={15} /> {t('calendar.markCompleted')}
              </Button>
              <Button
                variant="outline"
                disabled={isPending || detail.status === 'MISSED'}
                onClick={() => changeStatus(detail, 'MISSED')}
              >
                <XCircle size={15} /> {t('calendar.markMissed')}
              </Button>
              <Button
                variant="outline"
                disabled={isPending}
                onClick={() => {
                  setForm({ open: true, edit: detail })
                  setDetail(null)
                }}
              >
                <RotateCcw size={15} /> {t('common.edit')}
              </Button>
              <Button variant="danger" disabled={busy} onClick={() => remove(detail)}>
                <Trash2 size={15} /> {t('common.delete')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div role="status" className="fixed bottom-5 inset-x-0 z-[70] flex justify-center px-4 animate-fade-in-up">
          <div className="flex items-center gap-2 rounded-xl border bg-[hsl(var(--card))] px-4 py-2.5 text-sm font-medium shadow-2xl">
            <CheckCircle2 size={16} className="text-[hsl(var(--success))]" />
            {toast}
          </div>
        </div>
      )}
    </div>
  )
}

/* ───────────────────────── Shared form fields ───────────────────────── */

function SessionFields({
  subjects,
  locale,
  defaults,
  defaultDate,
}: {
  subjects: SubjectOption[]
  locale: string
  defaults?: Partial<SessionRow>
  defaultDate: string
}) {
  const t = useTranslations()
  const [subjectId, setSubjectId] = useState(defaults?.subjectId ?? subjects[0]?.id ?? '')
  const subject = subjects.find((s) => s.id === subjectId)
  const [chapterId, setChapterId] = useState(defaults?.chapterId ?? '')
  const chapter = subject?.chapters.find((c) => c.id === chapterId)

  return (
    <>
      <input type="hidden" name="locale" value={locale} />

      <DField label={t('calendar.subject')} htmlFor="subjectId" required>
        <Select
          id="subjectId"
          name="subjectId"
          required
          value={subjectId}
          onChange={(e) => {
            setSubjectId(e.target.value)
            setChapterId('')
          }}
        >
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </DField>

      <div className="grid gap-4 sm:grid-cols-2">
        <DField label={t('calendar.chapter')} htmlFor="chapterId">
          <Select
            id="chapterId"
            name="chapterId"
            value={chapterId}
            onChange={(e) => setChapterId(e.target.value)}
          >
            <option value="">— {t('common.none')} —</option>
            {(subject?.chapters ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </Select>
        </DField>

        <DField label={t('calendar.lesson')} htmlFor="lessonId">
          <Select id="lessonId" name="lessonId" defaultValue={defaults?.lessonId ?? ''}>
            <option value="">— {t('common.none')} —</option>
            {(chapter?.lessons ?? []).map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
          </Select>
        </DField>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <DField label={t('common.date')} htmlFor="date" required className="sm:col-span-1">
          <Input id="date" name="date" type="date" required defaultValue={defaults?.date ?? defaultDate} />
        </DField>
        <DField label={t('calendar.startTime')} htmlFor="startTime" required>
          <Input
            id="startTime"
            name="startTime"
            type="time"
            required
            dir="ltr"
            defaultValue={defaults?.startTime ?? '18:00'}
          />
        </DField>
        <DField label={t('calendar.endTime')} htmlFor="endTime" required>
          <Input
            id="endTime"
            name="endTime"
            type="time"
            required
            dir="ltr"
            defaultValue={defaults?.endTime ?? '19:00'}
          />
        </DField>
      </div>

      <DField label={t('common.priority')} htmlFor="priority">
        <Select id="priority" name="priority" defaultValue={defaults?.priority ?? 'MEDIUM'}>
          {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((v) => (
            <option key={v} value={v}>
              {t(`lessons.priority.${v}` as 'lessons.priority.LOW')}
            </option>
          ))}
        </Select>
      </DField>

      <DField label={t('common.notes')} htmlFor="notes">
        <Textarea
          id="notes"
          name="notes"
          rows={3}
          placeholder={t('calendar.notesPlaceholder')}
          defaultValue={defaults?.notes ?? ''}
        />
      </DField>
    </>
  )
}

/* ───────────────────────── Views ───────────────────────── */

function SessionChip({
  s,
  onOpen,
}: {
  s: SessionRow
  onOpen: (s: SessionRow) => void
}) {
  return (
    <button
      onClick={() => onOpen(s)}
      className="w-full truncate rounded-lg border-s-2 px-2 py-1.5 text-start text-[11px] font-medium leading-tight transition hover:brightness-110"
      style={{
        borderInlineStartColor: s.subjectColor,
        background: `${s.subjectColor}1a`,
        color: 'hsl(var(--foreground))',
        opacity: s.status === 'CANCELLED' ? 0.5 : 1,
      }}
      title={`${s.subjectName} · ${s.startTime}–${s.endTime}`}
    >
      <span className="block truncate font-bold">{s.subjectName}</span>
      <span className="block truncate text-[10px] opacity-75" dir="ltr">
        {s.startTime}–{s.endTime}
        {s.status === 'COMPLETED' ? ' ✓' : s.status === 'MISSED' ? ' ✕' : ''}
      </span>
    </button>
  )
}

function DayView({
  cursor,
  byDate,
  fmt,
  onOpen,
  onAdd,
}: {
  cursor: Date
  byDate: Map<string, SessionRow[]>
  fmt: ReturnType<typeof useDateFormat>
  onOpen: (s: SessionRow) => void
  onAdd: () => void
}) {
  const t = useTranslations()
  const key = iso(cursor)
  const list = byDate.get(key) ?? []

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <p className="font-bold">{fmt.date(cursor, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          {list.length} {t('calendar.scheduledSessions')}
        </p>
      </div>

      {list.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="text-sm font-semibold">{t('calendar.freeDay')}</p>
          <Button size="sm" className="mt-4" onClick={onAdd}>
            <Plus size={14} /> {t('calendar.addSession')}
          </Button>
        </div>
      ) : (
        <div className="divide-y">
          {list.map((s) => (
            <button
              key={s.id}
              onClick={() => onOpen(s)}
              className="flex w-full items-center gap-4 px-4 py-3.5 text-start transition hover:bg-[hsl(var(--surface))]"
            >
              <div className="w-24 shrink-0 text-center" dir="ltr">
                <p className="text-sm font-extrabold tabular-nums">{s.startTime}</p>
                <p className="text-[11px] text-[hsl(var(--muted-foreground))]">{s.endTime}</p>
              </div>
              <span className="h-11 w-1.5 shrink-0 rounded-full" style={{ background: s.subjectColor }} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{s.subjectName}</p>
                <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                  {s.lessonTitle ?? s.chapterTitle ?? ''}
                </p>
              </div>
              <Badge color={STATUS_COLOR[s.status]}>
                {t(`calendar.status.${s.status}` as 'calendar.status.SCHEDULED')}
              </Badge>
            </button>
          ))}
        </div>
      )}

      <div className="border-t px-4 py-3 text-xs text-[hsl(var(--muted-foreground))]">
        {list.length > 0 && (
          <span>
            {t('calendar.hoursPlanned')}:{' '}
            <strong>
              {(list.reduce((a, s) => a + s.durationMinutes, 0) / 60).toFixed(1)} {t('common.hours')}
            </strong>
          </span>
        )}
      </div>
    </Card>
  )
}

function WeekView({
  cursor,
  byDate,
  fmt,
  onOpen,
  onAdd,
}: {
  cursor: Date
  byDate: Map<string, SessionRow[]>
  fmt: ReturnType<typeof useDateFormat>
  onOpen: (s: SessionRow) => void
  onAdd: (d: string) => void
}) {
  const t = useTranslations()
  const start = new Date(cursor)
  start.setDate(cursor.getDate() - cursor.getDay())

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
  const todayKey = iso(new Date())

  return (
    <div className="grid gap-3 md:grid-cols-7">
      {days.map((d) => {
        const key = iso(d)
        const list = byDate.get(key) ?? []
        const isToday = key === todayKey
        return (
          <div
            key={key}
            className={cn(
              'card flex min-h-44 flex-col p-2.5',
              isToday && 'border-[hsl(var(--primary))] ring-1 ring-[hsl(var(--primary)/0.35)]',
            )}
          >
            <div className="mb-2 flex items-center justify-between gap-1">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                  {fmt.weekday(d, false)}
                </p>
                <p className="text-sm font-extrabold tabular-nums">{d.getDate()}</p>
              </div>
              <button
                onClick={() => onAdd(key)}
                aria-label={t('calendar.addSession')}
                className="grid h-7 w-7 place-items-center rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
              >
                <Plus size={14} />
              </button>
            </div>

            <div className="flex-1 space-y-1.5">
              {list.length === 0 ? (
                <p className="pt-4 text-center text-[10px] text-[hsl(var(--muted-foreground))]">—</p>
              ) : (
                list.map((s) => <SessionChip key={s.id} s={s} onOpen={onOpen} />)
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function MonthView({
  cursor,
  byDate,
  fmt,
  onOpen,
  onAdd,
}: {
  cursor: Date
  byDate: Map<string, SessionRow[]>
  fmt: ReturnType<typeof useDateFormat>
  onOpen: (s: SessionRow) => void
  onAdd: (d: string) => void
}) {
  const t = useTranslations()
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
  const start = new Date(first)
  start.setDate(1 - first.getDay())
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
  const todayKey = iso(new Date())
  const dayNames = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(2024, 0, 7 + i)
    return fmt.weekday(d, false)
  })

  return (
    <Card className="overflow-hidden p-0">
      <div className="grid grid-cols-7 border-b bg-[hsl(var(--surface))]">
        {dayNames.map((n, i) => (
          <div key={i} className="px-1 py-2.5 text-center text-[10px] font-bold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            {n}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const key = iso(d)
          const list = byDate.get(key) ?? []
          const outside = d.getMonth() !== cursor.getMonth()
          const isToday = key === todayKey
          return (
            <div
              key={key}
              className={cn(
                'min-h-24 border-b border-e p-1.5 last:border-e-0',
                outside && 'bg-[hsl(var(--surface))] opacity-45',
                isToday && 'bg-[hsl(var(--primary)/0.08)]',
              )}
            >
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={cn(
                    'grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold tabular-nums',
                    isToday && 'bg-[hsl(var(--primary))] text-white',
                  )}
                >
                  {d.getDate()}
                </span>
                <button
                  onClick={() => onAdd(key)}
                  aria-label={t('calendar.addSession')}
                  className="grid h-6 w-6 place-items-center rounded-md text-[hsl(var(--muted-foreground))] opacity-0 transition hover:bg-[hsl(var(--muted))] focus:opacity-100 group-hover:opacity-100 sm:opacity-60"
                >
                  <Plus size={12} />
                </button>
              </div>
              <div className="space-y-1">
                {list.slice(0, 3).map((s) => (
                  <SessionChip key={s.id} s={s} onOpen={onOpen} />
                ))}
                {list.length > 3 && (
                  <p className="px-1 text-[10px] font-semibold text-[hsl(var(--muted-foreground))]">
                    +{list.length - 3} {t('common.more')}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
