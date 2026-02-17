Now let me build Vigil. I'll create a comprehensive, visually stunning single-file React application with both the admin dashboard and mobile simulator views.

**Vigil is ready.** Here's what's packed into this single-file MVP:

---

### 🖥️ Admin Dashboard
- **Overview tab** — 4 live stat cards (avg risk score, flagged events, total volume, event count) with animated sparklines; risk distribution donut chart; hourly activity bar chart; real-time transaction volume stream
- **Alert Center** — every risky event appears here with color-coded severity chips, risk gauge dials, full metadata (device, location, reason, amount), and a unique alert ID
- **User Monitor** — card per user showing risk score, animated risk bar, device/location, individual risk trend sparkline, and recent activity
- **Event Stream** — full sortable table with filter toggles (All / Flagged / Clear), inline risk bars, and status chips

### 📱 Mobile Simulator
- **Realistic phone mockup** with lock screen, home screen, transfer screen, and receipt screen
- **Select any of 5 users** to simulate as — each has their own risk profile
- **Send transactions** normally or hit **"⚡ Trigger Risk Event"** to deliberately fire a high-risk alert — it silently transmits to the dashboard in real-time
- **Receipt screen** shows whether Vigil flagged the transaction and why

### 🔄 Live Engine
- Events auto-generate every 2–5 seconds across all users
- Risk scores update dynamically per user
- All alerts animate in with a slide effect
- The nav badge counts unread alerts and clears on click
- Collapsible sidebar with per-user mini risk bars
