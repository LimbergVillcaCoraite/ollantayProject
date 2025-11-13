import api from './client';

export const authAPI = {
  login: async (usuario, contrasena) => {
    // Persona service: POST /auth/login via reverse proxy /api/personas/
    const response = await api.post('/api/personas/auth/login', { username: usuario, password: contrasena });
    return response.data;
  },
  
  logout: async () => {
    // Persona service: POST /auth/logout
    const response = await api.post('/api/personas/auth/logout');
    return response.data;
  },
  
  getSession: async () => {
    // Persona service: GET /auth/me (perfil desde cookie JWT)
    const response = await api.get('/api/personas/auth/me');
    return response.data;
  },
};

export const ventasAPI = {
  getAll: async (params = {}) => {
    // Ventas service proxied at /api/ventas
    const response = await api.get('/api/ventas', { params });
    return response.data;
  },
  
  getById: async (id) => {
    const response = await api.get(`/api/ventas/${id}`);
    return response.data;
  },
  
  create: async (data) => {
    const response = await api.post('/api/ventas', data);
    return response.data;
  },
  
  getCreditos: async (clienteId) => {
    const response = await api.get(`/api/ventas/creditos/${clienteId}`);
    return response.data;
  },
};

export const productosAPI = {
  getAll: async (params = {}) => {
    const response = await api.get('/api/prestamos', { params });
    return response.data;
  },
  
  getById: async (id) => {
    const response = await api.get(`/api/prestamos/${id}`);
    return response.data;
  },
  
  getByBarcode: async (codigo) => {
    const response = await api.get(`/api/prestamos/barcode/${codigo}`);
    return response.data;
  },
};

export const personasAPI = {
  getAll: async (params = {}) => {
    const response = await api.get('/api/personas/list', { params });
    return response.data;
  },
  
  getById: async (id) => {
    const response = await api.get(`/api/personas/${id}`);
    return response.data;
  },
  
  search: async (query) => {
    const response = await api.get('/api/personas/search', { params: { q: query } });
    return response.data;
  },
};

export const entregasAPI = {
  getAll: async (params = {}) => {
    const response = await api.get('/api/entregas', { params });
    return response.data;
  },
  
  updateStatus: async (id, estado) => {
    const response = await api.patch(`/api/entregas/${id}/estado`, { estado });
    return response.data;
  },
  
  confirmarEntrega: async (id, data) => {
    const response = await api.post(`/api/entregas/${id}/confirmar`, data);
    return response.data;
  },
};

export const rutasAPI = {
  getAll: async () => {
    const response = await api.get('/api/rutas');
    return response.data;
  },
  
  getById: async (id) => {
    const response = await api.get(`/api/rutas/${id}`);
    return response.data;
  },
};
