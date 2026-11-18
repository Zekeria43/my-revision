'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import {
  BadgeCheck,
  CheckCircle2,
  Mail,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserX,
  Users,
  X,
} from 'lucide-react'
import {
  ownerDeleteUser,
  ownerSetUserRole,
  ownerSetUserStatus,
  ownerVerifyUser,
} from '@/actions/owner'
import type { ActionState } from '@/actions/auth'
import { Badge, Button, Card, EmptyState, Input, Select } from '@/components/ui'
import { useDateFormat } from '@/components/date-format'
import { cn } from '@/lib/utils'

export interface OwnerUserRow {
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
  isOwner: boolean
}

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'hsl(var(--success))',
  PENDING: 'hsl(var(--warning))',
  SUSPENDED: 'hsl(var(--danger))',
}

export function OwnerUsers({
  users,
  pagination,
  filters,
  locale,
  labels,
}: {
  users: OwnerUserRow[]
  pagination: { page: number; hasMore: boolean; total: number }
  filters: { q: string; status: string }
  locale: string
  labels: Record<string, string>
}) {
  const t = useTranslations()
  const fmt = useDateFormat()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [isPending, startTransition] = useTransition()
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [deleting, setDeleting] = useState<OwnerUserRow | null>(null)

  const flash = (kind: 'ok' | 'err', text: string) => {
    setToast({ kind, text })
    setTimeout(() => setToast(null), 4000)
  }

  const handle = (r: ActionState, okText: string) => {
    if (r.ok) flash('ok', okText)
    else flash('err', t((r.messageKey ?? 'errors.serverErrorTitle') as 'errors.serverErrorTitle'))
  }

  const navigate = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '' || v === 'all') params.delete(k)
      else params.set(k, v)
    }
    if (!('page' in patch)) params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }

  const run = (fn: () => Promise<ActionState>, okText: string) => {
    startTransition(async () => handle(await fn(), okText))
  }

  const setStatus = (u: OwnerUserRow, status: 'ACTIVE' | 'SUSPENDED') => {
    if (!window.confirm(t(status === 'ACTIVE' ? 'admin.activateConfirm' : 'admin.suspendConfirm'))) return
    run(async () => {
      const fd = new FormData()
      fd.set('targetId', u.id)
      fd.set('status', status)
      fd.set('locale', locale)
      return ownerSetUserStatus({ ok: false }, fd)
    }, labels.userUpdated)
  }

  const setRole = (u: OwnerUserRow, role: 'STUDENT' | 'ADMIN') => {
    if (!window.confirm(t('admin.adminConfirm'))) return
    run(async () => {
      const fd = new FormData()
      fd.set('targetId', u.id)
      fd.set('role', role)
      fd.set('locale', locale)
      return ownerSetUserRole({ ok: false }, fd)
    }, labels.userUpdated)
  }

  const verify = (u: OwnerUserRow) => {
    if (!window.confirm(t('admin.activateConfirm'))) return
    run(async () => ownerVerifyUser(u.id, locale), labels.userUpdated)
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-extrabold">
          <Users className="text-[#f59e0b]" size={22} />
          {labels.title}
        </h1>
        <p className="mt-0.5 text-sm text-[hsl(var(--muted-foreground))]">{labels.subtitle}</p>
      </div>

      {/* Filters */}
      <Card className="flex flex-wrap items-center gap-3 p-3.5">
        <div className="relative min-w-56 flex-1 sm:max-w-sm">
          <Search
            size={15}
            className="pointer-events-none absolute inset-y-0 start-3 my-auto text-[hsl(var(--muted-foreground))]"
          />
          <Input
            defaultValue={filters.q}
            placeholder={labels.searchUsers}
            className="ps-9"
            aria-label={labels.searchUsers}
            onKeyDown={(e) => {
              if (e.key === 'Enter') navigate({ q: e.currentTarget.value })
            }}
          />
        </div>
        <Select
          value={filters.status}
          onChange={(e) => navigate({ status: e.target.value })}
          className="w-auto min-w-40"
          aria-label={labels.status}
        >
          <option value="all">{labels.status}: {labels.all}</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="PENDING">PENDING</option>
          <option value="SUSPENDED">SUSPENDED</option>
        </Select>
        <span className="ms-auto text-xs font-semibold text-[hsl(var(--muted-foreground))]">
          {pagination.total} {labels.users}
        </span>
      </Card>

      {/* Rows */}
      {users.length === 0 ? (
        <EmptyState icon={<Users size={22} />} title={labels.noResults} />
      ) : (
        <div className="space-y-2.5">
          {users.map((u) => (
            <Card key={u.id} className="flex flex-wrap items-center gap-3 p-3.5">
              <span
                className={cn(
                  'grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-extrabold',
                  u.isOwner
                    ? 'bg-gradient-to-br from-[#f59e0b] to-[#b45309] text-white'
                    : u.role === 'ADMIN'
                      ? 'bg-[hsl(var(--accent)/0.16)] text-[hsl(var(--accent))]'
                      : 'bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary))]',
                )}
              >
                {u.isOwner ? <ShieldCheck size={18} /> : u.name.slice(0, 1).toUpperCase()}
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-extrabold">
                  {u.name}
                  {u.isSelf && (
                    <span className="ms-2 text-[11px] font-semibold text-[hsl(var(--muted-foreground))]">
                      ({labels.you})
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-[hsl(var(--muted-foreground))]" dir="ltr">
                  {u.email}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <Badge color={u.isOwner ? '#f59e0b' : u.role === 'ADMIN' ? '#a855f7' : 'hsl(var(--primary))'}>
                  {u.isOwner ? labels.ownerBadge : u.role === 'ADMIN' ? labels.admins : labels.students}
                </Badge>
                <Badge color={STATUS_COLOR[u.status]}>{u.status}</Badge>
                <Badge color={u.verified ? 'hsl(var(--success))' : 'hsl(var(--warning))'}>
                  {u.verified ? labels.verified : labels.unverified}
                </Badge>
              </div>

              <div className="hidden gap-3 text-center md:flex">
                {[
                  { v: u.subjects, l: labels.subjects },
                  { v: u.lessons, l: labels.lessons },
                  { v: u.sessions, l: labels.sessions },
                ].map((s) => (
                  <div key={s.l}>
                    <p className="text-sm font-extrabold tabular-nums">{s.v}</p>
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{s.l}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {u.status === 'PENDING' && !u.verified && (
                  <Button size="sm" variant="outline" disabled={isPending} onClick={() => verify(u)}>
                    <BadgeCheck size={13} /> {labels.activate}
                  </Button>
                )}
                {u.status === 'SUSPENDED' ? (
                  <Button size="sm" variant="outline" disabled={isPending} onClick={() => setStatus(u, 'ACTIVE')}>
                    <UserCheck size={13} /> {labels.activate}
                  </Button>
                ) : (
                  !u.isOwner && (
                    <Button size="sm" variant="danger" disabled={isPending} onClick={() => setStatus(u, 'SUSPENDED')}>
                      <UserX size={13} /> {labels.suspend}
                    </Button>
                  )
                )}
                {!u.isOwner && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => setRole(u, u.role === 'ADMIN' ? 'STUDENT' : 'ADMIN')}
                  >
                    <ShieldCheck size={13} />
                    {u.role === 'ADMIN' ? labels.revokeAdmin : labels.makeAdmin}
                  </Button>
                )}
                {!u.isOwner && !u.isSelf && (
                  <Button size="sm" variant="danger" disabled={isPending} onClick={() => setDeleting(u)}>
                    <Trash2 size={13} /> {labels.delete}
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {(pagination.page > 1 || pagination.hasMore) && (
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            disabled={pagination.page <= 1}
            onClick={() => navigate({ page: String(pagination.page - 1) })}
          >
            {labels.prev}
          </Button>
          <span className="text-sm font-semibold text-[hsl(var(--muted-foreground))]">{pagination.page}</span>
          <Button
            variant="outline"
            disabled={!pagination.hasMore}
            onClick={() => navigate({ page: String(pagination.page + 1) })}
          >
            {labels.next}
          </Button>
        </div>
      )}

      {/* Delete modal — destructive: requires typing the account email */}
      {deleting && (
        <DeleteModal
          user={deleting}
          locale={locale}
          isPending={isPending}
          labels={labels}
          onClose={() => setDeleting(null)}
          onDone={(r) => {
            setDeleting(null)
            handle(r, labels.userDeleted)
          }}
        />
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

function DeleteModal({
  user,
  locale,
  isPending,
  labels,
  onClose,
  onDone,
}: {
  user: OwnerUserRow
  locale: string
  isPending: boolean
  labels: Record<string, string>
  onClose: () => void
  onDone: (r: ActionState) => void
}) {
  const t = useTranslations()
  const [typed, setTyped] = useState('')
  const [modalPending, startTransition] = useTransition()

  const submit = (fd: FormData) => {
    startTransition(async () => onDone(await ownerDeleteUser({ ok: false }, fd)))
  }

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <Card className="relative z-10 w-full max-w-md p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[hsl(var(--danger)/0.14)] text-[hsl(var(--danger))]">
              <Trash2 size={18} />
            </span>
            <h2 className="text-base font-extrabold">{labels.deleteConfirmTitle}</h2>
          </div>
          <button onClick={onClose} aria-label={t('common.close')} className="rounded-lg p-1.5 hover:bg-[hsl(var(--muted))]">
            <X size={18} />
          </button>
        </div>
        <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">{labels.deleteConfirmHelp}</p>

        <form action={submit} className="mt-4 space-y-3">
          <input type="hidden" name="targetId" value={user.id} />
          <input type="hidden" name="locale" value={locale} />
          <Input
            name="confirmEmail"
            dir="ltr"
            autoComplete="off"
            placeholder={labels.deleteTypeEmail}
            value={typed}
            onChange={(e) => setTyped(e.currentTarget.value)}
            aria-label={labels.deleteTypeEmail}
          />
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {labels.cancel}
            </Button>
            <Button
              type="submit"
              variant="danger"
              disabled={modalPending || typed.trim().toLowerCase() !== user.email}
            >
              <CheckCircle2 size={14} /> {labels.confirmDelete}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
