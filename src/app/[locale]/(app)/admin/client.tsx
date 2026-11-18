'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import {
  BookOpen,
  CheckCircle2,
  GraduationCap,
  ListChecks,
  CalendarDays,
  FlaskConical,
  FileText,
  Mail,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserCog,
  Users,
  UserX,
} from 'lucide-react'
import { resendActivation, setUserRole, setUserStatus } from '@/actions/admin'
import type { ActionState } from '@/actions/auth'
import { Badge, Button, Card, CardHeader, EmptyState, Input, Select, Tabs } from '@/components/ui'
import { useDateFormat } from '@/components/date-format'
import { cn } from '@/lib/utils'

export interface AdminUserRow {
  id: string
  name: string
  email: string
  role: string
  status: string
  locale: string
  verified: boolean
  createdAt: string
  subjects: number
  lessons: number
  sessions: number
  isSelf: boolean
}

export interface AuditRow {
  id: string
  action: string
  entityType: string
  adminName: string
  targetName: string | null
  meta: string
  createdAt: string
}

interface Stats {
  totalUsers: number
  activeUsers: number
  pendingUsers: number
  suspendedUsers: number
  newRegistrations: number
  students: number
  admins: number
  subjects: number
  lessons: number
  sessions: number
  exams: number
  notes: number
  notifications: number
}

type Tab = 'overview' | 'users' | 'audit'

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'hsl(var(--success))',
  PENDING: 'hsl(var(--warning))',
  SUSPENDED: 'hsl(var(--danger))',
}

