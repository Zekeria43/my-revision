'use client'

import { useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Download,
  FileText,
  Link2,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react'
import {
  createNote,
  createResource,
  deleteNote,
  deleteResource,
  updateNote,
} from '@/actions/content'
import type { ActionState } from '@/actions/auth'
import { Badge, Button, Card, EmptyState, Input, Select, Tabs, Textarea } from '@/components/ui'
import { DField, FormDialog } from '@/components/form-dialog'
import { useDateFormat } from '@/components/date-format'
import { cn } from '@/lib/utils'

export interface NoteRow {
  id: string
  kind: string
  title: string
  content: string
  subjectId: string | null
  subjectName: string | null
  subjectColor: string | null
  linkLabel: string | null
  createdAt: string
  updatedAt: string
}

export interface ResourceRow {
  id: string
  name: string
  kind: string
  url: string
  mimeType: string | null
  sizeBytes: number
  subjectId: string | null
  subjectName: string | null
  subjectColor: string | null
  linkLabel: string | null
  createdAt: string
}

interface SubjectOption {
  id: string
  name: string
  color: string
  chapters: { id: string; title: string; lessons: { id: string; title: string }[] }[]
}

type Tab = 'all' | 'notes' | 'links' | 'files'

export function NotesClient({
  notes,
  resources,
  subjects,
  locale,
}: {
  notes: NoteRow[]
  resources: ResourceRow[]
  subjects: SubjectOption[]
  locale: string
}) {
  const t = useTranslations()
  const fmt = useDateFormat()

  const [tab, setTab] = useState<Tab>('all')
  const [q, setQ] = useState('')
  const [subjectFilter, setSubjectFilter] = useState('all')

  const [noteDialog, setNoteDialog] = useState<{ open: boolean; edit?: NoteRow }>({ open: false })
  const [linkDialog, setLinkDialog] = useState(false)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)

  const flash = (kind: 'ok' | 'err', text: string) => {
    setToast({ kind, text })
    setTimeout(() => setToast(null), 4500)
  }

  const links = useMemo(() => resources.filter((r) => r.kind === 'LINK'), [resources])
  const files = useMemo(() => resources.filter((r) => r.kind === 'FILE'), [resources])

  const needle = q.trim().toLowerCase()
  const match = (text: string) => !needle || text.toLowerCase().includes(needle)
  const matchSubject = (id: string | null) => subjectFilter === 'all' || id === subjectFilter

  const visibleNotes = notes.filter(
    (n) => matchSubject(n.subjectId) && match(`${n.title} ${n.content}`),
  )
  const visibleLinks = links.filter(
    (r) => matchSubject(r.subjectId) && match(`${r.name} ${r.url}`),
  )
  const visibleFiles = files.filter(
    (r) => matchSubject(r.subjectId) && match(r.name),
  )

  const showNotes = tab === 'all' || tab === 'notes'
  const showLinks = tab === 'all' || tab === 'links'
  const showFiles = tab === 'all' || tab === 'files'

  /* ── Actions ─────────────────────────────────────────── */
  const removeNote = async (n: NoteRow) => {
    if (!window.confirm(t('notes.deleteConfirm'))) return
    setBusy(true)
    try {
      const r = await deleteNote(n.id, locale)
      flash(r.ok ? 'ok' : 'err', r.ok ? t('common.delete') : t('errors.serverErrorTitle'))
    } finally {
      setBusy(false)
    }
  }

  const removeResource = async (r: ResourceRow) => {
    if (!window.confirm(t('notes.deleteConfirm'))) return
    setBusy(true)
    try {
      const res = await deleteResource(r.id, locale)
      flash(res.ok ? 'ok' : 'err', res.ok ? t('common.delete') : t('errors.serverErrorTitle'))
    } finally {
      setBusy(false)
    }
  }

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 10 * 1024 * 1024) {
      flash('err', t('notes.fileTooLarge', { max: 10 }))
      e.target.value = ''
      return
    }
    setPendingFile(f)
  }

  const uploadFile = async () => {
    if (!pendingFile) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.set('file', pendingFile)
      if (subjectFilter !== 'all') fd.set('subjectId', subjectFilter)
      const res = await fetch('/api/files', { method: 'POST', body: fd })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        messageKey?: string
        vars?: Record<string, string | number>
      }
      if (res.ok && data.ok) {
        flash('ok', t('notes.uploadSuccess'))
        setPendingFile(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
        // Reload so the new row appears without a manual refresh.
        window.location.reload()
      } else {
        const key = data.messageKey ?? 'errors.serverErrorTitle'
        try {
          flash('err', t(key as 'errors.serverErrorTitle', data.vars))
        } catch {
          flash('err', t('errors.serverErrorTitle'))
        }
      }
    } catch {
      flash('err', t('errors.networkError'))
    } finally {
      setUploading(false)
    }
  }

  const downloadHref = (r: ResourceRow) => `/api/files/${r.id}`

  /* ── Render ──────────────────────────────────────────── */
  const EmptyBlock = ({ icon, title }: { icon: React.ReactNode; title: string }) => (
    <div className="rounded-xl border border-dashed p-8 text-center">
      <div className="mx-auto mb-2 grid h-11 w-11 place-items-center rounded-full bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]">
        {icon}
      </div>
      <p className="text-sm font-semibold">{title}</p>
    </div>
  )

  return (
    <div className="space-y-5">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-52 flex-1 sm:max-w-sm">
          <Search
            size={15}
            className="pointer-events-none absolute inset-y-0 start-3 my-auto text-[hsl(var(--muted-foreground))]"
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('notes.searchPlaceholder')}
            className="ps-9"
            aria-label={t('notes.searchPlaceholder')}
          />
        </div>

        <Select
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
          className="w-auto min-w-40"
          aria-label={t('calendar.subject')}
        >
          <option value="all">{t('common.all')}</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>

        <div className="ms-auto flex flex-wrap gap-2">
          <Button onClick={() => setNoteDialog({ open: true })}>
            <Plus size={16} /> {t('notes.addNote')}
          </Button>
          <Button variant="outline" onClick={() => setLinkDialog(true)}>
            <Link2 size={16} /> {t('notes.addLink')}
          </Button>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            <Upload size={16} /> {t('notes.upload')}
          </Button>
        </div>
      </div>

      {/* Hidden file input + pending-file confirmation */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={onPickFile}
        aria-hidden
        tabIndex={-1}
      />
      {pendingFile && (
        <Card className="flex flex-wrap items-center gap-3 border-[hsl(var(--primary)/0.4)] p-3.5 animate-fade-in">
          <Paperclip size={16} className="text-[hsl(var(--primary))]" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{pendingFile.name}</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {(pendingFile.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
          <Button size="sm" onClick={uploadFile} loading={uploading}>
            <Upload size={14} /> {t('notes.upload')}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setPendingFile(null)
              if (fileInputRef.current) fileInputRef.current.value = ''
            }}
          >
            {t('common.cancel')}
          </Button>
        </Card>
      )}

      <Tabs
        value={tab}
        onChange={(v) => setTab(v as Tab)}
        tabs={[
          { id: 'all', label: t('notes.allItems'), count: notes.length + resources.length },
          { id: 'notes', label: t('notes.textNotes'), count: notes.length },
          { id: 'links', label: t('notes.links'), count: links.length },
          { id: 'files', label: t('notes.files'), count: files.length },
        ]}
      />

      <p className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
        <Sparkles size={13} className="text-[hsl(var(--accent))]" />
        {t('notes.privateNote')}
      </p>

      {/* ── Content ── */}
      <div className="space-y-6">
        {showNotes && (
          <section className="space-y-3">
            {visibleNotes.length === 0 ? (
              tab !== 'all' || q || subjectFilter !== 'all' ? null : (
                <EmptyBlock icon={<FileText size={18} />} title={t('notes.empty')} />
              )
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {visibleNotes.map((n) => (
                  <Card key={n.id} className="flex flex-col p-4">
                    <div className="flex items-start gap-2">
                      <span
                        className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg"
                        style={{
                          background: n.kind === 'LINK' ? 'hsl(var(--accent)/0.15)' : 'hsl(var(--primary)/0.12)',
                          color: n.kind === 'LINK' ? 'hsl(var(--accent))' : 'hsl(var(--primary))',
                        }}
                      >
                        {n.kind === 'LINK' ? <Link2 size={15} /> : <FileText size={15} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold leading-snug">{n.title}</p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {n.subjectName && (
                            <Badge color={n.subjectColor ?? undefined}>{n.subjectName}</Badge>
                          )}
                          {n.linkLabel && <Badge>{n.linkLabel}</Badge>}
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button
                          aria-label={t('common.edit')}
                          onClick={() => setNoteDialog({ open: true, edit: n })}
                          className="grid h-8 w-8 place-items-center rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          aria-label={t('common.delete')}
                          disabled={busy}
                          onClick={() => removeNote(n)}
                          className="grid h-8 w-8 place-items-center rounded-lg text-[hsl(var(--danger))] hover:bg-[hsl(var(--danger)/0.12)]"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {n.content && (
                      <p className="mt-2.5 line-clamp-5 whitespace-pre-wrap text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">
                        {n.content}
                      </p>
                    )}

                    <p className="mt-auto pt-3 text-[10px] text-[hsl(var(--muted-foreground))]">
                      {fmt.relative(n.updatedAt)}
                    </p>
                  </Card>
                ))}
              </div>
            )}
          </section>
        )}

        {showLinks && visibleLinks.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-extrabold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
              {t('notes.links')}
            </h2>
            <div className="space-y-2">
              {visibleLinks.map((r) => (
                <Card key={r.id} className="flex items-center gap-3 p-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[hsl(var(--accent)/0.15)] text-[hsl(var(--accent))]">
                    <Link2 size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{r.name}</p>
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="block truncate text-xs text-[hsl(var(--primary))] hover:underline"
                      dir="ltr"
                    >
                      {r.url}
                    </a>
                  </div>
                  {r.subjectName && <Badge color={r.subjectColor ?? undefined}>{r.subjectName}</Badge>}
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="btn-ghost h-9 px-3 text-[13px]"
                  >
                    {t('notes.openLink')}
                  </a>
                  <button
                    aria-label={t('common.delete')}
                    disabled={busy}
                    onClick={() => removeResource(r)}
                    className="grid h-9 w-9 place-items-center rounded-lg text-[hsl(var(--danger))] hover:bg-[hsl(var(--danger)/0.12)]"
                  >
                    <Trash2 size={14} />
                  </button>
                </Card>
              ))}
            </div>
          </section>
        )}

        {showFiles && visibleFiles.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-extrabold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
              {t('notes.files')}
            </h2>
            <div className="space-y-2">
              {visibleFiles.map((r) => (
                <Card key={r.id} className="flex items-center gap-3 p-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[hsl(var(--success)/0.14)] text-[hsl(var(--success))]">
                    <Paperclip size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{r.name}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      {r.sizeBytes > 0 ? `${(r.sizeBytes / 1024 / 1024).toFixed(2)} MB` : '—'}
                      {' · '}
                      {fmt.date(r.createdAt)}
                    </p>
                  </div>
                  {r.subjectName && <Badge color={r.subjectColor ?? undefined}>{r.subjectName}</Badge>}
                  <a href={downloadHref(r)} className="btn-outline h-9 px-3 text-[13px]">
                    <Download size={14} /> {t('notes.download')}
                  </a>
                  <button
                    aria-label={t('common.delete')}
                    disabled={busy}
                    onClick={() => removeResource(r)}
                    className="grid h-9 w-9 place-items-center rounded-lg text-[hsl(var(--danger))] hover:bg-[hsl(var(--danger)/0.12)]"
                  >
                    <Trash2 size={14} />
                  </button>
                </Card>
              ))}
            </div>
          </section>
        )}

        {tab === 'all' && notes.length + resources.length === 0 && (
          <EmptyState
            icon={<FileText size={22} />}
            title={t('notes.empty')}
            description={t('notes.subtitle')}
            action={
              <Button onClick={() => setNoteDialog({ open: true })}>
                <Plus size={16} /> {t('notes.addNote')}
              </Button>
            }
          />
        )}

        {notes.length + resources.length > 0 &&
          visibleNotes.length + visibleLinks.length + visibleFiles.length === 0 && (
            <EmptyState icon={<Search size={22} />} title={t('common.noResults')} />
          )}
      </div>

      {/* ── Note dialog ── */}
      <FormDialog
        open={noteDialog.open}
        onClose={() => setNoteDialog({ open: false })}
        title={noteDialog.edit ? t('notes.editNote') : t('notes.addNote')}
        wide
        action={
          noteDialog.edit ? (p, fd) => updateNote(noteDialog.edit!.id, p, fd) : createNote
        }
      >
        <input type="hidden" name="locale" value={locale} />
        <NoteFields
          subjects={subjects}
          defaults={noteDialog.edit}
          locale={locale}
        />
      </FormDialog>

      {/* ── Link dialog ── */}
      <FormDialog
        open={linkDialog}
        onClose={() => setLinkDialog(false)}
        title={t('notes.addLink')}
        action={createResource}
      >
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="kind" value="LINK" />
        <DField label={t('notes.noteTitle')} htmlFor="name" required>
          <Input id="name" name="name" required />
        </DField>
        <DField label={t('notes.linkUrl')} htmlFor="url" required hint="https://…">
          <Input id="url" name="url" type="url" required dir="ltr" placeholder="https://" />
        </DField>
        <DField label={t('calendar.subject')} htmlFor="subjectId">
          <Select id="subjectId" name="subjectId" defaultValue={subjectFilter !== 'all' ? subjectFilter : ''}>
            <option value="">— {t('common.none')} —</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
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

