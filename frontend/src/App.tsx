import React, { useState, useEffect, useRef } from 'react';
import pokedexIcon from './assets/pokedex.png';
import './App.css';
import { playCardDeal, playShuffle, playWin, playLose, playBust, playChipClick } from './sounds';
import HofPage, { HallOfFameEntry } from './HofPage';
import DexPage, { DexEntry } from './DexPage';
import AchievementsPage from './AchievementsPage';
import { ACHIEVEMENTS, AchievementDef, UnlockedAchievement, checkWinAchievements, checkDexAchievements } from './achievements';
import { auth } from './firebase';
import { login as firebaseLogin, logout as firebaseLogout, subscribeToUserData, updateUserData, getUserData, subscribeToGlobalHof, addToGlobalHof } from './services/firebaseAuth';
import { onAuthStateChanged } from 'firebase/auth';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PokemonCard {
  id: string;
  name: string;
  hp: number;
  images: { small: string; large: string };
  types: string[];
  rarity: string;
  weaknesses?: { type: string }[];
  resistances?: { type: string }[];
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
type Page = 'game' | 'hof' | 'dex' | 'achievements';

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

// Build a fresh draw pile from the full card pool for one round.
// Every card gets a unique ID suffix so React keys never collide.
// Called at the START of each round — no caching, maximum variety.
function buildDeck(cards: PokemonCard[]): PokemonCard[] {
  return shuffleArray(cards.map((card, i) => ({ ...card, id: `${card.id}-r${i}` })));
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
// ─── Card cache ──────────────────────────────────────────────────────────────
const CARD_CACHE_VERSION = 8; // Bumped: added weaknesses/resistances fields to PokemonCard
const CARD_CACHE_KEY = 'pkmbkj-cards-v' + CARD_CACHE_VERSION;

function loadCardCache(): PokemonCard[] | null {
  try {
    const raw = localStorage.getItem(CARD_CACHE_KEY);
    if (!raw) return null;
    const { cards, fetchedAt } = JSON.parse(raw);
    if (Date.now() - fetchedAt > 6 * 60 * 60 * 1000) return null; // stale
    return cards as PokemonCard[];
  } catch { return null; }
}

function saveCardCache(cards: PokemonCard[]): void {
  try { localStorage.setItem(CARD_CACHE_KEY, JSON.stringify({ cards, fetchedAt: Date.now() })); }
  catch { /* quota exceeded — skip */ }
}

// Clean old card cache versions
(function cleanOldCardCaches() {
  try {
    for (let i = 1; i < CARD_CACHE_VERSION; i++) {
      localStorage.removeItem('pkmbkj-cards-v' + i);
    }
  } catch { /* ignore */ }
})();

// Clean up any legacy shoe cache keys left from the old shoe system
(function cleanOldShoeCaches() {
  try {
    for (let i = 1; i <= 7; i++) localStorage.removeItem('pkmbkj-shoe-v' + i);
    localStorage.removeItem('pkmbkj-shoe');
  } catch { /* ignore */ }
})();

// ── Rarity helper ─────────────────────────────────────────────────────────────
// The TCG API's `rarity` field indicates the card's rarity tier.
// We use it to apply appropriate visual effects:
// - Basic holo cards get a gold shimmer
// - Special/exalted holos (GX, V, VMAX, Full Art, Secret) get a rainbow shimmer
function getRarityClass(rarity: string): string {
  const r = rarity.toLowerCase();
  if (r.includes('secret') || r.includes('promo')) return 'secret';
  if (r.includes('holo') || r.includes('ultra rare') || r.includes('full art') || r.includes('radiant')) return 'holo';
  if (r.includes('rare')) return 'rare';
  if (r.includes('uncommon')) return 'uncommon';
  return 'common';
}

// Determine shimmer type for the card visual effect
// Returns: 'illustration' for Illustration Rares, 'rainbow' for other special holos,
//          'gold' for basic holos, '' for non-holo
function getHoloEffect(rarity: string): string {
  const r = rarity.toLowerCase();
  // Illustration Rares (SV era) — most premium effect
  if (r.includes('illustration rare') || r.includes('special illustration')) {
    return 'illustration';
  }
  // Special/exalted holos: GX, V, VMAX, VSTAR, Full Art, Secret, Radiant, Ultra Rare
  if (r.includes('gx') || r.includes('vmax') || r.includes('vstar') || r.includes('v-union') ||
      r.includes('full art') || r.includes('secret') || r.includes('ultra rare') || r.includes('radiant')) {
    return 'rainbow';
  }
  // Basic holo rares
  if (r.includes('holo')) {
    return 'gold';
  }
  return '';
}

// ── Boss fight helpers ────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  Fire:       '#FF5533',
  Water:      '#3399FF',
  Grass:      '#22BB55',
  Lightning:  '#FFD700',
  Psychic:    '#FF55AA',
  Fighting:   '#CC3311',
  Darkness:   '#5566DD',
  Metal:      '#AAAACC',
  Colorless:  '#BBAA99',
  Dragon:     '#7733EE',
  Fairy:      '#FF88CC',
};

function selectBossCard(cards: PokemonCard[]): PokemonCard {
  const isPremium = (c: PokemonCard) => {
    const r = c.rarity.toLowerCase();
    return r.includes('ex') || r.includes('gx') || r.includes('vmax') || r.includes('vstar') ||
           r.includes(' v ') || r === 'v' || r.includes('illustration rare') ||
           r.includes('full art') || r.includes('secret') || r.includes('ultra rare');
  };
  const elite = cards.filter(c => isPremium(c) && c.hp >= 200);
  if (elite.length) return elite[Math.floor(Math.random() * elite.length)];
  const highHp = cards.filter(c => c.hp >= 200);
  if (highHp.length) return highHp[Math.floor(Math.random() * highHp.length)];
  const premium = cards.filter(isPremium);
  if (premium.length) return premium[Math.floor(Math.random() * premium.length)];
  return cards[Math.floor(Math.random() * cards.length)];
}

// Resolve a caught Pokémon's TCG card (for its types) by matching dex name against allCards
function findFighterCard(dexName: string, cards: PokemonCard[]): PokemonCard | null {
  const norm = (s: string) =>
    s.toLowerCase()
      .replace(/\s*(ex|gx|v|vmax|vstar|break|lv\.x)$/i, '')
      .replace(/[^a-z0-9]/g, '');
  const target = norm(dexName);
  return (
    cards.find(c => norm(c.name) === target) ??
    cards.find(c => norm(c.name).startsWith(target)) ??
    cards.find(c => target.startsWith(norm(c.name))) ??
    null
  );
}

const FIGHTER_POKEMON = [
  'charizard','blastoise','venusaur','pikachu','mewtwo','gengar','machamp',
  'alakazam','snorlax','dragonite','gyarados','lapras','typhlosion','feraligatr',
  'meganium','espeon','umbreon','ampharos','blaziken','swampert','sceptile',
  'gardevoir','salamence','metagross','garchomp','lucario','infernape','empoleon',
  'leafeon','glaceon','luxray','togekiss','gallade','haxorus','goodra',
];

const BOSS_FIGHTER_HP = 200;

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

  // PokeAPI lists Deoxys only as "deoxys-normal", never plain "deoxys"
  if (normalized.toLowerCase() === 'deoxys') {
    const sprite = await tryFetchSprite('deoxys-normal');
    if (sprite) return sprite;
  }

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

  // Achievements
  const [unlockedAchievements, setUnlockedAchievements] = useState<UnlockedAchievement[]>([]);
  const [newAchievements, setNewAchievements]           = useState<AchievementDef[]>([]);
  const [winStreak, setWinStreak]                       = useState(0);
  const hitCountRef       = useRef(0);    // hits taken this round (never stale in dealerPlay)
  const chipsBeforeBetRef = useRef(0);    // chips value before bet deducted in startGame
  const winStreakRef      = useRef(0);    // mirror of winStreak state for use inside effects

  // Keep winStreakRef in sync so dealerPlay (useEffect closure) always reads current value
  useEffect(() => { winStreakRef.current = winStreak; }, [winStreak]);

  // Mirror unlockedAchievements in a ref so dealerPlay closures never read stale state
  const unlockedAchievementsRef = useRef<UnlockedAchievement[]>([]);
  useEffect(() => { unlockedAchievementsRef.current = unlockedAchievements; }, [unlockedAchievements]);

  // Boss fight
  const [bossChallenging, setBossChallenging]       = useState(false);
  const [bossActive, setBossActive]                 = useState(false);
  const [bossCard, setBossCard]                     = useState<PokemonCard | null>(null);
  const [bossCurrentHp, setBossCurrentHp]           = useState(0);
  const [bossMaxHp, setBossMaxHp]                   = useState(0);
  const [fighterName, setFighterName]               = useState('');
  const [fighterSprite, setFighterSprite]           = useState('');
  const [fighterCurrentHp, setFighterCurrentHp]     = useState(0);
  const [fighterMaxHp, setFighterMaxHp]             = useState(BOSS_FIGHTER_HP);
  const [bossResult, setBossResult]                 = useState<'victory' | 'defeat' | null>(null);
  const [bossHandDamage, setBossHandDamage]         = useState<{ type: 'boss' | 'player'; amount: number } | null>(null);
  const [bossEffectiveness, setBossEffectiveness]   = useState<'super' | 'resist' | 'normal' | null>(null);
  const [dominantType, setDominantType]             = useState<string | null>(null);
  const [fighterTypes, setFighterTypes]             = useState<string[]>([]);
  const [bossAttacking, setBossAttacking]           = useState(false);
  const [fighterHit, setFighterHit]                 = useState(false);
  const [bossVictoryHand, setBossVictoryHand]       = useState<PokemonCard[]>([]);
  const [bossVictoryPicked, setBossVictoryPicked]   = useState(false);
  const bossActiveRef       = useRef(false);
  const bossCurrentHpRef    = useRef(0);
  const bossMaxHpRef        = useRef(0);
  const fighterCurrentHpRef = useRef(0);
  const bossResultRef       = useRef<'victory' | 'defeat' | null>(null);
  const bossCardRef         = useRef<PokemonCard | null>(null);
  const bossCardPanelRef    = useRef<HTMLImageElement>(null);

  // Flying card animation when boss card is auto-captured on victory
  useEffect(() => {
    if (bossResult !== 'victory') return;
    const bossEl = bossCardPanelRef.current;
    const dexEl  = dexBtnRef.current;
    if (!bossEl || !dexEl || !bossCardRef.current) return;
    const bossRect = bossEl.getBoundingClientRect();
    const dexRect  = dexEl.getBoundingClientRect();
    setFlyingCard({
      src:   bossCardRef.current.images.small,
      fromX: bossRect.left + bossRect.width  / 2,
      fromY: bossRect.top  + bossRect.height / 2,
      toX:   dexRect.left  + dexRect.width   / 2,
      toY:   dexRect.top   + dexRect.height  / 2,
    });
  }, [bossResult]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-dismiss achievement toast after 4 seconds
  useEffect(() => {
    if (newAchievements.length === 0) return;
    const t = setTimeout(() => setNewAchievements([]), 3900);
    return () => clearTimeout(t);
  }, [newAchievements]);

  // ── Firebase auth state listener — restores session on refresh ────────────
  useEffect(() => {
    // Keep the data unsubscribe function in a local variable so it can be
    // cleaned up both when auth state changes AND when the component unmounts.
    // NOTE: the onAuthStateChanged callback must NOT be async — if it returns
    // a Promise instead of a cleanup function, React ignores it and the
    // Firestore listener leaks.
    let unsubData: (() => void) | null = null;

    const unsub = onAuthStateChanged(auth, (user) => {
      // Tear down any previous user's data listener immediately
      if (unsubData) { unsubData(); unsubData = null; }
      if (!user) return;

      const uid = user.uid;
      const displayName = user.displayName || 'Trainer';

      // Subscribe to real-time data changes (cross-device sync)
      unsubData = subscribeToUserData(uid, (data) => {
        const dexData = data.dex ?? [];
        const seenData = data.seenPokemon ?? [];
        const caughtNames = Array.from(new Set(dexData.map((d: DexEntry) => d.name)));
        const mergedSeen = Array.from(new Set([...seenData, ...caughtNames]));
        setChips(data.chips);
        setLastDailyBonus(data.lastDailyBonus ?? '');
        setPersonalHof(data.personalHof ?? []);
        setDex(dexData);
        setSeenPokemon(mergedSeen);
      });

      // Async initial fetch — fire-and-forget (do NOT make the outer callback async)
      (async () => {
        const data = await getUserData(uid);
        const dexData = data.dex ?? [];
        const seenData = data.seenPokemon ?? [];

        // Migration: ensure all caught Pokemon are also in seen list
        const caughtNames = Array.from(new Set(dexData.map((d: DexEntry) => d.name)));
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
        setUnlockedAchievements(data.unlockedAchievements ?? []);
        setWinStreak(data.winStreak ?? 0);
        uidRef.current = uid;
        setGameState('loading');
      })();
    });

    return () => {
      unsub();
      if (unsubData) unsubData();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Global HoF — real-time Firestore subscription (all players, weekly reset) ─
  useEffect(() => {
    if (!currentUser) return;
    const unsub = subscribeToGlobalHof(entries => setHallOfFame(entries));
    return () => unsub();
  }, [currentUser]); // eslint-disable-line react-hooks/exhaustive-deps

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
    updateUserData(uidRef.current, { chips, lastDailyBonus, personalHof, dex, seenPokemon, unlockedAchievements, winStreak })
      .catch(() => { /* silent — localStorage is the fallback */ });
  }, [chips, lastDailyBonus, dex, personalHof, seenPokemon, unlockedAchievements, winStreak, currentUser]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Re-fetch missing sprites for HoF entries when board updates ─────────
  useEffect(() => {
    if (hallOfFame.length === 0) return;
    if (hallOfFame.every(e => e.sprites.every(s => s))) return; // all present
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
      if (changed) setHallOfFame(entries);
    };
    refetch();
  }, [hallOfFame.length]); // eslint-disable-line react-hooks/exhaustive-deps

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
        bonusMsg = 'Daily bonus! +$100 Pokédollars — ready to battle!';
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
      if (cached && cached.length >= 100 && cached[0].types) {
        setAllCards(cached);
        // Deck is built fresh each round in startGame — nothing to set here
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
        const totalCount: number = p1.totalCount ?? 2000;
        const maxPage = Math.max(2, Math.ceil(totalCount / 250));

        // Pick 14 additional pages spread randomly across the full catalog (15 total = ~3750 cards)
        // Random distribution ensures different cards every session
        const picks = new Set<number>([1]);
        const segments = 14;
        const segment = Math.max(1, Math.floor(maxPage / segments));
        for (let i = 0; i < segments; i++) {
          const base = i * segment + 2;
          picks.add(Math.min(maxPage, base + Math.floor(Math.random() * Math.max(1, segment))));
        }
        picks.delete(1); // already have p1

        const extras = await Promise.all(Array.from(picks).map(p => fetchPage(p)));
        const raw: any[] = (p1.data ?? []).concat(...extras.map((r: any) => r.data ?? []));
        // Deduplicate by card ID — allows multiple variants of the same Pokémon (different sets)
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
            weaknesses:  (c.weaknesses  ?? []).map((w: any) => ({ type: w.type })),
            resistances: (c.resistances ?? []).map((r: any) => ({ type: r.type })),
          });
        }
        if (valid.length < 20) throw new Error('Too few cards');
        saveCardCache(valid);
        setAllCards(valid);
      } catch {
        setAllCards(FALLBACK_CARDS);
      }
      setMessage(loginBonusRef.current || 'Place your bet!');
      loginBonusRef.current = '';
      setGameState('betting');
    };
    fetchCards();
  }, [gameState]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Betting ───────────────────────────────────────────────────────────────
  const placeBet = (amount: number) => {
    if (bet + amount > chips) return;
    playChipClick();
    setBet(prev => prev + amount);
  };
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
    if (bet === 0 && !bossActiveRef.current) { setMessage('Place a bet first!'); return; }

    // Reset picks unconditionally so no stale value from a prior round leaks in
    setDexPicksLeft(0);
    // Capture chips before deduction (for All In / Loan Shark achievement checks)
    chipsBeforeBetRef.current = chips;
    // Reset hit counter for this round
    hitCountRef.current = 0;

    // Dex capture disabled during boss fight (boss victory gives special reward instead)
    isDexEligibleRef.current = !bossActiveRef.current && (bet >= chips * 0.1);

    // Always build a fresh deck from the full card pool — no shoe caching
    const newDeck = buildDeck(allCards);
    playShuffle();

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
    if (!bossActiveRef.current) setChips(c => c - bet);
    setPendingDexCards([]);
    setMessageType('');

    const initialTotal = calculateTotal([p1, p2]);
    if (initialTotal === 400) {
      setMessage('BLACKJACK! Perfect 400 HP!');
      setDexPicksLeft(2); // blackjack wins get 2 dex picks
      setGameState('dealer-turn'); // immediate — no Hit/Stand window after blackjack
    } else if (initialTotal > 400) {
      // Two high-HP cards (e.g. two VMAX) can bust on the initial deal
      setTimeout(() => playBust(), 120);
      setWinStreak(0);
      winStreakRef.current = 0;
      if (bossActiveRef.current) {
        applyBossPlayerDamage();
        setMessage('Busted! The boss counters!');
      } else {
        setMessage(`Overkill! Busted on the deal at ${initialTotal} HP!`);
      }
      setMessageType('bust');
      setGameState('game-over');
    } else {
      setMessage('');
      setGameState('playing');
    }
  };

  // Helper: apply boss damage to player fighter (called from bust paths and dealerPlay)
  const applyBossPlayerDamage = () => {
    if (!bossActiveRef.current || bossResultRef.current !== null) return;
    const dmg   = 30 + Math.floor(Math.random() * 25);
    const newHp = Math.max(0, fighterCurrentHpRef.current - dmg);
    fighterCurrentHpRef.current = newHp;
    setFighterCurrentHp(newHp);
    setBossHandDamage({ type: 'player', amount: dmg });
    setFighterHit(true);
    if (newHp <= 0) {
      bossResultRef.current = 'defeat';
      setBossResult('defeat');
    }
  };

  // ── Hit ───────────────────────────────────────────────────────────────────
  const hit = () => {
    if (gameState !== 'playing') return;
    hitCountRef.current++;
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
      setWinStreak(0);
      winStreakRef.current = 0;
      if (bossActiveRef.current) {
        applyBossPlayerDamage();
        setMessage('Busted! The boss counters!');
      } else {
        setMessage(`Overkill! You busted at ${total} HP!`);
      }
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
        // Global HoF — write to Firestore; subscription updates local state
        addToGlobalHof(entry).catch(() => {});
        // Personal HoF (via state → triggers sync effect)
        setPersonalHof(prev => [...prev, entry].sort((a, b) => b.bet - a.bet || Number(b.id) - Number(a.id)).slice(0, 10));
      };

      const isWin  = dealerTotal > 400 || playerTotal > dealerTotal;
      const isPush = !isWin && dealerTotal === playerTotal;

      if (dealerTotal > 400) {
        playWin();
        setMessage(bossActiveRef.current ? 'Direct hit! Boss stumbled!' : 'Gym Leader busted! You win!');
        setMessageType('win');
        if (!bossActiveRef.current) setChips(c => c + bet * 2);
      } else if (playerTotal > dealerTotal) {
        playWin();
        setMessage(bossActiveRef.current ? 'Strike! You hit the boss!' : 'Champion! You win!');
        setMessageType('win');
        if (!bossActiveRef.current) setChips(c => c + bet * 2);
      } else if (dealerTotal > playerTotal) {
        playLose();
        setMessage(bossActiveRef.current ? 'The boss counters!' : 'Gym Leader wins! Train harder next time.');
        setMessageType('lose');
        setDexPicksLeft(0); // clear any blackjack pre-set picks on a non-win
        if (!bossActiveRef.current) {
          setWinStreak(0);
          winStreakRef.current = 0;
        }
      } else {
        setMessage(bossActiveRef.current ? 'Tied — no damage!' : "It's a tie! Bet returned.");
        setMessageType('push');
        setDexPicksLeft(0); // clear any blackjack pre-set picks on a non-win
        if (!bossActiveRef.current) {
          setChips(c => c + bet);
          // Pushes don't break streak — neutral outcome
        }
      }

      // ── Boss fight damage ─────────────────────────────────────────────────
      if (bossActiveRef.current && bossResultRef.current === null) {
        if (isWin) {
          // Determine dominant attack type + effectiveness vs boss
          const playerTypes = playerHand.flatMap(c => c.types);
          const typeCounts  = playerTypes.reduce<Record<string, number>>(
            (acc, t) => { acc[t] = (acc[t] ?? 0) + 1; return acc; }, {}
          );
          const dominant = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
          setDominantType(dominant);

          const bossWeaks  = (bossCardRef.current?.weaknesses  ?? []).map(w => w.type);
          const bossResist = (bossCardRef.current?.resistances ?? []).map(r => r.type);
          const eff: 'super' | 'resist' | 'normal' =
            dominant && bossWeaks.includes(dominant)  ? 'super'
          : dominant && bossResist.includes(dominant) ? 'resist'
          : 'normal';
          setBossEffectiveness(eff);

          const base     = Math.floor(bossMaxHpRef.current / 5);
          const variance = Math.max(1, Math.floor(bossMaxHpRef.current / 10));
          let   dmg      = base + Math.floor(Math.random() * variance);
          if (eff === 'super')  dmg = Math.floor(dmg * 2.0);
          if (eff === 'resist') dmg = Math.floor(dmg * 0.75);

          const newHp = Math.max(0, bossCurrentHpRef.current - dmg);
          bossCurrentHpRef.current = newHp;
          setBossCurrentHp(newHp);
          setBossHandDamage({ type: 'boss', amount: dmg });
          if (newHp <= 0) {
            bossResultRef.current = 'victory';
            setBossResult('victory');
            setBossVictoryHand([...playerHand]);
            // Auto-add boss card to dex immediately
            if (bossCardRef.current) {
              const cap = bossCardRef.current;
              const entry: DexEntry = { name: cap.name, sprite: '', boss: true };
              setDex(prev => [...prev, entry]);
              setNewCatchCount(p => p + 1);
              fetchPokemonSprite(cap.name).then(sp => {
                if (sp) setDex(prev => prev.map(d => d.name === cap.name ? { ...d, sprite: sp } : d));
              });
            }
          }
        } else if (!isPush) {
          setBossAttacking(true);
          applyBossPlayerDamage();
        }
      }

      if (isWin && !bossActiveRef.current) {
        // Increment streak before achievement check so streak achievements trigger correctly
        const newStreak = winStreakRef.current + 1;
        winStreakRef.current = newStreak;
        setWinStreak(newStreak);

        // Trigger boss challenge every 3rd win
        if (newStreak % 3 === 0) {
          const challengeCard = selectBossCard(allCards);
          bossCardRef.current = challengeCard;
          setBossCard(challengeCard);
          setBossChallenging(true);
        }

        // Check win achievements
        const ctx = {
          hand:                playerHand.map(c => ({ name: c.name, hp: c.hp, types: c.types, rarity: c.rarity, id: c.id })),
          playerTotal,
          dealerTotal,
          dealerBusted:        dealerTotal > 400,
          bet,
          chipsBeforeBet:      chipsBeforeBetRef.current,
          chipsAfterWin:       chipsBeforeBetRef.current + bet,
          isBlackjack:         playerHand.length === 2 && playerTotal === 400,
          hitCount:            hitCountRef.current,
          winStreak:           newStreak,
          dealerFinalHandSize: currentDealerHand.length,
        };
        const justEarned = checkWinAchievements(ctx, unlockedAchievementsRef.current);
        if (justEarned.length > 0) {
          const now = new Date().toISOString();
          const newEntries = justEarned.map(id => ({ id, unlockedAt: now }));
          setUnlockedAchievements(prev => [...prev, ...newEntries]);
          setNewAchievements(ACHIEVEMENTS.filter(a => justEarned.includes(a.id)));
        }

        saveWin(playerHand, bet);
        if (!isDexEligibleRef.current) {
          // Bet was under 10% of chips — ineligible
          setMessage(prev => prev + ' — Bet was too small for Dex eligibility.');
        } else {
          // Use dex state directly (avoids stale localStorage reads)
          const eligible = playerHand;
          if (eligible.length > 0) {
            setPendingDexCards(eligible);
            // Normal wins get 1 pick; blackjack already set 2
            // Use functional updater to avoid stale closure — the dealer-turn
            // effect only lists [gameState] in its deps, so dexPicksLeft read
            // directly from closure may be the previous round's value (0).
            setDexPicksLeft(prev => prev === 0 ? 1 : prev);
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
    if (dexPicksLeft <= 0) return;

    const newPicksLeft = dexPicksLeft - 1;

    const newEntry: DexEntry = { name: card.name, sprite: '' };
    const updatedDex = [...dex, newEntry];
    setDex(updatedDex);
    setNewCatchCount(prev => prev + 1);
    setPendingDexCards(prev => prev.filter(c => c.id !== card.id));
    setDexPicksLeft(newPicksLeft);

    // Check dex milestone achievements
    const uniqueDexSize = new Set(updatedDex.map(d => d.name)).size;
    const allDexNames   = updatedDex.map(d => d.name);
    const dexEarned = checkDexAchievements(uniqueDexSize, updatedDex.length, allDexNames, unlockedAchievements);
    if (dexEarned.length > 0) {
      const now = new Date().toISOString();
      const newEntries = dexEarned.map(id => ({ id, unlockedAt: now }));
      setUnlockedAchievements(prev => {
        const merged = [...prev, ...newEntries];
        // Queue notification (append to any already showing)
        setNewAchievements(existing => [...existing, ...ACHIEVEMENTS.filter(a => dexEarned.includes(a.id))]);
        return merged;
      });
    }

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

    // Auto-exit dex-select when all picks used
    if (newPicksLeft <= 0) {
      setTimeout(() => setGameState('game-over'), 100);
    }
  };

  // ── Collect daily bonus (from broke screen) ──────────────────────────────
  const collectBonus = () => {
    if (!canClaimBonus(lastDailyBonus)) return;
    const newBonus = new Date().toISOString();
    setChips(c => c + 100);
    setLastDailyBonus(newBonus);
    setMessage('Daily bonus! +$100 Pokédollars — back in action!');
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
    setSeenPokemon([]);
    setUnlockedAchievements([]);
    setWinStreak(0);
    winStreakRef.current = 0;
    setNewAchievements([]);
    bossActiveRef.current = false;
    setBossActive(false);
    bossResultRef.current = null;
    setBossResult(null);
    bossCardRef.current = null;
    setBossCard(null);
    setBossChallenging(false);
    setBossHandDamage(null);
    setLogoutConfirm(false);
    setGameState('auth');
  };
  // ── New Round ─────────────────────────────────────────────────────────────
  const newRound = () => {
    setPlayerHand([]); setDealerHand([]); setBet(0); setDisplayedPlayerTotal(0);
    setPendingDexCards([]);
    setDexPicksLeft(0);
    setMessageType('');
    setMessage(chips <= 0 ? '' : 'Place your bet!');
    setGameState('betting');
  };

  // ── Boss fight functions ───────────────────────────────────────────────────
  const initBossFight = () => {
    // bossCard was pre-selected when bossChallenging was triggered
    const card = bossCardRef.current!;
    // Scale boss HP independently of the card's blackjack value (which is too small for a sustained fight)
    const bossHp = Math.max(500, card.hp * 3);
    bossMaxHpRef.current = bossHp;
    setBossMaxHp(bossHp);
    bossCurrentHpRef.current = bossHp;
    setBossCurrentHp(bossHp);

    fighterCurrentHpRef.current = BOSS_FIGHTER_HP;
    setFighterCurrentHp(BOSS_FIGHTER_HP);
    setFighterMaxHp(BOSS_FIGHTER_HP);

    // Pick fighter from player's caught Pokémon; fall back to hardcoded list if dex is empty
    let pickedName: string;
    if (dex.length > 0) {
      const pick = dex[Math.floor(Math.random() * dex.length)];
      pickedName = pick.name;
      // If the dex entry already has a sprite, use it immediately
      if (pick.sprite) {
        setFighterSprite(pick.sprite);
      } else {
        setFighterSprite('');
        fetchPokemonSprite(pickedName).then(sp => setFighterSprite(sp));
      }
    } else {
      const slug = FIGHTER_POKEMON[Math.floor(Math.random() * FIGHTER_POKEMON.length)];
      pickedName = slug.charAt(0).toUpperCase() + slug.slice(1);
      setFighterSprite('');
      fetchPokemonSprite(pickedName).then(sp => setFighterSprite(sp));
    }
    setFighterName(pickedName);

    bossActiveRef.current = true;
    setBossActive(true);
    bossResultRef.current = null;
    setBossResult(null);
    setBossHandDamage(null);
    setBossEffectiveness(null);
    setDominantType(null);
    setFighterTypes([]);
    setBossAttacking(false);
    setBossVictoryHand([]);
    setBossVictoryPicked(false);
    setBossChallenging(false);

    // Resolve the fighter's TCG card so we can show its types
    const fighterCard = findFighterCard(pickedName, allCards);
    setFighterTypes(fighterCard?.types ?? []);

    setBet(0);
    setPlayerHand([]);
    setDealerHand([]);
    setDisplayedPlayerTotal(0);
    setPendingDexCards([]);
    setDexPicksLeft(0);
    setMessageType('');
    setMessage('The boss challenges you!');
    setGameState('betting');
  };

  const bossNextHand = () => {
    setBossHandDamage(null);
    setBossEffectiveness(null);
    setDominantType(null);
    // Do NOT clear fighterTypes — fighter doesn't change between hands
    setBossAttacking(false);
    setFighterHit(false);
    setMessage('');
    setMessageType('');
    setPlayerHand([]);
    setDealerHand([]);
    setDisplayedPlayerTotal(0);
    setPendingDexCards([]);
    setDexPicksLeft(0);
    startGame(); // bet is already 0 in boss mode; startGame allows this
  };

  const endBossFight = () => {
    bossActiveRef.current = false;
    setBossActive(false);
    bossResultRef.current = null;
    setBossResult(null);
    bossCardRef.current = null;
    setBossCard(null);
    setBossHandDamage(null);
    setBossEffectiveness(null);
    setDominantType(null);
    setFighterTypes([]);
    setBossAttacking(false);
    setBossVictoryHand([]);
    setBossVictoryPicked(false);
    setBossChallenging(false);
    // Reset streak so the fight itself doesn't re-trigger a challenge immediately
    setWinStreak(0);
    winStreakRef.current = 0;
    newRound();
  };

  const addToBossVictoryDex = (card: PokemonCard) => {
    const entry: DexEntry = { name: card.name, sprite: '' };
    const updatedDex = [...dex, entry];
    setDex(updatedDex);
    setNewCatchCount(prev => prev + 1);
    fetchPokemonSprite(card.name).then(sp => {
      if (sp) setDex(prev => prev.map(d => d.name === card.name ? { ...d, sprite: sp } : d));
    });
    // Check dex milestone achievements (was missing — boss captures never triggered them)
    const uniqueDexSize = new Set(updatedDex.map(d => d.name)).size;
    const allDexNames   = updatedDex.map(d => d.name);
    const dexEarned = checkDexAchievements(uniqueDexSize, updatedDex.length, allDexNames, unlockedAchievementsRef.current);
    if (dexEarned.length > 0) {
      const now = new Date().toISOString();
      const newEntries = dexEarned.map(id => ({ id, unlockedAt: now }));
      setUnlockedAchievements(prev => {
        setNewAchievements(existing => [...existing, ...ACHIEVEMENTS.filter(a => dexEarned.includes(a.id))]);
        return [...prev, ...newEntries];
      });
    }
  };

  // ── Render: Auth ──────────────────────────────────────────────────────────
  if (gameState === 'auth') {
    return (
      <div className="app">
        <div className="auth-container">
          <div className="auth-panel">
            <h1 className="auth-title">Pokémon <span>Blackjack</span></h1>
            <p className="auth-subtitle">Enter your Trainer name to begin your journey.</p>
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
                {authLoading ? 'Loading…' : 'Play'}
              </button>
            </form>
            <p className="auth-hint">No email needed. New Trainers start with $1,000 Pokédollars and earn a $100 daily bonus.</p>
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

  // ── Render: Achievements page ─────────────────────────────────────────────
  if (page === 'achievements') {
    return <AchievementsPage unlocked={unlockedAchievements} onBack={() => setPage('game')} />;
  }

  // ── Render: Game ──────────────────────────────────────────────────────────
  // Only show face-up cards (indices 0-1) during 'playing'; reveal full hand once dealer acts
  const dealerTotal     = gameState === 'playing'
    ? calculateTotal(dealerHand.slice(0, 2))
    : calculateTotal(dealerHand);
  const showDealerTotal = gameState !== 'betting';

  return (
    <div className="app">
      {/* Achievement unlock toast */}
      {newAchievements.length > 0 && (
        <div className="achievement-toast" onClick={() => setNewAchievements([])}>
          <span className="achievement-toast-header">🎖️ Achievement Unlocked!</span>
          {newAchievements.map(a => (
            <div key={a.id} className="achievement-toast-row">
              <span className="achievement-toast-icon">{a.icon}</span>
              <span className="achievement-toast-name">{a.name}</span>
            </div>
          ))}
        </div>
      )}

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
            <button className="nav-icon-btn" onClick={() => setPage('achievements')} title="Achievements">
              🎖️
              {newAchievements.length > 0 && <span className="nav-badge">{newAchievements.length}</span>}
            </button>
          </div>
          <div className="header-right">
            {winStreak > 0 && !bossActive && (
              <span className="streak-badge" title={`${winStreak} win streak`}>
                🔥{winStreak}
              </span>
            )}
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
        {chips < 5 && gameState === 'betting' && (
          <div className="broke-screen">
            <p className="broke-icon">💸</p>
            <p className="broke-title">Blacked Out!</p>
            {canClaimBonus(lastDailyBonus) ? (
              <>
                <p className="broke-subtitle">Your daily bonus is ready!</p>
                <button className="btn-primary broke-btn" onClick={collectBonus}>Collect $100</button>
              </>
            ) : (
              <p className="broke-subtitle">Daily bonus in <strong>{bonusCountdown(lastDailyBonus)}</strong></p>
            )}
          </div>
        )}

        {/* Play area — hidden when broke at betting screen */}
        {(chips >= 5 || gameState !== 'betting') && <>

          {/* Boss battle panel */}
          {bossActive && bossCard && (
            <div className="boss-battle-panel">
              <div className="boss-battle-header">⚔️ BOSS BATTLE</div>
              <div className="boss-combatants">

                <div className="boss-combatant">
                  <div className={`card boss-card-large${getHoloEffect(bossCard.rarity) ? ' holo-' + getHoloEffect(bossCard.rarity) : ''}${bossAttacking ? ' boss-card-hit' : ''}`}>
                    <img ref={bossCardPanelRef} src={bossCard.images.large || bossCard.images.small} alt={bossCard.name} className="card-image" />
                    {bossCard.rarity && (
                      <span className={`rarity-badge rarity-${getRarityClass(bossCard.rarity)}`}>{bossCard.rarity}</span>
                    )}
                    <span className="card-hp hp-high">{bossCard.hp} HP</span>
                  </div>
                  <div className="combatant-info">
                    <div className="combatant-name">{bossCard.name}</div>
                    {bossCard.weaknesses && bossCard.weaknesses.length > 0 && (
                      <div className="boss-weakness-line">
                        {bossCard.weaknesses.map(w => (
                          <span
                            key={w.type}
                            className="boss-weakness-badge"
                            style={{ background: (TYPE_COLORS[w.type] ?? '#888') + '33', borderColor: TYPE_COLORS[w.type] ?? '#888', color: TYPE_COLORS[w.type] ?? '#ccc' }}
                          >
                            ⚡{w.type}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="combatant-hp-bar">
                      <div
                        className="hp-bar-fill boss-hp-fill"
                        style={{ width: `${Math.max(0, (bossCurrentHp / bossMaxHp) * 100)}%` }}
                      />
                    </div>
                    <div className="combatant-hp-text">{bossCurrentHp} / {bossMaxHp} HP</div>
                  </div>
                </div>

                <div className="boss-vs">VS</div>

                <div className="boss-combatant">
                  <div className="fighter-sprite-wrap">
                    {fighterSprite
                      ? <img
                          src={fighterSprite}
                          alt={fighterName}
                          className={`fighter-sprite${fighterHit ? ' fighter-hit' : ''}`}
                          onAnimationEnd={() => setFighterHit(false)}
                        />
                      : <div className="fighter-sprite-placeholder">…</div>
                    }
                  </div>
                  {fighterTypes.length > 0 && (
                    <div className="fighter-type-badges">
                      {fighterTypes.map(t => (
                        <span
                          key={t}
                          className="fighter-type-badge"
                          style={{ background: (TYPE_COLORS[t] ?? '#888') + '33', borderColor: TYPE_COLORS[t] ?? '#888', color: TYPE_COLORS[t] ?? '#ccc' }}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="combatant-info">
                    <div className="combatant-name">{fighterName || '…'}</div>
                    <div className="combatant-hp-bar">
                      <div
                        className="hp-bar-fill player-hp-fill"
                        style={{ width: `${Math.max(0, (fighterCurrentHp / fighterMaxHp) * 100)}%` }}
                      />
                    </div>
                    <div className="combatant-hp-text">{fighterCurrentHp} / {fighterMaxHp} HP</div>
                  </div>
                </div>

              </div>
              {bossHandDamage && (
                <div className={`boss-damage-flash${bossHandDamage.type === 'boss' ? ' dmg-boss' : ' dmg-player'}`}>
                  {bossHandDamage.type === 'boss' ? (
                    <>
                      <span className="dmg-number">-{bossHandDamage.amount}</span>
                      {bossEffectiveness === 'super'  && <span className="effectiveness-text eff-super">It's super effective!</span>}
                      {bossEffectiveness === 'resist' && <span className="effectiveness-text eff-resist">Not very effective…</span>}
                    </>
                  ) : (
                    <>
                      <span className="dmg-number dmg-number-player">-{bossHandDamage.amount}</span>
                      <span className="dmg-label">{fighterName} takes a hit!</span>
                    </>
                  )}
                </div>
              )}
              {dominantType && bossHandDamage?.type === 'boss' && (
                <div
                  className={`type-attack-label${bossEffectiveness === 'super' ? ' type-attack-super' : bossEffectiveness === 'resist' ? ' type-attack-resist' : ''}`}
                  style={{ color: TYPE_COLORS[dominantType] ?? '#fff', textShadow: `0 0 20px ${TYPE_COLORS[dominantType] ?? '#fff'}, 0 0 40px ${TYPE_COLORS[dominantType] ?? '#fff'}88` }}
                >
                  {dominantType} Attack!
                </div>
              )}
            </div>
          )}

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
                <div key={card.id + idx} className={`card${getHoloEffect(card.rarity) ? ' holo-' + getHoloEffect(card.rarity) : ''}`}
                  style={{ '--deal-delay': `${0.12 + idx * 0.24}s` } as React.CSSProperties}>
                  {gameState === 'playing' && idx === 2 ? (
                    <div className="card-back">
                      <div className="card-back-ball" />
                    </div>
                  ) : (
                    <>
                      <img src={card.images.small} alt={card.name} className="card-image" />
                      {card.rarity && (
                        <span className={`rarity-badge rarity-${getRarityClass(card.rarity)}`}>
                          {card.rarity}
                        </span>
                      )}
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
                const isDuplicate  = isDexPending && dex.some(d => d.name === card.name);
                const isAttacking  = bossActive && dominantType !== null && card.types.includes(dominantType) && bossHandDamage?.type === 'boss';
                return (
                  <div
                    key={card.id + idx}
                    className={`card${isDexPending ? (isDuplicate ? ' dex-duplicate' : ' dex-eligible') : ''}${getHoloEffect(card.rarity) ? ' holo-' + getHoloEffect(card.rarity) : ''}${isAttacking ? ' card-attacking' : ''}`}
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
                    style={{
                      '--deal-delay': `${idx < 2 ? idx * 0.24 : 0}s`,
                      ...(bossActive && gameState === 'game-over' && bossHandDamage?.type === 'boss' && dominantType && card.types.includes(dominantType)
                        ? { boxShadow: `0 0 0 3px ${TYPE_COLORS[dominantType] ?? '#ffffff'}, 0 0 18px ${TYPE_COLORS[dominantType] ?? '#ffffff'}99, 0 0 4px rgba(0,0,0,0.8)` }
                        : {}),
                    } as React.CSSProperties}
                  >
                    <img src={card.images.small} alt={card.name} className="card-image" />
                    {card.rarity && (
                      <span className={`rarity-badge rarity-${getRarityClass(card.rarity)}`}>
                        {card.rarity}
                      </span>
                    )}
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

            {/* Boss challenge popup — overlays the normal game-over button */}
            {bossChallenging && gameState === 'game-over' && bossCard && (
              <div className="boss-challenge-overlay">
                <div className="boss-challenge-title">⚔️ BOSS APPEARS!</div>
                <p className="boss-challenge-sub">3 wins in a row — a powerful trainer challenges you!</p>
                <div className={`card boss-challenge-card${getHoloEffect(bossCard.rarity) ? ' holo-' + getHoloEffect(bossCard.rarity) : ''}`}>
                  <img src={bossCard.images.large || bossCard.images.small} alt={bossCard.name} className="card-image" />
                  {bossCard.rarity && (
                    <span className={`rarity-badge rarity-${getRarityClass(bossCard.rarity)}`}>{bossCard.rarity}</span>
                  )}
                  <span className="card-hp hp-high">{bossCard.hp} HP</span>
                </div>
                <p className="boss-challenge-name">{bossCard.name} — {bossCard.hp} HP</p>
                <div className="boss-challenge-buttons">
                  <button className="btn-primary btn-boss-fight" onClick={initBossFight}>⚔️ Fight Boss</button>
                  <button className="btn-secondary btn-boss-skip" onClick={() => { setBossChallenging(false); newRound(); }}>Skip</button>
                </div>
              </div>
            )}

            {gameState === 'betting' && (
              bossActive ? (
                <div className="boss-betting">
                  <p className="boss-betting-label">⚔️ Boss battle — hands are free!</p>
                  <button className="btn-primary btn-boss-next" onClick={startGame}>Deal Hand ⚔️</button>
                </div>
              ) : (
                <>
                  <div className="bet-summary">
                    <span className="bet-display">
                      {bet > 0
                        ? <>Bet: <strong>${bet}</strong></>
                        : <span className="bet-empty">No bet placed</span>}
                    </span>
                    {bet > 0 && <button className="clear-btn" onClick={clearBet}>Clear</button>}
                  </div>
                  <div className="bet-row">
                    {[5, 10, 25, 50, 100].map(amount => (
                      <button key={amount} className="chip-btn"
                        onClick={() => placeBet(amount)} disabled={bet + amount > chips}>
                        +${amount}
                      </button>
                    ))}
                  </div>
                  <p className="dex-threshold-hint">
                    {bet >= chips * 0.1
                      ? <span className="dex-unlocked">🎴 Dex capture unlocked</span>
                      : `Bet $${Math.max(5, Math.ceil(chips * 0.1))}+ to unlock Dex capture`}
                  </p>
                  <button className="btn-primary btn-deal" onClick={startGame} disabled={bet === 0}>
                    Deal
                  </button>
                </>
              )
            )}

            {gameState === 'playing' && (
              <div className="play-buttons">
                <button className="btn-primary btn-hit" onClick={hit}>Hit</button>
                <button className="btn-primary btn-stand" onClick={stand}>Stand</button>
              </div>
            )}

            {gameState === 'dealer-turn' && (
              <p className="bet-display">{bossActive ? 'Boss responds…' : 'Gym Leader draws…'}</p>
            )}

            {gameState === 'dex-select' && (
              <>
                <p className="dex-select-prompt">
                  {dexPicksLeft >= 2 ? (
                    <>🎉 <strong>BLACKJACK BONUS!</strong> Pick <span className="dex-select-highlight">2 cards</span> for your Pokédex!</>
                  ) : (
                    <>Pick a <span className="dex-select-highlight">glowing card</span> to add to your Pokédex. <span className="dex-picks-left">({dexPicksLeft} left)</span></>
                  )}
                </p>
                <button className="btn-primary btn-new-round" onClick={() => setGameState('game-over')}>
                  Skip
                </button>
              </>
            )}

            {gameState === 'game-over' && !bossChallenging && (() => {
              // Boss victory screen
              if (bossActive && bossResult === 'victory') {
                return (
                  <div className="boss-result-screen boss-victory">
                    <div className="boss-result-title">🏆 BOSS DEFEATED!</div>
                    <p className="boss-result-sub">
                      {bossCard?.name} has been captured and added to your Pokédex!
                    </p>
                    {!bossVictoryPicked ? (
                      <>
                        <p className="boss-pick-prompt">Pick 1 card from your hand for your Pokédex:</p>
                        <div className="boss-victory-hand">
                          {bossVictoryHand.map((card, idx) => (
                            <div
                              key={card.id + idx}
                              className={`card boss-pick-card${getHoloEffect(card.rarity) ? ' holo-' + getHoloEffect(card.rarity) : ''}`}
                              onClick={(e) => {
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
                                addToBossVictoryDex(card);
                                setBossVictoryPicked(true);
                              }}
                            >
                              <img src={card.images.small} alt={card.name} className="card-image" />
                              <span className="dex-capture-badge">+ DEX</span>
                            </div>
                          ))}
                        </div>
                        <button className="btn-secondary" onClick={() => setBossVictoryPicked(true)}>Skip</button>
                      </>
                    ) : (
                      <button className="btn-primary btn-boss-continue" onClick={endBossFight}>🎉 Continue!</button>
                    )}
                  </div>
                );
              }

              // Boss defeat screen
              if (bossActive && bossResult === 'defeat') {
                return (
                  <div className="boss-result-screen boss-defeat">
                    <div className="boss-result-title">💀 Knocked Out!</div>
                    <p className="boss-result-sub">{fighterName} couldn't hold on… the boss was too powerful!</p>
                    <button className="btn-primary" onClick={endBossFight}>Back to Training</button>
                  </div>
                );
              }

              // Boss fight — hand resolved, not yet over
              if (bossActive && bossResult === null) {
                return (
                  <button className="btn-primary btn-boss-next" onClick={bossNextHand}>
                    Next Hand ⚔️
                  </button>
                );
              }

              // Normal game-over
              if (chips < 5) {
                return (
                  <div className="broke-screen">
                    <p className="broke-icon">💸</p>
                    <p className="broke-title">Blacked Out!</p>
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
