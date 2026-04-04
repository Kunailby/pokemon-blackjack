import React, { useState, useEffect, useRef } from 'react';
import pokedexIcon from './assets/pokedex.png';
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
  types: string[];
  rarity: string;
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

// ── Shoe cache (persisted across refreshes) ───────────────────────────────────
function loadShoeCache(): PokemonCard[] | null {
  try {
    const raw = localStorage.getItem('pkmbkj-shoe');
    if (!raw) return null;
    const shoe = JSON.parse(raw) as PokemonCard[];
    return shoe.length > 0 ? shoe : null;
  } catch { return null; }
}

function saveShoeCache(shoe: PokemonCard[]): void {
  try { localStorage.setItem('pkmbkj-shoe', JSON.stringify(shoe)); }
  catch { /* quota exceeded — skip */ }
}

// ── Rarity helper ─────────────────────────────────────────────────────────────
function getRarityClass(rarity: string): string {
  const r = rarity.toLowerCase();
  if (r.includes('secret') || r.includes('promo')) return 'secret';
  if (r.includes('holo') || r.includes('ultra rare') || r.includes('full art')) return 'holo';
  if (r.includes('rare')) return 'rare';
  if (r.includes('uncommon')) return 'uncommon';
  return 'common';
}

// ── Firebase imports ──────────────────────────────────────────────────────────
import { auth } from './firebase';
import { login as firebaseLogin, logout as firebaseLogout, subscribeToUserData, updateUserData, getUserData } from './services/firebaseAuth';
import { onAuthStateChanged } from 'firebase/auth';

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
  { id: 'base1-4',  name: 'Charizard',  hp: 120, images: { small: 'https://images.pokemontcg.io/base1/4.png',  large: 'https://images.pokemontcg.io/base1/4_hires.png'  }, types: ['Fire'],      rarity: 'Holo Rare' },
  { id: 'base1-2',  name: 'Blastoise',  hp: 100, images: { small: 'https://images.pokemontcg.io/base1/2.png',  large: 'https://images.pokemontcg.io/base1/2_hires.png'  }, types: ['Water'],     rarity: 'Holo Rare' },
  { id: 'base1-15', name: 'Venusaur',   hp: 100, images: { small: 'https://images.pokemontcg.io/base1/15.png', large: 'https://images.pokemontcg.io/base1/15_hires.png' }, types: ['Grass'],     rarity: 'Holo Rare' },
  { id: 'base1-58', name: 'Pikachu',    hp:  40, images: { small: 'https://images.pokemontcg.io/base1/58.png', large: 'https://images.pokemontcg.io/base1/58_hires.png' }, types: ['Lightning'], rarity: 'Common' },
  { id: 'base1-10', name: 'Mewtwo',     hp:  60, images: { small: 'https://images.pokemontcg.io/base1/10.png', large: 'https://images.pokemontcg.io/base1/10_hires.png' }, types: ['Psychic'],   rarity: 'Rare Holo' },
  { id: 'base1-8',  name: 'Machamp',    hp: 100, images: { small: 'https://images.pokemontcg.io/base1/8.png',  large: 'https://images.pokemontcg.io/base1/8_hires.png'  }, types: ['Fighting'],  rarity: 'Holo Rare' },
  { id: 'base2-20', name: 'Gengar',     hp:  80, images: { small: 'https://images.pokemontcg.io/base2/20.png', large: 'https://images.pokemontcg.io/base2/20_hires.png' }, types: ['Psychic'],   rarity: 'Rare' },
  { id: 'base4-4',  name: 'Dragonite',  hp: 100, images: { small: 'https://images.pokemontcg.io/base4/4.png',  large: 'https://images.pokemontcg.io/base4/4_hires.png'  }, types: ['Colorless'], rarity: 'Rare Holo' },
  { id: 'base1-7',  name: 'Hitmonchan', hp:  70, images: { small: 'https://images.pokemontcg.io/base1/7.png',  large: 'https://images.pokemontcg.io/base1/7_hires.png'  }, types: ['Fighting'],  rarity: 'Uncommon' },
  { id: 'base1-3',  name: 'Chansey',    hp: 120, images: { small: 'https://images.pokemontcg.io/base1/3.png',  large: 'https://images.pokemontcg.io/base1/3_hires.png'  }, types: ['Colorless'], rarity: 'Uncommon' },
  { id: 'base1-1',  name: 'Alakazam',   hp:  80, images: { small: 'https://images.pokemontcg.io/base1/1.png',  large: 'https://images.pokemontcg.io/base1/1_hires.png'  }, types: ['Psychic'],   rarity: 'Holo Rare' },
  { id: 'base1-6',  name: 'Gyarados',   hp: 100, images: { small: 'https://images.pokemontcg.io/base1/6.png',  large: 'https://images.pokemontcg.io/base1/6_hires.png'  }, types: ['Water'],     rarity: 'Holo Rare' },
  { id: 'base1-26', name: 'Dratini',    hp:  40, images: { small: 'https://images.pokemontcg.io/base1/26.png', large: 'https://images.pokemontcg.io/base1/26_hires.png' }, types: ['Colorless'], rarity: 'Common' },
  { id: 'base1-56', name: 'Onix',       hp:  90, images: { small: 'https://images.pokemontcg.io/base1/56.png', large: 'https://images.pokemontcg.io/base1/56_hires.png' }, types: ['Fighting'],  rarity: 'Uncommon' },
  { id: 'base1-54', name: 'Jigglypuff', hp:  60, images: { small: 'https://images.pokemontcg.io/base1/54.png', large: 'https://images.pokemontcg.io/base1/54_hires.png' }, types: ['Colorless'], rarity: 'Common' },
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
  const uidRef         = useRef('');   // Firebase user ID, kept out of state to avoid re-renders

  // Game
  const [allCards, setAllCards]     = useState<PokemonCard[]>([]);
  const [deck, setDeck]             = useState<PokemonCard[]>([]);
  const [playerHand, setPlayerHand] = useState<PokemonCard[]>([]);
  const [dealerHand, setDealerHand] = useState<PokemonCard[]>([]);
  const [chips, setChips]           = useState(1000);
  const [lastDailyBonus, setLastDailyBonus] = useState('');
  const [bet, setBet]               = useState(0);
  const [message, setMessage]       = useState('');
  const [messageType, setMessageType] = useState<'win'|'lose'|'bust'|'push'|''>('');
  const [displayedPlayerTotal, setDisplayedPlayerTotal] = useState(0);

  // Dex
  const [dex, setDex]                       = useState<DexEntry[]>([]);
  const [pendingDexCards, setPendingDexCards] = useState<PokemonCard[]>([]);
  const isDexEligibleRef = useRef(false);
  const [dexPicksLeft, setDexPicksLeft]     = useState(0);
  const [seenPokemon, setSeenPokemon]       = useState<string[]>([]);
  const [newCatchCount, setNewCatchCount]   = useState(0);
  const dexBtnRef        = useRef<HTMLButtonElement>(null);
  const [flyingCard, setFlyingCard] = useState<{src: string; fromX: number; fromY: number; toX: number; toY: number} | null>(null);

  // Hall of Fame
  const [hallOfFame, setHallOfFame]   = useState<HallOfFameEntry[]>([]);
  const [personalHof, setPersonalHof] = useState<HallOfFameEntry[]>([]);
  const [logoutConfirm, setLogoutConfirm] = useState(false);

  // ── Firebase auth state listener — restores session on refresh ────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      const uid = user.uid;
      const displayName = user.displayName || 'Trainer';

      // Subscribe to real-time data changes (cross-device sync)
      const unsubData = subscribeToUserData(uid, (data) => {
        const dexData = data.dex ?? [];
        const seenData = data.seenPokemon ?? [];
        // Merge caught into seen
        const caughtNames = new Set(dexData.map((d: DexEntry) => d.name));
        const mergedSeen = Array.from(new Set([...seenData, ...caughtNames]));
        setChips(data.chips);
        setLastDailyBonus(data.lastDailyBonus ?? '');
        setPersonalHof(data.personalHof ?? []);
        setDex(dexData);
        setSeenPokemon(mergedSeen);
      });

      // Also do an immediate fetch for initial render
      const data = await getUserData(uid);
      const dexData = data.dex ?? [];
      const seenData = data.seenPokemon ?? [];

      // Migration: ensure all caught Pokemon are also in seen list
      const caughtNames = new Set(dexData.map((d: DexEntry) => d.name));
      const mergedSeen = Array.from(new Set([...seenData, ...caughtNames]));
      if (mergedSeen.length !== seenData.length) {
        updateUserData(uid, { seenPokemon: mergedSeen }).catch(() => {});
      }

      setCurrentUser(displayName);
      setChips(data.chips);
      setLastDailyBonus(data.lastDailyBonus ?? '');
      setPersonalHof(data.personalHof ?? []);
      setDex(dexData);
      setSeenPokemon(mergedSeen);
      uidRef.current = uid;
      setGameState('loading');

      // Return cleanup
      return () => unsubData();
    });
    return () => unsub();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Global HoF — loaded from localStorage (shared across accounts) ────────
  useEffect(() => {
    try {
      const cached = JSON.parse(localStorage.getItem('pkmbkj-hof') ?? '[]');
      setHallOfFame(cached);
    } catch { /* ignore */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync game state to Firestore on every change ──────────────────────────
  useEffect(() => {
    if (!currentUser || !uidRef.current) return;
    // Update localStorage as offline cache
    const users = loadUsers();
    if (users[currentUser]) {
      users[currentUser].chips          = chips;
      users[currentUser].lastDailyBonus = lastDailyBonus;
      users[currentUser].personalHof    = personalHof;
      users[currentUser].dex            = dex;
      saveUsers(users);
    }
    // Sync to Firestore (real-time — other devices see changes immediately)
    updateUserData(uidRef.current, { chips, lastDailyBonus, personalHof, dex, seenPokemon })
      .catch(() => { /* silent — localStorage is the fallback */ });
  }, [chips, lastDailyBonus, dex, personalHof, seenPokemon, currentUser]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── Persist shoe on every deck change (prevents refresh abuse) ──────────
  useEffect(() => {
    if (deck.length > 0) saveShoeCache(deck);
  }, [deck]); // eslint-disable-line react-hooks/exhaustive-deps

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

    try {
      // Firebase Auth — login or create account
      const { user, data, isNew } = await firebaseLogin(authUsername.trim(), authPassword);
      const uid = user.uid;

      let startChips     = data.chips;
      let startLastBonus = data.lastDailyBonus ?? '';
      let startPersonal  = data.personalHof ?? [];
      let startDex       = data.dex ?? [];
      let bonusMsg = '';

      if (isNew) {
        bonusMsg = "Welcome, Trainer! You're starting with $1,000.";
      } else if (canClaimBonus(startLastBonus)) {
        startChips += 100;
        startLastBonus = new Date().toISOString();
        bonusMsg = 'Daily bonus — +$100 added to your stack!';
        // Persist bonus claim immediately to Firestore
        await updateUserData(uid, { chips: startChips, lastDailyBonus: startLastBonus });
      }

      // Persist to localStorage as offline cache
      const users = loadUsers();
      users[authUsername.trim()] = {
        passwordHash: hashPassword(authPassword),
        chips: startChips, lastDailyBonus: startLastBonus,
        personalHof: startPersonal, dex: startDex,
      };
      saveUsers(users);

      uidRef.current = uid;
      loginBonusRef.current = bonusMsg;
      setCurrentUser(user.displayName || authUsername.trim());
      setChips(startChips);
      setLastDailyBonus(startLastBonus);
      setPersonalHof(startPersonal);
      setDex(startDex);
      setAuthError('');
      setAuthLoading(false);
      setGameState('loading');
    } catch (err: any) {
      // Firebase auth errors
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential' || err.code === 'auth/invalid-login-credentials') {
        setAuthError('Incorrect password.');
      } else if (err.code === 'auth/email-already-in-use') {
        setAuthError('Username already taken. Try a different name.');
      } else if (err.code === 'auth/weak-password') {
        setAuthError('Password must be at least 6 characters.');
      } else {
        setAuthError('Login failed. Check your connection and try again.');
      }
      setAuthLoading(false);
    }
  };

  // ── Fetch cards ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (gameState !== 'loading') return;
    const fetchCards = async () => {
      // Warm up the Pokémon name cache in parallel
      getAllPokemonNames();

      // Use cached cards if fresh (skips API call on refresh)
      const cached = loadCardCache();
      if (cached && cached.length >= 100) {
        setAllCards(cached);
        // Restore persisted shoe; only build a new one if none exists
        setDeck(loadShoeCache() ?? buildShoe(cached));
        setMessage(loginBonusRef.current || 'Place your bet!');
        loginBonusRef.current = '';
        setGameState('betting');
        return;
      }

      try {
        const fetchPage = (p: number) =>
          fetch(`https://api.pokemontcg.io/v2/cards?q=supertype:pokemon&pageSize=250&page=${p}`).then(r => r.json());

        // Fetch pages spread across the full catalog for maximum variety
        const p1 = await fetchPage(1);
        const totalCount: number = p1.totalCount ?? 1000;
        const maxPage = Math.ceil(totalCount / 250);

        // Fetch 10 pages spread evenly across the catalog
        const pageCount = Math.min(10, maxPage);
        const segment = Math.floor(maxPage / pageCount);
        const pages = Array.from({ length: pageCount }, (_, i) => 1 + i * segment);

        const results = await Promise.all(pages.map(p => fetchPage(p)));
        const raw: any[] = results.flatMap(r => r.data ?? []);

        // Deduplicate by unique card id (allows multiple Charizard variants from different sets)
        const seenIds = new Set<string>();
        const valid: PokemonCard[] = [];
        for (const c of raw) {
          if (!c.hp || parseInt(c.hp) <= 0 || !c.images?.small) continue;
          if (seenIds.has(c.id)) continue;
          seenIds.add(c.id);
          valid.push({
            id: c.id,
            name: c.name,
            hp: parseInt(c.hp),
            images: c.images,
            types: c.types ?? [],
            rarity: c.rarity ?? 'Common',
          });
        }
        if (valid.length < 20) throw new Error('Too few cards');
        saveCardCache(valid);
        setAllCards(valid);
        setDeck(loadShoeCache() ?? buildShoe(valid));
      } catch {
        setAllCards(FALLBACK_CARDS);
        setDeck(loadShoeCache() ?? buildShoe(FALLBACK_CARDS));
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

  // ── Track seen Pokemon ────────────────────────────────────────────────────
  const recordSeen = (cards: PokemonCard[]) => {
    setSeenPokemon(prev => {
      const set = new Set(prev);
      cards.forEach(c => set.add(c.name));
      const arr = Array.from(set);
      if (arr.length !== prev.length) {
        // Sync to Firestore immediately
        if (uidRef.current) updateUserData(uidRef.current, { seenPokemon: arr }).catch(() => {});
      }
      return arr;
    });
  };

  // ── Start game ────────────────────────────────────────────────────────────
  const startGame = () => {
    if (bet === 0) { setMessage('Set a wager before dealing.'); return; }

    // Record dex eligibility: bet must be ≥ 10% of chips BEFORE deduction
    isDexEligibleRef.current = bet >= chips * 0.1;

    const needsShuffle = deck.length < 15;
    const newDeck = needsShuffle ? buildShoe(allCards) : [...deck];
    if (needsShuffle) playShuffle();

    const p1 = newDeck.pop()!;
    const d1 = newDeck.pop()!;
    const p2 = newDeck.pop()!;
    const d2 = newDeck.pop()!;
    const d3 = newDeck.pop()!; // face-down (hole card)

    playCardDeal();
    setTimeout(() => playCardDeal(), 120);
    setTimeout(() => playCardDeal(), 240);
    setTimeout(() => playCardDeal(), 360);
    setTimeout(() => playCardDeal(), 480);
    setTimeout(() => setDisplayedPlayerTotal(calculateTotal([p1, p2])), 750);

    // Record all dealt cards as "seen" (even the hole card)
    recordSeen([p1, d1, p2, d2, d3]);

    setDeck(newDeck);
    setPlayerHand([p1, p2]);
    setDealerHand([d1, d2, d3]);
    setChips(c => c - bet);
    setPendingDexCards([]);
    setMessageType('');

    if (calculateTotal([p1, p2]) === 400) {
      setMessage('BLACKJACK! Perfect 400 HP!');
      setDexPicksLeft(2); // blackjack wins get 2 dex picks
      setGameState('dealer-turn'); // immediate — no Hit/Stand window after blackjack
    } else {
      setMessage('');
      setGameState('playing');
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
      setMessage(`Overkill! You busted at ${total} HP!`);
      setMessageType('bust');
      setGameState('game-over');
    } else if (total === 400) {
      setMessage("Perfect 400 — Gym Leader's turn.");
      setGameState('dealer-turn'); // immediate — no second Hit window at 400
    }
  };

  // ── Stand ─────────────────────────────────────────────────────────────────
  const stand = () => {
    if (gameState !== 'playing') return;
    setGameState('dealer-turn');
    setMessage("Gym Leader's turn…");
  };

  // ── Dealer turn ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (gameState !== 'dealer-turn') return;

    const dealerPlay = async () => {
      let currentDeck       = [...deck];
      let currentDealerHand = [...dealerHand];

      while (calculateTotal(currentDealerHand) <= 300 && currentDeck.length > 0) {
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
        // Global HoF — saved locally (shared across accounts on this device)
        setHallOfFame(prev => {
          const updated = [...prev, entry].sort((a, b) => b.bet - a.bet).slice(0, 10);
          localStorage.setItem('pkmbkj-hof', JSON.stringify(updated));
          return updated;
        });
        // Personal HoF (via state → triggers sync effect)
        setPersonalHof(prev => [...prev, entry].sort((a, b) => b.bet - a.bet).slice(0, 10));
      };

      // Guard: player already busted before dealer turn (shouldn't normally happen)
      if (playerTotal > 400) {
        playBust();
        setMessage(`Overkill! You busted at ${playerTotal} HP!`);
        setMessageType('bust');
        setGameState('game-over');
        return;
      }

      const isWin = dealerTotal > 400 || playerTotal > dealerTotal;

      if (dealerTotal > 400) {
        playWin();
        setMessage('Gym Leader busted! You win!');
        setMessageType('win');
        setChips(c => c + bet * 2);
      } else if (playerTotal > dealerTotal) {
        playWin();
        setMessage('Champion! You win!');
        setMessageType('win');
        setChips(c => c + bet * 2);
      } else if (dealerTotal > playerTotal) {
        playLose();
        setMessage('Gym Leader wins. Better luck next time.');
        setMessageType('lose');
      } else {
        setMessage("Standoff — it's a draw! Bet returned.");
        setMessageType('push');
        setChips(c => c + bet);
      }

      if (isWin) {
        saveWin(playerHand, bet);
        if (!isDexEligibleRef.current) {
          // Bet was under 10% of chips — ineligible
          setMessage(prev => prev + ' — Bet too small to unlock a Dex capture.');
        } else {
          // Use dex state directly (avoids stale localStorage reads)
          const eligible = playerHand.filter(c => !dex.some(d => d.name === c.name));
          if (eligible.length > 0) {
            setPendingDexCards(eligible);
            // Normal wins get 1 pick; blackjack already set 2
            if (dexPicksLeft === 0) setDexPicksLeft(1);
            setGameState('dex-select');
            return;
          }
          // All cards already caught — silently continue to game-over
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
    if (dexPicksLeft <= 0) return;

    const newEntry: DexEntry = { name: card.name, sprite: '' };
    const updatedDex = [...dex, newEntry];
    setDex(updatedDex);
    setNewCatchCount(prev => prev + 1);
    setPendingDexCards(prev => prev.filter(c => c.name !== card.name));
    setDexPicksLeft(prev => prev - 1);

    // Save immediately (without sprite), then update sprite in background
    const users = loadUsers();
    if (users[currentUser]) { users[currentUser].dex = updatedDex; saveUsers(users); }

    fetchPokemonSprite(card.name).then(sprite => {
      if (!sprite) return;
      setDex(prev => {
        const updated = prev.map(d => d.name === card.name ? { ...d, sprite } : d);
        // Update localStorage cache
        const u = loadUsers();
        if (u[currentUser]) { u[currentUser].dex = updated; saveUsers(u); }
        // Sync sprite to Firestore immediately
        if (uidRef.current) {
          updateUserData(uidRef.current, { dex: updated }).catch(() => {});
        }
        return updated;
      });
    });

    // Auto-exit dex-select when no picks left
    // Use setTimeout to let the state update propagate
    setTimeout(() => {
      setDexPicksLeft(remaining => {
        if (remaining <= 0) setGameState('game-over');
        return remaining;
      });
    }, 100);
  };

  // ── Collect daily bonus (from broke screen) ──────────────────────────────
  const collectBonus = () => {
    if (!canClaimBonus(lastDailyBonus)) return;
    const newBonus = new Date().toISOString();
    setChips(c => c + 100);
    setLastDailyBonus(newBonus);
    setMessage('Daily bonus collected! +$100 — back in the game.');
  };

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = () => {
    uidRef.current = '';
    firebaseLogout().catch(() => {});
    localStorage.removeItem('pkmbkj-session');
    setCurrentUser('');
    setChips(1000);
    setDex([]);
    setPersonalHof([]);
    setBet(0);
    setPlayerHand([]);
    setDealerHand([]);
    setMessage('');
    setMessageType('');
    setDisplayedPlayerTotal(0);
    setLastDailyBonus('');
    setLogoutConfirm(false);
    setGameState('auth');
  };
  // ── New Round ─────────────────────────────────────────────────────────────
  const newRound = () => {
    setPlayerHand([]); setDealerHand([]); setBet(0); setDisplayedPlayerTotal(0);
    setPendingDexCards([]);
    setDexPicksLeft(0);
    setMessageType('');
    setMessage(chips <= 0 ? '' : 'Place your wager!');
    setGameState('betting');
  };

  // ── Render: Auth ──────────────────────────────────────────────────────────
  if (gameState === 'auth') {
    return (
      <div className="app">
        <div className="auth-container">
          <div className="auth-panel">
            <h1 className="auth-title">Pokémon <span>Blackjack</span></h1>
            <p className="auth-subtitle">Sign in, or choose a name to join.</p>
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
                {authLoading ? 'Entering…' : 'Play'}
              </button>
            </form>
            <p className="auth-hint">No email needed — start with $1,000 and collect a $100 daily bonus.</p>
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
          <p className="loading-text">Shuffling the deck…</p>
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
    return <DexPage dex={dex} seen={seenPokemon} onBack={() => setPage('game')} />;
  }

  // ── Render: Game ──────────────────────────────────────────────────────────
  // Only show face-up cards (indices 0-1) during 'playing'; reveal full hand once dealer acts
  const dealerTotal     = gameState === 'playing'
    ? calculateTotal(dealerHand.slice(0, 2))
    : calculateTotal(dealerHand);
  const showDealerTotal = gameState !== 'betting';

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
            <button ref={dexBtnRef} className="nav-icon-btn nav-icon-img" onClick={() => { setPage('dex'); setNewCatchCount(0); }} title="My Pokédex">
              <img src={pokedexIcon} alt="Pokédex" />
              {newCatchCount > 0 && <span className="nav-badge">{newCatchCount}</span>}
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
            <p className="broke-title">Blacked Out!</p>
            {canClaimBonus(lastDailyBonus) ? (
              <>
                <p className="broke-subtitle">Your daily bonus is waiting!</p>
                <button className="btn-primary broke-btn" onClick={collectBonus}>Collect $100</button>
              </>
            ) : (
              <p className="broke-subtitle">Next bonus in <strong>{bonusCountdown(lastDailyBonus)}</strong></p>
            )}
          </div>
        )}

        {/* Play area — hidden when broke at betting screen */}
        {(chips > 0 || gameState !== 'betting') && <>

          {/* Gym Leader */}
          <div className="panel">
            <div className="panel-label">
              Gym Leader
              <span className={`total-badge${showDealerTotal ? '' : ' hidden'}`}>
                {dealerTotal} HP{gameState === 'playing' ? ' + ?' : ''}
              </span>
            </div>
            <div className="hand">
              {dealerHand.map((card, idx) => (
                <div key={card.id + idx} className={`card${card.rarity && (card.rarity.includes('Holo') || card.rarity.includes('Secret')) ? ' holo' : ''}`}
                  style={{ '--deal-delay': `${0.12 + idx * 0.24}s` } as React.CSSProperties}>
                  {gameState === 'playing' && idx === 2 ? (
                    <div className="card-back">
                      <div className="card-back-ball" />
                    </div>
                  ) : (
                    <>
                      <div className="card-top-bar">
                        <div className="card-types">
                          {card.types?.map(t => (
                            <span key={t} className={`type-icon type-${t.toLowerCase()}`} title={t}>
                              {t[0]}
                            </span>
                          ))}
                        </div>
                        {card.rarity && (
                          <span className={`rarity-badge rarity-${getRarityClass(card.rarity)}`}>
                            {card.rarity}
                          </span>
                        )}
                      </div>
                      <img src={card.images.small} alt={card.name} className="card-image" />
                      <span className={`card-hp${card.hp <= 60 ? ' hp-low' : card.hp <= 120 ? ' hp-mid' : ' hp-high'}`}>{card.hp} HP</span>
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
              <span className={`total-badge${displayedPlayerTotal ? '' : ' hidden'}${displayedPlayerTotal === 400 ? ' perfect' : displayedPlayerTotal >= 381 ? ' danger' : displayedPlayerTotal >= 320 ? ' caution' : ''}`}>{displayedPlayerTotal} HP</span>
            </div>
            <div className="hand">
              {playerHand.map((card, idx) => {
                const isDexPending = gameState === 'dex-select' && pendingDexCards.some(c => c.name === card.name) && dexPicksLeft > 0;
                return (
                  <div
                    key={card.id + idx}
                    className={`card${isDexPending ? ' dex-eligible' : ''}${card.rarity && (card.rarity.includes('Holo') || card.rarity.includes('Secret')) ? ' holo' : ''}`}
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
                    }}
                    style={{ '--deal-delay': `${idx < 2 ? idx * 0.24 : 0}s` } as React.CSSProperties}
                  >
                    <div className="card-top-bar">
                      <div className="card-types">
                        {card.types?.map(t => (
                          <span key={t} className={`type-icon type-${t.toLowerCase()}`} title={t}>
                            {t[0]}
                          </span>
                        ))}
                      </div>
                      {card.rarity && (
                        <span className={`rarity-badge rarity-${getRarityClass(card.rarity)}`}>
                          {card.rarity}
                        </span>
                      )}
                    </div>
                    <img src={card.images.small} alt={card.name} className="card-image" />
                    <span className={`card-hp${card.hp <= 60 ? ' hp-low' : card.hp <= 120 ? ' hp-mid' : ' hp-high'}`}>{card.hp} HP</span>
                    {isDexPending && <span className="dex-capture-badge">+ DEX</span>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Message */}
          {message && (
            <div className={`message-panel${messageType ? ' outcome-' + messageType : ''}`}>
              <p className="message-text">{message}</p>
            </div>
          )}

          {/* Controls */}
          <div className="controls-panel">
            {gameState === 'betting' && (
              <>
                <div className="bet-summary">
                  <span className="bet-display">
                    {bet > 0
                      ? <>Wager: <strong>${bet}</strong></>
                      : <span className="bet-empty">No wager yet</span>}
                  </span>
                  {bet > 0 && <button className="clear-btn" onClick={clearBet}>Clear</button>}
                </div>
                <div className="bet-row">
                  {[10, 25, 50, 100].map(amount => (
                    <button key={amount} className="chip-btn"
                      onClick={() => placeBet(amount)} disabled={bet + amount > chips}>
                      +${amount}
                    </button>
                  ))}
                </div>
                <p className="dex-threshold-hint">
                  {bet >= chips * 0.1
                    ? <span className="dex-unlocked">🎴 Dex capture unlocked</span>
                    : `Bet $${Math.ceil(chips * 0.1)}+ to unlock Dex capture`}
                </p>
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
              <p className="bet-display">Gym Leader draws…</p>
            )}

            {gameState === 'dex-select' && (
              <>
                <p className="dex-select-prompt">
                  {dexPicksLeft >= 2 ? (
                    <>🎉 <strong>BLACKJACK BONUS!</strong> You can pick <span className="dex-select-highlight">2 cards</span> for your Pokédex!</>
                  ) : (
                    <>Tap a <span className="dex-select-highlight">glowing card</span> to register it in your Pokédex. <span className="dex-picks-left">({dexPicksLeft} pick{dexPicksLeft !== 1 ? 's' : ''} left)</span></>
                  )}
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
                    <p className="broke-title">Bankrupt!</p>
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
                  Rematch
                </button>
              );
            })()}
          </div>

        </>}

        {(gameState === 'playing' || gameState === 'dealer-turn') && (
          <p className="footer">{deck.length} cards remaining</p>
        )}

      </div>
    </div>
  );
}

export default App;
