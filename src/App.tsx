import { useState, useEffect, Component } from "react";

// Error boundary to catch crashes
class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) return (
      <div style={{ padding:40, fontFamily:"sans-serif", background:"#fff1f0", minHeight:"100vh" }}>
        <h2 style={{ color:"#c00" }}>⚠️ App Error</h2>
        <pre style={{ fontSize:12, background:"#fff", padding:16, borderRadius:8, overflow:"auto" }}>
          {this.state.error.toString()}
          {this.state.error.stack}
        </pre>
        <button onClick={() => window.location.reload()} style={{ marginTop:16, padding:"10px 20px", fontSize:16, cursor:"pointer" }}>Reload</button>
      </div>
    );
    return this.props.children;
  }
}

// ── Supabase Client ───────────────────────────────────────────────────────────
const SUPABASE_URL = "https://mitzwognijayzgqvexcl.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pdHp3b2duaWpheXpncXZleGNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5NzczNTAsImV4cCI6MjA5MjU1MzM1MH0.ueMDxAzg8kyEK1f67d02I55OPSpL66zmOEGxwxrlZJc";

async function sb(table, method="GET", body=null, query="") {
  const url = `${SUPABASE_URL}/rest/v1/${table}${query}`;
  const headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
    "Prefer": method === "POST" ? "return=representation" : "return=representation",
  };
  if (method === "PATCH" || method === "DELETE") headers["Prefer"] = "return=representation";
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : null });
  if (!res.ok) { console.error("Supabase error:", await res.text()); return null; }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// Supabase helpers
const SB = {
  // Events
  getEvents:   () => sb("cal_events", "GET", null, "?order=created_at"),
  addEvent:    (ev) => sb("cal_events", "POST", {
    title: ev.title, member_ids: ev.memberIds, start_h: ev.startH, dur: ev.dur,
    recurrence: ev.recurrence || "weekly", dows: ev.dows || [ev.dow||1],
    specific_date: ev.specificDate || null,
  }),
  deleteEvent: (id) => sb(`cal_events?id=eq.${id}`, "DELETE"),

  // Chore assignments
  getChores:   () => sb("chore_assignments", "GET", null, "?order=chore_label"),
  upsertChore: (label, memberIds) => sb("chore_assignments", "POST",
    { chore_label: label, member_ids: memberIds },
    "?on_conflict=chore_label"
  ),

  // Tasks (template tasks per member/section)
  getTasks:    () => sb("tasks", "GET", null, "?order=sort_order"),
  addTask:     (memberId, section, label, recurrence="daily", dows=[1,2,3,4,5], specificDate=null) => sb("tasks", "POST", { member_id: memberId, section, label, recurrence, dows, specific_date: specificDate||null }),
  deleteTask:  (id) => sb(`tasks?id=eq.${id}`, "DELETE"),

  // Task completions
  getCompletions: (date) => sb("task_completions", "GET", null, `?completed_date=eq.${date}`),
  addCompletion:  (label, memberId, date) => sb("task_completions", "POST",
    { task_label: label, member_id: memberId, completed_date: date },
    "?on_conflict=task_label,member_id,completed_date"
  ),
  deleteCompletion: (label, memberId, date) => sb(
    `task_completions?task_label=eq.${encodeURIComponent(label)}&member_id=eq.${memberId}&completed_date=eq.${date}`,
    "DELETE"
  ),

  // Goals
  getGoals:    () => sb("goals", "GET", null, "?order=sort_order"),
  addGoal:     (memberId, quadrant, label) => sb("goals", "POST", { member_id: memberId, quadrant, label }),
  deleteGoal:  (id) => sb(`goals?id=eq.${id}`, "DELETE"),

  // Streaks
  getStreaks:  () => sb("streaks", "GET"),
  upsertStreak: (memberId, current, longest, lastDate) => sb("streaks", "POST",
    { member_id: memberId, current_streak: current, longest_streak: longest, last_rainbow_date: lastDate },
    "?on_conflict=member_id"
  ),
  // Rainbow days log
  getRainbowDays: () => sb("rainbow_days", "GET", null, "?order=date.desc&limit=60"),
  logRainbowDay: (memberId, date) => sb("rainbow_days", "POST",
    { member_id: memberId, date },
    "?on_conflict=member_id,date"
  ),
};

// Convert DB rows to app format
function dbEventsToApp(rows) {
  return (rows||[]).map(r => ({
    id: r.id, title: r.title, memberIds: r.member_ids,
    startH: r.start_h, dur: r.dur, recurrence: r.recurrence,
    dows: r.dows, specificDate: r.specific_date, dow: (r.dows||[1])[0],
  }));
}
function dbTasksToApp(rows) {
  const result = {};
  (rows||[]).forEach(r => {
    if (!result[r.member_id]) result[r.member_id] = { learn:[], exercise:[], contribute:[], goals:[] };
    if (result[r.member_id][r.section]) result[r.member_id][r.section].push({
      id: r.id, label: r.label, done: false,
      recurrence: r.recurrence || "daily",
      // Only set dows for weekly tasks; daily tasks show every day
      dows: (r.recurrence === "weekly" && r.dows) ? r.dows : null,
      specificDate: r.specific_date || null,
    });
  });
  return result;
}
function dbGoalsToApp(rows) {
  const result = {};
  (rows||[]).forEach(r => {
    if (!result[r.member_id]) result[r.member_id] = { spiritual:[], social:[], physical:[], intellectual:[] };
    if (result[r.member_id][r.quadrant]) result[r.member_id][r.quadrant].push(r.label);
  });
  return result;
}
function dbChoresToApp(rows) {
  const result = {};
  (rows||[]).forEach(r => { result[r.chore_label] = r.member_ids; });
  return result;
}

const FONT_URL =
  "https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Nunito:wght@400;600;700;800;900&family=Playfair+Display:wght@700&display=swap";

const T = {
  bg: "#F7F5F0",
  white: "#FFFFFF",
  stone: "#EDEAE3",
  border: "#DDD9D0",
  text: "#1C1916",
  sub: "#6B6258",
  muted: "#B0A89E",
  navH: 72,
};

const RAINBOW_GRAD = "linear-gradient(135deg, #FF6B6B 0%, #FF9F45 20%, #FFD93D 40%, #6BCB77 60%, #4D96FF 80%, #C77DFF 100%)";
const RAINBOW_SOFT = "linear-gradient(135deg, #FFE5E5 0%, #FFF0E0 20%, #FFFBE0 40%, #E5F7E8 60%, #E0EDFF 80%, #F3E5FF 100%)";

const FAMILY_INIT = [
  { id:"dad",   name:"Dad",   emoji:"👔", color:"#3B6FA0", light:"#D6E8F7", defaultOn:false },
  { id:"mom",   name:"Mom",   emoji:"🌿", color:"#7C5C9E", light:"#EDE5F7", defaultOn:false },
  { id:"bazel", name:"Bazel", emoji:"🌟", color:"#2D7A56", light:"#D5EEE2", defaultOn:true  },
  { id:"okrie", name:"Okrie", emoji:"💛", color:"#C2547A", light:"#F7E0EB", defaultOn:true  },
  { id:"saya",  name:"Saya",  emoji:"🦋", color:"#D4732A", light:"#FDEEDE", defaultOn:true  },
];

const SECTIONS = [
  { id:"learn",      label:"Learn",      icon:"📖", color:"#4D96FF", light:"#E0EDFF", grad:"linear-gradient(135deg,#4D96FF,#74AFFF)" },
  { id:"exercise",   label:"Exercise",   icon:"💪", color:"#6BCB77", light:"#E5F7E8", grad:"linear-gradient(135deg,#6BCB77,#8FD98A)" },
  { id:"contribute", label:"Contribute", icon:"🤝", color:"#FF9F45", light:"#FFF0E0", grad:"linear-gradient(135deg,#FF9F45,#FFB86C)" },
  { id:"goals",      label:"Goals",      icon:"🎯", color:"#C77DFF", light:"#F3E5FF", grad:"linear-gradient(135deg,#C77DFF,#D99FFF)" },
];

// Quadrant colors matching the image: blue top-left, orange top-right, pink/red bottom-left, green bottom-right
const QUAD = [
  { id:"spiritual",    label:"Spiritual",    icon:"✝️",  color:"#4D96FF", pos:"top-left"     },
  { id:"social",       label:"Social",       icon:"🤝",  color:"#FF9F45", pos:"top-right"    },
  { id:"physical",     label:"Physical",     icon:"💪",  color:"#FF6B6B", pos:"bottom-left"  },
  { id:"intellectual", label:"Intellectual", icon:"🧠",  color:"#6BCB77", pos:"bottom-right" },
];

const EMPTY_MEMBER_TASKS = () => ({
  learn: [], exercise: [], contribute: [], goals: []
});
const INIT_TASKS = {
  dad:   EMPTY_MEMBER_TASKS(),
  mom:   EMPTY_MEMBER_TASKS(),
  bazel: EMPTY_MEMBER_TASKS(),
  okrie: EMPTY_MEMBER_TASKS(),
  saya:  EMPTY_MEMBER_TASKS(),
};

const INIT_GOALS = {
  dad:   { spiritual:[], social:[], physical:[], intellectual:[] },
  mom:   { spiritual:[], social:[], physical:[], intellectual:[] },
  bazel: { spiritual:[], social:[], physical:[], intellectual:[] },
  okrie: { spiritual:[], social:[], physical:[], intellectual:[] },
  saya:  { spiritual:[], social:[], physical:[], intellectual:[] },
};

const INIT_STREAKS  = { dad:0, mom:0, bazel:0, okrie:0, saya:0 };
const INIT_WEEK_PTS = { dad:0, mom:0, bazel:0, okrie:0, saya:0 };

// ── Chore Schedule Data ───────────────────────────────────────────────────────
// Daily chores: auto-assigned to ALL family members every day
const DAILY_CHORES_ALL = [
  "Make bed",
  "Pick up bedroom",
  "Clean bathroom counters",
];

// Daily chores: individually assigned (stored in CHORE_ASSIGNMENTS)
const DAILY_CHORES_INDIVIDUAL = [
  "Wash dishes",
  "Unload dishwasher",
  "Clean kitchen countertop",
  "Clean kitchen tabletop",
  "Clean kitchen stovetop",
  "Pick up family room",
];

// Weekly chores by day of week (0=Sun, 1=Mon, ... 6=Sat)
const WEEKLY_CHORES = {
  0: ["Wash bedsheets","Wash towels","Do laundry","Dust bedroom","Vacuum bedroom","Meal prep"],
  1: ["Clean tub","Clean bathroom sink","Clean mirror","Clean toilet","Sweep bathroom","Mop bathroom","Empty trash"],
  2: ["Wipe appliances","Clean cupboard","Clean stove","Clean sink","Vacuum kitchen","Mop kitchen","Empty trash"],
  3: ["Take out trash","Clean desks","Dust workspace","Vacuum workspace","Push in chairs","Organize supplies"],
  4: ["Tidy pantry","Vacuum family room","Vacuum couches","De-clutter closet","Clean under couch","Do laundry"],
  5: ["Pick up mud room","Vacuum hallway","Mop hallway","Clean fridge","De-clutter laundry","Vacuum laundry","Mop laundry"],
  6: ["De-clutter car","Vacuum car","Pick up media room","Vacuum media room","Vacuum couch","Clean under couch","De-clutter closet"],
};

const MONTHLY_CHORES = [
  "Deep clean fridge","Clean out pantry","Replace air filters","Clean walls",
  "Wipe doors, knobs, lightswitches","Dust fans & vents","De-clutter mudroom",
];

const QUARTERLY_CHORES = [
  "Dust blinds","Deep clean oven","Deep clean dishwasher","Deep clean washer/dryer","Clean outdoor vents",
];

const SEMI_ANNUAL_CHORES = [
  "Wash windows","Clean carpet","Refresh & de-clutter decor","Inspect & clean vents","Clean porch","Clean baseboards",
];

const ANNUAL_CHORES = [
  "Clear out storage","Reassess belongings","Replace bulbs","Test smoke alarms",
  "Scrub walls","Clean out freezer","Clean out gutter","Wash curtains",
];

// CHORE_ASSIGNMENTS: { choreLabel: [memberId, ...] }
// Stored in state, edited in Admin
const INIT_CHORE_ASSIGNMENTS = {};

// Helper: get chores for a specific date
function getChoresForDate(date, choreAssignments) {
  const dow = date.getDay(); // 0=Sun
  const day = date.getDate();
  const month = date.getMonth();

  // Is it the 1st Thursday of the month?
  function isFirstThursday(d) {
    return d.getDay() === 4 && d.getDate() <= 7;
  }
  // Is it the 1st Thursday of a quarter? (Jan, Apr, Jul, Oct)
  function isFirstThursdayOfQuarter(d) {
    return isFirstThursday(d) && [0,3,6,9].includes(d.getMonth());
  }
  // Is it the 1st Thursday of semi-annual? (Jan, Jul)
  function isFirstThursdayOfSemiAnnual(d) {
    return isFirstThursday(d) && [0,6].includes(d.getMonth());
  }
  // Is it Jan 1st Thursday (annual)?
  function isFirstThursdayOfYear(d) {
    return isFirstThursday(d) && d.getMonth() === 0;
  }

  let allChores = [];

  // Always add daily-all chores
  DAILY_CHORES_ALL.forEach(c => allChores.push({ label:c, assignedTo:"all" }));

  // Add weekly chores for this day
  (WEEKLY_CHORES[dow] || []).forEach(c => allChores.push({ label:c, assignedTo: choreAssignments[c] || [] }));

  // Add daily-individual chores
  DAILY_CHORES_INDIVIDUAL.forEach(c => allChores.push({ label:c, assignedTo: choreAssignments[c] || [] }));

  // Monthly
  if (isFirstThursday(date)) {
    MONTHLY_CHORES.forEach(c => allChores.push({ label:c, assignedTo: choreAssignments[c] || [], freq:"monthly" }));
  }

  // Quarterly
  if (isFirstThursdayOfQuarter(date)) {
    QUARTERLY_CHORES.forEach(c => allChores.push({ label:c, assignedTo: choreAssignments[c] || [], freq:"quarterly" }));
  }

  // Semi-annual
  if (isFirstThursdayOfSemiAnnual(date)) {
    SEMI_ANNUAL_CHORES.forEach(c => allChores.push({ label:c, assignedTo: choreAssignments[c] || [], freq:"semi-annual" }));
  }

  // Annual
  if (isFirstThursdayOfYear(date)) {
    ANNUAL_CHORES.forEach(c => allChores.push({ label:c, assignedTo: choreAssignments[c] || [], freq:"annual" }));
  }

  return allChores;
}

// Build contribute tasks for each member on a given date
function getContributeTasksForMember(memberId, date, choreAssignments) {
  const allChores = getChoresForDate(date, choreAssignments);
  return allChores
    .filter(c => c.assignedTo === "all" || (Array.isArray(c.assignedTo) && c.assignedTo.includes(memberId)))
    .map((c, i) => ({ id: i+1, label: c.label, done: false, freq: c.freq || "daily" }));
}



// Use real current date in Mountain Time
function getMountainToday() {
  const now = new Date();
  const mt = new Date(now.toLocaleString('en-US', { timeZone: 'America/Denver' }));
  return new Date(mt.getFullYear(), mt.getMonth(), mt.getDate());
}
const TODAY_DATE = getMountainToday();
const DAYS_SHORT  = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTHS      = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function getWeekDates(anchor) {
  const d = new Date(anchor);
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return Array.from({ length:7 }, (_, i) => { const dd=new Date(monday); dd.setDate(monday.getDate()+i); return dd; });
}

function sectionDone(tasks, secId) {
  const items = tasks[secId] || [];
  return items.length > 0 && items.every(t => t.done);
}
function allSectionsDone(tasks) { return SECTIONS.every(s => sectionDone(tasks, s.id)); }

