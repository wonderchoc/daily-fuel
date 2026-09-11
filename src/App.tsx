import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import "./App.css";

type Goal = "fat-loss" | "recomposition" | "maintain" | "muscle-gain";
type Workout = "rest" | "yoga" | "strength" | "cardio" | "easy-run" | "long-run" | "double-session";
type Intensity = "easy" | "moderate" | "hard";
type Sweat = "low" | "medium" | "high";
type Tab = "today" | "intake" | "plan" | "profile";
type AdviceStatus = "recommended" | "conditional" | "routine" | "not-needed" | "check";

interface Profile { name: string; age: number | ""; sex: "female" | "male"; heightCm: number | ""; weightKg: number | ""; goal: Goal; }
interface Training { workout: Workout; duration: number; intensity: Intensity; sweat: Sweat; caloriesBurned: number | ""; proteinEaten: number | ""; }
interface ProteinIntake { wheyProtein: number | ""; chicken: number | ""; pork: number | ""; beef: number | ""; fish: number | ""; tofu: number | ""; otherProtein: number | ""; }
interface Supplement { id: string; name: string; detail: string; custom?: boolean; }
interface Advice extends Supplement { status: AdviceStatus; reason: string; amount: string; }

const PROFILE_KEY = "dailyFuelProfileV3";
const TRAINING_KEY = "dailyFuelTrainingV3";
const SELECTED_KEY = "dailyFuelSupplementsV3";
const INVENTORY_KEY = "dailyFuelInventoryV3";
const PROTEIN_INTAKE_KEY = "dailyFuelProteinIntakeV1";

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
const defaultTraining: Training = { workout: "strength", duration: 60, intensity: "moderate", sweat: "medium", caloriesBurned: "", proteinEaten: "" };
const defaultProteinIntake: ProteinIntake = { wheyProtein: "", chicken: "", pork: "", beef: "", fish: "", tofu: "", otherProtein: "" };
const proteinPer100 = { chicken: 31, pork: 27, beef: 26, fish: 25, tofu: 12 } as const;
const carbsPer100 = { rice: 28, noodles: 25, potato: 17, oats: 66 } as const;
const proteinFactorByGoal: Record<Goal, number> = { "fat-loss": 2, recomposition: 1.9, maintain: 1.6, "muscle-gain": 1.8 };
const statusOrder: AdviceStatus[] = ["recommended", "conditional", "routine", "not-needed", "check"];
const statusLabels: Record<AdviceStatus, string> = { recommended: "Recommended today", conditional: "Only if needed", routine: "Usual routine", "not-needed": "Not needed today", check: "Check first" };
const intensityMascot: Record<Intensity, string> = { easy: "🐻", moderate: "🐻‍🏃", hard: "🐻🔥" };
const sweatMascot: Record<Sweat, string> = { low: "🐻", medium: "🐻💧", high: "🐻💦" };

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null; }
function isOptionalNumber(value: unknown, min: number, max: number) { return value === "" || (typeof value === "number" && Number.isFinite(value) && value >= min && value <= max); }
function isProfile(value: unknown): value is Profile {
  if (!isRecord(value)) return false;
  return typeof value.name === "string" && ["female", "male"].includes(String(value.sex)) && ["fat-loss", "recomposition", "maintain", "muscle-gain"].includes(String(value.goal)) && isOptionalNumber(value.age, 18, 100) && isOptionalNumber(value.heightCm, 120, 230) && isOptionalNumber(value.weightKg, 35, 250);
}
function isTraining(value: unknown): value is Training {
  if (!isRecord(value)) return false;
  return ["rest", "yoga", "strength", "cardio", "easy-run", "long-run", "double-session"].includes(String(value.workout)) && typeof value.duration === "number" && Number.isFinite(value.duration) && value.duration >= 10 && value.duration <= 180 && ["easy", "moderate", "hard"].includes(String(value.intensity)) && ["low", "medium", "high"].includes(String(value.sweat)) && isOptionalNumber(value.caloriesBurned, 0, 3000) && isOptionalNumber(value.proteinEaten, 0, 500);
}
function isInventory(value: unknown): value is Supplement[] { return Array.isArray(value) && value.length <= 100 && value.every((item) => isRecord(item) && typeof item.id === "string" && item.id.length <= 100 && typeof item.name === "string" && item.name.length <= 80 && typeof item.detail === "string" && item.detail.length <= 120 && (item.custom === undefined || typeof item.custom === "boolean")); }
function isSelection(value: unknown): value is string[] { return Array.isArray(value) && value.length <= 100 && value.every((item) => typeof item === "string" && item.length <= 100); }
function isProteinIntake(value: unknown): value is ProteinIntake { return isRecord(value) && isOptionalNumber(value.wheyProtein, 0, 500) && isOptionalNumber(value.chicken, 0, 2000) && isOptionalNumber(value.pork, 0, 2000) && isOptionalNumber(value.beef, 0, 2000) && isOptionalNumber(value.fish, 0, 2000) && isOptionalNumber(value.tofu, 0, 2000) && isOptionalNumber(value.otherProtein, 0, 500); }
function safelyLoad<T>(key: string, fallback: T, validate: (value: unknown) => value is T): T { try { const value: unknown = JSON.parse(localStorage.getItem(key) ?? "null"); return validate(value) ? value : fallback; } catch { return fallback; } }
function isProfileComplete(profile: Profile) { return profile.age !== "" && profile.heightCm !== "" && profile.weightKg !== ""; }
function estimateCaloriesBurned(profile: Profile, training: Training) {
  if (training.workout === "rest") return 0;
  const weight = typeof profile.weightKg === "number" && profile.weightKg >= 35 && profile.weightKg <= 250 ? profile.weightKg : 60;
  const mets: Record<Workout, number> = { rest: 1, yoga: 2.8, strength: 5, cardio: 7, "easy-run": 7, "long-run": 9, "double-session": 9 };
  const intensity: Record<Intensity, number> = { easy: .8, moderate: 1, hard: 1.2 };
  return Math.round(mets[training.workout] * intensity[training.intensity] * 3.5 * weight / 200 * training.duration);
}

