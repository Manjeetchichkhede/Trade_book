# Google AI Studio Build Prompt — tradebook (PWA-Ready for PC & Android)

Is prompt ko seedha **Google AI Studio → Build (Apps)** mein paste karein (saath mein apna `tradebook` logo upload kar dein). Yeh bina kisi native dependency error ke turant browser mein run hoga aur **PWA-ready** hone ki wajah se **Windows PC** aur **Android** dono pe app ki tarah install (ya PWABuilder se `.apk` convert) ho jayega.

---

## Prompt to Copy & Paste into Google AI Studio

> **Role:** Build a complete, bug-free, 100% client-side, offline-first **Progressive Web App (PWA)** named **tradebook** using **React, TypeScript, Vite, Tailwind CSS, Lucide React (`lucide-react`), and Recharts (`recharts`)**. Do **not** use Electron, Capacitor, Node-only modules, backend servers, or external API keys — everything must run immediately inside Google AI Studio's browser preview with zero console or TypeScript errors.
>
> ### 1. PWA & Installability (PC + Android Ready)
> - Include a valid `public/manifest.json` (`name: "tradebook"`, `short_name: "tradebook"`, `display: "standalone"`, `start_url: "/"`, `background_color: "#060a14"`, `theme_color: "#060a14"`, and `192x192` / `512x512` icon references).
> - Add mobile & desktop PWA meta tags in `index.html` (`theme-color`, `apple-mobile-web-app-capable`, `viewport-fit=cover`).
> - Register a clean, safe offline service worker (`public/sw.js`, wrapped in `try/catch` so preview sandboxes never error) and show an optional **"Install App"** button in the header/Settings when the browser fires `beforeinstallprompt`.
> - Use a lightweight native **IndexedDB** helper (with safe `localStorage` fallback) to store accounts, trades, ROI ledger, settings, and **Before/After chart screenshot images** offline without hitting storage limits.
>
> ### 2. Branding, Greeting & Responsive Layout
> - **App Name:** `tradebook` (lowercase wordmark)
> - **Logo:** Use the uploaded royal-blue square `tradebook` logo (or a crisp fallback SVG badge if not yet uploaded) in the top header and as a large `80x80` logo inside Settings → Software Details.
> - **Greeting:** Display `"Welcome back, Mr. Manjeet Chichkhede"` in the header and Overview hero card.
> - **Navigation:**
>   - **Desktop:** Floating rounded-full frosted-glass **pill navigation bar** in the header with a smooth CSS sliding active-pill animation across 5 tabs: `Overview`, `Journal`, `Lot Size`, `Sessions`, `ROI`.
>   - **Mobile (`< 768px`):** Fixed floating bottom frosted-glass pill navigation bar with safe-area padding.
>
> ### 3. Glassmorphic Design System, Themes & Fonts
> - **Full-Page Glassmorphism:** Translucent frosted-glass cards (`backdrop-filter: blur(18px)`), luminous subtle borders, and a fixed ambient multi-tone radial background gradient behind all content.
> - **4 Themes (instant switching):**
>   1. `Dark` (deep obsidian + royal-blue/emerald/indigo glow)
>   2. `Light` (frosted daylight with crisp dark text)
>   3. `Monochrome` (sleek grayscale zinc/slate)
>   4. `Black & White` (high-contrast OLED pure `#000000` & crisp `#ffffff`)
> - **5 Fonts (via Google Fonts `<link>` in `index.html` + system fallbacks):**
>   - `Inter`, `Ubuntu`, `iOS 15.5 (-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif)`, `Comfortaa`, and `Terminal Mono`.
>
> ### 4. All 5 Tabs & Functional Specs
>
> #### Tab 1: Overview
> - **Hero Card:** Greeting (`Welcome back, Mr. Manjeet Chichkhede`), Today's Net P&L, active live session pill (`Asian Session`, `London Open Killzone`, `New York AM Killzone`, etc.), live ticking **IST & NY** digital clock, and quick shortcuts (`+ Log Trade`, `Lot Size`, `Sessions`).
> - **KPI Cards (4):** Win Rate (`W / L / BE` + Profit Factor), Avg R-Multiple (+ Best Trade), Total Funded Capital (active accounts), and Net Challenge ROI (payouts vs. fees + ROI %).
> - **Active Funded & Eval Accounts Grid:**
>   - Add, Edit, and Delete accounts (Firm, Account Name, Stage: `Funded` / `Eval Phase 1` / `Eval Phase 2`, Starting Balance, Drawdown Type: `EOD Trailing` / `Intraday Trailing` / `Static`, Daily Loss Limit, Max Drawdown, Min Trading Days, Eval Fee).
>   - Live Equity, Net P&L ($ and %), color-coded **Daily Drawdown** and **Max Drawdown** progress bars (green `< 60%`, amber `60–84%`, rose `85%+`) with exact breach floor, **Profit Target %** bar for evals, **Min Trading Days** (`X / 5 min`), **Consistency Cap %**, and quick `Log` / `Payout` buttons.
> - **Analytics Row:** **Performance Curve** (toggle between Cumulative Equity Area Chart and Daily P&L Bar Chart using Recharts) + **Edge & Discipline Audit** (setup P&L breakdown + Cost of Rule-Breaking).
> - **Important:** Do **not** include a Trade Highlights Slideshow.
>
> #### Tab 2: Journal (Quick Trade Logger + Calendar & List Views)
> - **Quick Trade Logger:** Account selector, Date, Symbol, Side (`Long`/`Short`), R-Multiple, Net P&L with quick preset buttons (`-$500`, `-$250`, `+$400`, `+$850`), Mental State (`Focused`, `Calm`, `Anxious`, `Overconfident`, `Revenge`), Rule-Followed toggle, Execution Note.
> - **Playbook Setups (exact options only):**
>   1. `Inducement + CISD`
>   2. `Liquidity Sweep + CISD + BB`
> - **Before & After Chart Screenshots:** Two upload slots (`Before Chart` & `After Chart`) with instant thumbnail previews, Clear buttons, and a side-by-side lightbox modal when clicking any trade's chart badge in Calendar or List view.
> - **Live Drawdown Impact Preview:** Shows projected Balance, Daily Buffer, and Max DD Buffer before saving, with a red breach warning if the trade breaks a rule.
> - **Calendar & List Switcher:** Monthly P&L Calendar (green/red day cells, Month P&L, tap-a-date drawer, `+ Add on Date`) + filterable List View + **Export CSV**.
>
> #### Tab 3: Lot Size
> - **Top Row — Section 1 (Instrument & Account Capital):** Category pills (`All`, `Metals`, `Forex Majors`, `Forex Crosses`, `Indices`), instrument selector & quick chips (`XAUUSD`, `XAGUSD`, `EURUSD`, `GBPUSD`, `USDJPY`, `GBPJPY`, `EURJPY`, `NAS100`, `US30`, `NQ`), one-click balance loader pills from active funded accounts, and Account Balance input.
> - **Top Row — Section 2 (Risk Parameters & Stop Distance):** Risk % slider + presets (`0.25%`, `0.5%`, `1.0%`, `2.0%`), mode toggle between **Pips / Points Mode** and **Price Levels Mode** (Entry, SL, TP), and prop-firm consecutive-loss safety guardrail.
> - **Bottom Output Window (strictly below Sections 1 & 2):** Large **Recommended Lot Size** card (`Lots` or `Contracts`), `1 : X.XX R` badge, `Mini`, `Micro`, `Risk $`, and `Reward $`.
>
> #### Tab 4: Sessions (Live Trading Clocks & Killzones)
> - **Live Trading Clocks:** Synchronized **India (IST, UTC+5:30)** and **New York (EST/EDT)** clocks updating every second, with `Auto DST`, `Winter (UTC-5)`, and `Summer (UTC-4)` switcher, **Clock Style** selector (`Roman Classic`, `Modern Minimal`, `Neon Terminal`, `Digital Only`), and a 24-hour IST session timeline bar with a live marker.
> - **Session & Killzone Cards:** Filter pills (`All Windows`, `Live Now`, `Killzones`, `Silver Bullet`) for Asian Session, Asian Killzone, London Open Killzone, New York AM Killzone, NY AM Silver Bullet, and NY PM Silver Bullet — each showing exact IST & NY windows, `● LIVE NOW` badge, key pairs, and live countdown timer.
> - **Important:** Do **not** include an ICT Concept Playbook section.
>
> #### Tab 5: ROI (Challenge Fees & Payout Ledger)
> - 4 KPI cards (Total Payouts, Total Fees, Net Business Profit, Cash-on-Cash ROI %), Monthly Fees vs. Payouts bar chart, entry form (`Payout` with Trader Split %, `Challenge Fee`, `Reset Fee`, `Activation Fee`), and history table.
>
> ### 5. Settings Modal (Header Gear Button)
> - **Theme:** `Dark`, `Light`, `Monochrome`, `Black & White`
> - **Font Style:** `Inter`, `Ubuntu`, `iOS 15.5`, `Comfortaa`, `Terminal Mono`
> - **Session Clock Style:** `Roman Classic`, `Modern Minimal`, `Neon Terminal`, `Digital Only`
> - **Display Currency:** `USD ($)` or `INR (₹)` (with ₹85/USD conversion)
> - **Toggles:** `Glass Effect on Page`, `Glass Effect on Navigation Bar`, `Background Gradient Effect`, `Live Clocks on Overview`, `Drawdown Breach Guardrail`, `Compact Account Cards`, `Hide Dollar Balances (Privacy Mode)`
> - **Data Backup & Restore:** `Backup JSON` and `Restore JSON` buttons + `Reset Demo Data` (with in-page confirmation modal, never `window.alert`/`confirm`).
> - **Software Details (last card at bottom of Settings):**
>   - Big `tradebook` logo (`80x80` rounded)
>   - **Author:** `Mr. Manjeet Chichkhede (Intraday Trader)`
>   - **Software Version:** `v2.4.0 Glass Edition`
>
> Pre-populate realistic demo funded accounts, trades (using the 2 CISD setups), and ROI entries on first load so the app opens rich and immediately testable. Ensure clean TypeScript types and zero build errors.

---

### Quick Deployment Steps After AI Studio Generates the App
1. **PC App (1-Click):** Deploy the app (Vercel / Netlify / Firebase Hosting) → open in Chrome or Edge → click **Install tradebook** in the address bar.
2. **Android APK (No Coding):** Paste your live deployed URL into **PWABuilder.com** → select **Android** → download the signed `.apk` package.