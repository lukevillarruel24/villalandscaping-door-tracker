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

### 2. Connect the app to Supabase
In **Project Settings → API** (or **Data API**), copy the **Project URL** and the **anon / publishable** key into `src/config.js`.
Never put the `service_role` / secret key in this app.

### 3. Vercel (hosting)
1. Sign in at [vercel.com](https://vercel.com) with GitHub.
2. **Add New → Project →** import `villalandscaping-door-tracker`.
3. Leave every setting as is (it detects Vite) and click **Deploy**.
4. You'll get a link like `villalandscaping-door-tracker.vercel.app`. Every time code is pushed to GitHub, Vercel updates the app automatically.

### 4. Put it on the phones
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

**Door statuses:** 🟢 Lead · 🟠 Maybe · 🔵 Come Back Later · ⚪ Not Home · 🔴 Not Interested

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
- Address lookup uses OpenStreetMap's free service. It's fine for door-knocking volume.

## Running it on a computer (optional, for development)
```bash
npm install
npm run dev
```
