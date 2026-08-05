import React, { useState, useEffect, useMemo, useCallback } from "react";
import { ChevronLeft, ChevronRight, X, Plus, Trash2, Flame, BookOpen } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
} from "recharts";

/* ------------------------------------------------------------------ */
/*  Tokens                                                             */
/* ------------------------------------------------------------------ */

const PAPER = "#F3EEE3";
const PAPER_DEEP = "#EAE2D2";
const INK = "#332B25";
const INK_SOFT = "#6B6055";
const RULE = "#D9CFBB";
const ACCENT = "#6B4C57";

const CATEGORIES = [
  { id: "cigarette", name: "Cigarette", short: "Cig", icon: "\u{1F6AC}", color: "#B84B32", shape: "multi-detail" },
  { id: "food", name: "Food", short: "Food", icon: "\u{1F37D}\uFE0F", color: "#C98A2B", shape: "multi-food" },
  { id: "coffee", name: "Coffee", short: "Cof", icon: "\u2615", color: "#8A5A34", shape: "multi-count" },
  { id: "walk", name: "Walk", short: "Walk", icon: "\u{1F6B6}", color: "#7A8B3E", shape: "daily-value", unit: "steps" },
  { id: "water", name: "Water", short: "H\u2082O", icon: "\u{1F4A7}", color: "#2E8C94", shape: "daily-value", unit: "L" },
  { id: "sleep", name: "Sleep", short: "Sleep", icon: "\u{1F634}", color: "#3E6B9C", shape: "daily-value", unit: "h" },
  { id: "workout", name: "Workout", short: "Move", icon: "\u{1F3CB}\uFE0F", color: "#3E8B5C", shape: "daily-bool-type" },
  { id: "books", name: "Reading", short: "Read", icon: "\u{1F4D6}", color: "#8C4E8A", shape: "daily-bool" },
  { id: "meditation", name: "Meditation", short: "Med", icon: "\u{1F9D8}", color: "#5B4E9C", shape: "daily-bool" },
  { id: "kindness", name: "Kindness", short: "Kind", icon: "\u{1F49B}", color: "#B5497A", shape: "daily-bool" },
];

const WORKOUT_TYPES = ["Pilates", "Walking", "Running", "Strength", "Other"];
const MEAL_TYPES = ["Breakfast", "Lunch", "Dinner", "Snack"];
const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

/* ------------------------------------------------------------------ */
/*  Date helpers (local time, no UTC drift)                            */
/* ------------------------------------------------------------------ */

function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function todayStr() { return fmtDate(new Date()); }
function sundayOf(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}
function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
function weekDates(sunday) {
  return Array.from({ length: 7 }, (_, i) => addDays(sunday, i));
}
function niceRange(sunday) {
  const sat = addDays(sunday, 6);
  const opts = { month: "short", day: "numeric" };
  const sameMonth = sunday.getMonth() === sat.getMonth();
  const left = sunday.toLocaleDateString("en-US", opts);
  const right = sat.toLocaleDateString("en-US", sameMonth ? { day: "numeric" } : opts);
  return `${left} \u2013 ${right}, ${sat.getFullYear()}`;
}
function niceDay(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}
function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/* ------------------------------------------------------------------ */
/*  Color helpers                                                      */
/* ------------------------------------------------------------------ */

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}
function rgba(hex, a) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

/* ------------------------------------------------------------------ */
/*  Entry logic                                                        */
/* ------------------------------------------------------------------ */

function dayEntries(entries, date, categoryId) {
  return entries.filter((e) => e.date === date && e.categoryId === categoryId);
}

// Returns 0..1 fill intensity for a category cell on a given day.
function fillLevel(entries, date, cat) {
  const es = dayEntries(entries, date, cat.id);
  if (es.length === 0) return 0;
  if (cat.shape === "multi-detail" || cat.shape === "multi-food" || cat.shape === "multi-count") {
    return Math.min(1, 0.4 + es.length * 0.22);
  }
  // daily-value, daily-bool, daily-bool-type: presence only
  return 1;
}

/* ------------------------------------------------------------------ */
/*  Storage                                                             */
/* ------------------------------------------------------------------ */

