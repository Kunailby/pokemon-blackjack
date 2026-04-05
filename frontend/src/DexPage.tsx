import React, { useState, useEffect } from 'react';
import pokeballIcon from './assets/pokeball.png';

export interface DexEntry {
  name: string;
  sprite: string;
  boss?: boolean; // true when won as a boss fight reward
}

interface DexPageProps {
  dex: DexEntry[];
  seen: string[];
  onBack: () => void;
}

type Tab = 'seen' | 'caught';

// ─── Sprite cache with localStorage persistence ───────────────────────────────
// Bump CACHE_VERSION when adding new Pokemon or fixing sprite issues
const SPRITE_CACHE_VERSION = 4;
const SPRITE_STORE_KEY = 'pkmbkj-sprite-cache-v' + SPRITE_CACHE_VERSION;

function loadSpriteCache(): Map<string, string> {
  try {
    const raw = localStorage.getItem(SPRITE_STORE_KEY);
    if (!raw) return new Map();
    return new Map(Object.entries(JSON.parse(raw)));
  } catch { return new Map(); }
}

function saveSpriteCache(cache: Map<string, string>) {
  try { localStorage.setItem(SPRITE_STORE_KEY, JSON.stringify(Object.fromEntries(cache))); }
  catch { /* quota exceeded */ }
}

// Clean old cache versions
(function cleanOldCaches() {
  try {
    for (let i = 1; i < SPRITE_CACHE_VERSION; i++) {
      localStorage.removeItem('pkmbkj-sprite-cache-v' + i);
    }
  } catch { /* ignore */ }
})();

const spriteCache: Map<string, string> = loadSpriteCache();

