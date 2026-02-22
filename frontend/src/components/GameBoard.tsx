import React from 'react';
import './GameBoard.css';
import { Card } from './Card';
import { playService } from '../services/playService';
import { GameTable, GameResult } from '../types/game';

interface GameBoardProps {
  tableId: string;
  userId: string;
  username: string;
  onExit: () => void;
}

export const GameBoard: React.FC<GameBoardProps> = ({
  tableId,
  userId,
  username,
  onExit,
}) => {
  const [game, setGame] = React.useState<GameTable | null>(null);
  const [phase, setPhase] = React.useState<'waiting' | 'playing' | 'dealer-turn' | 'finished'>('waiting');
  const [results, setResults] = React.useState<GameResult[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const loadGameState = React.useCallback(async () => {
    try {
      const response = await playService.getGameState(tableId);
      const gameData = response.data;
      setGame(gameData);
      setPhase(gameData.gameStatus);
    } catch (err) {
      console.error('Failed to load game state:', err);
    }
  }, [tableId]);

  React.useEffect(() => {
    loadGameState();
    const interval = setInterval(loadGameState, 2000);
    return () => clearInterval(interval);
  }, [loadGameState]);

  const handleDeal = async () => {
    setLoading(true);
    try {
      await playService.dealCards(tableId);
      await loadGameState();
      setPhase('playing');
    } catch (err: any) {
      setError('Failed to deal cards');
    } finally {
      setLoading(false);
    }
  };

  const handleHit = async () => {
    setLoading(true);
    try {
      await playService.playerHit(tableId, userId);
      await loadGameState();
    } catch (err: any) {
      setError('Failed to hit');
    } finally {
      setLoading(false);
    }
  };

  const handleStand = async () => {
    setLoading(true);
    try {
      await playService.playerStand(tableId, userId);
      await loadGameState();
    } catch (err: any) {
      setError('Failed to stand');
    } finally {
      setLoading(false);
    }
  };

  const handleDealerTurn = async () => {
    setLoading(true);
    try {
      const response = await playService.dealerTurn(tableId);
      setResults(response.data.results);
      setPhase('finished');
      await loadGameState();
    } catch (err: any) {
      setError('Failed to complete dealer turn');
    } finally {
      setLoading(false);
    }
  };

  const allPlayersStanding = game?.players.every((p) => p.isStanding || p.totalHP > 400);

  return (
    <div className="game-board">
      <div className="game-header">
        <h1>Pokémon Blackjack</h1>
        <div className="game-info">
          <p>Invite Code: <strong>{game?.inviteCode}</strong></p>
          <p>Players: {game?.players.length || 0}/6</p>
          <p>Status: <strong>{phase}</strong></p>
        </div>
        <button className="exit-btn" onClick={onExit}>Exit Game</button>
      </div>

      <div className="game-content">
        {/* Dealer Section */}
        <div className="dealer-section">
          <h2>Dealer</h2>
          <div className="dealer-cards">
            {game?.dealer.hand.map((card, idx) => (
              <Card key={idx} card={card} hidden={idx === 1 && phase === 'playing'} />
            ))}
            {(game?.dealer.hand.length === 0 || !game?.dealer.hand) && (
              <>
                <Card empty />
                <Card empty />
              </>
            )}
          </div>
          <p className="hp-display">Total HP: {game?.dealer.totalHP || 0}</p>
        </div>

        {/* Players Section */}
        <div className="players-section">
          {game?.players.map((player, idx) => (
            <div key={player._id} className="player-area">
              <h3>{player.username} {player._id === userId ? '(You)' : ''}</h3>
              <div className="player-cards">
                {player.hand.map((card, cardIdx) => (
                  <Card key={cardIdx} card={card} />
                ))}
                {player.hand.length === 0 && (
                  <>
                    <Card empty />
                    <Card empty />
                  </>
                )}
              </div>
              <div className="player-info">
                <p>HP: {player.totalHP}</p>
                {player.isStanding && <span className="status standing">STANDING</span>}
                {player.totalHP === 400 && <span className="status blackjack">BLACKJACK</span>}
                {player.totalHP > 400 && <span className="status bust">BUST</span>}
              </div>
              {player._id === userId && phase === 'playing' && !player.isStanding && (
                <div className="player-actions">
                  <button onClick={handleHit} disabled={loading}>
                    Hit
                  </button>
                  <button onClick={handleStand} disabled={loading}>
                    Stand
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Game Controls */}
      <div className="game-controls">
        {phase === 'waiting' && (
          <button onClick={handleDeal} disabled={loading} className="primary-btn">
            {loading ? 'Dealing...' : 'Deal Cards'}
          </button>
        )}
        {phase === 'playing' && allPlayersStanding && (
          <button onClick={handleDealerTurn} disabled={loading} className="primary-btn">
            {loading ? 'Processing...' : 'Dealer Turn'}
          </button>
        )}
        {phase === 'finished' && results && (
          <div className="results">
            <h2>Game Results</h2>
            <div className="results-list">
              {results.map((result) => (
                <div key={result.playerId} className={`result-item ${result.outcome}`}>
                  <p><strong>{result.username}</strong></p>
                  <p>HP: {result.playerHP} vs Dealer: {result.dealerHP}</p>
                  <p className="outcome">{result.outcome.toUpperCase()}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && <p className="error">{error}</p>}
    </div>
  );
};
