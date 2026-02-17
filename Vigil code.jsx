import { useState, useEffect, useRef, useCallback } from "react";

// ─── MOCK DATA ────────────────────────────────────────────────────────────────
const USERS = [
  { id: "U001", name: "Sophia Mercer", email: "s.mercer@nexcorp.io", avatar: "SM", device: "MacBook Pro", location: "New York, US" },
  { id: "U002", name: "Rajan Patel", email: "r.patel@nexcorp.io", avatar: "RP", device: "iPhone 15", location: "London, UK" },
  { id: "U003", name: "Lena Voss", email: "l.voss@nexcorp.io", avatar: "LV", device: "Windows PC", location: "Berlin, DE" },
  { id: "U004", name: "Marcus Webb", email: "m.webb@nexcorp.io", avatar: "MW", device: "Android Phone", location: "Toronto, CA" },
  { id: "U005", name: "Yuki Tanaka", email: "y.tanaka@nexcorp.io", avatar: "YT", device: "iPad Pro", location: "Tokyo, JP" },
];

const RISK_REASONS = [
  "Unusual transaction amount",
  "New device detected",
  "Off-hours login",
  "Multiple failed attempts",
  "Geographic anomaly",
  "Rapid successive transactions",
  "VPN usage detected",
  "Credential sharing suspected",
  "Unusual browsing pattern",
  "Account accessed from 2 locations",
];

const TX_CATEGORIES = ["Transfer", "Withdrawal", "Purchase", "International", "Large Deposit"];

