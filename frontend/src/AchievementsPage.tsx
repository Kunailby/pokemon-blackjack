import React from 'react';
import { ACHIEVEMENTS, UnlockedAchievement } from './achievements';

interface Props {
  unlocked: UnlockedAchievement[];
  onBack: () => void;
}

export default function AchievementsPage({ unlocked, onBack }: Props) {
  const unlockedMap = new Map(unlocked.map(u => [u.id, u]));
  const unlockedCount = unlocked.length;

  return (
    <div className="app">
      <div className="page-container">

        <div className="page-header">
          <button className="back-btn" onClick={onBack}>← Back</button>
          <span className="page-title">Achievements</span>
          <span className="page-count">{unlockedCount} / {ACHIEVEMENTS.length}</span>
        </div>

        <div className="achievements-grid">
          {ACHIEVEMENTS.map(a => {
            const entry = unlockedMap.get(a.id);
            const isUnlocked = !!entry;
            return (
              <div key={a.id} className={`achievement-card${isUnlocked ? ' unlocked' : ' locked'}`}>
                <span className="achievement-icon">{a.icon}</span>
                <span className="achievement-name">{a.name}</span>
                <span className="achievement-desc">{a.description}</span>
                {isUnlocked && (
                  <span className="achievement-date">
                    {new Date(entry!.unlockedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                )}
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
