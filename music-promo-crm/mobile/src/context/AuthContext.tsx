import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api';
import { Alert } from 'react-native';

type User = {
  id: string;
  name: string;
  email: string;
  // Add other user properties as needed
};

type AuthContextData = {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: Partial<User>) => void;
};

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

const AUTH_TOKEN_KEY = '@MusicPromoApp:authToken';
const USER_KEY = '@MusicPromoApp:user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load user and token from storage on app start
  useEffect(() => {
    const loadAuthData = async () => {
      try {
        const [userData, token] = await Promise.all([
          AsyncStorage.getItem(USER_KEY),
          AsyncStorage.getItem(AUTH_TOKEN_KEY),
        ]);

        if (userData && token) {
          // Set the auth token for API calls
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          setUser(JSON.parse(userData));
        }
      } catch (error) {
        console.error('Failed to load authentication data', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadAuthData();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      const response = await api.post('/auth/login', { email, password });
      
      const { user: userData, token } = response.data;
      
      // Store user and token
      await Promise.all([
        AsyncStorage.setItem(USER_KEY, JSON.stringify(userData)),
        AsyncStorage.setItem(AUTH_TOKEN_KEY, token),
      ]);
      
      // Set the auth token for future API calls
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      // Update the user state
      setUser(userData);
    } catch (error: any) {
      console.error('Login error:', error);
      throw new Error(
        error.response?.data?.message || 'Failed to login. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (name: string, email: string, password: string) => {
    try {
      setIsLoading(true);
      const response = await api.post('/auth/register', { name, email, password });
      
      const { user: userData, token } = response.data;
      
      // Store user and token
      await Promise.all([
        AsyncStorage.setItem(USER_KEY, JSON.stringify(userData)),
        AsyncStorage.setItem(AUTH_TOKEN_KEY, token),
      ]);
      
      // Set the auth token for future API calls
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      // Update the user state
      setUser(userData);
    } catch (error: any) {
      console.error('Registration error:', error);
      throw new Error(
        error.response?.data?.message || 'Failed to register. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setIsLoading(true);
      
      // Clear storage
      await Promise.all([
        AsyncStorage.removeItem(USER_KEY),
        AsyncStorage.removeItem(AUTH_TOKEN_KEY),
      ]);
      
      // Remove auth header
      delete api.defaults.headers.common['Authorization'];
      
      // Clear user state
      setUser(null);
    } catch (error) {
      console.error('Failed to logout', error);
      Alert.alert('Error', 'Failed to logout. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const updateUser = (updatedUser: Partial<User>) => {
    if (!user) return;
    
    const newUser = { ...user, ...updatedUser };
    setUser(newUser);
    
    // Update user in storage
    AsyncStorage.setItem(USER_KEY, JSON.stringify(newUser)).catch(console.error);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        register,
        logout,
        updateUser,
      }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
};

// Helper function to check if user is authenticated
export const isAuthenticated = async (): Promise<boolean> => {
  try {
    const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    return !!token;
  } catch (error) {
    console.error('Error checking authentication status', error);
    return false;
  }
};

// Helper function to get the current user
export const getCurrentUser = async (): Promise<User | null> => {
  try {
    const userData = await AsyncStorage.getItem(USER_KEY);
    return userData ? JSON.parse(userData) : null;
  } catch (error) {
    console.error('Error getting current user', error);
    return null;
  }
};

// Helper function to get the auth token
export const getAuthToken = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  } catch (error) {
    console.error('Error getting auth token', error);
    return null;
  }
};
