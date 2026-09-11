import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import "./App.css";

type Goal = "fat-loss" | "recomposition" | "maintain" | "muscle-gain";
type Workout = "rest" | "yoga" | "strength" | "cardio" | "easy-run" | "long-run" | "double-session";
type Intensity = "easy" | "moderate" | "hard";
type Sweat = "low" | "medium" | "high";
type Tab = "today" | "profile";
type AdviceStatus = "recommended" | "conditional" | "routine" | "not-needed" | "check";

interface Profile { name: string; age: number | ""; sex: "female" | "male"; heightCm: number | ""; weightKg: number | ""; goal: Goal; }
interface Training { workout: Workout; duration: number; intensity: Intensity; sweat: Sweat; }
interface Supplement { id: string; name: string; detail: string; custom?: boolean; }
interface Advice extends Supplement { status: AdviceStatus; reason: string; }

const PROFILE_KEY = "dailyFuelProfileV3";
const TRAINING_KEY = "dailyFuelTrainingV3";
const SELECTED_KEY = "dailyFuelSupplementsV3";
const INVENTORY_KEY = "dailyFuelInventoryV3";

const defaultSupplements: Supplement[] = [
  { id: "whey", name: "Whey Protein", detail: "Protein top-up" },
  { id: "creatine", name: "Creatine", detail: "5 g serving" },
  { id: "electrolytes", name: "Zero-Sugar Electrolyte Complex", detail: "Hydration support" },
  { id: "omega3", name: "High-Yield Omega-3 Fish Oil", detail: "Daily nutrition" },
  { id: "d3k2", name: "Vitamin D3 + K2", detail: "Use as directed" },
  { id: "calmag", name: "Calcium and Magnesium", detail: "Mineral supplement" },
  { id: "sleep", name: "Force Factor Deep Sleep", detail: "Night-time blend" },
  { id: "iron", name: "Thorne Iron Bisglycinate", detail: "25 mg iron" },
  { id: "vitaminc", name: "California Gold Nutrition Vitamin C", detail: "1,000 mg" },
];

const defaultProfile: Profile = { name: "", age: "", sex: "female", heightCm: "", weightKg: "", goal: "recomposition" };
const defaultTraining: Training = { workout: "strength", duration: 60, intensity: "moderate", sweat: "medium" };
const statusOrder: AdviceStatus[] = ["recommended", "conditional", "routine", "not-needed", "check"];
const statusLabels: Record<AdviceStatus, string> = { recommended: "Recommended today", conditional: "Only if needed", routine: "Usual routine", "not-needed": "Not needed today", check: "Check first" };

function safelyLoad<T>(key: string, fallback: T): T { try { const value = localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback; } catch { return fallback; } }
function isProfileComplete(profile: Profile) { return profile.age !== "" && profile.heightCm !== "" && profile.weightKg !== ""; }

function getAdvice(item: Supplement, training: Training): Advice {
  if (item.custom) return { ...item, status: "check", reason: "Not automatically assessed. Follow the product label and professional advice." };
  const trainingDay = training.workout !== "rest";
  const demanding = training.duration >= 60 && (training.intensity === "hard" || training.workout === "double-session");
  const hydrationNeed = trainingDay && (training.sweat === "high" || training.duration >= 75 || training.workout === "long-run" || training.workout === "double-session");
  switch (item.id) {
    case "whey": return { ...item, status: ["strength", "cardio", "long-run", "double-session"].includes(training.workout) ? "conditional" : "not-needed", reason: trainingDay ? "Use only if meals will not cover your protein target." : "Normal meals can usually cover today’s protein target." };
    case "creatine": return { ...item, status: "recommended", reason: "Continue your usual daily 5 g serving. Consistency matters more than workout timing." };
    case "electrolytes": return { ...item, status: hydrationNeed ? "recommended" : "not-needed", reason: hydrationNeed ? `Suggested because you selected ${training.duration} minutes with ${training.sweat} sweat demand.` : "Water is usually sufficient for this shorter, lower-sweat session." };
    case "omega3": return { ...item, status: "routine", reason: "Continue with food if this is part of your normal routine; it is not workout-specific." };
    case "d3k2": return { ...item, status: "routine", reason: "Continue only as previously advised; today’s workout does not change the need." };
    case "calmag": return { ...item, status: "routine", reason: "Not workout-specific. Stay within the label directions and your usual plan." };
    case "sleep": return { ...item, status: demanding ? "conditional" : "routine", reason: demanding ? "Optional tonight if already tolerated. Avoid combining with alcohol or sedating products." : "Use only as part of your established night-time routine after checking the label." };
    case "iron": return { ...item, status: "check", reason: "Never take iron because of a workout. Use only when blood tests and a clinician confirm the need and dose." };
    case "vitaminc": return { ...item, status: "not-needed", reason: "An additional workout dose is not needed. Avoid stacking other vitamin C products." };
    default: return { ...item, status: "check", reason: "Follow the product label and seek professional advice if unsure." };
  }
}

