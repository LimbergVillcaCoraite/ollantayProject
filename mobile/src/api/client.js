import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

// URL de Oracle Cloud en producción
const API_BASE_URL = Constants.expoConfig?.extra?.apiUrl || 'https://archsoft-system.duckdns.org';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  withCredentials: false,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor para agregar token
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await SecureStore.getItemAsync('authToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      
      const empresa = await SecureStore.getItemAsync('empresaId');
      if (empresa) {
        config.headers['X-User-Company'] = empresa;
      }
      
      const role = await SecureStore.getItemAsync('userRole');
      if (role) {
        config.headers['X-User-Role'] = role;
      }
    } catch (error) {
      console.error('Error loading auth data:', error);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor para manejar errores
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expirado, limpiar sesión
      await SecureStore.deleteItemAsync('authToken');
      await SecureStore.deleteItemAsync('userRole');
      await SecureStore.deleteItemAsync('empresaId');
    }
    return Promise.reject(error);
  }
);

export default api;
export { API_BASE_URL };
