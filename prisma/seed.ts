import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

/**
 * Development seed.
 *  - Creates an administrator account (role granted ONLY through this
 *    server-side process — never from the client).
 *  - Creates a demo student with a complete academic structure so the
 *    dashboard is not empty on first run.
 *  - Idempotent: safe to run repeatedly.
 */
async function main() {
  const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@marevision.app'
  const password = process.env.SEED_PASSWORD ?? 'Admin12345'
  const hash = await bcrypt.hash(password, 10)

  // ── Platform owner ────────────────────────────────────────────
  // Provisioned ONLY here — no admin or client action can ever create,
  // demote, suspend or delete an OWNER account.
  const ownerEmail = process.env.OWNER_EMAIL ?? 'owner@marevision.app'
  const ownerPassword = process.env.OWNER_PASSWORD ?? 'Owner12345'
  const owner = await prisma.user.upsert({
    where: { email: ownerEmail },
    update: { role: 'OWNER', status: 'ACTIVE' },
    create: {
      email: ownerEmail,
      passwordHash: await bcrypt.hash(ownerPassword, 10),
      name: 'مالك المنصة',
      role: 'OWNER',
      status: 'ACTIVE',
      locale: 'ar',
      emailVerifiedAt: new Date(),
      profile: { create: { school: 'مراجعتي', program: 'الملكية' } },
      prefs: { create: {} },
    },
  })

  // ── Administrator ─────────────────────────────────────────────
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: 'ADMIN', status: 'ACTIVE' },
    create: {
      email: adminEmail,
      passwordHash: hash,
      name: 'مدير المنصة',
      role: 'ADMIN',
      status: 'ACTIVE',
      locale: 'ar',
      emailVerifiedAt: new Date(),
      profile: { create: { school: 'مراجعتي', program: 'الإدارة' } },
      prefs: { create: {} },
    },
  })

  // ── Demo student ──────────────────────────────────────────────
  const studentEmail = 'student@marevision.app'
  const student = await prisma.user.upsert({
    where: { email: studentEmail },
    update: {},
    create: {
      email: studentEmail,
      passwordHash: await bcrypt.hash('Student12345', 10),
      name: 'طالب تجريبي',
      role: 'STUDENT',
      status: 'ACTIVE',
      locale: 'ar',
      emailVerifiedAt: new Date(),
      profile: { create: { school: 'كلية العلوم', program: 'إجازة في الرياضيات', timezone: 'Africa/Nouakchott' } },
      prefs: { create: { maxDailyMinutes: 240, preferredSessionMin: 60 } },
      availability: {
        create: [
          { weekday: 1, startTime: '08:00', endTime: '12:00' },
          { weekday: 2, startTime: '08:00', endTime: '12:00' },
          { weekday: 3, startTime: '08:00', endTime: '12:00' },
          { weekday: 4, startTime: '08:00', endTime: '12:00' },
          { weekday: 6, startTime: '16:00', endTime: '20:00' },
        ],
      },
    },
  })

  const existingYear = await prisma.academicYear.findFirst({
    where: { userId: student.id, name: '2026 / 2027' },
  })

  if (!existingYear) {
    const year = await prisma.academicYear.create({
      data: {
        userId: student.id,
        name: '2026 / 2027',
        startDate: new Date('2026-09-01'),
        endDate: new Date('2027-06-30'),
        isCurrent: true,
        status: 'ACTIVE',
        description: 'السنة الجامعية الحالية',
      },
    })

    const sem1 = await prisma.semester.create({
      data: {
        userId: student.id,
        academicYearId: year.id,
        name: 'الفصل الأول',
        startDate: new Date('2026-09-01'),
        endDate: new Date('2027-01-31'),
        order: 1,
        isCurrent: true,
      },
    })

    await prisma.specialization.create({
      data: {
        userId: student.id,
        academicYearId: year.id,
        name: 'رياضيات وعلوم الحاسوب',
        program: 'إجازة جامعية',
        description: 'مسار علمي',
      },
    })

    // Two subjects with chapters + lessons (some completed).
    const subjects = [
      { name: 'التحليل الرياضي', color: '#1b6af5', coef: 3, chapters: ['النهايات والاتصال', 'الاشتقاقية'], lessonsPerChapter: 4 },
      { name: 'الجبر الخطي', color: '#059669', coef: 2, chapters: ['المصفوفات', 'الفضاءات المتجهية'], lessonsPerChapter: 3 },
    ] as const

    for (const [si, s] of subjects.entries()) {
      const subject = await prisma.subject.create({
        data: {
          userId: student.id,
          semesterId: sem1.id,
          name: s.name,
          color: s.color,
          coefficient: s.coef,
          importance: si === 0 ? 'HIGH' : 'MEDIUM',
          priority: si === 0 ? 1 : 2,
          estimatedHours: 40,
          order: si,
          examDate: new Date(Date.now() + (30 + si * 20) * 86400000),
        },
      })

      for (const [ci, c] of s.chapters.entries()) {
        const chapter = await prisma.chapter.create({
          data: { userId: student.id, subjectId: subject.id, title: c, order: ci },
        })
        for (let li = 0; li < s.lessonsPerChapter; li++) {
          const done = ci === 0 && li < 2
          await prisma.lesson.create({
            data: {
              userId: student.id,
              chapterId: chapter.id,
              subjectId: subject.id,
              title: `${c} — الدرس ${li + 1}`,
              order: li,
              estimatedMinutes: 45,
              priority: li === 0 ? 'HIGH' : 'MEDIUM',
              status: done ? 'COMPLETED' : 'NOT_STARTED',
              completedAt: done ? new Date(Date.now() - (li + 1) * 86400000) : null,
            },
          })
        }
      }
    }
  }

  console.log('✔ Seed complete')
  console.log(`  owner   : ${owner.email}  (password: ${ownerPassword})`)
  console.log(`  admin   : ${admin.email}  (password: ${password})`)
  console.log(`  student : ${student.email}  (password: Student12345)`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