async function loadEntries() {
  try {
    const raw = localStorage.getItem("entries");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
async function saveEntries(entries) {
  try {
    localStorage.setItem("entries", JSON.stringify(entries));
  } catch {
    /* best effort */
  }
}

/* ------------------------------------------------------------------ */
/*  Root component                                                     */
/* ------------------------------------------------------------------ */

export default function HabitDiary() {
  const [entries, setEntries] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("diary");
  const [weekStart, setWeekStart] = useState(() => sundayOf(new Date()));
  const [selectedDay, setSelectedDay] = useState(todayStr());
  const [modal, setModal] = useState(null); // { date, categoryId }

  useEffect(() => {
    loadEntries().then((e) => { setEntries(e); setLoaded(true); });
  }, []);

  const persist = useCallback((next) => {
    setEntries(next);
    saveEntries(next);
  }, []);

  const addEntry = useCallback((entry) => {
    persist([...entries, { id: uid(), ...entry }]);
  }, [entries, persist]);

  const removeEntry = useCallback((id) => {
    persist(entries.filter((e) => e.id !== id));
  }, [entries, persist]);

  // upsert for single-per-day shapes
  const upsertDaily = useCallback((date, categoryId, fields) => {
    const existing = entries.find((e) => e.date === date && e.categoryId === categoryId);
    if (existing) {
      persist(entries.map((e) => (e.id === existing.id ? { ...e, ...fields } : e)));
    } else {
      persist([...entries, { id: uid(), date, categoryId, ...fields }]);
    }
  }, [entries, persist]);

  const clearDaily = useCallback((date, categoryId) => {
    persist(entries.filter((e) => !(e.date === date && e.categoryId === categoryId)));
  }, [entries, persist]);

  const days = useMemo(() => weekDates(weekStart), [weekStart]);
  const isCurrentWeek = fmtDate(sundayOf(new Date())) === fmtDate(weekStart);

  return (
    <div style={styles.app}>
      <FontImport />
      <header style={styles.header}>
        <div style={styles.headerTitleRow}>
          <span style={styles.headerMark}>&#9679;</span>
          <h1 style={styles.headerTitle}>Ledger of Days</h1>
        </div>
        <p style={styles.headerSub}>a quiet record, kept for yourself &middot; v1.1</p>
      </header>

      <nav style={styles.tabs}>
        {[
          ["diary", "Diary"],
          ["year", "Year"],
          ["insights", "Insights"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              ...styles.tabBtn,
              ...(tab === key ? styles.tabBtnActive : {}),
            }}
          >
            {label}
          </button>
        ))}
      </nav>

      {!loaded ? (
        <div style={styles.loading}>loading your ledger&hellip;</div>
      ) : tab === "diary" ? (
        <DiaryView
          entries={entries}
          days={days}
          weekStart={weekStart}
          isCurrentWeek={isCurrentWeek}
          onPrevWeek={() => setWeekStart(addDays(weekStart, -7))}
          onNextWeek={() => setWeekStart(addDays(weekStart, 7))}
          onToday={() => { setWeekStart(sundayOf(new Date())); setSelectedDay(todayStr()); }}
          selectedDay={selectedDay}
          setSelectedDay={setSelectedDay}
          onOpenCell={(date, categoryId) => setModal({ date, categoryId })}
        />
      ) : tab === "year" ? (
        <YearView entries={entries} />
      ) : (
        <InsightsView entries={entries} />
      )}

      {modal && (
        <EntryModal
          date={modal.date}
          categoryId={modal.categoryId}
          entries={entries}
          onClose={() => setModal(null)}
          onAdd={addEntry}
          onRemove={removeEntry}
          onUpsertDaily={upsertDaily}
          onClearDaily={clearDaily}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Font import                                                        */
/* ------------------------------------------------------------------ */

function FontImport() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;1,9..144,500&family=Inter:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap');
      * { box-sizing: border-box; }
      button { font-family: inherit; cursor: pointer; }
      input, select { font-family: inherit; }
      ::-webkit-scrollbar { height: 6px; width: 6px; }
      ::-webkit-scrollbar-thumb { background: ${RULE}; border-radius: 4px; }
    `}</style>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared style tokens                                                */
/* ------------------------------------------------------------------ */

const styles = {
  app: {
    fontFamily: "'Inter', sans-serif",
    background: PAPER,
    backgroundImage:
      "radial-gradient(circle at 1px 1px, rgba(51,43,37,0.05) 1px, transparent 0)",
    backgroundSize: "14px 14px",
    color: INK,
    minHeight: "100vh",
    maxWidth: 480,
    margin: "0 auto",
    paddingBottom: 40,
  },
  header: { padding: "24px 20px 8px" },
  headerTitleRow: { display: "flex", alignItems: "center", gap: 8 },
  headerMark: { color: ACCENT, fontSize: 10 },
  headerTitle: {
    fontFamily: "'Fraunces', serif",
    fontWeight: 600,
    fontSize: 28,
    margin: 0,
    letterSpacing: "-0.01em",
  },
  headerSub: { margin: "4px 0 0", fontSize: 13, color: INK_SOFT, fontStyle: "italic" },
  tabs: {
    display: "flex",
    gap: 4,
    margin: "16px 20px 0",
    borderBottom: `1px solid ${RULE}`,
  },
  tabBtn: {
    border: "none",
    background: "transparent",
    padding: "8px 14px",
    fontSize: 13,
    fontWeight: 600,
    color: INK_SOFT,
    borderBottom: "2px solid transparent",
    marginBottom: -1,
  },
  tabBtnActive: { color: ACCENT, borderBottomColor: ACCENT },
  loading: { textAlign: "center", padding: 60, color: INK_SOFT, fontStyle: "italic" },
};

/* ------------------------------------------------------------------ */
/*  Diary view                                                         */
/* ------------------------------------------------------------------ */

function DiaryView({
  entries, days, weekStart, isCurrentWeek, onPrevWeek, onNextWeek, onToday,
  selectedDay, setSelectedDay, onOpenCell,
}) {
  const todaysStr = todayStr();

  return (
    <div style={{ padding: "16px 12px 0" }}>
      <div style={dvStyles.weekBar}>
        <button style={dvStyles.navBtn} onClick={onPrevWeek}><ChevronLeft size={18} /></button>
        <div style={{ textAlign: "center" }}>
          <div style={dvStyles.weekRange}>{niceRange(weekStart)}</div>
          {!isCurrentWeek && (
            <button style={dvStyles.todayLink} onClick={onToday}>back to this week</button>
          )}
        </div>
        <button style={dvStyles.navBtn} onClick={onNextWeek}><ChevronRight size={18} /></button>
      </div>

      <div style={dvStyles.gridWrap}>
        <table style={dvStyles.table}>
          <thead>
            <tr>
              <th style={dvStyles.cornerCell} />
              {days.map((d) => {
                const ds = fmtDate(d);
                const isToday = ds === todaysStr;
                const isSel = ds === selectedDay;
                return (
                  <th
                    key={ds}
                    style={{
                      ...dvStyles.dayHeadCell,
                      ...(isSel ? dvStyles.dayHeadCellSel : {}),
                    }}
                    onClick={() => setSelectedDay(ds)}
                  >
                    <div style={dvStyles.dayLetter}>{WEEKDAY_LETTERS[d.getDay()]}</div>
                    <div style={{
                      ...dvStyles.dayNum,
                      ...(isToday ? dvStyles.dayNumToday : {}),
                    }}>{d.getDate()}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {CATEGORIES.map((cat) => (
              <tr key={cat.id}>
                <td style={dvStyles.rowLabel}>
                  <div style={dvStyles.rowIcon}>{cat.icon}</div>
                  <div style={dvStyles.rowName}>{cat.short}</div>
                </td>
                {days.map((d) => {
                  const ds = fmtDate(d);
                  const level = fillLevel(entries, ds, cat);
                  const filled = level > 0;
                  return (
                    <td key={ds} style={dvStyles.cellTd}>
                      <button
                        onClick={() => onOpenCell(ds, cat.id)}
                        style={{
                          ...dvStyles.cell,
                          background: filled ? rgba(cat.color, level) : rgba(cat.color, 0.08),
                          border: filled
                            ? `1px solid ${rgba(cat.color, Math.min(1, level + 0.15))}`
                            : `1px dashed ${rgba(cat.color, 0.35)}`,
                        }}
                        aria-label={`${cat.name} on ${ds}`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <DaySummary date={selectedDay} entries={entries} onOpenCell={onOpenCell} />
    </div>
  );
}

const dvStyles = {
  weekBar: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px 14px" },
  navBtn: { background: "transparent", border: "none", color: INK, padding: 6, display: "flex" },
  weekRange: { fontFamily: "'Fraunces', serif", fontSize: 16, fontWeight: 600 },
  todayLink: { border: "none", background: "none", color: ACCENT, fontSize: 11, padding: 0, textDecoration: "underline" },
  gridWrap: { overflowX: "auto", borderRadius: 10, border: `1px solid ${RULE}`, background: "rgba(255,255,255,0.35)" },
  table: { borderCollapse: "collapse", width: "100%" },
  cornerCell: { width: 54, borderBottom: `1px solid ${RULE}` },
  dayHeadCell: { width: 38, textAlign: "center", padding: "8px 2px", borderBottom: `1px solid ${RULE}`, cursor: "pointer" },
  dayHeadCellSel: { background: "rgba(107,76,87,0.08)" },
  dayLetter: { fontSize: 10, color: INK_SOFT, fontWeight: 600 },
  dayNum: { fontFamily: "'Space Mono', monospace", fontSize: 13, marginTop: 2 },
  dayNumToday: { color: ACCENT, fontWeight: 700 },
  rowLabel: { padding: "6px 8px", borderTop: `1px solid ${RULE}`, whiteSpace: "nowrap" },
  rowIcon: { fontSize: 15, lineHeight: 1 },
  rowName: { fontSize: 9, color: INK_SOFT, marginTop: 1 },
  cellTd: { padding: 3, borderTop: `1px solid ${RULE}`, textAlign: "center" },
  cell: { width: 28, height: 28, borderRadius: 7, padding: 0 },
};

/* ------------------------------------------------------------------ */
/*  Day summary strip                                                  */
/* ------------------------------------------------------------------ */

function DaySummary({ date, entries, onOpenCell }) {
  const rows = CATEGORIES.map((cat) => {
    const es = dayEntries(entries, date, cat.id);
    if (es.length === 0) return null;
    let text;
    if (cat.shape === "multi-detail") {
      text = `${es.length} \u00d7 \u2014 avg craving ${avg(es.map((e) => e.craving))}, enjoyment ${avg(es.map((e) => e.enjoyment))}`;
    } else if (cat.shape === "multi-food") {
      text = es.map((e) => e.description).filter(Boolean).join(", ") || `${es.length} meal(s)`;
    } else if (cat.shape === "multi-count") {
      text = `${es.length} cup${es.length > 1 ? "s" : ""}`;
    } else if (cat.shape === "daily-value") {
      text = `${es[0].value} ${cat.unit}`;
    } else if (cat.shape === "daily-bool-type") {
      text = es[0].workoutType || "done";
    } else {
      text = "done";
    }
    return { cat, text };
  }).filter(Boolean);

  return (
    <div style={dsStyles.wrap}>
      <div style={dsStyles.heading}>{niceDay(date)}</div>
      {rows.length === 0 ? (
        <div style={dsStyles.empty}>Nothing logged yet &mdash; tap a cell above to begin.</div>
      ) : (
        <div style={dsStyles.list}>
          {rows.map(({ cat, text }) => (
            <button key={cat.id} style={dsStyles.item} onClick={() => onOpenCell(date, cat.id)}>
              <span style={{ ...dsStyles.dot, background: cat.color }} />
              <span style={dsStyles.itemName}>{cat.name}</span>
              <span style={dsStyles.itemText}>{text}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
function avg(nums) {
  const n = nums.filter((x) => typeof x === "number");
  if (!n.length) return "\u2014";
  return (n.reduce((a, b) => a + b, 0) / n.length).toFixed(1);
}

const dsStyles = {
  wrap: { marginTop: 18, padding: 16, background: "rgba(255,255,255,0.5)", border: `1px solid ${RULE}`, borderRadius: 10 },
  heading: { fontFamily: "'Fraunces', serif", fontSize: 15, fontWeight: 600, marginBottom: 10 },
  empty: { fontSize: 13, color: INK_SOFT, fontStyle: "italic" },
  list: { display: "flex", flexDirection: "column", gap: 8 },
  item: { display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", padding: "4px 2px", textAlign: "left", width: "100%" },
  dot: { width: 8, height: 8, borderRadius: "50%", flexShrink: 0 },
  itemName: { fontSize: 13, fontWeight: 600, width: 78, flexShrink: 0 },
  itemText: { fontSize: 12.5, color: INK_SOFT, fontFamily: "'Space Mono', monospace" },
};

/* ------------------------------------------------------------------ */
/*  Entry modal                                                        */
/* ------------------------------------------------------------------ */

function EntryModal({ date, categoryId, entries, onClose, onAdd, onRemove, onUpsertDaily, onClearDaily }) {
  const cat = CATEGORIES.find((c) => c.id === categoryId);
  const dayList = dayEntries(entries, date, categoryId);

  return (
    <div style={mStyles.backdrop} onClick={onClose}>
      <div style={mStyles.sheet} onClick={(e) => e.stopPropagation()}>
        <div style={mStyles.headRow}>
          <div style={mStyles.headTitle}>
            <span style={{ ...mStyles.headDot, background: cat.color }} />
            {cat.name}
            <span style={mStyles.headDate}>{niceDay(date)}</span>
          </div>
          <button style={mStyles.closeBtn} onClick={onClose}><X size={18} /></button>
        </div>

        {cat.shape === "multi-detail" && (
          <CigaretteForm date={date} cat={cat} list={dayList} onAdd={onAdd} onRemove={onRemove} />
        )}
        {cat.shape === "multi-food" && (
          <FoodForm date={date} cat={cat} list={dayList} onAdd={onAdd} onRemove={onRemove} />
        )}
        {cat.shape === "multi-count" && (
          <CountForm date={date} cat={cat} list={dayList} onAdd={onAdd} onRemove={onRemove} />
        )}
        {cat.shape === "daily-value" && (
          <ValueForm date={date} cat={cat} list={dayList} onSave={onUpsertDaily} onClear={onClearDaily} onClose={onClose} />
        )}
        {cat.shape === "daily-bool-type" && (
          <WorkoutForm date={date} cat={cat} list={dayList} onSave={onUpsertDaily} onClear={onClearDaily} onClose={onClose} />
        )}
        {cat.shape === "daily-bool" && (
          <BoolForm date={date} cat={cat} list={dayList} onSave={onUpsertDaily} onClear={onClearDaily} onClose={onClose} />
        )}
      </div>
    </div>
  );
}

const mStyles = {
  backdrop: { position: "fixed", inset: 0, background: "rgba(51,43,37,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 },
  sheet: { background: PAPER, width: "100%", maxWidth: 480, borderRadius: "18px 18px 0 0", padding: "18px 20px 28px", maxHeight: "85vh", overflowY: "auto" },
  headRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  headTitle: { display: "flex", alignItems: "center", gap: 8, fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 600 },
  headDot: { width: 10, height: 10, borderRadius: "50%" },
  headDate: { fontFamily: "'Inter', sans-serif", fontSize: 12, color: INK_SOFT, fontWeight: 400, marginLeft: 4 },
  closeBtn: { background: "none", border: "none", color: INK_SOFT },
  label: { fontSize: 12, fontWeight: 600, color: INK_SOFT, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.04em" },
  input: { width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${RULE}`, background: "#fff", fontSize: 14, marginBottom: 14 },
  scaleRow: { display: "flex", gap: 6, marginBottom: 14 },
  scaleBtn: (active, color) => ({
    flex: 1, padding: "10px 0", borderRadius: 8, border: `1px solid ${active ? color : RULE}`,
    background: active ? rgba(color, 0.18) : "#fff", fontWeight: 700, fontSize: 14,
    color: active ? color : INK_SOFT,
  }),
  pillRow: { display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 },
  pill: (active, color) => ({
    padding: "8px 14px", borderRadius: 999, border: `1px solid ${active ? color : RULE}`,
    background: active ? rgba(color, 0.18) : "#fff", fontSize: 13, fontWeight: 600,
    color: active ? color : INK_SOFT,
  }),
  primaryBtn: (color) => ({
    width: "100%", padding: "12px 0", borderRadius: 9, border: "none",
    background: color, color: "#fff", fontWeight: 700, fontSize: 14, marginTop: 4,
    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
  }),
  secondaryBtn: { width: "100%", padding: "10px 0", borderRadius: 9, border: `1px solid ${RULE}`, background: "#fff", color: INK_SOFT, fontWeight: 600, fontSize: 13, marginTop: 8 },
  listItem: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", background: "rgba(255,255,255,0.6)", borderRadius: 8, marginBottom: 6, fontSize: 13 },
  trashBtn: { background: "none", border: "none", color: "#B84B32", padding: 4 },
  sectionGap: { marginTop: 18, paddingTop: 14, borderTop: `1px solid ${RULE}` },
};

/* --- Cigarette form --- */
function CigaretteForm({ date, cat, list, onAdd, onRemove }) {
  const [hour, setHour] = useState(nowHHMM());
  const [craving, setCraving] = useState(2);
  const [enjoyment, setEnjoyment] = useState(2);
  return (
    <div>
      <label style={mStyles.label}>Time</label>
      <input style={mStyles.input} type="time" value={hour} onChange={(e) => setHour(e.target.value)} />
      <label style={mStyles.label}>How much did you need it?</label>
      <div style={mStyles.scaleRow}>
        {[1, 2, 3, 4].map((n) => (
          <button key={n} style={mStyles.scaleBtn(craving === n, cat.color)} onClick={() => setCraving(n)}>{n}</button>
        ))}
      </div>
      <label style={mStyles.label}>How much did you enjoy it?</label>
      <div style={mStyles.scaleRow}>
        {[1, 2, 3, 4].map((n) => (
          <button key={n} style={mStyles.scaleBtn(enjoyment === n, cat.color)} onClick={() => setEnjoyment(n)}>{n}</button>
        ))}
      </div>
      <button style={mStyles.primaryBtn(cat.color)} onClick={() => onAdd({ date, categoryId: cat.id, hour, craving, enjoyment })}>
        <Plus size={15} /> Add cigarette
      </button>
      <EntryList list={list} onRemove={onRemove} render={(e) => `${e.hour || "--:--"} \u00b7 craving ${e.craving} \u00b7 enjoyed ${e.enjoyment}`} />
    </div>
  );
}

/* --- Food form --- */
function FoodForm({ date, cat, list, onAdd, onRemove }) {
  const [desc, setDesc] = useState("");
  const [mealType, setMealType] = useState(MEAL_TYPES[0]);
  return (
    <div>
      <label style={mStyles.label}>Meal</label>
      <input style={mStyles.input} placeholder="what did you eat?" value={desc} onChange={(e) => setDesc(e.target.value)} />
      <label style={mStyles.label}>Type</label>
      <div style={mStyles.pillRow}>
        {MEAL_TYPES.map((t) => (
          <button key={t} style={mStyles.pill(mealType === t, cat.color)} onClick={() => setMealType(t)}>{t}</button>
        ))}
      </div>
      <button
        style={mStyles.primaryBtn(cat.color)}
        disabled={!desc.trim()}
        onClick={() => { if (desc.trim()) { onAdd({ date, categoryId: cat.id, description: desc.trim(), mealType }); setDesc(""); } }}
      >
        <Plus size={15} /> Add meal
      </button>
      <EntryList list={list} onRemove={onRemove} render={(e) => `${e.mealType}: ${e.description}`} />
    </div>
  );
}

/* --- Coffee (simple count) form --- */
function CountForm({ date, cat, list, onAdd, onRemove }) {
  const [hour, setHour] = useState(nowHHMM());
  return (
    <div>
      <label style={mStyles.label}>Time (optional)</label>
      <input style={mStyles.input} type="time" value={hour} onChange={(e) => setHour(e.target.value)} />
      <button style={mStyles.primaryBtn(cat.color)} onClick={() => onAdd({ date, categoryId: cat.id, hour })}>
        <Plus size={15} /> Add cup
      </button>
      <EntryList list={list} onRemove={onRemove} render={(e) => `cup \u00b7 ${e.hour || "no time noted"}`} />
    </div>
  );
}

/* --- Daily numeric value form (walk / water / sleep) --- */
function ValueForm({ date, cat, list, onSave, onClear, onClose }) {
  const existing = list[0];
  const [val, setVal] = useState(existing ? String(existing.value) : "");
  return (
    <div>
      <label style={mStyles.label}>{cat.name} ({cat.unit})</label>
      <input
        style={mStyles.input}
        type="number"
        inputMode="decimal"
        placeholder={`e.g. ${cat.unit === "steps" ? "6500" : cat.unit === "L" ? "1.5" : "7.5"}`}
        value={val}
        onChange={(e) => setVal(e.target.value)}
      />
      <button
        style={mStyles.primaryBtn(cat.color)}
        disabled={val === ""}
        onClick={() => { onSave(date, cat.id, { value: parseFloat(val) }); onClose(); }}
      >
        Save {cat.name.toLowerCase()}
      </button>
      {existing && (
        <button style={mStyles.secondaryBtn} onClick={() => { onClear(date, cat.id); onClose(); }}>
          Clear today&rsquo;s entry
        </button>
      )}
    </div>
  );
}

/* --- Workout (bool + type) --- */
function WorkoutForm({ date, cat, list, onSave, onClear, onClose }) {
  const existing = list[0];
  const [type, setType] = useState(existing ? existing.workoutType : WORKOUT_TYPES[0]);
  return (
    <div>
      <label style={mStyles.label}>What did you do?</label>
      <div style={mStyles.pillRow}>
        {WORKOUT_TYPES.map((t) => (
          <button key={t} style={mStyles.pill(type === t, cat.color)} onClick={() => setType(t)}>{t}</button>
        ))}
      </div>
      <button style={mStyles.primaryBtn(cat.color)} onClick={() => { onSave(date, cat.id, { value: 1, workoutType: type }); onClose(); }}>
        Mark done &mdash; {type}
      </button>
      {existing && (
        <button style={mStyles.secondaryBtn} onClick={() => { onClear(date, cat.id); onClose(); }}>
          Remove today&rsquo;s workout
        </button>
      )}
    </div>
  );
}

/* --- Simple daily bool (books / meditation / kindness) --- */
function BoolForm({ date, cat, list, onSave, onClear, onClose }) {
  const done = list.length > 0;
  return (
    <div>
      <p style={{ fontSize: 13.5, color: INK_SOFT, marginTop: 0, marginBottom: 16 }}>
        {boolPrompt(cat.id)}
      </p>
      {done ? (
        <button style={mStyles.secondaryBtn} onClick={() => { onClear(date, cat.id); onClose(); }}>
          Undo &mdash; mark not done
        </button>
      ) : (
        <button style={mStyles.primaryBtn(cat.color)} onClick={() => { onSave(date, cat.id, { value: 1 }); onClose(); }}>
          Mark done
        </button>
      )}
    </div>
  );
}
function boolPrompt(id) {
  if (id === "books") return "Did you read today?";
  if (id === "meditation") return "Did you meditate today?";
  if (id === "kindness") return "Did you do something kind for someone else today?";
  return "Mark today?";
}

function EntryList({ list, onRemove, render }) {
  if (!list.length) return null;
  return (
    <div style={mStyles.sectionGap}>
      <label style={mStyles.label}>Today so far</label>
      {list.map((e) => (
        <div key={e.id} style={mStyles.listItem}>
          <span>{render(e)}</span>
          <button style={mStyles.trashBtn} onClick={() => onRemove(e.id)}><Trash2 size={14} /></button>
        </div>
      ))}
    </div>
  );
}
function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ */
/*  Year (radial) view                                                 */
/* ------------------------------------------------------------------ */

function YearView({ entries }) {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  const daysInMonth = new Date(month.y, month.m + 1, 0).getDate();
  const size = 420;
  const cx = size / 2, cy = size / 2;
  const R0 = 34;
  const ringT = 15.5;
  const gap = 2;

  const monthLabel = new Date(month.y, month.m, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const isFutureMonth = new Date(month.y, month.m, 1) > new Date();

  return (
    <div style={{ padding: "18px 16px 0" }}>
      <div style={dvStyles.weekBar}>
        <button style={dvStyles.navBtn} onClick={() => setMonth((m) => shiftMonth(m, -1))}><ChevronLeft size={18} /></button>
        <div style={dvStyles.weekRange}>{monthLabel}</div>
        <button
          onClick={() => setMonth((m) => shiftMonth(m, 1))}
          disabled={isFutureMonth}
          style={{ ...dvStyles.navBtn, opacity: isFutureMonth ? 0.25 : 1 }}
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div style={{ display: "flex", justifyContent: "center" }}>
        <svg width="100%" viewBox={`0 0 ${size} ${size}`} style={{ maxWidth: 380 }}>
          <circle cx={cx} cy={cy} r={R0 - 6} fill="none" stroke={RULE} strokeWidth={1} />
          {CATEGORIES.map((cat, ringIdx) => {
            const inner = R0 + ringIdx * (ringT + gap);
            const outer = inner + ringT;
            return Array.from({ length: daysInMonth }, (_, dayIdx) => {
              const dateStr = fmtDate(new Date(month.y, month.m, dayIdx + 1));
              const level = fillLevel(entries, dateStr, cat);
              const angleStep = 360 / daysInMonth;
              const startA = -90 + dayIdx * angleStep;
              const endA = startA + angleStep - 1.1;
              return (
                <path
                  key={`${cat.id}-${dayIdx}`}
                  d={wedgePath(cx, cy, inner, outer, startA, endA)}
                  fill={level > 0 ? rgba(cat.color, Math.max(0.55, level)) : rgba(cat.color, 0.09)}
                />
              );
            });
          })}
          {/* day-1 marker */}
          <text x={cx} y={R0 - 14} textAnchor="middle" fontSize="9" fill={INK_SOFT} fontFamily="Space Mono, monospace">1</text>
        </svg>
      </div>

      <div style={yStyles.legend}>
        {CATEGORIES.map((cat) => (
          <div key={cat.id} style={yStyles.legendItem}>
            <span style={{ ...yStyles.legendDot, background: cat.color }} />
            <span style={yStyles.legendName}>{cat.name}</span>
          </div>
        ))}
      </div>
      <p style={yStyles.caption}>Each ring is a habit; each wedge, a day. Brighter means logged.</p>
    </div>
  );
}
function shiftMonth(m, n) {
  const d = new Date(m.y, m.m + n, 1);
  return { y: d.getFullYear(), m: d.getMonth() };
}
function polar(cx, cy, r, angleDeg) {
  const a = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}
function wedgePath(cx, cy, inner, outer, startA, endA) {
  const p1 = polar(cx, cy, outer, startA);
  const p2 = polar(cx, cy, outer, endA);
  const p3 = polar(cx, cy, inner, endA);
  const p4 = polar(cx, cy, inner, startA);
  const large = endA - startA > 180 ? 1 : 0;
  return [
    `M ${p1.x} ${p1.y}`,
    `A ${outer} ${outer} 0 ${large} 1 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${inner} ${inner} 0 ${large} 0 ${p4.x} ${p4.y}`,
    "Z",
  ].join(" ");
}

const yStyles = {
  legend: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 12px", marginTop: 20, padding: "14px 4px", borderTop: `1px solid ${RULE}` },
  legendItem: { display: "flex", alignItems: "center", gap: 7 },
  legendDot: { width: 9, height: 9, borderRadius: "50%", flexShrink: 0 },
  legendName: { fontSize: 12.5 },
  caption: { fontSize: 11.5, color: INK_SOFT, fontStyle: "italic", textAlign: "center", marginTop: 6 },
};

/* ------------------------------------------------------------------ */
/*  Insights view                                                      */
/* ------------------------------------------------------------------ */

function InsightsView({ entries }) {
  const last14 = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => fmtDate(addDays(new Date(), -13 + i)));
  }, []);

  const boolCats = CATEGORIES.filter((c) => c.shape === "daily-bool" || c.shape === "daily-bool-type");
  const valueCats = CATEGORIES.filter((c) => c.shape === "daily-value");
  const multiCats = CATEGORIES.filter((c) => c.shape.startsWith("multi"));

  return (
    <div style={{ padding: "18px 16px 12px" }}>
      <SectionLabel>Streaks</SectionLabel>
      <div style={iStyles.streakGrid}>
        {boolCats.map((cat) => (
          <StreakCard key={cat.id} cat={cat} entries={entries} />
        ))}
      </div>

      <SectionLabel>Daily numbers, last 14 days</SectionLabel>
      {valueCats.map((cat) => (
        <MiniChart key={cat.id} cat={cat}
          data={last14.map((d) => ({
            day: d.slice(5),
            v: (dayEntries(entries, d, cat.id)[0]?.value) || 0,
          }))}
        />
      ))}

      <SectionLabel>Frequency, last 14 days</SectionLabel>
      {multiCats.map((cat) => (
        <MiniChart key={cat.id} cat={cat}
          data={last14.map((d) => ({
            day: d.slice(5),
            v: dayEntries(entries, d, cat.id).length,
          }))}
        />
      ))}

      {CATEGORIES.find((c) => c.id === "cigarette") && (
        <CigaretteInsight entries={entries} last14={last14} />
      )}
    </div>
  );
}

