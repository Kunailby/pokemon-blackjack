import React, { useState } from 'react';

export interface HallOfFameEntry {
  id: string;
  playerName: string;
  bet: number;
  pokemonNames: string[];
  sprites: string[];
  date: string;
}

interface HofPageProps {
  globalHof: HallOfFameEntry[];
  personalHof: HallOfFameEntry[];
  onBack: () => void;
}

export default function HofPage({ globalHof, personalHof, onBack }: HofPageProps) {
  const [tab, setTab] = useState<'global' | 'personal'>('global');
  const entries = tab === 'global' ? globalHof : personalHof;

  return (
    <div className="app">
      <div className="page-container">

        <div className="page-header">
          <button className="back-btn" onClick={onBack}>← Back</button>
          <span className="page-title">Hall of Fame</span>
        </div>

        <div className="tab-bar">
          <button
            className={`tab-btn${tab === 'global' ? ' active' : ''}`}
            onClick={() => setTab('global')}
          >
            Global Top 10
          </button>
          <button
            className={`tab-btn${tab === 'personal' ? ' active' : ''}`}
            onClick={() => setTab('personal')}
          >
            My Top 10
          </button>
        </div>

        <div className="hof-panel">
          {entries.length === 0 ? (
            <p className="hof-empty">
              {tab === 'personal'
                ? 'No personal wins yet. Place a big bet and win!'
                : 'No wins recorded yet. Be the first!'}
            </p>
          ) : (
            <ol className="hof-list">
              {entries.map((entry, i) => (
                <li key={entry.id} className="hof-entry">
                  <div className="hof-entry-top">
                    <span className="hof-rank">#{i + 1}</span>
                    <div className="hof-info">
                      <span className="hof-name">{entry.playerName}</span>
                      <span className="hof-meta">${entry.bet} bet · {entry.date}</span>
                    </div>
                  </div>
                  <div className="hof-team">
                    {entry.sprites.map((src, j) =>
                      src
                        ? <img key={j} src={src} alt="" title={entry.pokemonNames[j]} className="hof-sprite" />
                        : null
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

      </div>
    </div>
  );
}
