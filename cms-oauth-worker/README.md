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

## בדיקת חיבור ל-SmartBee

ה-Worker כולל נקודת בדיקה מוגנת:

`POST /smartbee/connection-test`

הבדיקה מתחברת אך ורק ל-API של סביבת הטסט, מאמתת את לקוח ה-API ומבצעת
חיפוש מסמכים לקריאה בלבד כדי לוודא את ה-`providerUserToken`. היא מחזירה
רק סטטוס ותאריך תפוגת התחברות. היא אינה יוצרת מסמך ואינה מבצעת חיוב.

את הערכים הסודיים יש להזין ישירות כ-Cloudflare Worker Secrets, ולא לשמור
בקוד או ב-Git:

```powershell
npx wrangler secret put SMARTBEE_TEST_CLIENT_ID
npx wrangler secret put SMARTBEE_TEST_PASSWORD
npx wrangler secret put SMARTBEE_PROVIDER_USER_TOKEN
npx wrangler secret put SMARTBEE_TEST_ACCESS_KEY
```

`SMARTBEE_TEST_ACCESS_KEY` הוא מפתח פנימי חדש שיש ליצור במיוחד לבדיקות.
הוא אינו אחד מהפרטים שהתקבלו מ-SmartBee.

לאחר פריסה, מריצים את הבדיקה עם כותרת
`X-Disegni-Test-Key`. אסור להוסיף את המפתח לעמוד ציבורי או ל-JavaScript
של האתר.

## חיבור תשלום Grow דרך Make

נקודת הקצה `POST /payments/grow/create` מאמתת את המוצר והמחיר בצד השרת,
מעבירה את ההזמנה לוובהוק המוגן של Make ומחזירה לאתר רק קישור תשלום תקין.

את פרטי Make שומרים כסודות בקלאודפלייר:

```powershell
npx wrangler secret put MAKE_CHECKOUT_WEBHOOK_URL
npx wrangler secret put MAKE_CHECKOUT_API_KEY
```

בשלב הבדיקה מאושרות 11 הווריאציות של Orin: פוסטר, פוסטר ממוסגר וקנבס.
המחירים והמשלוח לפי קטגוריה וכמות מחושבים ב-Worker ואינם מתקבלים
מהדפדפן. בהזמנה שמשלבת קטגוריות, עלות המשלוח הראשונה מחושבת לכל
קטגוריה בנפרד.
