import axios from 'axios';
const API_BASE_URL = 'https://pokemon-blackjack-28yc.onrender.com/api';
const apiClient = axios.create({ baseURL: API_BASE_URL });

export const gameService = {
  createGame: (username: string, oderId: string) => 
    apiClient.post('/games/create', { username, oderId }),
  joinGame: (inviteCode: string, username: string, oderId: string) => 
    apiClient.post('/games/join', { inviteCode, username, oderId }),
  listGames: () => apiClient.get('/games/available'),
  getGame: (tableId: string) => apiClient.get(`/games/${tableId}`),
  startGame: (tableId: string, oderId: string) => 
    apiClient.post(`/games/${tableId}/start`, { oderId }),
};

export const cardService = {
  listCards: () => apiClient.get('/cards'),
  seedCards: () => apiClient.post('/cards/seed'),
};
