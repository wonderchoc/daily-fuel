import { useEffect, useState } from "react";
import "./App.css";

type Goal = "fat-loss" | "recomposition" | "maintain" | "muscle-gain";
type Workout =
  | "rest"
  | "yoga"
  | "strength"
  | "cardio"
  | "easy-run"
  | "long-run"
  | "double-session";

interface Profile {
  name: string;
  age: number | "";
  sex: "female" | "male";
  heightCm: number | "";
  weightKg: number | "";
  goal: Goal;
  workout: Workout;
}

const STORAGE_KEY = "dailyFuelProfileV2";

const defaultProfile: Profile = {
  name: "",
  age: "",
  sex: "female",
  heightCm: "",
  weightKg: "",
  goal: "recomposition",
  workout: "strength",
};

function App() {
  const [profile, setProfile] = useState<Profile>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : defaultProfile;
  });

  const [results, setResults] = useState<{
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  } | null>(null);

  useEffect(() => {
localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  }, [profile]);

  function updateProfile<K extends keyof Profile>(
    field: K,
    value: Profile[K]
  ) {
    setProfile((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function calculatePlan() {
    const { age, sex, heightCm, weightKg, goal, workout } = profile;
    if (age === "" || heightCm === "" || weightKg === "") {
  alert("Please enter your age, height and weight.");
  return;
}
    if (
      age < 18 ||
      age > 100 ||
      heightCm < 120 ||
      heightCm > 230 ||
      weightKg < 35 ||
      weightKg > 250
    ) {
      alert("Please check your age, height and weight.");
      return;
    }

    const sexAdjustment = sex === "male" ? 5 : -161;

    const bmr =
      10 * weightKg +
      6.25 * heightCm -
      5 * age +
      sexAdjustment;

    const baseCalories = bmr * 1.4;

    const goalMultiplier: Record<Goal, number> = {
      "fat-loss": 0.88,
      recomposition: 0.95,
      maintain: 1,
      "muscle-gain": 1.08,
    };

    const workoutCalories: Record<Workout, number> = {
      rest: 0,
      yoga: 80,
      strength: 180,
      cardio: 220,
      "easy-run": 200,
      "long-run": 400,
      "double-session": 500,
    };

    const proteinPerKg: Record<Goal, number> = {
      "fat-loss": 2,
      recomposition: 1.9,
      maintain: 1.6,
      "muscle-gain": 1.8,
    };

    const calorieTarget =
      baseCalories * goalMultiplier[goal] +
      workoutCalories[workout];

    const protein = Math.round(weightKg * proteinPerKg[goal]);
    const fat = Math.round(weightKg * 0.8);

    const remainingCalories =
      calorieTarget - protein * 4 - fat * 9;

    const carbs = Math.max(0, Math.round(remainingCalories / 4));

    setResults({
      calories: Math.round(calorieTarget),
      protein,
      carbs,
      fat,
    });
  }

  function clearProfile() {
    localStorage.removeItem(STORAGE_KEY);
    setProfile(defaultProfile);
    setResults(null);
  }

  return (
    <main className="page">
      <section className="calculator">
        <header>
          <p className="eyebrow">DAILY TRAINING NUTRITION</p>
          <h1>Daily Fuel</h1>
          <p className="intro">
            Calculate an estimated nutrition target based on your body,
            goal and today&apos;s workout.
          </p>
        </header>

        <div className="form-grid">
          <label>
            Name
            <input
              type="text"
              value={profile.name}
              placeholder="Your name"
              onChange={(event) =>
                updateProfile("name", event.target.value)
              }
            />
          </label>

          <label>
            Age
            <input
              type="number"
              value={profile.age}
                placeholder="e.g. 44"
                min="18"
                max="100"
                inputMode="numeric"
                onChange={(event) =>
                  updateProfile(
                "age",
                event.target.value === "" ? "" : Number(event.target.value)
                )
              }
            />
          </label>

          <label>
            Sex
            <select
              value={profile.sex}
              onChange={(event) =>
                updateProfile(
                  "sex",
                  event.target.value as Profile["sex"]
                )
              }
            >
              <option value="female">Female</option>
              <option value="male">Male</option>
            </select>
          </label>

          <label>
            Height in cm
            <input
  type="number"
  value={profile.heightCm}
  placeholder="e.g. 163"
  min="120"
  max="230"
  inputMode="decimal"
  onChange={(event) =>
    updateProfile(
      "heightCm",
      event.target.value === "" ? "" : Number(event.target.value)
    )
  }
/>
          </label>

          <label>
            Weight in kg
            <input
  type="number"
  value={profile.weightKg}
  placeholder="e.g. 55"
  min="35"
  max="250"
  step="0.1"
  inputMode="decimal"
  onChange={(event) =>
    updateProfile(
      "weightKg",
      event.target.value === "" ? "" : Number(event.target.value)
    )
  }
/>
          </label>

          <label>
            Goal
            <select
              value={profile.goal}
              onChange={(event) =>
                updateProfile(
                  "goal",
                  event.target.value as Goal
                )
              }
            >
              <option value="fat-loss">Lose fat</option>
              <option value="recomposition">
                Lose fat and build muscle
              </option>
              <option value="maintain">Maintain</option>
              <option value="muscle-gain">Build muscle</option>
            </select>
          </label>

          <label className="full-width">
            Today&apos;s workout
            <select
              value={profile.workout}
              onChange={(event) =>
                updateProfile(
                  "workout",
                  event.target.value as Workout
                )
              }
            >
              <option value="rest">Rest day</option>
              <option value="yoga">Yoga or Pilates</option>
              <option value="strength">Strength or BFT strength</option>
              <option value="cardio">BFT cardio or mixed training</option>
              <option value="easy-run">Easy run</option>
              <option value="long-run">Long or hard run</option>
              <option value="double-session">Double session</option>
            </select>
          </label>
        </div>

        <button className="calculate-button" onClick={calculatePlan}>
          Calculate today&apos;s plan
        </button>

        {results && (
          <section className="results">
            <div className="results-heading">
              <div>
                <p className="eyebrow">TODAY&apos;S ESTIMATE</p>
                <h2>
                  {profile.name
                    ? `${profile.name}'s plan`
                    : "Your daily plan"}
                </h2>
              </div>

              <strong>{results.calories} kcal</strong>
            </div>

            <div className="macro-grid">
              <article>
                <span>Protein</span>
                <strong>{results.protein} g</strong>
              </article>

              <article>
                <span>Carbohydrates</span>
                <strong>{results.carbs} g</strong>
              </article>

              <article>
                <span>Fat</span>
                <strong>{results.fat} g</strong>
              </article>
            </div>

            <div className="guidance">
              <h3>Today&apos;s guidance</h3>
              <ul>
                <li>
                  Divide protein across three to five meals.
                </li>
                <li>
                  Use protein powder only if food does not meet your
                  protein target.
                </li>
                <li>
                  Consider additional fluids and electrolytes for long,
                  outdoor or high-sweat sessions.
                </li>
                <li>
                  Supplements cannot replace adequate food, sleep and
                  resistance training.
                </li>
              </ul>
            </div>
          </section>
        )}

        <div className="privacy">
          <p>
            Your profile is stored only in this browser. These are general
            estimates, not medical or dietetic advice.
          </p>

          <button className="clear-button" onClick={clearProfile}>
            Clear my saved data
          </button>
        </div>
      </section>
    </main>
  );
}

export default App;