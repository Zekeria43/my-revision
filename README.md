# مراجعتي — Ma Révision — My Revision

> منصة أكاديمية متعددة اللغات (العربية / الفرنسية / الإنجليزية) لإدارة الدراسة: البنية الأكاديمية، الحصص، التقويم، المخطط الذكي، الاختبارات، الملاحظات، الإشعارات، التحليلات، ولوحة الإدارة — مع PWA وتصدير PDF/CSV.

**🔗 صفحة الهبوط المنشورة:** **https://marevision.surge.sh** (ثابتة، 3 لغات) — التطبيق الكامل يعمل محليًا ويُنشر على Vercel (القسم 9).

**الاسم التجاري:** `مراجعتي` · `Ma Révision` · `My Revision` — لا يُستخدم اسم قديم في أي مكان.

---

## 1. المتطلبات

| الأداة | الإصدار |
| --- | --- |
| Node.js | ≥ 20 (مُختبر على v24) |
| npm | ≥ 10 |
| قاعدة بيانات | SQLite (محلي، افتراضي) أو PostgreSQL/Supabase (إنتاج) |

## 2. التثبيت

```bash
# 1) الاعتماديات
npm install

# 2) ملف البيئة
copy .env.example .env.local        # Windows
# cp .env.example .env.local        # macOS / Linux

# 3) توليد عميل Prisma
npx prisma generate

# 4) تطبيق الهجرات + البذور (حسابات تجريبية + سنة دراسية)
npx prisma migrate dev
npm run db:seed

# 5) التشغيل
npm run dev                         # http://localhost:3000
```

> **ملاحظة Prisma:** أداة Prisma تقرأ `.env` (وليست `.env.local`). عند تشغيل `prisma migrate` يُفضّل وجود `DATABASE_URL` في `.env` أيضًا.

### حسابات البذور (seed)

| الدور | البريد | كلمة المرور |
| --- | --- | --- |
| **مالك (OWNER)** | `owner@marevision.app` | `Owner12345` |
| مدير | `admin@marevision.app` | `Admin12345` |
| طالب | `student@marevision.app` | `Student12345` |

غيّر هذه كلمات المرور فورًا في بيئة الإنتاج، أو احذف الحسابات بعد إنشاء حساباتك.

> **دور المالك (`OWNER`)** يُمنح **فقط عبر عملية البذور** — لا يوجد أي إجراء إداري أو عميلي ينشئه أو يُغيّره أو يحذفه. يملك لوحة **`/owner`** المستقلة تمامًا: نظرة عامة، إدارة المستخدمين (مع حذف بتأكيد كتابي)، سجل البريد، إعدادات المنصة (فتح/إغلاق التسجيل + حدّ البريد اليومي)، وسجل التدقيق. حسابات المالك غير القابلة للمس من لوحة الإدارة ولا من لوحة المالك نفسه (منع الانقفال الذاتي). التوجيه بعد الدخول حسب الدور: `OWNER → /owner` · `ADMIN → /admin` · `STUDENT → /dashboard`.

## 3. الإعداد (`.env.local`)

راجع [.env.example](./.env.example) — كل المفاتيح موثّقة هناك. أبرزها:

| المفتاح | الوصف |
| --- | --- |
| `DATABASE_URL` | `file:./dev.db` محليًا، أو سلسلة PostgreSQL في الإنتاج |
| `SESSION_SECRET` | سر عشوائي 48+ بايت: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `AUTH_EMAIL_MODE` | `console` (تطوير — يطبع الرسائل في اللوج) أو `smtp` أو `brevo` (إنتاج عبر Brevo API) |
| `SMTP_*` | بيانات خادم البريد عند استخدام `smtp` |
| `BREVO_API_KEY` / `BREVO_SENDER_EMAIL` / `BREVO_SENDER_NAME` | مفاتيح Brevo عند استخدام `brevo` — من الخادم فقط، لا تُرفع للواجهة أبداً |
| `EMAIL_DAILY_SEND_LIMIT` | الحد الأقصى لرسائل البريد التلقائية (تفعيل/إعادة إرسال/استعادة) لكل عنوان كل 24 ساعة — افتراضي `3`، الحد الأدنى `1` |
| `STORAGE_DRIVER` | `local` (الملفات في `./uploads` محفوظة خاصّة) |
| `CRON_SECRET` | سر التوثيق لمسار الإشعارات المجدول |
| `ADMIN_EMAIL` | البريد الذي يحصل على دور `ADMIN` عند تشغيل `npm run db:seed` |

