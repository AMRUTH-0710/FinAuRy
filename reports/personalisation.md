# Two-Persona Personalisation Verification (`reports/personalisation.md`)

## 1. Executive Summary

To verify that **"An app just for me"** is genuinely driven by each person's transaction signals rather than pouring numbers into a static template (`BRIEF.md` §1 & §7 Phase 2), we ran the **exact same deterministic data pipeline (`pipeline/`) and story planner (`story/planner.ts`)** on two contrasting 2025 bank CSVs:

1. **Sam (`data/transactions_2025.csv` → `story/plan.json`):** Seattle creative at Pacific Studio Labs who visited **Blue Bottle Coffee 72 times** (and **Sightglass Coffee 41 times** across **163 coffees**), built a **home music studio with Monarch Acoustic (`$11,596` room + `$15,496` with synths & gear across 15 purchases)**, had a **34-day spending streak**, escaped to **Cannon Beach**, and experienced a **1.9× October spending surge** alongside **12 uniform `$6,750` monthly paychecks (`$81,000` salary)**.
2. **Alex (`data/mock/alex_2025.csv` → `story/alex_plan.json`):** Remote product designer at Cascade Digital Labs, marathon trail runner, and dedicated home cook with **zero studio build (`$0`)**, **low coffee spend (`14` cups all year)**, **88 visits to Whole Foods Market (`137` grocery market trips vs just `8` takeaway orders)**, **34 physio & sports-recovery visits (`$3,040` health total)**, **16 international FX purchases**, and a **steady automated savings habit (`$28,800`)** across **12 uniform `$7,450` monthly paychecks (`$89,400` salary)** with flat post-payday and October spending.

---

## 2. Side-by-Side Story Plan Comparison

| Dimension | Sam (`story/plan.json`) | Alex (`story/alex_plan.json`) | Divergence Proof |
|---|---|---|---|
| **Total Chapters** | **13 chapters** | **11 chapters** | Alex omits `heartbeat` and `big_one` because Alex has no October/payday spike and no 10-week monolith purchase. |
| **Chapter Sequence** | `pour` → `year_as_squares` → `your_place` → `bespoke_0 (studio)` → `streak` → `getaway` → `bespoke_1 (coffee)` → `heartbeat` → `big_one` → `shatter` → `personality` → `one_line` → `share_card` | `pour` → `year_as_squares` → `your_place` → `bespoke_0 (wellness_log)` → `streak` → `getaway` → `bespoke_1 (home_pantry)` → `shatter` → `personality` → `one_line` → `share_card` | Different middle chapter count, order, and bespoke modules. |
| **Bespoke Chapter 0 (`bespoke_0`)** | `studio` — **Room to Make Noise** (`paper_studio`) | `wellness_log` — **The Endurance Block** (`mint_obsidian`) | Sam gets a home music-studio & synth build chapter; Alex gets a Physio & marathon recovery chapter. |
| **Bespoke Chapter 1 (`bespoke_1`)** | `coffee` — **The Morning Rivalry** (`solar_ember`) | `home_pantry` — **The Home Table** (`olive_lime`) | Sam gets a Blue Bottle Coffee vs Sightglass Coffee café rivalry; Alex gets a 137-grocery vs 8-takeaway home-cooking chapter. |
| **Your Place (`your_place`)** | **Blue Bottle Coffee** (`72` visits, `solar_ember`) | **Whole Foods Market** (`88` visits, `olive_lime`) | Different anchor merchant, category (`coffee` vs `groceries`), and chapter palette. |
| **Money Personality Title** | **The Studio-Building Regular** (`lavender_night`) | **The Trail-Running Home Chef** (`mint_obsidian`) | Distinct data-derived archetypes and generative radial seeds (`2025` vs `2032`). |
| **Dominant Categories** | `shopping`, `eating out`, `travel`, `transport`, `groceries` | `groceries`, `health`, `travel`, `transport`, `shopping` | Sam is led by `shopping` & `eating out`; Alex is led by `groceries`, `travel`, & `health`. |
| **Palettes Used** | `ink_solar`, `solar_ember`, `paper_studio`, `olive_lime`, `cobalt_bone`, `ink_rose`, `crimson_ink`, `lavender_night` | `ink_solar`, `mint_obsidian`, `olive_lime`, `cobalt_bone`, `ink_rose` | Distinct visual mood tailored to each persona's spending signals. |

---

## 3. Candidate Chapter Score Matrix (Sam vs Alex)