export function AdminClient({
  stats,
  users,
  pagination,
  audit,
  auditTotal,
  filters,
  locale,
}: {
  stats: Stats
  users: AdminUserRow[]
  pagination: { page: number; hasMore: boolean; total: number }
  audit: AuditRow[]
  auditTotal: number
  filters: { q: string; status: string }
  locale: string
}) {
  const t = useTranslations()
  const fmt = useDateFormat()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [tab, setTab] = useState<Tab>('overview')
  const [isPending, startTransition] = useTransition()
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const flash = (kind: 'ok' | 'err', text: string) => {
    setToast({ kind, text })
    setTimeout(() => setToast(null), 4000)
  }

  const handle = (r: ActionState, okKey: string) => {
    if (r.ok) flash('ok', t(okKey as 'admin.userUpdated'))
    else flash('err', t((r.messageKey ?? 'errors.serverErrorTitle') as 'errors.serverErrorTitle'))
  }

  /* ── Navigation helpers (server-rendered filters) ── */
  const navigate = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '' || v === 'all') params.delete(k)
      else params.set(k, v)
    }
    if (!('page' in patch)) params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }

  const changeStatus = (u: AdminUserRow, status: 'ACTIVE' | 'SUSPENDED') => {
    const key = status === 'ACTIVE' ? 'admin.activateConfirm' : 'admin.suspendConfirm'
    if (!window.confirm(t(key as 'admin.activateConfirm'))) return
    startTransition(async () => {
      const fd = new FormData()
      fd.set('targetId', u.id)
      fd.set('status', status)
      fd.set('locale', locale)
      handle(await setUserStatus({ ok: false }, fd), 'admin.userUpdated')
    })
  }

  const changeRole = (u: AdminUserRow, role: 'STUDENT' | 'ADMIN') => {
    if (!window.confirm(t('admin.adminConfirm'))) return
    startTransition(async () => {
      const fd = new FormData()
      fd.set('targetId', u.id)
      fd.set('role', role)
      fd.set('locale', locale)
      handle(await setUserRole({ ok: false }, fd), 'admin.roleUpdated')
    })
  }

  const activatePending = (u: AdminUserRow) => {
    if (!window.confirm(t('admin.activateConfirm'))) return
    startTransition(async () => {
      handle(await resendActivation(u.id, locale), 'admin.userUpdated')
    })
  }

  /* ── Overview tiles ── */
  const tiles = [
    { icon: Users, label: t('admin.totalUsers'), value: stats.totalUsers, color: 'hsl(var(--primary))' },
    { icon: UserCheck, label: t('admin.activeUsers'), value: stats.activeUsers, color: 'hsl(var(--success))' },
    { icon: Mail, label: t('admin.pendingUsers'), value: stats.pendingUsers, color: 'hsl(var(--warning))' },
    { icon: UserX, label: t('admin.suspendedUsers'), value: stats.suspendedUsers, color: 'hsl(var(--danger))' },
    { icon: UserCog, label: t('admin.newRegistrations'), value: stats.newRegistrations, color: '#06b6d4' },
    { icon: GraduationCap, label: t('admin.students'), value: stats.students, color: 'hsl(var(--accent))' },
    { icon: ShieldCheck, label: t('admin.admins'), value: stats.admins, color: '#a855f7' },
    { icon: CalendarDays, label: t('nav.calendar'), value: stats.sessions, color: 'hsl(var(--primary))' },
  ]

  const usage = [
    { icon: BookOpen, label: t('nav.subjects'), value: stats.subjects },
    { icon: ListChecks, label: t('nav.lessons'), value: stats.lessons },
    { icon: CalendarDays, label: t('nav.calendar'), value: stats.sessions },
    { icon: FlaskConical, label: t('nav.exams'), value: stats.exams },
    { icon: FileText, label: t('nav.notes'), value: stats.notes },
    { icon: ShieldAlert, label: t('nav.notifications'), value: stats.notifications },
  ]

  return (
    <div className="space-y-6">
      <Tabs
        value={tab}
        onChange={(v) => setTab(v as Tab)}
        tabs={[
          { id: 'overview', label: t('admin.overview') },
          { id: 'users', label: t('admin.users'), count: stats.totalUsers },
          { id: 'audit', label: t('admin.auditLog'), count: auditTotal },
        ]}
      />

      {/* ───────────── Overview ───────────── */}
      {tab === 'overview' && (
        <div className="space-y-6 animate-fade-in">
          <Card className="border-[hsl(var(--success)/0.35)]">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-[hsl(var(--success)/0.14)] text-[hsl(var(--success))]">
                <CheckCircle2 size={20} />
              </span>
              <div>
                <p className="font-extrabold text-[hsl(var(--success))]">{t('admin.systemOk')}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">{t('admin.health')}</p>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
            {tiles.map((k) => {
              const Icon = k.icon
              return (
                <Card key={k.label} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
                      style={{ background: `${k.color}1f`, color: k.color }}
                    >
                      <Icon size={16} />
                    </span>
                    <span className="text-xl font-extrabold tabular-nums" style={{ color: k.color }}>
                      {k.value}
                    </span>
                  </div>
                  <p className="mt-2.5 text-[11px] font-medium leading-tight text-[hsl(var(--muted-foreground))]">
                    {k.label}
                  </p>
                </Card>
              )
            })}
          </div>

          <Card>
            <CardHeader title={t('admin.platformUsage')} />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {usage.map((u) => {
                const Icon = u.icon
                return (
                  <div key={u.label} className="rounded-xl border bg-[hsl(var(--surface))] p-3 text-center">
                    <Icon size={17} className="mx-auto text-[hsl(var(--primary))]" />
                    <p className="mt-1.5 text-lg font-extrabold tabular-nums">{u.value}</p>
                    <p className="text-[11px] text-[hsl(var(--muted-foreground))]">{u.label}</p>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>
      )}

      {/* ───────────── Users ───────────── */}
      {tab === 'users' && (
        <div className="space-y-4 animate-fade-in">
          <Card className="flex flex-wrap items-center gap-3 p-3.5">
            <div className="relative min-w-56 flex-1 sm:max-w-sm">
              <Search
                size={15}
                className="pointer-events-none absolute inset-y-0 start-3 my-auto text-[hsl(var(--muted-foreground))]"
              />
              <Input
                defaultValue={filters.q}
                placeholder={t('admin.searchUsers')}
                className="ps-9"
                aria-label={t('admin.searchUsers')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') navigate({ q: e.currentTarget.value })
                }}
              />
            </div>
            <Select
              value={filters.status}
              onChange={(e) => navigate({ status: e.target.value })}
              className="w-auto min-w-40"
              aria-label={t('admin.status')}
            >
              <option value="all">{t('admin.status')}: {t('common.all')}</option>
              <option value="ACTIVE">{t('admin.activeUsers')}</option>
              <option value="PENDING">{t('admin.pendingUsers')}</option>
              <option value="SUSPENDED">{t('admin.suspendedUsers')}</option>
            </Select>
            <span className="ms-auto text-xs font-semibold text-[hsl(var(--muted-foreground))]">
              {pagination.total} {t('admin.users')}
            </span>
          </Card>

          {users.length === 0 ? (
            <EmptyState icon={<Users size={22} />} title={t('common.noResults')} />
          ) : (
            <div className="space-y-2.5">
              {users.map((u) => (
                <Card key={u.id} className="flex flex-wrap items-center gap-3 p-3.5">
                  <span
                    className={cn(
                      'grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-extrabold',
                      u.role === 'ADMIN'
                        ? 'bg-[hsl(var(--accent)/0.16)] text-[hsl(var(--accent))]'
                        : 'bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary))]',
                    )}
                  >
                    {u.name.slice(0, 1).toUpperCase()}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-extrabold">
                      {u.name}
                      {u.isSelf && (
                        <span className="ms-2 text-[11px] font-semibold text-[hsl(var(--muted-foreground))]">
                          ({t('admin.you')})
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-[hsl(var(--muted-foreground))]" dir="ltr">
                      {u.email}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge color={u.role === 'ADMIN' ? '#a855f7' : 'hsl(var(--primary))'}>
                      {u.role === 'ADMIN' ? t('admin.admins') : t('admin.students')}
                    </Badge>
                    <Badge color={STATUS_COLOR[u.status]}>{u.status}</Badge>
                    <Badge>{u.locale}</Badge>
                  </div>

                  <div className="hidden gap-3 text-center md:flex">
                    {[
                      { v: u.subjects, l: t('nav.subjects') },
                      { v: u.lessons, l: t('nav.lessons') },
                      { v: u.sessions, l: t('nav.calendar') },
                    ].map((s) => (
                      <div key={s.l}>
                        <p className="text-sm font-extrabold tabular-nums">{s.v}</p>
                        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{s.l}</p>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {u.status === 'PENDING' && (
                      <Button size="sm" variant="outline" disabled={isPending} onClick={() => activatePending(u)}>
                        <Mail size={13} /> {t('admin.activate')}
                      </Button>
                    )}
                    {u.status === 'SUSPENDED' ? (
                      <Button size="sm" variant="outline" disabled={isPending || u.isSelf} onClick={() => changeStatus(u, 'ACTIVE')}>
                        <UserCheck size={13} /> {t('admin.activate')}
                      </Button>
                    ) : (
                      <Button size="sm" variant="danger" disabled={isPending || u.isSelf} onClick={() => changeStatus(u, 'SUSPENDED')}>
                        <UserX size={13} /> {t('admin.suspend')}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isPending || u.isSelf}
                      onClick={() => changeRole(u, u.role === 'ADMIN' ? 'STUDENT' : 'ADMIN')}
                    >
                      <ShieldCheck size={13} />
                      {u.role === 'ADMIN' ? t('admin.revokeAdmin') : t('admin.makeAdmin')}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {(pagination.page > 1 || pagination.hasMore) && (
            <div className="flex items-center justify-center gap-3">
              <Button
                variant="outline"
                disabled={pagination.page <= 1}
                onClick={() => navigate({ page: String(pagination.page - 1) })}
              >
                {t('history.loadMore')}
              </Button>
              <span className="text-sm font-semibold text-[hsl(var(--muted-foreground))]">
                {pagination.page}
              </span>
              <Button
                variant="outline"
                disabled={!pagination.hasMore}
                onClick={() => navigate({ page: String(pagination.page + 1) })}
              >
                {t('history.loadMore')}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ───────────── Audit log ───────────── */}
      {tab === 'audit' && (
        <div className="space-y-4 animate-fade-in">
          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <ShieldAlert size={16} className="text-[hsl(var(--warning))]" />
                  {t('admin.auditLog')}
                </span>
              }
              description={`${auditTotal}`}
            />
            {audit.length === 0 ? (
              <EmptyState icon={<ShieldAlert size={22} />} title={t('admin.auditEmpty')} />
            ) : (
              <ol className="space-y-2">
                {audit.map((a) => (
                  <li key={a.id} className="flex items-start gap-3 rounded-xl border p-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[hsl(var(--warning)/0.14)] text-[hsl(var(--warning))]">
                      <ShieldAlert size={15} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold">{a.action}</p>
                        <Badge>{a.entityType}</Badge>
                      </div>
                      <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                        {t('admin.adminUser')}: {a.adminName}
                        {a.targetName ? ` → ${t('admin.targetUser')}: ${a.targetName}` : ''}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] text-[hsl(var(--muted-foreground))]">
                      {fmt.relative(a.createdAt)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      )}

      {toast && (
        <div role="status" className="fixed bottom-5 inset-x-0 z-[70] flex justify-center px-4 animate-fade-in-up">
          <div
            className={cn(
              'flex items-center gap-2 rounded-xl border bg-[hsl(var(--card))] px-4 py-2.5 text-sm font-medium shadow-2xl',
              toast.kind === 'ok' ? 'border-[hsl(var(--success)/0.45)]' : 'border-[hsl(var(--danger)/0.45)]',
            )}
          >
            {toast.text}
          </div>
        </div>
      )}
    </div>
  )
}
