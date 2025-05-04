import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'https://smartsave-app-hufqgaczbjebc0ct.centralindia-01.azurewebsites.net/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('token');
      console.log('Token from AsyncStorage:', token ? 'Present' : 'Not Present');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      } else {
        delete config.headers.Authorization;
      }
      console.log('API Request:', config.method.toUpperCase(), config.url, config.headers, config.data);
    } catch (error) {
      console.error('Error fetching token:', error);
    }
    return config;
  },
  (error) => {
    console.error('Error in request interceptor:', error);
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    console.log('API Response:', response.data);
    return response;
  },
  async (error) => {
    if (error.response) {
      console.error('API Response Error:', error.response.data || error.message);
      if (error.response.status === 401 && error.config.url !== '/auth/logout') {
        const token = await AsyncStorage.getItem('token');
        if (token) {
          console.log('Received 401 (not logout) with token, clearing token...');
          await AsyncStorage.removeItem('token');
        } else {
          console.log('Received 401, but no token present—ignoring');
        }
      }
    } else {
      console.error('Network Error:', error.message, error.config);
    }
    return Promise.reject(error);
  }
);

export const getGroup = async (groupId) => {
  return api.get(`/splits/groups/${groupId}`);
};

export const searchUsers = async (query) => {
  return api.get('/splits/users/search', { params: { q: query } });
};

export const getUserGroups = async () => {
  return api.get('/splits/groups');
};

export const getBillSplits = async () => {
  return api.get('/splits/bill_splits');
};

export const getSettlements = async () => {
  return api.get('/splits/settlements');
};

export const createGroup = async (groupData) => {
  return api.post('/splits/groups', groupData);
};

export const addSettlement = async (settlementData) => {
  return api.post('/splits/settlements', settlementData);
};

export default api;