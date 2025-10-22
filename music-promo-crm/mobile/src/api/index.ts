import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { Platform } from 'react-native';
import { getAuthToken } from '../context/AuthContext';
import { API_BASE_URL } from '../config';

// Create axios instance with base URL
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 seconds
  headers: {
    'Content-Type': 'application/json',
    'X-Platform': Platform.OS,
  },
});

// Request interceptor to add auth token to requests
api.interceptors.request.use(
  async (config) => {
    // Don't add token to auth routes
    const isAuthRequest = config.url?.includes('/auth/');
    
    if (!isAuthRequest) {
      const token = await getAuthToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for handling common errors
api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response.data;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as any;
    
    // Handle token expiration (401 Unauthorized)
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // Here you could implement token refresh logic if your API supports it
        // For now, we'll just reject the promise
        return Promise.reject(error);
      } catch (refreshError) {
        return Promise.reject(refreshError);
      }
    }
    
    // Handle other errors
    return Promise.reject(error);
  }
);

// API methods
export const auth = {
  login: (email: string, password: string) => 
    api.post('/auth/login', { email, password }),
  
  register: (name: string, email: string, password: string) => 
    api.post('/auth/register', { name, email, password }),
    
  forgotPassword: (email: string) => 
    api.post('/auth/forgot-password', { email }),
    
  resetPassword: (token: string, password: string) => 
    api.post('/auth/reset-password', { token, password }),
};

export const campaigns = {
  getAll: (params?: any) => api.get('/campaigns', { params }),
  getById: (id: string) => api.get(`/campaigns/${id}`),
  create: (data: any) => api.post('/campaigns', data),
  update: (id: string, data: any) => api.put(`/campaigns/${id}`, data),
  delete: (id: string) => api.delete(`/campaigns/${id}`),
  getAnalytics: (id: string) => api.get(`/campaigns/${id}/analytics`),
};

export const contacts = {
  getAll: (params?: any) => api.get('/contacts', { params }),
  getById: (id: string) => api.get(`/contacts/${id}`),
  create: (data: any) => api.post('/contacts', data),
  update: (id: string, data: any) => api.put(`/contacts/${id}`, data),
  delete: (id: string) => api.delete(`/contacts/${id}`),
  import: (data: any) => api.post('/contacts/import', data),
};

export const emailTemplates = {
  getAll: (params?: any) => api.get('/email-templates', { params }),
  getById: (id: string) => api.get(`/email-templates/${id}`),
  create: (data: any) => api.post('/email-templates', data),
  update: (id: string, data: any) => api.put(`/email-templates/${id}`, data),
  delete: (id: string) => api.delete(`/email-templates/${id}`),
};

export const analytics = {
  getCampaignAnalytics: (campaignId: string) => 
    api.get(`/analytics/campaigns/${campaignId}`),
  getUserEngagement: () => 
    api.get('/analytics/engagement/me'),
};

export const ai = {
  analyzeContent: (content: string) => 
    api.post('/ai/analyze-content', { content }),
  generateSubjectLines: (content: string, count: number = 5) => 
    api.post('/ai/generate-subject-lines', { content, count }),
  personalizeContent: (content: string, userData: any) => 
    api.post('/ai/personalize-content', { content, userData }),
};

export const user = {
  getProfile: () => api.get('/users/me'),
  updateProfile: (data: any) => api.patch('/users/me', data),
  changePassword: (currentPassword: string, newPassword: string) => 
    api.post('/users/change-password', { currentPassword, newPassword }),
  uploadAvatar: (formData: FormData) => 
    api.post('/users/me/avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }),
};

export default api;