function stripeStyle(colors) {
  if (colors.length < 2) return { background: colors[0] + "DD" };
  const size = 12;
  const sw = size / colors.length;
  const stops = colors.map((c,i) => `${c} ${(i*sw/size*100).toFixed(1)}%, ${c} ${((i+1)*sw/size*100).toFixed(1)}%`).join(", ");
  return { background: `repeating-linear-gradient(45deg, ${stops})` };
}


// ── Screensaver ───────────────────────────────────────────────────────────────
// Replace this URL with your family photo. Upload to any public image host
// (Google Photos shared link, Dropbox, Imgur, etc.) and paste the direct image URL here.
const FAMILY_PHOTO_URL = ""; // <-- paste your photo URL here
const SCREENSAVER_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

function Screensaver({ onDismiss }) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const timeStr = time.toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", timeZone: "America/Denver"
  });
  const dateStr = time.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", timeZone: "America/Denver"
  });

  return (
    <div
      onClick={onDismiss}
      onTouchStart={onDismiss}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "#000",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        cursor: "pointer",
        userSelect: "none",
      }}
    >
      {/* Family photo */}
      {FAMILY_PHOTO_URL ? (
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `url(${FAMILY_PHOTO_URL})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "brightness(0.6)",
        }} />
      ) : (
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(135deg, #1A2F4B 0%, #0F1E30 50%, #1A2F4B 100%)",
        }}>
          {/* Star field */}
          {Array.from({length: 40}).map((_, i) => (
            <div key={i} style={{
              position: "absolute",
              top: `${Math.sin(i * 37.5) * 50 + 50}%`,
              left: `${Math.sin(i * 23.7) * 50 + 50}%`,
              width: i % 5 === 0 ? 3 : 1.5,
              height: i % 5 === 0 ? 3 : 1.5,
              background: "#fff",
              borderRadius: "50%",
              opacity: 0.3 + (i % 4) * 0.15,
            }} />
          ))}
        </div>
      )}

      {/* Content overlay */}
      <div style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
        {/* Family name */}
        <div style={{
          fontFamily: "'Fredoka',sans-serif", fontSize: 28, fontWeight: 600,
          color: "rgba(255,255,255,0.7)", letterSpacing: 4, textTransform: "uppercase",
          marginBottom: 16,
        }}>
          🏡 The Erickson Family
        </div>

        {/* Clock */}
        <div style={{
          fontFamily: "'Playfair Display',serif", fontSize: 96, fontWeight: 700,
          color: "#fff", lineHeight: 1, letterSpacing: -2,
          textShadow: "0 4px 30px rgba(0,0,0,0.5)",
        }}>
          {timeStr}
        </div>

        {/* Date */}
        <div style={{
          fontFamily: "'Fredoka',sans-serif", fontSize: 24, fontWeight: 500,
          color: "rgba(255,255,255,0.75)", marginTop: 12, letterSpacing: 1,
        }}>
          {dateStr}
        </div>

        {/* Tap to wake */}
        <div style={{
          marginTop: 48,
          fontFamily: "'Nunito',sans-serif", fontSize: 14,
          color: "rgba(255,255,255,0.35)", letterSpacing: 1,
        }}>
          Tap anywhere to continue
        </div>
      </div>
    </div>
  );
}

// ── Top Bar ───────────────────────────────────────────────────────────────────
function TopBar({ onAdmin }) {
  return (
    <div style={{
      position:"fixed", top:0, left:0, right:0, width:"100vw", zIndex:300,
      height:50, background:T.white, borderBottom:`2px solid ${T.border}`, boxSizing:"border-box",
      display:"flex", alignItems:"center", justifyContent:"space-between",
      padding:"0 16px",
    }}>
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        <span style={{ fontSize:22 }}>🏡</span>
        <span style={{ fontFamily:"'Fredoka',sans-serif", fontSize:18, fontWeight:700, color:T.text }}>Family OS</span>
      </div>
      <div style={{ display:"flex", gap:8, alignItems:"center" }}>
        <button onClick={() => window.location.reload()} style={{
          display:"flex", alignItems:"center", gap:6,
          background:T.stone, border:`2px solid ${T.border}`,
          borderRadius:99, padding:"6px 14px", cursor:"pointer",
          fontFamily:"'Fredoka',sans-serif", fontSize:13, fontWeight:600, color:T.sub,
          transition:"all 0.15s",
        }}
        onMouseEnter={e => { e.currentTarget.style.background="#2D7A56"; e.currentTarget.style.color="#fff"; e.currentTarget.style.borderColor="#2D7A56"; }}
        onMouseLeave={e => { e.currentTarget.style.background=T.stone; e.currentTarget.style.color=T.sub; e.currentTarget.style.borderColor=T.border; }}
        title="Refresh page">
          <span style={{ fontSize:15 }}>🔄</span> Refresh
        </button>
        <button onClick={onAdmin} style={{
          display:"flex", alignItems:"center", gap:6,
          background:T.stone, border:`2px solid ${T.border}`,
          borderRadius:99, padding:"6px 14px", cursor:"pointer",
          fontFamily:"'Fredoka',sans-serif", fontSize:13, fontWeight:600, color:T.sub,
        }}>
          <span style={{ fontSize:15 }}>⚙️</span> Admin
        </button>
      </div>
    </div>
  );
}

// ── Bottom Nav ────────────────────────────────────────────────────────────────
function BottomNav({ page, onPage }) {
  const tabs = [
    { id:"calendar", label:"Calendar", icon:"📅" },
    { id:"today",    label:"Today",    icon:"⚡" },
    { id:"progress", label:"Progress", icon:"🌈" },
  ];
  return (
    <nav style={{ position:"fixed", bottom:0, left:0, right:0, width:"100vw", zIndex:200, background:T.white, borderTop:`2px solid ${T.border}`, display:"flex", height:T.navH, boxSizing:"border-box" }}>
      {tabs.map(tab => {
        const active = page===tab.id;
        return (
          <button key={tab.id} onClick={() => onPage(tab.id)} style={{
            flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:3,
            background: active ? T.text : "none", border:"none", cursor:"pointer", transition:"all 0.2s",
          }}>
            <span style={{ fontSize:24 }}>{tab.icon}</span>
            <span style={{ fontFamily:"'Fredoka',sans-serif", fontSize:13, fontWeight:600, color: active ? T.white : T.muted }}>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// PAGE 1 — CALENDAR
// ════════════════════════════════════════════════════════════════════════════
const CAL_HOURS = Array.from({ length:20 }, (_, i) => i + 5); // 5am to 12am
const CELL_H = 52;

const INIT_CAL_EVENTS = [];

function CalendarPage({ family, events }) {
  const memberMap = Object.fromEntries(family.map(m => [m.id, m]));
  const [weekAnchor, setWeekAnchor] = useState(TODAY_DATE);
  const [visibleIds, setVisibleIds] = useState(new Set(family.map(m => m.id)));
  const weekDates = getWeekDates(weekAnchor);
  const todayStr = TODAY_DATE.toDateString();
  const calScrollRef = useState(null);
  useEffect(() => {
    if (calScrollRef[0]) calScrollRef[0].scrollTop = 2 * 48;
  }, [calScrollRef[0]]);
  function eventMatchesDate(ev, date) {
    const dow = date.getDay();
    // Support both old single dow and new dows array
    const matchesDow = ev.dows ? ev.dows.includes(dow) : ev.dow === dow;
    if (ev.recurrence === "daily") return true;
    if (ev.recurrence === "weekly") return matchesDow;
    if (ev.recurrence === "monthly") return matchesDow && date.getDate() <= 7;
    if (ev.recurrence === "once" && ev.specificDate) {
      // Compare date strings directly to avoid timezone issues
      const dateStr = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
      return ev.specificDate === dateStr;
    }
    // Legacy events default to weekly by dow
    return matchesDow;
  }
  const visibleEvents = events.filter(ev => ev.memberIds.some(id => visibleIds.has(id)));

  return (
    <div style={{ display:"flex", flexDirection:"column", height:`calc(100vh - ${T.navH}px - 50px)`, marginTop:"50px", overflow:"hidden", fontFamily:"'Fredoka',sans-serif", width:"100vw", marginLeft:0, marginRight:0 }}>
      <div style={{ background:T.white, borderBottom:`2px solid ${T.border}`, padding:"12px 16px 0", flexShrink:0, width:"100%" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
          <h1 style={{ fontSize:24, fontWeight:700, color:T.text, margin:0 }}>{MONTHS[weekDates[0].getMonth()]} {weekDates[0].getFullYear()}</h1>
          <div />
        </div>
        <div style={{ display:"flex", gap:6, overflowX:"auto", paddingBottom:10 }}>
          {family.map(m => {
            const on = visibleIds.has(m.id);
            return (
              <button key={m.id} onClick={() => setVisibleIds(s => { const n=new Set(s); n.has(m.id)?n.delete(m.id):n.add(m.id); return n; })}
                style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 14px", borderRadius:99, flexShrink:0, cursor:"pointer", background: on?m.light:T.stone, border: on?`2px solid ${m.color}`:"2px solid transparent", fontFamily:"'Fredoka',sans-serif" }}>
                <span style={{fontSize:15}}>{m.emoji}</span>
                <span style={{ fontSize:14, fontWeight:600, color: on?m.color:T.muted }}>{m.name}</span>
              </button>
            );
          })}
        </div>
      </div>
      {/* Left/Right week nav arrows */}
      <button onClick={() => { const d=new Date(weekAnchor); d.setDate(d.getDate()-7); setWeekAnchor(d); }} style={{
        position:"fixed", left:0, top:"50%", transform:"translateY(-50%)",
        zIndex:50, width:44, height:80, background:T.white,
        border:`2px solid ${T.border}`, borderLeft:"none",
        borderRadius:"0 16px 16px 0",
        display:"flex", alignItems:"center", justifyContent:"center",
        cursor:"pointer", boxShadow:"2px 0 12px rgba(0,0,0,0.08)",
        fontSize:22, color:T.sub, fontWeight:700,
      }}>‹</button>
      <button onClick={() => { const d=new Date(weekAnchor); d.setDate(d.getDate()+7); setWeekAnchor(d); }} style={{
        position:"fixed", right:0, top:"50%", transform:"translateY(-50%)",
        zIndex:50, width:44, height:80, background:T.white,
        border:`2px solid ${T.border}`, borderRight:"none",
        borderRadius:"16px 0 0 16px",
        display:"flex", alignItems:"center", justifyContent:"center",
        cursor:"pointer", boxShadow:"-2px 0 12px rgba(0,0,0,0.08)",
        fontSize:22, color:T.sub, fontWeight:700,
      }}>›</button>
      {/* Single scroll container with sticky time labels */}
      <div ref={el => { if(el && calScrollRef[0]!==el) { calScrollRef[0]=el; el.scrollTop=(8-CAL_HOURS[0])*CELL_H; }}} style={{ flex:1, overflowY:"auto", overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
        <div style={{ display:"flex", minWidth:0 }}>
          {/* Time labels column - scrolls with content */}
          <div style={{ width:46, flexShrink:0, borderRight:`1px solid ${T.border}` }}>
            <div style={{ height:44, borderBottom:`1px solid ${T.border}`, background:T.bg, position:"sticky", top:0, zIndex:10 }} />
            {CAL_HOURS.map(h => (
              <div key={h} style={{ height:CELL_H, display:"flex", alignItems:"flex-start", justifyContent:"flex-end", paddingRight:7, paddingTop:5 }}>
                <span style={{ fontSize:10, color:T.muted, fontWeight:600 }}>{h===0?"12a":h>12?`${h-12}p`:h===12?"12p":`${h}a`}</span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          <div style={{ flex:1, display:"flex", minWidth:0 }}>
            {weekDates.map((date, dowIdx) => {
              const isToday = date.toDateString()===todayStr;
              const dayEvs = visibleEvents.filter(ev => eventMatchesDate(ev, date));
              return (
                <div key={dowIdx} style={{ flex:"1 1 0%", minWidth:0, borderRight: dowIdx<6?`1px solid ${T.border}`:"none", position:"relative" }}>
                  {/* Sticky day header */}
                  <div style={{ height:44, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", borderBottom:`1px solid ${T.border}`, position:"sticky", top:0, zIndex:9, background: isToday?T.text:T.bg, borderRadius: isToday?"0 0 12px 12px":0 }}>
                    <span style={{ fontSize:10, fontWeight:700, letterSpacing:0.5, textTransform:"uppercase", color: isToday?"rgba(255,255,255,0.6)":T.muted }}>{DAYS_SHORT[date.getDay()]}</span>
                    <span style={{ fontSize:16, fontWeight:700, color: isToday?T.white:T.text }}>{date.getDate()}</span>
                  </div>
                  {/* Hour grid */}
                  <div style={{ position:"relative", height:CAL_HOURS.length*CELL_H }}>
                    {CAL_HOURS.map((_,i) => <div key={i} style={{ position:"absolute", top:i*CELL_H, left:0, right:0, borderTop:`1px solid ${T.border}`, height:CELL_H }} />)}
                    {dayEvs.map(ev => {
                      const mColors = ev.memberIds.map(id => memberMap[id]?.color).filter(Boolean);
                      const isMulti = mColors.length > 1;
                      const sStyle = isMulti ? stripeStyle(mColors) : { background: mColors[0]+"DD" };
                      const evTop = (ev.startH - CAL_HOURS[0]) * CELL_H + 2;
                      const evH = Math.max(ev.dur * CELL_H - 4, 18);
                      return (
                        <div key={ev.id} style={{ position:"absolute", top:evTop, left:3, right:3, height:evH, borderRadius:6, ...sStyle, overflow:"hidden", zIndex:2, boxShadow:"0 1px 4px rgba(0,0,0,0.15)" }}>
                          <div style={{ padding:"2px 5px", height:"100%", display:"flex", flexDirection:"column", justifyContent:"center" }}>
                            <div style={{ fontSize:10, fontWeight:700, color:"#fff", lineHeight:1.2, textShadow:"0 1px 2px rgba(0,0,0,0.4)", overflow:"hidden", display:"-webkit-box", WebkitLineClamp:evH>30?3:1, WebkitBoxOrient:"vertical" }}>{ev.title}</div>
                            {evH > 28 && <div style={{ fontSize:9, color:"rgba(255,255,255,0.85)", marginTop:1 }}>{(() => {
                              const h = Math.floor(ev.startH);
                              const m = Math.round((ev.startH - h) * 60);
                              const h12 = h % 12 === 0 ? 12 : h % 12;
                              const ampm = h >= 12 ? "pm" : "am";
                              return `${h12}:${m.toString().padStart(2,'0')}${ampm}`;
                            })()}</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// PAGE 2 — TODAY
// ════════════════════════════════════════════════════════════════════════════
function PersonColumn({ member, tasks, onToggle, points, completions, onRainbowDay, viewDate }) {
  const isRainbow = SECTIONS.every(sec => {
    const items = tasks[sec.id] || [];
    return items.length === 0 || items.every(t => !!(completions && completions[t.label + "|" + member.id]));
  });

  // Fire rainbow day callback when all tasks complete
  const prevRainbow = useState(false);
  useEffect(() => {
    if (isRainbow && !prevRainbow[0] && onRainbowDay && viewDate) {
      const dateStr = `${viewDate.getFullYear()}-${String(viewDate.getMonth()+1).padStart(2,'0')}-${String(viewDate.getDate()).padStart(2,'0')}`;
      onRainbowDay(member.id, dateStr);
    }
    prevRainbow[1](isRainbow);
  }, [isRainbow]);
  const allTaskItems = Object.values(tasks).flat();
  const totalItems = allTaskItems.length;
  const doneItems = allTaskItems.filter(t => !!(completions && completions[t.label + "|" + member.id])).length;

  return (
    <div style={{ minWidth:0, flex:"1 1 0%", display:"flex", flexDirection:"column", borderRight:`2px solid ${T.border}`, background: isRainbow ? RAINBOW_SOFT : T.bg, transition:"background 0.8s ease" }}>
      <div style={{ padding:"10px 10px 8px", flexShrink:0, position:"sticky", top:0, zIndex:5, backgroundImage: isRainbow?RAINBOW_GRAD:"none", background: isRainbow?undefined:T.white, borderBottom:`2px solid ${isRainbow?"transparent":T.border}` }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
          <div style={{ width:36, height:36, borderRadius:"50%", background: isRainbow?"rgba(255,255,255,0.35)":member.light, border:`2.5px solid ${isRainbow?"rgba(255,255,255,0.8)":member.color}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>{member.emoji}</div>
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:"'Fredoka',sans-serif", fontWeight:700, fontSize:16, color: isRainbow?T.white:T.text, lineHeight:1 }}>{member.name}</div>
            <div style={{ fontFamily:"'Nunito',sans-serif", fontSize:10, color: isRainbow?"rgba(255,255,255,0.85)":T.muted, marginTop:1 }}>{doneItems}/{totalItems} done · ⭐ {points} pts</div>
          </div>
          {isRainbow && <span style={{ fontSize:22 }}>🌈</span>}
        </div>
        <div style={{ background: isRainbow?"rgba(255,255,255,0.3)":T.stone, borderRadius:99, height:10, overflow:"hidden", boxShadow:"inset 0 1px 3px rgba(0,0,0,0.1)" }}>
          <div style={{ width:`${totalItems?(doneItems/totalItems)*100:0}%`, height:"100%", borderRadius:99, background: isRainbow?"#fff":member.color, transition:"width 0.4s ease", boxShadow:`0 1px 4px ${member.color}88` }} />
        </div>
        <div style={{ display:"flex", gap:4, marginTop:6 }}>
          {SECTIONS.map(sec => {
            const done = sectionDone(tasks, sec.id);
            return <div key={sec.id} style={{ flex:1, height:5, borderRadius:99, background: done?sec.color:T.stone, transition:"background 0.3s", boxShadow: done?`0 1px 4px ${sec.color}88`:"none" }} />;
          })}
        </div>
      </div>
      <div className="scroll-col" style={{ flex:1, overflowY:"auto", padding:"8px 8px 12px", WebkitOverflowScrolling:"touch", touchAction:"pan-y", userSelect:"none", WebkitUserSelect:"none", cursor:"grab" }}>
        {SECTIONS.map(sec => {
          const secTasks = tasks[sec.id] || [];
          // Merge completion state from Supabase into each task
          const secTasksWithDone = secTasks.map(t => ({
            ...t,
            done: !!(completions && completions[t.label + "|" + member.id])
          }));
          const doneCnt = secTasksWithDone.filter(t => t.done).length;
          const done = secTasksWithDone.length > 0 && secTasksWithDone.every(t => t.done);
          return (
            <div key={sec.id} style={{ marginBottom:10 }}>
              <div style={{ borderRadius:"12px 12px 0 0", padding:"8px 10px 6px", background: done?sec.grad:T.white, border:`2px solid ${done?"transparent":T.border}`, borderBottom:"none", display:"flex", alignItems:"center", gap:7 }}>
                <span style={{ fontSize:18 }}>{sec.icon}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontFamily:"'Fredoka',sans-serif", fontWeight:700, fontSize:14, color: done?"#fff":T.text }}>{sec.label}</div>
                  <div style={{ marginTop:4, background: done?"rgba(255,255,255,0.3)":T.stone, borderRadius:99, height:8, overflow:"hidden" }}>
                    <div style={{ width:`${secTasks.length?(doneCnt/secTasks.length)*100:0}%`, height:"100%", borderRadius:99, background: done?"rgba(255,255,255,0.9)":sec.color, transition:"width 0.4s ease", boxShadow:`0 1px 4px ${sec.color}66` }} />
                  </div>
                </div>
                {done
                  ? <div style={{ background:"rgba(255,255,255,0.3)", color:"#fff", fontFamily:"'Fredoka',sans-serif", fontSize:11, fontWeight:700, padding:"3px 8px", borderRadius:99 }}>🌈 Done!</div>
                  : <div style={{ fontFamily:"'Nunito',sans-serif", fontSize:10, fontWeight:800, color:T.muted }}>{doneCnt}/{secTasks.length}</div>
                }
              </div>
              <div style={{ background: done?`${sec.color}15`:T.white, border:`2px solid ${done?sec.color+"55":T.border}`, borderTop:"none", borderRadius:"0 0 12px 12px", padding:"6px 8px 8px" }}>
                {secTasksWithDone.map(task => (
                  <div key={task.id} onClick={() => onToggle(member.id, sec.id, task.label, task.done)}
                    style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 8px", borderRadius:10, marginTop:4, cursor:"pointer", transition:"all 0.15s", background: task.done?`${sec.color}20`:"transparent" }}>
                    <div style={{ width:22, height:22, borderRadius:"50%", flexShrink:0, border:`2.5px solid ${task.done?sec.color:T.border}`, background: task.done?sec.color:"transparent", display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.15s" }}>
                      {task.done && <span style={{ color:"#fff", fontSize:11 }}>✓</span>}
                    </div>
                    <span style={{ flex:1, fontFamily:"'Nunito',sans-serif", fontSize:12, fontWeight:600, color: task.done?sec.color:T.text, textDecoration: task.done?"line-through":"none", lineHeight:1.35 }}>{task.label}</span>
                  </div>
                ))}
                {!done && <div style={{ textAlign:"center", marginTop:6, fontFamily:"'Nunito',sans-serif", fontSize:10, color:T.muted }}>Complete all to earn <span style={{ fontWeight:800, color:sec.color }}>+1 pt</span></div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TodayPage({ family, tasks: dbTasks, choreAssignments, onRainbowDay }) {
  const defaultVisible = Object.fromEntries(family.map(m => [m.id, m.defaultOn]));
  const [visible, setVisible] = useState(defaultVisible);
  // Task completions loaded from Supabase per day (moved after viewDate)
  const [taskState, setTaskStateRaw] = useState({});
  const [completions, setCompletions] = useState({});

  function setTaskState(next) {
    const resolved = typeof next === "function" ? next(taskState) : next;
    setTaskStateRaw(resolved);
  }

  async function toggleCompletion(label, memberId, currentlyDone) {
    const dateStr = viewDate.toISOString().slice(0,10);
    const key = label + "|" + memberId;
    if (currentlyDone) {
      await SB.deleteCompletion(label, memberId, dateStr);
      setCompletions(prev => { const n={...prev}; delete n[key]; return n; });
    } else {
      await SB.addCompletion(label, memberId, dateStr);
      setCompletions(prev => ({ ...prev, [key]: true }));
    }
  }
  const [viewDate, setViewDate] = useState(getMountainToday());

  function prevDay() { setViewDate(d => { const n=new Date(d); n.setDate(n.getDate()-1); return n; }); }
  function nextDay() { setViewDate(d => { const n=new Date(d); n.setDate(n.getDate()+1); return n; }); }
  const isToday = viewDate.toDateString() === getMountainToday().toDateString();

  // Load completions from Supabase when date changes
  useEffect(() => {
    const dateStr = viewDate.toISOString().slice(0,10);
    SB.getCompletions(dateStr).then(rows => {
      const map = {};
      (rows||[]).forEach(r => { map[r.task_label + "|" + r.member_id] = true; });
      setCompletions(map);
    });
  }, [viewDate]);

  async function toggleTask(memberId, secId, taskLabel, currentlyDone) {
    await toggleCompletion(taskLabel, memberId, currentlyDone);
  }

  const activeMembers = family.filter(m => visible[m.id]);
  const allKidsRainbow = family.filter(m => m.defaultOn).every(m => allSectionsDone(taskState[m.id]||{}));

  return (
    <div style={{ display:"flex", flexDirection:"column", height:`calc(100vh - ${T.navH}px - 50px)`, marginTop:"50px", overflow:"hidden", fontFamily:"'Fredoka',sans-serif", width:"100vw", marginLeft:0, marginRight:0 }}>
      <div style={{ borderBottom:`2px solid ${T.border}`, padding:"10px 14px", flexShrink:0, background: allKidsRainbow?"none":T.white, backgroundImage: allKidsRainbow?RAINBOW_GRAD:"none", transition:"all 0.8s ease" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
          <div>
            <div style={{ fontSize:11, fontWeight:600, color: allKidsRainbow?"rgba(255,255,255,0.75)":T.muted, letterSpacing:0.5 }}>{viewDate.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}</div>
            <div style={{ fontSize:22, fontWeight:700, color: allKidsRainbow?T.white:T.text, marginTop:1 }}>{allKidsRainbow?"🌈 Everyone earned a Rainbow Day!":"Today's Tasks"}</div>
          </div>
        </div>
        <div style={{ display:"flex", gap:6, overflowX:"auto" }}>
          {family.map(m => {
            const on = visible[m.id];
            const rainbow = allSectionsDone(taskState[m.id]||{});
            return (
              <button key={m.id} onClick={() => setVisible(v => ({...v,[m.id]:!v[m.id]}))}
                style={{ display:"flex", alignItems:"center", gap:5, padding:"6px 12px", borderRadius:99, flexShrink:0, cursor:"pointer", transition:"all 0.15s", background: on?m.light:T.stone, border: on?`2px solid ${m.color}`:"2px solid transparent" }}>
                <span style={{fontSize:14}}>{m.emoji}</span>
                <span style={{ fontFamily:"'Fredoka',sans-serif", fontSize:13, fontWeight:600, color: on?m.color:T.muted }}>{m.name}</span>
                {rainbow && <span style={{fontSize:12}}>🌈</span>}
              </button>
            );
          })}
        </div>
      </div>
      {/* Left/Right day nav arrows */}
      <button onClick={prevDay} style={{
        position:"fixed", left:0, top:"50%", transform:"translateY(-50%)",
        zIndex:50, width:44, height:80, background:T.white,
        border:`2px solid ${T.border}`, borderLeft:"none",
        borderRadius:"0 16px 16px 0",
        display:"flex", alignItems:"center", justifyContent:"center",
        cursor:"pointer", boxShadow:"2px 0 12px rgba(0,0,0,0.08)",
        fontSize:22, color:T.sub, fontWeight:700,
      }}>‹</button>
      <button onClick={nextDay} style={{
        position:"fixed", right:0, top:"50%", transform:"translateY(-50%)",
        zIndex:50, width:44, height:80, background:T.white,
        border:`2px solid ${T.border}`, borderRight:"none",
        borderRadius:"16px 0 0 16px",
        display:"flex", alignItems:"center", justifyContent:"center",
        cursor:"pointer", boxShadow:"-2px 0 12px rgba(0,0,0,0.08)",
        fontSize:22, color:T.sub, fontWeight:700,
      }}>›</button>
      {activeMembers.length === 0 ? (
        <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", color:T.muted, fontSize:16, fontFamily:"'Fredoka',sans-serif" }}>Tap a name above to see their tasks 👆</div>
      ) : (
        <div style={{ flex:1, display:"flex", overflowX:"auto", overflowY:"hidden", WebkitOverflowScrolling:"touch", touchAction:"pan-x", width:"100vw", alignItems:"stretch" }}>
          {activeMembers.map(m => {
            // Merge stored tasks with auto-generated chore tasks for today
            const choreTasks = getContributeTasksForMember(m.id, viewDate, choreAssignments);
            // Use tasks from Supabase, filtered by recurrence for viewDate
            const dbMemberTasks = dbTasks[m.id] || { learn:[], exercise:[], contribute:[], goals:[] };
            function filterByDate(taskList) {
              const dateStr = `${viewDate.getFullYear()}-${String(viewDate.getMonth()+1).padStart(2,'0')}-${String(viewDate.getDate()).padStart(2,'0')}`;
              return taskList.filter(t => {
                if (!t.recurrence || t.recurrence === "daily") return true;
                if (t.recurrence === "weekly") return (t.dows||[]).includes(viewDate.getDay());
                if (t.recurrence === "once" && t.specificDate) return t.specificDate === dateStr;
                return true;
              });
            }
            const mergedTasks = {
              learn:      filterByDate(dbMemberTasks.learn || []),
              exercise:   filterByDate(dbMemberTasks.exercise || []),
              goals:      filterByDate(dbMemberTasks.goals || []),
              contribute: choreTasks.length > 0 ? choreTasks : filterByDate(dbMemberTasks.contribute || []),
            };
            const memberPts = SECTIONS.filter(s => {
              const items = mergedTasks[s.id] || [];
              return items.length > 0 && items.every(t => !!(completions && completions[t.label + "|" + m.id]));
            }).length;
            return <PersonColumn key={m.id} member={m} tasks={mergedTasks} onToggle={toggleTask} points={memberPts} completions={completions} onRainbowDay={onRainbowDay} viewDate={viewDate} />;
          })}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// PAGE 3 — PROGRESS
// ════════════════════════════════════════════════════════════════════════════

// Colored ring SVG around the Christ portrait — 4 arc segments
function ColorRing({ size = 100 }) {
  const cx = size / 2, cy = size / 2;
  const r = size / 2 - 5;
  const colors = ["#4D96FF","#FF9F45","#FF6B6B","#6BCB77"]; // matching quad colors
  const segments = colors.length;
  const gap = 4; // degrees gap between segments

  function arcPath(startDeg, endDeg) {
    const toRad = d => (d - 90) * Math.PI / 180;
    const x1 = cx + r * Math.cos(toRad(startDeg));
    const y1 = cy + r * Math.sin(toRad(startDeg));
    const x2 = cx + r * Math.cos(toRad(endDeg));
    const y2 = cy + r * Math.sin(toRad(endDeg));
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  }

  const segDeg = 360 / segments;
  return (
    <svg width={size} height={size} style={{ position:"absolute", top:0, left:0 }}>
      {colors.map((color, i) => {
        const startDeg = i * segDeg + gap / 2;
        const endDeg = (i + 1) * segDeg - gap / 2;
        return (
          <path key={i} d={arcPath(startDeg, endDeg)} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" />
        );
      })}
    </svg>
  );
}

function GoalsQuadrant({ family, goals, setGoals, dbGoalRows }) {
  const [activeMember, setActiveMember] = useState(family[2] || family[0]);
  const [completedGoals, setCompletedGoals] = useState([]); // { label, quadrant, memberId, date }
  const [celebration, setCelebration] = useState(null); // { label }
  const memberGoals = goals[activeMember.id] || {};

  // Load completed goals from localStorage per member
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("familyos_completedGoals") || "[]");
      setCompletedGoals(saved);
    } catch {}
  }, []);

  function saveCompleted(list) {
    setCompletedGoals(list);
    try { localStorage.setItem("familyos_completedGoals", JSON.stringify(list)); } catch {}
  }

  async function completeGoal(memberId, quadId, goalLabel) {
    // Remove from active goals
    if (setGoals) {
      setGoals(prev => ({
        ...prev,
        [memberId]: {
          ...prev[memberId],
          [quadId]: (prev[memberId]?.[quadId] || []).filter(g => g !== goalLabel),
        },
      }));
      // Delete from Supabase
      if (dbGoalRows) {
        const row = dbGoalRows.find(r => r.member_id === memberId && r.quadrant === quadId && r.label === goalLabel);
        if (row) await SB.deleteGoal(row.id);
      }
    }
    // Add to completed list
    const dateStr = new Date().toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" });
    const newCompleted = [{ label:goalLabel, quadrant:quadId, memberId, date:dateStr }, ...completedGoals];
    saveCompleted(newCompleted);
    // Trigger celebration
    setCelebration({ label: goalLabel });
    setTimeout(() => setCelebration(null), 3500);
  }

  const memberCompleted = completedGoals.filter(g => g.memberId === activeMember.id);

  return (
    <div style={{ position:"relative" }}>

      {/* 🎉 Celebration Overlay */}
      {celebration && (
        <div style={{
          position:"fixed", inset:0, zIndex:9999,
          display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
          pointerEvents:"none",
        }}>
          {/* Dark backdrop */}
          <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.45)", animation:"fadeInOut 3.5s ease forwards" }} />

          {/* Balloons */}
          {Array.from({length:12}).map((_,i) => (
            <div key={i} style={{
              position:"absolute",
              bottom:-60,
              left:`${8 + i*7.5}%`,
              fontSize: 28 + (i%3)*8,
              animation:`balloon${i%3} ${2.5+i*0.15}s ease-out forwards`,
              animationDelay:`${i*0.08}s`,
            }}>
              {["🎈","🎉","🌟","✨","🏆","💫"][i%6]}
            </div>
          ))}

          {/* Big message */}
          <div style={{
            position:"relative", zIndex:1,
            background:"linear-gradient(135deg,#FF6B6B,#FFD93D,#6BCB77,#4D96FF)",
            borderRadius:28, padding:"32px 48px", textAlign:"center",
            boxShadow:"0 20px 60px rgba(0,0,0,0.3)",
            animation:"popIn 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards",
          }}>
            <div style={{ fontSize:56, marginBottom:8 }}>🏆</div>
            <div style={{ fontFamily:"'Fredoka',sans-serif", fontSize:42, fontWeight:700, color:"#fff", textShadow:"0 2px 8px rgba(0,0,0,0.2)", lineHeight:1.1 }}>
              Goal Achieved!
            </div>
            <div style={{ fontFamily:"'Nunito',sans-serif", fontSize:18, color:"rgba(255,255,255,0.9)", marginTop:10, maxWidth:280 }}>
              "{celebration.label}"
            </div>
            <div style={{ fontFamily:"'Fredoka',sans-serif", fontSize:24, color:"rgba(255,255,255,0.85)", marginTop:8 }}>
              🌟 Nice Job! 🌟
            </div>
          </div>

          <style>{`
            @keyframes popIn { from { transform:scale(0.3) rotate(-5deg); opacity:0; } to { transform:scale(1) rotate(0deg); opacity:1; } }
            @keyframes fadeInOut { 0%{opacity:0} 10%{opacity:1} 80%{opacity:1} 100%{opacity:0} }
            @keyframes balloon0 { from{transform:translateY(0) rotate(-10deg);opacity:0} 20%{opacity:1} to{transform:translateY(-110vh) rotate(10deg);opacity:0.8} }
            @keyframes balloon1 { from{transform:translateY(0) rotate(5deg);opacity:0} 20%{opacity:1} to{transform:translateY(-115vh) rotate(-8deg);opacity:0.8} }
            @keyframes balloon2 { from{transform:translateY(0) rotate(-3deg);opacity:0} 20%{opacity:1} to{transform:translateY(-105vh) rotate(12deg);opacity:0.8} }
          `}</style>
        </div>
      )}

      {/* Member selector */}
      <div style={{ display:"flex", gap:8, overflowX:"auto", marginBottom:16 }}>
        {family.map(m => {
          const active = m.id===activeMember.id;
          return (
            <button key={m.id} onClick={() => setActiveMember(m)} style={{
              display:"flex", alignItems:"center", gap:6, padding:"7px 14px",
              borderRadius:99, flexShrink:0, cursor:"pointer", transition:"all 0.15s",
              background: active?m.color:T.stone, border: active?`2px solid ${m.color}`:"2px solid transparent",
            }}>
              <span style={{fontSize:15}}>{m.emoji}</span>
              <span style={{ fontFamily:"'Fredoka',sans-serif", fontSize:13, fontWeight:700, color:active?"#fff":T.sub }}>{m.name}</span>
            </button>
          );
        })}
      </div>

      {/* Title */}
      <div style={{ textAlign:"center", marginBottom:14 }}>
        <div style={{ fontFamily:"'Fredoka',sans-serif", fontSize:26, fontWeight:700, color:"#FF6B6B", letterSpacing:1 }}>MY GOALS</div>
        <div style={{ fontFamily:"'Nunito',sans-serif", fontSize:11, color:T.sub, fontStyle:"italic", marginTop:2, lineHeight:1.4 }}>
          "Jesus increased in wisdom and stature,<br/>and in favour with God and man." Luke 2:52
        </div>
      </div>

      {/* 2×2 grid with center portrait */}
      <div style={{ position:"relative", background:T.white, borderRadius:16, overflow:"hidden", border:`2px solid ${T.border}` }}>
        <div style={{ position:"absolute", top:"50%", left:0, right:0, height:1, background:T.border, zIndex:1, transform:"translateY(-0.5px)" }} />
        <div style={{ position:"absolute", left:"50%", top:0, bottom:0, width:1, background:T.border, zIndex:1, transform:"translateX(-0.5px)" }} />
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr" }}>
          {QUAD.map((q, qi) => {
            const isLeft = qi % 2 === 0;
            const isTop  = qi < 2;
            const qGoals = memberGoals[q.id] || [];
            const labelStyle = {
              fontFamily:"'Fredoka',sans-serif", fontSize:13, fontWeight:700,
              color:q.color, letterSpacing:0.5, textTransform:"uppercase",
              position:"absolute",
              ...(isTop ? { top:10 } : { bottom:10 }),
              ...(isLeft ? { left:12 } : { right:12, textAlign:"right" }),
            };
            return (
              <div key={q.id} style={{
                position:"relative", minHeight:150,
                padding: isTop
                  ? (isLeft ? "36px 70px 24px 14px" : "36px 14px 24px 70px")
                  : (isLeft ? "24px 70px 36px 14px" : "24px 14px 36px 70px"),
              }}>
                <div style={labelStyle}>{q.label}</div>
                <div>
                  {qGoals.length === 0 ? (
                    <div style={{ fontFamily:"'Nunito',sans-serif", fontSize:11, color:T.muted, fontStyle:"italic" }}>No goals yet</div>
                  ) : (
                    qGoals.map((g, i) => (
                      <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:6, marginBottom:7, cursor:"pointer" }}
                        onClick={() => completeGoal(activeMember.id, q.id, g)}>
                        {/* Checkbox */}
                        <div style={{
                          width:16, height:16, borderRadius:5, border:`2px solid ${q.color}`,
                          flexShrink:0, marginTop:2, display:"flex", alignItems:"center",
                          justifyContent:"center", background:"transparent", transition:"all 0.15s",
                        }}>
                          <div style={{ width:8, height:8, borderRadius:2, background:"transparent" }} />
                        </div>
                        <span style={{ fontFamily:"'Nunito',sans-serif", fontSize:12, fontWeight:600, color:T.text, lineHeight:1.45 }}>{g}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Christ portrait */}
        <div style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", zIndex:10, width:90, height:90 }}>
          <ColorRing size={90} />
          <div style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", width:68, height:68, borderRadius:"50%", background:"linear-gradient(160deg, #F5E6C8 0%, #D4A76A 50%, #8B6340 100%)", border:"3px solid #fff", display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden", boxShadow:"0 3px 16px rgba(0,0,0,0.18)" }}>
            <svg width="68" height="68" viewBox="0 0 68 68" style={{ position:"absolute", top:0, left:0 }}>
              <circle cx="34" cy="34" r="34" fill="#C8935A"/>
              <ellipse cx="34" cy="18" rx="18" ry="16" fill="#6B3A1F"/>
              <ellipse cx="34" cy="42" rx="20" ry="28" fill="#6B3A1F"/>
              <ellipse cx="34" cy="32" rx="13" ry="16" fill="#D4A46A"/>
              <ellipse cx="29" cy="30" rx="2" ry="2.5" fill="#3B2010"/>
              <ellipse cx="39" cy="30" rx="2" ry="2.5" fill="#3B2010"/>
              <path d="M34 33 Q32 37 34 38 Q36 37 34 33" fill="#B8845A" opacity="0.6"/>
              <path d="M30 41 Q34 44 38 41" stroke="#9B6040" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
              <ellipse cx="34" cy="46" rx="10" ry="8" fill="#6B3A1F"/>
              <path d="M14 68 Q20 55 34 52 Q48 55 54 68 Z" fill="#E8E0D0"/>
              <circle cx="34" cy="20" r="16" fill="none" stroke="#FFD700" strokeWidth="1" opacity="0.4"/>
            </svg>
          </div>
        </div>
      </div>

      {/* Completed Goals */}
      {memberCompleted.length > 0 && (
        <div style={{ marginTop:20 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
            <span style={{ fontSize:20 }}>✅</span>
            <div style={{ fontFamily:"'Fredoka',sans-serif", fontSize:18, fontWeight:700, color:T.text }}>Achieved Goals</div>
            <div style={{ background:"#2D7A56", color:"#fff", borderRadius:99, padding:"2px 10px", fontFamily:"'Fredoka',sans-serif", fontSize:12, fontWeight:700 }}>{memberCompleted.length}</div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {memberCompleted.map((g, i) => {
              const quad = QUAD.find(q => q.id === g.quadrant);
              return (
                <div key={i} style={{ background:"#F0FDF4", border:"1.5px solid #86EFAC", borderRadius:12, padding:"10px 14px", display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ fontSize:20 }}>🏆</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontFamily:"'Nunito',sans-serif", fontSize:13, fontWeight:700, color:T.text, textDecoration:"line-through", opacity:0.7 }}>{g.label}</div>
                    <div style={{ fontFamily:"'Nunito',sans-serif", fontSize:11, color:T.muted, marginTop:2 }}>{quad?.label || g.quadrant} · Achieved {g.date}</div>
                  </div>
                  <span style={{ fontSize:16 }}>✨</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ProgressPage({ family, goals, setGoals, streaks, weekPts, rainbowDays, allCompletions, tasks, dbGoalRows }) {
  const [activeMember, setActiveMember] = useState(family[2] || family[0]);

  // ── Real Badge Engine ─────────────────────────────────────────────────────
  // Badge definitions: { id, emoji, label, desc, category, check(stats) }
  const BADGE_DEFS = [
    // 🌈 Rainbow Day badges
    { id:"rd_first",    emoji:"🌱", label:"First Rainbow",    desc:"Earned your first Rainbow Day",         category:"rainbow",    check: s => s.totalRainbow >= 1 },
    { id:"rd_3",        emoji:"🌈", label:"Triple Rainbow",   desc:"3 Rainbow Days",                        category:"rainbow",    check: s => s.totalRainbow >= 3 },
    { id:"rd_7",        emoji:"⭐", label:"Week of Rainbows", desc:"7 Rainbow Days total",                  category:"rainbow",    check: s => s.totalRainbow >= 7 },
    { id:"rd_14",       emoji:"🌟", label:"Two Week Warrior", desc:"14 Rainbow Days total",                 category:"rainbow",    check: s => s.totalRainbow >= 14 },
    { id:"rd_30",       emoji:"🏆", label:"Rainbow Champion", desc:"30 Rainbow Days total",                 category:"rainbow",    check: s => s.totalRainbow >= 30 },
    { id:"rd_streak3",  emoji:"🔥", label:"On Fire",          desc:"3 Rainbow Days in a row",               category:"rainbow",    check: s => s.streak >= 3 },
    { id:"rd_streak7",  emoji:"💥", label:"Unstoppable",      desc:"7 Rainbow Days in a row",               category:"rainbow",    check: s => s.streak >= 7 },
    { id:"rd_week7",    emoji:"📅", label:"Perfect Week",     desc:"7 Rainbow Days in the last 7 days",     category:"rainbow",    check: s => s.rdWeek >= 7 },

    // 📖 Learn badges
    { id:"lrn_first",   emoji:"📚", label:"First Lesson",     desc:"Completed Learn tasks for the first time", category:"learn",  check: s => s.learnDays >= 1 },
    { id:"lrn_7",       emoji:"🎓", label:"Scholar",          desc:"Completed Learn tasks 7 days",           category:"learn",   check: s => s.learnDays >= 7 },
    { id:"lrn_14",      emoji:"🧠", label:"Deep Thinker",     desc:"Completed Learn tasks 14 days",          category:"learn",   check: s => s.learnDays >= 14 },
    { id:"lrn_30",      emoji:"🏫", label:"Lifelong Learner", desc:"Completed Learn tasks 30 days",          category:"learn",   check: s => s.learnDays >= 30 },

    // 💪 Exercise badges
    { id:"ex_first",    emoji:"🌿", label:"First Workout",    desc:"Completed Exercise tasks for the first time", category:"exercise", check: s => s.exerciseDays >= 1 },
    { id:"ex_7",        emoji:"💪", label:"Getting Strong",   desc:"Completed Exercise 7 days",              category:"exercise", check: s => s.exerciseDays >= 7 },
    { id:"ex_14",       emoji:"🏃", label:"On the Move",      desc:"Completed Exercise 14 days",             category:"exercise", check: s => s.exerciseDays >= 14 },
    { id:"ex_30",       emoji:"🏅", label:"Athlete",          desc:"Completed Exercise 30 days",             category:"exercise", check: s => s.exerciseDays >= 30 },

    // 🤝 Contribute badges
    { id:"con_first",   emoji:"✨", label:"Helping Hand",     desc:"Completed Contribute tasks for the first time", category:"contribute", check: s => s.contributeDays >= 1 },
    { id:"con_7",       emoji:"🏠", label:"Home Hero",        desc:"Contributed 7 days",                    category:"contribute", check: s => s.contributeDays >= 7 },
    { id:"con_14",      emoji:"⭐", label:"Team Player",      desc:"Contributed 14 days",                   category:"contribute", check: s => s.contributeDays >= 14 },
    { id:"con_30",      emoji:"👑", label:"Family MVP",       desc:"Contributed 30 days",                   category:"contribute", check: s => s.contributeDays >= 30 },

    // 🎯 Goal badges
    { id:"goal_set",    emoji:"🗺️", label:"Goal Setter",      desc:"Created at least one Goal task",        category:"goals",   check: s => s.goalsSet >= 1 },
    { id:"goal_5set",   emoji:"🧭", label:"Visionary",        desc:"Created 5 or more Goal tasks",          category:"goals",   check: s => s.goalsSet >= 5 },
    { id:"goal_first",  emoji:"🎯", label:"On Target",        desc:"Completed Goal tasks for the first time", category:"goals", check: s => s.goalsDays >= 1 },
    { id:"goal_7",      emoji:"🚀", label:"Dream Chaser",     desc:"Completed Goal tasks 7 days",           category:"goals",   check: s => s.goalsDays >= 7 },
    { id:"goal_14",     emoji:"💫", label:"Goal Crusher",     desc:"Completed Goal tasks 14 days",          category:"goals",   check: s => s.goalsDays >= 14 },
    { id:"goal_30",     emoji:"🌠", label:"Legend",           desc:"Completed Goal tasks 30 days",          category:"goals",   check: s => s.goalsDays >= 30 },
  ];

  const CATEGORY_COLORS = {
    rainbow:    { bg:"#F3E5FF", border:"#C77DFF44", text:"#7B3FA0", label:"🌈 Rainbow Days" },
    learn:      { bg:"#E0EDFF", border:"#4D96FF44", text:"#2A5FA8", label:"📖 Learn" },
    exercise:   { bg:"#E5F7E8", border:"#6BCB7744", text:"#2D7A3D", label:"💪 Exercise" },
    contribute: { bg:"#FFF0E0", border:"#FF9F4544", text:"#A85A00", label:"🤝 Contribute" },
    goals:      { bg:"#FFF0F8", border:"#FF69B444", text:"#A0306A", label:"🎯 Goals" },
  };

  function getMemberStats(memberId) {
    const memberComps = (allCompletions||[]).filter(c => c.member_id === memberId);
    // Get unique dates where each section had at least one completion
    const datesBySection = { learn:new Set(), exercise:new Set(), contribute:new Set(), goals:new Set() };
    memberComps.forEach(c => {
      // We need to determine which section this task belongs to
      const memberTasks = tasks[memberId] || {};
      for (const sec of ["learn","exercise","contribute","goals"]) {
        if ((memberTasks[sec]||[]).some(t => t.label === c.task_label)) {
          datesBySection[sec].add(c.completed_date);
        }
      }
    });
    const memberRd = (rainbowDays||[]).filter(r => r.member_id === memberId);
    const now = new Date();
    const weekAgo = new Date(now); weekAgo.setDate(now.getDate()-7);
    const memberGoals = tasks[memberId]?.goals || [];
    return {
      totalRainbow:   memberRd.length,
      streak:         streaks[memberId] || 0,
      rdWeek:         memberRd.filter(r => new Date(r.date+"T00:00:00") >= weekAgo).length,
      learnDays:      datesBySection.learn.size,
      exerciseDays:   datesBySection.exercise.size,
      contributeDays: datesBySection.contribute.size,
      goalsDays:      datesBySection.goals.size,
      goalsSet:       memberGoals.length,
    };
  }

  function getEarnedBadges(memberId) {
    const stats = getMemberStats(memberId);
    return BADGE_DEFS.filter(b => b.check(stats));
  }

  const streak  = streaks[activeMember.id]  || 0;
  const wPts    = weekPts[activeMember.id]  || 0;
  const todayPts = SECTIONS.length;
  const earnedBadges = getEarnedBadges(activeMember.id);

  return (
    <div style={{ display:"flex", flexDirection:"column", height:`calc(100vh - ${T.navH}px - 50px)`, marginTop:"50px", overflow:"hidden", fontFamily:"'Fredoka',sans-serif", width:"100vw", marginLeft:0, marginRight:0 }}>
      {/* Member selector */}
      <div style={{ background:T.white, borderBottom:`2px solid ${T.border}`, display:"flex", overflowX:"auto", padding:"10px 12px", gap:8, flexShrink:0 }}>
        {family.map(m => {
          const active = m.id===activeMember.id;
          return (
            <button key={m.id} onClick={() => setActiveMember(m)} style={{ display:"flex", alignItems:"center", gap:7, padding:"8px 16px", borderRadius:99, flexShrink:0, cursor:"pointer", transition:"all 0.15s", background: active?m.color:T.stone, border: active?`2px solid ${m.color}`:"2px solid transparent" }}>
              <span style={{fontSize:17}}>{m.emoji}</span>
              <span style={{ fontFamily:"'Fredoka',sans-serif", fontSize:14, fontWeight:700, color: active?"#fff":T.sub }}>{m.name}</span>
            </button>
          );
        })}
      </div>

      <div className="scroll-col" style={{ flex:1, overflowY:"auto", padding:"16px 16px 28px", WebkitOverflowScrolling:"touch", touchAction:"pan-y", userSelect:"none", WebkitUserSelect:"none", cursor:"grab" }}>

        {/* Rainbow Streak + Stats */}
        {(() => {
          const memberRd = (rainbowDays||[]).filter(r => r.member_id === activeMember.id);
          const now = new Date();
          const weekAgo  = new Date(now); weekAgo.setDate(now.getDate()-7);
          const monthAgo = new Date(now); monthAgo.setDate(now.getDate()-30);
          const rdWeek  = memberRd.filter(r => new Date(r.date+"T00:00:00") >= weekAgo).length;
          const rdMonth = memberRd.filter(r => new Date(r.date+"T00:00:00") >= monthAgo).length;

          // Build last-7-days grid
          const last7 = Array.from({length:7}, (_,i) => {
            const d = new Date(now); d.setDate(now.getDate() - (6-i));
            const dStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            const dayLabel = ["Su","Mo","Tu","We","Th","Fr","Sa"][d.getDay()];
            const earned = memberRd.some(r => r.date === dStr);
            return { dStr, dayLabel, earned, isToday: d.toDateString()===new Date().toDateString() };
          });

          return (<>
            {/* Streak card */}
            <div style={{ borderRadius:22, overflow:"hidden", marginBottom:12, padding:"18px 20px 14px", position:"relative", background:"linear-gradient(135deg,#1A2F4B,#0F1E30)" }}>
              {[["12%",18],["35%",42],["58%",12],["78%",55],["90%",28]].map(([left,top],i) => (
                <div key={i} style={{ position:"absolute", top:`${top}%`, left, width:2, height:2, background:"#fff", borderRadius:"50%", opacity:0.3 }} />
              ))}
              <div style={{ position:"relative", zIndex:1 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                  <div>
                    <div style={{ fontSize:11, fontWeight:600, color:"rgba(255,255,255,0.4)", letterSpacing:1, textTransform:"uppercase", marginBottom:5 }}>Rainbow Day Streak</div>
                    <div style={{ fontSize:34, fontWeight:700, color:"#fff", lineHeight:1 }}>
                      {streak > 0 ? `🔥 ${streak}-Day Streak` : "🌈 Start your streak!"}
                    </div>
                    {streak > 0 && <div style={{ fontSize:12, color:"rgba(255,255,255,0.45)", marginTop:4 }}>Complete all 4 sections every day to keep it going</div>}
                  </div>
                  <div style={{ fontSize:44 }}>🌈</div>
                </div>
                {/* Last 7 days */}
                <div style={{ display:"flex", gap:5 }}>
                  {last7.map(({dStr, dayLabel, earned, isToday}) => (
                    <div key={dStr} style={{ flex:1, textAlign:"center" }}>
                      <div style={{ height:34, borderRadius:9, marginBottom:4, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, backgroundImage:earned?RAINBOW_GRAD:"none", background:earned?"none":"rgba(255,255,255,0.07)", border:isToday?"2px solid rgba(255,255,255,0.3)":"2px solid transparent" }}>
                        {earned?"🌈":""}
                      </div>
                      <div style={{ fontSize:9, color:isToday?"rgba(255,255,255,0.7)":"rgba(255,255,255,0.35)", fontWeight:700 }}>{dayLabel}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Weekly + Monthly stats */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
              <div style={{ background:"#FFF8E0", borderRadius:16, border:"2px solid #FFD93D44", padding:"14px 12px", textAlign:"center" }}>
                <div style={{ fontSize:28 }}>📅</div>
                <div style={{ fontFamily:"'Fredoka',sans-serif", fontSize:28, fontWeight:700, color:"#D4732A", marginTop:2 }}>{rdWeek}</div>
                <div style={{ fontFamily:"'Nunito',sans-serif", fontSize:11, color:T.muted }}>rainbow days this week</div>
              </div>
              <div style={{ background:"#F0FDF4", borderRadius:16, border:"2px solid #86EFAC44", padding:"14px 12px", textAlign:"center" }}>
                <div style={{ fontSize:28 }}>🗓️</div>
                <div style={{ fontFamily:"'Fredoka',sans-serif", fontSize:28, fontWeight:700, color:"#2D7A56", marginTop:2 }}>{rdMonth}</div>
                <div style={{ fontFamily:"'Nunito',sans-serif", fontSize:11, color:T.muted }}>rainbow days this month</div>
              </div>
            </div>
          </>);
        })()}

        {/* Points & Money */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:18 }}>
          {[{label:"Today",pts:todayPts},{label:"This Week",pts:wPts}].map(card => (
            <div key={card.label} style={{ background:T.white, border:`2px solid ${T.border}`, borderRadius:18, padding:"14px 12px", textAlign:"center" }}>
              <div style={{ fontSize:11, fontWeight:700, color:T.muted, letterSpacing:0.8, textTransform:"uppercase", marginBottom:6 }}>{card.label}</div>
              <div style={{ fontFamily:"'Fredoka',sans-serif", fontSize:30, fontWeight:700, color:activeMember.color, lineHeight:1 }}>{card.pts}</div>
              <div style={{ fontSize:11, color:T.sub, marginTop:2 }}>pts</div>
              <div style={{ marginTop:10, paddingTop:10, borderTop:`1px solid ${T.border}` }}>
                <div style={{ fontFamily:"'Fredoka',sans-serif", fontSize:20, fontWeight:700, color:"#2D7A56" }}>${(card.pts*0.25).toFixed(2)}</div>
                <div style={{ fontSize:10, color:T.muted }}>earned</div>
              </div>
            </div>
          ))}
        </div>

         {/* ── Badge Showcase — shown first ── */}
         {(() => {
           const earned = getEarnedBadges(activeMember.id);
           const categories = ["rainbow","learn","exercise","contribute","goals"];
           if (earned.length === 0) return (
             <div style={{ background:T.white, borderRadius:20, border:`2px solid ${T.border}`, padding:"24px 20px", marginBottom:16, textAlign:"center" }}>
               <div style={{ fontSize:48, marginBottom:8 }}>🌱</div>
               <div style={{ fontFamily:"'Fredoka',sans-serif", fontSize:18, fontWeight:700, color:T.text, marginBottom:4 }}>No badges yet!</div>
               <div style={{ fontFamily:"'Nunito',sans-serif", fontSize:13, color:T.muted }}>Complete tasks on the Today page to start earning badges</div>
             </div>
           );
           return (
             <div style={{ marginBottom:16 }}>
               <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
                 <div style={{ fontSize:22 }}>🏅</div>
                 <div style={{ fontFamily:"'Fredoka',sans-serif", fontSize:20, fontWeight:700, color:T.text }}>{activeMember.name}'s Badges</div>
                 <div style={{ background:activeMember.color, color:"#fff", borderRadius:99, padding:"2px 10px", fontFamily:"'Fredoka',sans-serif", fontSize:13, fontWeight:700 }}>{earned.length} earned</div>
               </div>
               {categories.map(cat => {
                 const catBadges = BADGE_DEFS.filter(b => b.category === cat);
                 const catEarned = catBadges.filter(b => earned.some(e => e.id === b.id));
                 const cc = CATEGORY_COLORS[cat];
                 return (
                   <div key={cat} style={{ background:cc.bg, border:`2px solid ${cc.border}`, borderRadius:16, padding:"14px 16px", marginBottom:10 }}>
                     <div style={{ fontFamily:"'Fredoka',sans-serif", fontSize:13, fontWeight:700, color:cc.text, marginBottom:10 }}>
                       {cc.label} · {catEarned.length}/{catBadges.length}
                     </div>
                     <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                       {catBadges.map(b => {
                         const isEarned = catEarned.some(e => e.id === b.id);
                         return (
                           <div key={b.id} title={b.desc} style={{ display:"flex", flexDirection:"column", alignItems:"center", width:68, opacity:isEarned?1:0.25, filter:isEarned?"none":"grayscale(1)", cursor:"default" }}>
                             <div style={{ width:50, height:50, borderRadius:14, background:isEarned?"#fff":"rgba(0,0,0,0.04)", border:isEarned?`2px solid ${cc.border.replace("44","BB")}`:"2px solid transparent", display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, boxShadow:isEarned?"0 2px 8px rgba(0,0,0,0.1)":"none", marginBottom:4 }}>
                               {b.emoji}
                             </div>
                             <div style={{ fontFamily:"'Fredoka',sans-serif", fontSize:9, fontWeight:700, color:cc.text, textAlign:"center", lineHeight:1.2 }}>{b.label}</div>
                           </div>
                         );
                       })}
                     </div>
                   </div>
                 );
               })}
             </div>
           );
         })()}
        {/* Goals Quadrant — styled like the image */}
        <GoalsQuadrant family={family} goals={goals} setGoals={setGoals} dbGoalRows={dbGoalRows} />

      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ADMIN PAGE
// ════════════════════════════════════════════════════════════════════════════
function AdminPage({ family, events, setEvents, tasks, setTasks, goals, setGoals, choreAssignments, setChoreAssignments, dbTaskRows, dbGoalRows, onReload }) {
  const [tab, setTab] = useState("calendar");
  const memberMap = Object.fromEntries(family.map(m => [m.id, m]));

  return (
    <div style={{ minHeight:"100vh", background:"#F0EEE9", fontFamily:"'Fredoka',sans-serif" }}>
      <div style={{ background:T.text, padding:"20px 24px 0", borderBottom:`2px solid #333` }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
          <span style={{ fontSize:28 }}>⚙️</span>
          <div style={{ flex:1 }}>
            <h1 style={{ fontSize:26, fontWeight:700, color:T.white, margin:0 }}>Admin Setup</h1>
            <div style={{ fontSize:13, color:"rgba(255,255,255,0.5)", marginTop:2 }}>
              Family OS · <a href="#" onClick={e=>{e.preventDefault();window.location.hash="";}} style={{color:"#FFD93D",textDecoration:"none"}}>← Back to Kiosk</a>
              <span style={{ marginLeft:12, color:"#6BCB77" }}>✅ Auto-saving to this device</span>
            </div>
          </div>
          <button onClick={() => {
            const data = {};
            ["events","choreAssignments","tasks","goals","streaks","weekPts"].forEach(k => {
              try { data[k] = JSON.parse(localStorage.getItem("familyos_"+k)||"null"); } catch {}
            });
            const blob = new Blob([JSON.stringify(data, null, 2)], {type:"application/json"});
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = "familyos-backup-" + new Date().toISOString().slice(0,10) + ".json";
            a.click();
          }} style={{ padding:"8px 14px", borderRadius:10, background:"#2D7A56", color:"#fff", border:"none", fontFamily:"'Fredoka',sans-serif", fontSize:12, fontWeight:700, cursor:"pointer", flexShrink:0 }}>
            ⬇️ Backup Data
          </button>
        </div>
        <div style={{ display:"flex", gap:2 }}>
          {[{id:"calendar",label:"📅 Calendar"},{id:"chores",label:"🧹 Chores"},{id:"tasks",label:"⚡ Tasks"},{id:"goals",label:"🎯 Goals"}].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ padding:"10px 18px", borderRadius:"10px 10px 0 0", border:"none", cursor:"pointer", background: tab===t.id?"#F0EEE9":"transparent", color: tab===t.id?T.text:"rgba(255,255,255,0.6)", fontFamily:"'Fredoka',sans-serif", fontSize:14, fontWeight:600 }}>{t.label}</button>
          ))}
        </div>
      </div>

      <div style={{ padding:"24px 24px 60px", maxWidth:900, margin:"0 auto" }}>
        {tab==="calendar" && <AdminCalendar family={family} events={events} setEvents={setEvents} memberMap={memberMap} />}
        {tab==="chores"    && <AdminChores   family={family} choreAssignments={choreAssignments} setChoreAssignments={setChoreAssignments} />}
        {tab==="tasks"    && <AdminTasks    family={family} tasks={tasks}   setTasks={setTasks} />}
        {tab==="goals"    && <AdminGoals    family={family} goals={goals}   setGoals={setGoals} />}
      </div>
    </div>
  );
}

function AdminCalendar({ family, events, setEvents, memberMap }) {
  const EMPTY_FORM = { title:"", memberIds:[], startH:9, dur:1, recurrence:"weekly", dows:[1], specificDate:"", color:null };
  const [form, setForm] = useState(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [showOAuthGuide, setShowOAuthGuide] = useState(null);
  const [connectedMembers, setConnectedMembers] = useState([]);

  // Check which members have Google Calendar connected
  useEffect(() => {
    async function checkConnections() {
      const connected = [];
      for (const m of family) {
        try {
          const res = await fetch(`/api/calendar/events?memberId=${m.id}`);
          if (res.ok) connected.push(m.id);
        } catch {}
      }
      setConnectedMembers(connected);
    }
    checkConnections();
  }, []);
  const DOW_LABELS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

  async function addEvent() {
    if (!form.title || form.memberIds.length===0) return;
    if (form.recurrence === "once" && !form.specificDate) return;
    if ((form.recurrence === "weekly" || form.recurrence === "monthly") && (!form.dows || form.dows.length === 0)) return;
    const rows = await SB.addEvent(form);
    if (rows) setEvents(prev => [...prev, ...dbEventsToApp(rows)]);
    setForm(EMPTY_FORM);
    setShowForm(false);
  }

  function recurrenceLabel(ev) {
    if (ev.recurrence === "once") return `Once · ${ev.specificDate}`;
    if (ev.recurrence === "daily") return "Every day";
    const days = ev.dows ? ev.dows.map(i=>DOW_LABELS[i].slice(0,3)).join(", ") : (ev.dow !== undefined ? DOW_LABELS[ev.dow] : "");
    if (ev.recurrence === "weekly") return `Every ${days}`;
    if (ev.recurrence === "monthly") return `Monthly · ${days}`;
    return ev.recurrence;
  }

  function formatH(h) { return h > 12 ? `${h-12}:00 PM` : h === 12 ? "12:00 PM" : `${h}:00 AM`; }

  const OAUTH_STEPS = {
    google: {
      title: "Connect Google Calendar",
      color: "#4285F4",
      steps: [
        { n:1, title:"Go to Google Cloud Console", desc:"Visit console.cloud.google.com and sign in with your Google account." },
        { n:2, title:"Create a new project", desc:'Click "Select a project" → "New Project" → name it "Family OS" → Create.' },
        { n:3, title:"Enable Google Calendar API", desc:'Go to "APIs & Services" → "Library" → search "Google Calendar API" → Enable.' },
        { n:4, title:"Create OAuth credentials", desc:'Go to "APIs & Services" → "Credentials" → "Create Credentials" → "OAuth client ID" → Web application.' },
        { n:5, title:"Add your Vercel URL", desc:'Under "Authorized redirect URIs" add: https://family-os-snowy.vercel.app/api/auth/google/callback' },
        { n:6, title:"Copy your credentials", desc:"Copy the Client ID and Client Secret — you'll add these to Supabase environment variables." },
        { n:7, title:"Come back to Claude", desc:"Share the Client ID and Client Secret with Claude and we'll wire up the full OAuth flow in your Supabase backend." },
      ]
    },
    outlook: {
      title: "Connect Outlook Calendar",
      color: "#0078D4",
      steps: [
        { n:1, title:"Go to Azure Portal", desc:"Visit portal.azure.com and sign in with your Microsoft account." },
        { n:2, title:"Register an app", desc:'Search "App registrations" → "New registration" → name it "Family OS" → Register.' },
        { n:3, title:"Add redirect URI", desc:'Go to "Authentication" → "Add a platform" → "Web" → add: https://family-os-snowy.vercel.app/api/auth/outlook/callback' },
        { n:4, title:"Add Calendar permissions", desc:'Go to "API permissions" → "Add permission" → "Microsoft Graph" → "Delegated" → add Calendars.Read.' },
        { n:5, title:"Create a client secret", desc:'Go to "Certificates & secrets" → "New client secret" → copy the Value (not the ID).' },
        { n:6, title:"Copy your credentials", desc:'Copy the Application (client) ID from the Overview page and the secret you just created.' },
        { n:7, title:"Come back to Claude", desc:"Share both values with Claude and we'll wire up the Outlook OAuth flow in your backend." },
      ]
    }
  };

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <h2 style={{ fontSize:22, fontWeight:700, color:T.text, margin:0 }}>📅 Calendar Events</h2>
        <button onClick={() => setShowForm(!showForm)} style={{ background:T.text, color:"#fff", border:"none", borderRadius:12, padding:"10px 20px", fontFamily:"'Fredoka',sans-serif", fontSize:14, fontWeight:600, cursor:"pointer" }}>+ Add Event</button>
      </div>

      {/* OAuth Setup Cards */}
      <div style={{ background:T.white, borderRadius:16, border:`2px solid ${T.border}`, padding:"18px 20px", marginBottom:20 }}>
        <h3 style={{ fontSize:17, fontWeight:700, color:T.text, margin:"0 0 4px" }}>🔗 External Calendar Sync</h3>
        <p style={{ fontSize:13, color:T.muted, fontFamily:"'Nunito',sans-serif", margin:"0 0 14px" }}>Connect your real calendars so events sync automatically.</p>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          {[
            { id:"google",  name:"Google Calendar",  icon:"📅", color:"#4285F4" },
            { id:"outlook", name:"Outlook Calendar",  icon:"📆", color:"#0078D4" },
          ].map(cal => (
            <div key={cal.id} style={{ background:"#F8F7F4", border:`2px solid ${T.border}`, borderRadius:12, padding:"14px 16px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
                <span style={{fontSize:24}}>{cal.icon}</span>
                <div>
                  <div style={{ fontWeight:700, fontSize:14, color:T.text }}>{cal.name}</div>
                  <div style={{ fontSize:11, color:T.muted, fontFamily:"'Nunito',sans-serif" }}>Requires one-time setup</div>
                </div>
              </div>
              {cal.id === "google" ? (
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {/* Per-member connect buttons */}
                  {/* Connected status */}
                  {connectedMembers.length > 0 && (
                    <div style={{ background:"#D5EEE2", borderRadius:10, padding:"8px 12px", marginBottom:4 }}>
                      <div style={{ fontSize:11, fontWeight:700, color:"#2D7A56", fontFamily:"'Nunito',sans-serif", marginBottom:4 }}>
                        ✅ Google Calendar connected:
                      </div>
                      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                        {connectedMembers.map(id => {
                          const m = memberMap[id];
                          return m ? (
                            <div key={id} style={{ display:"flex", alignItems:"center", gap:4, background:"#fff", borderRadius:99, padding:"4px 10px", fontSize:11, fontWeight:700, color:"#2D7A56", fontFamily:"'Fredoka',sans-serif" }}>
                              {m.emoji} {m.name}
                            </div>
                          ) : null;
                        })}
                      </div>
                    </div>
                  )}
                  <div style={{ fontSize:12, fontWeight:700, color:T.sub, fontFamily:"'Nunito',sans-serif", marginBottom:2 }}>
                    {connectedMembers.length > 0 ? "Connect another member:" : "Connect calendar for:"}
                  </div>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                    {family.map(m => {
                      const isConnected = connectedMembers.includes(m.id);
                      return (
                        <button key={m.id}
                          onClick={() => window.open(`/api/auth/google/login?memberId=${m.id}`, "_self")}
                          style={{ display:"flex", alignItems:"center", gap:5, padding:"7px 12px", borderRadius:99, border:`2px solid ${isConnected ? "#2D7A56" : m.color}`, background: isConnected ? "#D5EEE2" : m.light, cursor:"pointer", fontFamily:"'Fredoka',sans-serif", fontSize:12, fontWeight:700, color: isConnected ? "#2D7A56" : m.color }}
                        >
                          {isConnected ? "✓" : ""} {m.emoji} {m.name}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => setShowOAuthGuide(showOAuthGuide===cal.id ? null : cal.id)}
                    style={{ width:"100%", padding:"8px", borderRadius:10, background:T.stone, color:T.sub, border:"none", fontFamily:"'Fredoka',sans-serif", fontSize:12, cursor:"pointer" }}
                  >
                    {showOAuthGuide===cal.id ? "▲ Hide setup guide" : "▼ Setup instructions"}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowOAuthGuide(showOAuthGuide===cal.id ? null : cal.id)}
                  style={{ width:"100%", padding:"10px", borderRadius:10, background:cal.color, color:"#fff", border:"none", fontFamily:"'Fredoka',sans-serif", fontSize:13, fontWeight:700, cursor:"pointer" }}
                >
                  {showOAuthGuide===cal.id ? "▲ Hide Setup Steps" : `▼ How to Connect ${cal.name.split(" ")[0]}`}
                </button>
              )}
              {showOAuthGuide===cal.id && (
                <div style={{ marginTop:12 }}>
                  {OAUTH_STEPS[cal.id].steps.map(step => (
                    <div key={step.n} style={{ display:"flex", gap:10, marginBottom:10, alignItems:"flex-start" }}>
                      <div style={{ width:24, height:24, borderRadius:"50%", background:cal.color, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, flexShrink:0, marginTop:1 }}>{step.n}</div>
                      <div>
                        <div style={{ fontFamily:"'Fredoka',sans-serif", fontSize:13, fontWeight:700, color:T.text }}>{step.title}</div>
                        <div style={{ fontFamily:"'Nunito',sans-serif", fontSize:12, color:T.sub, marginTop:2, lineHeight:1.5 }}>{step.desc}</div>
                      </div>
                    </div>
                  ))}
                  <div style={{ background:`${cal.color}18`, border:`1.5px solid ${cal.color}44`, borderRadius:10, padding:"10px 12px", marginTop:8 }}>
                    <div style={{ fontFamily:"'Nunito',sans-serif", fontSize:12, color:T.text, fontWeight:600 }}>
                      ✅ Once you have your credentials, share them with Claude and the full sync will be wired up in about 30 minutes.
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Add Event Form */}
      {showForm && (
        <div style={{ background:T.white, borderRadius:16, border:`2px solid ${T.border}`, padding:"18px 20px", marginBottom:20 }}>
          <h3 style={{ fontSize:17, fontWeight:700, color:T.text, margin:"0 0 14px" }}>New Event</h3>

          {/* Title */}
          <div style={{ marginBottom:12 }}>
            <label style={{ fontSize:12, fontWeight:700, color:T.sub, display:"block", marginBottom:5 }}>Event Title</label>
            <input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="e.g. Math Block, Soccer Practice" style={{ width:"100%", padding:"10px 12px", borderRadius:10, border:`2px solid ${T.border}`, fontFamily:"'Fredoka',sans-serif", fontSize:14, boxSizing:"border-box" }} />
          </div>

          {/* Recurrence */}
          <div style={{ marginBottom:12 }}>
            <label style={{ fontSize:12, fontWeight:700, color:T.sub, display:"block", marginBottom:8 }}>Repeats</label>
            <div style={{ display:"flex", gap:6 }}>
              {[
                { id:"once",    label:"One-time" },
                { id:"daily",   label:"Daily" },
                { id:"weekly",  label:"Weekly" },
                { id:"monthly", label:"Monthly" },
              ].map(r => (
                <button key={r.id} onClick={() => setForm(f=>({...f,recurrence:r.id}))} style={{
                  flex:1, padding:"9px 4px", borderRadius:10, border:"none", cursor:"pointer",
                  background: form.recurrence===r.id ? T.text : T.stone,
                  color: form.recurrence===r.id ? "#fff" : T.sub,
                  fontFamily:"'Fredoka',sans-serif", fontSize:13, fontWeight:700,
                }}>{r.label}</button>
              ))}
            </div>
          </div>

          {/* Day picker — multi-select for weekly & monthly */}
          {(form.recurrence === "weekly" || form.recurrence === "monthly") && (
            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:12, fontWeight:700, color:T.sub, display:"block", marginBottom:5 }}>
                {form.recurrence === "weekly" ? "Days of Week" : "Which Days Each Month"}
                <span style={{ fontWeight:400, color:T.muted, marginLeft:6 }}>— tap to select multiple</span>
              </label>
              <div style={{ display:"flex", gap:5 }}>
                {DOW_LABELS.map((d,i) => {
                  const on = (form.dows||[]).includes(i);
                  return (
                    <button key={i} onClick={() => setForm(f => {
                      const cur = f.dows || [];
                      return { ...f, dows: on ? cur.filter(x=>x!==i) : [...cur, i].sort() };
                    })} style={{
                      flex:1, padding:"8px 2px", borderRadius:9, border:`2px solid ${on?"#3B6FA0":"transparent"}`, cursor:"pointer",
                      background: on ? "#3B6FA0" : T.stone,
                      color: on ? "#fff" : T.sub,
                      fontFamily:"'Fredoka',sans-serif", fontSize:11, fontWeight:700,
                      transition:"all 0.15s",
                    }}>{d.slice(0,3)}</button>
                  );
                })}
              </div>
              {(form.dows||[]).length === 0 && (
                <div style={{ fontSize:11, color:"#DC2626", fontFamily:"'Nunito',sans-serif", marginTop:5 }}>Please select at least one day</div>
              )}
              {(form.dows||[]).length > 0 && (
                <div style={{ fontSize:11, color:T.muted, fontFamily:"'Nunito',sans-serif", marginTop:5 }}>
                  Selected: {(form.dows||[]).map(i=>DOW_LABELS[i]).join(", ")}
                </div>
              )}
            </div>
          )}

          {/* Specific date for one-time */}
          {form.recurrence === "once" && (
            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:12, fontWeight:700, color:T.sub, display:"block", marginBottom:5 }}>Date</label>
              <input type="date" value={form.specificDate} onChange={e=>setForm(f=>({...f,specificDate:e.target.value}))} style={{ width:"100%", padding:"10px 12px", borderRadius:10, border:`2px solid ${T.border}`, fontFamily:"'Fredoka',sans-serif", fontSize:14, boxSizing:"border-box" }} />
            </div>
          )}

          {/* Time & Duration */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
            <div>
              <label style={{ fontSize:12, fontWeight:700, color:T.sub, display:"block", marginBottom:5 }}>Start Time</label>
              <select value={form.startH} onChange={e=>setForm(f=>({...f,startH:+e.target.value}))} style={{ width:"100%", padding:"10px 12px", borderRadius:10, border:`2px solid ${T.border}`, fontFamily:"'Fredoka',sans-serif", fontSize:14, boxSizing:"border-box" }}>
                {CAL_HOURS.map(h => <option key={h} value={h}>{formatH(h)}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:12, fontWeight:700, color:T.sub, display:"block", marginBottom:5 }}>Duration</label>
              <select value={form.dur} onChange={e=>setForm(f=>({...f,dur:+e.target.value}))} style={{ width:"100%", padding:"10px 12px", borderRadius:10, border:`2px solid ${T.border}`, fontFamily:"'Fredoka',sans-serif", fontSize:14, boxSizing:"border-box" }}>
                {[0.5,1,1.5,2,2.5,3,4].map(d => <option key={d} value={d}>{d===0.5?"30 min":`${d} hr`}</option>)}
              </select>
            </div>
          </div>

          {/* Who's involved */}
          <div style={{ marginBottom:16 }}>
            <label style={{ fontSize:12, fontWeight:700, color:T.sub, display:"block", marginBottom:8 }}>Who's involved?</label>
            <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
              <button onClick={() => setForm(f=>({ ...f, memberIds: f.memberIds.length===family.length ? [] : family.map(m=>m.id) }))}
                style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 14px", borderRadius:99, border:`2px solid ${form.memberIds.length===family.length ? "#2D7A56" : T.border}`, background: form.memberIds.length===family.length ? "#D5EEE2" : T.stone, cursor:"pointer", fontFamily:"'Fredoka',sans-serif", fontSize:13, fontWeight:600, color: form.memberIds.length===family.length ? "#2D7A56" : T.muted }}>
                👨‍👩‍👧‍👦 Everyone
              </button>
              {family.map(m => {
                const on = form.memberIds.includes(m.id);
                return <button key={m.id} onClick={() => setForm(f=>({...f,memberIds: on?f.memberIds.filter(id=>id!==m.id):[...f.memberIds,m.id]}))} style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 14px", borderRadius:99, border:`2px solid ${on?m.color:T.border}`, background: on?m.light:T.stone, cursor:"pointer", fontFamily:"'Fredoka',sans-serif", fontSize:13, fontWeight:600, color: on?m.color:T.muted }}>{m.emoji} {m.name}</button>;
              })}
            </div>
          </div>

          <div style={{ display:"flex", gap:10 }}>
            <button onClick={addEvent} style={{ flex:1, padding:"12px", borderRadius:12, background:T.text, color:"#fff", border:"none", fontFamily:"'Fredoka',sans-serif", fontSize:15, fontWeight:700, cursor:"pointer" }}>Add to Calendar</button>
            <button onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }} style={{ padding:"12px 20px", borderRadius:12, background:T.stone, color:T.sub, border:"none", fontFamily:"'Fredoka',sans-serif", fontSize:15, cursor:"pointer" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Event List */}
      <div style={{ background:T.white, borderRadius:16, border:`2px solid ${T.border}`, padding:"18px 20px" }}>
        <h3 style={{ fontSize:17, fontWeight:700, color:T.text, margin:"0 0 14px" }}>All Events ({events.length})</h3>
        {events.length === 0 && <div style={{ textAlign:"center", padding:"20px 0", color:T.muted, fontFamily:"'Nunito',sans-serif", fontSize:14 }}>No events yet — add one above</div>}
        {events.map(ev => {
          const recTag = { once:"One-time", daily:"Daily", weekly:"Weekly", monthly:"Monthly" }[ev.recurrence] || "Weekly";
          return (
            <div key={ev.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 12px", borderRadius:12, background:"#F8F7F4", border:`1px solid ${T.border}`, marginBottom:8 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, fontSize:14, color:T.text }}>{ev.title}</div>
                <div style={{ fontSize:11, color:T.muted, marginTop:2, fontFamily:"'Nunito',sans-serif" }}>
                  {recurrenceLabel(ev)} · {formatH(ev.startH)} · {ev.dur}hr · {ev.memberIds.map(id=>memberMap[id]?.emoji).join(" ")}
                </div>
              </div>
              <div style={{ background: recTag==="One-time"?"#F3E5FF":recTag==="Daily"?"#D5EEE2":recTag==="Monthly"?"#FDEEDE":"#D6E8F7", color: recTag==="One-time"?"#7C5C9E":recTag==="Daily"?"#2D7A56":recTag==="Monthly"?"#D4732A":"#3B6FA0", borderRadius:99, padding:"3px 9px", fontSize:11, fontWeight:700, fontFamily:"'Fredoka',sans-serif", flexShrink:0 }}>
                {recTag}
              </div>
              <button onClick={async () => { await SB.deleteEvent(ev.id); setEvents(prev=>prev.filter(e=>e.id!==ev.id)); }} style={{ padding:"6px 12px", borderRadius:8, background:"#FEE2E2", color:"#DC2626", border:"none", fontFamily:"'Fredoka',sans-serif", fontSize:12, fontWeight:600, cursor:"pointer" }}>Remove</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Admin: Chores ─────────────────────────────────────────────────────────────
const DOW_LABELS_FULL = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const FREQ_GROUPS = [
  { id:"daily_all",    label:"Daily (Everyone)",  color:"#4D96FF", chores: DAILY_CHORES_ALL,      desc:"Auto-assigned to all family members every day" },
  { id:"daily_ind",   label:"Daily (Assign)",     color:"#6BCB77", chores: DAILY_CHORES_INDIVIDUAL, desc:"Assign to specific people — shows up every day" },
  { id:"weekly",      label:"Weekly",              color:"#FF9F45", chores: null,                   desc:"Assign by day of week" },
  { id:"monthly",     label:"Monthly",             color:"#C77DFF", chores: MONTHLY_CHORES,         desc:"Appears on the 1st Thursday of each month" },
  { id:"quarterly",   label:"Quarterly",           color:"#FF6B6B", chores: QUARTERLY_CHORES,       desc:"Appears on the 1st Thursday of each quarter" },
  { id:"semi_annual", label:"Semi-Annual",         color:"#E8824A", chores: SEMI_ANNUAL_CHORES,     desc:"Appears on the 1st Thursday of Jan & Jul" },
  { id:"annual",      label:"Annual",              color:"#2D7A56", chores: ANNUAL_CHORES,          desc:"Appears on the 1st Thursday of January" },
];

function AdminChores({ family, choreAssignments, setChoreAssignments }) {
  const [activeFreq, setActiveFreq] = useState("daily_ind");
  const [activeDow, setActiveDow] = useState(1);

  async function toggleAssignment(chore, memberId) {
    setChoreAssignments(prev => {
      const current = prev[chore] || [];
      const updated = current.includes(memberId)
        ? current.filter(id => id !== memberId)
        : [...current, memberId];
      const next = { ...prev, [chore]: updated };
      // Write to Supabase
      SB.upsertChore(chore, updated);
      return next;
    });
  }

  const freq = FREQ_GROUPS.find(f => f.id === activeFreq);
  const choresForView = activeFreq === "weekly"
    ? (WEEKLY_CHORES[activeDow] || [])
    : (freq?.chores || []);

  return (
    <div>
      <h2 style={{ fontSize:22, fontWeight:700, color:T.text, margin:"0 0 6px" }}>🧹 Chore Assignment</h2>
      <p style={{ fontSize:13, color:T.muted, margin:"0 0 18px", fontFamily:"'Nunito',sans-serif" }}>
        Assign chores to family members. They automatically appear on the Today page on the right day.
      </p>

      {/* Frequency tabs */}
      <div style={{ display:"flex", gap:6, marginBottom:16, overflowX:"auto", paddingBottom:4 }}>
        {FREQ_GROUPS.map(f => (
          <button key={f.id} onClick={() => setActiveFreq(f.id)} style={{
            padding:"8px 14px", borderRadius:99, border:"none", cursor:"pointer", flexShrink:0,
            background: activeFreq===f.id ? f.color : T.stone,
            color: activeFreq===f.id ? "#fff" : T.sub,
            fontFamily:"'Fredoka',sans-serif", fontSize:13, fontWeight:700,
          }}>{f.label}</button>
        ))}
      </div>

      {/* Description */}
      <div style={{ background:freq.color+"18", border:`1.5px solid ${freq.color}44`, borderRadius:12, padding:"10px 14px", marginBottom:16 }}>
        <span style={{ fontFamily:"'Nunito',sans-serif", fontSize:13, color:T.sub }}>{freq.desc}</span>
      </div>

      {/* Day of week picker for weekly */}
      {activeFreq === "weekly" && (
        <div style={{ display:"flex", gap:6, marginBottom:16 }}>
          {DOW_LABELS_FULL.map((d, i) => (
            <button key={i} onClick={() => setActiveDow(i)} style={{
              flex:1, padding:"8px 4px", borderRadius:10, border:"none", cursor:"pointer",
              background: activeDow===i ? freq.color : T.stone,
              color: activeDow===i ? "#fff" : T.sub,
              fontFamily:"'Fredoka',sans-serif", fontSize:12, fontWeight:700,
            }}>{d.slice(0,3)}</button>
          ))}
        </div>
      )}

      {/* Daily-all notice */}
      {activeFreq === "daily_all" && (
        <div style={{ background:"#F0FDF4", border:"1.5px solid #86EFAC", borderRadius:12, padding:"12px 16px", marginBottom:16 }}>
          <div style={{ fontFamily:"'Nunito',sans-serif", fontSize:13, color:"#166534", fontWeight:600 }}>
            ✅ These chores are automatically assigned to everyone — no action needed.
          </div>
          <div style={{ marginTop:8, display:"flex", flexWrap:"wrap", gap:6 }}>
            {DAILY_CHORES_ALL.map(c => (
              <div key={c} style={{ background:"#DCFCE7", color:"#166534", borderRadius:99, padding:"4px 12px", fontFamily:"'Nunito',sans-serif", fontSize:12, fontWeight:600 }}>{c}</div>
            ))}
          </div>
        </div>
      )}

      {/* Chore assignment grid */}
      {activeFreq !== "daily_all" && (
        <div style={{ background:T.white, borderRadius:16, border:`2px solid ${T.border}`, overflow:"hidden" }}>
          {/* Header row */}
          <div style={{ display:"grid", gridTemplateColumns:`1fr ${family.map(()=>"64px").join(" ")}`, background:T.stone, padding:"10px 16px", gap:8 }}>
            <div style={{ fontFamily:"'Fredoka',sans-serif", fontSize:13, fontWeight:700, color:T.sub }}>Chore</div>
            {family.map(m => (
              <div key={m.id} style={{ textAlign:"center", fontFamily:"'Fredoka',sans-serif", fontSize:12, fontWeight:700, color:T.sub }}>
                {m.emoji}<br/>{m.name}
              </div>
            ))}
          </div>

          {/* Chore rows */}
          {choresForView.length === 0 && (
            <div style={{ textAlign:"center", padding:"24px", color:T.muted, fontFamily:"'Nunito',sans-serif", fontSize:14 }}>No chores for this selection</div>
          )}
          {choresForView.map((chore, i) => {
            const assigned = choreAssignments[chore] || [];
            return (
              <div key={chore} style={{
                display:"grid", gridTemplateColumns:`1fr ${family.map(()=>"64px").join(" ")}`,
                padding:"10px 16px", gap:8, alignItems:"center",
                background: i%2===0 ? T.white : "#FAFAF8",
                borderTop: `1px solid ${T.border}`,
              }}>
                <div style={{ fontFamily:"'Nunito',sans-serif", fontSize:13, fontWeight:600, color:T.text }}>{chore}</div>
                {family.map(m => {
                  const isOn = assigned.includes(m.id);
                  return (
                    <div key={m.id} style={{ display:"flex", justifyContent:"center" }}>
                      <button
                        onClick={() => toggleAssignment(chore, m.id)}
                        style={{
                          width:36, height:36, borderRadius:"50%",
                          border:`2.5px solid ${isOn ? m.color : T.border}`,
                          background: isOn ? m.color : "transparent",
                          cursor:"pointer", fontSize:16, display:"flex",
                          alignItems:"center", justifyContent:"center",
                          transition:"all 0.15s",
                        }}
                      >
                        {isOn ? <span style={{ color:"#fff", fontSize:14 }}>✓</span> : ""}
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* Summary */}
      {activeFreq !== "daily_all" && (
        <div style={{ marginTop:16 }}>
          <div style={{ fontFamily:"'Fredoka',sans-serif", fontSize:14, fontWeight:700, color:T.text, marginBottom:8 }}>Assignment Summary</div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            {family.map(m => {
              const count = choresForView.filter(c => (choreAssignments[c]||[]).includes(m.id)).length;
              return (
                <div key={m.id} style={{ background:m.light, border:`1.5px solid ${m.color}44`, borderRadius:12, padding:"8px 14px", display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{fontSize:18}}>{m.emoji}</span>
                  <div>
                    <div style={{ fontFamily:"'Fredoka',sans-serif", fontSize:13, fontWeight:700, color:m.color }}>{m.name}</div>
                    <div style={{ fontFamily:"'Nunito',sans-serif", fontSize:11, color:T.muted }}>{count} chore{count!==1?"s":""} assigned</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function AdminTasks({ family, tasks, setTasks, choreAssignments, setChoreAssignments }) {
  const [activeMember, setActiveMember] = useState(family[0]);
  const [activeSection, setActiveSection] = useState("learn");
  const [showForm, setShowForm] = useState(false);
  const TASK_SECTIONS = SECTIONS.filter(s => s.id !== "contribute");
  const sec = TASK_SECTIONS.find(s => s.id===activeSection) || TASK_SECTIONS[0];
  const currentTasks = tasks[activeMember.id]?.[sec.id] || [];
  const DOW_LABELS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  const EMPTY_FORM = { label:"", recurrence:"daily", dows:[1,2,3,4,5], specificDate:"" };
  const [form, setForm] = useState(EMPTY_FORM);

  function taskRecurrenceLabel(task) {
    if (!task.recurrence || task.recurrence === "daily") return "Every day";
    if (task.recurrence === "weekly") {
      const days = (task.dows||[]).map(i=>DOW_LABELS[i]).join(", ");
      return `Every ${days}`;
    }
    if (task.recurrence === "once") return `Once · ${task.specificDate||""}`;
    return task.recurrence;
  }

  function taskMatchesDate(task, date) {
    if (!task.recurrence || task.recurrence === "daily") return true;
    if (task.recurrence === "weekly") return (task.dows||[]).includes(date.getDay());
    if (task.recurrence === "once" && task.specificDate) {
      return new Date(task.specificDate+"T00:00:00").toDateString() === date.toDateString();
    }
    return true;
  }

  async function addTask() {
    if (!form.label.trim()) return;
    if (form.recurrence === "once" && !form.specificDate) return;
    if (form.recurrence === "weekly" && form.dows.length === 0) return;
    const rows = await SB.addTask(activeMember.id, sec.id, form.label.trim(), form.recurrence, form.dows, form.specificDate);
    if (rows && rows[0]) {
      const newT = { id: rows[0].id, label: rows[0].label, done: false, recurrence: rows[0].recurrence, dows: rows[0].dows, specificDate: rows[0].specific_date };
      setTasks(prev => ({ ...prev, [activeMember.id]: { ...prev[activeMember.id], [sec.id]: [...(prev[activeMember.id]?.[sec.id]||[]), newT] } }));
    }
    setForm(EMPTY_FORM);
    setShowForm(false);
  }

  return (
    <div>
      <h2 style={{ fontSize:22, fontWeight:700, color:T.text, margin:"0 0 6px" }}>⚡ Task Setup</h2>
      <p style={{ fontSize:13, color:T.muted, margin:"0 0 18px", fontFamily:"'Nunito',sans-serif" }}>
        Add Learn, Exercise, and Goals tasks per person. For chores, use the 🧹 Chores tab.
      </p>

      {/* Member selector */}
      <div style={{ display:"flex", gap:8, marginBottom:16, overflowX:"auto" }}>
        {family.map(m => (
          <button key={m.id} onClick={() => setActiveMember(m)} style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 16px", borderRadius:99, flexShrink:0, cursor:"pointer", background: activeMember.id===m.id?m.color:T.stone, border: activeMember.id===m.id?`2px solid ${m.color}`:"2px solid transparent" }}>
            <span style={{fontSize:15}}>{m.emoji}</span>
            <span style={{ fontFamily:"'Fredoka',sans-serif", fontSize:14, fontWeight:600, color: activeMember.id===m.id?"#fff":T.sub }}>{m.name}</span>
          </button>
        ))}
      </div>

      {/* Section selector */}
      <div style={{ display:"flex", gap:6, marginBottom:16 }}>
        {TASK_SECTIONS.map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id)} style={{ flex:1, padding:"10px 8px", borderRadius:12, border:"none", cursor:"pointer", background: sec.id===s.id?s.color:T.stone, color: sec.id===s.id?"#fff":T.sub, fontFamily:"'Fredoka',sans-serif", fontSize:13, fontWeight:700 }}>
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      {/* Task list */}
      <div style={{ background:T.white, borderRadius:16, border:`2px solid ${T.border}`, padding:"18px", marginBottom:14 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <div style={{ fontSize:16, fontWeight:700, color:T.text }}>{activeMember.name}'s {sec.label} Tasks</div>
          <button onClick={() => setShowForm(!showForm)} style={{ background:sec.color, color:"#fff", border:"none", borderRadius:10, padding:"7px 14px", fontFamily:"'Fredoka',sans-serif", fontSize:13, fontWeight:700, cursor:"pointer" }}>+ Add Task</button>
        </div>
        {currentTasks.length===0
          ? <div style={{ textAlign:"center", padding:"16px 0", color:T.muted, fontFamily:"'Nunito',sans-serif", fontSize:14 }}>No tasks yet — add one above</div>
          : currentTasks.map(task => (
            <div key={task.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", borderRadius:10, background:"#F8F7F4", border:`1px solid ${T.border}`, marginBottom:6 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontFamily:"'Nunito',sans-serif", fontSize:13, fontWeight:600, color:T.text }}>{task.label}</div>
                <div style={{ fontSize:11, color:T.muted, marginTop:2, fontFamily:"'Nunito',sans-serif" }}>{taskRecurrenceLabel(task)}</div>
              </div>
              <button onClick={async () => { await SB.deleteTask(task.id); setTasks(prev => ({ ...prev, [activeMember.id]: { ...prev[activeMember.id], [sec.id]: prev[activeMember.id][sec.id].filter(t=>t.id!==task.id) } })); }} style={{ padding:"5px 10px", borderRadius:8, background:"#FEE2E2", color:"#DC2626", border:"none", fontFamily:"'Fredoka',sans-serif", fontSize:12, fontWeight:600, cursor:"pointer" }}>✕</button>
            </div>
          ))
        }
      </div>

      {/* Add task form */}
      {showForm && (
        <div style={{ background:T.white, borderRadius:16, border:`2px solid ${T.border}`, padding:"18px", marginBottom:14 }}>
          <h3 style={{ fontSize:16, fontWeight:700, color:T.text, margin:"0 0 14px" }}>New {sec.label} Task</h3>

          {/* Label */}
          <div style={{ marginBottom:12 }}>
            <label style={{ fontSize:12, fontWeight:700, color:T.sub, display:"block", marginBottom:5 }}>Task Description</label>
            <input value={form.label} onChange={e=>setForm(f=>({...f,label:e.target.value}))}
              placeholder={`e.g. ${sec.id==="learn"?"Read 30 minutes":sec.id==="exercise"?"20 min run":"Write in journal"}`}
              style={{ width:"100%", padding:"10px 12px", borderRadius:10, border:`2px solid ${T.border}`, fontFamily:"'Fredoka',sans-serif", fontSize:14, boxSizing:"border-box" }} />
          </div>

          {/* Recurrence */}
          <div style={{ marginBottom:12 }}>
            <label style={{ fontSize:12, fontWeight:700, color:T.sub, display:"block", marginBottom:8 }}>Repeats</label>
            <div style={{ display:"flex", gap:6 }}>
              {[{id:"once",label:"One-time"},{id:"daily",label:"Daily"},{id:"weekly",label:"Weekly"}].map(r => (
                <button key={r.id} onClick={() => setForm(f=>({...f,recurrence:r.id}))} style={{
                  flex:1, padding:"9px 4px", borderRadius:10, border:"none", cursor:"pointer",
                  background: form.recurrence===r.id ? T.text : T.stone,
                  color: form.recurrence===r.id ? "#fff" : T.sub,
                  fontFamily:"'Fredoka',sans-serif", fontSize:13, fontWeight:700,
                }}>{r.label}</button>
              ))}
            </div>
          </div>

          {/* Day picker for weekly */}
          {form.recurrence === "weekly" && (
            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:12, fontWeight:700, color:T.sub, display:"block", marginBottom:8 }}>
                Days of Week <span style={{ fontWeight:400, color:T.muted }}>— tap to select multiple</span>
              </label>
              <div style={{ display:"flex", gap:5 }}>
                {DOW_LABELS.map((d,i) => {
                  const on = form.dows.includes(i);
                  return (
                    <button key={i} onClick={() => setForm(f => ({ ...f, dows: on?f.dows.filter(x=>x!==i):[...f.dows,i].sort() }))}
                      style={{ flex:1, padding:"8px 2px", borderRadius:9, border:`2px solid ${on?sec.color:"transparent"}`, cursor:"pointer", background: on?sec.color:T.stone, color: on?"#fff":T.sub, fontFamily:"'Fredoka',sans-serif", fontSize:11, fontWeight:700 }}>
                      {d}
                    </button>
                  );
                })}
              </div>
              {form.dows.length > 0 && (
                <div style={{ fontSize:11, color:T.muted, fontFamily:"'Nunito',sans-serif", marginTop:5 }}>
                  Selected: {form.dows.map(i=>["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][i]).join(", ")}
                </div>
              )}
            </div>
          )}

          {/* Specific date for one-time */}
          {form.recurrence === "once" && (
            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:12, fontWeight:700, color:T.sub, display:"block", marginBottom:5 }}>Date</label>
              <input type="date" value={form.specificDate} onChange={e=>setForm(f=>({...f,specificDate:e.target.value}))}
                style={{ width:"100%", padding:"10px 12px", borderRadius:10, border:`2px solid ${T.border}`, fontFamily:"'Fredoka',sans-serif", fontSize:14, boxSizing:"border-box" }} />
            </div>
          )}

          <div style={{ display:"flex", gap:10 }}>
            <button onClick={addTask} style={{ flex:1, padding:"12px", borderRadius:12, background:sec.color, color:"#fff", border:"none", fontFamily:"'Fredoka',sans-serif", fontSize:15, fontWeight:700, cursor:"pointer" }}>Add Task</button>
            <button onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }} style={{ padding:"12px 20px", borderRadius:12, background:T.stone, color:T.sub, border:"none", fontFamily:"'Fredoka',sans-serif", fontSize:15, cursor:"pointer" }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminGoals({ family, goals, setGoals, dbGoalRows }) {
  const [activeMember, setActiveMember] = useState(family[2]||family[0]);
  const [activeQuad, setActiveQuad] = useState("spiritual");
  const [newGoal, setNewGoal] = useState("");
  const quad = QUAD.find(q=>q.id===activeQuad);
  const currentGoals = goals[activeMember.id]?.[activeQuad] || [];

  async function addGoal() {
    if (!newGoal.trim()) return;
    await SB.addGoal(activeMember.id, activeQuad, newGoal.trim());
    setGoals(prev => ({ ...prev, [activeMember.id]: { ...prev[activeMember.id], [activeQuad]: [...(prev[activeMember.id]?.[activeQuad]||[]), newGoal.trim()] } }));
    setNewGoal("");
  }

  return (
    <div>
      <h2 style={{ fontSize:22, fontWeight:700, color:T.text, margin:"0 0 6px" }}>Goal Setup</h2>
      <p style={{ fontSize:13, color:T.muted, margin:"0 0 18px", fontFamily:"'Nunito',sans-serif" }}>Set goals for each person across the four growth quadrants. These appear on the Progress page.</p>
      <div style={{ display:"flex", gap:8, marginBottom:16, overflowX:"auto" }}>
        {family.map(m => <button key={m.id} onClick={() => setActiveMember(m)} style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 16px", borderRadius:99, flexShrink:0, cursor:"pointer", background: activeMember.id===m.id?m.color:T.stone, border: activeMember.id===m.id?`2px solid ${m.color}`:"2px solid transparent" }}><span style={{fontSize:15}}>{m.emoji}</span><span style={{ fontFamily:"'Fredoka',sans-serif", fontSize:14, fontWeight:600, color: activeMember.id===m.id?"#fff":T.sub }}>{m.name}</span></button>)}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:16 }}>
        {QUAD.map(q => {
          const qGoals = goals[activeMember.id]?.[q.id]||[];
          const active = q.id===activeQuad;
          return (
            <button key={q.id} onClick={() => setActiveQuad(q.id)} style={{ padding:"14px", borderRadius:14, border:`2px solid ${active?q.color:T.border}`, background: active?q.color+"22":T.white, cursor:"pointer", textAlign:"left" }}>
              <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:4 }}>
                <span style={{fontSize:16}}>{q.icon}</span>
                <span style={{ fontFamily:"'Fredoka',sans-serif", fontSize:13, fontWeight:700, color:q.color }}>{q.label}</span>
                <span style={{ marginLeft:"auto", fontFamily:"'Nunito',sans-serif", fontSize:11, color:T.muted }}>{qGoals.length}</span>
              </div>
              {qGoals.slice(0,2).map((g,i) => <div key={i} style={{ fontSize:11, color:T.sub, fontFamily:"'Nunito',sans-serif", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", marginBottom:2 }}>· {g}</div>)}
            </button>
          );
        })}
      </div>
      <div style={{ background:T.white, borderRadius:16, border:`2px solid ${quad.color}55`, borderTop:`3px solid ${quad.color}`, padding:"16px 18px", marginBottom:12 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
          <span style={{fontSize:18}}>{quad.icon}</span>
          <span style={{ fontSize:16, fontWeight:700, color:quad.color }}>{activeMember.name}'s {quad.label} Goals</span>
        </div>
        {currentGoals.length===0 ? <div style={{ textAlign:"center", padding:"16px 0", color:T.muted, fontFamily:"'Nunito',sans-serif", fontSize:14 }}>No goals yet</div> : currentGoals.map((g,i) => (
          <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", borderRadius:10, background:"#F8F7F4", border:`1px solid ${T.border}`, marginBottom:6 }}>
            <div style={{ width:8, height:8, borderRadius:"50%", background:quad.color, flexShrink:0 }} />
            <span style={{ flex:1, fontFamily:"'Nunito',sans-serif", fontSize:13, fontWeight:600, color:T.text }}>{g}</span>
            <button onClick={async () => {
                const row = (dbGoalRows||[]).find(r => r.member_id===activeMember.id && r.quadrant===activeQuad && r.label===g);
                if (row) await SB.deleteGoal(row.id);
                setGoals(prev=>({ ...prev, [activeMember.id]: { ...prev[activeMember.id], [activeQuad]: prev[activeMember.id][activeQuad].filter((_,idx)=>idx!==i) } }));
              }} style={{ padding:"5px 10px", borderRadius:8, background:"#FEE2E2", color:"#DC2626", border:"none", fontFamily:"'Fredoka',sans-serif", fontSize:12, fontWeight:600, cursor:"pointer" }}>✕</button>
          </div>
        ))}
      </div>
      <div style={{ display:"flex", gap:10 }}>
        <input value={newGoal} onChange={e=>setNewGoal(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addGoal()} placeholder={`Add a ${quad.label.toLowerCase()} goal for ${activeMember.name}…`} style={{ flex:1, padding:"12px 16px", borderRadius:12, border:`2px solid ${T.border}`, fontFamily:"'Fredoka',sans-serif", fontSize:14 }} />
        <button onClick={addGoal} style={{ padding:"12px 20px", borderRadius:12, background:quad.color, color:"#fff", border:"none", fontFamily:"'Fredoka',sans-serif", fontSize:15, fontWeight:700, cursor:"pointer" }}>Add</button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ROOT
// ════════════════════════════════════════════════════════════════════════════
function AppInner() {
  const [page, setPage]   = useState("today");
  const [family]          = useState(FAMILY_INIT);
  const [adminMode, setAdminMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [screensaver, setScreensaver] = useState(false);
  const inactivityTimer = useState(null);

  // Supabase-backed state
  const [events,           setEvents]           = useState([]);
  const [choreAssignments, setChoreAssignments] = useState({});
  const [tasks,            setTasks]            = useState(INIT_TASKS);
  const [goals,            setGoals]            = useState(INIT_GOALS);
  const [streaks,          setStreaks]           = useState(INIT_STREAKS);
  const [weekPts,          setWeekPts]          = useState(INIT_WEEK_PTS);
  const [rainbowDays,      setRainbowDays]       = useState([]);
  const [allCompletions,   setAllCompletions]    = useState([]);
  const [dbTaskRows,       setDbTaskRows]        = useState([]);
  const [dbGoalRows,       setDbGoalRows]        = useState([]);

  // Load all data from Supabase on mount
  async function loadAll() {
    setLoading(true);
    try {
      const evRows = await SB.getEvents().catch(() => []);
      const choreRows = await SB.getChores().catch(() => []);
      const taskRows = await SB.getTasks().catch(() => []);
      const goalRows = await SB.getGoals().catch(() => []);
      const manualEvents = dbEventsToApp(evRows || []);

      // Fetch Google Calendar events for all connected members
      const gcalEvents = [];
      for (const member of FAMILY_INIT) {
        try {
          const res = await fetch(`/api/calendar/events?memberId=${member.id}`);
          if (res.status === 200) {
            const text = await res.text();
            try {
              const data = JSON.parse(text);
              console.log(`📅 ${member.id}: ${data.events?.length || 0} events from`, data.calendarsFound?.join(', '));
              if (data.events && data.events.length > 0) gcalEvents.push(...data.events);
            } catch(parseErr) {
              console.warn(`⚠️ ${member.id} JSON parse failed:`, text.slice(0,100));
            }
          } else if (res.status !== 404) {
            console.warn(`⚠️ ${member.id} returned ${res.status}`);
          }
        } catch(e) {
          console.warn(`⚠️ ${member.id} fetch error:`, e.message);
        }
      }
      console.log(`📅 Total Google Calendar events loaded: ${gcalEvents.length}`);

      // Merge manual + Google Calendar events
      setEvents([...manualEvents, ...gcalEvents]);
      const rdRows = await SB.getRainbowDays().catch(() => []);
      setRainbowDays(rdRows || []);
      // Fetch last 60 days of completions for badge calculation
      const allCompRows = await sb("task_completions", "GET", null,
        `?completed_date=gte.${new Date(Date.now()-60*24*60*60*1000).toISOString().slice(0,10)}&order=completed_date.desc`
      ).catch(() => []);
      setAllCompletions(allCompRows || []);
      setChoreAssignments(dbChoresToApp(choreRows || []));
      setDbTaskRows(taskRows || []);
      setTasks(dbTasksToApp(taskRows || []));
      setDbGoalRows(goalRows || []);
      setGoals(dbGoalsToApp(goalRows || []));
    } catch(e) {
      console.error("Load error:", e);
    }
    setLoading(false);
  }

  useEffect(() => {
    const link = document.createElement("link");
    link.href = FONT_URL; link.rel = "stylesheet";
    document.head.appendChild(link);
    const style = document.createElement("style");
    style.textContent = `
      *, *::before, *::after { box-sizing: border-box; }
      html, body, #root { margin: 0 !important; padding: 0 !important; width: 100% !important; overflow-x: hidden; }
      * { -webkit-overflow-scrolling: touch; }
      ::-webkit-scrollbar { display: none !important; }
      * { scrollbar-width: none !important; -ms-overflow-style: none !important; }
      html, body { touch-action: manipulation; }
      .scroll-col { touch-action: pan-y !important; user-select: none !important; -webkit-user-select: none !important; overflow-y: auto !important; }
      .scroll-col * { user-select: none !important; -webkit-user-select: none !important; pointer-events: auto; }
    `;
    document.head.appendChild(style);
    document.body.style.margin = "0";
    document.body.style.padding = "0";
    document.body.style.width = "100vw";
    document.documentElement.style.margin = "0";
    document.documentElement.style.padding = "0";
    document.body.style.background = T.bg;
    document.body.style.overscrollBehavior = "none";

    // Override any Vite default styles on #root
    const rootEl = document.getElementById('root');
    if (rootEl) {
      rootEl.style.cssText = 'max-width:100% !important; width:100% !important; margin:0 !important; padding:0 !important;';
    }
    // Inject a style tag to permanently override #root
    const overrideStyle = document.createElement('style');
    overrideStyle.textContent = '#root { max-width: 100% !important; width: 100% !important; margin: 0 !important; padding: 0 !important; }';
    document.head.appendChild(overrideStyle);

    loadAll();

    // Screensaver inactivity timer
    let timer = null;
    function resetTimer() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setScreensaver(true), SCREENSAVER_TIMEOUT_MS);
    }
    function onActivity() {
      setScreensaver(false);
      resetTimer();
    }
    const events = ["mousedown","mousemove","keypress","touchstart","click","scroll"];
    events.forEach(e => window.addEventListener(e, onActivity, { passive: true }));
    resetTimer();

    const check = () => {
      const hash = window.location.hash;
      setAdminMode(hash.startsWith("#admin"));
      // If returning from Google OAuth, reload all data
      if (hash.includes("calendar_connected=true")) {
        loadAll();
      }
    };
    check();
    window.addEventListener("hashchange", check);
    return () => {
      window.removeEventListener("hashchange", check);
      events.forEach(e => window.removeEventListener(e, onActivity));
      if (timer) clearTimeout(timer);
    };
  }, []);

  // Screensaver overlay — renders on top of everything
  const screensaverEl = screensaver ? <Screensaver onDismiss={() => setScreensaver(false)} /> : null;

  if (loading) return (
    <>
      {screensaverEl}
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100vh", background:T.bg, fontFamily:"'Fredoka',sans-serif", gap:16 }}>
        <div style={{ fontSize:48 }}>🏡</div>
        <div style={{ fontSize:20, fontWeight:700, color:T.text }}>Loading Family OS…</div>
        <div style={{ fontSize:14, color:T.muted }}>Connecting to database</div>
      </div>
    </>
  );

  if (adminMode) return <AdminPage family={family} events={events} setEvents={setEvents} tasks={tasks} setTasks={setTasks} goals={goals} setGoals={setGoals} choreAssignments={choreAssignments} setChoreAssignments={setChoreAssignments} dbTaskRows={dbTaskRows} dbGoalRows={dbGoalRows} onReload={loadAll} />;

  const goAdmin = () => { window.location.hash = "#admin"; };

  return (
    <div style={{ background:T.bg, width:"100vw", minHeight:"100vh", overflowX:"hidden" }}>
      <TopBar onAdmin={goAdmin} />
      {page==="calendar" && <CalendarPage family={family} events={events} />}
      {page==="today"    && <TodayPage    family={family} tasks={tasks} choreAssignments={choreAssignments} onRainbowDay={(memberId, dateStr) => { SB.logRainbowDay(memberId, dateStr); SB.getRainbowDays().then(r => setRainbowDays(r||[])); }} />}
      {page==="progress" && <ProgressPage family={family} goals={goals} setGoals={setGoals} streaks={streaks} weekPts={weekPts} rainbowDays={rainbowDays} allCompletions={allCompletions} tasks={tasks} dbGoalRows={dbGoalRows} />}
      <BottomNav page={page} onPage={setPage} />
    </div>
  );
}

export default function App() {
  return <ErrorBoundary><AppInner /></ErrorBoundary>;
}