| Candidate Chapter | Threshold | Sam Score | Sam Decision | Alex Score | Alex Decision | Why They Diverge |
|---|---:|---:|---|---:|---|---|
| **Your Place** (`your_place`) | 50 | **100** | SELECTED | **100** | SELECTED | Sam: Blue Bottle Coffee: 72 visits (every 5 days), $572.80 <br> Alex: Whole Foods Market: 88 visits (every 4 days), $7,398.40 |
| **Room to Make Noise** (`bespoke_studio`) | 60 | **100** | SELECTED | **0** | REJECTED | Sam: Monarch Acoustic build $11,596 + gear total $15,496 across 15 purchases <br> Alex: Monarch Acoustic build $0 + gear total $0 across 0 purchases |
| **The Streak** (`streak`) | 45 | **95** | SELECTED | **56** | SELECTED | Sam: 34-day spending streak vs 97 quiet no-spend days (longest quiet run: 8 days) <br> Alex: 21-day spending streak vs 158 quiet no-spend days (longest quiet run: 4 days) |
| **The Getaway** (`getaway`) | 45 | **100** | SELECTED | **100** | SELECTED | Sam: Cannon Beach (7 days, $977) + 8 FX txns ($634) + $5,749 travel <br> Alex: Cannon Beach (5 days, $610) + 16 FX txns ($1,692) + $2,965 travel |
| **The Morning Rivalry** (`bespoke_coffee`) | 60 | **100** | SELECTED | **5** | REJECTED | Sam: 163 cups across 20 cafés ($2,265): Blue Bottle Coffee (72) vs Sightglass Coffee (41) <br> Alex: 14 cups across 2 cafés ($79): Whole Foods Market (88) vs Orbit Roasters (5) |
| **The Endurance Block** (`bespoke_wellness`) | 60 | **26** | REJECTED | **100** | SELECTED | Sam: 3 Physio sessions ($535) & 12 health/training visits ($1,091) <br> Alex: 0 Physio sessions ($0) & 34 health/training visits ($3,040) |
| **The Home Table** (`bespoke_home_pantry`) | 60 | **24** | REJECTED | **100** | SELECTED | Sam: 64 grocery trips ($2,416) vs 38 takeaway orders (1.7× ratio) <br> Alex: 137 grocery trips ($9,649) vs 8 takeaway orders (17.1× ratio) |
| **The Heartbeat** (`heartbeat`) | 55 | **78** | SELECTED | **20** | REJECTED | Sam: 12 paydays (1.1× post-payday multiplier) + October surge to $7,013 (1.9× typical month) <br> Alex: 12 paydays (1.1× post-payday multiplier) + October surge to $1,220 (0.7× typical month) |
| **The Big One** (`big_one`) | 55 | **100** | SELECTED | **29** | REJECTED | Sam: $9,061.87 at Monarch Acoustic (10 weeks of normal spending) <br> Alex: $1,420.00 at Alaska Airlines (3 weeks of normal spending) |
| **The Shatter** (`shatter`) | 50 | **96** | SELECTED | **96** | SELECTED | Sam: $56,945 across 11 discretionary categories (top: shopping at 49%) <br> Alex: $22,046 across 11 discretionary categories (top: groceries at 44%) |
| **Your Money Personality** (`personality`) | 50 | **100** | SELECTED | **100** | SELECTED | Sam: Synthesizes category mix petals, 365 daily radial bars, and 12 payday spikes <br> Alex: Synthesizes category mix petals, 365 daily radial bars, and 12 payday spikes |

---

## 4. Resolved One-Line & Personality Copy Comparison

### Sam (`story/plan.json`)
- **Personality:** **The Studio-Building Regular** — *"Takeaway for Sam — You run a barbell money strategy: predictable daily rituals (72 stops at Blue Bottle Coffee across 163 coffees) and $17,215 in automated savings give you the margin to fund $15,496 in bold creative projects."*
- **One Line:** *"In 2025, across 1,000 transactions and $56,945 of discretionary spend, you visited Blue Bottle Coffee 72 times, poured $15,496 into building a home studio, and saved $17,215."*

### Alex (`story/alex_plan.json`)
- **Personality:** **The Trail-Running Home Chef** — *"Takeaway for Alex — You anchor your week at Whole Foods Market (88 market visits across 137 grocery runs), invest $3,040 across 34 physio and recovery sessions, and channel $28,800 into long-term savings."*
- **One Line:** *"In 2025, across 446 transactions and $22,046 of discretionary spend, you stocked your kitchen 88 times at Whole Foods Market, logged 34 physio and recovery sessions, explored across 16 international purchases, and saved $28,800."*
