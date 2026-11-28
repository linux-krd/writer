# نویسە — وەشانی پشتگیریکەری چوونەژوورەوە بە<p align="center">
<p align="center">
  <img src="logo.png" alt="کورد لینوکس (قەزوان)" width="320">
</p>

</p> Google و هاوکاتکردنی Google Drive

ئەم وەشانە ڕووکار و تایبەتمەندییە سەرەکییەکانی بەرنامەی **نویسە** دەپارێزێت و چینێکی هەڵبژاردەیی هەور (Cloud)ی بۆ زیاد دەکات. تا ئەو کاتەی ڕێکخستنەکانی Supabase ئەنجام نەدرابن، بەرنامەکە وەک وەشانی پێشووتر بە شێوەی ناوخۆیی کار دەکات.

## تایبەتمەندییە نوێ زیادکراوەکان

- چوونەژوورەوە و دەرچوون بەهۆی Googleەوە، لە ڕێگەی Supabase Auth.
- پەیوەستکردنی سەربەخۆی Google Drive بە OAuth و مۆڵەتی سنوورداری `drive.file`.
- پاشەکەوتکردنی وەشانی پشتیوانی JSON بە ناوی `nawisa-backup.json` لەناو بوخچەی `نویسە` لە Driveی هەر بەکارهێنەرێک.
- هاوکاتکردنی دوولایەنەی نووسینەکان و بوخچەکان، لە ڕێگەی یەکخستنیان بە پێی ناسێنەر (ID) و دوا کاتی دەستکاریکردن.
- هەڵگرتنی نیشانەی سڕینەوە، بۆ ئەوەی نووسین یان بوخچەی سڕدراوە لە کاتی هاوکاتکردنەوەدا دووبارە نەگەڕێتەوە.
- هەوڵدان بۆ هاوکاتکردنەوە دوای گۆڕانکارییەکان، گەڕانەوەی ئینتەرنێت و کردنەوەیەکی نوێی بەرنامەکە.
- هەڵگرتنی Refresh Token بە شێوەیەکی کۆدکراو، تەنها لە لایەنی سێرڤەری Supabase.

**تێبینی دەربارەی پێکهاتەی Drive:** بۆ ڕێگرتن لە دروستبوونی ژمارەیەکی زۆر فایل بە شێوەی پەرتەوازە و ئاسانکردنی هاوکاتکردنی دوولایەنە، نووسینەکان و بوخچەکان لەناو یەک فایلی پشتیوانی JSONدا هەڵدەگیرێن. پێکهاتەی بوخچەکان و نووسینەکان لە کاتی گەڕاندنەوەدا لەناو خودی بەرنامەکە دروستەوە دروست دەکرێن؛ هەر نووسینێک وەک فایلێکی جیاواز لە Drive دروست ناکرێت.

## پێداویستییەکان

- پڕۆژەیەکی Supabase.
- پڕۆژەیەکی Google Cloud لەگەڵ OAuth Client لە جۆری Web application.
- میوانداری PWA لەسەر HTTPS (بۆ پەرەپێدان دەتوانرێت localhost بەکاربهێنرێت).
- Supabase CLI بۆ Deployکردنی Edge Function.

## هەنگاوی ١ — ڕێکخستنی Supabase

