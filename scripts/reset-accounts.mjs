#!/usr/bin/env node
/**
 * Reset duplicate accounts on the production backend.
 * Run this when the Render backend is awake.
 *
 * Usage: node scripts/reset-accounts.mjs
 *
 * This will:
 *   1. Login to 'kunailby' and 'kuna' accounts
 *   2. Zero out chips, dex, and personal HoF
 *   3. Optionally delete the 'kuna' account entirely
 */

const API = 'https://pokemon-blackjack-28yc.onrender.com/api';

function hashPassword(password) {
  let hash = 5381;
  for (let i = 0; i < password.length; i++) {
    hash = ((hash << 5) + hash) ^ password.charCodeAt(i);
    hash = hash >>> 0;
  }
  return hash.toString(36);
}

async function api(path, method = 'GET', body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

async function login(username) {
  return api('/auth/login', 'POST', { username, passwordHash: '' });
}

async function resetAccount(username) {
  try {
    const data = await login(username);
    const token = data.token;
    console.log(`✅ Logged in as "${username}" (new: ${data.isNew})`);

    await api('/auth/sync', 'PUT', {
      chips: 0,
      lastDailyBonus: '',
      personalHof: [],
      dex: [],
    }, token);
    console.log(`   Reset chips=0, dex=[], personalHof=[]`);
  } catch (err) {
    console.error(`❌ Failed to reset "${username}": ${err.message}`);
  }
}

async function deleteAccount(username) {
  try {
    const data = await login(username);
    const token = data.token;
    // Use DELETE on the profile endpoint if available, or zero everything out
    const res = await fetch(`${API}/auth/profile`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (res.ok || res.status === 204) {
      console.log(`🗑️  Deleted "${username}" account`);
    } else {
      console.log(`⚠️  No DELETE endpoint for "${username}" (HTTP ${res.status}) — resetting instead`);
      await resetAccount(username);
    }
  } catch (err) {
    console.error(`❌ Failed to delete "${username}": ${err.message}`);
  }
}

async function main() {
  // Check backend health first
  try {
    const health = await api('/health');
    console.log('Backend health:', JSON.stringify(health));
  } catch {
    console.error('❌ Backend is not responding. Wait for Render to wake up and try again.');
    console.log('   You can force a wake-up by visiting:');
    console.log('   https://pokemon-blackjack-28yc.onrender.com/api/health');
    process.exit(1);
  }

  console.log('\n=== Resetting duplicate accounts ===\n');

  // Reset kunailby (the one we want to keep, but clean)
  console.log('Resetting "kunailby" account...');
  await resetAccount('kunailby');

  console.log('\nDeleting "kuna" account...');
  await deleteAccount('kuna');

  console.log('\n=== Done ===');
}

main();
