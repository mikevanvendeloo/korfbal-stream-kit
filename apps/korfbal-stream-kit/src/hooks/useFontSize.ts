import React, {createContext, useContext, useEffect, useMemo, useState} from 'react';

export type FontSize = 's' | 'm' | 'l' | 'xl';

interface FontSizeContextValue {
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
}

const FontSizeContext = createContext<FontSizeContextValue | undefined>(undefined);

function getInitialFontSize(): FontSize {
  if (typeof window === 'undefined') return 'm';
  const saved = localStorage.getItem('callsheet-font-size');
  if (saved === 'normal' || saved === 'lg') return 'm';
  if (saved === '2xl') return 'xl';
  if (saved && ['s', 'm', 'l', 'xl'].includes(saved)) return saved as FontSize;

  // Default naar 's' op kleine schermen
  if (window.innerWidth < 768) return 's';
  return 'm';
}

interface FontSizeProviderProps {
  children: React.ReactNode;
}

export const FontSizeProvider: React.FC<FontSizeProviderProps> = ({ children }) => {
  const [fontSize, setFontSize] = useState<FontSize>(getInitialFontSize);

  useEffect(() => {
    localStorage.setItem('callsheet-font-size', fontSize);
  }, [fontSize]);

  const value = useMemo(() => ({
    fontSize,
    setFontSize: (size: FontSize) => setFontSize(size)
  }), [fontSize]);

  return React.createElement(FontSizeContext.Provider, { value }, children);
};

export function useFontSize() {
  const context = useContext(FontSizeContext);
  if (!context) {
    return { fontSize: 'm' as FontSize, setFontSize: (_size: FontSize) => {} };
  }
  return context;
}
