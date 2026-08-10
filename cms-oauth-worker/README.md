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

## SmartBee — סביבת production

`POST /smartbee/create-receipt-live` הוא נקודת הקצה שה-scenario "Integration
Grow" ב-Make קורא לה בפועל אחרי אישור תשלום אמיתי מ-Grow. היא נפרדת
לחלוטין מהטסט (endpoint שונה, סודות שונים), כדי שלא יהיה סיכוי שסביבת
הבדיקה תיצור בטעות מסמך אמיתי, או ההפך.

יש להזין את פרטי ה-production שהתקבלו מ-SmartBee. שימו לב:
`SMARTBEE_LIVE_PROVIDER_USER_TOKEN` הוא סוד **נפרד** מ-`SMARTBEE_PROVIDER_USER_TOKEN`
של הטסט - לא לבלבל ביניהם, אחרת סביבת הטסט תישבר:

```powershell
npx wrangler secret put SMARTBEE_CLIENT_ID
npx wrangler secret put SMARTBEE_PASSWORD
npx wrangler secret put SMARTBEE_LIVE_PROVIDER_USER_TOKEN
```

`SMARTBEE_API_BASE` (כתובת ה-API האמיתית, בלי "test") כבר מוגדרת
כ-`[vars]` רגיל ב-`wrangler.toml`, לא כסוד.

`SMARTBEE_LIVE_KEY` הוא סוד נוסף, פנימי, שנוצר כדי לוודא שרק ה-scenario
ב-Make (עם header בשם `X-SmartBee-Live-Key`) יכול לקרוא לנקודת הקצה
הזו — אין להשתמש בו בשום מקום אחר.

### קבלות עבור תשלומי Bit

תהליך Bit נפרד לחלוטין מתהליך Grow ומשתמש בנקודות הקצה הבאות:

- `POST /smartbee/create-bit-receipt-live`
- `GET /smartbee/receipt-status-live?requestId=...`

שתי נקודות הקצה דורשות Bearer token שנשמר רק כסוד Cloudflare Worker בשם
`MAKE_BIT_RECEIPTS_SECRET`, ולא בקוד או ב-Git:

```powershell
npx wrangler secret put MAKE_BIT_RECEIPTS_SECRET
```

במודול HTTP של Make יש להוסיף Authorization Header כך:

```text
Authorization: Bearer <MAKE_BIT_RECEIPTS_SECRET>
```

בקשת היצירה כוללת את השדות: `requestId`, `customerName`, `phone`, `email`,
`amount`, `paymentDate`, `description` ו-`bitReference`. כל השדות נדרשים.
ה-Worker שולח ל-SmartBee קבלה עם `receiptDetails.otherItems`, תיאור אמצעי
התשלום `Bit`, מע״מ `Free`, ו-`sendOriginalToCustomer: false` כל עוד התהליך
נמצא בבדיקות.

מניעת כפילות נשמרת ב-`ORDERS_KV` בשני מפתחות נפרדים: מזהה הבקשה ואסמכתת
Bit. `requestId` משמש גם כ-`providerMsgId` יציב מול SmartBee. בקשה חוזרת
במצב `processing` או `issued` מחזירה את התוצאה הקיימת ואינה יוצרת מסמך נוסף.

תגובה מוצלחת מחזירה `status` מסוג `processing` או `issued`. לאחר שהמסמך
מוכן, תגובת הסטטוס יכולה לכלול `documentId`, `linkToOriginal` ו-`linkToCopy`.
אין לחשוף את `MAKE_BIT_RECEIPTS_SECRET` בדפדפן ציבורי; הוא מיועד לתרחיש Make מאובטח בלבד.

### אישור ידני של קבלות Bit (שכבת ביקורת לפני SmartBee)

לפני שבקשת Bit מגיעה בפועל ל-SmartBee, היא עוברת שלב ביקורת ידני על ידי
גל בעמוד `/admin-bit-receipts/` (`noindex`, דורש `X-Disegni-Admin-Key`):

- `POST /admin/bit-receipts/intake` - נקודת קצה חדשה שתרחיש ה-Make (שעדיין
  כבוי, מזהה `6837739`) יצטרך לקרוא לה **במקום** לקרוא ישירות ל-
  `create-bit-receipt-live`. שומרת את הבקשה בסטטוס `pending` בלבד - **לא**
  פונה ל-SmartBee. דורשת Bearer token נפרד:
  ```powershell
  npx wrangler secret put BIT_RECEIPT_INTAKE_SECRET
  ```
  מונעת כפילות באותו אופן בדיוק כמו `create-bit-receipt-live` (לפי
  `requestId` ו-`bitReference`), כי היא כותבת לאותם מפתחות KV בדיוק.
