import React from 'react';
import './App.css';
// import { Auth } from './components/Auth';
import { Lobby } from './components/Lobby';
import { GameBoard } from './components/GameBoard';

type Page = 'lobby' | 'game';

function App() {
  const [page, setPage] = React.useState<Page>('lobby');
  const [user, setUser] = React.useState<any>(null);
  const [tableId, setTableId] = React.useState<string>('');

  React.useEffect(() => {
    // Generate random username on load
    const randomName = 'Player' + Math.floor(Math.random() * 10000);
    setUser({ username: randomName });
  }, []);

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
      {page === 'lobby' && user && (
        <Lobby user={user} onGameSelected={handleGameSelected} />
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
