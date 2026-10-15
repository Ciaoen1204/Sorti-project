import { appearance } from '../design/platformAppearance';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useEffect,
  useState,
  useContext,
  ReactNode,
} from 'react';

export interface Theme {
  background: string;
  cardBg: string;
  textMain: string;
  textSub: string;
  border: string;
  primary: string;
  onPrimary: string;
  primarySoft: string;
  accent: string;
  accentSoft: string;
  placeholder: string;
  danger: string;
}

const lightTheme: Theme = appearance.light;
const darkTheme: Theme = appearance.dark;

interface ThemeContextType {
  isDarkMode: boolean;
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('sorti_dark_mode')
      .then(value => setIsDarkMode(value === 'true'))
      .catch(() => {});
  }, []);
  const toggleTheme = () => {
    const next = !isDarkMode;
    setIsDarkMode(next);
    AsyncStorage.setItem('sorti_dark_mode', String(next)).catch(() => {});
  };

  const theme = isDarkMode ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ isDarkMode, theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// 建立一個方便頁面調用的 Hook
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme 必須在 ThemeProvider 內使用');
  }
  return context;
};
