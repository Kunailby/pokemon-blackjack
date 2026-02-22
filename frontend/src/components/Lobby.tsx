import React from 'react';
import './Lobby.css';
import { gameService } from '../services/api';

interface LobbyProps {
  user: any;
  onGameSelected: (tableId: string) => void;
}

export const Lobby: React.FC<LobbyProps> = ({ user, onGameSelected }) => {
  const [games, setGames] = React.useState<any[]>([]);
  const [inviteCode, setInviteCode] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    loadGames();
    const interval = setInterval(loadGames, 2000);
    return () => clearInterval(interval);
  }, []);

  const loadGames = async () => {
    try {
      const response = await gameService.listGames();
      setGames(response.data);
    } catch (err) {
      console.error('Failed to load games:', err);
    }
  };

  const handleCreateGame = async () => {
    setLoading(true);
    try {
      const response = await gameService.createGame();
      onGameSelected(response.data._id);
    } catch (err: any) {
      setError('Failed to create game');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinGame = async () => {
    if (!inviteCode.trim()) {
      setError('Please enter an invite code');
      return;
    }

    setLoading(true);
    try {
      const response = await gameService.joinGame(inviteCode);
      onGameSelected(response.data._id);
    } catch (err: any) {
      setError('Failed to join game');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lobby-container">
      <div className="lobby-header">
        <h1>Pokémon Blackjack Lobby</h1>
        <p>Welcome, {user?.username || 'Player'}!</p>
      </div>

      <div className="lobby-content">
        <div className="create-game-section">
          <h2>Create New Game</h2>
          <button onClick={handleCreateGame} disabled={loading}>
            {loading ? 'Creating...' : 'Create Game'}
          </button>
        </div>

        <div className="join-game-section">
          <h2>Join Game with Code</h2>
          <div className="join-input-group">
            <input
              type="text"
              placeholder="Enter invite code"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleJoinGame()}
            />
            <button onClick={handleJoinGame} disabled={loading}>
              {loading ? 'Joining...' : 'Join'}
            </button>
          </div>
        </div>

        {error && <p className="error">{error}</p>}

        <div className="available-games">
          <h2>Available Games</h2>
          {games.length === 0 ? (
            <p>No games available</p>
          ) : (
            <div className="games-list">
              {games.map((game) => (
                <div key={game._id} className="game-card">
                  <div className="game-info">
                    <h3>Code: {game.inviteCode}</h3>
                    <p>Players: {game.players.length}/6</p>
                    <p>Status: {game.gameStatus}</p>
                  </div>
                  <button
                    onClick={() => {
                      setInviteCode(game.inviteCode);
                      handleJoinGame();
                    }}
                  >
                    Join
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
