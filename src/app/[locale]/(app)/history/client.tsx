'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Database,
  FileText,
  Filter,
  FlaskConical,
  GraduationCap,
  History,
  Layers,
  ListChecks,
  Pencil,
  Plus,
  RefreshCcw,
  Sparkles,
  Trash2,
  User,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Badge, Button, Card, EmptyState, Select, Skeleton } from '@/components/ui'
import { useDateFormat } from '@/components/date-format'
import { cn } from '@/lib/utils'

export interface HistoryRow {
  id: string
  entityType: string
  action: string
  entityId: string | null
  meta: Record<string, unknown>
  createdAt: string
}

const ENTITY_ICON: Record<string, LucideIcon> = {
  SUBJECT: BookOpen,
  CHAPTER: Layers,
  LESSON: ListChecks,
  SESSION: CalendarDays,
  EXAM: FlaskConical,
  NOTE: FileText,
  RESOURCE: FileText,
  YEAR: GraduationCap,
  SEMESTER: Layers,
  SPECIALIZATION: GraduationCap,
  USER: User,
  TIMER: RefreshCcw,
}

const ACTION_META: Record<string, { icon: LucideIcon; color: string }> = {
  CREATE: { icon: Plus, color: 'hsl(var(--success))' },
  UPDATE: { icon: Pencil, color: 'hsl(var(--primary))' },
  DELETE: { icon: Trash2, color: 'hsl(var(--danger))' },
  ARCHIVE: { icon: Database, color: 'hsl(var(--muted-foreground))' },
  UNARCHIVE: { icon: Database, color: 'hsl(var(--accent))' },
  COMPLETE: { icon: Plus, color: 'hsl(var(--success))' },
  REOPEN: { icon: RefreshCcw, color: 'hsl(var(--warning))' },
  RESCHEDULE: { icon: CalendarDays, color: '#06b6d4' },
  LOGIN: { icon: User, color: 'hsl(var(--primary))' },
  REGISTER: { icon: User, color: 'hsl(var(--accent))' },
}

/** Extracts a human-readable subject/title from stored meta (user text as-is). */
function metaLabel(meta: Record<string, unknown>): string | null {
  for (const key of ['name', 'title', 'subject', 'lesson', 'reason']) {
    const v = meta[key]
    if (typeof v === 'string' && v.trim() && v !== 'auto') return v
  }
  return null
}

export function HistoryClient({
  items,
  page,
  hasMore,
  total,
  filters,
  locale,
}: {
  items: HistoryRow[]
  page: number
  hasMore: boolean
  total: number
  filters: {
    entity: string
    action: string
    entityOptions: string[]
    actionOptions: string[]
  }
  locale: string
}) {
  const t = useTranslations()
  const fmt = useDateFormat()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const setFilter = (key: 'entity' | 'action', value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'all') params.delete(key)
    else params.set(key, value)
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }

  const goPage = (n: number) => {
    const params = new URLSearchParams(searchParams.toString())
    if (n <= 1) params.delete('page')
    else params.set('page', String(n))
    router.push(`${pathname}?${params.toString()}`)
  }

  const translate = (key: string, fallback: string) => {
    try {
      return t(key as 'history.title')
    } catch {
      return fallback
    }
  }

  return (
    <div className="space-y-5">
      {/* ── Filters ── */}
      <Card className="flex flex-wrap items-center gap-3 p-3.5">
        <span className="flex items-center gap-2 text-sm font-bold text-[hsl(var(--muted-foreground))]">
          <Filter size={15} /> {t('history.filterType')}
        </span>

        <Select
          value={filters.entity}
          onChange={(e) => setFilter('entity', e.target.value)}
          className="w-auto min-w-44"
          aria-label={t('history.filterEntity')}
        >
          <option value="all">{t('history.filterEntity')}: {t('common.all')}</option>
          {filters.entityOptions.map((e) => (
            <option key={e} value={e}>
              {translate(`history.entity.${e}`, e)}
            </option>
          ))}
        </Select>

        <Select
          value={filters.action}
          onChange={(e) => setFilter('action', e.target.value)}
          className="w-auto min-w-44"
          aria-label={t('history.action.CREATE')}
        >
          <option value="all">{t('history.action.CREATE')}: {t('common.all')}</option>
          {filters.actionOptions.map((a) => (
            <option key={a} value={a}>
              {translate(`history.action.${a}`, a)}
            </option>
          ))}
        </Select>

        <span className="ms-auto text-xs font-semibold text-[hsl(var(--muted-foreground))]">
          {total} {t('history.title')}
        </span>
      </Card>

      {/* ── Timeline ── */}
      {items.length === 0 ? (
        <EmptyState
          icon={<History size={22} />}
          title={t('history.empty')}
          description={t('history.subtitle')}
        />
      ) : (
        <ol className="relative space-y-3 border-e-2 border-dashed pe-5">
          {items.map((r) => {
            const EntityIcon = ENTITY_ICON[r.entityType] ?? Database
            const meta = ACTION_META[r.action] ?? ACTION_META.UPDATE
            const ActionIcon = meta.icon
            const label = metaLabel(r.meta)

            return (
              <li key={r.id} className="relative">
                <span
                  className="absolute -end-[27px] top-4 h-3.5 w-3.5 rounded-full border-2 border-[hsl(var(--background))]"
                  style={{ background: meta.color }}
                />
                <Card className="flex items-start gap-3 p-3.5">
                  <span
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                    style={{ background: `${meta.color}1f`, color: meta.color }}
                  >
                    <ActionIcon size={17} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold">
                        {translate(`history.action.${r.action}`, r.action)}
                      </p>
                      <span className="text-[hsl(var(--muted-foreground))]">·</span>
                      <span className="flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))]">
                        <EntityIcon size={14} />
                        {translate(`history.entity.${r.entityType}`, r.entityType)}
                      </span>
                      <Badge color={meta.color} className="ms-auto">
                        {translate(`history.action.${r.action}`, r.action)}
                      </Badge>
                    </div>

                    {label && (
                      <p
                        className={cn(
                          'mt-1 truncate text-sm',
                          r.action === 'DELETE'
                            ? 'text-[hsl(var(--danger))] line-through'
                            : 'text-[hsl(var(--foreground))]',
                        )}
                      >
                        {label}
                      </p>
                    )}

                    {Object.keys(r.meta).length > 0 && !label && (
                      <p className="mt-1 truncate text-xs text-[hsl(var(--muted-foreground))]">
                        {Object.entries(r.meta)
                          .map(([k, v]) => `${k}: ${String(v)}`)
                          .join(' · ')}
                      </p>
                    )}

                    <p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">
                      {fmt.relative(r.createdAt)}
                      {' · '}
                      {fmt.date(r.createdAt, { year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                  </div>
                </Card>
              </li>
            )
          })}
        </ol>
      )}

      {/* ── Pagination ── */}
      {(page > 1 || hasMore) && (
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            disabled={page <= 1}
            onClick={() => goPage(page - 1)}
          >
            <ChevronRight size={15} /> {t('history.loadMore')}
          </Button>
          <span className="text-sm font-semibold text-[hsl(var(--muted-foreground))]">
            {page}
          </span>
          <Button variant="outline" disabled={!hasMore} onClick={() => goPage(page + 1)}>
            {t('history.loadMore')} <ChevronLeft size={15} />
          </Button>
        </div>
      )}
    </div>
  )
}
