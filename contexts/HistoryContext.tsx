
import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback } from 'react';
import type { Video } from '../types';

interface HistoryContextType {
  history: Video[];
  addVideoToHistory: (video: Video) => void;
}

const HistoryContext = createContext<HistoryContextType | undefined>(undefined);

const HISTORY_KEY = 'videoHistory';
const MAX_HISTORY_LENGTH = 200;

export const HistoryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [history, setHistory] = useState<Video[]>(() => {
    try {
      const item = window.localStorage.getItem(HISTORY_KEY);
      return item ? JSON.parse(item) : [];
    } catch (error) {
      console.error("Failed to parse history from localStorage", error);
      return [];
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch (error) {
      console.error("Failed to save history to localStorage", error);
    }
  }, [history]);

  const addVideoToHistory = useCallback((video: Video) => {
    setHistory(prev => {
      // 既存の履歴から同じIDの動画を削除し、新しい動画を先頭に追加する
      const newHistory = [video, ...prev.filter(v => v.id !== video.id)];
      // 最大履歴長を超えないように切り詰める
      return newHistory.slice(0, MAX_HISTORY_LENGTH);
    });
  }, []);

  return (
    <HistoryContext.Provider value={{ history, addVideoToHistory }}>
      {children}
    </HistoryContext.Provider>
  );
};

export const useHistory = (): HistoryContextType => {
  const context = useContext(HistoryContext);
  if (context === undefined) {
    throw new Error('useHistory must be used within a HistoryProvider');
  }
  return context;
};
