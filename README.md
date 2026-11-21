# Villa Doors

Door-to-door lead tracker for Villa Landscaping. Your rep pins every house he knocks on a live map, color coded by what happened. Leads become clients, and each client has notes, job photos and estimates with line items.

**Built with:** React + Vite, OpenStreetMap (Leaflet), Supabase (database, logins, photo storage), hosted on Vercel.

---

## One-time setup

### 1. Supabase (database)
1. Create a project at [supabase.com](https://supabase.com) (pick a US East region).
2. Open **SQL Editor → New query**. Paste in everything from [`supabase/setup.sql`](supabase/setup.sql).
3. **At the very bottom of that SQL**, replace `YOUR-EMAIL@example.com` and `REP-EMAIL@example.com` with the real emails. Only emails on this list can use the app.
4. Click **Run**. You should see "Success. No rows returned."
5. Go to **Authentication → Sign In / Providers** (or **Settings**) and turn **off** "Allow new users to sign up". You'll add people yourself.
6. Go to **Authentication → Users → Add user → Create new user** for yourself and your rep. Give each a temporary password and check **Auto Confirm User**.
7. Go to **Authentication → URL Configuration** and set **Site URL** to your Vercel link (step 3 below). That makes "Forgot password" emails work.

> **Already set up before update 2?** Run [`supabase/update-2.sql`](supabase/update-2.sql) once in the SQL Editor. (Fresh installs get it inside `setup.sql`.)

### 2. Connect the app to Supabase
In **Project Settings → API** (or **Data API**), copy the **Project URL** and the **anon / publishable** key into `src/config.js`.
Never put the `service_role` / secret key in this app.

### 3. Vercel (hosting)
1. Sign in at [vercel.com](https://vercel.com) with GitHub.
2. **Add New → Project →** import `villalandscaping-door-tracker`.
3. Leave every setting as is (it detects Vite) and click **Deploy**.
4. You'll get a link like `villalandscaping-door-tracker.vercel.app`. Every time code is pushed to GitHub, Vercel updates the app automatically.

### 4. House-number lookup (Geocodio)
When a pin is dropped, the app looks up the address with [Geocodio](https://www.geocod.io) (free for 2,500 lookups a day, no card needed). If that's unavailable it falls back to OpenStreetMap.
1. In Geocodio, create an API key with only the **GET /v2.1/geocode** permission.
2. In Vercel: **Project → Settings → Environment Variables**, add `GEOCODIO_API_KEY` with the key as the value.
3. Redeploy (Deployments → ⋯ → Redeploy), or push any change to GitHub.

The key lives only on Vercel's server (`api/reverse.js`), never in the app on the phone, and only signed-in team members can use the lookup.

### 5. Satellite view (Esri)
The map has a **Map / Satellite** button. Satellite photos come from Esri (free up to 2 million map tiles a month).
1. At [location.arcgis.com](https://location.arcgis.com), create an API key with the **Location services → Basemaps** privileges, limited to your app's URL.
2. In Vercel: **Environment Variables**, add `VITE_ARCGIS_API_KEY` with the key, then **Redeploy**.

Without the key, or if Esri ever fails, Satellite automatically uses free USGS aerial photos (blurrier, about 1 meter per pixel).

### 6. Put it on the phones
Open the link on each phone and sign in.
- **iPhone (Safari):** Share button → **Add to Home Screen**
- **Android (Chrome):** ⋮ menu → **Add to Home screen** / **Install app**

Allow location when it asks, so the map can show where you are.

---

## Everyday use

| Screen | What it does |
|---|---|
| **Map** | Blue dot is you. Tap **Log a door**, slide the map so the pin sits on the house, tap **Drop pin here**, pick what happened. Tap any pin to see its history or log another knock. The filter button hides statuses or limits to today / last 7 days. |
| **Leads** | Everyone marked as a lead. Tap one for info, notes, photos and estimates. **Convert to client** when they sign. |
| **Clients** | Signed customers. |
| **Stats** | Doors knocked, leads, clients and won $ for today / this week / this month, broken down by person. |
| **Me** | Your name, password, team list, sign out. |

**Door statuses:** 🟢 Lead · 🟠 Maybe · 🔵 Come Back Later · ⚪ Not Home · 🔴 Not Interested · ⚫ No Soliciting

**In the field**
- **Save + next door** saves the pin and drops you straight into placing the next one.
- **Come Back Later** asks when (later today, tomorrow, Saturday, next week, or a date). Pins due for a revisit get an orange ring (red if overdue).
- The bar at the top shows **doors you've knocked today vs. the daily goal** (set the goal under Me).
- **No signal?** Knocks are saved on the phone (dashed pins) and upload automatically when signal returns.
- Filter the map by status, by person, by date, or to **Come back** pins only.
- Zoom in close and each logged pin shows its **house number** above it.
- **Press and hold on any house** (right-click on a computer) to see its address, nearby house numbers, and whether it's already been knocked. Tap **Log this door** to log it with that address filled in.

**Follow-ups**
- Leads have a **Next follow-up** date. Anything due today or overdue shows at the top of **Leads**, and the Leads tab gets a red badge.
- Each lead records **how they found us** (door knock, referral, yard sign, ads, website, repeat customer).

**Stats**
- Pick any range (today, yesterday, this/last week, this month, last 30 days, all time, or custom dates) and any person.
- **Daily log:** each day's doors, leads, first and last knock, time out, and doors per hour. Tap a day to zoom in.
- Doors-per-day chart (knocks-by-hour for a single day), results at the door, lead sources.
- **Download CSV** of knocks or of all leads and clients, to open in Excel or Google Sheets.

**Estimates:** Add line items (qty × price), pick from common items, set tax %. The total updates as you type. Tap the printer icon for a clean estimate you can print or save as a PDF to text or email.

## Adding or removing team members
In Supabase **SQL Editor**:
```sql
insert into public.team_members (email) values ('newperson@example.com');
-- remove someone:
delete from public.team_members where email = 'oldperson@example.com';
```
Then create their login under **Authentication → Users → Add user**.

## Free tier limits (plenty for this)
- Supabase free: 500 MB database, 1 GB photo storage. Photos are shrunk before upload (about 200–400 KB each), so that's a few thousand photos.
- Geocodio free: 2,500 address lookups per day. Without a card on file it simply stops at that limit, so there are no surprise charges.

## Running it on a computer (optional, for development)
```bash
npm install
npm run dev
```
