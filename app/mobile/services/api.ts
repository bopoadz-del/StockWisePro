import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// API Configuration
const API_BASE_URL = Platform.select({
  ios: 'http://localhost:3001/api',
  android: 'http://10.0.2.2:3001/api',
  default: 'http://localhost:3001/api',
});

// For production, update this to your deployed backend URL
const PRODUCTION_API_URL = 'https://your-backend.onrender.com/api';

const BASE_URL = __DEV__ ? API_BASE_URL : PRODUCTION_API_URL;

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Something went wrong');
  }

  return data;
}

// Auth API
export const authApi = {
  login: async (email: string, password: string) => {
    return apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  register: async (email: string, password: string, name: string) => {
    return apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
  },

  getProfile: async (token: string) => {
    return apiRequest('/auth/profile', {}, token);
  },

  updateProfile: async (data: { name?: string; email?: string }, token: string) => {
    return apiRequest('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }, token);
  },
};

// Stock API
export const stockApi = {
  getAll: async (token?: string) => {
    return apiRequest('/stocks', {}, token);
  },

  getByTicker: async (ticker: string, token?: string) => {
    return apiRequest(`/stocks/${ticker}`, {}, token);
  },

  search: async (query: string, token?: string) => {
    return apiRequest(`/stocks/search?q=${encodeURIComponent(query)}`, {}, token);
  },

  getQuote: async (ticker: string, token?: string) => {
    return apiRequest(`/stocks/${ticker}/quote`, {}, token);
  },

  getHistorical: async (ticker: string, range: string = '1M', token?: string) => {
    return apiRequest(`/stocks/${ticker}/historical?range=${range}`, {}, token);
  },

  getScore: async (ticker: string, token?: string) => {
    return apiRequest(`/stocks/${ticker}/score`, {}, token);
  },
};

// Watchlist API
export const watchlistApi = {
  getWatchlist: async (token: string) => {
    return apiRequest('/watchlist', {}, token);
  },

  addItem: async (data: { ticker: string; alertPrice?: number; notes?: string }, token: string) => {
    return apiRequest('/watchlist', {
      method: 'POST',
      body: JSON.stringify(data),
    }, token);
  },

  removeItem: async (id: string, token: string) => {
    return apiRequest(`/watchlist/${id}`, {
      method: 'DELETE',
    }, token);
  },

  updateItem: async (id: string, data: { alertPrice?: number; notes?: string }, token: string) => {
    return apiRequest(`/watchlist/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }, token);
  },
};

// Portfolio API
export const portfolioApi = {
  getPortfolio: async (token: string) => {
    return apiRequest('/portfolio', {}, token);
  },

  addHolding: async (data: { ticker: string; shares: number; avgPrice: number }, token: string) => {
    return apiRequest('/portfolio/holdings', {
      method: 'POST',
      body: JSON.stringify(data),
    }, token);
  },

  removeHolding: async (id: string, token: string) => {
    return apiRequest(`/portfolio/holdings/${id}`, {
      method: 'DELETE',
    }, token);
  },

  mimicInvestor: async (investorId: string, budget: number, token: string) => {
    return apiRequest('/portfolio/mimic', {
      method: 'POST',
      body: JSON.stringify({ investorId, budget }),
    }, token);
  },
};

// Alerts API
export const alertsApi = {
  getAlerts: async (token: string) => {
    return apiRequest('/alerts', {}, token);
  },

  createAlert: async (data: { ticker: string; targetPrice: number; condition: 'above' | 'below' }, token: string) => {
    return apiRequest('/alerts', {
      method: 'POST',
      body: JSON.stringify(data),
    }, token);
  },

  deleteAlert: async (id: string, token: string) => {
    return apiRequest(`/alerts/${id}`, {
      method: 'DELETE',
    }, token);
  },
};

// Experiments API
export const experimentsApi = {
  getExperiments: async (token: string) => {
    return apiRequest('/experiments', {}, token);
  },

  createExperiment: async (data: {
    name: string;
    description?: string;
    formula: string;
    backtestParams?: any;
  }, token: string) => {
    return apiRequest('/experiments', {
      method: 'POST',
      body: JSON.stringify(data),
    }, token);
  },

  runExperiment: async (id: string, token: string) => {
    return apiRequest(`/experiments/${id}/run`, {
      method: 'POST',
    }, token);
  },

  deleteExperiment: async (id: string, token: string) => {
    return apiRequest(`/experiments/${id}`, {
      method: 'DELETE',
    }, token);
  },
};

// User API
export const userApi = {
  getProfile: async (token: string) => {
    return apiRequest('/users/profile', {}, token);
  },

  updateProfile: async (data: { name?: string; email?: string }, token: string) => {
    return apiRequest('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }, token);
  },

  getSubscription: async (token: string) => {
    return apiRequest('/users/subscription', {}, token);
  },

  updateSettings: async (settings: any, token: string) => {
    return apiRequest('/users/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    }, token);
  },
};

// Analytics API
export const analyticsApi = {
  trackEvent: async (event: { type: string; payload: any }, token?: string) => {
    return apiRequest('/analytics/event', {
      method: 'POST',
      body: JSON.stringify(event),
    }, token);
  },

  getStats: async (token: string) => {
    return apiRequest('/analytics/stats', {}, token);
  },
};
