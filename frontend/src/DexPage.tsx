import React, { useState, useEffect } from 'react';
import pokeballIcon from './assets/pokeball.png';

export interface DexEntry {
  name: string;
  sprite: string;
}

interface DexPageProps {
  dex: DexEntry[];
  seen: string[];
  onBack: () => void;
}

type Tab = 'seen' | 'caught';

// ─── Sprite cache with localStorage persistence ───────────────────────────────
const SPRITE_STORE_KEY = 'pkmbkj-sprite-cache';

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

const spriteCache: Map<string, string> = loadSpriteCache();

async function fetchSprite(pokemonName: string): Promise<string> {
  if (spriteCache.has(pokemonName)) return spriteCache.get(pokemonName)!;

  const toSlug = (s: string) =>
    s.toLowerCase()
      .replace(/♀/g, '-f').replace(/♂/g, '-m')
      .replace(/['.]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

  let base = pokemonName
    .replace(/\s+(ex|EX|GX|V|VMAX|VSTAR|VUNION|BREAK|LV\.X|δ|\d+)(\s|$)/gi, ' ')
    .replace(/^(Dark|Light|Team Rocket's|Rocket's|Gym|M\s)\s*/i, '')
    .trim();

  // Deoxys: PokeAPI has deoxys-normal (not deoxys). Map explicitly.
  if (base.toLowerCase() === 'deoxys') {
    base = 'deoxys-normal';
  }

  // Nidoran ♀/♂ need special handling
  if (base.toLowerCase().includes('nidoran')) {
    const clean = toSlug(base);
    const attempts = [clean, toSlug(pokemonName)];
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
    spriteCache.set(pokemonName, '');
    saveSpriteCache(spriteCache);
    return '';
  }

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
  // Don't cache empty results — retry on next attempt
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
  const [sprites, setSprites] = useState<Map<string, string>>(new Map());

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

      // Batch into groups of 20 to avoid overwhelming the API
      const batchSize = 20;
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps — only run once on mount

  const caughtEntries = dex.sort((a, b) => a.name.localeCompare(b.name));

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
              {caughtEntries.map(entry => (
                <div key={entry.name} className="dex-card caught">
                  {entry.sprite
                    ? <img src={entry.sprite} alt={entry.name} className="dex-sprite" />
                    : <div className="dex-sprite-placeholder">?</div>
                  }
                  <span className="dex-name">{entry.name}</span>
                </div>
              ))}
            </div>
          )
        )}

      </div>
    </div>
  );
}