async function fetchSprite(pokemonName: string): Promise<string> {
  if (spriteCache.has(pokemonName)) return spriteCache.get(pokemonName)!;

  const toSlug = (s: string) =>
    s.toLowerCase()
      .replace(/♀/g, '-f').replace(/♂/g, '-m')
      .replace(/['.]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

  // Strip hyphen-suffixes first (e.g. "Deoxys-EX" → "Deoxys", "Charizard-GX" → "Charizard")
  // then space-suffixes, then prefixes like "Team Aqua's", "Dark", etc.
  let base = pokemonName
    .replace(/-(ex|GX|VMAX|VSTAR|VUNION|BREAK)$/i, '')
    .replace(/\s+(ex|EX|GX|V|VMAX|VSTAR|VUNION|BREAK|LV\.X|δ|\d+)(\s|$)/gi, ' ')
    .replace(/^(Team\s+\w+'s|\w+'s|Dark|Light|Gym|M\s)\s*/i, '')
    .trim();

  // PokeAPI uses "deoxys-normal" not "deoxys"
  if (base.toLowerCase() === 'deoxys') base = 'deoxys-normal';

  const attempts = [
    toSlug(base.split(' ')[0]),
    toSlug(base),
    toSlug(pokemonName.split(' ')[0]),
    toSlug(pokemonName),
  ].filter((v, i, a) => Boolean(v) && a.indexOf(v) === i);

  for (const name of attempts) {
    try {
      const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${name}`);
      if (res.ok) {
        const data = await res.json();
        if (data.sprites?.front_default) {
          spriteCache.set(pokemonName, data.sprites.front_default);
          saveSpriteCache(spriteCache);
          return data.sprites.front_default;
        }
      }
    } catch { /* try next */ }
  }
  // Cache failures too — prevents re-fetching every time the dex opens
  spriteCache.set(pokemonName, '');
  saveSpriteCache(spriteCache);
  return '';
}

// Fetch all Pokemon species from PokeAPI
async function fetchAllSpecies(): Promise<string[]> {
  try {
    const res = await fetch('https://pokeapi.co/api/v2/pokemon?limit=1025&offset=0');
    if (!res.ok) throw new Error('Failed');
    const data = await res.json();
    return data.results.map((p: any) => {
      // Convert API name (e.g. "nidoran-f") to display name
      return p.name
        .replace(/-f$/, '♀')
        .replace(/-m$/, '♂')
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (c: string) => c.toUpperCase());
    });
  } catch {
    return [];
  }
}

export default function DexPage({ dex, seen, onBack }: DexPageProps) {
  const [tab, setTab] = useState<Tab>('seen');
  const [species, setSpecies] = useState<string[]>([]);
  // Seed from persistent cache so already-fetched sprites show instantly
  const [sprites, setSprites] = useState<Map<string, string>>(() => new Map(spriteCache));

  const caughtSet = new Set(dex.map(d => d.name));
  const seenSet = new Set(seen);

  // Merge caught into seen (for backwards compat with pre-update data)
  caughtSet.forEach(n => seenSet.add(n));

  useEffect(() => {
    fetchAllSpecies().then(list => {
      if (list.length > 0) setSpecies(list);
    });
  }, []);

  // Fetch sprites for all seen Pokemon in parallel (only once on mount + when new seen appear)
  const fetchedRef = React.useRef<Set<string>>(new Set(Array.from(spriteCache.keys())));

  useEffect(() => {
    const loadSprites = async () => {
      // Only fetch sprites we haven't cached yet
      const needsFetch = Array.from(seenSet).filter(n => !spriteCache.has(n));
      if (needsFetch.length === 0) return;

      // Batch into groups of 50 — cached results resolve instantly, only uncached names hit the network
      const batchSize = 50;
      for (let i = 0; i < needsFetch.length; i += batchSize) {
        const batch = needsFetch.slice(i, i + batchSize);
        const results = await Promise.all(
          batch.map(async (name) => {
            const url = await fetchSprite(name);
            return { name, url };
          })
        );
        setSprites(prev => {
          const merged = new Map(prev);
          results.forEach(r => { if (r.url) merged.set(r.name, r.url); });
          return merged;
        });
        results.forEach(r => fetchedRef.current.add(r.name));
      }
    };
    if (seenSet.size > 0) loadSprites();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Build a deduplicated caught list with counts
  const caughtCountMap = new Map<string, number>();
  dex.forEach(d => caughtCountMap.set(d.name, (caughtCountMap.get(d.name) ?? 0) + 1));
  const nameToEntry = new Map<string, DexEntry>();
  for (const d of dex) {
    const existing = nameToEntry.get(d.name);
    if (!existing) {
      nameToEntry.set(d.name, { ...d });
    } else if (d.boss) {
      existing.boss = true; // preserve boss flag if any catch was a boss reward
    }
  }
  const caughtEntries = Array.from(nameToEntry.values()).sort((a, b) => a.name.localeCompare(b.name));

  // Master list: all known species, or fallback to seen+caught names
  const masterList = species.length > 0 ? species : Array.from(seenSet).sort();

  return (
    <div className="app">
      <div className="page-container">

        <div className="page-header">
          <button className="back-btn" onClick={onBack}>← Back</button>
          <span className="page-title">Pokédex</span>
          <span className="page-count">{caughtEntries.length} caught · {seenSet.size} seen</span>
        </div>

        {/* Tab bar */}
        <div className="dex-tabs">
          <button
            className={`dex-tab ${tab === 'seen' ? 'active' : ''}`}
            onClick={() => setTab('seen')}
          >
            Seen
          </button>
          <button
            className={`dex-tab ${tab === 'caught' ? 'active' : ''}`}
            onClick={() => setTab('caught')}
          >
            Caught
          </button>
        </div>

        {/* ── Seen Tab ─────────────────────────────────────────────── */}
        {tab === 'seen' && masterList.length === 0 ? (
          <div className="panel">
            <p className="hof-empty">Loading Pokédex data…</p>
          </div>
        ) : tab === 'seen' && (
          <div className="dex-grid">
            {masterList.map(name => {
              const isCaught = caughtSet.has(name);
              const isSeen = seenSet.has(name);
              const sprite = sprites.get(name);

              if (isSeen) {
                return (
                  <div key={name} className={`dex-card ${isCaught ? 'caught' : ''}`}>
                    {sprite ? (
                      <img src={sprite} alt={name} className="dex-sprite" />
                    ) : (
                      <div className="dex-sprite-placeholder">{name[0]}</div>
                    )}
                    <span className="dex-name">{name}</span>
                    {isCaught && (
                      <span className="dex-caught-badge">
                        <img src={pokeballIcon} alt="caught" className="pokeball-mini" />
                      </span>
                    )}
                    {isCaught && (caughtCountMap.get(name) ?? 1) > 1 && (
                      <span className="dex-count-badge">×{caughtCountMap.get(name)}</span>
                    )}
                  </div>
                );
              }

              return (
                <div key={name} className="dex-card unseen">
                  <div className="dex-silhouette">?</div>
                  <span className="dex-name dex-name-unseen">???</span>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Caught Tab ───────────────────────────────────────────── */}
        {tab === 'caught' && (
          caughtEntries.length === 0 ? (
            <div className="panel">
              <p className="hof-empty">
                No Pokémon caught yet.<br />
                Win a hand with a wager of at least 10% of your chips to unlock captures.
              </p>
            </div>
          ) : (
            <div className="dex-grid">
              {caughtEntries.map(entry => {
                const count = caughtCountMap.get(entry.name) ?? 1;
                return (
                  <div key={entry.name} className="dex-card caught">
                    {entry.sprite
                      ? <img src={entry.sprite} alt={entry.name} className="dex-sprite" />
                      : <div className="dex-sprite-placeholder">?</div>
                    }
                    <span className="dex-name">{entry.name}</span>
                    {count > 1 && <span className="dex-count-badge">×{count}</span>}
                    {entry.boss && <span className="dex-boss-badge">⚔️ BOSS</span>}
                  </div>
                );
              })}
            </div>
          )
        )}

      </div>
    </div>
  );
}
