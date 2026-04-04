import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  User as FirebaseUser,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { HallOfFameEntry } from '../HofPage';
import { DexEntry } from '../DexPage';

export interface UserData {
  chips: number;
  lastDailyBonus: string;
  personalHof: HallOfFameEntry[];
  dex: DexEntry[];
  totalGamesPlayed: number;
  totalWins: number;
  totalLosses: number;
}

const DEFAULT_DATA: UserData = {
  chips: 1000,
  lastDailyBonus: '',
  personalHof: [],
  dex: [],
  totalGamesPlayed: 0,
  totalWins: 0,
  totalLosses: 0,
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
