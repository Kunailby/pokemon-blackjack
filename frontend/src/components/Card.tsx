import React from 'react';
import './Card.css';
import { Card as CardType } from '../types/game';

interface CardProps {
  card?: CardType;
  hidden?: boolean;
  empty?: boolean;
}

export const Card: React.FC<CardProps> = ({ card, hidden = false, empty = false }) => {
  if (empty) {
    return <div className="card empty-card"></div>;
  }

  if (hidden || !card) {
    return <div className="card hidden-card">?</div>;
  }

  return (
    <div className="card">
      <div className="card-content">
        <div className="card-top">
          <h3>{card.name}</h3>
          <div className={`hp-badge hp-${card.hpCategory}`}>
            {card.hp}
          </div>
        </div>
        <img src={card.imageUrl} alt={card.name} className="card-image" />
        <div className="card-bottom">
          <p className="set-name">{card.setName}</p>
          <p className="card-number">{card.cardNumber}</p>
        </div>
      </div>
    </div>
  );
};