function getAdvice(item: Supplement, training: Training, proteinRemaining: number | null): Advice {
  if (item.custom) return { ...item, status: "check", amount: "Not calculated", reason: "Not automatically assessed. Follow the product label and professional advice." };
  const trainingDay = training.workout !== "rest";
  const demanding = training.duration >= 60 && (training.intensity === "hard" || training.workout === "double-session");
  const hydrationNeed = trainingDay && (training.sweat === "high" || training.duration >= 75 || training.workout === "long-run" || training.workout === "double-session");
  switch (item.id) {
    case "whey": return { ...item, status: proteinRemaining === 0 ? "not-needed" : "conditional", amount: proteinRemaining === null ? "After protein gap is calculated" : proteinRemaining === 0 ? "None needed" : `Up to ${Math.min(25, proteinRemaining)} g protein (check scoop label)`, reason: "Use whey only for the part of your protein target that meals will not cover." };
    case "creatine": return { ...item, status: "recommended", amount: "5 g", reason: "Continue your usual daily serving. Consistency matters more than workout timing." };
    case "electrolytes": return { ...item, status: hydrationNeed ? "recommended" : "not-needed", amount: hydrationNeed ? "1 label serving in water" : "None needed for training", reason: hydrationNeed ? `Suggested because you selected ${training.duration} minutes with ${training.sweat} sweat demand.` : "Water is usually sufficient for this shorter, lower-sweat session." };
    case "omega3": return { ...item, status: "routine", amount: "Your usual label serving", reason: "Continue with food if this is part of your normal routine; it is not workout-specific." };
    case "d3k2": return { ...item, status: "routine", amount: "Only the advised label serving", reason: "Continue only as previously advised; today’s workout does not change the need." };
    case "calmag": return { ...item, status: "routine", amount: "Your usual label serving", reason: "Not workout-specific. Stay within the label directions and your usual plan." };
    case "sleep": return { ...item, status: demanding ? "conditional" : "routine", amount: "Only the label serving", reason: demanding ? "Optional tonight if already tolerated. Avoid combining with alcohol or sedating products." : "Use only as part of your established night-time routine after checking the label." };
    case "iron": return { ...item, status: "check", amount: "25 mg only if clinician-directed", reason: "Never take iron because of a workout. Use only when blood tests and a clinician confirm the need and dose." };
    case "vitaminc": return { ...item, status: "not-needed", amount: "No extra workout dose", reason: "An additional workout dose is not needed. Avoid stacking other vitamin C products." };
    default: return { ...item, status: "check", amount: "Follow the product label", reason: "Seek professional advice if unsure." };
  }
}