**الأدوار** تُمنح فقط عبر العملية الخادمة (البذرة / لوحة الإدارة) — لا توجد أي واجهة تسمح للمستخدم برفع دوره بنفسه.

## 4. الأوامر

| الأمر | الوظيفة |
| --- | --- |
| `npm run dev` | خادم التطوير |
| `npm run build` | بناء الإنتاج |
| `npm start` | تشغيل بناء الإنتاج |
| `npm run typecheck` | فحص TypeScript بدون إخراج |
| `npm run messages:build` | التحقق من تطابق مفاتيح الترجمة (يفشل البناء عند نقص مفتاح) |
| `npm test` | تشغيل اختبارات vitest |
| `npm run test:watch` | اختبارات مستمرة |
| `npm run prisma:migrate` | هجرة تطوير (تشمل توليد العميل) |
| `npm run prisma:deploy` | هجرة إنتاج |
| `npm run prisma:studio` | متصفح قاعدة البيانات |
| `npm run db:seed` | البذور (حسابات + سنة دراسية تجريبية) |
| `npm run pwa:icons` | إعادة توليد أيقونات PWA |
| `npx surge ./surge-site marevision.surge.sh` | إعادة نشر صفحة الهبوط الثابتة (9.3) |

## 5. اللغات وRTL/LTR

- ثلاث لغات: `ar` (افتراضية، RTL كامل)، `fr`، `en` (LTR) — الملفات في `messages/{ar,fr,en}.json`.
- **تطابق المفاتيح إلزامي:** `npm run messages:build` يقارن المفاتيح الثلاثة ويفشل البناء عند أي نقص.
- كل نص في الواجهة والأخطاء والحقول وال حالات الفارغة/التحميل مترجم. **محتوى المستخدم (عناوين الدروس، أسماء المواد، الملاحظات) لا يُترجم أبدًا** — يُعرض كما كُتب.

## 6. الميزات

- **البنية الأكاديمية:** سنة ← فصل ← تخصص ← مادة ← فصل دراسي (chapter) ← درس، مع حالات وتقدّم.
- **التقويم:** عروض يوم/أسبوع/شهر، جلسات دراسية، جلسات فائتة مع اقتراح إعادة جدولة **وأرشيف لإعادة الجدولة**.
- **المخطط الذكي:** يبني جدولًا واقعيًا من أوقاتك المتاحة وأولوياتك وامتحاناتك — دون تداخل، وضمن حدّ يومي.
- **المؤقت:** بومودورو + سطح توقف (stopwatch)، إعدادات قابلة للحفظ، ربط الحصة/المادة، وحفظ الجلسات في قاعدة البيانات.
- **الاختبارات:** عدّ تنازلي، درجة أهمية، تقدّم المراجعة، وتوليد خطة مراجعة.
- **الملاحظات والموارد:** نصوص، روابط، ورفع ملفات (فحص الامتداد + البايتات السحرية + سقف 10MB) — التحميل يمرّ بمسار مصادق يتحقق من الملكية دائمًا.
- **الإشعارات:** مركز إشعارات + تفضيلات + مسار cron لتوليد التذكيرات/الامتحانات/الدروس المتأخرة/الملخص الأسبوعي.
- **التحليلات:** مؤشرات، توزيع أسبوعي، تقدّم تراكمي، وقت مخطط مقابل فعلي، أيام الذروة.
- **التصدير:** CSV حقيقي (`/api/export/csv`) و تقرير قابل للطباعة/PDF (`/{locale}/report` → Save as PDF) وتصدير JSON كامل للبيانات (`/api/export/data`).
- **سجل النشاط:** كل عملية تُسجَّل ولا تُمحى.
- **الإدارة:** إحصاءات المنصة، إدارة المستخدمين (تفعيل/تعليق/ترقية)، وسجل تدقيق — خلف `requireAdmin()`.
- **لوحة المالك `/owner`:** مستقلة تمامًا: نظرة عامة (إحصائيات + مخطط تسجيلات 30 يومًا)، إدارة المستخدمين (تفعيل/إيقاف/ترقية/حذف **بتأكيد كتابي** للبريد)، سجل البريد مع عدّادات الحصّة، إعدادات المنصة (**فتح/إغلاق التسجيل** و**حدّ البريد اليومي** — تُفرض من الخادم فورًا)، وسجل تدقيق بكل عملية — خلف `requireOwner()`.
- **الحساب:** تفعيل بالبريد، استعادة كلمة المرور، جلسات نشطة قابلة للإبطال، تصدير/حذف الحساب.
- **PWA:** manifest + service worker + صفحة `offline`.