- `GET /admin/bit-receipts` - רשימת הבקשות הממתינות לעמוד האדמין.
- `POST /admin/bit-receipts/approve` - רק כאן נוצרת קבלה אמיתית. מקבל
  שדות מתוקנים (אם גל ערך משהו בעמוד), ואז קורא **פנימית** (באותו
  Worker, בלי קריאת רשת חיצונית) לאותה `handleSmartBeeCreateBitReceiptLive`
  שכבר קיימת - אין שום לוגיקת SmartBee כפולה. הבקשה עוברת מ-`pending`
  ל-`processing`/`issued`/`failed` בדיוק כמו זרימת ה-Make הרגילה.
- `POST /admin/bit-receipts/reject` - מסמן `rejected` בלי לגעת ב-SmartBee
  בכלל.

כל שלוש נקודות הקצה של האדמין (מלבד `intake`) דורשות `X-Disegni-Admin-Key` -
אותו סוד שכבר משמש לביטול הזמנות ולקופונים.

### זיהוי אוטומטי מצילום מסך (עזר למילוי הטופס בלבד)

`POST /bit-receipts/extract` מקבל תמונה כ-`data:` URL בבסיס 64, שולח אותה
ל-Gemini (`gemini-flash-latest`) ומחזיר ניחוש לשדות הטופס
(`customerName`, `phone`, `email`, `amount`, `paymentDate`, `description`,
`bitReference`). **לא כותב שום דבר ל-KV ולא פונה ל-SmartBee** - זו רק הצעת
מילוי; השמירה בפועל עדיין קורית כרגיל דרך `/bit-receipts/submit` כשהטופס
(הניתן לעריכה תמיד) נשלח. מוגבל ל-5MB לתמונה ול-8 בקשות לחלון rate-limit
לפי IP. דורש סוד נפרד:

```powershell
npx wrangler secret put GEMINI_API_KEY
```

יוצרים מפתח חינמי ב-aistudio.google.com (Google AI Studio) - "Get API key",
ללא צורך בכרטיס אשראי בתוכנית החינמית. מומלץ ליצור מפתח ייעודי לפרויקט
הזה, כדי שיהיה קל לעקוב אחרי השימוש ולנתק אותו בנפרד אם צריך.

## חיבור תשלום Grow דרך Make

נקודת הקצה `POST /payments/grow/create` מאמתת את המוצר והמחיר בצד השרת,
מעבירה את ההזמנה לוובהוק המוגן של Make ומחזירה לאתר רק קישור תשלום תקין.

את פרטי Make שומרים כסודות בקלאודפלייר:

```powershell
npx wrangler secret put MAKE_CHECKOUT_WEBHOOK_URL
npx wrangler secret put MAKE_CHECKOUT_API_KEY
```

המחירים והמשלוח לפי קטגוריה וכמות מחושבים ב-Worker ואינם מתקבלים
מהדפדפן. בהזמנה שמשלבת קטגוריות, עלות המשלוח הראשונה מחושבת לכל
קטגוריה בנפרד.

**הקטלוג אינו קשיח לאמן/יצירה אחת.** הוורקר שולף בכל בקשה (עם קאש
של 5 דקות ב-KV) את `https://disegni.studio/purchase-catalog.json` —
קובץ שנוצר אוטומטית בכל build מתוך `src/_data/purchaseCatalog.js`,
וכולל כל יצירה שיש לה שדה `purchaseVariants` מאושר ב-CMS ותואמת
מוצר ב-Printful. כדי לפתוח יצירה נוספת לתשלום, אין צורך בשינוי קוד -
רק למלא `purchaseVariants` עבורה ב-CMS ולבנות מחדש.

## סטטוס הזמנה, מניעת כפילויות וסגירת מסלול הטסט

מסלול התשלום שומר מצב הזמנה אמיתי (KV), כדי שניתן יהיה לדעת בוודאות
מה קרה להזמנה, למנוע יצירת שתי הזמנות מאותה לחיצה כפולה/רענון, ולמנוע
הפקת מסמך כפול. חובה להריץ פעם אחת:

```powershell
cd cms-oauth-worker
npx wrangler kv namespace create ORDERS_KV
```

הפקודה תדפיס `id` — יש להעתיק אותו לתוך `wrangler.toml`, בשורה
`id = "REPLACE_WITH_KV_NAMESPACE_ID"`, במקום הטקסט הזה.

**מסלול הטסט (Sandbox) סגור כברירת מחדל.** בעבר הוא היה נגיש לכל אחד
דרך פרמטר URL ציבורי (`?payment-test=orin`) — זה הוסר. עכשיו כפתור
התשלום מוצג רק אם הדגל הבא מוגדר לערך `true` ישירות ב-Cloudflare:

```powershell
npx wrangler secret put GROW_TEST_ENABLED
```

כדי לכבות את מסלול הטסט, פשוט משנים את הערך ל-`false` (או מוחקים את
הסוד) ופורסים מחדש. אין שום דרך להפעיל את זה מהדפדפן או מכתובת URL.

**אישור תשלום מ-Make:** לאחר ש-Make מריץ `Approve Transaction` מול
Grow, הוא צריך לשלוח בקשה חזרה לוורקר כדי לעדכן את סטטוס ההזמנה
בפועל ל-`paid` (או `failed`/`cancelled`/`refunded`):

