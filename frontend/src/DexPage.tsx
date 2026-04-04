import React from 'react';

export interface DexEntry {
  name: string;
  sprite: string;
}

interface DexPageProps {
  dex: DexEntry[];
  onBack: () => void;
}

export default function DexPage({ dex, onBack }: DexPageProps) {
  const sorted = [...dex].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="app">
      <div className="page-container">

        <div className="page-header">
          <button className="back-btn" onClick={onBack}>← Back</button>
          <span className="page-title">My Pokédex</span>
          <span className="page-count">{dex.length} caught</span>
        </div>

        {dex.length === 0 ? (
          <div className="panel">
            <p className="hof-empty">
              No Pokémon caught yet.<br />
              Win a hand with a wager of at least 10% of your chips to unlock captures.
            </p>
          </div>
        ) : (
          <div className="dex-grid">
            {sorted.map(entry => (
              <div key={entry.name} className="dex-card">
                {entry.sprite
                  ? <img src={entry.sprite} alt={entry.name} className="dex-sprite" />
                  : <div className="dex-sprite-placeholder">?</div>
                }
                <span className="dex-name">{entry.name}</span>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
