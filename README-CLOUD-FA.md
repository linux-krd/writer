# نویسه — نسخه دارای ورود گوگل و همگام‌سازی Google Drive

این نسخه، رابط و قابلیت‌های اصلی برنامه نویسه را حفظ می‌کند و یک لایه اختیاری ابری به آن اضافه می‌کند. تا وقتی تنظیمات Supabase انجام نشده باشد، برنامه مانند نسخه قبلی به‌صورت محلی کار می‌کند.

## آنچه اضافه شده است

- ورود و خروج با Google از طریق Supabase Auth.
- اتصال جداگانه Google Drive با OAuth و مجوز محدود `drive.file`.
- ذخیره نسخه پشتیبان JSON با نام `nawisa-backup.json` در پوشه `نویسه` در Drive هر کاربر.
- همگام‌سازی دوطرفه نوشته‌ها و پوشه‌ها با ادغام بر اساس شناسه و زمان آخرین تغییر.
- نگهداری نشانگر حذف برای جلوگیری از بازگشت نوشته/پوشه حذف‌شده هنگام همگام‌سازی.
- تلاش برای همگام‌سازی پس از تغییرات، بازگشت اینترنت و بازشدن دوباره برنامه.
- نگهداری Refresh Token رمزنگاری‌شده فقط در بک‌اند Supabase.

**نکته درباره ساختار Drive:** برای جلوگیری از ساخت تعداد زیادی فایل پراکنده و ساده‌کردن همگام‌سازی دوطرفه، نوشته‌ها و پوشه‌ها در یک فایل پشتیبان JSON قرار می‌گیرند. ساختار پوشه‌ها و نوشته‌ها هنگام بازیابی در خود برنامه بازسازی می‌شود؛ هر نوشته به‌صورت یک فایل جداگانه در Drive ساخته نمی‌شود.

## پیش‌نیاز

- یک پروژه Supabase.
- یک پروژه Google Cloud با OAuth Client از نوع Web application.
- میزبانی PWA روی HTTPS (برای توسعه می‌توان از localhost استفاده کرد).
- Supabase CLI برای Deploy کردن Edge Function.

## گام ۱ — تنظیم Supabase

1. در https://supabase.com یک پروژه بساز.
2. در SQL Editor فایل `supabase/schema.sql` را اجرا کن.
3. از Project Settings → API این دو مقدار را بردار:
   - Project URL
   - Publishable key (یا anon/public key قدیمی)
4. مقادیر را در `config.js` جایگزین کن:

```js
export const SUPABASE_URL = 'https://YOUR_PROJECT_REF.supabase.co';
export const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY';
```

کلید Publishable/anon برای استفاده در مرورگر است؛ **هرگز service role key را در `config.js` قرار نده.**

## گام ۲ — تنظیم Google Cloud و ورود Google در Supabase

1. در https://console.cloud.google.com یک پروژه ایجاد کن.
2. در Google Auth Platform، صفحه رضایت OAuth را تکمیل کن.
3. برای ورود Supabase، در Supabase → Authentication → Sign In / Providers → Google، Provider را فعال کن.
4. در Google Cloud یک OAuth Client از نوع Web application بساز.
5. در Authorized redirect URIs آدرس Callback که Supabase در صفحه تنظیمات Google Provider نشان می‌دهد اضافه کن. آدرس را عیناً از Supabase کپی کن.
6. Client ID و Client Secret را در تنظیمات Google Provider در Supabase وارد و ذخیره کن.
7. در Supabase → Authentication → URL Configuration، آدرس اصلی PWA را به Site URL و Redirect URLs اضافه کن؛ برای نمونه `https://your-domain.example/**`.

## گام ۳ — فعال‌کردن Google Drive API و OAuth callback

1. در Google Cloud → APIs & Services → Library، گزینه Google Drive API را فعال کن.
2. همان OAuth Client را باز کن و این آدرس را نیز به Authorized redirect URIs اضافه کن:

```text
https://YOUR_PROJECT_REF.supabase.co/functions/v1/drive-sync?action=callback
```

3. در Google Auth Platform، scope زیر را اضافه/درخواست کن:

```text
https://www.googleapis.com/auth/drive.file
```

4. در زمان توسعه، ایمیل کاربران آزمایشی را در Test users اضافه کن. پیش از انتشار عمومی، وضعیت OAuth consent screen و الزامات Verification را طبق صفحه Google تکمیل کن.

ورود به اپلیکیشن و اتصال Drive دو اجازه جدا هستند: ابتدا کاربر با Google وارد برنامه می‌شود و سپس با دکمه «اتصال Google Drive» مجوز Drive را جداگانه می‌دهد.

## گام ۴ — تنظیم Edge Function و اسرار

در ریشه پوشه پروژه (جایی که پوشه `supabase` وجود دارد) Supabase CLI را نصب/راه‌اندازی و به پروژه وصل کن. سپس یک کلید رمزنگاری ۳۲ بایتی بساز:

```bash
openssl rand -base64 32
```