/* ───────────────────────── Note fields ───────────────────────── */

function NoteFields({
  subjects,
  defaults,
  locale,
}: {
  subjects: SubjectOption[]
  defaults?: NoteRow
  locale: string
}) {
  const t = useTranslations()
  const [subjectId, setSubjectId] = useState(defaults?.subjectId ?? '')
  const subject = subjects.find((s) => s.id === subjectId)
  const [chapterId, setChapterId] = useState('')

  return (
    <>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="kind" value="TEXT" />

      <DField label={t('notes.noteTitle')} htmlFor="title" required>
        <Input id="title" name="title" required defaultValue={defaults?.title ?? ''} />
      </DField>

      <DField label={t('notes.content')} htmlFor="content">
        <Textarea
          id="content"
          name="content"
          rows={8}
          defaultValue={defaults?.content ?? ''}
          placeholder={t('notes.content')}
        />
      </DField>

      <div className="grid gap-4 sm:grid-cols-2">
        <DField label={t('calendar.subject')} htmlFor="subjectId">
          <Select
            id="subjectId"
            name="subjectId"
            value={subjectId}
            onChange={(e) => {
              setSubjectId(e.target.value)
              setChapterId('')
            }}
          >
            <option value="">— {t('common.none')} —</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </DField>
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
      </div>
    </>
  )
}
