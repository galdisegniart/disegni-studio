# disegni-cms-oauth

שרת עזר קטן (Cloudflare Worker) שמאפשר ל-Decap CMS (ב-`/admin/`) להתחבר בבטחה
ל-GitHub. הוא לא חלק מהאתר עצמו — רץ בנפרד, בחינם, ב-Cloudflare.

## הקמה (פעם אחת)

1. **צור חשבון Cloudflare** (חינם) ב-dash.cloudflare.com, אם עוד אין לך.

2. **צור GitHub OAuth App:**
   - היכנס ל-github.com/settings/developers → "New OAuth App"
   - Application name: `Disegni Studio CMS`
   - Homepage URL: `https://disegni.studio`
   - Authorization callback URL: `https://disegni-cms-oauth.<your-subdomain>.workers.dev/callback`
     (את ה-`<your-subdomain>` תדע רק אחרי הפריסה הראשונה בשלב הבא - אפשר לפרוס קודם עם כתובת זמנית ולעדכן כאן אחר כך)
   - שמור את ה-**Client ID** ואת ה-**Client Secret** שנוצרים

3. **התקן והתחבר ל-Cloudflare:**
   ```
   cd cms-oauth-worker
   npx wrangler login
   ```
   (ייפתח דפדפן להתחברות ל-Cloudflare)

4. **הגדר את הסודות** (לא נשמרים ב-git):
   ```
   npx wrangler secret put GITHUB_CLIENT_ID
   npx wrangler secret put GITHUB_CLIENT_SECRET
   ```

5. **פרוס:**
   ```
   npx wrangler deploy
   ```
   הפקודה תדפיס את הכתובת הסופית, לדוגמה:
   `https://disegni-cms-oauth.YOUR-ACCOUNT.workers.dev`

6. אם הכתובת שונה מזו שהזנת בשלב 2 — עדכן את ה-Authorization callback URL
   ב-GitHub OAuth App בהתאם.

7. עדכן את `admin/config.yml` בשורש הפרויקט: הוסף שורת `base_url` עם הכתובת
   מה-worker (בלי `/callback` בסוף).