مقادیر زیر را به‌صورت Secrets ثبت کن (هیچ‌کدام را در فایل‌های frontend قرار نده):

```bash
supabase secrets set GOOGLE_CLIENT_ID="YOUR_GOOGLE_CLIENT_ID"
supabase secrets set GOOGLE_CLIENT_SECRET="YOUR_GOOGLE_CLIENT_SECRET"
supabase secrets set TOKEN_ENCRYPTION_KEY="OUTPUT_OF_OPENSSL"
supabase secrets set APP_ORIGIN="https://your-domain.example"
```

`APP_ORIGIN` باید origin دقیق سایت باشد؛ بدون مسیر انتهایی. برای نمونه `https://notes.example.com`. در توسعه محلی می‌توانی `http://localhost:5500` بگذاری.

تابع را Deploy کن:

```bash
supabase functions deploy drive-sync --no-verify-jwt
```

فایل `supabase/config.toml` نیز `verify_jwt = false` را تعیین می‌کند؛ تابع خودش JWT کاربر را در تمام درخواست‌های POST بررسی می‌کند و callback گوگل با state یک‌بارمصرف و زمان‌دار محافظت می‌شود.

## گام ۵ — انتشار PWA

1. کل محتویات پوشه `writer` را روی هاست HTTPS خود منتشر کن.
2. فایل `config.js` باید با مقادیر واقعی Supabase تکمیل شده باشد.
3. مطمئن شو `index.html`، `cloud.js`، `config.js`، `manifest.json`، `sw.js` و `icon.svg` همگی در یک مسیر هستند.
4. صفحه را با HTTPS باز کن؛ اجرای مستقیم `index.html` با `file://` برای OAuth و ES Modules مناسب نیست.

## گام ۶ — آزمون پیشنهادی

1. ابتدا از نوشته‌های فعلی یک خروجی/نسخه پشتیبان دستی نگه دار.
2. برنامه را باز کن و «ورود با گوگل» را بزن.
3. پس از ورود، «اتصال Google Drive» را بزن و دسترسی را تأیید کن.
4. یک نوشته جدید بساز و چند ثانیه صبر کن؛ وضعیت همگام‌سازی باید کامل شود.
5. در Drive کاربر، پوشه `نویسه` و فایل `nawisa-backup.json` را بررسی کن.
6. همان حساب را در مرورگر یا دستگاه دوم باز کن؛ ورود و اتصال Drive را انجام بده. نوشته‌ها و پوشه‌ها باید بازیابی شوند.
7. یک نوشته را در دستگاه دوم ویرایش کن؛ پس از همگام‌سازی، تغییر باید در دستگاه اول نیز پس از بازکردن/همگام‌سازی مجدد ظاهر شود.
8. یک نوشته را حذف کن و بررسی کن که پس از همگام‌سازی دوباره ظاهر نشود.
9. با قطع اینترنت یک تغییر انجام بده، سپس اینترنت را وصل کن و برنامه را باز/فعال کن تا صف همگام‌سازی ارسال شود.

## محدودیت‌ها و نکات مهم

- PWA در مرورگر نمی‌تواند هنگام بسته‌بودن کامل برنامه، اجرای پس‌زمینه دائمی را تضمین کند. همگام‌سازی در زمان استفاده، بازشدن مجدد برنامه و برگشت اینترنت انجام می‌شود.
- برای حفظ نسخه‌های مختلف، بکاپ فعلی یک فایل JSON است؛ این نسخه‌بندی تاریخچه‌ای مستقل برای هر نوشته ایجاد نمی‌کند.
- الگوریتم ادغام بر اساس شناسه و زمان تغییر است. در ویرایش هم‌زمان دقیق یک نوشته در دو دستگاه، نسخه با timestamp جدیدتر برنده می‌شود؛ برای کار گروهی هم‌زمان، سامانه تعارض پیشرفته‌تری لازم است.
- فایل‌های محلی فعلی از LocalStorage خوانده می‌شوند و در اولین اتصال با بکاپ Drive ادغام می‌شوند. پیش از اولین اتصال، از داده‌ها نسخه پشتیبان نگه دار.
- اگر پروژه Google در حالت Testing باشد، فقط Test users می‌توانند اتصال را آزمایش کنند. انتشار عمومی ممکن است نیازمند تأیید گوگل باشد.
- توکن‌ها در جدول `drive_tokens` رمزنگاری‌شده‌اند و دسترسی مستقیم anon/authenticated به این جدول بسته است. کلید رمزنگاری را گم نکن؛ در صورت تعویض کلید، توکن‌های قبلی قابل رمزگشایی نخواهند بود.

## فایل‌های اضافه‌شده

- `cloud.js` — رابط ورود و همگام‌سازی در مرورگر.
- `config.js` — تنظیمات عمومی Supabase (باید تکمیل شود).
- `supabase/schema.sql` — جداول امن OAuth.
- `supabase/functions/drive-sync/index.ts` — OAuth، نگهداری توکن و همگام‌سازی Drive.
- `supabase/config.toml` — تنظیمات Edge Function.