1. لە [https://supabase.com](https://supabase.com) پڕۆژەیەک دروست بکە.
2. لە SQL Editorدا فایلەکەی `supabase/schema.sql` جێبەجێ بکە.
3. لە Project Settings → API ئەم دوو زانیارییە وەربگرە:
   - Project URL
   - Publishable key (یان anon/public keyی کۆنتر).

4. ئەم نرخانە لە `config.js`دا دابنێ:

```javascript
export const SUPABASE_URL = 'https://YOUR_PROJECT_REF.supabase.co';
export const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY';
```

کلیلی Publishable/anon بۆ بەکارهێنان لە وێبگەڕدا دروست کراوە؛ **هەرگیز کلیلی service role لە `config.js`دا دانەنێ.**

## هەنگاوی ٢ — ڕێکخستنی Google Cloud و چوونەژوورەوەی Google لە Supabase

1. لە [https://console.cloud.google.com](https://console.cloud.google.com) پڕۆژەیەک دروست بکە.
2. لە Google Auth Platform، پەڕەی ڕەزامەندی OAuth تەواو بکە.
3. بۆ چوونەژوورەوەی Supabase، بچۆ بۆ Supabase → Authentication → Sign In / Providers → Google و Provider چالاک بکە.
4. لە Google Cloud، OAuth Clientێک لە جۆری Web application دروست بکە.
5. لە بەشی Authorized redirect URIs، ناونیشانی Callback زیاد بکە کە Supabase لە پەڕەی ڕێکخستنی Google Provider پیشانی دەدات. ناونیشانەکە بە تەواوی لە Supabase کۆپی بکە.
6. Client ID و Client Secret لە ڕێکخستنی Google Provider لە Supabase دابنێ و پاشەکەوتیان بکە.
7. لە Supabase → Authentication → URL Configuration، ناونیشانی سەرەکی PWA زیاد بکە بۆ Site URL و Redirect URLs؛ بۆ نموونە:

```text
https://your-domain.example/**
```

## هەنگاوی ٣ — چالاککردنی Google Drive API و OAuth Callback

1. لە Google Cloud → APIs & Services → Library، Google Drive API چالاک بکە.
2. هەمان OAuth Client بکەرەوە و ئەم ناونیشانەش لە Authorized redirect URIs زیاد بکە:

```text
https://YOUR_PROJECT_REF.supabase.co/functions/v1/drive-sync?action=callback
```

3. لە Google Auth Platform، ئەم Scopeە زیاد بکە یان داوای مۆڵەتی بکە:

```text
https://www.googleapis.com/auth/drive.file
```

4. لە کاتی پەرەپێداندا، ئیمەیڵی بەکارهێنەرانی تاقیکردنەوە لە بەشی Test users زیاد بکە. پێش بڵاوکردنەوەی گشتی، دڵنیابە لەوەی پەڕەی OAuth consent screen و داواکارییەکانی Verification بە پێی ڕێنمایی Google تەواو کراون.

چوونەژوورەوە بۆ بەرنامە و پەیوەستکردنی Drive دوو مۆڵەتی جیاوازن: سەرەتا بەکارهێنەر بە Google دەچێتە ژوورەوەی بەرنامەکە، پاشان بە دوگمەی «پەیوەستکردنی Google Drive» مۆڵەتی بەکارهێنانی Drive بە جیا دەدات.

## هەنگاوی ٤ — ڕێکخستنی Edge Function و Secrets

لە ڕەگی بوخچەی پڕۆژە (ئەو شوێنەی بوخچەی `supabase`ی تێدایە)، Supabase CLI دابمەزرێنە/ڕێکی بخە و پڕۆژەکەی پێوە ببەستە. پاشان کلیلی کۆدکردنی ٣٢ بایتی دروست بکە:

```bash
openssl rand -base64 32
```

ئەم نرخانە وەک Secrets تۆمار بکە (هیچ کام لەمانە لە فایلەکانی frontend دانەنێ):

```bash
supabase secrets set GOOGLE_CLIENT_ID="YOUR_GOOGLE_CLIENT_ID"
supabase secrets set GOOGLE_CLIENT_SECRET="YOUR_GOOGLE_CLIENT_SECRET"
supabase secrets set TOKEN_ENCRYPTION_KEY="OUTPUT_OF_OPENSSL"
supabase secrets set APP_ORIGIN="https://your-domain.example"
```

`APP_ORIGIN` دەبێت originی وردی ماڵپەڕەکەت بێت، بەبێ هیچ ڕێڕەوێکی زیادە لە کۆتاییدا. بۆ نموونە:

```text
https://notes.example.com
```

لە کاتی پەرەپێدانی ناوخۆییدا دەتوانیت ئەمە بەکاربهێنیت:

```text
http://localhost:5500
```

ئێستا Functionەکە Deploy بکە:

```bash
supabase functions deploy drive-sync --no-verify-jwt
```

فایلی `supabase/config.toml`یش `verify_jwt = false` دیاری دەکات؛ خودی Functionەکە لە هەموو داواکارییەکانی POSTدا JWTی بەکارهێنەر پشکنین دەکات و OAuth Callbackی Googleیش بە stateێکی یەکجارە و کاتی سنووردار پارێزراوە.

## هەنگاوی ٥ — بڵاوکردنەوەی PWA

1. هەموو ناوەڕۆکی بوخچەی `writer` لەسەر هاستە HTTPSەکەت بڵاو بکەرەوە.
2. دڵنیابە لەوەی فایلەکەی `config.js` بە زانیارییە ڕاستەقینەکانی Supabase پڕ کراوەتەوە.
3. دڵنیابە لەوەی ئەم فایلانە هەموویان لە هەمان ڕێڕەودان:

   - `index.html`
   - `cloud.js`
   - `config.js`
   - `manifest.json`
   - `sw.js`
   - `icon.svg`

4. پەڕەکە بە HTTPS بکەرەوە؛ کردنەوەی ڕاستەوخۆی `index.html` بە `file://` بۆ OAuth و ES Modules گونجاو نییە.

## هەنگاوی ٦ — تاقیکردنەوەی پێشنیارکراو

1. سەرەتا لە نووسینەکانی ئێستات دەرخستن/وەشانێکی پشتیوانی بە شێوەی دەستی هەڵبگرە.
2. بەرنامەکە بکەرەوە و دوگمەی «چوونەژوورەوە بە Google» دابگرە.
3. دوای چوونەژوورەوە، دوگمەی «پەیوەستکردنی Google Drive» دابگرە و مۆڵەتەکە پشتڕاست بکەرەوە.
4. نووسینێکی نوێ دروست بکە و چەند چرکەیەک چاوەڕێ بکە؛ دۆخی هاوکاتکردنەوە دەبێت تەواو ببێت.
5. لە Driveی بەکارهێنەرەکەدا، بوخچەی `نویسە` و فایلی `nawisa-backup.json` بپشکنە.
6. هەمان هەژمار لە وێبگەڕ یان ئامێرێکی دووەم بکەرەوە؛ چوونەژوورەوە و پەیوەستکردنی Drive ئەنجام بدە. نووسینەکان و بوخچەکان دەبێت بگەڕێنرێنەوە.
7. نووسینێک لە ئامێری دووەم دەستکاری بکە؛ دوای هاوکاتکردنەوە، گۆڕانکارییەکە دەبێت لە ئامێری یەکەمیشدا، دوای کردنەوە یان هاوکاتکردنەوەی دووبارە، دەربکەوێت.
8. نووسینێک بسڕەوە و بپشکنە کە دوای هاوکاتکردنەوە دووبارە نەگەڕێتەوە.
9. ئینتەرنێت ببڕە و گۆڕانکارییەک ئەنجام بدە؛ پاشان ئینتەرنێت پەیوەست بکەرەوە و بەرنامەکە بکەرەوە یان چالاکی بکە تا نۆرەی هاوکاتکردنەوە بنێردرێت.

## سنووردارییەکان و تێبینییە گرنگەکان

- PWA لە وێبگەڕدا ناتوانێت لە کاتی داخستنی تەواوی بەرنامەکە، کارکردنی بەردەوامی پاشبنەما (Background) دڵنیایی پێ بدات. هاوکاتکردنەوە لە کاتی بەکارهێنان، کردنەوەی دووبارەی بەرنامە و گەڕانەوەی ئینتەرنێتدا ئەنجام دەدرێت.
- بۆ پاراستنی وەشانە جیاوازەکان، پشتیوانیی ئێستا بە شێوەی یەک فایلی JSONە؛ مێژووی سەربەخۆی وەشانەکان بۆ هەر نووسینێک دروست ناکات.
- ئەلگۆریتمی یەکخستن پشت بە ناسێنەر (ID) و کاتی گۆڕانکاری دەبەستێت. لە کاتی دەستکاریکردنی هاوکاتی وردی نووسینێک لە دوو ئامێردا، ئەو وەشانەی timestampی نوێتری هەیە سەرکەوتوو دەبێت؛ بۆ کاری هاوبەشی هاوکات، پێویست بە سیستەمێکی پێشکەوتووتری چارەسەرکردنی ناکۆکییەکان هەیە.
- فایلە ناوخۆییەکانی ئێستا لە LocalStorage دەخوێندرێنەوە و لە یەکەم پەیوەستکردندا لەگەڵ پشتیوانیی Drive یەکدەخرێن. پێش یەکەم پەیوەستکردن، وەشانێکی پشتیوانی لە داتاکانت هەڵبگرە.
- ئەگەر پڕۆژەی Google لە دۆخی Testingدا بێت، تەنها Test users دەتوانن پەیوەستکردن تاقی بکەنەوە. بڵاوکردنەوەی گشتی لەوانەیە پێویستی بە پەسەندکردنی Google هەبێت.
- Tokenەکان بە شێوەی کۆدکراو لە خشتەی `drive_tokens`دا هەڵدەگیرێن و دەستگەیشتنی ڕاستەوخۆی anon/authenticated بۆ ئەم خشتەیە داخراوە. کلیلی کۆدکردن لەدەست مەدە؛ ئەگەر کلیلی نوێ دابنێیت، Tokenە کۆنەکان چیتر ناکرێت کۆدیان بکرێتەوە.

## فایلە زیادکراوەکان

- `cloud.js` — ڕووکاری چوونەژوورەوە و هاوکاتکردنەوە لە وێبگەڕدا.
- `config.js` — ڕێکخستنە گشتییەکانی Supabase (پێویستە تەواو بکرێت).
- `supabase/schema.sql` — خشتەکانی پارێزراوی OAuth.
- `supabase/functions/drive-sync/index.ts` — OAuth، هەڵگرتنی Token و هاوکاتکردنی Drive.
- `supabase/config.toml` — ڕێکخستنەکانی Edge Function.
