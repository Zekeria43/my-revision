'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Archive, ArchiveRestore, BookOpen, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import {
  createSubject,
  deleteSubject,
  toggleSubjectArchive,
  updateSubject,
} from '@/actions/academic'
import type { ActionState } from '@/actions/auth'
import { Badge, Button, Card, EmptyState, Input, Progress, Select, Textarea } from '@/components/ui'
import { DField, FormDialog } from '@/components/form-dialog'
import { useDateFormat } from '@/components/date-format'

interface SubjectRow {
  id: string
  name: string
  description: string | null
  icon: string
  color: string
  coefficient: number
  importance: string
  priority: number
  examDate: string | null
  deadline: string | null
  estimatedHours: number
  notes: string | null
  archived: boolean
  semesterId: string | null
  semesterName: string | null
  chapterCount: number
  lessonCount: number
  completed: number
  inProgress: number
  needsRevision: number
  percent: number
}

const COLORS = ['#1b6af5', '#059669', '#f97316', '#a855f7', '#ec4899', '#06b6d4', '#ef4444', '#84cc16']
const initial: ActionState = { ok: false }

export function SubjectsClient({
  subjects,
  semesters,
  locale,
}: {
  subjects: SubjectRow[]
  semesters: { id: string; name: string }[]
  locale: string
}) {
  const t = useTranslations()
  const fmt = useDateFormat()

  const [q, setQ] = useState('')
  const [semFilter, setSemFilter] = useState('all')
  const [showArchived, setShowArchived] = useState(false)
  const [dialog, setDialog] = useState<{ open: boolean; edit?: SubjectRow }>({ open: false })
  const [color, setColor] = useState(COLORS[0])
  const [busy, setBusy] = useState(false)

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return subjects.filter((s) => {
      if (!showArchived && s.archived) return false
      if (semFilter !== 'all' && s.semesterId !== semFilter) return false
      if (needle && !s.name.toLowerCase().includes(needle)) return false
      return true
    })
  }, [subjects, q, semFilter, showArchived])

  const openCreate = () => {
    setColor(COLORS[0])
    setDialog({ open: true })
  }
  const openEdit = (s: SubjectRow) => {
    setColor(s.color)
    setDialog({ open: true, edit: s })
  }

  const confirmDelete = async (s: SubjectRow) => {
    if (!window.confirm(t('subjects.deleteConfirm'))) return
    setBusy(true)
    try {
      await deleteSubject(s.id, locale)
    } finally {
      setBusy(false)
    }
  }

  const toggleArchive = async (s: SubjectRow) => {
    setBusy(true)
    try {
      await toggleSubjectArchive(s.id, locale)
    } finally {
      setBusy(false)
    }
  }

  const hasSubjects = subjects.length > 0

  return (
    <div className="space-y-5">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-48 flex-1 sm:max-w-xs">
          <Search
            size={15}
            className="pointer-events-none absolute inset-y-0 start-3 my-auto text-[hsl(var(--muted-foreground))]"
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('common.search')}
            className="ps-9"
            aria-label={t('common.search')}
          />
        </div>

        <Select
          value={semFilter}
          onChange={(e) => setSemFilter(e.target.value)}
          className="w-auto min-w-40"
          aria-label={t('academic.selectSemester')}
        >
          <option value="all">{t('common.all')}</option>
          {semesters.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="h-4 w-4 rounded accent-[hsl(var(--primary))]"
          />
          {t('common.archived')}
        </label>

        <Button onClick={openCreate} className="ms-auto">
          <Plus size={16} /> {t('subjects.add')}
        </Button>
      </div>

      {/* ── Content ── */}
      {!hasSubjects ? (
        <EmptyState
          icon={<BookOpen size={22} />}
          title={t('subjects.empty')}
          description={t('subjects.emptyHint')}
          action={
            <Button onClick={openCreate}>
              <Plus size={16} /> {t('subjects.add')}
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Search size={22} />} title={t('common.noResults')} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((s) => (
            <Card
              key={s.id}
              className={`group flex flex-col p-4 transition hover:-translate-y-0.5 hover:shadow-lg ${
                s.archived ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-base font-extrabold text-white"
                  style={{ background: s.color }}
                >
                  {s.name.trim().charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/subjects/${s.id}`}
                    className="block truncate font-bold hover:text-[hsl(var(--primary))] hover:underline"
                  >
                    {s.name}
                  </Link>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {s.semesterName && <Badge>{s.semesterName}</Badge>}
                    <Badge color="hsl(var(--accent))">
                      {t('subjects.coef')} {s.coefficient}
                    </Badge>
                    {s.examDate && (
                      <Badge color="hsl(var(--danger))">
                        {fmt.monthDay(s.examDate)}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {s.description && (
                <p className="mt-2.5 line-clamp-2 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">
                  {s.description}
                </p>
              )}

              <div className="mt-3.5">
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="font-semibold text-[hsl(var(--muted-foreground))]">
                    {t('subjects.progress')}
                  </span>
                  <span className="font-extrabold tabular-nums" style={{ color: s.color }}>
                    {s.percent}%
                  </span>
                </div>
                <Progress value={s.percent} color={s.color} />
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px]">
                <div className="rounded-lg bg-[hsl(var(--surface))] py-1.5">
                  <p className="font-extrabold tabular-nums">{s.chapterCount}</p>
                  <p className="text-[hsl(var(--muted-foreground))]">{t('subjects.chapters')}</p>
                </div>
                <div className="rounded-lg bg-[hsl(var(--surface))] py-1.5">
                  <p className="font-extrabold tabular-nums">{s.lessonCount}</p>
                  <p className="text-[hsl(var(--muted-foreground))]">{t('subjects.lessons')}</p>
                </div>
                <div className="rounded-lg bg-[hsl(var(--surface))] py-1.5">
                  <p className="font-extrabold tabular-nums" style={{ color: 'hsl(var(--success))' }}>
                    {s.completed}
                  </p>
                  <p className="text-[hsl(var(--muted-foreground))]">{t('common.completed')}</p>
                </div>
              </div>

              <div className="mt-3 flex gap-1.5 border-t pt-3">
                <Link href={`/subjects/${s.id}`} className="btn-ghost h-9 flex-1 text-[13px]">
                  {t('common.more')}
                </Link>
                <button
                  aria-label={t('common.edit')}
                  onClick={() => openEdit(s)}
                  className="grid h-9 w-9 place-items-center rounded-lg border text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"
                >
                  <Pencil size={14} />
                </button>
                <button
                  aria-label={s.archived ? t('common.unarchive') : t('common.archive')}
                  disabled={busy}
                  onClick={() => toggleArchive(s)}
                  className="grid h-9 w-9 place-items-center rounded-lg border text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"
                >
                  {s.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                </button>
                <button
                  aria-label={t('common.delete')}
                  disabled={busy}
                  onClick={() => confirmDelete(s)}
                  className="grid h-9 w-9 place-items-center rounded-lg border text-[hsl(var(--danger))] hover:bg-[hsl(var(--danger)/0.12)]"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── Create / edit dialog ── */}
      <FormDialog
        open={dialog.open}
        onClose={() => setDialog({ open: false })}
        title={dialog.edit ? t('subjects.edit') : t('subjects.add')}
        wide
        action={
          dialog.edit ? (p, fd) => updateSubject(dialog.edit!.id, p, fd) : createSubject
        }
      >
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="color" value={color} />

        <DField label={t('subjects.name')} htmlFor="name" required>
          <Input id="name" name="name" required defaultValue={dialog.edit?.name ?? ''} />
        </DField>

        <div className="grid gap-4 sm:grid-cols-2">
          <DField label={t('academic.selectSemester')} htmlFor="semesterId">
            <Select
              id="semesterId"
              name="semesterId"
              defaultValue={dialog.edit?.semesterId ?? ''}
            >
              <option value="">— {t('common.none')} —</option>
              {semesters.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </DField>

          <DField label={t('subjects.coefficient')} htmlFor="coefficient">
            <Input
              id="coefficient"
              name="coefficient"
              type="number"
              min={0}
              max={20}
              step={0.5}
              defaultValue={dialog.edit?.coefficient ?? 1}
            />
          </DField>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <DField label={t('common.importance')} htmlFor="importance">
            <Select
              id="importance"
              name="importance"
              defaultValue={dialog.edit?.importance ?? 'MEDIUM'}
            >
              {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((v) => (
                <option key={v} value={v}>
                  {t(`exams.importanceLevel.${v}` as 'exams.importanceLevel.LOW')}
                </option>
              ))}
            </Select>
          </DField>
          <DField label={t('common.priority')} htmlFor="priority">
            <Select
              id="priority"
              name="priority"
              defaultValue={String(dialog.edit?.priority ?? 3)}
            >
              {[1, 2, 3, 4, 5].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </Select>
          </DField>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <DField label={t('subjects.examDate')} htmlFor="examDate">
            <Input
              id="examDate"
              name="examDate"
              type="date"
              defaultValue={dialog.edit?.examDate ? dialog.edit.examDate.slice(0, 10) : ''}
            />
          </DField>
          <DField label={t('subjects.deadline')} htmlFor="deadline">
            <Input
              id="deadline"
              name="deadline"
              type="date"
              defaultValue={dialog.edit?.deadline ? dialog.edit.deadline.slice(0, 10) : ''}
            />
          </DField>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <DField label={t('subjects.estimatedHours')} htmlFor="estimatedHours">
            <Input
              id="estimatedHours"
              name="estimatedHours"
              type="number"
              min={0}
              max={2000}
              defaultValue={dialog.edit?.estimatedHours ?? 0}
            />
          </DField>
          <DField label={t('subjects.color')} htmlFor="colorPicker">
            <div className="flex flex-wrap gap-2" id="colorPicker">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  onClick={() => setColor(c)}
                  className={`h-8 w-8 rounded-full border-2 transition ${
                    color === c ? 'scale-110 border-[hsl(var(--foreground))]' : 'border-transparent'
                  }`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </DField>
        </div>

        <DField label={t('common.description')} htmlFor="description">
          <Textarea
            id="description"
            name="description"
            rows={3}
            defaultValue={dialog.edit?.description ?? ''}
          />
        </DField>

        <DField label={t('subjects.personalNotes')} htmlFor="notes">
          <Textarea
            id="notes"
            name="notes"
            rows={3}
            defaultValue={dialog.edit?.notes ?? ''}
          />
        </DField>
      </FormDialog>
    </div>
  )
}