function SectionLabel({ children }) {
  return <div style={iStyles.sectionLabel}>{children}</div>;
}

function StreakCard({ cat, entries }) {
  let streak = 0;
  let d = new Date();
  // if today not logged yet, start counting from yesterday
  if (fillLevel(entries, fmtDate(d), cat) === 0) d = addDays(d, -1);
  while (fillLevel(entries, fmtDate(d), cat) > 0) {
    streak += 1;
    d = addDays(d, -1);
  }
  return (
    <div style={iStyles.streakCard}>
      <div style={{ fontSize: 20 }}>{cat.icon}</div>
      <div style={iStyles.streakNum}>{streak}</div>
      <div style={iStyles.streakLabel}>{cat.name} {streak === 1 ? "day" : "days"}</div>
    </div>
  );
}

function MiniChart({ cat, data }) {
  const max = Math.max(1, ...data.map((d) => d.v));
  return (
    <div style={iStyles.chartCard}>
      <div style={iStyles.chartHead}>
        <span style={{ ...yStyles.legendDot, background: cat.color }} />
        <span style={iStyles.chartTitle}>{cat.name}</span>
        <span style={iStyles.chartUnit}>{cat.unit ? cat.unit : "entries/day"}</span>
      </div>
      <ResponsiveContainer width="100%" height={64}>
        <BarChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <XAxis dataKey="day" tick={{ fontSize: 8, fill: INK_SOFT }} axisLine={false} tickLine={false} interval={2} />
          <Tooltip
            cursor={{ fill: rgba(cat.color, 0.08) }}
            contentStyle={{ fontSize: 11, borderRadius: 8, border: `1px solid ${RULE}` }}
          />
          <Bar dataKey="v" radius={[3, 3, 0, 0]} fill={cat.color} maxBarSize={10} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function CigaretteInsight({ entries, last14 }) {
  const cat = CATEGORIES.find((c) => c.id === "cigarette");
  const all14 = last14.flatMap((d) => dayEntries(entries, d, "cigarette"));
  const avgCraving = avg(all14.map((e) => e.craving));
  const avgEnjoy = avg(all14.map((e) => e.enjoyment));
  return (
    <div style={{ ...iStyles.chartCard, marginTop: 4 }}>
      <div style={iStyles.chartHead}>
        <span style={{ ...yStyles.legendDot, background: cat.color }} />
        <span style={iStyles.chartTitle}>Cigarette quality, last 14 days</span>
      </div>
      <div style={iStyles.pairRow}>
        <div style={iStyles.pairCard}>
          <div style={iStyles.pairNum}>{avgCraving}</div>
          <div style={iStyles.pairLabel}>avg craving (1&ndash;4)</div>
        </div>
        <div style={iStyles.pairCard}>
          <div style={iStyles.pairNum}>{avgEnjoy}</div>
          <div style={iStyles.pairLabel}>avg enjoyment (1&ndash;4)</div>
        </div>
      </div>
    </div>
  );
}

const iStyles = {
  sectionLabel: { fontFamily: "'Fraunces', serif", fontSize: 14, fontWeight: 600, margin: "22px 2px 10px", color: ACCENT },
  streakGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 },
  streakCard: { background: "rgba(255,255,255,0.55)", border: `1px solid ${RULE}`, borderRadius: 10, padding: "10px 4px", textAlign: "center" },
  streakNum: { fontFamily: "'Space Mono', monospace", fontSize: 18, fontWeight: 700, marginTop: 4 },
  streakLabel: { fontSize: 9.5, color: INK_SOFT, marginTop: 2 },
  chartCard: { background: "rgba(255,255,255,0.55)", border: `1px solid ${RULE}`, borderRadius: 10, padding: "10px 12px", marginBottom: 10 },
  chartHead: { display: "flex", alignItems: "center", gap: 6, marginBottom: 2 },
  chartTitle: { fontSize: 12.5, fontWeight: 600 },
  chartUnit: { fontSize: 10, color: INK_SOFT, marginLeft: "auto", fontFamily: "'Space Mono', monospace" },
  pairRow: { display: "flex", gap: 10, marginTop: 8 },
  pairCard: { flex: 1, textAlign: "center", background: "rgba(0,0,0,0.02)", borderRadius: 8, padding: "10px 0" },
  pairNum: { fontFamily: "'Space Mono', monospace", fontSize: 20, fontWeight: 700 },
  pairLabel: { fontSize: 10, color: INK_SOFT, marginTop: 2 },
};