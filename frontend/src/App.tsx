import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { playCardDeal, playShuffle, playWin, playLose, playBust } from './sounds';
import HofPage, { HallOfFameEntry } from './HofPage';
import DexPage, { DexEntry } from './DexPage';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PokemonCard {
  id: string;
  name: string;
  hp: number;
  images: { small: string; large: string };
}

interface UserData {
  passwordHash: string;
  chips: number;
  lastDailyBonus: string;
  personalHof: HallOfFameEntry[];
  dex: DexEntry[];
}

type UserStore = Record<string, UserData>;
type GameState = 'auth' | 'loading' | 'betting' | 'playing' | 'dealer-turn' | 'dex-select' | 'game-over';
type Page = 'game' | 'hof' | 'dex';

// ── Pure utilities ────────────────────────────────────────────────────────────

function calculateTotal(hand: PokemonCard[]): number {
  return hand.reduce((sum, c) => sum + c.hp, 0);
}

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function hashPassword(password: string): string {
  let hash = 5381;
  for (let i = 0; i < password.length; i++) {
    hash = ((hash << 5) + hash) ^ password.charCodeAt(i);
    hash = hash >>> 0;
  }
  return hash.toString(36);
}

function loadUsers(): UserStore {
  try { return JSON.parse(localStorage.getItem('pkmbkj-users') ?? '{}'); }
  catch { return {}; }
}

function saveUsers(users: UserStore): void {
  localStorage.setItem('pkmbkj-users', JSON.stringify(users));
}

const BONUS_MS = 24 * 60 * 60 * 1000;

function canClaimBonus(last: string): boolean {
  if (!last) return true;
  return Date.now() - new Date(last).getTime() >= BONUS_MS;
}

