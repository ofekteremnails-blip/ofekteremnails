# עדכון טעינת זמינות

## ארכיון תורים — הפעלה חד־פעמית

הקוד מוכן מקומית; כתיבת הקוד אינה מעבירה נתונים ואינה מתקינה תזמון בחשבון Google.

קובץ הארכיון: https://docs.google.com/spreadsheets/d/1fQu1XkOW4lPuJUh4CWdym3EmmmWNYEGtVR7n7EwGIxk/edit

1. בחשבון שמפעיל את פרויקט Apps Script הקיים, ודאי שיש הרשאת עריכה גם בקובץ הארכיון. ממשיכים באותו פרויקט שמשרת את האתר; אין ליצור פרויקט נוסף בגיליון הארכיון.
2. עדכני את הקוד בפרויקט לפי `apps-script.js`. שמרי את `SHEET_ID` הקיים; `ARCHIVE_SPREADSHEET_ID` כבר מכוון לקובץ החדש.
3. בעורך Apps Script, הריצי `setupAppointmentArchive`. אשרי את הרשאות Google הדרושות. הפעולה יוצרת בקובץ החדש לשונית בשם `ארכיון תורים`, עם כותרות ותצוגה מימין לשמאל. היא אינה מוחקת תורים ואינה מפעילה תזמון. לשוניות אחרות בקובץ אינן משתנות.
4. בדקי ב־Execution log את `eligible` (תורים מלפני היום), `skipped` (רשומות ללא מזהה או תאריך תקין) ו־`before` (היום לפי ישראל). אפשר להריץ `previewAppointmentArchive` לבדיקה נוספת ללא כתיבה.
5. פרסי גרסת Web app חדשה בפריסה הקיימת, ואז פרסי את `admin.html`, `admin-archive.js`, `sw.js` יחד עם יתר קבצי האתר. ודאי שבניהול > כל התורים > היסטוריית תורים מתקבלת תוצאה ריקה תקינה, ולא שגיאת חיבור.
6. הריצי בעורך `archivePastAppointments`. כל הרצה מעבירה עד 200 תורים. בדקי ש־`moved` תואם לשורות שנוספו לארכיון ולשורות שהוסרו מהיומן הפעיל. בדקי גם כמה רשומות עם תאריך, שעה, טלפון והערות. כש־`remaining` גדול מאפס, הריצי שוב עד השלמת ההעברה הראשונית. אין להריץ העברות מקבילות או לערוך ידנית את השורות במהלך העברה.
7. בדקי בניהול חיפוש שם, טלפון, חודש, דפדוף והיעדר תוצאות; בדקי שבקביעת תור הזמינות של היום והעתיד נשארת זהה.
8. רק לאחר הבדיקה הראשונית, הריצי `installAppointmentArchiveTrigger` פעם אחת. היא מתקינה העברה יומית בשעות 03:00–04:00 לפי ישראל; הרצה חוזרת אינה מוסיפה טריגר כפול. זהו חלון ביצוע, לא הבטחה ל־03:00 בדיוק: https://developers.google.com/apps-script/reference/script/clock-trigger-builder

### התנהגות ושמירת נתונים

