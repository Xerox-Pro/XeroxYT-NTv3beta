

import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import type { Channel } from '../types';

interface SubscriptionContextType {
  subscribedChannels: Channel[];
  subscribe: (channel: Channel) => void;
  unsubscribe: (channelId: string) => void;
  isSubscribed: (channelId: string) => boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const SubscriptionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [subscribedChannels, setSubscribedChannels] = useState<Channel[]>(() => {
    try {
      const item = window.localStorage.getItem('subscribedChannels');
      return item ? JSON.parse(item) : [];
    } catch (error) {
      console.error(error);
      return [];
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem('subscribedChannels', JSON.stringify(subscribedChannels));
    // FIX: Added curly braces to the catch block to fix a syntax error.
    } catch (error) {
      console.error(error);
    }
  }, [subscribedChannels]);

  const subscribe = (channel: Channel) => {
    setSubscribedChannels(prev => {
      if (prev.some(c => c.id === channel.id)) {
        return prev;
      }
      return [...prev, channel];
    });
  };

  const unsubscribe = (channelId: string) => {
    setSubscribedChannels(prev => prev.filter(c => c.id !== channelId));
  };

  const isSubscribed = (channelId: string) => {
    return subscribedChannels.some(c => c.id === channelId);
  };

  return (
    <SubscriptionContext.Provider value={{ subscribedChannels, subscribe, unsubscribe, isSubscribed }}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = (): SubscriptionContextType => {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};