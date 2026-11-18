'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Layers,
  Pencil,
  Plus,
  RefreshCcw,
  Trash2,
} from 'lucide-react'
import { Link } from '@/i18n/navigation'
import {
  createChapter,
  createLesson,
  deleteChapter,
  deleteLesson,
  setLessonStatus,
  updateChapter,
  updateLesson,
} from '@/actions/academic'
import type { ActionState } from '@/actions/auth'
import { Badge, Button, Card, EmptyState, Input, Progress, Select, Textarea } from '@/components/ui'
import { DField, FormDialog } from '@/components/form-dialog'
import { useDateFormat } from '@/components/date-format'
import { cn } from '@/lib/utils'

interface Lesson {
  id: string
  title: string
  description: string | null
  order: number
  estimatedMinutes: number
  priority: string
  status: string
  completedAt: string | null
  notes: string | null
}
interface Chapter {
  id: string
  title: string
  description: string | null
  order: number
  lessons: Lesson[]
}
interface SubjectData {
  id: string
  name: string
  description: string | null
  color: string
  coefficient: number
  importance: string
  priority: number
  examDate: string | null
  deadline: string | null
  estimatedHours: number
  notes: string | null
  semesterName: string | null
  progress: {
    total: number
    completed: number
    inProgress: number
    needsRevision: number
    notStarted: number
    remaining: number
    percent: number
  }
  chapters: Chapter[]
}

const STATUS_META: Record<string, { color: string; icon: typeof Circle }> = {
  NOT_STARTED: { color: 'hsl(var(--muted-foreground))', icon: Circle },
  IN_PROGRESS: { color: 'hsl(var(--primary))', icon: RefreshCcw },
  COMPLETED: { color: 'hsl(var(--success))', icon: CheckCircle2 },
  NEEDS_REVISION: { color: '#a855f7', icon: RefreshCcw },
}

const initial: ActionState = { ok: false }