- תורים עד אתמול מועברים, בכל סטטוס. היום והעתיד נשארים פעילים. התהליך משמר את הסטטוס ולא מסמן תור אוטומטית כהושלם.
- כל עשר העמודות ומזהה התור נשמרים. תאריכים ושעות מסוג Date נכתבים כטקסט מנורמל כדי שלא ישתנו בגלל אזור הזמן של קובץ הארכיון.
- המחיקה מתבצעת רק אחרי כתיבה, `flush`, קריאה חוזרת והשוואת כל הערכים. בהרצה שנקטעה, רשומה זהה שכבר הועתקה אינה נוצרת שוב. נתונים סותרים עם אותו מזהה, מבנה עמודות שונה או טקסט שמתחיל ב־`=` עוצרים את ההעברה לצורך בדיקה.
- פעולות הכתיבה דרך האתר וההעברה משתמשות באותה נעילת סקריפט. עריכה ידנית בגיליונות אינה כפופה לנעילה; לכן אין לערוך בזמן ההעברה.
- הארכיון זמין בניהול לצפייה בלבד, לפי בחירת המשתמש. הוא נטען רק בפתיחת ההיסטוריה ובחיפוש/דפדוף, עד 50 תוצאות בתשובה. החיפוש בצד השרת עדיין סורק את הארכיון; הוא אינו אינדקס במסד נתונים.
- היומן הרגיל, דוחות/סיכומי לקוחות ותזכורות תחזוקה קיימות משתמשים ביומן הפעיל בלבד. היסטוריה ישנה מחפשים באזור הארכיון; היא אינה מוזרקת לזיכרון התורים הפעילים. מחיקת/עדכון לקוחה בממשק הפעיל אינם משנים את רשומות הארכיון.
- לא שונתה מערכת ההתחברות הקיימת. מסלול הארכיון משתמש באותו דפוס JSONP של קריאות הניהול הקיימות; זו אינה הוספת אימות שרת חדש.
- לעצירת התזמון, מחקי בעורך Apps Script > Triggers את הטריגר של `archivePastAppointments`. עצירתו אינה מחזירה נתונים שכבר הועברו.
- בדיקות מקומיות: `node archive.test.cjs` ו־`node archive-ui.test.cjs`. אלה בדיקות עם נתוני דמה; יש להשלים אימות מול Google ובטלפון לפני הפעלה קבועה.

## פריסת טעינת הזמינות

1. פתחי את פרויקט Google Apps Script שמשרת את האתר.
2. עדכני את הקוד לפי apps-script.js, תוך שמירת מזהה הגיליון והגדרות הפרויקט הקיימים.
3. בחרי Deploy > Manage deployments > Edit, ואז New version ו-Deploy בפריסת ה-Web app הקיימת. שמרי את הרשאות הגישה הקיימות שמאפשרות ללקוחות להשתמש באתר.
4. ודאי שכתובת הפריסה זהה ל-WEBAPP_URL שב-booking.js. אם השתנתה, עדכני את הקבוע לפני העלאת האתר.
5. בדקי בכתובת הפריסה עם ?action=availability&month=2026-09 שמתקבל אובייקט עם success: true, month ו-appointments (ייתכן מערך ריק).
6. רק אחרי עדכון השרת, פרסי את קבצי האתר ל-Vercel.
7. בדקי בטלפון חודש נוכחי, חודש הבא, מעבר מהיר בין חודשים, חודש ריק, בחירת שעה וכשל רשת. שעות תפוסות חייבות להישאר חסומות; כשל רשת חייב לחסום המשך ולאפשר ניסיון חוזר.

המסלול החדש מחזיר רק זמינות לחודש המבוקש וללא פרטי לקוחות. Google Sheets עדיין נסרק בצד השרת; זה מצמצם את התשובה והעבודה בדפדפן, אך אינו אינדקס חודשי בגיליון. הלקוח החדש יציג שגיאה בטוחה מול השרת הישן עד עדכון הפריסה.

## Booking performance and save confirmation (2026-09-23)

Implemented in this revision:
- Availability prefetch on service selection, shared in-flight requests per month, and a 20-second in-page cache. Availability is display-only: booking still checks the active sheet under the server lock.
- Availability allows two 30-second attempts before showing the existing visible retry action. A single 15-second limit proved too aggressive for variable Google response times and was reverted. Errors are never cached as empty availability.
- Booking confirmation requires explicit server success. Network errors, malformed responses and the 30-second save timeout show an uncertain-save message. Retrying identical details in the same open page reuses the booking ID. This does not persist across page reloads; after reloading, check the existing booking before starting another.
- Admin bookings update local appointments and close the dialog only after success. Duplicate client-save requests were removed because the server already saves the client.
- Server save uses one active-sheet read for ID and conflict checks; native Sheets date/time cells are normalized in the spreadsheet timezone. Retries of cancelled or changed slots do not report success.
- Apps Script logs `booking_read_ms` (including active row count), `booking_mail_ms`, `booking_save_ms` (includes mail), and `booking_client_ms`. These logs include no client details. They become available only after deploying the updated Apps Script. Use real authorized bookings to compare stages; no test bookings were sent to production.