function App() {
  const initialProfile = safelyLoad(PROFILE_KEY, defaultProfile, isProfile);
  const [profile, setProfile] = useState<Profile>(initialProfile);
  const [training, setTraining] = useState<Training>(() => safelyLoad(TRAINING_KEY, defaultTraining, isTraining));
  const [inventory, setInventory] = useState<Supplement[]>(() => safelyLoad(INVENTORY_KEY, defaultSupplements, isInventory));
  const [selected, setSelected] = useState<string[]>(() => safelyLoad(SELECTED_KEY, [], isSelection));
  const [proteinIntake, setProteinIntake] = useState<ProteinIntake>(() => safelyLoad(PROTEIN_INTAKE_KEY, defaultProteinIntake, isProteinIntake));
  const [tab, setTab] = useState<Tab>(() => isProfileComplete(initialProfile) ? "today" : "profile");
  const [manageInventory, setManageInventory] = useState(false);
  const [name, setName] = useState("");
  const [detail, setDetail] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [removed, setRemoved] = useState<Supplement | null>(null);
  const [notice, setNotice] = useState("");
  const [showAllAdvice, setShowAllAdvice] = useState(false);
  const [results, setResults] = useState<{ calories: number; protein: number; carbs: number; fat: number } | null>(null);

  useEffect(() => localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)), [profile]);
  useEffect(() => localStorage.setItem(TRAINING_KEY, JSON.stringify(training)), [training]);
  useEffect(() => localStorage.setItem(INVENTORY_KEY, JSON.stringify(inventory)), [inventory]);
  useEffect(() => localStorage.setItem(SELECTED_KEY, JSON.stringify(selected)), [selected]);
  useEffect(() => localStorage.setItem(PROTEIN_INTAKE_KEY, JSON.stringify(proteinIntake)), [proteinIntake]);
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(""), 2600); return () => window.clearTimeout(timer); }, [notice]);

  const totalProteinEaten = useMemo(() => Math.round(((proteinIntake.wheyProtein || 0) + (proteinIntake.chicken || 0) * proteinPer100.chicken / 100 + (proteinIntake.pork || 0) * proteinPer100.pork / 100 + (proteinIntake.beef || 0) * proteinPer100.beef / 100 + (proteinIntake.fish || 0) * proteinPer100.fish / 100 + (proteinIntake.tofu || 0) * proteinPer100.tofu / 100 + (proteinIntake.otherProtein || 0)) * 10) / 10, [proteinIntake]);
  const proteinTarget = useMemo(() => typeof profile.weightKg === "number" && profile.weightKg >= 35 && profile.weightKg <= 250 ? Math.round(profile.weightKg * proteinFactorByGoal[profile.goal]) : null, [profile.weightKg, profile.goal]);
  const proteinRemaining = proteinTarget === null ? null : Math.max(0, Math.round((proteinTarget - totalProteinEaten) * 10) / 10);
  const remainingProtein = proteinRemaining ?? 0;
  const proteinProgressPercent = proteinTarget === null ? 0 : Math.min(100, Math.round(totalProteinEaten / proteinTarget * 100));
  const advice = useMemo(() => inventory.filter((item) => selected.includes(item.id)).map((item) => getAdvice(item, training, proteinRemaining)).sort((a, b) => statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status)), [inventory, selected, training, proteinRemaining]);
  const visibleAdvice = showAllAdvice ? advice : advice.filter((item) => item.status === "recommended" || item.status === "conditional" || item.status === "check");
  const estimatedBurn = useMemo(() => estimateCaloriesBurned(profile, training), [profile, training]);
  function updateProfile<K extends keyof Profile>(field: K, value: Profile[K]) { setProfile((current) => ({ ...current, [field]: value })); }
  function updateTraining<K extends "workout" | "duration" | "intensity" | "sweat">(field: K, value: Training[K]) { setTraining((current) => ({ ...current, [field]: value, caloriesBurned: "" })); setResults(null); }
  function numericProfile(field: "age" | "heightCm" | "weightKg", value: string) { updateProfile(field, value === "" ? "" : Number(value)); }
  function updateProteinIntake(field: keyof ProteinIntake, value: string) { setProteinIntake((current) => ({ ...current, [field]: value === "" ? "" : Number(value) })); }
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
    const caloriesBurned = training.caloriesBurned === "" ? estimatedBurn : training.caloriesBurned;
    if (!Number.isFinite(caloriesBurned) || caloriesBurned < 0 || caloriesBurned > 3000) { setNotice("Calories burned must be between 0 and 3,000"); return; }
    if (!isProteinIntake(proteinIntake)) { setNotice("Check the protein food amounts entered"); return; }
    const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === "male" ? 5 : -161);
    const goalFactor: Record<Goal, number> = { "fat-loss": .88, recomposition: .95, maintain: 1, "muscle-gain": 1.08 };
    const calorieTarget = bmr * 1.4 * goalFactor[goal] + caloriesBurned;
    const protein = Math.round(weightKg * proteinFactorByGoal[goal]); const fat = Math.round(weightKg * .8);
    setResults({ calories: Math.round(calorieTarget), protein, fat, carbs: Math.max(0, Math.round((calorieTarget - protein * 4 - fat * 9) / 4)) });
    setTab("plan");
  }

  function clearAll() { [PROFILE_KEY, TRAINING_KEY, INVENTORY_KEY, SELECTED_KEY, PROTEIN_INTAKE_KEY].forEach((key) => localStorage.removeItem(key)); setProfile(defaultProfile); setTraining(defaultTraining); setProteinIntake(defaultProteinIntake); setInventory(defaultSupplements); setSelected([]); setResults(null); setTab("profile"); resetForm(); setNotice("Saved data cleared"); }

  return <main className="page"><section className="calculator">
    <header><p className="eyebrow">DAILY TRAINING NUTRITION</p><h1>Daily Fuel</h1><p className="intro">Your workout, intake and daily fuel plan—without the clutter.</p></header>

    {tab === "today" && <>
      {!isProfileComplete(profile) && <button className="setup-prompt" onClick={() => setTab("profile")}><strong>Complete your profile</strong><span>Add age, height and weight before calculating →</span></button>}
      <section className="panel workout-panel"><div className="section-heading"><span>🐻</span><div><h2>Today&apos;s workout</h2><p>Tell Fuel Bear what you&apos;re doing.</p></div></div><div className="form-grid workout-form-grid">
        <label className="full-width">Workout<select value={training.workout} onChange={(event) => updateTraining("workout", event.target.value as Workout)}><option value="rest">Rest day</option><option value="yoga">Yoga or Pilates</option><option value="strength">Strength or BFT strength</option><option value="cardio">BFT cardio or mixed training</option><option value="easy-run">Easy run</option><option value="long-run">Long or hard run</option><option value="double-session">Double session</option></select></label>
        <label className="full-width duration-control"><span className="control-heading"><span>🐻⏱️ Duration</span><strong>{training.duration} min</strong></span><input type="range" min="10" max="180" step="5" value={training.duration} onChange={(event) => updateTraining("duration", Number(event.target.value))} aria-label="Workout duration in minutes" /><span className="range-labels"><small>10 min</small><small>180 min</small></span></label>
        <fieldset className="segmented-field"><legend>Intensity</legend><div className="segmented-buttons mascot-buttons">{(["easy", "moderate", "hard"] as Intensity[]).map((level) => <button type="button" className={training.intensity === level ? "active" : ""} aria-pressed={training.intensity === level} key={level} onClick={() => updateTraining("intensity", level)}><span>{intensityMascot[level]}</span><small>{level === "moderate" ? "Mod" : level[0].toUpperCase() + level.slice(1)}</small></button>)}</div></fieldset>
        <fieldset className="segmented-field"><legend>Sweat</legend><div className="segmented-buttons mascot-buttons">{(["low", "medium", "high"] as Sweat[]).map((level) => <button type="button" className={training.sweat === level ? "active" : ""} aria-pressed={training.sweat === level} key={level} onClick={() => updateTraining("sweat", level)}><span>{sweatMascot[level]}</span><small>{level === "medium" ? "Med" : level[0].toUpperCase() + level.slice(1)}</small></button>)}</div></fieldset>
        <label className="full-width compact-calories">Calories burned<input type="number" min="0" max="3000" value={training.caloriesBurned === "" ? estimatedBurn : training.caloriesBurned} onChange={(event) => setTraining((current) => ({ ...current, caloriesBurned: event.target.value === "" ? "" : Number(event.target.value) }))} /><small className="field-note">Ballpark: {estimatedBurn} kcal. <button type="button" onClick={() => setTraining((current) => ({ ...current, caloriesBurned: "" }))}>Use estimate</button></small></label>
      </div></section><div className="action-row"><button className="secondary-action" onClick={() => setTab("intake")}>Log food</button><button className="calculate-button" onClick={calculatePlan}>Calculate plan</button></div>
    </>}

    {tab === "intake" && <><section className="panel intake-panel"><div className="tracker-heading"><div><p className="eyebrow">PROTEIN INTAKE</p><h2>What have you eaten?</h2></div><strong>{totalProteinEaten} g</strong></div><p className="tracker-intro">Cooked weights; enter actual protein grams for whey and Other.</p><div className="intake-grid">
      <label><span>🥤 Whey</span><span className="input-unit"><input type="number" min="0" max="500" value={proteinIntake.wheyProtein} placeholder="0" onChange={(event) => updateProteinIntake("wheyProtein", event.target.value)} /><small>g protein</small></span></label><label><span>🍗 Chicken</span><span className="input-unit"><input type="number" min="0" max="2000" value={proteinIntake.chicken} placeholder="0" onChange={(event) => updateProteinIntake("chicken", event.target.value)} /><small>g cooked</small></span></label><label><span>🥩 Pork</span><span className="input-unit"><input type="number" min="0" max="2000" value={proteinIntake.pork} placeholder="0" onChange={(event) => updateProteinIntake("pork", event.target.value)} /><small>g cooked</small></span></label><label><span>🥩 Beef</span><span className="input-unit"><input type="number" min="0" max="2000" value={proteinIntake.beef} placeholder="0" onChange={(event) => updateProteinIntake("beef", event.target.value)} /><small>g cooked</small></span></label><label><span>🐟 Fish</span><span className="input-unit"><input type="number" min="0" max="2000" value={proteinIntake.fish} placeholder="0" onChange={(event) => updateProteinIntake("fish", event.target.value)} /><small>g cooked</small></span></label><label><span>◻️ Tofu</span><span className="input-unit"><input type="number" min="0" max="2000" value={proteinIntake.tofu} placeholder="0" onChange={(event) => updateProteinIntake("tofu", event.target.value)} /><small>g</small></span></label><label className="full-width"><span>＋ Other</span><span className="input-unit"><input type="number" min="0" max="500" value={proteinIntake.otherProtein} placeholder="0" onChange={(event) => updateProteinIntake("otherProtein", event.target.value)} /><small>g protein</small></span></label>
      </div><button className="reset-intake" type="button" onClick={() => setProteinIntake(defaultProteinIntake)}>Reset today&apos;s intake</button>{proteinTarget === null ? <button className="protein-setup" type="button" onClick={() => setTab("profile")}>Add your weight and goal to see a target →</button> : <div className="live-protein-plan"><div className="protein-summary"><article><span>Target</span><strong>{proteinTarget} g</strong></article><article><span>Logged</span><strong>{totalProteinEaten} g</strong></article><article><span>Left</span><strong>{remainingProtein} g</strong></article></div><div className="progress-meta"><span>Daily protein progress</span><strong>{proteinProgressPercent}%</strong></div><progress className="protein-progress" max={proteinTarget} value={Math.min(proteinTarget, totalProteinEaten)} /></div>}</section><button className="calculate-button" onClick={calculatePlan}>View today&apos;s plan</button></>}

    {tab === "plan" && (results ? <section className="results" aria-live="polite"><div className="results-heading"><div><p className="eyebrow">TODAY&apos;S PLAN</p><h2>{profile.name ? `${profile.name}'s fuel` : "Your daily fuel"}</h2></div><strong>{results.calories} kcal</strong></div><div className="macro-grid"><article><span>Protein</span><strong>{results.protein} g</strong></article><article><span>Carbs</span><strong>{results.carbs} g</strong></article><article><span>Fat</span><strong>{results.fat} g</strong></article></div>
      <div className="estimate-protein"><div className="estimate-protein-heading"><div><p className="eyebrow">PROTEIN PORTIONS</p><h3>{remainingProtein === 0 ? "Target covered" : `${remainingProtein} g remaining`}</h3></div><span>{totalProteinEaten}/{results.protein} g</span></div>{remainingProtein > 0 ? <><p className="estimate-help">Swipe and choose one option, or mix smaller portions.</p><div className="visual-portions"><article><span>🥤</span><small>Whey</small><strong>{remainingProtein <= 12 ? "½" : "1"} serving</strong><em>~{Math.min(25, remainingProtein)} g protein</em></article><article><span>🍗</span><small>Chicken</small><strong>~{Math.ceil(remainingProtein / proteinPer100.chicken * 10) * 10} g</strong><em>cooked</em></article><article><span>🥩</span><small>Pork</small><strong>~{Math.ceil(remainingProtein / proteinPer100.pork * 10) * 10} g</strong><em>cooked</em></article><article><span>🥩</span><small>Beef</small><strong>~{Math.ceil(remainingProtein / proteinPer100.beef * 10) * 10} g</strong><em>cooked</em></article><article><span>🐟</span><small>Fish</small><strong>~{Math.ceil(remainingProtein / proteinPer100.fish * 10) * 10} g</strong><em>cooked</em></article><article><span>◻️</span><small>Tofu</small><strong>~{Math.ceil(remainingProtein / proteinPer100.tofu * 10) * 10} g</strong><em>firm tofu</em></article></div></> : <p className="target-covered">Your logged protein meets today&apos;s target.</p>}</div>
      <div className="estimate-carbs"><div className="estimate-protein-heading"><div><p className="eyebrow">CARB PORTIONS</p><h3>~{Math.round(results.carbs / 3)} g per main meal</h3></div><span>{results.carbs} g/day</span></div><p className="estimate-help">Swipe and choose one guide per meal.</p><div className="visual-portions carb-portions"><article><span>🍚</span><small>Cooked rice</small><strong>~{Math.ceil((results.carbs / 3) / carbsPer100.rice * 10) * 10} g</strong></article><article><span>🍜</span><small>Noodles</small><strong>~{Math.ceil((results.carbs / 3) / carbsPer100.noodles * 10) * 10} g</strong></article><article><span>🥔</span><small>Potato</small><strong>~{Math.ceil((results.carbs / 3) / carbsPer100.potato * 10) * 10} g</strong></article><article><span>🥣</span><small>Dry oats</small><strong>~{Math.ceil((results.carbs / 3) / carbsPer100.oats * 5) * 5} g</strong></article><article><span>🍌</span><small>Banana</small><strong>~{Math.max(1, Math.round((results.carbs / 3) / 23 * 2) / 2)}</strong><em>medium</em></article></div></div>
      <div className="supplement-plan concise-plan"><div className="section-heading compact"><span>✓</span><div><h2>Supplements</h2><p>Only what matters today.</p></div></div>{advice.length === 0 ? <div className="empty-state">Select products in Profile.</div> : <><div className="advice-list">{visibleAdvice.map((item) => <article className={`advice-card ${item.status}`} key={item.id}><div className="advice-title"><h3>{item.name}</h3><span className="status">{statusLabels[item.status]}</span></div><b className="advice-amount">{item.amount}</b><details><summary>Why?</summary><p>{item.reason}</p></details></article>)}</div>{advice.length > visibleAdvice.length && <button className="show-all" onClick={() => setShowAllAdvice(true)}>Show {advice.length - visibleAdvice.length} routine or skipped items</button>}{showAllAdvice && <button className="show-all" onClick={() => setShowAllAdvice(false)}>Show less</button>}</>}<details className="safety-note"><summary>Supplement safety</summary><p>Check with a clinician or pharmacist if pregnant, managing a condition, taking medication, or unsure about combined ingredients.</p></details></div>
    </section> : <section className="panel empty-plan"><span>🐻</span><h2>No plan yet</h2><p>Add today&apos;s workout and calculate your plan.</p><button className="continue-button" onClick={() => setTab("today")}>Set today&apos;s workout</button></section>)}

    {tab === "profile" && <><section className="panel"><div className="section-heading"><span>👤</span><div><h2>Your profile</h2><p>Saved privately in this browser.</p></div></div><div className="form-grid"><label>Name<input value={profile.name} placeholder="Your name" onChange={(event) => updateProfile("name", event.target.value)} /></label><label>Age<input type="number" value={profile.age} placeholder="e.g. 30" min="18" max="100" onChange={(event) => numericProfile("age", event.target.value)} /></label><label>Sex<select value={profile.sex} onChange={(event) => updateProfile("sex", event.target.value as Profile["sex"])}><option value="female">Female</option><option value="male">Male</option></select></label><label>Height in cm<input type="number" value={profile.heightCm} placeholder="e.g. 165" min="120" max="230" onChange={(event) => numericProfile("heightCm", event.target.value)} /></label><label>Weight in kg<input type="number" value={profile.weightKg} placeholder="e.g. 50" min="35" max="250" step=".1" onChange={(event) => numericProfile("weightKg", event.target.value)} /></label><label>Goal<select value={profile.goal} onChange={(event) => updateProfile("goal", event.target.value as Goal)}><option value="fat-loss">Lose fat</option><option value="recomposition">Lose fat and build muscle</option><option value="maintain">Maintain</option><option value="muscle-gain">Build muscle</option></select></label></div></section>
      <details className="panel inventory-disclosure"><summary><span><strong>My supplements</strong><small>{selected.length} selected</small></span><b>Manage</b></summary><div className="inventory-body"><div className="inventory-toolbar"><p>Select what you own.</p><button className="manage-button" onClick={() => { setManageInventory((value) => !value); resetForm(); }}>{manageInventory ? "Done" : "+ Add / edit"}</button></div><div className="supplement-list">{inventory.map((item) => <div className={`supplement-option ${selected.includes(item.id) ? "selected" : ""}`} key={item.id}><label className="supplement-choice"><input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggleSupplement(item.id)} /><span className="checkmark">{selected.includes(item.id) ? "✓" : ""}</span><span><strong>{item.name}</strong><small>{item.detail}</small></span></label>{manageInventory && <span className="inventory-actions">{item.custom && <button onClick={() => { setEditingId(item.id); setName(item.name); setDetail(item.detail); }}>Edit</button>}<button className="remove-supplement" onClick={() => removeSupplement(item)}>Remove</button></span>}</div>)}</div>{manageInventory && <><form className="add-supplement" onSubmit={saveSupplement}><h3>{editingId ? "Edit supplement" : "Add a supplement"}</h3><label>Name<input value={name} maxLength={80} placeholder="e.g. Collagen peptides" onChange={(event) => setName(event.target.value)} /></label><label>Serving or ingredients<input value={detail} maxLength={120} placeholder="Optional" onChange={(event) => setDetail(event.target.value)} /></label><div className="form-actions"><button className="save-supplement" disabled={!name.trim()}>{editingId ? "Save" : "Add"}</button>{editingId && <button className="cancel-edit" type="button" onClick={resetForm}>Cancel</button>}</div></form>{defaultSupplements.some((item) => !inventory.some((entry) => entry.id === item.id)) && <button className="restore-button" onClick={restoreDefaults}>Restore defaults</button>}</>}</div></details><button className="continue-button" onClick={() => setTab("today")}>Continue to Today</button></>}

    <nav className="bottom-tabs" aria-label="Daily Fuel sections"><button className={tab === "today" ? "active" : ""} onClick={() => setTab("today")}><span>🐻</span>Today</button><button className={tab === "intake" ? "active" : ""} onClick={() => setTab("intake")}><span>🥤</span>Intake</button><button className={tab === "plan" ? "active" : ""} onClick={() => setTab("plan")}><span>✨</span>Plan</button><button className={tab === "profile" ? "active" : ""} onClick={() => setTab("profile")}><span>⚙️</span>Profile</button></nav>
    <div className="privacy"><p>Your information stays in this browser. General estimates only—not medical or dietetic advice.</p><button className="clear-button" onClick={clearAll}>Clear my saved data</button></div>{notice && <div className="toast" role="status"><span>{notice}</span>{removed && notice === "Removed from inventory" && <button onClick={undoRemove}>Undo</button>}</div>}
  </section></main>;
}

export default App;
