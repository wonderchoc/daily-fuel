import { useEffect, useMemo, useState } from "react";
import "./App.css";

type Goal = "fat-loss" | "recomposition" | "maintain" | "muscle-gain";
type Workout = "rest" | "yoga" | "strength" | "cardio" | "easy-run" | "long-run" | "double-session";
type SupplementStatus = "recommended" | "optional" | "check";

interface Profile {
  name: string;
  age: number | "";
  sex: "female" | "male";
  heightCm: number | "";
  weightKg: number | "";
  goal: Goal;
  workout: Workout;
}

interface Supplement {
  id: string;
  name: string;
  detail: string;
}

interface SupplementAdvice extends Supplement {
  status: SupplementStatus;
  reason: string;
}

const PROFILE_KEY = "dailyFuelProfileV2";
const SUPPLEMENT_KEY = "dailyFuelSupplementsV2";

const supplements: Supplement[] = [
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

const defaultProfile: Profile = {
  name: "", age: "", sex: "female", heightCm: "", weightKg: "",
  goal: "recomposition", workout: "strength",
};

function safelyLoad<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) as T : fallback;
  } catch {
    return fallback;
  }
}

function getSupplementAdvice(item: Supplement, workout: Workout): SupplementAdvice {
  const hardTraining = ["strength", "cardio", "long-run", "double-session"].includes(workout);
  const endurance = ["cardio", "long-run", "double-session"].includes(workout);

  switch (item.id) {
    case "whey":
      return { ...item, status: hardTraining ? "recommended" : "optional", reason: hardTraining ? "Useful after training if food will not cover your protein target." : "Use only to close a protein gap; whole foods can cover the target." };
    case "creatine":
      return { ...item, status: "recommended", reason: "Take your usual daily serving. Consistency matters more than workout timing." };
    case "electrolytes":
      return { ...item, status: endurance ? "recommended" : "optional", reason: endurance ? "Useful for longer, hotter or high-sweat training. Follow the product label." : "Usually optional for a short indoor session; water may be enough." };
    case "omega3":
      return { ...item, status: "optional", reason: "A routine nutrition choice, not a workout-specific boost. Take with food if it is part of your usual plan." };
    case "d3k2":
      return { ...item, status: "optional", reason: "Continue only as directed for your usual routine; it is not adjusted by today’s workout." };
    case "calmag":
      return { ...item, status: "optional", reason: "Not workout-specific. Use only within the label directions and your nutrition plan." };
    case "sleep":
      return { ...item, status: hardTraining ? "optional" : "optional", reason: "Optional at night if you already tolerate it. Check the full label and avoid combining with alcohol or sedating products." };
    case "iron":
      return { ...item, status: "check", reason: "Do not take iron because of a workout. Use only when a clinician has confirmed a need and advised the dose." };
    case "vitaminc":
      return { ...item, status: "optional", reason: "Not required for workout recovery. Stay within the label directions and avoid stacking other vitamin C products." };
    default:
      return { ...item, status: "optional", reason: "Follow the product label." };
  }
}

