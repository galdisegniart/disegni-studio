# disegni-studio

אתר סטטי (Eleventy / 11ty) עבור disegni.studio, עם ניהול תוכן דרך Decap CMS.

## מבנה

- `src/` — קוד המקור: תבניות (`.njk`), קבצי תוכן (`src/content/**/*.json`), נתוני אתר (`src/_data/`)
- `css/`, `js/`, `images/` — סטטיים, לא נבנים, נשארים כמו שהם
- `admin/` — ממשק Decap CMS (`admin/index.html` + `admin/config.yml`)
- `index.html`, `artwork/`, `shop/`, `commissions/`, `workshops/`, `about/`, `rights/` — **תוצרי בנייה**, נכתבים אוטומטית ע"י 11ty. לא לערוך ידנית — כל שינוי ידני יימחק בבנייה הבאה.
- `reference/` — גיבויי SingleFile של האתר הישן (רפרנס בלבד, לא ב-git)

## פיתוח מקומי

```
npm install
npm run watch    # שרת פיתוח על http://localhost:8080, בונה מחדש אוטומטית בכל שינוי
npm run cms      # שרת Decap מקומי (בטאב נפרד), מאפשר לבדוק את admin/ בלי GitHub
npm run build    # בנייה חד-פעמית (כותבת לתוך index.html, artwork/, וכו')
```

## עריכת תוכן

כל הטקסטים, המחירים והתמונות שניתנים לעריכה נמצאים ב-`src/content/`:
- `src/content/artworks/*.json` — כל יצירה בקובץ נפרד
- `src/content/workshops/*.json` — כל סדנה בקובץ נפרד
- `src/content/pages/*.json` — אודות / יצירות בהזמנה / זכויות

עריכה ידנית של הקבצים האלה עובדת (JSON רגיל), אבל הדרך הנוחה היא דרך `/admin/`
(Decap CMS) אחרי חיבור ל-GitHub.

## פרסום

git push ל-GitHub → GitHub Action בונה את האתר (`npm run build`) ומקומיטת את
הפלט בחזרה ל-`main` → cPanel Git Version Control מושך אוטומטית ל-Ultahost.