## 7. الأمان

- **مصادقة حقيقية:** جلسات في قاعدة البيانات، الرمز يُخزَّن مُجزَّأً SHA-256، كوكي `httpOnly`، تجزئة bcrypt.
- **تفويض خادمي:** `requireUser()` / `requireAdmin()` / `requireOwner()` في كل صفحة/إجراء — لا يُؤتَمَن أي معرّف يُرسل من العميل أبدًا. دور `OWNER` حصري عبر البذور: إجراءات المالك والإدارة معًا ترفض أي استهداف لحساب مالك (`errors.forbidden`)، ومنع الانقفال الذاتي (المالك لا يُغيّر دوره/حالته أو يحذف نفسه).
- **إعدادات المنصّة:** `REGISTRATION_OPEN` و`EMAIL_DAILY_SEND_LIMIT` في جدول `PlatformSetting` — يقرؤها التطبيق من قاعدة البيانات (القاعدة تسبق البيئة) ولا تُكتب إلا عبر إجراءات المالك مع تدقيق قبل التنفيذ.
- **عزل الطلاب:** كل استعلام مُقيَّد بـ `userId`؛ اختبارات `tests/integration/isolation.test.ts` تتحقق من ذلك على قاعدة حقيقية.
- **الملفات:** لا تُقدَّم كأصول ثابتة — تمرّ دائمًا عبر `/api/files/[id]` مع التحقق من الملكية، ورفض `..` وحظر الامتدادات الخبيثة.
- **تحديد المعدل:** مُحدِّد داخل الذاكرة (`src/lib/rate-limit.ts`) — للإنتاج متعدد النسخ انقل المخزن إلى Redis بنفس الواجهة.
- **السِّرّ:** `.env` و`.env.local` مُتجاهلان في git، و`.env.example` بدون أسرار.
- **بدون حذف صامت:** حذف الحساب يتطلب كلمة مرور + كتابة `DELETE`، ولا تُحذف بيانات مستخدم آخر في أي مسار عادي.

## 8. الاختبار

```bash
npm test
```

**التغطية الحالية (161 اختبارًا / 16 ملفًا):**

| الملف | ما يختبره |
| --- | --- |
| `tests/unit/validation.test.ts` | سكيما zod: تسجيل، كلمة مرور، اختبارات، ملاحظات، موارد، دروس، توافرية |
| `tests/unit/session-crypto.test.ts` | تجزئة الرموز (SHA-256)، توليد رموز فريدة، تجزئة/تحقق bcrypt مع ملح |
| `tests/unit/rate-limit.test.ts` | نافذة الانزلاق، الاستقلال بين المفاتيح، انتهاء المهلة، التصفير |
| `tests/unit/progress.test.ts` | حسابات التقدّم: تجميع، تقريب، عدم القسمة على صفر، تقييد الاستعلام بالمالك |
| `tests/unit/scheduler.test.ts` | تحويل الوقت، كشف التداخل (بما فيه الحواف المتجاورة)، تقييد الاستعلام |
| `tests/integration/isolation.test.ts` | **عزل طالبين حقيقيين**: تقدّم، تحليلات، تداخل جلسات، رفض معرّفات الغير |
| `tests/unit/api-pending.test.ts` | 403 لكل مسار API لحساب `PENDING` · 401 بلا جلسة · `ACTIVE` يمر |
| `tests/unit/guards.test.ts` | مصفوفة `requireUser`/`requireAdmin`/`requireOwner` × (null, PENDING, ACTIVE, STUDENT, ADMIN, OWNER) |
| `tests/unit/message-usage.test.ts` | كل مفتاح رسائل حرفية في `src/` موجود فعلاً في الكتالوج |
| `tests/unit/email-templates.test.ts` + `mail.test.ts` | قوالب البريد ×3 لغات ومحرّكات console/smtp/brevo |
| `tests/integration/register-academic.test.ts` | الحفظ الفعلي للحقول الأكاديمية (والفارغة تُخزَّن NULL) |
| `tests/integration/verify-enforcement.test.ts` | التفعيل الإجباري: رموز منتهية/مستخدمة/موقوفين + إعادة إرسال |
| `tests/integration/email-quota.test.ts` | الحصة المشتركة: حجز ذرّي (6 طلبات متزامنة → 3)، استرجاع الفشل، تصفير النافذة، منع كشف الحسابات |
| `tests/integration/password-recovery.test.ts` | استعادة كاملة: انتهاء/استخدام واحد، إبطال الجلسات، `peekToken`، حدّ النسيان |
| `tests/integration/owner.test.ts` | لوحة المالك: توجيه `requireOwner`، إجراءات مُدقَّقة، حماية OWNER، منع الانقفال الذاتي، إغلاق التسجيل، تجاوز حدّ البيئة، توجيه الدخول حسب الدور |

