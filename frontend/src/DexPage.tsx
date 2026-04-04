import React, { useState } from 'react';
import pokeballIcon from './assets/pokeball.png';

export interface DexEntry {
  name: string;
  sprite: string;
}

interface DexPageProps {
  dex: DexEntry[];
  seen: string[];
  allCards: { name: string; images: { small: string }; hp: number }[];
  onBack: () => void;
}

type Tab = 'seen' | 'caught';

export default function DexPage({ dex, seen, allCards, onBack }: DexPageProps) {
  const [tab, setTab] = useState<Tab>('seen');

  const caughtSet = new Set(dex.map(d => d.name));
  const seenSet = new Set(seen);

  // Build master list: unique Pokemon names from allCards + any caught/seen not in allCards
  const masterNames = new Set<string>(allCards.map(c => c.name));
  caughtSet.forEach(n => masterNames.add(n));
  seenSet.forEach(n => masterNames.add(n));
  const allNames = Array.from(masterNames).sort((a, b) => a.localeCompare(b));

  const caughtEntries = dex.filter(d => caughtSet.has(d.name)).sort((a, b) => a.name.localeCompare(b.name));

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
            Seen ({allNames.length})
          </button>
          <button
            className={`dex-tab ${tab === 'caught' ? 'active' : ''}`}
            onClick={() => setTab('caught')}
          >
            Caught ({caughtEntries.length})
          </button>
        </div>

        {/* ── Seen Tab ─────────────────────────────────────────────── */}
        {tab === 'seen' && (
          <div className="dex-grid">
            {allNames.map(name => {
              const isCaught = caughtSet.has(name);
              const isSeen = seenSet.has(name);
              const card = allCards.find(c => c.name === name);
              const caughtEntry = dex.find(d => d.name === name);

              if (isSeen) {
                // Seen — show colored sprite with optional pokeball if caught
                return (
                  <div key={name} className={`dex-card ${isCaught ? 'caught' : ''}`}>
                    {caughtEntry?.sprite ? (
                      <img src={caughtEntry.sprite} alt={name} className="dex-sprite" />
                    ) : card?.images?.small ? (
                      <img src={card.images.small} alt={name} className="dex-sprite" />
                    ) : (
                      <div className="dex-sprite-placeholder">?</div>
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

              // Not seen — grey silhouette
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