function App() {
  const initialProfile = safelyLoad(PROFILE_KEY, defaultProfile);
  const [profile, setProfile] = useState<Profile>(initialProfile);
  const [training, setTraining] = useState<Training>(() => safelyLoad(TRAINING_KEY, defaultTraining));
  const [inventory, setInventory] = useState<Supplement[]>(() => safelyLoad(INVENTORY_KEY, defaultSupplements));
  const [selected, setSelected] = useState<string[]>(() => safelyLoad(SELECTED_KEY, []));
  const [tab, setTab] = useState<Tab>(() => isProfileComplete(initialProfile) ? "today" : "profile");
  const [manageInventory, setManageInventory] = useState(false);
  const [name, setName] = useState("");
  const [detail, setDetail] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [removed, setRemoved] = useState<Supplement | null>(null);
  const [notice, setNotice] = useState("");
  const [results, setResults] = useState<{ calories: number; protein: number; carbs: number; fat: number } | null>(null);

  useEffect(() => localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)), [profile]);
  useEffect(() => localStorage.setItem(TRAINING_KEY, JSON.stringify(training)), [training]);
  useEffect(() => localStorage.setItem(INVENTORY_KEY, JSON.stringify(inventory)), [inventory]);
  useEffect(() => localStorage.setItem(SELECTED_KEY, JSON.stringify(selected)), [selected]);
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(""), 2600); return () => window.clearTimeout(timer); }, [notice]);

  const advice = useMemo(() => inventory.filter((item) => selected.includes(item.id)).map((item) => getAdvice(item, training)).sort((a, b) => statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status)), [inventory, selected, training]);
  function updateProfile<K extends keyof Profile>(field: K, value: Profile[K]) { setProfile((current) => ({ ...current, [field]: value })); }
  function updateTraining<K extends keyof Training>(field: K, value: Training[K]) { setTraining((current) => ({ ...current, [field]: value })); setResults(null); }
  function numericProfile(field: "age" | "heightCm" | "weightKg", value: string) { updateProfile(field, value === "" ? "" : Number(value)); }
  function toggleSupplement(id: string) { setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]); }
  function resetForm() { setName(""); setDetail(""); setEditingId(null); }

  function saveSupplement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const cleanName = name.trim(); if (!cleanName) return; const cleanDetail = detail.trim() || "Custom supplement";
    if (editingId) { setInventory((current) => current.map((item) => item.id === editingId ? { ...item, name: cleanName, detail: cleanDetail } : item)); setNotice("Changes saved"); }
    else { setInventory((current) => [...current, { id: `custom-${Date.now()}`, name: cleanName, detail: cleanDetail, custom: true }]); setNotice("Supplement added"); }
    resetForm();
  }

  function removeSupplement(item: Supplement) { setInventory((current) => current.filter((value) => value.id !== item.id)); setSelected((current) => current.filter((value) => value !== item.id)); setRemoved(item); setNotice("Removed from inventory"); if (editingId === item.id) resetForm(); }
  function undoRemove() { if (!removed) return; setInventory((current) => [...current, removed]); setRemoved(null); setNotice("Supplement restored"); }
  function restoreDefaults() { setInventory((current) => { const ids = new Set(current.map((item) => item.id)); return [...current, ...defaultSupplements.filter((item) => !ids.has(item.id))]; }); setNotice("Defaults restored"); }

  function calculatePlan() {
    const { age, sex, heightCm, weightKg, goal } = profile;
    if (age === "" || heightCm === "" || weightKg === "") { setTab("profile"); setNotice("Complete your profile first"); return; }
    if (age < 18 || age > 100 || heightCm < 120 || heightCm > 230 || weightKg < 35 || weightKg > 250) { setTab("profile"); setNotice("Check your age, height and weight"); return; }
    const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === "male" ? 5 : -161);
    const goalFactor: Record<Goal, number> = { "fat-loss": .88, recomposition: .95, maintain: 1, "muscle-gain": 1.08 };
    const intensityFactor: Record<Intensity, number> = { easy: .75, moderate: 1, hard: 1.25 };
    const workoutPerHour: Record<Workout, number> = { rest: 0, yoga: 80, strength: 180, cardio: 220, "easy-run": 200, "long-run": 300, "double-session": 330 };
    const calorieTarget = bmr * 1.4 * goalFactor[goal] + workoutPerHour[training.workout] * (training.duration / 60) * intensityFactor[training.intensity];
    const proteinFactor: Record<Goal, number> = { "fat-loss": 2, recomposition: 1.9, maintain: 1.6, "muscle-gain": 1.8 };
    const protein = Math.round(weightKg * proteinFactor[goal]); const fat = Math.round(weightKg * .8);
    setResults({ calories: Math.round(calorieTarget), protein, fat, carbs: Math.max(0, Math.round((calorieTarget - protein * 4 - fat * 9) / 4)) });
  }

  function clearAll() { [PROFILE_KEY, TRAINING_KEY, INVENTORY_KEY, SELECTED_KEY].forEach((key) => localStorage.removeItem(key)); setProfile(defaultProfile); setTraining(defaultTraining); setInventory(defaultSupplements); setSelected([]); setResults(null); setTab("profile"); resetForm(); setNotice("Saved data cleared"); }

  return <main className="page"><section className="calculator">
    <header><p className="eyebrow">DAILY TRAINING NUTRITION</p><h1>Daily Fuel</h1><p className="intro">A simple daily target and supplement plan built around the products you already own.</p></header>
    <nav className="tabs" aria-label="Daily Fuel sections"><button className={tab === "today" ? "active" : ""} onClick={() => setTab("today")}>Today</button><button className={tab === "profile" ? "active" : ""} onClick={() => setTab("profile")}>Profile & inventory</button></nav>

    {tab === "today" ? <>
      {!isProfileComplete(profile) && <button className="setup-prompt" onClick={() => setTab("profile")}><strong>Complete your profile</strong><span>Add age, height and weight before calculating →</span></button>}
      <section className="panel"><div className="section-heading"><span>01</span><div><h2>Today&apos;s training</h2><p>Adjust what is different today.</p></div></div><div className="form-grid">
        <label className="full-width">Workout<select value={training.workout} onChange={(event) => updateTraining("workout", event.target.value as Workout)}><option value="rest">Rest day</option><option value="yoga">Yoga or Pilates</option><option value="strength">Strength or BFT strength</option><option value="cardio">BFT cardio or mixed training</option><option value="easy-run">Easy run</option><option value="long-run">Long or hard run</option><option value="double-session">Double session</option></select></label>
        <label>Duration<select value={training.duration} onChange={(event) => updateTraining("duration", Number(event.target.value))}><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">60 minutes</option><option value="75">75 minutes</option><option value="90">90+ minutes</option></select></label>
        <label>Intensity<select value={training.intensity} onChange={(event) => updateTraining("intensity", event.target.value as Intensity)}><option value="easy">Easy</option><option value="moderate">Moderate</option><option value="hard">Hard</option></select></label>
        <label className="full-width">Sweat level<select value={training.sweat} onChange={(event) => updateTraining("sweat", event.target.value as Sweat)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
      </div></section><button className="calculate-button sticky-action" onClick={calculatePlan}>Calculate today&apos;s plan</button>
      {results && <section className="results" aria-live="polite"><div className="results-heading"><div><p className="eyebrow">TODAY&apos;S ESTIMATE</p><h2>{profile.name ? `${profile.name}'s plan` : "Your daily plan"}</h2></div><strong>{results.calories} kcal</strong></div><div className="macro-grid"><article><span>Protein</span><strong>{results.protein} g</strong></article><article><span>Carbohydrates</span><strong>{results.carbs} g</strong></article><article><span>Fat</span><strong>{results.fat} g</strong></article></div>
        <div className="supplement-plan"><div className="section-heading compact"><span>02</span><div><h2>What matters today</h2><p>Only products in your inventory are shown.</p></div></div>{advice.length === 0 ? <div className="empty-state">No inventory items selected. Add or select products under Profile & inventory.</div> : <div className="advice-list">{advice.map((item) => <article className={`advice-card ${item.status}`} key={item.id}><span className="status">{statusLabels[item.status]}</span><h3>{item.name}</h3><p>{item.reason}</p></article>)}</div>}<div className="safety-note"><strong>Safety check</strong><p>Supplements can interact with medicines and health conditions. Check with a clinician or pharmacist if pregnant, managing a condition, taking medication, or unsure about combined ingredients. Vitamin K can interact with warfarin.</p></div></div>
      </section>}
    </> : <>
      <section className="panel"><div className="section-heading"><span>01</span><div><h2>Your profile</h2><p>Set this once; update it when your details change.</p></div></div><div className="form-grid"><label>Name<input value={profile.name} placeholder="Your name" onChange={(event) => updateProfile("name", event.target.value)} /></label><label>Age<input type="number" value={profile.age} placeholder="e.g. 44" min="18" max="100" onChange={(event) => numericProfile("age", event.target.value)} /></label><label>Sex<select value={profile.sex} onChange={(event) => updateProfile("sex", event.target.value as Profile["sex"])}><option value="female">Female</option><option value="male">Male</option></select></label><label>Height in cm<input type="number" value={profile.heightCm} placeholder="e.g. 163" min="120" max="230" onChange={(event) => numericProfile("heightCm", event.target.value)} /></label><label>Weight in kg<input type="number" value={profile.weightKg} placeholder="e.g. 55" min="35" max="250" step=".1" onChange={(event) => numericProfile("weightKg", event.target.value)} /></label><label>Goal<select value={profile.goal} onChange={(event) => updateProfile("goal", event.target.value as Goal)}><option value="fat-loss">Lose fat</option><option value="recomposition">Lose fat and build muscle</option><option value="maintain">Maintain</option><option value="muscle-gain">Build muscle</option></select></label></div></section>
      <section className="panel supplement-panel"><div className="section-heading inventory-heading"><span>02</span><div><h2>My supplement inventory</h2><p>Select what you have. Daily Fuel recommends only from these items.</p></div><button className="manage-button" onClick={() => { setManageInventory((value) => !value); resetForm(); }}>{manageInventory ? "Done" : "Manage"}</button></div><div className="supplement-list">{inventory.map((item) => <div className={`supplement-option ${selected.includes(item.id) ? "selected" : ""}`} key={item.id}><label className="supplement-choice"><input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggleSupplement(item.id)} /><span className="checkmark" aria-hidden="true">{selected.includes(item.id) ? "✓" : ""}</span><span><strong>{item.name}</strong><small>{item.detail}</small></span></label>{manageInventory && <span className="inventory-actions">{item.custom && <button onClick={() => { setEditingId(item.id); setName(item.name); setDetail(item.detail); }}>Edit</button>}<button className="remove-supplement" onClick={() => removeSupplement(item)}>Remove</button></span>}</div>)}</div>
        {inventory.length === 0 && <p className="empty-inventory">Your inventory is empty.</p>}<p className="selection-count">{selected.length} of {inventory.length} available products selected</p>{manageInventory && <><form className="add-supplement" onSubmit={saveSupplement}><h3>{editingId ? "Edit custom supplement" : "Add a supplement"}</h3><label>Name<input value={name} maxLength={80} placeholder="e.g. Collagen peptides" onChange={(event) => setName(event.target.value)} /></label><label>Serving or ingredients<input value={detail} maxLength={120} placeholder="Optional" onChange={(event) => setDetail(event.target.value)} /></label><div className="form-actions"><button className="save-supplement" disabled={!name.trim()}>{editingId ? "Save changes" : "Add to inventory"}</button>{editingId && <button className="cancel-edit" type="button" onClick={resetForm}>Cancel</button>}</div></form>{defaultSupplements.some((item) => !inventory.some((entry) => entry.id === item.id)) && <button className="restore-button" onClick={restoreDefaults}>Restore default supplements</button>}</>}
      </section><button className="continue-button" onClick={() => setTab("today")}>Continue to Today →</button>
    </>}
    <div className="privacy"><p>Your information stays in this browser. General estimates only—not medical or dietetic advice.</p><button className="clear-button" onClick={clearAll}>Clear my saved data</button></div>{notice && <div className="toast" role="status"><span>{notice}</span>{removed && notice === "Removed from inventory" && <button onClick={undoRemove}>Undo</button>}</div>}
  </section></main>;
}

export default App;
