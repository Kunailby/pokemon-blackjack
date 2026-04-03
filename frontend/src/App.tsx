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

// Build a 312-card shoe (6 decks) from a pool of unique cards.
// Each copy gets a unique id suffix so React keys never collide.
function buildShoe(cards: PokemonCard[]): PokemonCard[] {
  const SHOE_SIZE = 312;
  const shoe: PokemonCard[] = [];
  for (let i = 0; i < SHOE_SIZE; i++) {
    const card = cards[i % cards.length];
    shoe.push({ ...card, id: `${card.id}-s${i}` });
  }
  return shuffleArray(shoe);
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

// ── Card cache (6-hour TTL) ───────────────────────────────────────────────────
function loadCardCache(): PokemonCard[] | null {
  try {
    const raw = localStorage.getItem('pkmbkj-cards');
    if (!raw) return null;
    const { cards, fetchedAt } = JSON.parse(raw);
    if (Date.now() - fetchedAt > 6 * 60 * 60 * 1000) return null; // stale
    return cards as PokemonCard[];
  } catch { return null; }
}

function saveCardCache(cards: PokemonCard[]): void {
  try { localStorage.setItem('pkmbkj-cards', JSON.stringify({ cards, fetchedAt: Date.now() })); }
  catch { /* quota exceeded — skip */ }
}

// ── Backend API helper ────────────────────────────────────────────────────────
const API_BASE = 'https://pokemon-blackjack-28yc.onrender.com/api';

async function apiCall(path: string, method = 'GET', body?: any, token?: string): Promise<any> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method, headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
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

// Cache of all official Pokémon slugs from PokéAPI (e.g. "kyogre", "mr-mime")
let allPokemonNames: Set<string> | undefined;

async function getAllPokemonNames(): Promise<Set<string>> {
  if (allPokemonNames) return allPokemonNames;
  try {
    const res = await fetch('https://pokeapi.co/api/v2/pokemon?limit=2000');
    const data = await res.json();
    allPokemonNames = new Set(
      (data.results ?? []).map((p: any) => p.name as string)
    );
  } catch {
    allPokemonNames = new Set(); // fallback to empty — regex path takes over
  }
  return allPokemonNames;
}

const toSlug = (s: string) =>
  s.toLowerCase()
    .replace(/♀/g, '-f').replace(/♂/g, '-m')
    .replace(/['.]/g, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-|-$/g, '');

async function tryFetchSprite(slug: string): Promise<string> {
  if (!slug) return '';
  try {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${slug}`);
    if (res.ok) {
      const data = await res.json();
      return data.sprites?.front_default ?? '';
    }
  } catch { /* ignore */ }
  return '';
}

async function fetchPokemonSprite(cardName: string): Promise<string> {
  const names = await getAllPokemonNames();

  // Pre-normalize: strip hyphenated TCG suffixes so "Entei-EX" → "Entei",
  // "M Sceptile-EX" → "M Sceptile", "Vileplume-GX" → "Vileplume"
  const normalized = cardName
    .replace(/-(ex|GX|VMAX|VSTAR|VUNION|BREAK)$/i, '')
    .replace(/\s+(ex|EX|GX|V|VMAX|VSTAR|VUNION|BREAK|LV\.X|δ|\d+)(\s|$)/gi, ' ')
    .replace(/^(Team\s+\w+'s|\w+'s|Dark|Light|Gym|M\s)\s*/i, '')
    .trim();

  // Strategy 1 (preferred): scan all sub-phrases of the normalized name and
  // find one that exactly matches a known Pokémon slug.
  // e.g. "Team Aqua's Kyogre ex" → normalized "Kyogre" → slug "kyogre" → hit!
  // e.g. "Entei-EX" → normalized "Entei" → slug "entei" → hit!
  if (names.size > 0) {
    const tokens = normalized.split(/\s+/);
    for (let len = Math.min(tokens.length, 3); len >= 1; len--) {
      for (let start = 0; start <= tokens.length - len; start++) {
        const slug = toSlug(tokens.slice(start, start + len).join(' '));
        if (slug && names.has(slug)) {
          const sprite = await tryFetchSprite(slug);
          if (sprite) return sprite;
        }
      }
    }
  }

  // Strategy 2 (fallback): try first word and full normalized name as slugs
  for (const slug of [toSlug(normalized.split(' ')[0]), toSlug(normalized)]) {
    const sprite = await tryFetchSprite(slug);
    if (sprite) return sprite;
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
  const [authLoading, setAuthLoading]   = useState(false);
  const loginBonusRef  = useRef('');
  const tokenRef       = useRef('');   // JWT, kept out of state to avoid re-renders
  const syncTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Game
  const [allCards, setAllCards]     = useState<PokemonCard[]>([]);
  const [deck, setDeck]             = useState<PokemonCard[]>([]);
  const [playerHand, setPlayerHand] = useState<PokemonCard[]>([]);
  const [dealerHand, setDealerHand] = useState<PokemonCard[]>([]);
  const [chips, setChips]           = useState(1000);
  const [lastDailyBonus, setLastDailyBonus] = useState('');
  const [bet, setBet]               = useState(0);
  const [message, setMessage]       = useState('');
  const [displayedPlayerTotal, setDisplayedPlayerTotal] = useState(0);

  // Dex
  const [dex, setDex]                       = useState<DexEntry[]>([]);
  const [pendingDexCards, setPendingDexCards] = useState<PokemonCard[]>([]);
  const isDexEligibleRef = useRef(false);
  const dexBtnRef        = useRef<HTMLButtonElement>(null);
  const [flyingCard, setFlyingCard] = useState<{src: string; fromX: number; fromY: number; toX: number; toY: number} | null>(null);

  // Hall of Fame
  const [hallOfFame, setHallOfFame]   = useState<HallOfFameEntry[]>([]);
  const [personalHof, setPersonalHof] = useState<HallOfFameEntry[]>([]);
  const [logoutConfirm, setLogoutConfirm] = useState(false);

  // ── Restore session on refresh ───────────────────────────────────────────
  useEffect(() => {
    const token   = localStorage.getItem('pkmbkj-token');
    const session = localStorage.getItem('pkmbkj-session');
    if (!session) return;

    // Try backend first; fall back to localStorage
    const restore = async () => {
      if (token) {
        try {
          const data = await apiCall('/auth/profile', 'GET', undefined, token);
          tokenRef.current = token;
          setCurrentUser(session);
          setChips(data.user.chips);
          setLastDailyBonus(data.user.lastDailyBonus ?? '');
          setPersonalHof(data.user.personalHof ?? []);
          setDex(data.user.dex ?? []);
          setGameState('loading');
          return;
        } catch { /* fall through to localStorage */ }
      }
      // Fallback: localStorage
      const users = loadUsers();
      const ud    = users[session];
      if (!ud) { localStorage.removeItem('pkmbkj-session'); return; }
      setCurrentUser(session);
      setChips(ud.chips);
      setLastDailyBonus(ud.lastDailyBonus ?? '');
      setPersonalHof(ud.personalHof ?? []);
      setDex(ud.dex ?? []);
      setGameState('loading');
    };
    restore();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch global HoF on mount ─────────────────────────────────────────────
  useEffect(() => {
    apiCall('/auth/hof').then(data => {
      if (data.entries?.length) setHallOfFame(data.entries);
      else {
        // Fallback to localStorage cache
        try { const cached = JSON.parse(localStorage.getItem('pkmbkj-hof') ?? '[]'); setHallOfFame(cached); }
        catch { /* ignore */ }
      }
    }).catch(() => {
      try { const cached = JSON.parse(localStorage.getItem('pkmbkj-hof') ?? '[]'); setHallOfFame(cached); }
      catch { /* ignore */ }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Debounced backend sync ────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser) return;
    // Always update localStorage as a backup
    const users = loadUsers();
    if (users[currentUser]) {
      users[currentUser].chips          = chips;
      users[currentUser].lastDailyBonus = lastDailyBonus;
      users[currentUser].personalHof    = personalHof;
      users[currentUser].dex            = dex;
      saveUsers(users);
    }
    // Debounce backend sync
    if (!tokenRef.current) return;
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      apiCall('/auth/sync', 'PUT',
        { chips, lastDailyBonus, personalHof, dex },
        tokenRef.current
      ).catch(() => { /* silent — localStorage is the fallback */ });
    }, 2000);
  }, [chips, lastDailyBonus, dex, personalHof, currentUser]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── Re-fetch missing sprites for Dex entries ──────────────────────────────
  useEffect(() => {
    if (!currentUser || dex.length === 0) return;
    if (dex.every(d => d.sprite)) return; // all sprites present, nothing to do
    const refetch = async () => {
      const updated = dex.map(d => ({ ...d }));
      let changed = false;
      for (let i = 0; i < updated.length; i++) {
        if (!updated[i].sprite) {
          const sprite = await fetchPokemonSprite(updated[i].name);
          await sleep(150);
          if (sprite) { updated[i].sprite = sprite; changed = true; }
        }
      }
      if (changed) {
        setDex(updated);
        const u = loadUsers();
        if (u[currentUser]) { u[currentUser].dex = updated; saveUsers(u); }
      }
    };
    refetch();
  }, [currentUser]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auth ──────────────────────────────────────────────────────────────────
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const username = authUsername.trim();
    const password = authPassword;
    if (!username || !password) { setAuthError('Please enter a username and password.'); return; }
    setAuthLoading(true);

    const hash = hashPassword(password);
    let startChips    = 1000;
    let startLastBonus = '';
    let startPersonal: HallOfFameEntry[] = [];
    let startDex: DexEntry[] = [];
    let bonusMsg = '';

    try {
      // Try backend (with 6s timeout)
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 6000);
      const data = await apiCall('/auth/login', 'POST', { username, passwordHash: hash });
      clearTimeout(timer);

      tokenRef.current = data.token;
      localStorage.setItem('pkmbkj-token', data.token);

      startChips     = data.user.chips;
      startLastBonus = data.user.lastDailyBonus ?? '';
      startPersonal  = data.user.personalHof ?? [];
      startDex       = data.user.dex ?? [];

      if (data.isNew) {
        bonusMsg = '👋 Welcome! You start with $1,000.';
      } else if (canClaimBonus(startLastBonus)) {
        startChips     += 100;
        startLastBonus  = new Date().toISOString();
        bonusMsg        = '🎁 Daily bonus — +$100!';
        // Persist the bonus claim immediately
        apiCall('/auth/sync', 'PUT',
          { chips: startChips, lastDailyBonus: startLastBonus, personalHof: startPersonal, dex: startDex },
          tokenRef.current
        ).catch(() => {});
      }
    } catch (err: any) {
      // Incorrect password comes back as an API error
      if (err.message === 'Incorrect password.') {
        setAuthError('Incorrect password.');
        setAuthLoading(false);
        return;
      }
      // Network error — fall back to localStorage
      const users = loadUsers();
      if (users[username]) {
        if (users[username].passwordHash !== hash) { setAuthError('Incorrect password.'); setAuthLoading(false); return; }
        startChips     = users[username].chips;
        startLastBonus = users[username].lastDailyBonus ?? '';
        startPersonal  = users[username].personalHof ?? [];
        startDex       = users[username].dex ?? [];
        if (canClaimBonus(startLastBonus)) {
          startChips    += 100;
          startLastBonus = new Date().toISOString();
          bonusMsg       = '🎁 Daily bonus — +$100!';
        }
      } else {
        users[username] = { passwordHash: hash, chips: 1000, lastDailyBonus: new Date().toISOString(), personalHof: [], dex: [] };
        bonusMsg = '👋 Welcome! You start with $1,000.';
      }
      saveUsers(users);
    }

    // Persist to localStorage as backup
    const users = loadUsers();
    users[username] = { ...(users[username] || {}), passwordHash: hash, chips: startChips, lastDailyBonus: startLastBonus, personalHof: startPersonal, dex: startDex };
    saveUsers(users);

    localStorage.setItem('pkmbkj-session', username);
    loginBonusRef.current = bonusMsg;
    setCurrentUser(username);
    setChips(startChips);
    setLastDailyBonus(startLastBonus);
    setPersonalHof(startPersonal);
    setDex(startDex);
    setAuthError('');
    setAuthLoading(false);
    setGameState('loading');
  };

  // ── Fetch cards ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (gameState !== 'loading') return;
    const fetchCards = async () => {
      // Warm up the Pokémon name cache in parallel
      getAllPokemonNames();

      // Use cached cards if fresh (skips API call on refresh)
      const cached = loadCardCache();
      if (cached && cached.length >= 20) {
        setAllCards(cached);
        setDeck(buildShoe(cached));
        setMessage(loginBonusRef.current || 'Place your bet!');
        loginBonusRef.current = '';
        setGameState('betting');
        return;
      }

      try {
        const fetchPage = (p: number) =>
          fetch(`https://api.pokemontcg.io/v2/cards?q=supertype:pokemon&pageSize=250&page=${p}`).then(r => r.json());

        // Fetch page 1 to discover total card count
        const p1 = await fetchPage(1);
        const totalCount: number = p1.totalCount ?? 1000;
        const maxPage = Math.max(2, Math.ceil(totalCount / 250));

        // Pick 4 additional pages spread randomly across the full catalog
        const picks = new Set<number>([1]);
        const segment = Math.floor(maxPage / 4);
        for (let i = 0; i < 4; i++) {
          const base = i * segment + 2;
          picks.add(Math.min(maxPage, base + Math.floor(Math.random() * Math.max(1, segment))));
        }
        picks.delete(1); // already have p1

        const extras = await Promise.all(Array.from(picks).map(p => fetchPage(p)));
        const raw: any[] = (p1.data ?? []).concat(...extras.map((r: any) => r.data ?? []));
        const seen = new Set<string>();
        const valid: PokemonCard[] = [];
        for (const c of raw) {
          if (!c.hp || parseInt(c.hp) <= 0 || !c.images?.small) continue;
          if (seen.has(c.name)) continue;
          seen.add(c.name);
          valid.push({ id: c.id, name: c.name, hp: parseInt(c.hp), images: c.images });
        }
        if (valid.length < 20) throw new Error('Too few cards');
        saveCardCache(valid);
        setAllCards(valid);
        setDeck(buildShoe(valid));
      } catch {
        setAllCards(FALLBACK_CARDS);
        setDeck(buildShoe(FALLBACK_CARDS));
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

    const needsShuffle = deck.length < 15;
    const newDeck = needsShuffle ? buildShoe(allCards) : [...deck];
    if (needsShuffle) playShuffle();

    const p1 = newDeck.pop()!;
    const d1 = newDeck.pop()!;
    const p2 = newDeck.pop()!;
    const d2 = newDeck.pop()!;
    const d3 = newDeck.pop()!; // face-down

    playCardDeal();
    setTimeout(() => playCardDeal(), 120);
    setTimeout(() => playCardDeal(), 240);
    setTimeout(() => playCardDeal(), 360);
    setTimeout(() => playCardDeal(), 480);
    setTimeout(() => setDisplayedPlayerTotal(calculateTotal([p1, p2])), 750);

    setDeck(newDeck);
    setPlayerHand([p1, p2]);
    setDealerHand([d1, d2, d3]);
    setChips(c => c - bet);
    setPendingDexCards([]);
    setGameState('playing');

    if (calculateTotal([p1, p2]) === 400) {
      setMessage('BLACKJACK! 400 HP!');
      setTimeout(() => setGameState('dealer-turn'), 1000);
    } else {
      setMessage('');
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
        // Global HoF — push to backend; update local state from response
        if (tokenRef.current) {
          apiCall('/auth/hof', 'POST', { entry }, tokenRef.current)
            .then(data => setHallOfFame(data.entries || []))
            .catch(() => {
              // Backend unavailable — update locally
              setHallOfFame(prev => {
                const updated = [...prev, entry].sort((a, b) => b.bet - a.bet).slice(0, 10);
                localStorage.setItem('pkmbkj-hof', JSON.stringify(updated));
                return updated;
              });
            });
        } else {
          setHallOfFame(prev => {
            const updated = [...prev, entry].sort((a, b) => b.bet - a.bet).slice(0, 10);
            localStorage.setItem('pkmbkj-hof', JSON.stringify(updated));
            return updated;
          });
        }
        // Personal HoF (via state → triggers sync effect)
        setPersonalHof(prev => [...prev, entry].sort((a, b) => b.bet - a.bet).slice(0, 10));
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

  // ── Collect daily bonus (from broke screen) ──────────────────────────────
  const collectBonus = () => {
    if (!canClaimBonus(lastDailyBonus)) return;
    const newBonus = new Date().toISOString();
    setChips(100);
    setLastDailyBonus(newBonus);
    setMessage('Daily bonus collected! +$100 — Place your bet!');
  };

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = () => {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    localStorage.removeItem('pkmbkj-token');
    localStorage.removeItem('pkmbkj-session');
    tokenRef.current = '';
    setCurrentUser('');
    setChips(1000);
    setDex([]);
    setPersonalHof([]);
    setBet(0);
    setPlayerHand([]);
    setDealerHand([]);
    setMessage('');
    setDisplayedPlayerTotal(0);
    setLastDailyBonus('');
    setLogoutConfirm(false);
    setGameState('auth');
  };
  // ── New Round ─────────────────────────────────────────────────────────────
  const newRound = () => {
    setPlayerHand([]); setDealerHand([]); setBet(0); setDisplayedPlayerTotal(0);
    setPendingDexCards([]);
    setMessage(chips <= 0 ? '' : 'Place your bet!');
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
              <button className="btn-primary btn-deal auth-submit" type="submit" disabled={authLoading}>
                {authLoading ? 'Signing in…' : 'Play'}
              </button>
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
      {/* Flying dex card animation */}
      {flyingCard && (
        <img
          className="flying-dex-card"
          src={flyingCard.src}
          alt=""
          style={{
            left: flyingCard.fromX,
            top:  flyingCard.fromY,
            '--dx': `${flyingCard.toX - flyingCard.fromX}px`,
            '--dy': `${flyingCard.toY - flyingCard.fromY}px`,
          } as React.CSSProperties}
          onAnimationEnd={() => setFlyingCard(null)}
        />
      )}

      <div className="game-container">

        {/* Header */}
        <header className="header">
          <span className="header-title">Pokémon <span>Blackjack</span></span>
          <div className="header-nav">
            <button className="nav-icon-btn" onClick={() => setPage('hof')} title="Hall of Fame">
              🏆
            </button>
            <button ref={dexBtnRef} className="nav-icon-btn" onClick={() => setPage('dex')} title="My Pokédex">
              📖
              {dex.length > 0 && <span className="nav-badge">{dex.length}</span>}
            </button>
          </div>
          <div className="header-right">
            <span className="chips-value">${chips.toLocaleString()}</span>
            <span className="player-tag">{currentUser}</span>
            <div className="logout-wrap">
              <button
                className="logout-btn"
                title="Log out"
                onClick={() => setLogoutConfirm(v => !v)}
              >⏻</button>
              {logoutConfirm && (
                <div className="logout-popover">
                  <span>Log out?</span>
                  <button className="logout-confirm" onClick={logout}>Yes</button>
                  <button className="logout-cancel" onClick={() => setLogoutConfirm(false)}>No</button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Broke screen */}
        {chips <= 0 && gameState === 'betting' && (
          <div className="broke-screen">
            <p className="broke-icon">💸</p>
            <p className="broke-title">You're out of chips!</p>
            {canClaimBonus(lastDailyBonus) ? (
              <>
                <p className="broke-subtitle">Your daily bonus is ready.</p>
                <button className="btn-primary broke-btn" onClick={collectBonus}>Collect $100</button>
              </>
            ) : (
              <p className="broke-subtitle">Daily bonus in <strong>{bonusCountdown(lastDailyBonus)}</strong></p>
            )}
          </div>
        )}

        {/* Play area — hidden when broke at betting screen */}
        {(chips > 0 || gameState !== 'betting') && <>

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
                  {gameState === 'playing' && idx === 2 ? (
                    <div className="card-back">
                      <div className="card-back-ball" />
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
                    onClick={(e) => {
                      if (!isDexPending) return;
                      const cardRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      const dexRect  = dexBtnRef.current?.getBoundingClientRect();
                      if (dexRect) {
                        setFlyingCard({
                          src:   card.images.small,
                          fromX: cardRect.left + cardRect.width  / 2,
                          fromY: cardRect.top  + cardRect.height / 2,
                          toX:   dexRect.left  + dexRect.width   / 2,
                          toY:   dexRect.top   + dexRect.height  / 2,
                        });
                      }
                      addToDex(card);
                      setGameState('game-over');
                    }}
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
          {message && (
            <div className="message-panel">
              <p className="message-text">{message}</p>
            </div>
          )}

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

            {gameState === 'game-over' && (() => {
              if (chips <= 0) {
                return (
                  <div className="broke-screen">
                    <p className="broke-icon">💸</p>
                    <p className="broke-title">You're out of chips!</p>
                    {canClaimBonus(lastDailyBonus) ? (
                      <>
                        <p className="broke-subtitle">Your daily bonus is ready.</p>
                        <button className="btn-primary broke-btn" onClick={collectBonus}>Collect $100</button>
                      </>
                    ) : (
                      <p className="broke-subtitle">Daily bonus in <strong>{bonusCountdown(lastDailyBonus)}</strong></p>
                    )}
                  </div>
                );
              }
              return (
                <button className="btn-primary btn-new-round" onClick={newRound}>
                  New Round
                </button>
              );
            })()}
          </div>

        </>}

        <p className="footer">{deck.length} cards remaining</p>

      </div>
    </div>
  );
}

export default App;