function App() {
  const [profile, setProfile] = useState<Profile>(() => safelyLoad(PROFILE_KEY, defaultProfile));
  const [selected, setSelected] = useState<string[]>(() => safelyLoad(SUPPLEMENT_KEY, []));
  const [results, setResults] = useState<{ calories: number; protein: number; carbs: number; fat: number } | null>(null);

  useEffect(() => localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)), [profile]);
  useEffect(() => localStorage.setItem(SUPPLEMENT_KEY, JSON.stringify(selected)), [selected]);

  const advice = useMemo(
    () => supplements.filter((item) => selected.includes(item.id)).map((item) => getSupplementAdvice(item, profile.workout)),
    [selected, profile.workout],
  );

  function updateProfile<K extends keyof Profile>(field: K, value: Profile[K]) {
    setProfile((current) => ({ ...current, [field]: value }));
  }

  function toggleSupplement(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function calculatePlan() {
    const { age, sex, heightCm, weightKg, goal, workout } = profile;
    if (age === "" || heightCm === "" || weightKg === "") {
      alert("Please enter your age, height and weight.");
      return;
    }
    if (age < 18 || age > 100 || heightCm < 120 || heightCm > 230 || weightKg < 35 || weightKg > 250) {
      alert("Please check your age, height and weight.");
      return;
    }
    const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === "male" ? 5 : -161);
    const goalMultiplier: Record<Goal, number> = { "fat-loss": 0.88, recomposition: 0.95, maintain: 1, "muscle-gain": 1.08 };
    const workoutCalories: Record<Workout, number> = { rest: 0, yoga: 80, strength: 180, cardio: 220, "easy-run": 200, "long-run": 400, "double-session": 500 };
    const proteinPerKg: Record<Goal, number> = { "fat-loss": 2, recomposition: 1.9, maintain: 1.6, "muscle-gain": 1.8 };
    const calorieTarget = bmr * 1.4 * goalMultiplier[goal] + workoutCalories[workout];
    const protein = Math.round(weightKg * proteinPerKg[goal]);
    const fat = Math.round(weightKg * 0.8);
    const carbs = Math.max(0, Math.round((calorieTarget - protein * 4 - fat * 9) / 4));
    setResults({ calories: Math.round(calorieTarget), protein, carbs, fat });
  }

  function clearProfile() {
    localStorage.removeItem(PROFILE_KEY);
    localStorage.removeItem(SUPPLEMENT_KEY);
    setProfile(defaultProfile);
    setSelected([]);
    setResults(null);
  }

  const numericChange = (field: "age" | "heightCm" | "weightKg", value: string) => updateProfile(field, value === "" ? "" : Number(value));

  return (
    <main className="page">
      <section className="calculator">
        <header>
          <p className="eyebrow">DAILY TRAINING NUTRITION</p>
          <h1>Daily Fuel</h1>
          <p className="intro">Calculate an estimated nutrition target and see which supplements from your own inventory fit today.</p>
        </header>

        <section className="panel">
          <div className="section-heading"><span>01</span><div><h2>Your profile</h2><p>Saved only on this device.</p></div></div>
          <div className="form-grid">
            <label>Name<input type="text" value={profile.name} placeholder="Your name" onChange={(event) => updateProfile("name", event.target.value)} /></label>
            <label>Age<input type="number" value={profile.age} placeholder="e.g. 44" min="18" max="100" inputMode="numeric" onChange={(event) => numericChange("age", event.target.value)} /></label>
            <label>Sex<select value={profile.sex} onChange={(event) => updateProfile("sex", event.target.value as Profile["sex"])}><option value="female">Female</option><option value="male">Male</option></select></label>
            <label>Height in cm<input type="number" value={profile.heightCm} placeholder="e.g. 163" min="120" max="230" inputMode="decimal" onChange={(event) => numericChange("heightCm", event.target.value)} /></label>
            <label>Weight in kg<input type="number" value={profile.weightKg} placeholder="e.g. 55" min="35" max="250" step="0.1" inputMode="decimal" onChange={(event) => numericChange("weightKg", event.target.value)} /></label>
            <label>Goal<select value={profile.goal} onChange={(event) => updateProfile("goal", event.target.value as Goal)}><option value="fat-loss">Lose fat</option><option value="recomposition">Lose fat and build muscle</option><option value="maintain">Maintain</option><option value="muscle-gain">Build muscle</option></select></label>
            <label className="full-width">Today&apos;s workout<select value={profile.workout} onChange={(event) => updateProfile("workout", event.target.value as Workout)}><option value="rest">Rest day</option><option value="yoga">Yoga or Pilates</option><option value="strength">Strength or BFT strength</option><option value="cardio">BFT cardio or mixed training</option><option value="easy-run">Easy run</option><option value="long-run">Long or hard run</option><option value="double-session">Double session</option></select></label>
          </div>
        </section>

        <section className="panel supplement-panel">
          <div className="section-heading"><span>02</span><div><h2>Your supplements</h2><p>Select only products you currently have.</p></div></div>
          <div className="supplement-list">
            {supplements.map((item) => (
              <label className={`supplement-option ${selected.includes(item.id) ? "selected" : ""}`} key={item.id}>
                <input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggleSupplement(item.id)} />
                <span className="checkmark" aria-hidden="true">{selected.includes(item.id) ? "✓" : ""}</span>
                <span><strong>{item.name}</strong><small>{item.detail}</small></span>
              </label>
            ))}
          </div>
          <p className="selection-count">{selected.length} of {supplements.length} selected</p>
        </section>

        <button className="calculate-button" onClick={calculatePlan}>Calculate today&apos;s plan</button>

        {results && (
          <section className="results" aria-live="polite">
            <div className="results-heading"><div><p className="eyebrow">TODAY&apos;S ESTIMATE</p><h2>{profile.name ? `${profile.name}'s plan` : "Your daily plan"}</h2></div><strong>{results.calories} kcal</strong></div>
            <div className="macro-grid"><article><span>Protein</span><strong>{results.protein} g</strong></article><article><span>Carbohydrates</span><strong>{results.carbs} g</strong></article><article><span>Fat</span><strong>{results.fat} g</strong></article></div>
            <div className="supplement-plan">
              <div className="section-heading compact"><span>03</span><div><h2>Supplement plan</h2><p>Based on today&apos;s workout and your selected inventory.</p></div></div>
              {advice.length === 0 ? <p className="empty-state">No supplements selected. Food, fluids, sleep and training remain the foundation.</p> : (
                <div className="advice-list">{advice.map((item) => <article className={`advice-card ${item.status}`} key={item.id}><div><span className="status">{item.status === "recommended" ? "Recommended today" : item.status === "check" ? "Check first" : "Routine / optional"}</span><h3>{item.name}</h3></div><p>{item.reason}</p></article>)}</div>
              )}
              <div className="safety-note"><strong>Safety check</strong><p>Supplements can interact with medicines or health conditions. Check with a clinician or pharmacist if you are pregnant, managing a condition, taking regular medication, or unsure about combined ingredients. Vitamin K can interact with warfarin.</p></div>
            </div>
          </section>
        )}

        <div className="privacy"><p>General estimates only—not medical or dietetic advice. Always follow each product label.</p><button className="clear-button" onClick={clearProfile}>Clear my saved data</button></div>
      </section>
    </main>
  );
}

export default App;
