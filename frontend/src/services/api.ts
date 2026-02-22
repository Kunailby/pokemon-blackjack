import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authService = {
  register: (email: string, username: string, password: string) =>
    apiClient.post('/auth/register', { email, username, password }),
  login: (email: string, password: string) =>
    apiClient.post('/auth/login', { email, password }),
  getProfile: () => apiClient.get('/auth/profile'),
};

export const gameService = {
  createGame: () => apiClient.post('/games/create'),
  joinGame: (inviteCode: string) => apiClient.post('/games/join', { inviteCode }),
  listGames: () => apiClient.get('/games/list'),
  getGame: (tableId: string) => apiClient.get(`/games/${tableId}`),
  startGame: (tableId: string) => apiClient.post(`/games/${tableId}/start`),
};

export const cardService = {
  listCards: () => apiClient.get('/cards'),
  seedCards: () => apiClient.post('/cards/seed'),
};
