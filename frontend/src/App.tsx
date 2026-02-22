import React, { useState, useEffect } from 'react';
import './App.css';

interface PokemonCard {
  id: string;
  name: string;
  hp: number;
  images: {
    small: string;
    large: string;
  };
}

function calculateTotal(hand: PokemonCard[]): number {
  let total = 0;
  let lowHpCards = 0; // Cards with HP <= 40 can act like Aces
  
  for (const card of hand) {
    // Normalize HP to blackjack-friendly values (divide by 10, max 11)
    let value = Math.min(Math.floor(card.hp / 10), 11);
    if (value === 0) value = 1;
    
    if (value <= 4) {
      lowHpCards++;
      total += 11; // Low HP cards start as 11 (like Ace)
    } else {
      total += value;
    }
  }
  
  // Adjust low HP cards (like Aces) if over 21
  while (total > 21 && lowHpCards > 0) {
    total -= 10;
    lowHpCards--;
  }
  
  return total;
}

function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

type GameState = 'loading' | 'betting' | 'playing' | 'dealer-turn' | 'game-over';

function App() {
  const [allCards, setAllCards] = useState<PokemonCard[]>([]);
  const [deck, setDeck] = useState<PokemonCard[]>([]);
  const [playerHand, setPlayerHand] = useState<PokemonCard[]>([]);
  const [dealerHand, setDealerHand] = useState<PokemonCard[]>([]);
  const [chips, setChips] = useState(1000);
  const [bet, setBet] = useState(0);
  const [gameState, setGameState] = useState<GameState>('loading');
  const [message, setMessage] = useState('Loading Pokemon cards...');
  const [playerName] = useState('Trainer' + Math.floor(Math.random() * 1000));

  // Fetch cards from Pokemon TCG API on mount
  useEffect(() => {
    const fetchCards = async () => {
      try {
        setMessage('Fetching Pokemon cards from TCG database...');
        
        // Fetch cards from multiple sets for variety
        const response = await fetch(
          'https://api.pokemontcg.io/v2/cards?q=supertype:pokemon&pageSize=100'
        );
        const data = await response.json();
        
        // Filter cards that have HP and images
        const validCards: PokemonCard[] = data.data
          .filter((card: any) => card.hp && parseInt(card.hp) > 0 && card.images?.small)
          .map((card: any) => ({
            id: card.id,
            name: card.name,
            hp: parseInt(card.hp),
            images: card.images
          }));
        
        if (validCards.length < 20) {
          throw new Error('Not enough cards fetched');
        }
        
        setAllCards(validCards);
        // Create deck with duplicates for more cards
        const deckCards = [...validCards, ...validCards];
        setDeck(shuffleArray(deckCards));
        setMessage('Place your bet to start!');
        setGameState('betting');
      } catch (error) {
        console.error('Error fetching cards:', error);
        setMessage('Error loading cards. Using backup set...');
        
        // Fallback to hardcoded cards with real images
        const fallbackCards: PokemonCard[] = [
          { id: 'base1-4', name: 'Charizard', hp: 120, images: { small: 'https://images.pokemontcg.io/base1/4.png', large: 'https://images.pokemontcg.io/base1/4_hires.png' }},
          { id: 'base1-2', name: 'Blastoise', hp: 100, images: { small: 'https://images.pokemontcg.io/base1/2.png', large: 'https://images.pokemontcg.io/base1/2_hires.png' }},
          { id: 'base1-15', name: 'Venusaur', hp: 100, images: { small: 'https://images.pokemontcg.io/base1/15.png', large: 'https://images.pokemontcg.io/base1/15_hires.png' }},
          { id: 'base1-58', name: 'Pikachu', hp: 40, images: { small: 'https://images.pokemontcg.io/base1/58.png', large: 'https://images.pokemontcg.io/base1/58_hires.png' }},
          { id: 'base1-10', name: 'Mewtwo', hp: 60, images: { small: 'https://images.pokemontcg.io/base1/10.png', large: 'https://images.pokemontcg.io/base1/10_hires.png' }},
          { id: 'base1-8', name: 'Machamp', hp: 100, images: { small: 'https://images.pokemontcg.io/base1/8.png', large: 'https://images.pokemontcg.io/base1/8_hires.png' }},
          { id: 'base1-94', name: 'Gengar', hp: 80, images: { small: 'https://images.pokemontcg.io/base2/20.png', large: 'https://images.pokemontcg.io/base2/20_hires.png' }},
          { id: 'base1-149', name: 'Dragonite', hp: 100, images: { small: 'https://images.pokemontcg.io/base4/4.png', large: 'https://images.pokemontcg.io/base4/4_hires.png' }},
          { id: 'base1-7', name: 'Hitmonchan', hp: 70, images: { small: 'https://images.pokemontcg.io/base1/7.png', large: 'https://images.pokemontcg.io/base1/7_hires.png' }},
          { id: 'base1-3', name: 'Chansey', hp: 120, images: { small: 'https://images.pokemontcg.io/base1/3.png', large: 'https://images.pokemontcg.io/base1/3_hires.png' }},
          { id: 'base1-1', name: 'Alakazam', hp: 80, images: { small: 'https://images.pokemontcg.io/base1/1.png', large: 'https://images.pokemontcg.io/base1/1_hires.png' }},
          { id: 'base1-6', name: 'Gyarados', hp: 100, images: { small: 'https://images.pokemontcg.io/base1/6.png', large: 'https://images.pokemontcg.io/base1/6_hires.png' }},
          { id: 'base1-26', name: 'Dratini', hp: 40, images: { small: 'https://images.pokemontcg.io/base1/26.png', large: 'https://images.pokemontcg.io/base1/26_hires.png' }},
          { id: 'base1-56', name: 'Onix', hp: 90, images: { small: 'https://images.pokemontcg.io/base1/56.png', large: 'https://images.pokemontcg.io/base1/56_hires.png' }},
          { id: 'base1-35', name: 'Jigglypuff', hp: 60, images: { small: 'https://images.pokemontcg.io/base1/54.png', large: 'https://images.pokemontcg.io/base1/54_hires.png' }},
        ];
        
        setAllCards(fallbackCards);
        const deckCards = [...fallbackCards, ...fallbackCards, ...fallbackCards, ...fallbackCards];
        setDeck(shuffleArray(deckCards));
        setMessage('Place your bet to start!');
        setGameState('betting');
      }
    };
    
    fetchCards();
  }, []);

  const placeBet = (amount: number) => {
    if (amount > chips) return;
    setBet(amount);
  };

  const startGame = () => {
    if (bet === 0) {
      setMessage('Please place a bet first!');
      return;
    }
    
    let newDeck = deck.length < 20 ? shuffleArray([...allCards, ...allCards]) : [...deck];
    
    // Deal cards
    const p1 = newDeck.pop()!;
    const d1 = newDeck.pop()!;
    const p2 = newDeck.pop()!;
    const d2 = newDeck.pop()!;
    
    setDeck(newDeck);
    setPlayerHand([p1, p2]);
    setDealerHand([d1, d2]);
    setChips(chips - bet);
    setGameState('playing');
    
    // Check for blackjack (21)
    const playerTotal = calculateTotal([p1, p2]);
    if (playerTotal === 21) {
      setMessage('BLACKJACK! 🎉');
      setTimeout(() => setGameState('dealer-turn'), 1000);
    } else {
      setMessage('Hit or Stand?');
    }
  };

  const hit = () => {
    if (gameState !== 'playing') return;
    
    const newDeck = [...deck];
    const card = newDeck.pop()!;
    const newHand = [...playerHand, card];
    setDeck(newDeck);
    setPlayerHand(newHand);
    
    const total = calculateTotal(newHand);
    if (total > 21) {
      setMessage('BUST! You lose 💥');
      setGameState('game-over');
    } else if (total === 21) {
      setMessage('21! Dealer\'s turn...');
      setTimeout(() => setGameState('dealer-turn'), 1000);
    }
  };

  const stand = () => {
    if (gameState !== 'playing') return;
    setGameState('dealer-turn');
    setMessage('Dealer\'s turn...');
  };

  // Dealer's turn logic
  useEffect(() => {
    if (gameState !== 'dealer-turn') return;
    
    const dealerPlay = async () => {
      let currentDeck = [...deck];
      let currentDealerHand = [...dealerHand];
      
      // Dealer draws until 17 or higher
      while (calculateTotal(currentDealerHand) < 17 && currentDeck.length > 0) {
        await new Promise(r => setTimeout(r, 1000));
        const card = currentDeck.pop()!;
        currentDealerHand = [...currentDealerHand, card];
        setDealerHand(currentDealerHand);
        setDeck(currentDeck);
      }
      
      const playerTotal = calculateTotal(playerHand);
      const dealerTotal = calculateTotal(currentDealerHand);
      
      await new Promise(r => setTimeout(r, 800));
      
      if (dealerTotal > 21) {
        setMessage('Dealer BUSTS! You WIN! 🎉');
        setChips(c => c + bet * 2);
      } else if (playerTotal > dealerTotal) {
        setMessage('You WIN! 🎉');
        setChips(c => c + bet * 2);
      } else if (dealerTotal > playerTotal) {
        setMessage('Dealer wins 😢');
      } else {
        setMessage('Push! Bet returned.');
        setChips(c => c + bet);
      }
      
      setGameState('game-over');
    };
    
    dealerPlay();
  }, [gameState]);

  const newRound = () => {
    if (chips <= 0) {
      setChips(1000);
      setMessage('Out of chips! Here\'s 1000 more. Place your bet!');
    } else {
      setMessage('Place your bet!');
    }
    setPlayerHand([]);
    setDealerHand([]);
    setBet(0);
    setGameState('betting');
  };

  const getCardValue = (card: PokemonCard): number => {
    let value = Math.min(Math.floor(card.hp / 10), 11);
    return value === 0 ? 1 : value;
  };

  if (gameState === 'loading') {
    return (
      <div className="app">
        <div className="game-container loading-container">
          <h1>🎴 Pokémon Blackjack 🎴</h1>
          <div className="loading-spinner"></div>
          <p className="loading-text">{message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="game-container">
        <h1>🎴 Pokémon Blackjack 🎴</h1>
        <p className="player-info">{playerName} • Chips: ${chips}</p>
        
        {/* Dealer's Hand */}
        <div className="hand-section dealer-section">
          <h3>Dealer {gameState !== 'betting' && `(${gameState === 'playing' ? '?' : calculateTotal(dealerHand)})`}</h3>
          <div className="hand">
            {dealerHand.map((card, idx) => (
              <div key={card.id + idx} className="card">
                {gameState === 'playing' && idx === 1 ? (
                  <div className="card-back">
                    <img src="https://images.pokemontcg.io/base1/back.png" alt="card back" />
                  </div>
                ) : (
                  <>
                    <img src={card.images.small} alt={card.name} className="card-image" />
                    <div className="card-value">Value: {getCardValue(card)}</div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
        
        {/* Player's Hand */}
        <div className="hand-section player-section">
          <h3>Your Hand ({calculateTotal(playerHand)})</h3>
          <div className="hand">
            {playerHand.map((card, idx) => (
              <div key={card.id + idx} className="card">
                <img src={card.images.small} alt={card.name} className="card-image" />
                <div className="card-value">Value: {getCardValue(card)}</div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Message */}
        <div className="message">{message}</div>
        
        {/* Controls */}
        <div className="controls">
          {gameState === 'betting' && (
            <div className="betting-controls">
              <div className="bet-display">Current Bet: ${bet}</div>
              <div className="bet-buttons">
                <button onClick={() => placeBet(10)} disabled={chips < 10}>$10</button>
                <button onClick={() => placeBet(25)} disabled={chips < 25}>$25</button>
                <button onClick={() => placeBet(50)} disabled={chips < 50}>$50</button>
                <button onClick={() => placeBet(100)} disabled={chips < 100}>$100</button>
              </div>
              <button className="deal-btn" onClick={startGame} disabled={bet === 0}>
                DEAL
              </button>
            </div>
          )}
          
          {gameState === 'playing' && (
            <div className="play-controls">
              <button onClick={hit} className="hit-btn">HIT</button>
              <button onClick={stand} className="stand-btn">STAND</button>
            </div>
          )}
          
          {gameState === 'game-over' && (
            <button onClick={newRound} className="new-round-btn">
              NEW ROUND
            </button>
          )}
        </div>
        
        <p className="deck-info">Cards in deck: {deck.length}</p>
      </div>
    </div>
  );
}

export default App;
