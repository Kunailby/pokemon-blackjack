DESIGN SYSTEM — POKÉMON BLACKJACK (STRIPE CORE)

---

1. Design Philosophy

This system merges two forces:

- Stripe-level precision and polish
- Premium collectible card game intensity

The result is a luxury tactical arcade interface:

- clean, controlled, engineered
- but capable of dramatic, high-impact game moments

This is not:

- a casino UI
- a cartoon UI
- a cluttered TCG simulator

This is:

«A high-end digital card experience where clarity, rarity, and tension coexist.»

---

2. Core Identity

Pillars

- Precision over chaos
- Light typography, heavy meaning
- Controlled color, explosive moments
- Readable at all times
- Rarity = emotional payoff

---

3. Color System

Core Stripe Foundation

- Primary Purple "#533afd"
- Deep Navy "#061b31"
- White "#ffffff"
- Body Text "#64748d"
- Border "#e5edf5"

---

Game Surface Layer

- Table Background "#0b1220"
- Panel Background "#101a2d"
- Elevated Surface "#162338"
- Glass Overlay "rgba(255,255,255,0.06)"
- Dark Border "rgba(255,255,255,0.10)"

---

Feedback Colors

- Damage "#e5484d"
- Heal "#15be53"
- Energy / FX "#3ac7ff"
- Gold (Reward) "#f5c451"
- Boss Aura "#7a5cff"

---

Type Accents (Controlled Usage)

Use ONLY for highlights, never full UI themes.

- Fire "#ff6b4a"
- Water "#3a86ff"
- Grass "#39b56a"
- Electric "#f7c948"
- Psychic "#d16eff"
- Dark "#5c6b8a"

---

4. Typography

Fonts

- Primary: "sohne-var"
- Mono: "SourceCodePro"

Rules

- ""ss01"" always enabled
- ""tnum"" for numbers (HP, damage, bets)

---

Hierarchy

Role| Size| Weight
Hero| 48–56px| 300
Section| 26–32px| 300
Body| 16–18px| 300
Buttons| 14–16px| 400
HP Display| 20–28px| 400
Damage Text| 18–22px| 400

---

Key Principle

«Light typography for structure — stronger weight for gameplay clarity.»

---

5. Layout System

Structure Priority (Gameplay Screen)

1. Combat state (HP / outcome)
2. Cards in play
3. Player hand
4. Actions
5. Meta (bet, gold, streak)

---

Spacing

- Base: 8px
- Tight but deliberate
- Never excessive emptiness

---

Surfaces

- Menus: white / light
- Gameplay: dark layered navy
- Cards: elevated floating surfaces

---

6. Depth & Shadows

Signature Shadow (always preferred)

rgba(50,50,93,0.25) 0px 30px 45px -30px,
rgba(0,0,0,0.1) 0px 18px 36px -18px

Philosophy

- Shadows are blue-tinted
- Depth feels atmospheric, not flat
- Gameplay elements must feel physically layered

---

7. Core Components

Buttons

Primary

- Purple background
- White text
- 4px radius

Secondary

- Outline purple
- Transparent fill

Danger

- Red variant (damage, surrender)

Reward

- Gold variant (capture, loot ONLY)

---

Cards (Core Element)

Cards are the heart of the game.

Structure

- Artwork
- Name
- HP
- Type
- Rarity
- Tag (EX / V / Boss)

---

Card Rules

- Clean frame
- No excessive textures
- Rarity = controlled visual upgrade
- Always readable first

---

Rarity System

Normal

- Flat, minimal

Rare

- Slight glow
- Gold/purple accent

EX / V / Boss

- Stronger border
- Aura or glow
- Immediate visual hierarchy

---

8. Gameplay UI

Main Table

Layout:

- Top: Enemy / Boss
- Center: Combat result
- Bottom: Player hand
- Side: HP / Bet / Info

---

Boss Zone

- Darker
- Centered
- More dramatic
- Strong presence

---

HP System

Rules:

- ALWAYS show number + bar
- Smooth fill
- Clear thresholds

States:

- Green → Yellow → Red

---

Combat Feedback

Must be:

- Immediate
- Visible
- Unmissable

Includes:

- Damage numbers
- Type highlight borders
- Messages:
  - Super effective
  - Not very effective

---

Bust State

- Instant visual reaction
- Red flash or shake
- Clear penalty

---

9. Motion System

Philosophy

- Fast
- Sharp
- Satisfying
- Never floaty

---

Timing

- Hover: 120–180ms
- Select: 160–220ms
- Damage: 120–200ms
- Reward: 250–450ms

---

Effects

- Card lift
- Glow pulse
- Damage burst
- Reward flash

---

10. Screens

Gameplay

- Tactical clarity first
- Minimal noise

---

Collection / Dex

- Grid layout
- Clear ownership states
- Missing slots preserved

---

Shop

- Clean
- Premium
- Curated feel

---

Boss Modal

- Larger than normal
- Dramatic
- Risk/reward clear

---

11. Interaction Rules

States

- Hover → subtle lift
- Selected → strong border
- Disabled → muted but readable

---

Chips

Used for:

- Boss
- EX / V / VMAX
- Captured
- New

Must remain:

- small
- clean
- readable

---

12. Game Feel Layer

This game should feel like:

- A premium digital card table
- A strategic combat interface
- A collectible system with real weight

---

NOT:

- A mobile gacha mess
- A casino UI
- A noisy anime interface

---

13. Do / Don’t

Do

- Keep Stripe precision
- Use dark gameplay surfaces
- Emphasize readability
- Reward rarity visually
- Keep interactions sharp

---

Don’t

- Overuse glow
- Break typography rules
- Use big rounded shapes
- Replace purple as primary
- Add random gradients everywhere

---

14. Agent Instructions

When generating UI:

- Follow this file as the single source of truth
- Preserve Stripe DNA:
  - typography
  - spacing
  - shadows
- Adapt for:
  - card readability
  - HP clarity
  - boss intensity
- Make UI:
  - premium
  - readable
  - game-ready

---

Example Prompt

Build the main Pokémon Blackjack screen using this design system:

- dark premium table
- strong HP visibility
- boss zone at top
- player cards at bottom
- clear action buttons (Hit / Stand)
- collectible card feel
- dramatic but controlled visuals
- Stripe-level polish, game-level intensity

---
