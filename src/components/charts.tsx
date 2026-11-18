'use client'

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'

const AXIS = { stroke: 'hsl(var(--muted-foreground))', fontSize: 11 }
const GRID = { stroke: 'hsl(var(--border))', strokeDasharray: '3 3' }

function tooltipStyle() {
  return {
    background: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: 12,
    fontSize: 12,
    color: 'hsl(var(--foreground))',
    boxShadow: '0 8px 24px rgba(0,0,0,.25)',
  }
}

export interface SubjectBar {
  name: string
  percent: number
  color: string
  completed: number
  total: number
}

export function ProgressBySubjectChart({
  data,
  labels,
}: {
  data: SubjectBar[]
  labels: { completed: string; total: string }
}) {
  if (!data.length) return null
  return (
    <div dir="ltr" className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 8 }}>
          <CartesianGrid {...GRID} vertical={false} />
          <XAxis dataKey="name" tick={AXIS} tickLine={false} axisLine={false} interval={0} />
          <YAxis
            tick={AXIS}
            tickLine={false}
            axisLine={false}
            domain={[0, 100]}
            unit="%"
            width={46}
          />
          <Tooltip
            contentStyle={tooltipStyle()}
            cursor={{ fill: 'hsl(var(--muted))' }}
            formatter={(v: number, _n, p) => [`${v}%`, `${p.payload.completed} / ${p.payload.total}`]}
          />
          <Bar dataKey="percent" radius={[6, 6, 0, 0]} maxBarSize={44}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function CompletedOverTimeChart({
  data,
  label,
}: {
  data: { date: string; completed: number }[]
  label: string
}) {
  if (!data.length) return null
  const short = data.map((d) => ({ ...d, d: d.date.slice(5) }))
  return (
    <div dir="ltr" className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={short} margin={{ top: 8, right: 8, left: -18, bottom: 8 }}>
          <CartesianGrid {...GRID} vertical={false} />
          <XAxis dataKey="d" tick={AXIS} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} width={46} />
          <Tooltip contentStyle={tooltipStyle()} labelFormatter={(l) => String(l)} />
          <Line
            type="monotone"
            dataKey="completed"
            name={label}
            stroke="hsl(var(--primary))"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function WeeklyActivityChart({
  data,
  label,
}: {
  data: { day: string; minutes: number }[]
  label: string
}) {
  if (!data.length) return null
  return (
    <div dir="ltr" className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 8 }}>
          <CartesianGrid {...GRID} vertical={false} />
          <XAxis dataKey="day" tick={AXIS} tickLine={false} axisLine={false} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={46} />
          <Tooltip
            contentStyle={tooltipStyle()}
            cursor={{ fill: 'hsl(var(--muted))' }}
            formatter={(v: number) => [`${v} min`, label]}
          />
          <Bar dataKey="minutes" name={label} fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function PlannedVsActualChart({
  data,
  labels,
}: {
  data: { label: string; planned: number; actual: number }[]
  labels: { planned: string; actual: string }
}) {
  if (!data.length) return null
  return (
    <div dir="ltr" className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 8 }}>
          <CartesianGrid {...GRID} vertical={false} />
          <XAxis dataKey="label" tick={{ ...AXIS, fill: 'transparent' }} tickLine={false} axisLine={false} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={46} />
          <Tooltip contentStyle={tooltipStyle()} formatter={(v: number, n) => [`${v} min`, n]} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="planned" name={labels.planned} fill="hsl(var(--muted-foreground))" radius={[6, 6, 0, 0]} maxBarSize={60} />
          <Bar dataKey="actual" name={labels.actual} fill="hsl(var(--success))" radius={[6, 6, 0, 0]} maxBarSize={60} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function TimeDistributionChart({
  data,
  emptyLabel,
}: {
  data: { name: string; value: number; color: string }[]
  emptyLabel: string
}) {
  if (!data.length) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">
        {emptyLabel}
      </div>
    )
  }
  return (
    <div dir="ltr" className="flex h-64 w-full flex-col items-center">
      <ResponsiveContainer width="100%" height="75%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="55%"
            outerRadius="85%"
            paddingAngle={3}
          >
            {data.map((d, i) => (
              <Cell key={i} fill={d.color} stroke="none" />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle()} formatter={(v: number) => [`${v} min`]} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 px-2">
        {data.slice(0, 6).map((d) => (
          <span key={d.name} className="flex items-center gap-1.5 text-[11px] text-[hsl(var(--muted-foreground))]">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
            <span className="max-w-28 truncate">{d.name}</span>
            <span className="font-semibold tabular-nums">{Math.round(d.value / 60)}h</span>
          </span>
        ))}
      </div>
    </div>
  )
}
