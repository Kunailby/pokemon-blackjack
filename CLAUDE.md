# CLAUDE.md — Pokemon Blackjack

A comprehensive guide for AI assistants working on this codebase.

---

## Project Overview

Pokemon Blackjack is a card game that combines Blackjack mechanics with Pokemon TCG card artwork. Instead of traditional card values, each card's **HP stat** acts as its value.

**Core Rules:**
- Target HP: **400** (equivalent to Blackjack's 21)
- Bust threshold: **> 400 HP**
- Dealer stands at: **301+ HP** (hits while HP ≤ 300)
- Win payout: **2x bet** (all wins, including blackjack — no 3:2 distinction)
- Push (tie): **Equal HP** → bet returned, no chip change
- Blackjack: **exactly 400 HP on the initial 2-card deal only** — cosmetic label only; dealer still plays out; no bonus payout; hitting to 400 is a regular win, not blackjack
- Simultaneous bust: player busts before dealer turn, so dealer bust during dealer-turn always means player wins

**Dealer deal:**
- Dealer receives **2 cards**: one face-up (index 0), one face-down / hole card (index 1)
- Only the face-up card HP is shown to the player during their turn (displayed as "X HP + ?")
- When the dealer's turn begins the hole card is revealed; all cards count toward the dealer's total
- If the dealer's starting 2-card total is already ≥ 301, they stand immediately without drawing

**Dex eligibility:**
- To capture Pokémon after a win, the bet must be **≥ 10% of the player's chips at Deal time** (before deduction)
- All new cards in the winning hand (not already in the Dex) are shown as capturable; player may tap each one individually
- Dex capture is only available on a **win** — pushes and losses never trigger it

**Hall of Fame:**
- Every winning hand is recorded automatically
- Global and personal leaderboards each show the top 10 wins, ranked by **bet size descending**
- Ties in bet size are ordered by insertion time (most recent first)
- Each entry records: player name, bet amount, date, and the Pokémon in the winning hand

**UI terminology:**
- The dealer is labeled **"Gym Leader"** in the UI
- Running out of chips shows **"Blacked Out!"** (Pokemon Center reference)
- The "New Round" / "Play again" button is labeled **"Rematch"**

> ⚠️ **Backend note:** `backend/src/services/GameLogic.ts` is **legacy code** and does not reflect current frontend rules. Specifically, the backend treats a dealer total of exactly 400 as a "dealer blackjack" that beats non-400 player hands — the frontend does not. Always use `frontend/src/App.tsx` as the authoritative rules reference.

**Current state:** The frontend is a fully client-side single-player React app. The backend (Express + MongoDB) contains an older multiplayer architecture that is not actively used by the frontend.

---

## Repository Structure

```
pokemon-blackjack/
├── backend/               # Express/Node.js server (largely unused by current frontend)
│   └── src/
│       ├── index.ts           # Server entry point (Express + Socket.io, port 5000)
│       ├── controllers/       # Route handlers
│       │   ├── authController.ts
│       │   ├── gameController.ts
│       │   ├── cardController.ts
│       │   └── playController.ts
│       ├── models/            # Mongoose schemas
│       │   ├── User.ts        # username, chips (default 1000), stats
│       │   ├── GameTable.ts   # inviteCode, players[], gameStatus, shoeId
│       │   ├── Card.ts        # name, hp, imageUrl, hpCategory
│       │   ├── Shoe.ts        # 208-card deck, cardsUsed counter
│       │   └── GameHistory.ts # Per-game result records
│       ├── routes/            # Express router definitions
│       ├── middleware/
│       │   └── auth.ts        # JWT Bearer token verification
│       └── services/
│           ├── GameLogic.ts   # Core blackjack rules (HP_GOAL=400, DEALER_STAND_HP=300)
│           ├── ShoeService.ts # Shoe creation, card drawing, invite code generation
│           └── CardScraper.ts # Web scraping + 8 hardcoded seed cards
│
├── frontend/              # React 18 + TypeScript SPA
│   └── src/
│       ├── App.tsx            # Main game component — all active game logic lives here
│       ├── index.tsx          # React entry point
│       ├── components/
│       │   ├── Card.tsx       # Reusable Pokemon card UI (shown/hidden states)
│       │   ├── Lobby.tsx      # Multiplayer lobby (built but NOT used)
│       │   └── GameBoard.tsx  # Multiplayer board (built but NOT used)
│       ├── services/
│       │   ├── api.ts         # Axios client pointing to Render backend
│       │   └── playService.ts # Play API calls with JWT from localStorage
│       └── types/
│           └── game.ts        # Shared TypeScript interfaces
│
├── .nvmrc                 # Node version: 20
└── CLAUDE.md              # This file
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript 4.9, React Router 6 |
| Backend | Node.js 20, Express 4.18, TypeScript 5 |
| Database | MongoDB via Mongoose 8 |
| Real-time | Socket.io 4.6 |
| Auth | JWT (jsonwebtoken), bcryptjs |
| HTTP client | Axios |
| Frontend deploy | Netlify (https://pkmbkj.netlify.app) |
| Backend deploy | Render (https://pokemon-blackjack-28yc.onrender.com) |

---

## Development Workflows

### Running the Frontend

```bash
cd frontend
npm install --legacy-peer-deps  # Required due to React version peer dep conflicts
npm start                        # Dev server on http://localhost:3000
npm run build                    # Production build (CI=false required)
```

> The frontend runs entirely standalone — it fetches cards directly from the public **Pokemon TCG API** (`https://api.pokemontcg.io/v2/cards`) with no backend required.

### Running the Backend

```bash
cd backend
npm run dev    # ts-node-dev with hot reload
npm run build  # Compile TypeScript → dist/
npm start      # Run compiled dist/index.js
```

Backend requires a running MongoDB instance. Configure via `.env`:

```
MONGODB_URI=mongodb://localhost:27017/pokemon-blackjack
JWT_SECRET=your-secret-key-change-this-in-production
NODE_ENV=development
PORT=5000
```

### Seeding Cards (Backend)

POST to `/api/cards/seed` while `NODE_ENV=development` to populate 8 sample cards (Charizard 120HP, Blastoise 100HP, Venusaur 80HP, Pikachu 40HP, etc.).

---

## Game Logic

### Frontend (Active — `frontend/src/App.tsx`)

The entire game loop runs client-side:

1. **Loading** — Fetch 250 unique Pokemon cards from TCG API; fall back to 15 hardcoded cards if the API fails
2. **Betting** — Player picks a chip amount ($10, $25, $50, $100)
3. **Playing** — Player receives 2 cards; dealer receives 2 cards (first face-up, second face-down). Player can **Hit** or **Stand**
4. **Dealer Turn** — Dealer auto-plays with 1-second delays per card until HP ≥ 301
5. **Game Over** — Compare totals, pay out chips, allow replay

Key helpers in `App.tsx`:
- `calculateTotal(cards)` — Sum HP values
- `shuffleArray(arr)` — Fisher-Yates shuffle
- Bust/blackjack checks inline in game state transitions

If a player's chips reach 0, they reset to 1000 for a new game.

### Backend (Legacy — `backend/src/services/GameLogic.ts`)

```typescript
HP_GOAL = 400           // Blackjack
DEALER_STAND_HP = 300   // Dealer stands at 301+

calculateTotalHP(cards)
isBlackjack(total)      // total === 400
isBust(total)           // total > 400
shouldDealerHit(total)  // total <= 300
determineOutcome(playerTotal, dealerTotal, playerBet)
categorizeCard(hp)      // 'low' | 'medium' | 'high'
```

---

## API Reference (Backend)

All routes prefixed with `/api`. Protected routes require `Authorization: Bearer <token>`.

### Auth
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/login` | No | Login or auto-create user by username |
| GET | `/auth/profile` | Yes | Get user stats (chips, wins, losses) |

### Games
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/games/create` | Yes | Create table with invite code and shoe |
| POST | `/games/join` | Yes | Join a waiting game |
| GET | `/games/available` | Yes | List up to 10 waiting games |
| GET | `/games/:tableId` | Yes | Get game state |
| POST | `/games/:tableId/start` | Yes | Start game (dealer only) |

### Play
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/play/:tableId/deal` | Yes | Deal 2 cards to all players and dealer |
| POST | `/play/:tableId/hit` | Yes | Player draws a card |
| POST | `/play/:tableId/stand` | Yes | Player stands; triggers dealer turn if all done |
| POST | `/play/:tableId/dealer-turn` | Yes | Dealer plays through, settle bets |
| GET | `/play/:tableId/state` | Yes | Get current game state |

### Cards (Dev)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/cards/list` | Yes | List 50 cards |
| GET | `/cards/stats` | No | HP category distribution |
| POST | `/cards/seed` | No | Seed 8 sample cards (dev only) |

### Health
| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Returns `{ status: 'ok' }` |

---

## Socket.io Events (Backend)

| Event | Direction | Payload |
|---|---|---|
| `join-game` | Client → Server | `{ tableId }` |
| `player-hit` | Client → Server | `{ tableId, playerId }` |
| `player-stand` | Client → Server | `{ tableId, playerId }` |
| `disconnect` | Client → Server | _(auto)_ |

The server broadcasts state changes to the game room after each action.

---

## Key Conventions

### TypeScript

- **Backend:** `tsconfig.json` targets ES2020, CommonJS modules, strict mode enabled
- **Frontend:** `tsconfig.json` targets ES5 with `"jsx": "react-jsx"`, strict mode enabled
- Types for game objects are defined in `frontend/src/types/game.ts`:
  - `Card`, `Player`, `Dealer`, `GameTable`, `GameResult`

### Naming

- Files: `camelCase.ts` / `PascalCase.tsx` for React components
- MongoDB models: PascalCase (`User`, `GameTable`)
- Services: PascalCase (`GameLogic`, `ShoeService`)
- API routes: kebab-case paths (`/dealer-turn`, `/invite-code`)

### CORS

The backend hardcodes CORS to `https://pkmbkj.netlify.app`. When developing locally, you may need to temporarily update `backend/src/index.ts`:

```typescript
app.use(cors({ origin: ['https://pkmbkj.netlify.app', 'http://localhost:3000'] }));
```

### npm Install

Always use `--legacy-peer-deps` in the frontend due to React 18 / react-scripts peer dependency conflicts:

```bash
npm install --legacy-peer-deps
```

The `frontend/.npmrc` and `frontend/netlify.toml` both handle this for CI/CD.

---

## Database Models (MongoDB / Mongoose)

### User
```typescript
{ username: string, chips: number (default: 1000),
  totalGamesPlayed: number, totalWins: number, totalLosses: number }
```

### Card
```typescript
{ name: string, hp: number, imageUrl: string, pokemonId: string,
  setName: string, cardNumber: string, hpCategory: 'low'|'medium'|'high' }
```

### GameTable
```typescript
{ inviteCode: string, dealerId: ObjectId, players: Player[],
  dealer: { userId, username, hand[], total, status },
  shoeId: ObjectId, maxPlayers: 6, gameStatus: 'waiting'|'in-progress'|'completed' }
```

### Shoe
```typescript
{ cards: Card[], cardsUsed: number }  // 208 cards per shoe
```

---

## Deployment

### Frontend (Netlify)

Config in `frontend/netlify.toml`:
- Build command: `CI=false npm install --legacy-peer-deps && npm run build`
- Publish dir: `build`
- All routes rewritten to `index.html` (SPA routing)
- Dev server port: 3000

### Backend (Render)

- Set `MONGODB_URI`, `JWT_SECRET`, `NODE_ENV=production`, `PORT` as environment variables
- Start command: `npm run build && npm start`

---

## Known Issues & Technical Debt

1. **Multiplayer code is unused.** `Lobby.tsx`, `GameBoard.tsx`, and all backend multiplayer routes exist but the frontend never calls them. The active game is 100% client-side in `App.tsx`.

2. **No tests.** Neither the frontend nor backend has any test files. `npm test` in the frontend runs the react-scripts test runner against nothing.

3. **CORS is hardcoded.** `backend/src/index.ts` only allows `https://pkmbkj.netlify.app`. Change this for local backend development.

4. **Backend API URL is hardcoded.** `frontend/src/services/api.ts` points directly to the Render URL. Use an environment variable (`REACT_APP_API_URL`) if backend URL changes.

5. **No error boundaries.** If the Pokemon TCG API is unreachable and the fallback card list is exhausted, the game state can break silently.

6. **`PokemonBlackJack` and `PkmbkJ/`** are artifact files/folders at the repo root and can be ignored.

---

## Git Branch Strategy

- `main` — production branch
- Feature branches should follow the pattern used in CI: `claude/<description>-<id>`

When making changes, commit to the working branch and push with:

```bash
git push -u origin <branch-name>
```