function randomBetween(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function randomFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randomFloat(a, b) { return parseFloat((Math.random() * (b - a) + a).toFixed(2)); }

function generateEvent(user, forceRisk = false) {
  const riskScore = forceRisk ? randomBetween(72, 99) : randomBetween(5, 99);
  const isRisky = riskScore >= 65;
  const amount = randomBetween(100, 49000);
  return {
    id: `EVT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    userId: user.id,
    userName: user.name,
    userAvatar: user.avatar,
    type: randomFrom(TX_CATEGORIES),
    amount,
    riskScore,
    isRisky,
    reason: isRisky ? randomFrom(RISK_REASONS) : null,
    device: user.device,
    location: user.location,
    timestamp: new Date(),
    status: isRisky ? "flagged" : "clear",
  };
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function riskColor(score) {
  if (score >= 80) return "#ff3b5c";
  if (score >= 60) return "#ff8c00";
  if (score >= 35) return "#f5c518";
  return "#00e5a0";
}

function riskLabel(score) {
  if (score >= 80) return "CRITICAL";
  if (score >= 60) return "HIGH";
  if (score >= 35) return "MEDIUM";
  return "LOW";
}

function timeAgo(date) {
  const s = Math.floor((new Date() - date) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

function fmtCurrency(n) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

// ─── SPARKLINE COMPONENT ──────────────────────────────────────────────────────
function Sparkline({ data, color = "#00e5a0", height = 40, width = 120 }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  });
  const path = `M ${pts.join(" L ")}`;
  const fill = `M ${pts[0]} L ${pts.join(" L ")} L ${width},${height} L 0,${height} Z`;
  return (
    <svg width={width} height={height} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id={`sg-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fill} fill={`url(#sg-${color.replace("#", "")})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1].split(",")[0]} cy={pts[pts.length - 1].split(",")[1]} r="3" fill={color} />
    </svg>
  );
}

// ─── DONUT CHART ──────────────────────────────────────────────────────────────
function DonutChart({ segments, size = 100 }) {
  const cx = size / 2, cy = size / 2, r = size * 0.38, stroke = size * 0.15;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={stroke} />
      {segments.map((seg, i) => {
        const dash = (seg.value / 100) * circ;
        const el = (
          <circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={stroke}
            strokeDasharray={`${dash} ${circ}`}
            strokeDashoffset={-offset * circ / 100}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.6s ease" }}
          />
        );
        offset += seg.value;
        return el;
      })}
      <text x={cx} y={cy - 4} textAnchor="middle" fill="white" fontSize={size * 0.18} fontWeight="700" fontFamily="'Space Mono', monospace">
        {segments.find(s => s.primary)?.value ?? segments[0]?.value}%
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize={size * 0.1} fontFamily="'DM Sans', sans-serif">
        RISK
      </text>
    </svg>
  );
}

// ─── RISK GAUGE ───────────────────────────────────────────────────────────────
function RiskGauge({ score, size = 80 }) {
  const angle = (score / 100) * 180 - 90;
  const color = riskColor(score);
  const r = size * 0.4;
  const cx = size / 2, cy = size * 0.6;
  return (
    <svg width={size} height={size * 0.7}>
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" strokeLinecap="round" />
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
        strokeDasharray={`${Math.PI * r * score / 100} ${Math.PI * r}`} style={{ transition: "stroke-dasharray 0.8s ease, stroke 0.4s ease" }} />
      <line
        x1={cx} y1={cy}
        x2={cx + (r - 8) * Math.cos((angle * Math.PI) / 180)}
        y2={cy + (r - 8) * Math.sin((angle * Math.PI) / 180)}
        stroke={color} strokeWidth="2.5" strokeLinecap="round"
        style={{ transition: "all 0.8s ease" }}
      />
      <circle cx={cx} cy={cy} r="4" fill={color} />
    </svg>
  );
}

// ─── BAR CHART ────────────────────────────────────────────────────────────────
function BarChart({ data, height = 80 }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "4px", height: `${height}px` }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", height: "100%" }}>
          <div style={{
            flex: 1, width: "100%", display: "flex", alignItems: "flex-end",
            position: "relative", overflow: "hidden", borderRadius: "3px 3px 0 0"
          }}>
            <div style={{
              width: "100%",
              height: `${(d.value / max) * 100}%`,
              background: d.color || "rgba(0,229,160,0.5)",
              borderRadius: "3px 3px 0 0",
              transition: "height 0.6s ease",
              minHeight: "2px"
            }} />
          </div>
          <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)", fontFamily: "monospace", whiteSpace: "nowrap" }}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function Vigil() {
  const [view, setView] = useState("dashboard"); // dashboard | mobile
  const [events, setEvents] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userScores, setUserScores] = useState({});
  const [riskHistory, setRiskHistory] = useState([]);
  const [txHistory, setTxHistory] = useState([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [mobileUser, setMobileUser] = useState(USERS[0]);
  const [mobileScreen, setMobileScreen] = useState("home");
  const [mobileLoading, setMobileLoading] = useState(false);
  const [mobileSent, setMobileSent] = useState(null);
  const [mobileAmount, setMobileAmount] = useState("1,500");
  const [mobileRecipient, setMobileRecipient] = useState("Alex Johnson");
  const [newAlertCount, setNewAlertCount] = useState(0);
  const [liveIndicator, setLiveIndicator] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [filterRisk, setFilterRisk] = useState("all");
  const [hourlyData, setHourlyData] = useState(() =>
    Array.from({ length: 12 }, (_, i) => ({ label: `${i * 2}:00`, value: randomBetween(2, 20), color: "rgba(0,229,160,0.6)" }))
  );
  const alertListRef = useRef(null);
  const prevAlertCount = useRef(0);

  // Simulated scores
  useEffect(() => {
    const init = {};
    USERS.forEach(u => { init[u.id] = randomBetween(20, 95); });
    setUserScores(init);
    setRiskHistory(Array.from({ length: 20 }, () => randomBetween(20, 80)));
    setTxHistory(Array.from({ length: 20 }, () => randomBetween(1000, 50000)));
  }, []);

  // Auto-generate events
  useEffect(() => {
    const generateNewEvent = () => {
      const user = randomFrom(USERS);
      const forceRisk = Math.random() < 0.35;
      const evt = generateEvent(user, forceRisk);
      setEvents(prev => [evt, ...prev].slice(0, 100));
      setUserScores(prev => ({
        ...prev,
        [user.id]: evt.isRisky
          ? Math.min(99, (prev[user.id] || 50) + randomBetween(5, 15))
          : Math.max(5, (prev[user.id] || 50) - randomBetween(1, 5))
      }));
      setRiskHistory(prev => [...prev.slice(-19), evt.riskScore]);
      setTxHistory(prev => [...prev.slice(-19), evt.amount]);
      if (evt.isRisky) {
        setAlerts(prev => [{
          ...evt,
          alertId: `ALRT-${Date.now()}`,
          read: false,
        }, ...prev].slice(0, 50));
        setNewAlertCount(c => c + 1);
      }
      setHourlyData(prev => {
        const updated = [...prev];
        const idx = randomBetween(0, updated.length - 1);
        updated[idx] = { ...updated[idx], value: updated[idx].value + 1 };
        return updated;
      });
    };
    const interval = setInterval(generateNewEvent, randomBetween(2000, 5000));
    return () => clearInterval(interval);
  }, []);

  // Live indicator pulse
  useEffect(() => {
    const t = setInterval(() => setLiveIndicator(p => !p), 1000);
    return () => clearInterval(t);
  }, []);

  const criticalCount = alerts.filter(a => a.riskScore >= 80).length;
  const highCount = alerts.filter(a => a.riskScore >= 60 && a.riskScore < 80).length;
  const totalRisk = events.length > 0 ? Math.round(events.slice(0, 20).reduce((s, e) => s + e.riskScore, 0) / Math.min(events.length, 20)) : 0;
  const flaggedToday = events.filter(e => e.isRisky).length;
  const totalTx = events.length;
  const totalVolume = events.reduce((s, e) => s + e.amount, 0);

  const filteredEvents = filterRisk === "all" ? events :
    filterRisk === "flagged" ? events.filter(e => e.isRisky) :
    events.filter(e => !e.isRisky);

  // Mobile: send transaction
  const sendMobileTransaction = useCallback((forceRisk = false) => {
    setMobileLoading(true);
    const amt = parseInt(mobileAmount.replace(/,/g, "")) || 1500;
    setTimeout(() => {
      const evt = generateEvent(mobileUser, forceRisk || amt > 20000);
      evt.amount = amt;
      evt.userName = mobileUser.name;
      evt.userAvatar = mobileUser.avatar;
      setEvents(prev => [evt, ...prev].slice(0, 100));
      if (evt.isRisky) {
        setAlerts(prev => [{ ...evt, alertId: `ALRT-${Date.now()}`, read: false }, ...prev].slice(0, 50));
        setNewAlertCount(c => c + 1);
      }
      setMobileLoading(false);
      setMobileSent(evt);
      setMobileScreen("receipt");
    }, 1800);
  }, [mobileUser, mobileAmount]);

  const doMobileLogin = useCallback(() => {
    setMobileLoading(true);
    setTimeout(() => {
      const evt = generateEvent(mobileUser, Math.random() < 0.3);
      evt.type = "Login";
      evt.amount = 0;
      setEvents(prev => [evt, ...prev].slice(0, 100));
      if (evt.isRisky) {
        setAlerts(prev => [{ ...evt, alertId: `ALRT-${Date.now()}`, read: false }, ...prev].slice(0, 50));
        setNewAlertCount(c => c + 1);
      }
      setMobileLoading(false);
      setMobileScreen("home");
    }, 1500);
  }, [mobileUser]);

  const styles = getStyles();

  return (
    <div style={styles.root}>
      {/* Background grid */}
      <div style={styles.bgGrid} />

      {/* Top Nav */}
      <nav style={styles.nav}>
        <div style={styles.navLeft}>
          <div style={styles.logo}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <polygon points="11,2 20,7 20,15 11,20 2,15 2,7" fill="none" stroke="#00e5a0" strokeWidth="1.5" />
              <polygon points="11,6 16,8.5 16,13.5 11,16 6,13.5 6,8.5" fill="#00e5a0" opacity="0.2" />
              <circle cx="11" cy="11" r="2.5" fill="#00e5a0" />
            </svg>
            <span style={styles.logoText}>VIGIL</span>
          </div>
        </div>
        <div style={styles.navTabs}>
          <button style={{ ...styles.navTab, ...(view === "dashboard" ? styles.navTabActive : {}) }} onClick={() => setView("dashboard")}>
            <span>⬡</span> Dashboard
          </button>
          <button style={{ ...styles.navTab, ...(view === "mobile" ? styles.navTabActive : {}) }} onClick={() => setView("mobile")}>
            <span>◈</span> Mobile Sim
          </button>
        </div>
        <div style={styles.navRight}>
          <div style={styles.liveChip}>
            <span style={{ ...styles.liveDot, opacity: liveIndicator ? 1 : 0.3 }} />
            LIVE
          </div>
          {newAlertCount > 0 && (
            <div style={styles.alertBadge} onClick={() => { setActiveTab("alerts"); setView("dashboard"); setNewAlertCount(0); }}>
              <span>⚠</span> {newAlertCount} new
            </div>
          )}
        </div>
      </nav>

      {view === "dashboard" ? (
        <div style={styles.dashLayout}>
          {/* Sidebar */}
          <aside style={{ ...styles.sidebar, width: sidebarOpen ? "220px" : "60px" }}>
            <button style={styles.sidebarToggle} onClick={() => setSidebarOpen(p => !p)}>
              {sidebarOpen ? "◀" : "▶"}
            </button>
            {[
              { key: "overview", icon: "⬡", label: "Overview" },
              { key: "alerts", icon: "⚡", label: "Alerts" },
              { key: "users", icon: "◈", label: "Users" },
              { key: "events", icon: "≋", label: "Events" },
            ].map(tab => (
              <button key={tab.key}
                style={{ ...styles.sidebarItem, ...(activeTab === tab.key ? styles.sidebarItemActive : {}) }}
                onClick={() => setActiveTab(tab.key)}>
                <span style={styles.sidebarIcon}>{tab.icon}</span>
                {sidebarOpen && <span style={styles.sidebarLabel}>{tab.label}</span>}
                {tab.key === "alerts" && newAlertCount > 0 && sidebarOpen && (
                  <span style={styles.sidebarBadge}>{newAlertCount}</span>
                )}
              </button>
            ))}

            {sidebarOpen && (
              <div style={styles.sidebarUsers}>
                <div style={styles.sidebarSectionLabel}>MONITORED</div>
                {USERS.map(u => (
                  <div key={u.id} style={styles.sidebarUser} onClick={() => { setSelectedUser(u); setActiveTab("users"); }}>
                    <div style={{ ...styles.miniAvatar, background: riskColor(userScores[u.id] || 50) + "33", borderColor: riskColor(userScores[u.id] || 50) }}>
                      {u.avatar}
                    </div>
                    <div style={styles.sidebarUserInfo}>
                      <span style={styles.sidebarUserName}>{u.name.split(" ")[0]}</span>
                      <div style={styles.miniRiskBar}>
                        <div style={{ ...styles.miniRiskFill, width: `${userScores[u.id] || 0}%`, background: riskColor(userScores[u.id] || 50) }} />
                      </div>
                    </div>
                    <span style={{ fontSize: "10px", color: riskColor(userScores[u.id] || 50), fontFamily: "monospace", fontWeight: "700" }}>
                      {userScores[u.id] || 0}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </aside>

          {/* Main Content */}
          <main style={styles.main}>
            {activeTab === "overview" && (
              <div style={styles.overviewGrid}>
                {/* Stat cards */}
                {[
                  { label: "Avg Risk Score", value: totalRisk, suffix: "/100", color: riskColor(totalRisk), sparkData: riskHistory, icon: "◈" },
                  { label: "Flagged Events", value: flaggedToday, suffix: "", color: "#ff3b5c", icon: "⚡" },
                  { label: "Total Events", value: totalTx, suffix: "", color: "#00e5a0", icon: "≋" },
                  { label: "Volume Processed", value: fmtCurrency(totalVolume), isString: true, color: "#7b8cff", icon: "◎" },
                ].map((stat, i) => (
                  <div key={i} style={styles.statCard}>
                    <div style={styles.statCardHeader}>
                      <span style={{ ...styles.statIcon, color: stat.color }}>{stat.icon}</span>
                      <span style={styles.statLabel}>{stat.label}</span>
                    </div>
                    <div style={styles.statValue} data-color={stat.color}>
                      <span style={{ color: stat.color, fontSize: stat.isString ? "22px" : "36px" }}>
                        {stat.isString ? stat.value : stat.value}
                      </span>
                      {stat.suffix && <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "14px" }}>{stat.suffix}</span>}
                    </div>
                    {stat.sparkData && (
                      <div style={{ marginTop: "8px" }}>
                        <Sparkline data={stat.sparkData} color={stat.color} width={160} height={35} />
                      </div>
                    )}
                  </div>
                ))}

                {/* Risk distribution donut */}
                <div style={{ ...styles.card, gridColumn: "span 2" }}>
                  <div style={styles.cardTitle}>Risk Distribution</div>
                  <div style={{ display: "flex", alignItems: "center", gap: "24px", padding: "8px 0" }}>
                    <DonutChart size={110} segments={[
                      { value: criticalCount > 0 ? Math.round((criticalCount / Math.max(alerts.length, 1)) * 100) : 15, color: "#ff3b5c", primary: false },
                      { value: highCount > 0 ? Math.round((highCount / Math.max(alerts.length, 1)) * 100) : 25, color: "#ff8c00" },
                      { value: 35, color: "#f5c518" },
                      { value: 25, color: "#00e5a0", primary: true },
                    ]} />
                    <div style={{ flex: 1 }}>
                      {[
                        { label: "CRITICAL", color: "#ff3b5c", pct: 15 },
                        { label: "HIGH", color: "#ff8c00", pct: 25 },
                        { label: "MEDIUM", color: "#f5c518", pct: 35 },
                        { label: "LOW", color: "#00e5a0", pct: 25 },
                      ].map((r, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                          <div style={{ width: "8px", height: "8px", borderRadius: "2px", background: r.color, flexShrink: 0 }} />
                          <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", fontFamily: "monospace", flex: 1 }}>{r.label}</span>
                          <span style={{ fontSize: "11px", color: r.color, fontFamily: "monospace" }}>{r.pct}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Hourly activity bar chart */}
                <div style={{ ...styles.card, gridColumn: "span 2" }}>
                  <div style={styles.cardTitle}>Activity by Hour</div>
                  <BarChart data={hourlyData} height={80} />
                </div>

                {/* Transaction volume sparkline */}
                <div style={{ ...styles.card, gridColumn: "span 4" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <span style={styles.cardTitle}>Transaction Volume Stream</span>
                    <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", fontFamily: "monospace" }}>REAL-TIME</span>
                  </div>
                  <Sparkline data={txHistory} color="#7b8cff" width="100%" height={60} />
                </div>

                {/* Recent Alerts */}
                <div style={{ ...styles.card, gridColumn: "span 4" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <span style={styles.cardTitle}>Recent Alerts</span>
                    <button style={styles.viewAllBtn} onClick={() => setActiveTab("alerts")}>View All →</button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {alerts.slice(0, 4).map(a => (
                      <div key={a.alertId} style={{ ...styles.alertRow, borderLeftColor: riskColor(a.riskScore) }}>
                        <div style={{ ...styles.avatar, background: riskColor(a.riskScore) + "22", borderColor: riskColor(a.riskScore) }}>{a.userAvatar}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={styles.alertName}>{a.userName}</span>
                            <span style={{ ...styles.riskChip, background: riskColor(a.riskScore) + "22", color: riskColor(a.riskScore) }}>
                              {riskLabel(a.riskScore)} · {a.riskScore}
                            </span>
                          </div>
                          <div style={styles.alertDetail}>{a.reason} · {a.device}</div>
                        </div>
                        <span style={styles.timeAgo}>{timeAgo(a.timestamp)}</span>
                      </div>
                    ))}
                    {alerts.length === 0 && <div style={styles.emptyState}>No alerts yet — monitoring...</div>}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "alerts" && (
              <div>
                <div style={styles.pageHeader}>
                  <h2 style={styles.pageTitle}>Alert Center</h2>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <span style={{ ...styles.riskChip, background: "#ff3b5c22", color: "#ff3b5c" }}>⚡ {criticalCount} Critical</span>
                    <span style={{ ...styles.riskChip, background: "#ff8c0022", color: "#ff8c00" }}>⚠ {highCount} High</span>
                  </div>
                </div>
                <div ref={alertListRef} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {alerts.map((a, idx) => (
                    <div key={a.alertId} style={{
                      ...styles.alertCard,
                      borderLeftColor: riskColor(a.riskScore),
                      animation: idx < newAlertCount ? "slideIn 0.4s ease" : "none",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                        <div style={{ ...styles.avatar, background: riskColor(a.riskScore) + "22", borderColor: riskColor(a.riskScore) }}>{a.userAvatar}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <span style={styles.alertName}>{a.userName}</span>
                              <span style={{ ...styles.riskChip, background: riskColor(a.riskScore) + "22", color: riskColor(a.riskScore), marginLeft: "8px" }}>
                                {riskLabel(a.riskScore)}
                              </span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                              <span style={{ color: "#fff", fontWeight: "700", fontSize: "20px", fontFamily: "monospace" }}>{a.riskScore}</span>
                              <RiskGauge score={a.riskScore} size={60} />
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: "16px", marginTop: "6px", flexWrap: "wrap" }}>
                            {[
                              { k: "Type", v: a.type },
                              { k: "Amount", v: a.amount > 0 ? fmtCurrency(a.amount) : "N/A" },
                              { k: "Device", v: a.device },
                              { k: "Location", v: a.location },
                              { k: "Reason", v: a.reason },
                            ].map(item => (
                              <div key={item.k} style={styles.metaItem}>
                                <span style={styles.metaKey}>{item.k}</span>
                                <span style={styles.metaVal}>{item.v}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div style={styles.alertCardFooter}>
                        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "11px", fontFamily: "monospace" }}>{a.alertId}</span>
                        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "11px" }}>{a.timestamp.toLocaleTimeString()}</span>
                      </div>
                    </div>
                  ))}
                  {alerts.length === 0 && <div style={styles.emptyState}>No alerts generated yet. Events are being monitored...</div>}
                </div>
              </div>
            )}

            {activeTab === "users" && (
              <div>
                <div style={styles.pageHeader}>
                  <h2 style={styles.pageTitle}>User Monitor</h2>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "16px" }}>
                  {USERS.map(u => {
                    const score = userScores[u.id] || 0;
                    const userEvents = events.filter(e => e.userId === u.id).slice(0, 5);
                    const userRiskHistory = events.filter(e => e.userId === u.id).slice(0, 15).map(e => e.riskScore).reverse();
                    return (
                      <div key={u.id} style={{ ...styles.userCard, ...(selectedUser?.id === u.id ? styles.userCardSelected : {}) }}
                        onClick={() => setSelectedUser(u)}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
                          <div style={{ ...styles.avatar, width: "44px", height: "44px", fontSize: "14px", background: riskColor(score) + "22", borderColor: riskColor(score) }}>{u.avatar}</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ color: "#fff", fontWeight: "600", fontSize: "14px", fontFamily: "'DM Sans', sans-serif" }}>{u.name}</div>
                            <div style={{ color: "rgba(255,255,255,0.35)", fontSize: "11px" }}>{u.email}</div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ color: riskColor(score), fontFamily: "monospace", fontWeight: "700", fontSize: "22px" }}>{score}</div>
                            <div style={{ ...styles.riskChip, background: riskColor(score) + "22", color: riskColor(score) }}>{riskLabel(score)}</div>
                          </div>
                        </div>
                        <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: "6px", padding: "6px", marginBottom: "10px" }}>
                          <div style={{ height: "6px", background: "rgba(255,255,255,0.08)", borderRadius: "3px", overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${score}%`, background: riskColor(score), borderRadius: "3px", transition: "width 0.6s ease, background 0.4s ease" }} />
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                          {[
                            { label: "Device", value: u.device },
                            { label: "Location", value: u.location },
                          ].map(item => (
                            <div key={item.label} style={{ flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: "6px", padding: "6px 8px" }}>
                              <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", fontFamily: "monospace", marginBottom: "2px" }}>{item.label}</div>
                              <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.7)" }}>{item.value}</div>
                            </div>
                          ))}
                        </div>
                        {userRiskHistory.length > 0 && (
                          <div>
                            <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", fontFamily: "monospace", marginBottom: "4px" }}>RISK TREND</div>
                            <Sparkline data={userRiskHistory} color={riskColor(score)} height={28} width={280} />
                          </div>
                        )}
                        {userEvents.length > 0 && (
                          <div style={{ marginTop: "10px", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "10px" }}>
                            <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", fontFamily: "monospace", marginBottom: "6px" }}>RECENT ACTIVITY</div>
                            {userEvents.slice(0, 3).map(e => (
                              <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
                                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: riskColor(e.riskScore), flexShrink: 0 }} />
                                  <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)" }}>{e.type}</span>
                                </div>
                                <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.7)", fontFamily: "monospace" }}>{e.amount > 0 ? fmtCurrency(e.amount) : "—"}</span>
                                <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>{timeAgo(e.timestamp)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === "events" && (
              <div>
                <div style={styles.pageHeader}>
                  <h2 style={styles.pageTitle}>Event Stream</h2>
                  <div style={{ display: "flex", gap: "8px" }}>
                    {["all", "flagged", "clear"].map(f => (
                      <button key={f} style={{ ...styles.filterBtn, ...(filterRisk === f ? styles.filterBtnActive : {}) }}
                        onClick={() => setFilterRisk(f)}>
                        {f.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={styles.tableWrap}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        {["Event ID", "User", "Type", "Amount", "Risk Score", "Status", "Device", "Time"].map(h => (
                          <th key={h} style={styles.th}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEvents.slice(0, 50).map(e => (
                        <tr key={e.id} style={{ ...styles.tr, borderLeftColor: riskColor(e.riskScore) }}>
                          <td style={styles.td}><span style={styles.eventId}>{e.id.slice(0, 14)}</span></td>
                          <td style={styles.td}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <div style={{ ...styles.avatar, width: "28px", height: "28px", fontSize: "10px", background: riskColor(e.riskScore) + "22", borderColor: riskColor(e.riskScore) }}>{e.userAvatar}</div>
                              <span style={{ color: "#fff", fontSize: "13px" }}>{e.userName}</span>
                            </div>
                          </td>
                          <td style={styles.td}><span style={styles.typeChip}>{e.type}</span></td>
                          <td style={{ ...styles.td, fontFamily: "monospace", color: "#fff" }}>{e.amount > 0 ? fmtCurrency(e.amount) : "—"}</td>
                          <td style={styles.td}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <div style={{ width: "40px", height: "4px", background: "rgba(255,255,255,0.08)", borderRadius: "2px", overflow: "hidden" }}>
                                <div style={{ width: `${e.riskScore}%`, height: "100%", background: riskColor(e.riskScore) }} />
                              </div>
                              <span style={{ color: riskColor(e.riskScore), fontFamily: "monospace", fontSize: "12px", fontWeight: "700" }}>{e.riskScore}</span>
                            </div>
                          </td>
                          <td style={styles.td}>
                            <span style={{ ...styles.riskChip, background: e.isRisky ? "#ff3b5c22" : "#00e5a022", color: e.isRisky ? "#ff3b5c" : "#00e5a0" }}>
                              {e.isRisky ? "⚡ FLAGGED" : "✓ CLEAR"}
                            </span>
                          </td>
                          <td style={{ ...styles.td, color: "rgba(255,255,255,0.5)", fontSize: "12px" }}>{e.device}</td>
                          <td style={{ ...styles.td, color: "rgba(255,255,255,0.35)", fontSize: "11px", fontFamily: "monospace" }}>{timeAgo(e.timestamp)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredEvents.length === 0 && <div style={styles.emptyState}>Waiting for events...</div>}
                </div>
              </div>
            )}
          </main>
        </div>
      ) : (
        /* ─── MOBILE SIMULATOR ─────────────────────────────────────────────── */
        <div style={styles.mobileSim}>
          <div style={styles.mobileScene}>
            {/* Desktop side panel */}
            <div style={styles.mobilePanelLeft}>
              <div style={styles.panelTitle}>Select User</div>
              {USERS.map(u => (
                <div key={u.id} style={{ ...styles.mobileUserItem, ...(mobileUser.id === u.id ? styles.mobileUserItemActive : {}) }}
                  onClick={() => setMobileUser(u)}>
                  <div style={{ ...styles.miniAvatar, background: riskColor(userScores[u.id] || 50) + "33", borderColor: riskColor(userScores[u.id] || 50) }}>
                    {u.avatar}
                  </div>
                  <div>
                    <div style={{ color: "#fff", fontSize: "13px", fontWeight: "500" }}>{u.name}</div>
                    <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "11px" }}>{u.device}</div>
                  </div>
                  <span style={{ color: riskColor(userScores[u.id] || 50), fontFamily: "monospace", fontSize: "13px", fontWeight: "700", marginLeft: "auto" }}>
                    {userScores[u.id] || 0}
                  </span>
                </div>
              ))}
              <div style={{ marginTop: "24px" }}>
                <div style={styles.panelTitle}>Recent Transmissions</div>
                {events.filter(e => e.userId === mobileUser.id).slice(0, 6).map(e => (
                  <div key={e.id} style={styles.txItem}>
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: riskColor(e.riskScore), flexShrink: 0 }} />
                    <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.6)", flex: 1 }}>{e.type}</span>
                    <span style={{ fontSize: "11px", color: riskColor(e.riskScore), fontFamily: "monospace" }}>{e.riskScore}</span>
                    <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", fontFamily: "monospace" }}>{timeAgo(e.timestamp)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Phone mockup */}
            <div style={styles.phoneMockup}>
              <div style={styles.phoneNotch} />
              <div style={styles.phoneScreen}>
                {mobileScreen === "lock" ? (
                  <div style={styles.lockScreen}>
                    <div style={styles.phoneApp}>
                      <div style={styles.phoneAppLogo}>
                        <svg width="40" height="40" viewBox="0 0 22 22" fill="none">
                          <polygon points="11,2 20,7 20,15 11,20 2,15 2,7" fill="none" stroke="#00e5a0" strokeWidth="1.5" />
                          <circle cx="11" cy="11" r="2.5" fill="#00e5a0" />
                        </svg>
                        <div style={{ color: "#00e5a0", fontFamily: "'Space Mono', monospace", fontWeight: "700", fontSize: "18px" }}>VIGIL</div>
                        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px" }}>NexCorp Banking</div>
                      </div>
                      <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "12px", textAlign: "center" }}>Logging in as</div>
                      <div style={{ color: "#fff", fontWeight: "600", fontSize: "16px", textAlign: "center" }}>{mobileUser.name}</div>
                      <button style={styles.phoneBtn} onClick={doMobileLogin} disabled={mobileLoading}>
                        {mobileLoading ? <span style={styles.spinner} /> : "Authenticate →"}
                      </button>
                      <div style={{ color: "rgba(255,255,255,0.2)", fontSize: "10px", textAlign: "center", fontFamily: "monospace" }}>
                        BIOMETRIC · FACE ID
                      </div>
                    </div>
                  </div>
                ) : mobileScreen === "home" ? (
                  <div style={styles.homeScreen}>
                    <div style={styles.phoneHeader}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div style={{ ...styles.miniAvatar, width: "28px", height: "28px", fontSize: "11px" }}>{mobileUser.avatar}</div>
                        <div>
                          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "10px" }}>Good morning,</div>
                          <div style={{ color: "#fff", fontSize: "13px", fontWeight: "600" }}>{mobileUser.name.split(" ")[0]}</div>
                        </div>
                      </div>
                      <div style={{ ...styles.riskChip, background: riskColor(userScores[mobileUser.id] || 0) + "22", color: riskColor(userScores[mobileUser.id] || 0), fontSize: "10px" }}>
                        Risk: {userScores[mobileUser.id] || 0}
                      </div>
                    </div>

                    <div style={styles.balanceCard}>
                      <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "11px", marginBottom: "4px" }}>Total Balance</div>
                      <div style={{ color: "#fff", fontSize: "28px", fontWeight: "700", fontFamily: "monospace" }}>$84,291.50</div>
                      <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "11px", marginTop: "4px" }}>NexCorp · {mobileUser.device}</div>
                    </div>

                    <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                      <button style={styles.phoneActionBtn} onClick={() => setMobileScreen("transfer")}>↑ Send</button>
                      <button style={styles.phoneActionBtn} onClick={() => setMobileScreen("transfer")}>↓ Receive</button>
                      <button style={styles.phoneActionBtn} onClick={() => setMobileScreen("lock")}>Lock</button>
                    </div>

                    <div style={styles.recentTxs}>
                      <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "11px", fontFamily: "monospace", marginBottom: "8px" }}>RECENT</div>
                      {events.filter(e => e.userId === mobileUser.id).slice(0, 4).map((e, i) => (
                        <div key={e.id} style={styles.phoneTxRow}>
                          <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: riskColor(e.riskScore) + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px" }}>
                            {e.type === "Transfer" ? "↑" : e.type === "Withdrawal" ? "↓" : "◎"}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ color: "#fff", fontSize: "12px" }}>{e.type}</div>
                            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "10px" }}>{timeAgo(e.timestamp)}</div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ color: e.isRisky ? "#ff3b5c" : "#fff", fontFamily: "monospace", fontSize: "12px" }}>
                              {e.amount > 0 ? `$${e.amount.toLocaleString()}` : "—"}
                            </div>
                            {e.isRisky && <div style={{ color: "#ff3b5c", fontSize: "9px", fontFamily: "monospace" }}>FLAGGED</div>}
                          </div>
                        </div>
                      ))}
                      {events.filter(e => e.userId === mobileUser.id).length === 0 && (
                        <div style={{ color: "rgba(255,255,255,0.2)", fontSize: "11px", textAlign: "center", padding: "16px" }}>No activity yet</div>
                      )}
                    </div>
                  </div>
                ) : mobileScreen === "transfer" ? (
                  <div style={styles.transferScreen}>
                    <button style={styles.backBtn} onClick={() => setMobileScreen("home")}>← Back</button>
                    <div style={{ color: "#fff", fontWeight: "700", fontSize: "18px", marginBottom: "20px", fontFamily: "'DM Sans', sans-serif" }}>Send Money</div>
                    <div style={styles.inputGroup}>
                      <label style={styles.inputLabel}>Recipient</label>
                      <input style={styles.phoneInput} value={mobileRecipient} onChange={e => setMobileRecipient(e.target.value)} placeholder="Name or Account" />
                    </div>
                    <div style={styles.inputGroup}>
                      <label style={styles.inputLabel}>Amount (USD)</label>
                      <div style={{ position: "relative" }}>
                        <span style={styles.currencyPrefix}>$</span>
                        <input style={{ ...styles.phoneInput, paddingLeft: "24px" }} value={mobileAmount} onChange={e => setMobileAmount(e.target.value)} placeholder="0.00" />
                      </div>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "16px" }}>
                      {["500", "1,000", "5,000", "25,000"].map(amt => (
                        <button key={amt} style={styles.amtPreset} onClick={() => setMobileAmount(amt)}>${amt}</button>
                      ))}
                    </div>
                    <button style={styles.phoneBtn} onClick={() => sendMobileTransaction(false)} disabled={mobileLoading}>
                      {mobileLoading ? <><span style={styles.spinner} /> Sending...</> : "Send →"}
                    </button>
                    <button style={{ ...styles.phoneBtn, background: "rgba(255,59,92,0.15)", color: "#ff3b5c", border: "1px solid #ff3b5c44", marginTop: "8px" }}
                      onClick={() => sendMobileTransaction(true)} disabled={mobileLoading}>
                      ⚡ Trigger Risk Event
                    </button>
                    <div style={{ color: "rgba(255,255,255,0.2)", fontSize: "9px", textAlign: "center", fontFamily: "monospace", marginTop: "8px" }}>
                      SILENTLY MONITORED BY VIGIL
                    </div>
                  </div>
                ) : mobileScreen === "receipt" && mobileSent ? (
                  <div style={styles.receiptScreen}>
                    <div style={{ textAlign: "center", marginBottom: "20px" }}>
                      <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: mobileSent.isRisky ? "#ff3b5c22" : "#00e5a022", border: `2px solid ${mobileSent.isRisky ? "#ff3b5c" : "#00e5a0"}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", fontSize: "24px" }}>
                        {mobileSent.isRisky ? "⚠" : "✓"}
                      </div>
                      <div style={{ color: mobileSent.isRisky ? "#ff3b5c" : "#00e5a0", fontWeight: "700", fontSize: "16px" }}>
                        {mobileSent.isRisky ? "Transaction Flagged" : "Transaction Complete"}
                      </div>
                      <div style={{ color: "#fff", fontSize: "28px", fontWeight: "700", fontFamily: "monospace", marginTop: "8px" }}>
                        ${mobileSent.amount.toLocaleString()}
                      </div>
                      <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px" }}>to {mobileRecipient}</div>
                    </div>

                    {mobileSent.isRisky && (
                      <div style={{ background: "#ff3b5c11", border: "1px solid #ff3b5c33", borderRadius: "10px", padding: "12px", marginBottom: "16px" }}>
                        <div style={{ color: "#ff3b5c", fontSize: "11px", fontFamily: "monospace", marginBottom: "4px" }}>⚡ VIGIL ALERT SENT</div>
                        <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "11px" }}>{mobileSent.reason}</div>
                        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "10px", marginTop: "4px", fontFamily: "monospace" }}>
                          Risk Score: {mobileSent.riskScore} · {riskLabel(mobileSent.riskScore)}
                        </div>
                      </div>
                    )}

                    <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: "10px", padding: "12px", marginBottom: "16px" }}>
                      {[
                        { k: "Event ID", v: mobileSent.id.slice(0, 18) },
                        { k: "Device", v: mobileUser.device },
                        { k: "Location", v: mobileUser.location },
                        { k: "Time", v: mobileSent.timestamp.toLocaleTimeString() },
                      ].map(item => (
                        <div key={item.k} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                          <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "11px" }}>{item.k}</span>
                          <span style={{ color: "rgba(255,255,255,0.7)", fontSize: "11px", fontFamily: "monospace" }}>{item.v}</span>
                        </div>
                      ))}
                    </div>

                    <button style={styles.phoneBtn} onClick={() => setMobileScreen("home")}>Back to Home</button>
                  </div>
                ) : null}
              </div>
              <div style={styles.phoneHomeBar} />
            </div>

            {/* Right panel - Live feed */}
            <div style={styles.mobilePanelRight}>
              <div style={styles.panelTitle}>
                <span style={{ ...styles.liveDot, opacity: liveIndicator ? 1 : 0.3 }} />
                Live Vigil Feed
              </div>
              <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", fontFamily: "monospace", marginBottom: "12px" }}>
                All events silently transmitted
              </div>
              {events.slice(0, 15).map((e, i) => (
                <div key={e.id} style={{ ...styles.feedItem, borderLeftColor: riskColor(e.riskScore) }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ color: riskColor(e.riskScore), fontSize: "9px", fontFamily: "monospace", fontWeight: "700" }}>
                        {riskLabel(e.riskScore)}
                      </span>
                      <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "10px" }}>{e.userName.split(" ")[0]}</span>
                    </div>
                    <span style={{ color: "rgba(255,255,255,0.2)", fontSize: "9px", fontFamily: "monospace" }}>{timeAgo(e.timestamp)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "2px" }}>
                    <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "11px" }}>{e.type}{e.amount > 0 ? ` · ${fmtCurrency(e.amount)}` : ""}</span>
                    <span style={{ color: riskColor(e.riskScore), fontFamily: "monospace", fontSize: "12px", fontWeight: "700" }}>{e.riskScore}</span>
                  </div>
                  {e.isRisky && e.reason && (
                    <div style={{ color: "#ff3b5c", fontSize: "10px", marginTop: "2px" }}>⚡ {e.reason}</div>
                  )}
                </div>
              ))}
              {events.length === 0 && <div style={styles.emptyState}>Waiting for events...</div>}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600;700&display=swap');
        @keyframes slideIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        * { box-sizing: border-box; margin: 0; padding: 0; scrollbar-width: thin; scrollbar-color: rgba(0,229,160,0.2) transparent; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-thumb { background: rgba(0,229,160,0.2); border-radius: 2px; }
        body { background: #080b14; }
      `}</style>
    </div>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
