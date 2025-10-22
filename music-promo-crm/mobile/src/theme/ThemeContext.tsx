import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme, Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemeMode = 'light' | 'dark' | 'system';

type ThemeColors = {
  // Brand colors
  primary: string;
  primaryLight: string;
  primaryDark: string;
  secondary: string;
  accent: string;
  
  // Background colors
  background: string;
  surface: string;
  card: string;
  
  // Text colors
  text: string;
  textSecondary: string;
  textTertiary: string;
  
  // Status colors
  success: string;
  warning: string;
  error: string;
  info: string;
  
  // UI elements
  border: string;
  separator: string;
  shadow: string;
  
  // Other
  overlay: string;
  disabled: string;
  placeholder: string;
};

type ThemeType = {
  colors: ThemeColors;
  isDark: boolean;
  mode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
};

const lightColors: ThemeColors = {
  // Brand colors
  primary: '#6200EE',
  primaryLight: '#9E47FF',
  primaryDark: '#0400BA',
  secondary: '#03DAC6',
  accent: '#FF4081',
  
  // Background colors
  background: '#FFFFFF',
  surface: '#F5F5F5',
  card: '#FFFFFF',
  
  // Text colors
  text: '#000000',
  textSecondary: '#757575',
  textTertiary: '#9E9E9E',
  
  // Status colors
  success: '#4CAF50',
  warning: '#FFC107',
  error: '#F44336',
  info: '#2196F3',
  
  // UI elements
  border: '#E0E0E0',
  separator: '#F5F5F5',
  shadow: 'rgba(0, 0, 0, 0.1)',
  
  // Other
  overlay: 'rgba(0, 0, 0, 0.5)',
  disabled: '#BDBDBD',
  placeholder: '#9E9E9E',
};

const darkColors: ThemeColors = {
  // Brand colors
  primary: '#BB86FC',
  primaryLight: '#D1C4E9',
  primaryDark: '#3700B3',
  secondary: '#03DAC6',
  accent: '#FF80AB',
  
  // Background colors
  background: '#121212',
  surface: '#1E1E1E',
  card: '#1E1E1E',
  
  // Text colors
  text: '#FFFFFF',
  textSecondary: '#B0B0B0',
  textTertiary: '#757575',
  
  // Status colors
  success: '#69F0AE',
  warning: '#FFD740',
  error: '#FF5252',
  info: '#40C4FF',
  
  // UI elements
  border: '#2C2C2C',
  separator: '#2C2C2C',
  shadow: 'rgba(0, 0, 0, 0.3)',
  
  // Other
  overlay: 'rgba(0, 0, 0, 0.7)',
  disabled: '#424242',
  placeholder: '#757575',
};

const ThemeContext = createContext<ThemeType | undefined>(undefined);

const THEME_STORAGE_KEY = '@MusicPromoApp:themeMode';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');
  const [isReady, setIsReady] = useState(false);

  // Load saved theme mode from storage
  useEffect(() => {
    const loadThemePreference = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
          setThemeMode(savedTheme as ThemeMode);
        }
      } catch (error) {
        console.error('Failed to load theme preference', error);
      } finally {
        setIsReady(true);
      }
    };

    loadThemePreference();
  }, []);

  // Save theme mode to storage when it changes
  const handleSetThemeMode = async (mode: ThemeMode) => {
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
      setThemeMode(mode);
    } catch (error) {
      console.error('Failed to save theme preference', error);
    }
  };

  // Determine which color scheme to use based on the selected mode
  const isDark = (() => {
    if (themeMode === 'system') {
      return systemColorScheme === 'dark';
    }
    return themeMode === 'dark';
  })();

  const colors = isDark ? darkColors : lightColors;

  if (!isReady) {
    return null; // Or a loading indicator
  }

  return (
    <ThemeContext.Provider
      value={{
        colors,
        isDark,
        mode: themeMode,
        setThemeMode: handleSetThemeMode,
      }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Export color types for use in styled components
export type { ThemeColors };

// Export theme values for use in styled components
export const theme = {
  light: lightColors,
  dark: darkColors,
  spacing: {
    xs: 4,
    s: 8,
    m: 16,
    l: 24,
    xl: 32,
    xxl: 48,
  },
  borderRadius: {
    s: 4,
    m: 8,
    l: 16,
    xl: 24,
    circle: 9999,
  },
  typography: {
    h1: {
      fontSize: 32,
      fontWeight: 'bold',
      lineHeight: 40,
    },
    h2: {
      fontSize: 24,
      fontWeight: '600',
      lineHeight: 32,
    },
    h3: {
      fontSize: 20,
      fontWeight: '600',
      lineHeight: 28,
    },
    body: {
      fontSize: 16,
      lineHeight: 24,
    },
    caption: {
      fontSize: 14,
      lineHeight: 20,
      color: 'textSecondary',
    },
    button: {
      fontSize: 16,
      fontWeight: '600',
      textTransform: 'uppercase',
    },
  },
};
