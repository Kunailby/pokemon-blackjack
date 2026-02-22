import axios from 'axios';

const PLAY_API_BASE_URL = 'http://localhost:5000/api/play';

const playClient = axios.create({
  baseURL: PLAY_API_BASE_URL,
});

playClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const playService = {
  dealCards: (tableId: string) => playClient.post('/deal', { tableId }),
  playerHit: (tableId: string, playerId: string) =>
    playClient.post('/hit', { tableId, playerId }),
  playerStand: (tableId: string, playerId: string) =>
    playClient.post('/stand', { tableId, playerId }),
  dealerTurn: (tableId: string) => playClient.post('/dealer-turn', { tableId }),
  getGameState: (tableId: string) => playClient.get(`/state/${tableId}`),
};
