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
    // Generate random username and ID on load
    const randomName = 'Player' + Math.floor(Math.random() * 10000);
    const randomId = 'user_' + Math.random().toString(36).substring(2, 15);
    setUser({ username: randomName, _id: randomId });
  }, []);

  const handleGameSelected = (id: string) => {
    setTableId(id);
    setPage('game');
  };

  const handleExit = () => {
    setPage('lobby');
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
