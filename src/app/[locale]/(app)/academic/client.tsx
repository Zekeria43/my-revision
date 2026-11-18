'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { CalendarRange, GraduationCap, Layers, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  createSemester,
  createSpecialization,
  createYear,
  deleteSemester,
  deleteSpecialization,
  deleteYear,
  updateSemester,
  updateYear,
} from '@/actions/academic'
import type { ActionState } from '@/actions/auth'
import { Badge, Button, Card, EmptyState, Tabs } from '@/components/ui'
import { DField, FormDialog } from '@/components/form-dialog'
import { useDateFormat } from '@/components/date-format'
import { Input, Select, Textarea } from '@/components/ui'

interface Year {
  id: string
  name: string
  startDate: string
  endDate: string
  status: string
  description: string | null
  isCurrent: boolean
  semesterCount: number
  specCount: number
}
interface Semester {
  id: string
  academicYearId: string
  academicYearName: string
  name: string
  startDate: string
  endDate: string
  isCurrent: boolean
  order: number
  subjectCount: number
  lessonCount: number
}
interface Spec {
  id: string
  academicYearId: string
  academicYearName: string
  name: string
  description: string | null
  program: string | null
}

const initial: ActionState = { ok: false }

export function AcademicClient({
  years,
  semesters,
  specializations,
  locale,
}: {
  years: Year[]
  semesters: Semester[]
  specializations: Spec[]
  locale: string
}) {
  const t = useTranslations()
  const fmt = useDateFormat()
  const [tab, setTab] = useState('years')

  const [yearDialog, setYearDialog] = useState<{ open: boolean; edit?: Year }>({ open: false })
  const [semDialog, setSemDialog] = useState<{ open: boolean; edit?: Semester }>({ open: false })
  const [specDialog, setSpecDialog] = useState<{ open: boolean; edit?: Spec }>({ open: false })
  const [busy, setBusy] = useState(false)

  const confirm = async (msg: string, fn: () => Promise<ActionState>) => {
    if (!window.confirm(msg)) return
    setBusy(true)
    try {
      await fn()
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
          { id: 'years', label: t('academic.years'), count: years.length },
          { id: 'semesters', label: t('academic.semesters'), count: semesters.length },
          { id: 'specs', label: t('academic.specializations'), count: specializations.length },
        ]}
      />

      {/* ───────────── Years ───────────── */}
      {tab === 'years' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex justify-end">
            <Button onClick={() => setYearDialog({ open: true })}>
              <Plus size={16} /> {t('academic.addYear')}
            </Button>
          </div>

          {years.length === 0 ? (
            <EmptyState
              icon={<GraduationCap size={22} />}
              title={t('academic.noYears')}
              action={
                <Button onClick={() => setYearDialog({ open: true })}>
                  <Plus size={16} /> {t('academic.addYear')}
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {years.map((y) => (
                <Card key={y.id} className="flex flex-col p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-extrabold">{y.name}</p>
                      <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">
                        {fmt.date(y.startDate)} → {fmt.date(y.endDate)}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        aria-label={t('common.edit')}
                        onClick={() => setYearDialog({ open: true, edit: y })}
                        className="grid h-8 w-8 place-items-center rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        aria-label={t('common.delete')}
                        disabled={busy}
                        onClick={() =>
                          confirm(t('academic.deleteYearConfirm'), () =>
                            deleteYear(y.id, locale),
                          )
                        }
                        className="grid h-8 w-8 place-items-center rounded-lg text-[hsl(var(--danger))] hover:bg-[hsl(var(--danger)/0.12)]"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {y.isCurrent && <Badge color="hsl(var(--success))">{t('academic.current')}</Badge>}
                    <Badge
                      color={y.status === 'ACTIVE' ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'}
                    >
                      {y.status === 'ACTIVE' ? t('academic.active') : t('academic.archived')}
                    </Badge>
                  </div>

                  {y.description && (
                    <p className="mt-2 line-clamp-2 text-xs text-[hsl(var(--muted-foreground))]">
                      {y.description}
                    </p>
                  )}

                  <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-3 text-center">
                    <div>
                      <p className="text-lg font-extrabold tabular-nums">{y.semesterCount}</p>
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                        {t('academic.semesters')}
                      </p>
                    </div>
                    <div>
                      <p className="text-lg font-extrabold tabular-nums">{y.specCount}</p>
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                        {t('academic.specializations')}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ───────────── Semesters ───────────── */}
      {tab === 'semesters' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex justify-end">
            <Button onClick={() => setSemDialog({ open: true })} disabled={years.length === 0}>
              <Plus size={16} /> {t('academic.addSemester')}
            </Button>
          </div>

          {years.length === 0 ? (
            <EmptyState
              icon={<CalendarRange size={22} />}
              title={t('academic.noYears')}
              description={t('academic.selectYear')}
            />
          ) : semesters.length === 0 ? (
            <EmptyState
              icon={<Layers size={22} />}
              title={t('academic.noSemesters')}
              action={
                <Button onClick={() => setSemDialog({ open: true })}>
                  <Plus size={16} /> {t('academic.addSemester')}
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {semesters.map((s) => (
                <Card key={s.id} className="flex flex-wrap items-center gap-4 p-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary))]">
                    <Layers size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold">{s.name}</p>
                      {s.isCurrent && <Badge color="hsl(var(--success))">{t('academic.current')}</Badge>}
                      <Badge>{s.academicYearName}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">
                      {fmt.date(s.startDate)} → {fmt.date(s.endDate)} ·{' '}
                      <span className="font-semibold">
                        {s.subjectCount} {t('academic.subjectsIn')} {s.name}
                      </span>{' '}
                      · {s.lessonCount} {t('lessons.title')}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      aria-label={t('common.edit')}
                      onClick={() => setSemDialog({ open: true, edit: s })}
                      className="grid h-9 w-9 place-items-center rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      aria-label={t('common.delete')}
                      disabled={busy}
                      onClick={() =>
                        confirm(t('academic.deleteSemesterConfirm'), () =>
                          deleteSemester(s.id, locale),
                        )
                      }
                      className="grid h-9 w-9 place-items-center rounded-lg text-[hsl(var(--danger))] hover:bg-[hsl(var(--danger)/0.12)]"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ───────────── Specializations ───────────── */}
      {tab === 'specs' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex justify-end">
            <Button onClick={() => setSpecDialog({ open: true })} disabled={years.length === 0}>
              <Plus size={16} /> {t('academic.addSpecialization')}
            </Button>
          </div>

          {specializations.length === 0 ? (
            <EmptyState
              icon={<GraduationCap size={22} />}
              title={t('academic.noSpecs')}
              action={
                <Button onClick={() => setSpecDialog({ open: true })} disabled={years.length === 0}>
                  <Plus size={16} /> {t('academic.addSpecialization')}
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {specializations.map((s) => (
                <Card key={s.id} className="flex flex-col p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-bold">{s.name}</p>
                      <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">
                        {s.academicYearName}
                      </p>
                    </div>
                    <button
                      aria-label={t('common.delete')}
                      disabled={busy}
                      onClick={() =>
                        confirm(t('academic.deleteSpecConfirm'), () =>
                          deleteSpecialization(s.id, locale),
                        )
                      }
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[hsl(var(--danger))] hover:bg-[hsl(var(--danger)/0.12)]"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {s.program && (
                    <Badge color="hsl(var(--accent))" className="mt-2 self-start">
                      {s.program}
                    </Badge>
                  )}
                  {s.description && (
                    <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">
                      {s.description}
                    </p>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ───────────── Dialogs ───────────── */}
      <FormDialog
        open={yearDialog.open}
        onClose={() => setYearDialog({ open: false })}
        title={yearDialog.edit ? t('common.edit') : t('academic.addYear')}
        action={
          yearDialog.edit
            ? (p, fd) => updateYear(yearDialog.edit!.id, p, fd)
            : createYear
        }
      >
        <input type="hidden" name="locale" value={locale} />
        <DField label={t('academic.yearName')} htmlFor="name" required>
          <Input id="name" name="name" required defaultValue={yearDialog.edit?.name ?? ''} />
        </DField>
        <div className="grid gap-4 sm:grid-cols-2">
          <DField label={t('academic.startDate')} htmlFor="startDate" required>
            <Input
              id="startDate"
              name="startDate"
              type="date"
              required
              defaultValue={yearDialog.edit ? yearDialog.edit.startDate.slice(0, 10) : ''}
            />
          </DField>
          <DField label={t('academic.endDate')} htmlFor="endDate" required>
            <Input
              id="endDate"
              name="endDate"
              type="date"
              required
              defaultValue={yearDialog.edit ? yearDialog.edit.endDate.slice(0, 10) : ''}
            />
          </DField>
        </div>
        <DField label={t('academic.description')} htmlFor="description">
          <Textarea
            id="description"
            name="description"
            rows={3}
            defaultValue={yearDialog.edit?.description ?? ''}
          />
        </DField>
        <label className="flex cursor-pointer items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            name="isCurrent"
            defaultChecked={yearDialog.edit?.isCurrent ?? false}
            className="h-4 w-4 rounded accent-[hsl(var(--primary))]"
          />
          {t('academic.isCurrent')}
        </label>
      </FormDialog>

      <FormDialog
        open={semDialog.open}
        onClose={() => setSemDialog({ open: false })}
        title={semDialog.edit ? t('common.edit') : t('academic.addSemester')}
        action={
          semDialog.edit
            ? (p, fd) => updateSemester(semDialog.edit!.id, p, fd)
            : createSemester
        }
      >
        <input type="hidden" name="locale" value={locale} />
        <DField label={t('academic.selectYear')} htmlFor="academicYearId" required>
          <Select
            id="academicYearId"
            name="academicYearId"
            required
            defaultValue={semDialog.edit?.academicYearId ?? years.find((y) => y.isCurrent)?.id ?? years[0]?.id}
          >
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
              </option>
            ))}
          </Select>
        </DField>
        <DField label={t('academic.semesterName')} htmlFor="name" required>
          <Input id="name" name="name" required defaultValue={semDialog.edit?.name ?? ''} />
        </DField>
        <div className="grid gap-4 sm:grid-cols-2">
          <DField label={t('academic.startDate')} htmlFor="startDate" required>
            <Input
              id="startDate"
              name="startDate"
              type="date"
              required
              defaultValue={semDialog.edit ? semDialog.edit.startDate.slice(0, 10) : ''}
            />
          </DField>
          <DField label={t('academic.endDate')} htmlFor="endDate" required>
            <Input
              id="endDate"
              name="endDate"
              type="date"
              required
              defaultValue={semDialog.edit ? semDialog.edit.endDate.slice(0, 10) : ''}
            />
          </DField>
        </div>
        <label className="flex cursor-pointer items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            name="isCurrent"
            defaultChecked={semDialog.edit?.isCurrent ?? false}
            className="h-4 w-4 rounded accent-[hsl(var(--primary))]"
          />
          {t('academic.isCurrent')}
        </label>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">{t('academic.onlyOneCurrent')}</p>
      </FormDialog>

      <FormDialog
        open={specDialog.open}
        onClose={() => setSpecDialog({ open: false })}
        title={t('academic.addSpecialization')}
        action={createSpecialization}
      >
        <input type="hidden" name="locale" value={locale} />
        <DField label={t('academic.selectYear')} htmlFor="academicYearId" required>
          <Select
            id="academicYearId"
            name="academicYearId"
            required
            defaultValue={years.find((y) => y.isCurrent)?.id ?? years[0]?.id}
          >
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
              </option>
            ))}
          </Select>
        </DField>
        <DField label={t('academic.specName')} htmlFor="name" required>
          <Input id="name" name="name" required />
        </DField>
        <DField label={t('academic.program')} htmlFor="program">
          <Input id="program" name="program" />
        </DField>
        <DField label={t('academic.description')} htmlFor="description">
          <Textarea id="description" name="description" rows={3} />
        </DField>
      </FormDialog>
    </div>
  )
}