export function SubjectDetailClient({
  subject,
  locale,
}: {
  subject: SubjectData
  locale: string
  tTitle: string
}) {
  const t = useTranslations()
  const fmt = useDateFormat()
  const [isPending, startTransition] = useTransition()

  const [chapterDialog, setChapterDialog] = useState<{ open: boolean; edit?: Chapter }>({ open: false })
  const [lessonDialog, setLessonDialog] = useState<{
    open: boolean
    edit?: Lesson
    chapterId: string
  }>({ open: false, chapterId: '' })
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)

  const p = subject.progress

  const changeStatus = (lesson: Lesson) => {
    const next =
      lesson.status === 'COMPLETED'
        ? 'NOT_STARTED'
        : lesson.status === 'NOT_STARTED'
          ? 'COMPLETED'
          : lesson.status === 'IN_PROGRESS'
            ? 'NEEDS_REVISION'
            : 'IN_PROGRESS'
    const fd = new FormData()
    fd.set('id', lesson.id)
    fd.set('status', next)
    fd.set('locale', locale)
    startTransition(async () => {
      await setLessonStatus(fd)
    })
  }

  const confirmChapter = (c: Chapter) => {
    if (!window.confirm(t('chapters.deleteConfirm'))) return
    setBusy(true)
    deleteChapter(c.id, locale).finally(() => setBusy(false))
  }

  const confirmLesson = (l: Lesson) => {
    if (!window.confirm(t('lessons.deleteConfirm'))) return
    setBusy(true)
    deleteLesson(l.id, locale).finally(() => setBusy(false))
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div>
        <Link
          href="/subjects"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
        >
          <ArrowLeft size={15} /> {t('subjects.title')}
        </Link>

        <Card className="relative overflow-hidden p-5">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 start-0 w-1.5"
            style={{ background: subject.color }}
          />
          <div className="flex flex-wrap items-start gap-5 ps-3">
            <span
              className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-xl font-extrabold text-white"
              style={{ background: subject.color }}
            >
              {subject.name.trim().charAt(0).toUpperCase()}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-extrabold">{subject.name}</h1>
                {subject.semesterName && <Badge>{subject.semesterName}</Badge>}
                <Badge color="hsl(var(--accent))">
                  {t('subjects.coef')} {subject.coefficient}
                </Badge>
                <Badge color={subject.color}>
                  {t(
                    `exams.importanceLevel.${subject.importance}` as 'exams.importanceLevel.LOW',
                  )}
                </Badge>
                {subject.examDate && (
                  <Badge color="hsl(var(--danger))">
                    {t('subjects.examDate')}: {fmt.date(subject.examDate)}
                  </Badge>
                )}
              </div>
              {subject.description && (
                <p className="mt-1.5 text-sm text-[hsl(var(--muted-foreground))]">
                  {subject.description}
                </p>
              )}
            </div>

            <div className="w-full sm:w-56">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="font-semibold text-[hsl(var(--muted-foreground))]">
                  {t('subjects.progress')}
                </span>
                <span className="font-extrabold tabular-nums" style={{ color: subject.color }}>
                  {p.percent}%
                </span>
              </div>
              <Progress value={p.percent} color={subject.color} />
              <div className="mt-2.5 grid grid-cols-4 gap-1.5 text-center text-[10px]">
                {[
                  { v: p.completed, k: 'common.completed', c: 'hsl(var(--success))' },
                  { v: p.inProgress, k: 'lessons.status.IN_PROGRESS', c: 'hsl(var(--primary))' },
                  { v: p.needsRevision, k: 'lessons.status.NEEDS_REVISION', c: '#a855f7' },
                  { v: p.notStarted, k: 'lessons.status.NOT_STARTED', c: 'hsl(var(--muted-foreground))' },
                ].map((x) => (
                  <div key={x.k} className="rounded-lg bg-[hsl(var(--surface))] py-1.5">
                    <p className="font-extrabold tabular-nums" style={{ color: x.c }}>
                      {x.v}
                    </p>
                    <p className="truncate text-[9px] text-[hsl(var(--muted-foreground))]">
                      {t(x.k as 'lessons.status.NOT_STARTED')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* ── Chapters ── */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold">
          {t('chapters.title')}{' '}
          <span className="text-sm font-medium text-[hsl(var(--muted-foreground))]">
            ({subject.chapters.length})
          </span>
        </h2>
        <Button onClick={() => setChapterDialog({ open: true })}>
          <Plus size={16} /> {t('chapters.add')}
        </Button>
      </div>

      {subject.chapters.length === 0 ? (
        <EmptyState
          icon={<Layers size={22} />}
          title={t('chapters.empty')}
          action={
            <Button onClick={() => setChapterDialog({ open: true })}>
              <Plus size={16} /> {t('chapters.add')}
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {subject.chapters.map((c, ci) => {
            const done = c.lessons.filter((l) => l.status === 'COMPLETED').length
            const pct = c.lessons.length ? Math.round((done / c.lessons.length) * 100) : 0
            const isCollapsed = collapsed[c.id]

            return (
              <Card key={c.id} className="overflow-hidden p-0">
                <div className="flex items-center gap-3 border-b bg-[hsl(var(--surface))] px-4 py-3">
                  <button
                    onClick={() => setCollapsed((s) => ({ ...s, [c.id]: !s[c.id] }))}
                    aria-expanded={!isCollapsed}
                    aria-label={t('common.more')}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg hover:bg-[hsl(var(--muted))]"
                  >
                    {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                  </button>

                  <span
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xs font-extrabold text-white"
                    style={{ background: subject.color }}
                  >
                    {ci + 1}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{c.title}</p>
                    <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                      {t('chapters.lessonsCount', { n: c.lessons.length })} · {pct}%
                    </p>
                  </div>

                  <div className="hidden w-28 sm:block">
                    <Progress value={pct} color={subject.color} />
                  </div>

                  <div className="flex shrink-0 gap-1">
                    <button
                      aria-label={t('lessons.add')}
                      onClick={() => setLessonDialog({ open: true, chapterId: c.id })}
                      className="grid h-8 w-8 place-items-center rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"
                    >
                      <Plus size={15} />
                    </button>
                    <button
                      aria-label={t('common.edit')}
                      onClick={() => setChapterDialog({ open: true, edit: c })}
                      className="grid h-8 w-8 place-items-center rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      aria-label={t('common.delete')}
                      disabled={busy}
                      onClick={() => confirmChapter(c)}
                      className="grid h-8 w-8 place-items-center rounded-lg text-[hsl(var(--danger))] hover:bg-[hsl(var(--danger)/0.12)]"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {!isCollapsed && (
                  <div className="divide-y">
                    {c.lessons.length === 0 ? (
                      <div className="px-4 py-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
                        {t('lessons.empty')}
                        <div className="mt-3">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setLessonDialog({ open: true, chapterId: c.id })}
                          >
                            <Plus size={14} /> {t('lessons.add')}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      c.lessons.map((l) => {
                        const meta = STATUS_META[l.status] ?? STATUS_META.NOT_STARTED
                        const Icon = meta.icon
                        return (
                          <div
                            key={l.id}
                            className="flex items-center gap-3 px-4 py-3 transition hover:bg-[hsl(var(--surface))]"
                          >
                            <button
                              onClick={() => changeStatus(l)}
                              disabled={isPending}
                              aria-label={
                                l.status === 'COMPLETED'
                                  ? t('lessons.markIncomplete')
                                  : t('lessons.markComplete')
                              }
                              title={
                                l.status === 'COMPLETED'
                                  ? t('lessons.markIncomplete')
                                  : t('lessons.markComplete')
                              }
                              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 transition hover:scale-105 disabled:opacity-50"
                              style={{
                                borderColor: meta.color,
                                color: meta.color,
                                background:
                                  l.status === 'COMPLETED' ? `${meta.color}1f` : 'transparent',
                              }}
                            >
                              <Icon size={16} />
                            </button>

                            <div className="min-w-0 flex-1">
                              <p
                                className={cn(
                                  'truncate text-sm font-semibold',
                                  l.status === 'COMPLETED' && 'line-through opacity-65',
                                )}
                              >
                                {l.title}
                              </p>
                              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-[hsl(var(--muted-foreground))]">
                                <span>{l.estimatedMinutes} {t('common.minutes')}</span>
                                <span>·</span>
                                <span>
                                  {t(
                                    `lessons.priority.${l.priority}` as 'lessons.priority.LOW',
                                  )}
                                </span>
                                {l.completedAt && (
                                  <>
                                    <span>·</span>
                                    <span>
                                      {t('lessons.completedOn', { date: fmt.date(l.completedAt) })}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>

                            <Badge color={meta.color} className="hidden shrink-0 sm:inline-flex">
                              {t(`lessons.status.${l.status}` as 'lessons.status.NOT_STARTED')}
                            </Badge>

                            <div className="flex shrink-0 gap-1">
                              <button
                                aria-label={t('common.edit')}
                                onClick={() =>
                                  setLessonDialog({ open: true, edit: l, chapterId: c.id })
                                }
                                className="grid h-8 w-8 place-items-center rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                aria-label={t('common.delete')}
                                disabled={busy}
                                onClick={() => confirmLesson(l)}
                                className="grid h-8 w-8 place-items-center rounded-lg text-[hsl(var(--danger))] hover:bg-[hsl(var(--danger)/0.12)]"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* ── Chapter dialog ── */}
      <FormDialog
        open={chapterDialog.open}
        onClose={() => setChapterDialog({ open: false })}
        title={chapterDialog.edit ? t('chapters.edit') : t('chapters.add')}
        action={
          chapterDialog.edit
            ? (prev, fd) => updateChapter(chapterDialog.edit!.id, prev, fd)
            : (prev, fd) => {
                fd.set('subjectId', subject.id)
                return createChapter(prev, fd)
              }
        }
      >
        <input type="hidden" name="locale" value={locale} />
        <DField label={t('chapters.name')} htmlFor="title" required>
          <Input id="title" name="title" required defaultValue={chapterDialog.edit?.title ?? ''} />
        </DField>
        <DField label={t('common.description')} htmlFor="description">
          <Textarea
            id="description"
            name="description"
            rows={3}
            defaultValue={chapterDialog.edit?.description ?? ''}
          />
        </DField>
      </FormDialog>

      {/* ── Lesson dialog ── */}
      <FormDialog
        open={lessonDialog.open}
        onClose={() => setLessonDialog({ open: false, chapterId: '' })}
        title={lessonDialog.edit ? t('lessons.edit') : t('lessons.add')}
        action={
          lessonDialog.edit
            ? (prev, fd) => updateLesson(lessonDialog.edit!.id, prev, fd)
            : (prev, fd) => {
                fd.set('chapterId', lessonDialog.chapterId)
                fd.set('subjectId', subject.id)
                return createLesson(prev, fd)
              }
        }
      >
        <input type="hidden" name="locale" value={locale} />
        <DField label={t('lessons.name')} htmlFor="title" required>
          <Input id="title" name="title" required defaultValue={lessonDialog.edit?.title ?? ''} />
        </DField>
        <div className="grid gap-4 sm:grid-cols-2">
          <DField label={t('lessons.estimatedMinutes')} htmlFor="estimatedMinutes" required>
            <Input
              id="estimatedMinutes"
              name="estimatedMinutes"
              type="number"
              min={1}
              max={1440}
              required
              defaultValue={lessonDialog.edit?.estimatedMinutes ?? 45}
            />
          </DField>
          <DField label={t('common.priority')} htmlFor="priority">
            <Select
              id="priority"
              name="priority"
              defaultValue={lessonDialog.edit?.priority ?? 'MEDIUM'}
            >
              {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((v) => (
                <option key={v} value={v}>
                  {t(`lessons.priority.${v}` as 'lessons.priority.LOW')}
                </option>
              ))}
            </Select>
          </DField>
        </div>
        <DField label={t('common.description')} htmlFor="description">
          <Textarea
            id="description"
            name="description"
            rows={3}
            defaultValue={lessonDialog.edit?.description ?? ''}
          />
        </DField>
        <DField label={t('common.notes')} htmlFor="notes">
          <Textarea
            id="notes"
            name="notes"
            rows={2}
            defaultValue={lessonDialog.edit?.notes ?? ''}
          />
        </DField>
      </FormDialog>
    </div>
  )
}
