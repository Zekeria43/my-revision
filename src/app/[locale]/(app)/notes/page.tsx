import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getCurrentUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { NotesClient, type NoteRow, type ResourceRow } from './client'

export default async function NotesPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const user = await getCurrentUser()
  const t = await getTranslations()

  const [notes, resources, subjects] = await Promise.all([
    db.note.findMany({
      where: { userId: user!.id, archivedAt: null },
      orderBy: { updatedAt: 'desc' },
      include: {
        subject: { select: { id: true, name: true, color: true } },
        lesson: { select: { title: true } },
        chapter: { select: { title: true } },
      },
    }),
    db.resource.findMany({
      where: { userId: user!.id },
      orderBy: { createdAt: 'desc' },
      include: {
        subject: { select: { id: true, name: true, color: true } },
        lesson: { select: { title: true } },
      },
    }),
    db.subject.findMany({
      where: { userId: user!.id, archivedAt: null },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        color: true,
        chapters: {
          where: { archivedAt: null },
          orderBy: { order: 'asc' },
          select: {
            id: true,
            title: true,
            lessons: {
              where: { archivedAt: null },
              orderBy: { order: 'asc' },
              select: { id: true, title: true },
            },
          },
        },
      },
    }),
  ])

  const noteRows: NoteRow[] = notes.map((n) => ({
    id: n.id,
    kind: n.kind,
    title: n.title,
    content: n.content,
    subjectId: n.subjectId,
    subjectName: n.subject?.name ?? null,
    subjectColor: n.subject?.color ?? null,
    linkLabel: n.lesson?.title ?? n.chapter?.title ?? null,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
  }))

  const resourceRows: ResourceRow[] = resources.map((r) => ({
    id: r.id,
    name: r.name,
    kind: r.kind,
    url: r.url,
    mimeType: r.mimeType,
    sizeBytes: r.sizeBytes,
    subjectId: r.subjectId,
    subjectName: r.subject?.name ?? null,
    subjectColor: r.subject?.color ?? null,
    linkLabel: r.lesson?.title ?? null,
    createdAt: r.createdAt.toISOString(),
  }))

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{t('notes.title')}</h1>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{t('notes.subtitle')}</p>
      </div>

      <NotesClient
        notes={noteRows}
        resources={resourceRows}
        subjects={subjects.map((s) => ({
          id: s.id,
          name: s.name,
          color: s.color,
          chapters: s.chapters.map((c) => ({
            id: c.id,
            title: c.title,
            lessons: c.lessons.map((l) => ({ id: l.id, title: l.title })),
          })),
        }))}
        locale={locale}
      />
    </div>
  )
}
