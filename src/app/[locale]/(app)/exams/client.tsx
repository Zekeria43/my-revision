'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  CalendarClock,
  CalendarX,
  FlaskConical,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { createExam, deleteExam, updateExam } from '@/actions/content'
import { generateRevisionPlan } from '@/actions/sessions'
import type { ActionState } from '@/actions/auth'
import { Badge, Button, Card, EmptyState, Input, Progress, Select, Textarea } from '@/components/ui'
import { DField, FormDialog } from '@/components/form-dialog'
import { useDateFormat } from '@/components/date-format'
import { cn } from '@/lib/utils'

export interface ExamRow {
  id: string
  title: string
  date: string
  importance: string
  notes: string | null
  subjectId: string
  subjectName: string
  subjectColor: string
  incompleteLessons: number
  totalLessons: number
  scheduledSessions: number
}

const IMPORTANCE_COLOR: Record<string, string> = {
  LOW: 'hsl(var(--muted-foreground))',
  MEDIUM: 'hsl(var(--accent))',
  HIGH: 'hsl(var(--warning))',
  CRITICAL: 'hsl(var(--danger))',
}

const DAY_MS = 86_400_000

export function ExamsClient({
  exams,
  subjects,
  locale,
}: {
  exams: ExamRow[]
  subjects: { id: string; name: string; color: string }[]
  locale: string
}) {
  const t = useTranslations()
  const fmt = useDateFormat()

  const [dialog, setDialog] = useState<{ open: boolean; edit?: ExamRow }>({ open: false })
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const flash = (kind: 'ok' | 'err', text: string) => {
    setToast({ kind, text })
    setTimeout(() => setToast(null), 4500)
  }

  const { upcoming, past } = useMemo(() => {
    const now = Date.now()
    const sorted = [...exams].sort((a, b) => a.date.localeCompare(b.date))
    return {
      upcoming: sorted.filter((e) => new Date(e.date).getTime() >= now - DAY_MS),
      past: sorted.filter((e) => new Date(e.date).getTime() < now - DAY_MS).reverse(),
    }
  }, [exams])

  const daysLeft = (iso: string) =>
    Math.ceil((new Date(iso).setHours(0, 0, 0, 0) - Date.now()) / DAY_MS)

  const confirmDelete = async (e: ExamRow) => {
    if (!window.confirm(t('exams.deleteConfirm'))) return
    setBusy(true)
    try {
      const r = await deleteExam(e.id, locale)
      flash(r.ok ? 'ok' : 'err', r.ok ? t('common.delete') : t('errors.serverErrorTitle'))
    } finally {
      setBusy(false)
    }
  }

  const runPlan = async (e: ExamRow) => {
    setBusy(true)
    try {
      const r = await generateRevisionPlan(e.id, locale)
      const text = r.ok
        ? t((r.messageKey ?? 'exams.planGenerated') as 'exams.planGenerated', r.vars)
        : t((r.messageKey ?? 'errors.serverErrorTitle') as 'errors.serverErrorTitle', r.vars)
      flash(r.ok ? 'ok' : 'err', text)
    } finally {
      setBusy(false)
    }
  }

  const ExamCard = ({ e, isPast }: { e: ExamRow; isPast: boolean }) => {
    const d = daysLeft(e.date)
    const revisionPercent =
      e.totalLessons > 0
        ? Math.round(((e.totalLessons - e.incompleteLessons) / e.totalLessons) * 100)
        : 100

    return (
      <Card className={cn('flex flex-col p-4', isPast && 'opacity-70')}>
        <div className="flex items-start gap-3">
          <span
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white"
            style={{ background: e.subjectColor }}
          >
            <FlaskConical size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-extrabold">{e.title}</p>
            <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">{e.subjectName}</p>
          </div>
          <div className="flex shrink-0 gap-1">
            <button
              aria-label={t('common.edit')}
              onClick={() => setDialog({ open: true, edit: e })}
              className="grid h-8 w-8 place-items-center rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"
            >
              <Pencil size={14} />
            </button>
            <button
              aria-label={t('common.delete')}
              disabled={busy}
              onClick={() => confirmDelete(e)}
              className="grid h-8 w-8 place-items-center rounded-lg text-[hsl(var(--danger))] hover:bg-[hsl(var(--danger)/0.12)]"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <Badge color={IMPORTANCE_COLOR[e.importance]}>
            {t(`exams.importanceLevel.${e.importance}` as 'exams.importanceLevel.LOW')}
          </Badge>
          <Badge>{fmt.date(e.date, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</Badge>
          <Badge color={e.subjectColor}>{fmt.time(e.date)}</Badge>
        </div>

        {/* Countdown */}
        <div
          className={cn(
            'mt-3 flex items-center justify-between rounded-xl border p-3',
            isPast
              ? 'border-[hsl(var(--border))] bg-[hsl(var(--surface))]'
              : d <= 3
                ? 'border-[hsl(var(--danger)/0.4)] bg-[hsl(var(--danger)/0.08)]'
                : d <= 10
                  ? 'border-[hsl(var(--warning)/0.4)] bg-[hsl(var(--warning)/0.08)]'
                  : 'border-[hsl(var(--primary)/0.3)] bg-[hsl(var(--primary)/0.06)]',
          )}
        >
          <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            <CalendarClock size={14} /> {t('exams.countdown')}
          </span>
          <span className="text-lg font-extrabold tabular-nums">
            {isPast
              ? t('exams.overdue')
              : d <= 0
                ? t('exams.today')
                : d === 1
                  ? t('exams.tomorrow')
                  : t('exams.daysLeft', { n: d })}
          </span>
        </div>

        {/* Revision progress */}
        <div className="mt-3">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="font-semibold text-[hsl(var(--muted-foreground))]">
              {t('exams.revisionProgress')}
            </span>
            <span className="font-extrabold tabular-nums" style={{ color: e.subjectColor }}>
              {revisionPercent}%
            </span>
          </div>
          <Progress value={revisionPercent} color={e.subjectColor} />
          <p className="mt-1.5 text-[11px] text-[hsl(var(--muted-foreground))]">
            {e.incompleteLessons} {t('exams.incompleteLessons')} · {e.scheduledSessions}{' '}
            {t('calendar.scheduledSessions')}
          </p>
        </div>

        {e.notes && (
          <p className="mt-2.5 line-clamp-2 rounded-lg bg-[hsl(var(--surface))] p-2.5 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">
            {e.notes}
          </p>
        )}

        {!isPast && (
          <div className="mt-3 flex gap-2 border-t pt-3">
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              disabled={busy}
              onClick={() => runPlan(e)}
            >
              <Sparkles size={14} /> {t('exams.generatePlan')}
            </Button>
          </div>
        )}
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => setDialog({ open: true })} disabled={subjects.length === 0}>
          <Plus size={16} /> {t('exams.add')}
        </Button>
      </div>

      {exams.length === 0 ? (
        <EmptyState
          icon={<FlaskConical size={22} />}
          title={t('exams.empty')}
          description={t('exams.emptyHint')}
          action={
            <Button onClick={() => setDialog({ open: true })} disabled={subjects.length === 0}>
              <Plus size={16} /> {t('exams.add')}
            </Button>
          }
        />
      ) : (
        <>
          {upcoming.length > 0 && (
            <section className="space-y-4">
              <h2 className="flex items-center gap-2 text-base font-extrabold">
                <FlaskConical size={16} className="text-[hsl(var(--accent))]" />
                {t('exams.title')}
              </h2>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {upcoming.map((e) => (
                  <ExamCard key={e.id} e={e} isPast={false} />
                ))}
              </div>
            </section>
          )}

          {past.length > 0 && (
            <section className="space-y-4">
              <h2 className="flex items-center gap-2 text-base font-extrabold text-[hsl(var(--muted-foreground))]">
                <CalendarX size={16} />
                {t('exams.overdue')}
              </h2>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {past.map((e) => (
                  <ExamCard key={e.id} e={e} isPast />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <FormDialog
        open={dialog.open}
        onClose={() => setDialog({ open: false })}
        title={dialog.edit ? t('exams.edit') : t('exams.add')}
        wide
        action={
          dialog.edit ? (p, fd) => updateExam(dialog.edit!.id, p, fd) : createExam
        }
      >
        <input type="hidden" name="locale" value={locale} />

        <DField label={t('exams.name')} htmlFor="title" required>
          <Input id="title" name="title" required defaultValue={dialog.edit?.title ?? ''} />
        </DField>

        <DField label={t('exams.subject')} htmlFor="subjectId" required>
          <Select
            id="subjectId"
            name="subjectId"
            required
            defaultValue={dialog.edit?.subjectId ?? subjects[0]?.id}
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </DField>

        <div className="grid gap-4 sm:grid-cols-2">
          <DField label={t('exams.date')} htmlFor="date" required>
            <Input
              id="date"
              name="date"
              type="datetime-local"
              required
              dir="ltr"
              defaultValue={
                dialog.edit
                  ? (() => {
                      const d = new Date(dialog.edit.date)
                      return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
                        .toISOString()
                        .slice(0, 16)
                    })()
                  : ''
              }
            />
          </DField>
          <DField label={t('exams.importance')} htmlFor="importance">
            <Select
              id="importance"
              name="importance"
              defaultValue={dialog.edit?.importance ?? 'HIGH'}
            >
              {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((v) => (
                <option key={v} value={v}>
                  {t(`exams.importanceLevel.${v}` as 'exams.importanceLevel.LOW')}
                </option>
              ))}
            </Select>
          </DField>
        </div>

        <DField label={t('common.notes')} htmlFor="notes">
          <Textarea id="notes" name="notes" rows={3} defaultValue={dialog.edit?.notes ?? ''} />
        </DField>
      </FormDialog>

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