الاختبارات تُشغَّل تسلسليًا (ملفًا ملفًا) لأنها تتشارك ملف SQLite واحدًا، و**تحذف في نهايتها حساباتها التجريبية فقط** ولا تمسّ بيانات البذور.

## 9. الإنتاج

### 9.1 قاعدة البيانات (SQLite ← PostgreSQL/Supabase)

1. في `prisma/schema.prisma`: بدّل `provider = "sqlite"` إلى `provider = "postgresql"` (كل النماذج متوافقة مسبقًا).
2. في `.env.local`:
   ```bash
   DATABASE_URL="postgresql://postgres.<PROJECT>.supabase.co:6543/postgres?sslmode=require"
   DIRECT_URL="postgresql://postgres.<PROJECT>.supabase.co:5432/postgres?sslmode=require"
   ```
3. `npx prisma migrate deploy` ثم `npm run db:seed` (اختياري).

### 9.2 النشر على Vercel

```bash
npm run build       # تحقق محليًا أولًا
```

- اربط المستودع في Vercel وأضف متغيرات البيئة من `.env.example` (لا ترفع `.env.local`).
- عند النشر: `npm run prisma:deploy` كخطوة بناء أو عبر سكربت `postbuild`.
- الملفات المرفوعة (`./uploads`) **غير دائمة** على Vercel — في الإنتاج استخدم `STORAGE_DRIVER=supabase` مع خَزانة (bucket) خاص.

### 9.3 صفحة الهبوط المنشورة (Surge) — LIVE ✅

**https://marevision.surge.sh** — صفحة هبوط **ثابتة** بالشعار الفقاعي وثلاث لغات (عربي RTL / فرنسي / إنجليزي): المزايا، روابط التطبيق المحلي، جدول حسابات البذور، وأوامر التشغيل.

```bash
# إعادة النشر بعد أي تعديل على surge-site/
npx surge ./surge-site marevision.surge.sh
```

> **مهم:** Surge يستضيف المواقع الثابتة فقط. التطبيق الكامل (Next.js + قاعدة بيانات + مصادقة) يعمل محليًا ويُنشر على **Vercel** (انظر 9.2) — صفحة Surge ليست تشغيلًا للتطبيق.

### 9.4 الإشعارات المجدولة (Cron)

المسار `GET /api/cron/notifications` يولّد:

- تذكيرات الجلسات (قبل `remindBeforeMin`)
- جلسات فائتة
- امتحانات قادمة (7/3/1/0 يوم)
- دروس متأخرة
- ملخص أسبوعي (الاثنين)

**التوثيق:** ترويسة `Authorization: Bearer $CRON_SECRET` أو `?secret=`. بدون `CRON_SECRET` يرجع المسار 404 — **لا يُفتح افتراضيًا أبدًا**.

أمثلة جدولة:

```bash
# Vercel (vercel.json)
{ "crons": [{ "path": "/api/cron/notifications", "schedule": "0 6 * * *" }] }

# GitHub Actions
- cron: '0 6 * * *'
  run: curl -fsS -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
        "https://<domain>/api/cron/notifications"
```

### 9.5 البريد

- تطوير: `AUTH_EMAIL_MODE=console` (تظهر الرسائل في سجل الخادم).
- إنتاج (موصى به): `AUTH_EMAIL_MODE=brevo` مع `BREVO_API_KEY` و`BREVO_SENDER_EMAIL` و`BREVO_SENDER_NAME`.
- إنتاج (بديل): `AUTH_EMAIL_MODE=smtp` مع `SMTP_HOST/PORT/USER/PASS/FROM`.

> قوالب البريد متعددة اللغات (عربي RTL · فرنسي · إنجليزي) وتُبنى من `messages/*.json` عبر `src/lib/email-templates.ts`.