Deployment: update the existing Apps Script Web App first, preserving its URL, spreadsheet IDs and permissions. Then publish the matching website files together (`booking.js`, `booking-ui.js`, `admin-ui.js`, `booking.html`, `admin.html`). A Git push does not update Apps Script. Before rollout, save the current deployed version for rollback. Verify booking and administration in a browser after deployment. The tests here use mocks and do not prove the deployed Google code matches this checkout.

Further improvements: move mail to a durable outbox with retry processing (requires Google setup), shorten the global lock without weakening slot exclusivity, and inspect the nightly archive execution status/counts. Do not merely remove mail from the critical path without reliable delivery. No archive trigger or data migration was run during this change.

Validation: `node tests/booking-performance.test.cjs`, `node tests/booking-confirmation.test.cjs`, `node tests/booking-server.test.cjs`, `node archive.test.cjs`, `node archive-ui.test.cjs`, `node tests/holidays.test.cjs`. Server tests simulate sequential lock-protected requests to the same slot; actual concurrent Google execution still requires a controlled deployment check.

## Availability transport recovery (2026-09-24)

The site now reads availability through `/api/availability?month=YYYY-MM`, a read-only Vercel function. It requests only the existing public availability action, validates the upstream response, and returns only date, time, duration and status. It accepts GET only and does not forward arbitrary URLs/actions, client data or credentials. Responses use `Cache-Control: no-store`; only the existing 20-second page-memory cache is retained. Booking writes and conflict locking are unchanged.

The function retries a failed Google request once, with 12 seconds per attempt and a 30-second function limit. The browser allows 28 seconds for the API; missing API routes (404 on static/local hosts) use the existing JSONP fallback. Failed responses never become an empty available calendar. This removes the browser-to-Google script dependency but cannot guarantee availability during a Google outage.

Deploy these changes via the existing Git-connected Vercel project; no additional Apps Script deployment is required. Verify `/api/availability?month=2026-09` returns JSON and the browser shows both dates and times. Tests: `node tests/availability-api.test.mjs` and `node tests/availability-transport.test.cjs`, plus the booking regression tests. Rollback by reverting this commit as a unit.

## Manual overlap confirmation (2026-09-24)

Reverts the all-day admin slot suggestions from b1d4d90. The existing manual time inputs and prior suggestions remain. An admin save that receives a conflict asks for confirmation and, only when accepted, retries the same ID with `allowOverlap=true` and `status=confirmed`. Public booking UI does not send that flag; pending bookings cannot override a conflict. Cancelling sends no second request. Existing-ID validation and write locking remain active.

Deploy the updated `apps-script.js` to the existing Web App to enable this behavior; old server deployments continue rejecting overlaps. This uses the application's existing client-side admin access model: `confirmed` is not server-authenticated identity, so this is a UI/workflow distinction, not a new server authorization boundary. Server-side admin authentication remains separate work.

Checks: `node tests/admin-overlap.test.cjs`, `node tests/booking-server.test.cjs`, and booking confirmation/performance regressions. No real appointments were created by these tests.

## Save reconciliation and admin refresh (2026-09-24)

Deploy updated Apps Script to the existing Web App: the new read-only `bookingStatus` action checks the submitted ID, date, time and duration, returns no client details, and does not take the write lock. Booking rows are flushed before mail/calendar work so receipt checks can see the saved row. The browser checks after 10 seconds and again on uncertain save completion; each check is bounded to 12 seconds. A matching saved receipt or explicit save success confirms once, including late success while a receipt check is pending. Otherwise the UI retains the uncertain-save warning, rather than assuming success or automatically writing another booking.

On confirmed admin saves, the entry modal closes, the appointment is merged into local data, the active panel refreshes, and a toast replaces the automatic confirmation popup so the calendar is visible. No production test bookings or messages were sent.

Manual refresh now waits up to 30 seconds, uses unique callbacks, ignores late/out-of-order responses and responses from before a local appointment change, accepts a genuine empty result, and refreshes the active panel. Failed retrieval no longer shows a success toast. Apps Script load errors return an explicit failure object instead of an empty appointment list. Deploy Apps Script to obtain that distinction in production. Regression coverage: `node tests/booking-reconciliation.test.cjs`, server, overlap, booking, archive and archive UI tests.
