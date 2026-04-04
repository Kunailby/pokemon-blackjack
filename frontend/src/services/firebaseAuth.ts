import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  User as FirebaseUser,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, onSnapshot, runTransaction, Unsubscribe } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { HallOfFameEntry } from '../HofPage';
import { DexEntry } from '../DexPage';
import { UnlockedAchievement } from '../achievements';

export interface UserData {
  chips: number;
  lastDailyBonus: string;
  personalHof: HallOfFameEntry[];
  dex: DexEntry[];
  seenPokemon: string[];
  totalGamesPlayed: number;
  totalWins: number;
  totalLosses: number;
  unlockedAchievements: UnlockedAchievement[];
  winStreak: number;
}

const DEFAULT_DATA: UserData = {
  chips: 1000,
  lastDailyBonus: '',
  personalHof: [],
  dex: [],
  seenPokemon: [],
  totalGamesPlayed: 0,
  totalWins: 0,
  totalLosses: 0,
  unlockedAchievements: [],
  winStreak: 0,
};

/**
 * Login with username + password.
 * Username is stored as the display name.
 * Returns Firebase user + their game data.
 */
export async function login(username: string, password: string): Promise<{ user: FirebaseUser; data: UserData; isNew: boolean }> {
  // Firebase Auth uses email/password, so we use a synthetic email
  const email = `${username}@pokemon-blackjack.local`;
  let isNew = false;

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const data = await getUserData(cred.user.uid);
    return { user: cred.user, data, isNew: false };
  } catch (err: any) {
    // User doesn't exist yet — create account
    if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential' || err.code === 'auth/invalid-login-credentials') {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: username });
      // Initialize with default data
      await setDoc(doc(db, 'users', cred.user.uid), DEFAULT_DATA);
      return { user: cred.user, data: { ...DEFAULT_DATA }, isNew: true };
    }
    throw err;
  }
}

/**
 * Logout from Firebase.
 */
export async function logout(): Promise<void> {
  await signOut(auth);
}

/**
 * Get user game data from Firestore.
 */
export async function getUserData(uid: string): Promise<UserData> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (snap.exists()) return snap.data() as UserData;
  return { ...DEFAULT_DATA };
}

/**
 * Update user game data in Firestore.
 */
export async function updateUserData(uid: string, data: Partial<UserData>): Promise<void> {
  await updateDoc(doc(db, 'users', uid), data);
}

/**
 * Listen to real-time changes in user data.
 * Returns an unsubscribe function.
 */
export function subscribeToUserData(uid: string, callback: (data: UserData) => void): Unsubscribe {
  return onSnapshot(doc(db, 'users', uid), (snap) => {
    if (snap.exists()) callback(snap.data() as UserData);
  });
}

/**
 * Update specific fields atomically.
 */
export async function updateChips(uid: string, chips: number): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { chips });
}

export async function updateDex(uid: string, dex: DexEntry[]): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { dex });
}

export async function updatePersonalHof(uid: string, personalHof: HallOfFameEntry[]): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { personalHof });
}

export async function updateLastDailyBonus(uid: string, lastDailyBonus: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { lastDailyBonus });
}

export async function updateSeenPokemon(uid: string, seenPokemon: string[]): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { seenPokemon });
}

// ── Global Hall of Fame (Firestore — synced across all players) ───────────────
// Stored at: global/hallOfFame
// Resets every Monday: if the stored weekStart differs from the current Monday,
// the board is treated as empty and the next write starts a fresh week.

interface GlobalHofDoc {
  entries: HallOfFameEntry[];
  weekStart: string; // "YYYY-MM-DD" of the Monday this leaderboard started
}

/** Returns the ISO date string (YYYY-MM-DD) for the most recent Monday (UTC). */
function getCurrentMondayKey(): string {
  const d = new Date();
  const day = d.getUTCDay(); // 0 = Sunday, 1 = Monday … 6 = Saturday
  const daysToMonday = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + daysToMonday);
  return d.toISOString().slice(0, 10);
}

/**
 * Subscribe to the global leaderboard in real time.
 * Automatically returns an empty array when the stored week differs
 * from the current week (the board resets on the next win write).
 */
export function subscribeToGlobalHof(callback: (entries: HallOfFameEntry[]) => void): Unsubscribe {
  return onSnapshot(doc(db, 'global', 'hallOfFame'), (snap) => {
    if (!snap.exists()) { callback([]); return; }
    const data = snap.data() as GlobalHofDoc;
    callback(data.weekStart === getCurrentMondayKey() ? (data.entries ?? []) : []);
  });
}

/**
 * Atomically add a new entry to the global leaderboard.
 * Resets the board if it belongs to a previous week.
 * Keeps only the top 10 entries sorted by bet (desc), then recency.
 */
export async function addToGlobalHof(entry: HallOfFameEntry): Promise<void> {
  const ref = doc(db, 'global', 'hallOfFame');
  const currentWeek = getCurrentMondayKey();
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    let existing: HallOfFameEntry[] = [];
    if (snap.exists()) {
      const data = snap.data() as GlobalHofDoc;
      // Only carry over entries from the current week; older weeks reset
      existing = data.weekStart === currentWeek ? (data.entries ?? []) : [];
    }
    const updated = [...existing, entry]
      .sort((a, b) => b.bet - a.bet || Number(b.id) - Number(a.id))
      .slice(0, 10);
    tx.set(ref, { entries: updated, weekStart: currentWeek } satisfies GlobalHofDoc);
  });
}