**حد الإرسال المشترك:** على الأكثر `EMAIL_DAILY_SEND_LIMIT` (افتراضي 3) رسائل تحقق/إعادة إرسال/استعادة كلمة مرور ناجحة لكل عنوان في نافذة 24 ساعة انزلاقية. الحد يُفرض ذرّياً عبر تحديث شرطي في قاعدة البيانات (`src/lib/email-quota.ts`) فلا يمكن تجاوزه بالطلبات المتزامنة، والرسائل الفاشلة تُعاد حصتها، وكل محاولة تُسجَّل في `EmailLog` (SENT/FAILED/SKIPPED) للمراقبة. العناوين غير المعروفة تستهلك الحصّة نفسها وتُسجَّل SKIPPED حتى لا يُكشف وجود الحساب. رسائل الأمان (SECURITY) لا تُحتسب.

## 10. التصدير

| النوع | الطريقة |
| --- | --- |
| **PDF** | التحليلات ← `Export PDF` → صفحة تقرير A4 → زر الطباعة → *Save as PDF* (يحافظ على RTL/العربية والرسوم المتجهة) |
| **CSV** | `GET /api/export/csv?type=sessions|lessons|progress|analytics&range=7d|30d|90d|year` (‏UTF-8 BOM — يفتح عربيًا في Excel) |
| **JSON كامل** | الإعدادات ← البيانات ← *Export my data* → `/api/export/data` (بدون بيانات اعتماد) |

## 11. بنية المشروع

```
marevision/
├── messages/{ar,fr,en}.json     # 739 مفتاحًا × 3 لغات (تطابق إلزامي)
├── prisma/schema.prisma         # المخطط (SQLite محليًا، PostgreSQL جاهزًا)
├── scripts/build-messages.mjs   # بوابة تطابق الترجمة
├── scripts/generate-icons.mjs   # توليد أيقونات PWA (PNG بلا اعتماديات)
├── tests/{unit,integration}/    # vitest (16 ملفًا)
└── src/
    ├── actions/                 # Server Actions (auth, academic, sessions, content, notifications, settings, admin, owner)
    ├── app/
    │   ├── [locale]/            # ar | fr | en
    │   │   ├── (auth)/          # دخول، تسجيل، تفعيل، استعادة
    │   │   ├── (app)/           # لوحة التحكم، أكاديمي، مواد، تقويم، مخطط، مؤقت، اختبارات، ملاحظات، إشعارات، تحليلات، سجل، إعدادات، إدارة
    │   │   ├── (owner)/owner/   # لوحة المالك: نظرة عامة، مستخدمون، بريد، إعدادات، تدقيق
    │   │   └── report/          # تقرير الطباعة/PDF
    │   └── api/                 # files, export/csv, export/data, cron/notifications
    ├── components/              # نظام التصميم، الشعار الفقاعي، shell للمستخدم/المالك، المخططات، النماذج
    ├── lib/                     # db, auth (guards/session/tokens), platform-settings, email-quota, scheduler, progress, analytics, storage, mail, rate-limit
    └── middleware.ts            # توجيه اللغات فقط (المصادقة خادمية)
```

## 12. استكشاف الأخطاء

| المشكلة | الحل |
| --- | --- |
| `prisma migrate` لا يجد `DATABASE_URL` | أنشئ `.env` (Prisma يقرأ `.env` وليس `.env.local`) |
| فشل `messages:build` | أضِف المفتاح المفقود في **الثلاث ملفات** ثم أعد `npm run messages:build` |
| تحذير ملفات lockfile مكرّرة | سببه مشروع `Default Project` المجاور — يعالجه `outputFileTracingRoot` في `next.config.ts` |
| الرفع مرفوض | امتداد غير مسموح أو > 10MB — راجع `src/lib/storage.ts` |
| الإشعارات لا تُولَّد | تأكد من `CRON_SECRET` ومن أن المُجدول يستدعي المسار |
| 404 على `/admin` | سجّل الدخول بحساب `ADMIN` (انظر حسابات البذور) |
| وُجد `/owner` وطُردت إلى `/admin` أو `/dashboard` | الدور `OWNER` يُمنح فقط عبر `npm run db:seed` — سجّل الدخول بحساب المالك |
| التسجيل مرفوض: «Registration is currently closed» | مفتاح `REGISTRATION_OPEN` مُغلق من لوحة المالك — أعد فتحه من `/owner/settings` |

---

مراجعتي — Ma Révision — My Revision · منصة مفتوحة للتطوير بدون أي تعهد بالنشر — لا يُرفع أي commit أو نشر أو deploy بدون إذن صريح.
