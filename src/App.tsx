import { useState, useEffect } from "react";

const FONT_URL =
  "https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Nunito:wght@400;600;700;800;900&display=swap";

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
      <button onClick={onAdmin} style={{
        display:"flex", alignItems:"center", gap:6,
        background:T.stone, border:`2px solid ${T.border}`,
        borderRadius:99, padding:"6px 14px", cursor:"pointer",
        fontFamily:"'Fredoka',sans-serif", fontSize:13, fontWeight:600, color:T.sub,
      }}>
        <span style={{ fontSize:15 }}>⚙️</span> Admin
      </button>
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
const CAL_HOURS = Array.from({ length:15 }, (_, i) => i + 6);
const CELL_H = 52;

const INIT_CAL_EVENTS = [];

function CalendarPage({ family, events }) {
  const memberMap = Object.fromEntries(family.map(m => [m.id, m]));
  const [weekAnchor, setWeekAnchor] = useState(TODAY_DATE);
  const [visibleIds, setVisibleIds] = useState(new Set(family.map(m => m.id)));
  const weekDates = getWeekDates(weekAnchor);
  const todayStr = TODAY_DATE.toDateString();
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
      <div style={{ flex:1, display:"flex", overflow:"hidden" }}>
        <div style={{ width:46, flexShrink:0, borderRight:`1px solid ${T.border}`, overflowY:"hidden" }}>
          <div style={{ height:44, borderBottom:`1px solid ${T.border}`, background:T.bg }} />
          {CAL_HOURS.map(h => (
            <div key={h} style={{ height:CELL_H, display:"flex", alignItems:"flex-start", justifyContent:"flex-end", paddingRight:7, paddingTop:5 }}>
              <span style={{ fontSize:10, color:T.muted, fontWeight:600 }}>{h>12?`${h-12}p`:h===12?"12p":`${h}a`}</span>
            </div>
          ))}
        </div>
        <div style={{ flex:1, display:"flex", overflowX:"auto", overflowY:"hidden", WebkitOverflowScrolling:"touch", width:"100%", alignItems:"stretch" }}>
          {weekDates.map((date, dowIdx) => {
            const isToday = date.toDateString()===todayStr;
            const dayEvs = visibleEvents.filter(ev => ev.dow===dowIdx);
            return (
              <div key={dowIdx} style={{ minWidth:0, flex:"1 1 0%", borderRight: dowIdx<6?`1px solid ${T.border}`:"none", position:"relative" }}>
                <div style={{ height:44, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", borderBottom:`1px solid ${T.border}`, position:"sticky", top:0, zIndex:9, background: isToday?T.text:T.bg, borderRadius: isToday?"0 0 12px 12px":0 }}>
                  <span style={{ fontSize:10, fontWeight:700, letterSpacing:0.5, textTransform:"uppercase", color: isToday?"rgba(255,255,255,0.6)":T.muted }}>{DAYS_SHORT[date.getDay()]}</span>
                  <span style={{ fontSize:16, fontWeight:700, color: isToday?T.white:T.text }}>{date.getDate()}</span>
                </div>
                <div style={{ position:"relative", height:CAL_HOURS.length*CELL_H }}>
                  {CAL_HOURS.map((_,i) => <div key={i} style={{ position:"absolute", top:i*CELL_H, left:0, right:0, borderTop:`1px solid ${T.border}`, height:CELL_H }} />)}
                  {dayEvs.map(ev => {
                    const mColors = ev.memberIds.map(id => memberMap[id]?.color).filter(Boolean);
                    const isMulti = mColors.length > 1;
                    const sStyle = isMulti ? stripeStyle(mColors) : { background: mColors[0]+"DD" };
                    return (
                      <div key={ev.id} style={{ position:"absolute", top:(ev.startH-6)*CELL_H+3, left:4, right:4, height:ev.dur*CELL_H-6, borderRadius:14, ...sStyle, display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden", zIndex:2, boxShadow:"0 2px 8px rgba(0,0,0,0.12)" }}>
                        <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", background:"rgba(255,255,255,0.22)", padding:"4px 6px" }}>
                          <div style={{ fontSize:11, fontWeight:700, color:"#fff", textAlign:"center", lineHeight:1.3, textShadow:"0 1px 3px rgba(0,0,0,0.4)" }}>{ev.title}</div>
                          {ev.dur >= 0.75 && <div style={{ fontSize:10, color:"rgba(255,255,255,0.85)", marginTop:2 }}>{ev.memberIds.map(id=>memberMap[id]?.emoji).join("")}</div>}
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
  );
}

// ════════════════════════════════════════════════════════════════════════════
// PAGE 2 — TODAY
// ════════════════════════════════════════════════════════════════════════════
function PersonColumn({ member, tasks, onToggle, points }) {
  const isRainbow = allSectionsDone(tasks);
  const totalItems = Object.values(tasks).flat().length;
  const doneItems = Object.values(tasks).flat().filter(t => t.done).length;

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
          const done = sectionDone(tasks, sec.id);
          const doneCnt = secTasks.filter(t => t.done).length;
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
                {secTasks.map(task => (
                  <div key={task.id} onClick={() => onToggle(member.id, sec.id, task.id)}
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

function TodayPage({ family }) {
  const defaultVisible = Object.fromEntries(family.map(m => [m.id, m.defaultOn]));
  const [visible, setVisible] = useState(defaultVisible);
  const [taskState, setTaskState] = useState(() => JSON.parse(JSON.stringify(INIT_TASKS)));
  const [pts, setPts] = useState(Object.fromEntries(family.map(m => [m.id, 0])));
  const [viewDate, setViewDate] = useState(getMountainToday());

  function prevDay() { setViewDate(d => { const n=new Date(d); n.setDate(n.getDate()-1); return n; }); }
  function nextDay() { setViewDate(d => { const n=new Date(d); n.setDate(n.getDate()+1); return n; }); }
  const isToday = viewDate.toDateString() === getMountainToday().toDateString();

  function toggleTask(memberId, secId, taskId) {
    setTaskState(prev => {
      const next = { ...prev, [memberId]: { ...prev[memberId], [secId]: prev[memberId][secId].map(t => t.id===taskId?{...t,done:!t.done}:t) } };
      const newPts = { ...pts };
      family.forEach(m => { newPts[m.id] = SECTIONS.filter(s => sectionDone(next[m.id]||{}, s.id)).length; });
      setPts(newPts);
      return next;
    });
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
          {activeMembers.map(m => <PersonColumn key={m.id} member={m} tasks={taskState[m.id]||{}} onToggle={toggleTask} points={pts[m.id]||0} />)}
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

function GoalsQuadrant({ family, goals }) {
  const [activeMember, setActiveMember] = useState(family[2] || family[0]);
  const memberGoals = goals[activeMember.id] || {};

  // Layout: 4 quadrants with thin dividing lines, Christ circle in center
  const QUADRANT_SIZE = 160; // px per quadrant cell (rough)

  return (
    <div>
      {/* Member selector */}
      <div style={{ display:"flex", gap:8, overflowX:"auto", marginBottom:16 }}>
        {family.map(m => {
          const active = m.id===activeMember.id;
          return (
            <button key={m.id} onClick={() => setActiveMember(m)} style={{
              display:"flex", alignItems:"center", gap:6, padding:"7px 14px",
              borderRadius:99, flexShrink:0, cursor:"pointer", transition:"all 0.15s",
              background: active?m.color:T.stone,
              border: active?`2px solid ${m.color}`:"2px solid transparent",
            }}>
              <span style={{fontSize:15}}>{m.emoji}</span>
              <span style={{ fontFamily:"'Fredoka',sans-serif", fontSize:13, fontWeight:700, color: active?"#fff":T.sub }}>{m.name}</span>
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
      <div style={{
        position:"relative",
        background:T.white,
        borderRadius:16,
        overflow:"hidden",
        border:`2px solid ${T.border}`,
      }}>
        {/* Grid lines via CSS — horizontal line */}
        <div style={{ position:"absolute", top:"50%", left:0, right:0, height:1, background:T.border, zIndex:1, transform:"translateY(-0.5px)" }} />
        {/* Vertical line */}
        <div style={{ position:"absolute", left:"50%", top:0, bottom:0, width:1, background:T.border, zIndex:1, transform:"translateX(-0.5px)" }} />

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr" }}>
          {QUAD.map((q, qi) => {
            const isLeft = qi % 2 === 0;
            const isTop  = qi < 2;
            const qGoals = memberGoals[q.id] || [];

            // Corner label positioning
            const labelStyle = {
              fontFamily:"'Fredoka',sans-serif",
              fontSize:13,
              fontWeight:700,
              color: q.color,
              letterSpacing:0.5,
              textTransform:"uppercase",
              position:"absolute",
              ...(isTop    ? { top:10 }    : { bottom:10 }),
              ...(isLeft   ? { left:12 }   : { right:12 }),
            };

            return (
              <div key={q.id} style={{
                position:"relative",
                minHeight:150,
                padding: isTop
                  ? (isLeft ? "36px 70px 24px 14px" : "36px 14px 24px 70px")
                  : (isLeft ? "24px 70px 36px 14px" : "24px 14px 36px 70px"),
              }}>
                {/* Corner label */}
                <div style={labelStyle}>{q.label}</div>

                {/* Goals list */}
                <div>
                  {qGoals.length === 0 ? (
                    <div style={{ fontFamily:"'Nunito',sans-serif", fontSize:11, color:T.muted, fontStyle:"italic" }}>
                      No goals yet
                    </div>
                  ) : (
                    qGoals.map((g, i) => (
                      <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:6, marginBottom:6 }}>
                        <div style={{ width:5, height:5, borderRadius:"50%", background:q.color, flexShrink:0, marginTop:5 }} />
                        <span style={{ fontFamily:"'Nunito',sans-serif", fontSize:12, fontWeight:600, color:T.text, lineHeight:1.45 }}>{g}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Christ portrait — perfectly centered over the grid intersection */}
        <div style={{
          position:"absolute",
          top:"50%", left:"50%",
          transform:"translate(-50%,-50%)",
          zIndex:10,
          width:90, height:90,
        }}>
          {/* Color ring */}
          <ColorRing size={90} />

          {/* Portrait circle */}
          <div style={{
            position:"absolute",
            top:"50%", left:"50%",
            transform:"translate(-50%,-50%)",
            width:68, height:68,
            borderRadius:"50%",
            background:"linear-gradient(160deg, #F5E6C8 0%, #D4A76A 50%, #8B6340 100%)",
            border:"3px solid #fff",
            display:"flex", alignItems:"center", justifyContent:"center",
            overflow:"hidden",
            boxShadow:"0 3px 16px rgba(0,0,0,0.18)",
          }}>
            {/* Stylized face — warm tones representing Christ */}
            <svg width="68" height="68" viewBox="0 0 68 68" style={{ position:"absolute", top:0, left:0 }}>
              {/* Background skin */}
              <circle cx="34" cy="34" r="34" fill="#C8935A"/>
              {/* Hair */}
              <ellipse cx="34" cy="18" rx="18" ry="16" fill="#6B3A1F"/>
              <ellipse cx="34" cy="42" rx="20" ry="28" fill="#6B3A1F"/>
              {/* Face */}
              <ellipse cx="34" cy="32" rx="13" ry="16" fill="#D4A46A"/>
              {/* Eyes */}
              <ellipse cx="29" cy="30" rx="2" ry="2.5" fill="#3B2010"/>
              <ellipse cx="39" cy="30" rx="2" ry="2.5" fill="#3B2010"/>
              {/* Nose */}
              <path d="M34 33 Q32 37 34 38 Q36 37 34 33" fill="#B8845A" opacity="0.6"/>
              {/* Mouth */}
              <path d="M30 41 Q34 44 38 41" stroke="#9B6040" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
              {/* Beard */}
              <ellipse cx="34" cy="46" rx="10" ry="8" fill="#6B3A1F"/>
              {/* Robe */}
              <path d="M14 68 Q20 55 34 52 Q48 55 54 68 Z" fill="#E8E0D0"/>
              {/* Light halo suggestion */}
              <circle cx="34" cy="20" r="16" fill="none" stroke="#FFD700" strokeWidth="1" opacity="0.4"/>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProgressPage({ family, goals, streaks, weekPts }) {
  const [activeMember, setActiveMember] = useState(family[2] || family[0]);

  const BADGES = {
    dad:   ["🏗️ Builder","✝️ Leader","🔥 5-Day"],
    mom:   ["🌿 Culture","❤️ Heart","🔥 7-Day","📋 Planner"],
    bazel: ["🌟 Rainbow","📚 Bookworm","💪 Go-Getter"],
    okrie: ["🎨 Creative","💛 Helper","📖 Stories","🔥 6-Day"],
    saya:  ["🦋 First Steps","🌈 Sunshine","🐣 Early Riser"],
  };

  const streak  = streaks[activeMember.id]  || 0;
  const wPts    = weekPts[activeMember.id]  || 0;
  const todayPts = SECTIONS.length;
  const badges  = BADGES[activeMember.id]   || [];

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

        {/* Rainbow Streak */}
        <div style={{ borderRadius:22, overflow:"hidden", marginBottom:16, padding:"20px 20px 16px", position:"relative", background:"linear-gradient(135deg,#1A2F4B,#0F1E30)" }}>
          {[["12%",18],["35%",42],["58%",12],["78%",55],["90%",28],["22%",65],["68%",38]].map(([left,top],i) => (
            <div key={i} style={{ position:"absolute", top:`${top}%`, left, width:2, height:2, background:"#fff", borderRadius:"50%", opacity:0.3 }} />
          ))}
          <div style={{ position:"relative", zIndex:1 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14 }}>
              <div>
                <div style={{ fontSize:11, fontWeight:600, color:"rgba(255,255,255,0.4)", letterSpacing:1, textTransform:"uppercase", marginBottom:5 }}>Rainbow Days</div>
                <div style={{ fontSize:30, fontWeight:700, color:"#fff", lineHeight:1 }}>🔥 {streak}-Day Streak</div>
                <div style={{ fontSize:13, color:"rgba(255,255,255,0.45)", marginTop:5 }}>Best: {streak+3} days in a row</div>
              </div>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:44, lineHeight:1 }}>🌈</div>
                <div style={{ fontSize:10, color:"rgba(255,255,255,0.4)", marginTop:3 }}>Keep it going!</div>
              </div>
            </div>
            <div style={{ display:"flex", gap:5 }}>
              {["M","T","W","T","F","S","S"].map((d,i) => {
                const earned = i < streak;
                return (
                  <div key={i} style={{ flex:1, textAlign:"center" }}>
                    <div style={{ height:34, borderRadius:9, marginBottom:4, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, backgroundImage: earned?RAINBOW_GRAD:"none", background: earned?"none":"rgba(255,255,255,0.07)" }}>{earned?"🌈":""}</div>
                    <div style={{ fontSize:9, color:"rgba(255,255,255,0.35)", fontWeight:700 }}>{d}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

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

        {/* Goals Quadrant — styled like the image */}
        <GoalsQuadrant family={family} goals={goals} />

        {/* Badges */}
        <h3 style={{ fontSize:18, fontWeight:700, color:T.text, margin:"20px 0 10px" }}>Badges Earned 🏅</h3>
        <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
          {badges.map((b,i) => (
            <div key={i} style={{ background:activeMember.light, color:activeMember.color, border:`2px solid ${activeMember.color}44`, borderRadius:99, padding:"7px 14px", fontFamily:"'Fredoka',sans-serif", fontSize:13, fontWeight:600 }}>{b}</div>
          ))}
          <div style={{ background:T.stone, color:T.muted, border:`2px dashed ${T.border}`, borderRadius:99, padding:"7px 14px", fontFamily:"'Fredoka',sans-serif", fontSize:13 }}>More to unlock…</div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ADMIN PAGE
// ════════════════════════════════════════════════════════════════════════════
function AdminPage({ family, events, setEvents, tasks, setTasks, goals, setGoals }) {
  const [tab, setTab] = useState("calendar");
  const memberMap = Object.fromEntries(family.map(m => [m.id, m]));

  return (
    <div style={{ minHeight:"100vh", background:"#F0EEE9", fontFamily:"'Fredoka',sans-serif" }}>
      <div style={{ background:T.text, padding:"20px 24px 0", borderBottom:`2px solid #333` }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
          <span style={{ fontSize:28 }}>⚙️</span>
          <div>
            <h1 style={{ fontSize:26, fontWeight:700, color:T.white, margin:0 }}>Admin Setup</h1>
            <div style={{ fontSize:13, color:"rgba(255,255,255,0.5)", marginTop:2 }}>
              Family OS · <a href="#" onClick={e=>{e.preventDefault();window.location.hash="";}} style={{color:"#FFD93D",textDecoration:"none"}}>← Back to Kiosk</a>
            </div>
          </div>
        </div>
        <div style={{ display:"flex", gap:2 }}>
          {[{id:"calendar",label:"📅 Calendar"},{id:"tasks",label:"⚡ Tasks"},{id:"goals",label:"🎯 Goals"}].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ padding:"10px 18px", borderRadius:"10px 10px 0 0", border:"none", cursor:"pointer", background: tab===t.id?"#F0EEE9":"transparent", color: tab===t.id?T.text:"rgba(255,255,255,0.6)", fontFamily:"'Fredoka',sans-serif", fontSize:14, fontWeight:600 }}>{t.label}</button>
          ))}
        </div>
      </div>

      <div style={{ padding:"24px 24px 60px", maxWidth:900, margin:"0 auto" }}>
        {tab==="calendar" && <AdminCalendar family={family} events={events} setEvents={setEvents} memberMap={memberMap} />}
        {tab==="tasks"    && <AdminTasks    family={family} tasks={tasks}   setTasks={setTasks} />}
        {tab==="goals"    && <AdminGoals    family={family} goals={goals}   setGoals={setGoals} />}
      </div>
    </div>
  );
}

function AdminCalendar({ family, events, setEvents, memberMap }) {
  const [form, setForm] = useState({ title:"", memberIds:[], startH:9, dur:1, dow:1 });
  const [showForm, setShowForm] = useState(false);
  const DOW_LABELS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

  function addEvent() {
    if (!form.title || form.memberIds.length===0) return;
    setEvents(prev => [...prev, { ...form, id:Date.now() }]);
    setForm({ title:"", memberIds:[], startH:9, dur:1, dow:1 });
    setShowForm(false);
  }

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <h2 style={{ fontSize:22, fontWeight:700, color:T.text, margin:0 }}>Calendar Events</h2>
        <button onClick={() => setShowForm(!showForm)} style={{ background:T.text, color:"#fff", border:"none", borderRadius:12, padding:"10px 20px", fontFamily:"'Fredoka',sans-serif", fontSize:14, fontWeight:600, cursor:"pointer" }}>+ Add Event</button>
      </div>

      {/* Calendar Sync */}
      <div style={{ background:T.white, borderRadius:16, border:`2px solid ${T.border}`, padding:"18px 20px", marginBottom:20 }}>
        <h3 style={{ fontSize:17, fontWeight:700, color:T.text, margin:"0 0 12px" }}>🔗 External Calendar Sync</h3>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          {[{name:"Google Calendar",icon:"📅",color:"#4285F4"},{name:"Outlook Calendar",icon:"📆",color:"#0078D4"}].map(cal => (
            <div key={cal.name} style={{ background:"#F8F7F4", border:`2px solid ${T.border}`, borderRadius:12, padding:"14px 16px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                <span style={{fontSize:22}}>{cal.icon}</span>
                <div>
                  <div style={{ fontWeight:700, fontSize:14, color:T.text }}>{cal.name}</div>
                  <div style={{ fontSize:11, color:T.muted, fontFamily:"'Nunito',sans-serif" }}>Connect via OAuth</div>
                </div>
              </div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:10 }}>
                {family.map(m => (
                  <div key={m.id} style={{ padding:"5px 10px", borderRadius:8, border:`1.5px solid ${T.border}`, background:T.white, fontFamily:"'Fredoka',sans-serif", fontSize:11, color:T.sub }}>{m.emoji} {m.name}</div>
                ))}
              </div>
              <button style={{ width:"100%", padding:"9px", borderRadius:10, background:cal.color, color:"#fff", border:"none", fontFamily:"'Fredoka',sans-serif", fontSize:13, fontWeight:600, cursor:"pointer" }}>Connect {cal.name.split(" ")[0]}</button>
            </div>
          ))}
        </div>
        <div style={{ marginTop:12, padding:"10px 14px", background:"#FFF9E0", borderRadius:10, fontSize:12, color:"#A07820", fontFamily:"'Nunito',sans-serif" }}>
          💡 Calendar sync requires Supabase backend + OAuth setup for Google & Outlook.
        </div>
      </div>

      {showForm && (
        <div style={{ background:T.white, borderRadius:16, border:`2px solid ${T.border}`, padding:"18px 20px", marginBottom:20 }}>
          <h3 style={{ fontSize:17, fontWeight:700, color:T.text, margin:"0 0 14px" }}>New Event</h3>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
            <div>
              <label style={{ fontSize:12, fontWeight:700, color:T.sub, display:"block", marginBottom:5 }}>Title</label>
              <input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="e.g. Math Block" style={{ width:"100%", padding:"10px 12px", borderRadius:10, border:`2px solid ${T.border}`, fontFamily:"'Fredoka',sans-serif", fontSize:14, boxSizing:"border-box" }} />
            </div>
            <div>
              <label style={{ fontSize:12, fontWeight:700, color:T.sub, display:"block", marginBottom:5 }}>Day</label>
              <select value={form.dow} onChange={e=>setForm(f=>({...f,dow:+e.target.value}))} style={{ width:"100%", padding:"10px 12px", borderRadius:10, border:`2px solid ${T.border}`, fontFamily:"'Fredoka',sans-serif", fontSize:14, boxSizing:"border-box" }}>
                {DOW_LABELS.map((d,i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:12, fontWeight:700, color:T.sub, display:"block", marginBottom:5 }}>Start Time</label>
              <select value={form.startH} onChange={e=>setForm(f=>({...f,startH:+e.target.value}))} style={{ width:"100%", padding:"10px 12px", borderRadius:10, border:`2px solid ${T.border}`, fontFamily:"'Fredoka',sans-serif", fontSize:14, boxSizing:"border-box" }}>
                {CAL_HOURS.map(h => <option key={h} value={h}>{h>12?`${h-12}:00 PM`:h===12?"12:00 PM":`${h}:00 AM`}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:12, fontWeight:700, color:T.sub, display:"block", marginBottom:5 }}>Duration</label>
              <select value={form.dur} onChange={e=>setForm(f=>({...f,dur:+e.target.value}))} style={{ width:"100%", padding:"10px 12px", borderRadius:10, border:`2px solid ${T.border}`, fontFamily:"'Fredoka',sans-serif", fontSize:14, boxSizing:"border-box" }}>
                {[0.5,1,1.5,2,2.5,3,4].map(d => <option key={d} value={d}>{d===0.5?"30 min":`${d} hr`}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:12, fontWeight:700, color:T.sub, display:"block", marginBottom:8 }}>Who's involved?</label>
            <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
              {family.map(m => {
                const on = form.memberIds.includes(m.id);
                return <button key={m.id} onClick={() => setForm(f=>({...f,memberIds: on?f.memberIds.filter(id=>id!==m.id):[...f.memberIds,m.id]}))} style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 14px", borderRadius:99, border:`2px solid ${on?m.color:T.border}`, background: on?m.light:T.stone, cursor:"pointer", fontFamily:"'Fredoka',sans-serif", fontSize:13, fontWeight:600, color: on?m.color:T.muted }}>{m.emoji} {m.name}</button>;
              })}
            </div>
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={addEvent} style={{ flex:1, padding:"12px", borderRadius:12, background:T.text, color:"#fff", border:"none", fontFamily:"'Fredoka',sans-serif", fontSize:15, fontWeight:700, cursor:"pointer" }}>Add to Calendar</button>
            <button onClick={() => setShowForm(false)} style={{ padding:"12px 20px", borderRadius:12, background:T.stone, color:T.sub, border:"none", fontFamily:"'Fredoka',sans-serif", fontSize:15, cursor:"pointer" }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ background:T.white, borderRadius:16, border:`2px solid ${T.border}`, padding:"18px 20px" }}>
        <h3 style={{ fontSize:17, fontWeight:700, color:T.text, margin:"0 0 14px" }}>All Events ({events.length})</h3>
        {events.map(ev => (
          <div key={ev.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 12px", borderRadius:12, background:"#F8F7F4", border:`1px solid ${T.border}`, marginBottom:8 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:700, fontSize:14, color:T.text }}>{ev.title}</div>
              <div style={{ fontSize:11, color:T.muted, marginTop:2, fontFamily:"'Nunito',sans-serif" }}>{DOW_LABELS[ev.dow]} · {ev.startH>12?`${ev.startH-12}:00 PM`:ev.startH===12?"12:00 PM":`${ev.startH}:00 AM`} · {ev.dur}hr · {ev.memberIds.map(id=>memberMap[id]?.emoji).join(" ")}</div>
            </div>
            <button onClick={() => setEvents(prev=>prev.filter(e=>e.id!==ev.id))} style={{ padding:"6px 12px", borderRadius:8, background:"#FEE2E2", color:"#DC2626", border:"none", fontFamily:"'Fredoka',sans-serif", fontSize:12, fontWeight:600, cursor:"pointer" }}>Remove</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminTasks({ family, tasks, setTasks }) {
  const [activeMember, setActiveMember] = useState(family[0]);
  const [activeSection, setActiveSection] = useState("learn");
  const [newTask, setNewTask] = useState("");
  const sec = SECTIONS.find(s => s.id===activeSection);
  const currentTasks = tasks[activeMember.id]?.[activeSection] || [];

  function addTask() {
    if (!newTask.trim()) return;
    setTasks(prev => ({ ...prev, [activeMember.id]: { ...prev[activeMember.id], [activeSection]: [...(prev[activeMember.id]?.[activeSection]||[]), { id:Date.now(), label:newTask.trim(), done:false }] } }));
    setNewTask("");
  }

  return (
    <div>
      <h2 style={{ fontSize:22, fontWeight:700, color:T.text, margin:"0 0 6px" }}>Task Setup</h2>
      <p style={{ fontSize:13, color:T.muted, margin:"0 0 18px", fontFamily:"'Nunito',sans-serif" }}>Configure daily tasks per person. These populate automatically on the Today page.</p>
      <div style={{ background:"#EFF6FF", border:"2px solid #BFDBFE", borderRadius:14, padding:"12px 16px", marginBottom:18 }}>
        <div style={{ fontSize:13, color:"#1E40AF", fontFamily:"'Nunito',sans-serif", fontWeight:600 }}>📋 Bulk upload coming soon — paste a cleaning chart or upload curriculum CSV to auto-populate.</div>
      </div>
      <div style={{ display:"flex", gap:8, marginBottom:16, overflowX:"auto" }}>
        {family.map(m => <button key={m.id} onClick={() => setActiveMember(m)} style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 16px", borderRadius:99, flexShrink:0, cursor:"pointer", background: activeMember.id===m.id?m.color:T.stone, border: activeMember.id===m.id?`2px solid ${m.color}`:"2px solid transparent" }}><span style={{fontSize:15}}>{m.emoji}</span><span style={{ fontFamily:"'Fredoka',sans-serif", fontSize:14, fontWeight:600, color: activeMember.id===m.id?"#fff":T.sub }}>{m.name}</span></button>)}
      </div>
      <div style={{ display:"flex", gap:6, marginBottom:16 }}>
        {SECTIONS.map(s => <button key={s.id} onClick={() => setActiveSection(s.id)} style={{ flex:1, padding:"10px 8px", borderRadius:12, border:"none", cursor:"pointer", background: activeSection===s.id?s.color:T.stone, color: activeSection===s.id?"#fff":T.sub, fontFamily:"'Fredoka',sans-serif", fontSize:13, fontWeight:700 }}>{s.icon} {s.label}</button>)}
      </div>
      <div style={{ background:T.white, borderRadius:16, border:`2px solid ${T.border}`, padding:"18px", marginBottom:14 }}>
        <div style={{ fontSize:16, fontWeight:700, color:T.text, marginBottom:12 }}>{activeMember.name}'s {sec.label} Tasks</div>
        {currentTasks.length===0 ? <div style={{ textAlign:"center", padding:"16px 0", color:T.muted, fontFamily:"'Nunito',sans-serif", fontSize:14 }}>No tasks yet</div> : currentTasks.map(task => (
          <div key={task.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", borderRadius:10, background:"#F8F7F4", border:`1px solid ${T.border}`, marginBottom:6 }}>
            <span style={{ flex:1, fontFamily:"'Nunito',sans-serif", fontSize:13, fontWeight:600, color:T.text }}>{task.label}</span>
            <button onClick={() => setTasks(prev => ({ ...prev, [activeMember.id]: { ...prev[activeMember.id], [activeSection]: prev[activeMember.id][activeSection].filter(t=>t.id!==task.id) } }))} style={{ padding:"5px 10px", borderRadius:8, background:"#FEE2E2", color:"#DC2626", border:"none", fontFamily:"'Fredoka',sans-serif", fontSize:12, fontWeight:600, cursor:"pointer" }}>✕</button>
          </div>
        ))}
      </div>
      <div style={{ display:"flex", gap:10 }}>
        <input value={newTask} onChange={e=>setNewTask(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addTask()} placeholder={`Add a ${sec.label.toLowerCase()} task for ${activeMember.name}…`} style={{ flex:1, padding:"12px 16px", borderRadius:12, border:`2px solid ${T.border}`, fontFamily:"'Fredoka',sans-serif", fontSize:14 }} />
        <button onClick={addTask} style={{ padding:"12px 20px", borderRadius:12, background:sec.color, color:"#fff", border:"none", fontFamily:"'Fredoka',sans-serif", fontSize:15, fontWeight:700, cursor:"pointer" }}>Add</button>
      </div>
    </div>
  );
}

function AdminGoals({ family, goals, setGoals }) {
  const [activeMember, setActiveMember] = useState(family[2]||family[0]);
  const [activeQuad, setActiveQuad] = useState("spiritual");
  const [newGoal, setNewGoal] = useState("");
  const quad = QUAD.find(q=>q.id===activeQuad);
  const currentGoals = goals[activeMember.id]?.[activeQuad] || [];

  function addGoal() {
    if (!newGoal.trim()) return;
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
            <button onClick={() => setGoals(prev=>({ ...prev, [activeMember.id]: { ...prev[activeMember.id], [activeQuad]: prev[activeMember.id][activeQuad].filter((_,idx)=>idx!==i) } }))} style={{ padding:"5px 10px", borderRadius:8, background:"#FEE2E2", color:"#DC2626", border:"none", fontFamily:"'Fredoka',sans-serif", fontSize:12, fontWeight:600, cursor:"pointer" }}>✕</button>
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
export default function App() {
  const [page, setPage]   = useState("today");
  const [family]          = useState(FAMILY_INIT);
  const [events, setEvents] = useState(INIT_CAL_EVENTS);
  const [tasks,  setTasks]  = useState(INIT_TASKS);
  const [goals,  setGoals]  = useState(INIT_GOALS);
  const [streaks]           = useState(INIT_STREAKS);
  const [weekPts]           = useState(INIT_WEEK_PTS);
  const [adminMode, setAdminMode] = useState(false);

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

    const check = () => setAdminMode(window.location.hash === "#admin");
    check();
    window.addEventListener("hashchange", check);
    return () => window.removeEventListener("hashchange", check);
  }, []);

  if (adminMode) return <AdminPage family={family} events={events} setEvents={setEvents} tasks={tasks} setTasks={setTasks} goals={goals} setGoals={setGoals} />;

  const goAdmin = () => { window.location.hash = "#admin"; };

  return (
    <div style={{ background:T.bg, width:"100vw", minHeight:"100vh", overflowX:"hidden" }}>
      <TopBar onAdmin={goAdmin} />
      {page==="calendar" && <CalendarPage family={family} events={events} />}
      {page==="today"    && <TodayPage    family={family} tasks={tasks} />}
      {page==="progress" && <ProgressPage family={family} goals={goals} streaks={streaks} weekPts={weekPts} />}
      <BottomNav page={page} onPage={setPage} />
    </div>
  );
}