function bonusCountdown(last: string): string {
  const next = new Date(last).getTime() + BONUS_MS;
  const diff = Math.max(0, next - Date.now());
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return `${h}h ${m}m`;
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

async function fetchPokemonSprite(cardName: string): Promise<string> {
  const base = cardName
    .replace(/\s+(ex|EX|GX|V|VMAX|VSTAR|VUNION|BREAK|LV\.X|δ|\d+)(\s|$)/gi, ' ')
    .replace(/^(Dark|Light|Team Rocket's|Rocket's|Gym|M\s)\s*/i, '')
    .trim();

  const toSlug = (s: string) =>
    s.toLowerCase()
      .replace(/♀/g, '-f').replace(/♂/g, '-m')
      .replace(/['.]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

  const attempts = [
    toSlug(base.split(' ')[0]),
    toSlug(base),
    toSlug(cardName.split(' ')[0]),
    toSlug(cardName),
  ].filter((v, i, a) => Boolean(v) && a.indexOf(v) === i);

  for (const name of attempts) {
    try {
      const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${name}`);
      if (res.ok) {
        const data = await res.json();
        if (data.sprites?.front_default) return data.sprites.front_default;
      }
    } catch { /* try next */ }
  }
  return '';
}

const FALLBACK_CARDS: PokemonCard[] = [
  { id: 'base1-4',  name: 'Charizard',  hp: 120, images: { small: 'https://images.pokemontcg.io/base1/4.png',  large: 'https://images.pokemontcg.io/base1/4_hires.png'  }},
  { id: 'base1-2',  name: 'Blastoise',  hp: 100, images: { small: 'https://images.pokemontcg.io/base1/2.png',  large: 'https://images.pokemontcg.io/base1/2_hires.png'  }},
  { id: 'base1-15', name: 'Venusaur',   hp: 100, images: { small: 'https://images.pokemontcg.io/base1/15.png', large: 'https://images.pokemontcg.io/base1/15_hires.png' }},
  { id: 'base1-58', name: 'Pikachu',    hp:  40, images: { small: 'https://images.pokemontcg.io/base1/58.png', large: 'https://images.pokemontcg.io/base1/58_hires.png' }},
  { id: 'base1-10', name: 'Mewtwo',     hp:  60, images: { small: 'https://images.pokemontcg.io/base1/10.png', large: 'https://images.pokemontcg.io/base1/10_hires.png' }},
  { id: 'base1-8',  name: 'Machamp',    hp: 100, images: { small: 'https://images.pokemontcg.io/base1/8.png',  large: 'https://images.pokemontcg.io/base1/8_hires.png'  }},
  { id: 'base2-20', name: 'Gengar',     hp:  80, images: { small: 'https://images.pokemontcg.io/base2/20.png', large: 'https://images.pokemontcg.io/base2/20_hires.png' }},
  { id: 'base4-4',  name: 'Dragonite',  hp: 100, images: { small: 'https://images.pokemontcg.io/base4/4.png',  large: 'https://images.pokemontcg.io/base4/4_hires.png'  }},
  { id: 'base1-7',  name: 'Hitmonchan', hp:  70, images: { small: 'https://images.pokemontcg.io/base1/7.png',  large: 'https://images.pokemontcg.io/base1/7_hires.png'  }},
  { id: 'base1-3',  name: 'Chansey',    hp: 120, images: { small: 'https://images.pokemontcg.io/base1/3.png',  large: 'https://images.pokemontcg.io/base1/3_hires.png'  }},
  { id: 'base1-1',  name: 'Alakazam',   hp:  80, images: { small: 'https://images.pokemontcg.io/base1/1.png',  large: 'https://images.pokemontcg.io/base1/1_hires.png'  }},
  { id: 'base1-6',  name: 'Gyarados',   hp: 100, images: { small: 'https://images.pokemontcg.io/base1/6.png',  large: 'https://images.pokemontcg.io/base1/6_hires.png'  }},
  { id: 'base1-26', name: 'Dratini',    hp:  40, images: { small: 'https://images.pokemontcg.io/base1/26.png', large: 'https://images.pokemontcg.io/base1/26_hires.png' }},
  { id: 'base1-56', name: 'Onix',       hp:  90, images: { small: 'https://images.pokemontcg.io/base1/56.png', large: 'https://images.pokemontcg.io/base1/56_hires.png' }},
  { id: 'base1-54', name: 'Jigglypuff', hp:  60, images: { small: 'https://images.pokemontcg.io/base1/54.png', large: 'https://images.pokemontcg.io/base1/54_hires.png' }},
];

// ── Component ─────────────────────────────────────────────────────────────────

function App() {
  // Navigation
  const [page, setPage] = useState<Page>('game');

  // Auth
  const [gameState, setGameState]       = useState<GameState>('auth');
  const [currentUser, setCurrentUser]   = useState('');
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError]       = useState('');
  const loginBonusRef = useRef('');

  // Game
  const [allCards, setAllCards]     = useState<PokemonCard[]>([]);
  const [deck, setDeck]             = useState<PokemonCard[]>([]);
  const [playerHand, setPlayerHand] = useState<PokemonCard[]>([]);
  const [dealerHand, setDealerHand] = useState<PokemonCard[]>([]);
  const [chips, setChips]           = useState(1000);
  const [bet, setBet]               = useState(0);
  const [message, setMessage]       = useState('');
  const [displayedPlayerTotal, setDisplayedPlayerTotal] = useState(0);

  // Dex
  const [dex, setDex]                       = useState<DexEntry[]>([]);
  const [pendingDexCards, setPendingDexCards] = useState<PokemonCard[]>([]);
  const isDexEligibleRef = useRef(false);

  // Hall of Fame
  const [hallOfFame, setHallOfFame]     = useState<HallOfFameEntry[]>(() => {
    try { return JSON.parse(localStorage.getItem('pkmbkj-hof') ?? '[]'); }
    catch { return []; }
  });
  const [personalHof, setPersonalHof] = useState<HallOfFameEntry[]>([]);

  // ── Persist chips on change ───────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser) return;
    const users = loadUsers();
    if (users[currentUser]) {
      users[currentUser].chips = chips;
      saveUsers(users);
    }
  }, [chips, currentUser]);

  // ── Re-fetch missing sprites for HoF entries on mount ────────────────────
  useEffect(() => {
    if (hallOfFame.length === 0) return;
    const refetch = async () => {
      const entries = hallOfFame.map(e => ({ ...e, sprites: [...e.sprites] }));
      let changed = false;
      for (const entry of entries) {
        if (entry.sprites.every(s => s)) continue;
        for (let j = 0; j < entry.pokemonNames.length; j++) {
          if (!entry.sprites[j]) {
            entry.sprites[j] = await fetchPokemonSprite(entry.pokemonNames[j]);
            await sleep(150);
            changed = true;
          }
        }
      }
      if (changed) {
        setHallOfFame(entries);
        localStorage.setItem('pkmbkj-hof', JSON.stringify(entries));
      }
    };
    refetch();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auth ──────────────────────────────────────────────────────────────────
  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    const username = authUsername.trim();
    const password = authPassword;
    if (!username || !password) { setAuthError('Please enter a username and password.'); return; }

    const users = loadUsers();
    const hash  = hashPassword(password);
    let startChips = 1000;
    let bonusMsg   = '';

    if (users[username]) {
      if (users[username].passwordHash !== hash) { setAuthError('Incorrect password.'); return; }
      startChips = users[username].chips;
      if (canClaimBonus(users[username].lastDailyBonus)) {
        startChips += 100;
        users[username].chips = startChips;
        users[username].lastDailyBonus = new Date().toISOString();
        bonusMsg = '🎁 Daily bonus — +$100!';
      }
      setPersonalHof(users[username].personalHof ?? []);
      setDex(users[username].dex ?? []);
    } else {
      users[username] = {
        passwordHash: hash,
        chips: 1000,
        lastDailyBonus: new Date().toISOString(),
        personalHof: [],
        dex: [],
      };
      bonusMsg = '👋 Welcome! You start with $1,000.';
    }

    saveUsers(users);
    loginBonusRef.current = bonusMsg;
    setCurrentUser(username);
    setChips(startChips);
    setAuthError('');
    setGameState('loading');
  };

  // ── Fetch cards ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (gameState !== 'loading') return;
    const fetchCards = async () => {
      try {
        const fetchPage = (p: number) =>
          fetch(`https://api.pokemontcg.io/v2/cards?q=supertype:pokemon&pageSize=250&page=${p}`).then(r => r.json());
        const [p1, p2] = await Promise.all([fetchPage(1), fetchPage(2)]);
        const raw = [...(p1.data ?? []), ...(p2.data ?? [])];
        const seen = new Set<string>();
        const valid: PokemonCard[] = [];
        for (const c of raw) {
          if (!c.hp || parseInt(c.hp) <= 0 || !c.images?.small) continue;
          if (seen.has(c.name)) continue;
          seen.add(c.name);
          valid.push({ id: c.id, name: c.name, hp: parseInt(c.hp), images: c.images });
        }
        if (valid.length < 20) throw new Error('Too few cards');
        setAllCards(valid);
        setDeck(shuffleArray(valid));
      } catch {
        setAllCards(FALLBACK_CARDS);
        setDeck(shuffleArray(FALLBACK_CARDS));
      }
      setMessage(loginBonusRef.current || 'Place your bet!');
      loginBonusRef.current = '';
      setGameState('betting');
    };
    fetchCards();
  }, [gameState]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Betting ───────────────────────────────────────────────────────────────
  const placeBet = (amount: number) =>
    setBet(prev => prev + amount > chips ? prev : prev + amount);
  const clearBet = () => setBet(0);

  // ── Start game ────────────────────────────────────────────────────────────
  const startGame = () => {
    if (bet === 0) { setMessage('Please place a bet first!'); return; }

    // Record dex eligibility: bet must be ≥ 10% of chips BEFORE deduction
    isDexEligibleRef.current = bet >= chips * 0.1;

    const needsShuffle = deck.length < 10;
    const newDeck = needsShuffle ? shuffleArray([...allCards]) : [...deck];
    if (needsShuffle) playShuffle();

    const p1 = newDeck.pop()!;
    const d1 = newDeck.pop()!;
    const p2 = newDeck.pop()!;
    const d2 = newDeck.pop()!;

    playCardDeal();
    setTimeout(() => playCardDeal(), 120);
    setTimeout(() => playCardDeal(), 240);
    setTimeout(() => playCardDeal(), 360);
    setTimeout(() => setDisplayedPlayerTotal(calculateTotal([p1, p2])), 650);

    setDeck(newDeck);
    setPlayerHand([p1, p2]);
    setDealerHand([d1, d2]);
    setChips(c => c - bet);
    setPendingDexCards([]);
    setGameState('playing');

    if (calculateTotal([p1, p2]) === 400) {
      setMessage('BLACKJACK! 400 HP!');
      setTimeout(() => setGameState('dealer-turn'), 1000);
    } else {
      setMessage('Hit or Stand?');
    }
  };

  // ── Hit ───────────────────────────────────────────────────────────────────
  const hit = () => {
    if (gameState !== 'playing') return;
    playCardDeal();
    const newDeck = [...deck];
    const card    = newDeck.pop()!;
    const newHand = [...playerHand, card];
    setDeck(newDeck);
    setPlayerHand(newHand);
    const total = calculateTotal(newHand);
    setTimeout(() => setDisplayedPlayerTotal(total), 430);
    if (total > 400) {
      setTimeout(() => playBust(), 120);
      setMessage('BUST! Over 400 HP!');
      setGameState('game-over');
    } else if (total === 400) {
      setMessage("400 HP! Dealer's turn…");
      setTimeout(() => setGameState('dealer-turn'), 1000);
    }
  };

  // ── Stand ─────────────────────────────────────────────────────────────────
  const stand = () => {
    if (gameState !== 'playing') return;
    setGameState('dealer-turn');
    setMessage("Dealer's turn…");
  };

  // ── Dealer turn ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (gameState !== 'dealer-turn') return;

    const dealerPlay = async () => {
      let currentDeck       = [...deck];
      let currentDealerHand = [...dealerHand];

      while (calculateTotal(currentDealerHand) < 361 && currentDeck.length > 0) {
        await sleep(500);
        playCardDeal();
        const card = currentDeck.pop()!;
        currentDealerHand = [...currentDealerHand, card];
        setDealerHand(currentDealerHand);
        setDeck(currentDeck);
      }

      const playerTotal = calculateTotal(playerHand);
      const dealerTotal = calculateTotal(currentDealerHand);
      await sleep(800);

      // Save win to global + personal HoF (background)
      const saveWin = async (hand: PokemonCard[], wonBet: number) => {
        const sprites: string[] = [];
        for (const c of hand) { sprites.push(await fetchPokemonSprite(c.name)); await sleep(150); }
        const entry: HallOfFameEntry = {
          id:           `${Date.now()}`,
          playerName:   currentUser,
          bet:          wonBet,
          pokemonNames: hand.map(c => c.name),
          sprites,
          date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        };
        // Global (top 10)
        setHallOfFame(prev => {
          const updated = [...prev, entry].sort((a, b) => b.bet - a.bet).slice(0, 10);
          localStorage.setItem('pkmbkj-hof', JSON.stringify(updated));
          return updated;
        });
        // Personal (top 10)
        setPersonalHof(prev => {
          const updated = [...prev, entry].sort((a, b) => b.bet - a.bet).slice(0, 10);
          const users = loadUsers();
          if (users[currentUser]) { users[currentUser].personalHof = updated; saveUsers(users); }
          return updated;
        });
      };

      const isWin = dealerTotal > 400 || playerTotal > dealerTotal;

      if (dealerTotal > 400) {
        playWin();
        setMessage('Dealer BUSTS! You WIN!');
        setChips(c => c + bet * 2);
      } else if (playerTotal > dealerTotal) {
        playWin();
        setMessage('You WIN!');
        setChips(c => c + bet * 2);
      } else if (dealerTotal > playerTotal) {
        playLose();
        setMessage('Dealer wins.');
      } else {
        setMessage('Push! Bet returned.');
        setChips(c => c + bet);
      }

      if (isWin) {
        saveWin(playerHand, bet);
        // Check dex eligibility using ref (stable across closure)
        if (isDexEligibleRef.current) {
          // Find cards not yet in dex
          const users = loadUsers();
          const currentDex: DexEntry[] = users[currentUser]?.dex ?? [];
          const eligible = playerHand.filter(c => !currentDex.some(d => d.name === c.name));
          if (eligible.length > 0) {
            setPendingDexCards(eligible);
            setGameState('dex-select');
            return;
          }
        }
      }

      setGameState('game-over');
    };

    dealerPlay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState]);

  // ── Add to Pokédex ────────────────────────────────────────────────────────
  const addToDex = (card: PokemonCard) => {
    if (dex.some(d => d.name === card.name)) return;

    const newEntry: DexEntry = { name: card.name, sprite: '' };
    const updatedDex = [...dex, newEntry];
    setDex(updatedDex);
    setPendingDexCards(prev => prev.filter(c => c.name !== card.name));

    // Save immediately (without sprite), then update sprite in background
    const users = loadUsers();
    if (users[currentUser]) { users[currentUser].dex = updatedDex; saveUsers(users); }

    fetchPokemonSprite(card.name).then(sprite => {
      if (!sprite) return;
      setDex(prev => {
        const updated = prev.map(d => d.name === card.name ? { ...d, sprite } : d);
        const u = loadUsers();
        if (u[currentUser]) { u[currentUser].dex = updated; saveUsers(u); }
        return updated;
      });
    });
  };

  // ── New Round ─────────────────────────────────────────────────────────────
  const newRound = () => {
    if (chips <= 0) {
      const users    = loadUsers();
      const userData = users[currentUser];
      if (userData && canClaimBonus(userData.lastDailyBonus)) {
        userData.chips = 100;
        userData.lastDailyBonus = new Date().toISOString();
        saveUsers(users);
        setChips(100);
        setMessage('Daily bonus collected! +$100 — Place your bet!');
      } else {
        const wait = userData ? bonusCountdown(userData.lastDailyBonus) : '24h';
        setMessage(`No chips! Come back in ${wait} for your daily $100.`);
        setPlayerHand([]); setDealerHand([]); setBet(0); setDisplayedPlayerTotal(0);
        return;
      }
    } else {
      setMessage('Place your bet!');
    }
    setPlayerHand([]); setDealerHand([]); setBet(0); setDisplayedPlayerTotal(0);
    setPendingDexCards([]);
    setGameState('betting');
  };

  // ── Render: Auth ──────────────────────────────────────────────────────────
  if (gameState === 'auth') {
    return (
      <div className="app">
        <div className="auth-container">
          <div className="auth-panel">
            <h1 className="auth-title">Pokémon <span>Blackjack</span></h1>
            <p className="auth-subtitle">Sign in — or type a new name to register</p>
            <form className="auth-form" onSubmit={handleAuth}>
              <div className="auth-field">
                <label className="auth-label">Username</label>
                <input className="auth-input" type="text" value={authUsername}
                  onChange={e => { setAuthUsername(e.target.value); setAuthError(''); }}
                  placeholder="trainer_name" autoComplete="username" autoFocus />
              </div>
              <div className="auth-field">
                <label className="auth-label">Password</label>
                <input className="auth-input" type="password" value={authPassword}
                  onChange={e => { setAuthPassword(e.target.value); setAuthError(''); }}
                  placeholder="••••••••" autoComplete="current-password" />
              </div>
              {authError && <p className="auth-error">{authError}</p>}
              <button className="btn-primary btn-deal auth-submit" type="submit">Play</button>
            </form>
            <p className="auth-hint">No email needed · New accounts start with $1,000 · $100 daily bonus</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: Loading ───────────────────────────────────────────────────────
  if (gameState === 'loading') {
    return (
      <div className="app">
        <div className="loading-container">
          <div className="loading-spinner" />
          <p className="loading-text">Fetching Pokémon cards…</p>
        </div>
      </div>
    );
  }

  // ── Render: HoF page ──────────────────────────────────────────────────────
  if (page === 'hof') {
    return <HofPage globalHof={hallOfFame} personalHof={personalHof} onBack={() => setPage('game')} />;
  }

  // ── Render: Dex page ──────────────────────────────────────────────────────
  if (page === 'dex') {
    return <DexPage dex={dex} onBack={() => setPage('game')} />;
  }

  // ── Render: Game ──────────────────────────────────────────────────────────
  const dealerTotal     = calculateTotal(dealerHand);
  const showDealerTotal = gameState !== 'betting' && gameState !== 'playing';

  return (
    <div className="app">
      <div className="game-container">

        {/* Header */}
        <header className="header">
          <span className="header-title">Pokémon <span>Blackjack</span></span>
          <div className="header-nav">
            <button className="nav-icon-btn" onClick={() => setPage('hof')} title="Hall of Fame">
              🏆
            </button>
            <button className="nav-icon-btn" onClick={() => setPage('dex')} title="My Pokédex">
              📖
              {dex.length > 0 && <span className="nav-badge">{dex.length}</span>}
            </button>
          </div>
          <div className="header-right">
            <span className="chips-value">${chips.toLocaleString()}</span>
            <span className="player-tag">{currentUser}</span>
          </div>
        </header>

        {/* Dealer */}
        <div className="panel">
          <div className="panel-label">
            Dealer
            <span className={`total-badge${showDealerTotal ? '' : ' hidden'}`}>{dealerTotal} HP</span>
          </div>
          <div className="hand">
            {dealerHand.map((card, idx) => (
              <div key={card.id + idx} className="card"
                style={{ '--deal-delay': `${0.12 + idx * 0.24}s` } as React.CSSProperties}>
                {gameState === 'playing' && idx === 1 ? (
                  <div className="card-back">
                    <img src="https://images.pokemontcg.io/base1/back.png" alt="card back" />
                  </div>
                ) : (
                  <>
                    <img src={card.images.small} alt={card.name} className="card-image" />
                    <span className="card-hp">{card.hp} HP</span>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Player */}
        <div className="panel">
          <div className="panel-label">
            Your Hand
            <span className={`total-badge${displayedPlayerTotal ? '' : ' hidden'}`}>{displayedPlayerTotal} HP</span>
          </div>
          <div className="hand">
            {playerHand.map((card, idx) => {
              const isDexPending = gameState === 'dex-select' && pendingDexCards.some(c => c.name === card.name);
              return (
                <div
                  key={card.id + idx}
                  className={`card${isDexPending ? ' dex-eligible' : ''}`}
                  onClick={() => isDexPending && addToDex(card)}
                  style={{ '--deal-delay': `${idx < 2 ? idx * 0.24 : 0}s` } as React.CSSProperties}
                >
                  <img src={card.images.small} alt={card.name} className="card-image" />
                  <span className="card-hp">{card.hp} HP</span>
                  {isDexPending && <span className="dex-capture-badge">+ DEX</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Message */}
        <div className="message-panel">
          <p className="message-text">{message}</p>
        </div>

        {/* Controls */}
        <div className="controls-panel">
          {gameState === 'betting' && (
            <>
              <span className="bet-label">Place your bet</span>
              <div className="bet-row">
                {[10, 25, 50, 100].map(amount => (
                  <button key={amount} className="chip-btn"
                    onClick={() => placeBet(amount)} disabled={bet + amount > chips}>
                    +${amount}
                  </button>
                ))}
              </div>
              <div className="bet-summary">
                <span className="bet-display">
                  {bet > 0
                    ? <>Betting <strong>${bet}</strong>{bet >= chips * 0.1 ? <span className="dex-hint"> · 🎴 Dex eligible</span> : ''}</>
                    : <span className="bet-empty">Select chips to bet</span>}
                </span>
                {bet > 0 && <button className="clear-btn" onClick={clearBet}>Clear</button>}
              </div>
              <button className="btn-primary btn-deal" onClick={startGame} disabled={bet === 0}>
                Deal
              </button>
            </>
          )}

          {gameState === 'playing' && (
            <div className="play-buttons">
              <button className="btn-primary btn-hit" onClick={hit}>Hit</button>
              <button className="btn-primary btn-stand" onClick={stand}>Stand</button>
            </div>
          )}

          {gameState === 'dealer-turn' && (
            <p className="bet-display">Dealer is playing…</p>
          )}

          {gameState === 'dex-select' && (
            <>
              <p className="dex-select-prompt">
                Tap a <span className="dex-select-highlight">glowing card</span> to add it to your Pokédex!
              </p>
              <button className="btn-primary btn-new-round" onClick={() => setGameState('game-over')}>
                Done
              </button>
            </>
          )}

          {gameState === 'game-over' && (
            <button className="btn-primary btn-new-round" onClick={newRound}>
              {chips <= 0 ? 'Collect Daily Bonus' : 'New Round'}
            </button>
          )}
        </div>

        <p className="footer">{deck.length} cards remaining</p>

      </div>
    </div>
  );
}

export default App;
