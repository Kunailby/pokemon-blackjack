import React from 'react';
import './App.css';
import { Auth } from './components/Auth';
import { Lobby } from './components/Lobby';
import { GameBoard } from './components/GameBoard';

type Page = 'auth' | 'lobby' | 'game';

function App() {
  const [page, setPage] = React.useState<Page>('auth');
  const [user, setUser] = React.useState<any>(null);
  const [tableId, setTableId] = React.useState<string>('');

  const handleAuthSuccess = (userData: any) => {
    setUser(userData);
    setPage('lobby');
  };

  const handleGameSelected = (id: string) => {
    setTableId(id);
    setPage('game');
  };

  const handleExit = () => {
    setPage('lobby');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setPage('auth');
  };

  return (
    <div className="app">
      {page === 'auth' && <Auth onAuthSuccess={handleAuthSuccess} />}
      {page === 'lobby' && user && (
        <div>
          <div className="logout-btn-container">
            <button onClick={handleLogout} className="logout-btn">
              Logout
            </button>
          </div>
          <Lobby user={user} onGameSelected={handleGameSelected} />
        </div>
      )}
      {page === 'game' && user && (
        <GameBoard
          tableId={tableId}
          userId={user._id}
          username={user.username}
          onExit={handleExit}
        />
      )}
    </div>
  );
}

export default App;