function getStyles() {
  return {
    root: {
      minHeight: "100vh",
      background: "#080b14",
      color: "#fff",
      fontFamily: "'DM Sans', sans-serif",
      position: "relative",
      overflow: "hidden",
    },
    bgGrid: {
      position: "fixed",
      inset: 0,
      backgroundImage: `linear-gradient(rgba(0,229,160,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,229,160,0.03) 1px, transparent 1px)`,
      backgroundSize: "40px 40px",
      pointerEvents: "none",
      zIndex: 0,
    },
    nav: {
      position: "sticky",
      top: 0,
      zIndex: 100,
      height: "52px",
      background: "rgba(8,11,20,0.92)",
      backdropFilter: "blur(20px)",
      borderBottom: "1px solid rgba(0,229,160,0.1)",
      display: "flex",
      alignItems: "center",
      padding: "0 20px",
      gap: "20px",
    },
    navLeft: { display: "flex", alignItems: "center" },
    logo: { display: "flex", alignItems: "center", gap: "8px", cursor: "default" },
    logoText: {
      fontFamily: "'Space Mono', monospace",
      fontWeight: "700",
      fontSize: "16px",
      color: "#00e5a0",
      letterSpacing: "3px",
    },
    navTabs: { display: "flex", gap: "4px", flex: 1, justifyContent: "center" },
    navTab: {
      background: "transparent",
      border: "1px solid transparent",
      color: "rgba(255,255,255,0.4)",
      padding: "6px 16px",
      borderRadius: "6px",
      cursor: "pointer",
      fontSize: "13px",
      fontFamily: "'DM Sans', sans-serif",
      display: "flex",
      alignItems: "center",
      gap: "6px",
      transition: "all 0.2s",
    },
    navTabActive: {
      background: "rgba(0,229,160,0.1)",
      border: "1px solid rgba(0,229,160,0.2)",
      color: "#00e5a0",
    },
    navRight: { display: "flex", alignItems: "center", gap: "10px", marginLeft: "auto" },
    liveChip: {
      display: "flex",
      alignItems: "center",
      gap: "6px",
      background: "rgba(0,229,160,0.1)",
      border: "1px solid rgba(0,229,160,0.2)",
      borderRadius: "20px",
      padding: "4px 10px",
      fontSize: "11px",
      color: "#00e5a0",
      fontFamily: "'Space Mono', monospace",
      letterSpacing: "1px",
    },
    liveDot: {
      width: "6px",
      height: "6px",
      borderRadius: "50%",
      background: "#00e5a0",
      transition: "opacity 0.3s",
    },
    alertBadge: {
      background: "rgba(255,59,92,0.15)",
      border: "1px solid rgba(255,59,92,0.3)",
      borderRadius: "20px",
      padding: "4px 12px",
      fontSize: "11px",
      color: "#ff3b5c",
      cursor: "pointer",
      fontFamily: "'Space Mono', monospace",
    },
    dashLayout: {
      display: "flex",
      height: "calc(100vh - 52px)",
      position: "relative",
      zIndex: 1,
    },
    sidebar: {
      background: "rgba(12,15,25,0.95)",
      borderRight: "1px solid rgba(0,229,160,0.08)",
      padding: "12px 0",
      flexShrink: 0,
      overflowY: "auto",
      overflowX: "hidden",
      transition: "width 0.25s ease",
      display: "flex",
      flexDirection: "column",
    },
    sidebarToggle: {
      background: "transparent",
      border: "none",
      color: "rgba(255,255,255,0.25)",
      cursor: "pointer",
      padding: "8px 16px",
      fontSize: "12px",
      textAlign: "right",
      width: "100%",
    },
    sidebarItem: {
      display: "flex",
      alignItems: "center",
      gap: "10px",
      padding: "10px 16px",
      cursor: "pointer",
      border: "none",
      background: "transparent",
      color: "rgba(255,255,255,0.4)",
      width: "100%",
      textAlign: "left",
      transition: "all 0.15s",
      borderLeft: "2px solid transparent",
    },
    sidebarItemActive: {
      background: "rgba(0,229,160,0.08)",
      color: "#00e5a0",
      borderLeftColor: "#00e5a0",
    },
    sidebarIcon: { fontSize: "16px", flexShrink: 0 },
    sidebarLabel: { fontSize: "13px", fontWeight: "500", whiteSpace: "nowrap" },
    sidebarBadge: {
      marginLeft: "auto",
      background: "#ff3b5c",
      color: "#fff",
      borderRadius: "10px",
      padding: "1px 6px",
      fontSize: "10px",
      fontWeight: "700",
    },
    sidebarUsers: { padding: "8px 0", marginTop: "8px", borderTop: "1px solid rgba(255,255,255,0.05)" },
    sidebarSectionLabel: {
      fontSize: "9px",
      color: "rgba(255,255,255,0.2)",
      fontFamily: "'Space Mono', monospace",
      letterSpacing: "1px",
      padding: "8px 16px 4px",
    },
    sidebarUser: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      padding: "8px 12px",
      cursor: "pointer",
      transition: "background 0.15s",
    },
    miniAvatar: {
      width: "32px",
      height: "32px",
      borderRadius: "8px",
      border: "1px solid rgba(0,229,160,0.3)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "11px",
      fontWeight: "700",
      fontFamily: "'Space Mono', monospace",
      flexShrink: 0,
      color: "#fff",
    },
    sidebarUserInfo: { flex: 1, minWidth: 0 },
    sidebarUserName: { fontSize: "12px", color: "rgba(255,255,255,0.7)", display: "block", marginBottom: "3px" },
    miniRiskBar: { height: "3px", background: "rgba(255,255,255,0.08)", borderRadius: "2px", overflow: "hidden" },
    miniRiskFill: { height: "100%", borderRadius: "2px", transition: "width 0.6s ease, background 0.4s ease" },
    main: {
      flex: 1,
      overflow: "auto",
      padding: "20px",
    },
    overviewGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: "14px",
    },
    statCard: {
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: "12px",
      padding: "18px",
      backdropFilter: "blur(10px)",
      transition: "border-color 0.2s",
    },
    statCardHeader: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" },
    statIcon: { fontSize: "16px" },
    statLabel: { fontSize: "11px", color: "rgba(255,255,255,0.35)", fontFamily: "'Space Mono', monospace", letterSpacing: "0.5px" },
    statValue: { display: "flex", alignItems: "baseline", gap: "4px" },
    card: {
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: "12px",
      padding: "18px",
    },
    cardTitle: {
      fontSize: "11px",
      color: "rgba(255,255,255,0.35)",
      fontFamily: "'Space Mono', monospace",
      letterSpacing: "0.5px",
      marginBottom: "12px",
    },
    alertRow: {
      display: "flex",
      alignItems: "center",
      gap: "12px",
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.06)",
      borderLeft: "3px solid",
      borderRadius: "8px",
      padding: "10px 12px",
      animation: "slideIn 0.3s ease",
    },
    alertCard: {
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderLeft: "3px solid",
      borderRadius: "12px",
      padding: "16px",
    },
    alertCardFooter: {
      display: "flex",
      justifyContent: "space-between",
      marginTop: "12px",
      paddingTop: "10px",
      borderTop: "1px solid rgba(255,255,255,0.05)",
    },
    avatar: {
      width: "36px",
      height: "36px",
      borderRadius: "9px",
      border: "1px solid",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "12px",
      fontWeight: "700",
      fontFamily: "'Space Mono', monospace",
      flexShrink: 0,
      color: "#fff",
    },
    alertName: { color: "#fff", fontSize: "13px", fontWeight: "600" },
    alertDetail: { color: "rgba(255,255,255,0.4)", fontSize: "11px", marginTop: "2px" },
    riskChip: {
      fontSize: "10px",
      fontFamily: "'Space Mono', monospace",
      padding: "2px 8px",
      borderRadius: "4px",
      fontWeight: "700",
      letterSpacing: "0.5px",
    },
    timeAgo: { color: "rgba(255,255,255,0.25)", fontSize: "11px", fontFamily: "monospace", whiteSpace: "nowrap" },
    metaItem: { display: "flex", flexDirection: "column", gap: "1px" },
    metaKey: { fontSize: "9px", color: "rgba(255,255,255,0.25)", fontFamily: "monospace", textTransform: "uppercase" },
    metaVal: { fontSize: "12px", color: "rgba(255,255,255,0.7)" },
    viewAllBtn: { background: "transparent", border: "none", color: "rgba(0,229,160,0.6)", cursor: "pointer", fontSize: "11px", fontFamily: "'DM Sans', sans-serif" },
    pageHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" },
    pageTitle: { fontSize: "20px", fontWeight: "700", color: "#fff", fontFamily: "'DM Sans', sans-serif" },
    userCard: {
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: "14px",
      padding: "18px",
      cursor: "pointer",
      transition: "all 0.2s",
    },
    userCardSelected: {
      border: "1px solid rgba(0,229,160,0.3)",
      background: "rgba(0,229,160,0.05)",
    },
    tableWrap: { overflowX: "auto", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.07)" },
    table: { width: "100%", borderCollapse: "collapse", minWidth: "800px" },
    th: {
      padding: "10px 16px",
      textAlign: "left",
      fontSize: "10px",
      color: "rgba(255,255,255,0.3)",
      fontFamily: "'Space Mono', monospace",
      letterSpacing: "0.5px",
      background: "rgba(255,255,255,0.03)",
      borderBottom: "1px solid rgba(255,255,255,0.07)",
    },
    tr: {
      borderLeft: "2px solid transparent",
      borderBottom: "1px solid rgba(255,255,255,0.04)",
      transition: "background 0.15s",
    },
    td: { padding: "10px 16px", verticalAlign: "middle" },
    eventId: { fontFamily: "monospace", fontSize: "11px", color: "rgba(255,255,255,0.3)" },
    typeChip: {
      background: "rgba(123,140,255,0.12)",
      color: "#7b8cff",
      fontSize: "10px",
      fontFamily: "monospace",
      padding: "3px 8px",
      borderRadius: "4px",
    },
    filterBtn: {
      background: "transparent",
      border: "1px solid rgba(255,255,255,0.1)",
      color: "rgba(255,255,255,0.4)",
      padding: "5px 12px",
      borderRadius: "6px",
      cursor: "pointer",
      fontSize: "10px",
      fontFamily: "'Space Mono', monospace",
    },
    filterBtnActive: {
      background: "rgba(0,229,160,0.1)",
      borderColor: "rgba(0,229,160,0.3)",
      color: "#00e5a0",
    },
    emptyState: {
      textAlign: "center",
      color: "rgba(255,255,255,0.2)",
      fontSize: "13px",
      padding: "40px",
      fontFamily: "monospace",
    },
    // Mobile
    mobileSim: {
      height: "calc(100vh - 52px)",
      display: "flex",
      alignItems: "stretch",
      position: "relative",
      zIndex: 1,
    },
    mobileScene: {
      display: "flex",
      width: "100%",
      gap: "0",
    },
    mobilePanelLeft: {
      width: "240px",
      background: "rgba(12,15,25,0.95)",
      borderRight: "1px solid rgba(255,255,255,0.06)",
      padding: "20px 16px",
      overflowY: "auto",
      flexShrink: 0,
    },
    mobilePanelRight: {
      flex: 1,
      background: "rgba(8,11,20,0.8)",
      padding: "20px",
      overflowY: "auto",
    },
    panelTitle: {
      fontSize: "10px",
      color: "rgba(255,255,255,0.3)",
      fontFamily: "'Space Mono', monospace",
      letterSpacing: "1px",
      marginBottom: "12px",
      display: "flex",
      alignItems: "center",
      gap: "8px",
    },
    mobileUserItem: {
      display: "flex",
      alignItems: "center",
      gap: "10px",
      padding: "10px 10px",
      borderRadius: "10px",
      cursor: "pointer",
      marginBottom: "4px",
      border: "1px solid transparent",
      transition: "all 0.15s",
    },
    mobileUserItemActive: {
      background: "rgba(0,229,160,0.08)",
      border: "1px solid rgba(0,229,160,0.2)",
    },
    txItem: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      padding: "6px 0",
      borderBottom: "1px solid rgba(255,255,255,0.04)",
    },
    feedItem: {
      padding: "8px 10px",
      borderLeft: "2px solid",
      background: "rgba(255,255,255,0.02)",
      borderRadius: "0 6px 6px 0",
      marginBottom: "6px",
      animation: "slideIn 0.3s ease",
    },
    phoneMockup: {
      width: "320px",
      margin: "0 auto",
      background: "#0d1117",
      borderRadius: "40px",
      border: "2px solid rgba(255,255,255,0.1)",
      boxShadow: "0 0 60px rgba(0,229,160,0.08), 0 40px 80px rgba(0,0,0,0.6)",
      overflow: "hidden",
      flexShrink: 0,
      alignSelf: "center",
      position: "relative",
      height: "640px",
      display: "flex",
      flexDirection: "column",
    },
    phoneNotch: {
      width: "100px",
      height: "28px",
      background: "#0d1117",
      borderRadius: "0 0 16px 16px",
      margin: "0 auto",
      flexShrink: 0,
      borderBottom: "1px solid rgba(255,255,255,0.05)",
    },
    phoneScreen: { flex: 1, overflowY: "auto", overflowX: "hidden", padding: "16px" },
    phoneHomeBar: {
      width: "100px",
      height: "4px",
      background: "rgba(255,255,255,0.2)",
      borderRadius: "2px",
      margin: "8px auto",
    },
    lockScreen: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "500px",
    },
    phoneApp: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "16px",
      width: "100%",
    },
    phoneAppLogo: { display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" },
    homeScreen: { paddingTop: "4px" },
    phoneHeader: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "16px",
    },
    balanceCard: {
      background: "linear-gradient(135deg, rgba(0,229,160,0.15), rgba(123,140,255,0.1))",
      border: "1px solid rgba(0,229,160,0.2)",
      borderRadius: "16px",
      padding: "20px",
      marginBottom: "14px",
    },
    phoneActionBtn: {
      flex: 1,
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: "10px",
      color: "#fff",
      padding: "10px",
      cursor: "pointer",
      fontSize: "12px",
      fontFamily: "'DM Sans', sans-serif",
    },
    recentTxs: {
      background: "rgba(255,255,255,0.03)",
      borderRadius: "14px",
      padding: "14px",
    },
    phoneTxRow: {
      display: "flex",
      alignItems: "center",
      gap: "10px",
      padding: "8px 0",
      borderBottom: "1px solid rgba(255,255,255,0.05)",
    },
    transferScreen: { paddingTop: "4px" },
    backBtn: {
      background: "transparent",
      border: "none",
      color: "rgba(255,255,255,0.5)",
      cursor: "pointer",
      fontSize: "12px",
      padding: "0",
      marginBottom: "16px",
      fontFamily: "'DM Sans', sans-serif",
    },
    inputGroup: { marginBottom: "14px" },
    inputLabel: { fontSize: "11px", color: "rgba(255,255,255,0.4)", display: "block", marginBottom: "6px", fontFamily: "'Space Mono', monospace" },
    phoneInput: {
      width: "100%",
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: "10px",
      color: "#fff",
      padding: "12px 14px",
      fontSize: "14px",
      fontFamily: "'DM Sans', sans-serif",
      outline: "none",
    },
    currencyPrefix: { position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.4)", fontSize: "14px" },
    amtPreset: {
      background: "rgba(255,255,255,0.05)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: "8px",
      color: "rgba(255,255,255,0.7)",
      padding: "6px 10px",
      cursor: "pointer",
      fontSize: "12px",
      fontFamily: "monospace",
    },
    phoneBtn: {
      width: "100%",
      background: "rgba(0,229,160,0.15)",
      border: "1px solid rgba(0,229,160,0.3)",
      borderRadius: "12px",
      color: "#00e5a0",
      padding: "14px",
      cursor: "pointer",
      fontSize: "14px",
      fontWeight: "600",
      fontFamily: "'DM Sans', sans-serif",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "8px",
    },
    spinner: {
      width: "14px",
      height: "14px",
      border: "2px solid rgba(0,229,160,0.3)",
      borderTop: "2px solid #00e5a0",
      borderRadius: "50%",
      display: "inline-block",
      animation: "spin 0.8s linear infinite",
    },
    receiptScreen: { paddingTop: "4px" },
  };
}