```
POST /payments/grow/confirm
Header: X-Grow-Confirm-Secret: <הסוד>
Body: { "orderId": "GD-...", "status": "paid", "providerRef": "..." }
```

ההגדרה הנדרשת:

```powershell
npx wrangler secret put GROW_CONFIRM_SECRET
```

יש להזין את אותו ערך גם בהגדרת ה-HTTP request/webhook היוצא ב-Make
(בכותרת `X-Grow-Confirm-Secret`), כדי שהוורקר יידע שהקריאה באמת הגיעה
מ-Make ולא מגורם אחר. הבקשה **אידמפוטנטית**: אישור כפול לאותה הזמנה
לא ישנה שום דבר בפעם השנייה.

עמוד "תודה על הרכישה" קורא בעצמו ל-`GET /orders/status?orderId=...`
ומציג "שולם בהצלחה" רק אם הסטטוס בפועל הוא `paid` — לא סתם כי הגולש
הגיע לעמוד.

## ביטול הזמנה + החזר כספי (אדמין)

`POST /admin/orders/cancel` מיועד לשימוש עצמי בלבד — עמוד אדמין פנימי
(`/admin-cancel-order/`, `noindex`) שולח לשם `{ orderId }` עם הכותרת
`X-Disegni-Admin-Key`. הוורקר בודק שההזמנה קיימת, שהסטטוס שלה `paid`,
ושיש לה `providerRef`+`transactionToken` שמורים — ואז שולח וובהוק
ל-Make שמריץ `refundTransaction` מול Grow בפועל ומדווח בחזרה על
הסטטוס `refunded` דרך אותו `/payments/grow/confirm` הקיים. הוורקר
עצמו **לא** משנה את הסטטוס - רק Make, אחרי שההחזר בפועל הצליח.

**חשוב:** תיקון הקבלה ב-SmartBee (זיכוי/ביטול מסמך) לא מתבצע אוטומטית
בשלב זה - עדיין נדרש טיפול ידני מול SmartBee לכל ביטול.

```powershell
npx wrangler secret put DISEGNI_ADMIN_KEY
npx wrangler secret put ADMIN_CANCEL_ORDER_WEBHOOK_URL
```

`ADMIN_CANCEL_ORDER_WEBHOOK_URL` הוא כתובת ה-webhook של תרחיש ה-Make
"Admin - Cancel Order" (נוצר, אך **לא מופעל** כרגע — חשבון ה-Make
מוגבל לשני תרחישים פעילים בו-זמנית, ושניהם תפוסים ע"י צינור התשלום
החי. יש להפעיל את התרחיש ידנית ב-Make לפני שימוש ראשון בכפתור הביטול,
ולכבות אותו כשסיימתם - או לשדרג את תוכנית ה-Make לתמוך ביותר
תרחישים פעילים).

## קופונים והנחות

עמוד אדמין פנימי `/admin-coupons/` (`noindex`, דורש הזנת `X-Disegni-Admin-Key`
בכל פעם - אין שמירת הססמה בדפדפן) מאפשר ליצור/למחוק קודי הנחה. כל
קופון נותן **אחוז הנחה קבוע בלבד** (1-90%), עם הגבלת שימושים כוללת
אופציונלית, ותמיד **פעם אחת בלבד לכל מספר טלפון**.

נקודות קצה:

- `GET /admin/coupons/list`, `POST /admin/coupons/create`,
  `POST /admin/coupons/delete` - כולן דורשות `X-Disegni-Admin-Key`
  (אותו סוד כמו ביטול הזמנה).
- `POST /payments/coupons/check` - ציבורי, לתצוגה מקדימה בעגלה בלבד
  ("קוד הופעל: 10% הנחה"). לא מסמן שום שימוש בפועל.
- `POST /payments/grow/create` מקבל `couponCode` אופציונלי ומאמת אותו
  מחדש בעצמו (לא סומך על מה שהעגלה הראתה ללקוח) - כולל בדיקת "כבר
  נעשה שימוש" לפי מספר הטלפון.

**חשוב לגבי הסכום שבאמת מחויב:** ל-Grow אין שדה "total" נפרד - הוא
מחשב את הסכום לחיוב מ-`unitPrice × quantity` (בתוספת שורת המשלוח
הנפרדת) בלבד. לכן ההנחה נאפית ישירות לתוך `unitPrice` שנשלח ל-Make,
לא רק נרשמת בסטטוס ההזמנה שלנו - אחרת הלקוח היה משלם מחיר מלא בפועל
למרות שהוא רואה הנחה במסך.

שימוש בקופון **נרשם בפועל רק אחרי אישור תשלום** (`status: "paid"`
דרך `/payments/grow/confirm`) - כך שניסיון תשלום כושל/ננטש לא "שורף"
את השימוש החד-פעמי של הלקוח בקוד.
