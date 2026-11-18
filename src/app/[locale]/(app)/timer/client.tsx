'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Coffee, Flag, History, Pause, Play, RotateCcw, Save, Square, Timer } from 'lucide-react'
import { logTimerSession } from '@/actions/sessions'
import type { ActionState } from '@/actions/auth'
import { Badge, Button, Card, CardHeader, EmptyState, ProgressRing, Select, Tabs } from '@/components/ui'
import { useDateFormat } from '@/components/date-format'
import { cn } from '@/lib/utils'

export interface TimerHistoryRow {
  id: string
  date: string
  durationMinutes: number
  subjectName: string
  subjectColor: string
  lessonTitle: string | null
}

interface SubjectOption {
  id: string
  name: string
  color: string
  chapters: { id: string; title: string; lessons: { id: string; title: string }[] }[]
}

type Phase = 'focus' | 'break' | 'longBreak'

const PHASE_LABEL: Record<Phase, 'timer.focus' | 'timer.break' | 'timer.longBreak'> = {
  focus: 'timer.focus',
  break: 'timer.break',
  longBreak: 'timer.longBreak',
}

export function TimerClient({
  subjects,
  defaults,
  history,
  totalFocused,
  sessionCount,
  locale,
}: {
  subjects: SubjectOption[]
  defaults: { focus: number; break: number; longBreak: number; cycles: number }
  history: TimerHistoryRow[]
  totalFocused: number
  sessionCount: number
  locale: string
}) {
  const t = useTranslations()
  const fmt = useDateFormat()

  const [mode, setMode] = useState<'pomodoro' | 'stopwatch'>('pomodoro')
  const [phase, setPhase] = useState<Phase>('focus')
  const [cycle, setCycle] = useState(1)
  const [running, setRunning] = useState(false)
  const [remaining, setRemaining] = useState(defaults.focus * 60)
  const [elapsed, setElapsed] = useState(0) // stopwatch seconds
  const [focusedSeconds, setFocusedSeconds] = useState(0) // focus time accumulated this run

  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? '')
  const [chapterId, setChapterId] = useState('')
  const [lessonId, setLessonId] = useState('')

  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [leaveArmed, setLeaveArmed] = useState(false)

  const startedAtRef = useRef<string | null>(null)
  const subject = subjects.find((s) => s.id === subjectId)
  const chapter = subject?.chapters.find((c) => c.id === chapterId)

  const flash = (kind: 'ok' | 'err', text: string) => {
    setToast({ kind, text })
    setTimeout(() => setToast(null), 4000)
  }

  /* ── Ticking ─────────────────────────────────────────── */
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => {
      setElapsed((e) => e + 1)
      if (mode === 'pomodoro') {
        setRemaining((r) => {
          if (r <= 1) {
            // Phase finished — advance outside the updater.
            window.setTimeout(() => advancePhase(), 0)
            return 0
          }
          if (phase === 'focus') setFocusedSeconds((s) => s + 1)
          return r - 1
        })
      } else {
        setFocusedSeconds((s) => s + 1)
      }
    }, 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, mode, phase])

  const durations: Record<Phase, number> = {
    focus: defaults.focus * 60,
    break: defaults.break * 60,
    longBreak: defaults.longBreak * 60,
  }

  const advancePhase = useCallback(() => {
    setRunning(false)
    if (phase === 'focus') {
      if (cycle >= defaults.cycles) {
        setPhase('longBreak')
        setRemaining(durations.longBreak)
      } else {
        setPhase('break')
        setRemaining(durations.break)
      }
    } else {
      if (phase === 'longBreak') setCycle(1)
      setPhase('focus')
      setRemaining(durations.focus)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, cycle, defaults])

  /* ── Warn before leaving with a running timer ────────── */
  useEffect(() => {
    if (!running && !leaveArmed) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [running, leaveArmed])

  /* ── Controls ────────────────────────────────────────── */
  const start = () => {
    if (!startedAtRef.current) startedAtRef.current = new Date().toISOString()
    setRunning(true)
    setLeaveArmed(true)
  }
  const pause = () => setRunning(false)

  const reset = () => {
    setRunning(false)
    setLeaveArmed(false)
    setElapsed(0)
    setFocusedSeconds(0)
    startedAtRef.current = null
    if (mode === 'pomodoro') {
      setPhase('focus')
      setCycle(1)
      setRemaining(durations.focus)
    }
  }

  const switchMode = (m: string) => {
    setMode(m as 'pomodoro' | 'stopwatch')
    reset()
  }

  const switchPhase = (p: Phase) => {
    setRunning(false)
    setPhase(p)
    setRemaining(durations[p])
    setElapsed(0)
    setFocusedSeconds(0)
    startedAtRef.current = null
  }

  /* ── Saving ──────────────────────────────────────────── */
  const save = async (minutes: number, startedAt: string | null) => {
    if (minutes < 1) {
      flash('err', t('errors.formInvalid'))
      return
    }
    if (!subjectId) {
      flash('err', t('timer.selectSubject'))
      return
    }
    setSaving(true)
    try {
      const fd = new FormData()
      fd.set('subjectId', subjectId)
      if (lessonId) fd.set('lessonId', lessonId)
      fd.set('minutes', String(minutes))
      if (startedAt) fd.set('startedAt', startedAt)
      fd.set('locale', locale)
      const r: ActionState = await logTimerSession({ ok: false }, fd)
      if (r.ok) {
        flash('ok', t('timer.recordSaved', { duration: `${minutes} min` }))
        reset()
      } else {
        flash('err', r.messageKey ? t(r.messageKey as 'errors.serverErrorTitle') : t('errors.serverErrorTitle'))
      }
    } catch {
      flash('err', t('errors.serverErrorTitle'))
    } finally {
      setSaving(false)
    }
  }

  const stopAndSave = () => {
    const minutes = Math.round(focusedSeconds / 60)
    if (mode === 'pomodoro' && phase !== 'focus') {
      reset()
      return
    }
    save(minutes, startedAtRef.current)
  }

  /* ── Display ─────────────────────────────────────────── */
  const totalSeconds = mode === 'pomodoro' ? durations[phase] : 0
  const displaySeconds = mode === 'pomodoro' ? remaining : elapsed
  const mm = String(Math.floor(displaySeconds / 60)).padStart(2, '0')
  const ss = String(displaySeconds % 60).padStart(2, '0')
  const progress = totalSeconds ? ((totalSeconds - displaySeconds) / totalSeconds) * 100 : (elapsed % 60) / 60 * 100
  const phaseColor =
    phase === 'focus' ? 'hsl(var(--primary))' : phase === 'break' ? 'hsl(var(--success))' : '#a855f7'

  const focusedMinutes = Math.round(focusedSeconds / 60)

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        {/* ─────────── Timer ─────────── */}
        <Card className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 start-1/2 h-64 w-64 -translate-x-1/2 rounded-full blur-3xl"
            style={{ background: `${phaseColor}26` }}
          />

          <div className="relative flex flex-col items-center gap-5 py-4">
            <Tabs
              value={mode}
              onChange={switchMode}
              tabs={[
                { id: 'pomodoro', label: t('timer.pomodoro') },
                { id: 'stopwatch', label: t('timer.stopwatch') },
              ]}
              className="self-center"
            />

            {mode === 'pomodoro' && (
              <div className="flex flex-wrap items-center justify-center gap-2">
                {(['focus', 'break', 'longBreak'] as Phase[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => switchPhase(p)}
                    aria-pressed={phase === p}
                    className={cn(
                      'rounded-full border px-4 py-1.5 text-xs font-bold transition',
                      phase === p
                        ? 'border-transparent text-white shadow-sm'
                        : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]',
                    )}
                    style={phase === p ? { background: p === 'focus' ? 'hsl(var(--primary))' : p === 'break' ? 'hsl(var(--success))' : '#a855f7' } : undefined}
                  >
                    {t(PHASE_LABEL[p])}
                  </button>
                ))}
              </div>
            )}

            <ProgressRing value={progress} size={236} stroke={13} color={phaseColor}>
              <div>
                <p
                  className="text-6xl font-extrabold tabular-nums tracking-tight"
                  dir="ltr"
                  style={{ color: phaseColor }}
                >
                  {mm}:{ss}
                </p>
                <p className="mt-1 text-xs font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
                  {mode === 'pomodoro'
                    ? t(PHASE_LABEL[phase])
                    : t('timer.stopwatch')}
                </p>
                {mode === 'pomodoro' && phase === 'focus' && (
                  <p className="mt-1 text-[11px] font-semibold text-[hsl(var(--muted-foreground))]">
                    {t('timer.cycle', { n: cycle })} / {defaults.cycles}
                  </p>
                )}
              </div>
            </ProgressRing>

            <div className="flex flex-wrap items-center justify-center gap-3">
              {!running ? (
                <Button onClick={start} className="h-12 px-8 text-base">
                  <Play size={18} /> {elapsed > 0 || (mode === 'pomodoro' && remaining < durations[phase]) ? t('timer.resume') : t('timer.start')}
                </Button>
              ) : (
                <Button onClick={pause} variant="outline" className="h-12 px-8 text-base">
                  <Pause size={18} /> {t('timer.pause')}
                </Button>
              )}

              <Button
                onClick={stopAndSave}
                variant="outline"
                disabled={saving || focusedSeconds < 60}
                className="h-12 px-6"
                title={focusedSeconds < 60 ? t('errors.formInvalid') : undefined}
              >
                <Square size={16} /> {t('timer.stop')}
              </Button>

              <Button onClick={reset} variant="ghost" className="h-12 px-5">
                <RotateCcw size={16} /> {t('timer.reset')}
              </Button>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4 text-center">
              <div>
                <p className="text-lg font-extrabold tabular-nums text-[hsl(var(--primary))]">
                  {focusedMinutes}
                </p>
                <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                  {t('common.minutes')}
                </p>
              </div>
              <span className="h-8 w-px bg-[hsl(var(--border))]" />
              <div>
                <p className="text-lg font-extrabold tabular-nums">
                  {(totalFocused / 60).toFixed(totalFocused % 60 === 0 ? 0 : 1)}
                </p>
                <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                  {t('timer.totalFocused')} ({t('common.hours')})
                </p>
              </div>
              <span className="h-8 w-px bg-[hsl(var(--border))]" />
              <div>
                <p className="text-lg font-extrabold tabular-nums">{sessionCount}</p>
                <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                  {t('timer.sessionsCount')}
                </p>
              </div>
            </div>

            {running && (
              <p className="rounded-xl border border-[hsl(var(--warning)/0.4)] bg-[hsl(var(--warning)/0.1)] px-3 py-2 text-xs font-medium text-[hsl(var(--foreground))]">
                <Timer size={13} className="me-1 inline" />
                {t('timer.leaveWarning')}
              </p>
            )}
          </div>
        </Card>

        {/* ─────────── Link + history ─────────── */}
        <div className="space-y-4">
          <Card>
            <CardHeader title={t('timer.sessionFor')} />
            <div className="space-y-3">
              <div>
                <label htmlFor="t-subject" className="label">
                  {t('timer.selectSubject')}
                </label>
                <Select
                  id="t-subject"
                  value={subjectId}
                  onChange={(e) => {
                    setSubjectId(e.target.value)
                    setChapterId('')
                    setLessonId('')
                  }}
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </div>

              {(subject?.chapters.length ?? 0) > 0 && (
                <div>
                  <label htmlFor="t-chapter" className="label">
                    {t('calendar.chapter')}
                  </label>
                  <Select
                    id="t-chapter"
                    value={chapterId}
                    onChange={(e) => {
                      setChapterId(e.target.value)
                      setLessonId('')
                    }}
                  >
                    <option value="">— {t('common.none')} —</option>
                    {(subject?.chapters ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </Select>
                </div>
              )}

              {(chapter?.lessons.length ?? 0) > 0 && (
                <div>
                  <label htmlFor="t-lesson" className="label">
                    {t('timer.selectLesson')}
                  </label>
                  <Select id="t-lesson" value={lessonId} onChange={(e) => setLessonId(e.target.value)}>
                    <option value="">— {t('common.none')} —</option>
                    {(chapter?.lessons ?? []).map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.title}
                      </option>
                    ))}
                  </Select>
                </div>
              )}

              <Button
                variant="outline"
                size="sm"
                className="w-full"
                disabled={saving || focusedSeconds < 60}
                onClick={() => save(Math.round(focusedSeconds / 60), startedAtRef.current)}
              >
                <Save size={14} /> {t('common.save')}
              </Button>
              <p className="text-center text-[11px] text-[hsl(var(--muted-foreground))]">
                {t('timer.autoSaved')}
              </p>
            </div>
          </Card>

          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <History size={15} /> {t('timer.history')}
                </span>
              }
            />
            {history.length === 0 ? (
              <EmptyState
                icon={<Flag size={20} />}
                title={t('timer.noHistory')}
                description={t('timer.subtitle')}
              />
            ) : (
              <ul className="max-h-80 space-y-2 overflow-y-auto pe-1">
                {history.map((h) => (
                  <li key={h.id} className="flex items-center gap-3 rounded-xl border p-2.5">
                    <span
                      className="h-9 w-1 shrink-0 rounded-full"
                      style={{ background: h.subjectColor }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{h.subjectName}</p>
                      <p className="truncate text-[11px] text-[hsl(var(--muted-foreground))]">
                        {fmt.relative(h.date)}
                        {h.lessonTitle ? ` · ${h.lessonTitle}` : ''}
                      </p>
                    </div>
                    <Badge color="hsl(var(--primary))">{h.durationMinutes} min</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

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
            {toast.kind === 'ok' ? (
              <Coffee size={16} className="text-[hsl(var(--success))]" />
            ) : (
              <span className="text-[hsl(var(--danger))]">✕</span>
            )}
            {toast.text}
          </div>
        </div>
      )}
    </div>
  )
}
