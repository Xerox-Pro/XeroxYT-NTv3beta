
import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';

interface PreferenceContextType {
  preferredGenres: string[];
  preferredChannels: string[];
  preferredDurations: string[];
  preferredFreshness: string;
  discoveryMode: string;
  ngKeywords: string[];
  ngChannels: string[];
  
  // Preferences
  prefDepth: string;      // 'casual' | 'deep' | 'any'
  prefVocal: string;      // 'instrumental' | 'vocal' | 'any'
  prefEra: string;        // 'retro' | 'modern' | 'any'
  prefRegion: string;     // 'domestic' | 'international' | 'any'
  prefLive: string;       // 'live' | 'edited' | 'any'
  prefInfoEnt: string;    // 'education' | 'entertainment' | 'any'
  prefPacing: string;     // 'calm' | 'fast' | 'any'
  prefVisual: string;     // 'real' | 'avatar' | 'any'
  prefCommunity: string;  // 'solo' | 'collab' | 'any'

  useXrai: boolean; // XRAI engine toggle

  addPreferredGenre: (genre: string) => void;
  removePreferredGenre: (genre: string) => void;
  addPreferredChannel: (channel: string) => void;
  removePreferredChannel: (channel: string) => void;
  
  togglePreferredDuration: (duration: string) => void;
  setPreferredFreshness: (freshness: string) => void;
  setDiscoveryMode: (mode: string) => void;
  
  addNgKeyword: (keyword: string) => void;
  removeNgKeyword: (keyword: string) => void;
  
  addNgChannel: (channelId: string) => void;
  removeNgChannel: (channelId: string) => void;
  isNgChannel: (channelId: string) => boolean;

  // Setters
  setPrefDepth: (val: string) => void;
  setPrefVocal: (val: string) => void;
  setPrefEra: (val: string) => void;
  setPrefRegion: (val: string) => void;
  setPrefLive: (val: string) => void;
  setPrefInfoEnt: (val: string) => void;
  setPrefPacing: (val: string) => void;
  setPrefVisual: (val: string) => void;
  setPrefCommunity: (val: string) => void;
  setUseXrai: (use: boolean) => void;

  exportUserData: () => void;
  importUserData: (file: File) => Promise<void>;
}

const PreferenceContext = createContext<PreferenceContextType | undefined>(undefined);

export const PreferenceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Existing Preferences
  const [preferredGenres, setPreferredGenres] = useState<string[]>(() => {
    try { return JSON.parse(window.localStorage.getItem('preferredGenres') || '[]'); } catch { return []; }
  });
  const [preferredChannels, setPreferredChannels] = useState<string[]>(() => {
    try { return JSON.parse(window.localStorage.getItem('preferredChannels') || '[]'); } catch { return []; }
  });
  const [preferredDurations, setPreferredDurations] = useState<string[]>(() => {
    try { return JSON.parse(window.localStorage.getItem('preferredDurations') || '[]'); } catch { return []; }
  });
  const [preferredFreshness, setPreferredFreshness] = useState<string>(() => window.localStorage.getItem('preferredFreshness') || 'balanced');
  const [discoveryMode, setDiscoveryMode] = useState<string>(() => window.localStorage.getItem('discoveryMode') || 'balanced');
  const [ngKeywords, setNgKeywords] = useState<string[]>(() => {
    try { return JSON.parse(window.localStorage.getItem('ngKeywords') || '[]'); } catch { return []; }
  });
  const [ngChannels, setNgChannels] = useState<string[]>(() => {
    try { return JSON.parse(window.localStorage.getItem('ngChannels') || '[]'); } catch { return []; }
  });

  // Preferences
  const [prefDepth, setPrefDepth] = useState(() => window.localStorage.getItem('prefDepth') || 'any');
  const [prefVocal, setPrefVocal] = useState(() => window.localStorage.getItem('prefVocal') || 'any');
  const [prefEra, setPrefEra] = useState(() => window.localStorage.getItem('prefEra') || 'any');
  const [prefRegion, setPrefRegion] = useState(() => window.localStorage.getItem('prefRegion') || 'any');
  const [prefLive, setPrefLive] = useState(() => window.localStorage.getItem('prefLive') || 'any');
  const [prefInfoEnt, setPrefInfoEnt] = useState(() => window.localStorage.getItem('prefInfoEnt') || 'any');
  const [prefPacing, setPrefPacing] = useState(() => window.localStorage.getItem('prefPacing') || 'any');
  const [prefVisual, setPrefVisual] = useState(() => window.localStorage.getItem('prefVisual') || 'any');
  const [prefCommunity, setPrefCommunity] = useState(() => window.localStorage.getItem('prefCommunity') || 'any');
  const [useXrai, setUseXrai] = useState<boolean>(() => window.localStorage.getItem('useXrai') !== 'false');


  // Persistence
  useEffect(() => { localStorage.setItem('preferredGenres', JSON.stringify(preferredGenres)); }, [preferredGenres]);
  useEffect(() => { localStorage.setItem('preferredChannels', JSON.stringify(preferredChannels)); }, [preferredChannels]);
  useEffect(() => { localStorage.setItem('preferredDurations', JSON.stringify(preferredDurations)); }, [preferredDurations]);
  useEffect(() => { localStorage.setItem('preferredFreshness', preferredFreshness); }, [preferredFreshness]);
  useEffect(() => { localStorage.setItem('discoveryMode', discoveryMode); }, [discoveryMode]);
  useEffect(() => { localStorage.setItem('ngKeywords', JSON.stringify(ngKeywords)); }, [ngKeywords]);
  useEffect(() => { localStorage.setItem('ngChannels', JSON.stringify(ngChannels)); }, [ngChannels]);

  useEffect(() => { localStorage.setItem('prefDepth', prefDepth); }, [prefDepth]);
  useEffect(() => { localStorage.setItem('prefVocal', prefVocal); }, [prefVocal]);
  useEffect(() => { localStorage.setItem('prefEra', prefEra); }, [prefEra]);
  useEffect(() => { localStorage.setItem('prefRegion', prefRegion); }, [prefRegion]);
  useEffect(() => { localStorage.setItem('prefLive', prefLive); }, [prefLive]);
  useEffect(() => { localStorage.setItem('prefInfoEnt', prefInfoEnt); }, [prefInfoEnt]);
  useEffect(() => { localStorage.setItem('prefPacing', prefPacing); }, [prefPacing]);
  useEffect(() => { localStorage.setItem('prefVisual', prefVisual); }, [prefVisual]);
  useEffect(() => { localStorage.setItem('prefCommunity', prefCommunity); }, [prefCommunity]);
  useEffect(() => { localStorage.setItem('useXrai', String(useXrai)); }, [useXrai]);

  // Handlers
  const addPreferredGenre = (genre: string) => !preferredGenres.includes(genre) && setPreferredGenres(p => [...p, genre]);
  const removePreferredGenre = (genre: string) => setPreferredGenres(p => p.filter(g => g !== genre));
  const addPreferredChannel = (channel: string) => !preferredChannels.includes(channel) && setPreferredChannels(p => [...p, channel]);
  const removePreferredChannel = (channel: string) => setPreferredChannels(p => p.filter(c => c !== channel));
  const togglePreferredDuration = (d: string) => setPreferredDurations(p => p.includes(d) ? p.filter(x => x !== d) : [...p, d]);
  const addNgKeyword = (k: string) => !ngKeywords.includes(k) && setNgKeywords(p => [...p, k]);
  const removeNgKeyword = (k: string) => setNgKeywords(p => p.filter(x => x !== k));
  const addNgChannel = (id: string) => !ngChannels.includes(id) && setNgChannels(p => [...p, id]);
  const removeNgChannel = (id: string) => setNgChannels(p => p.filter(x => x !== id));
  const isNgChannel = (id: string) => ngChannels.includes(id);

  // Import/Export Logic
  const exportUserData = () => {
    const data = {
      timestamp: new Date().toISOString(),
      version: '1.3',
      subscriptions: JSON.parse(localStorage.getItem('subscribedChannels') || '[]'),
      history: JSON.parse(localStorage.getItem('videoHistory') || '[]'),
      playlists: JSON.parse(localStorage.getItem('playlists') || '[]'),
      preferences: {
        genres: preferredGenres,
        channels: preferredChannels,
        durations: preferredDurations,
        freshness: preferredFreshness,
        discoveryMode: discoveryMode,
        ngKeywords: ngKeywords,
        ngChannels: ngChannels,
        // New preferences
        prefDepth, prefVocal, prefEra, prefRegion,
        prefLive, prefInfoEnt, prefPacing, prefVisual, prefCommunity,
        useXrai,
      }
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `xeroxyt_backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importUserData = async (file: File) => {
    return new Promise<void>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const json = JSON.parse(e.target?.result as string);
          if (!json.subscriptions || !json.history) {
            throw new Error('Invalid backup file format');
          }
          
          // Restore Data
          localStorage.setItem('subscribedChannels', JSON.stringify(json.subscriptions));
          localStorage.setItem('videoHistory', JSON.stringify(json.history));
          localStorage.setItem('playlists', JSON.stringify(json.playlists || []));
          
          if (json.preferences) {
            const p = json.preferences;
            localStorage.setItem('preferredGenres', JSON.stringify(p.genres || []));
            localStorage.setItem('preferredChannels', JSON.stringify(p.channels || []));
            localStorage.setItem('preferredDurations', JSON.stringify(p.durations || []));
            localStorage.setItem('preferredFreshness', p.freshness || 'balanced');
            localStorage.setItem('discoveryMode', p.discoveryMode || 'balanced');
            localStorage.setItem('ngKeywords', JSON.stringify(p.ngKeywords || []));
            localStorage.setItem('ngChannels', JSON.stringify(p.ngChannels || []));

            if (p.prefDepth) localStorage.setItem('prefDepth', p.prefDepth);
            if (p.prefVocal) localStorage.setItem('prefVocal', p.prefVocal);
            if (p.prefEra) localStorage.setItem('prefEra', p.prefEra);
            if (p.prefRegion) localStorage.setItem('prefRegion', p.prefRegion);
            if (p.prefLive) localStorage.setItem('prefLive', p.prefLive);
            if (p.prefInfoEnt) localStorage.setItem('prefInfoEnt', p.prefInfoEnt);
            if (p.prefPacing) localStorage.setItem('prefPacing', p.prefPacing);
            if (p.prefVisual) localStorage.setItem('prefVisual', p.prefVisual);
            if (p.prefCommunity) localStorage.setItem('prefCommunity', p.prefCommunity);
            if (typeof p.useXrai === 'boolean') localStorage.setItem('useXrai', String(p.useXrai));
          }

          // Refresh to load new data into contexts
          window.location.reload();
          resolve();
        } catch (err) {
          console.error(err);
          alert('ファイルの読み込みに失敗しました。正しいバックアップファイルを選択してください。');
          reject(err);
        }
      };
      reader.readAsText(file);
    });
  };

  return (
    <PreferenceContext.Provider value={{
      preferredGenres, preferredChannels, preferredDurations, preferredFreshness, discoveryMode, ngKeywords, ngChannels,
      prefDepth, prefVocal, prefEra, prefRegion, prefLive, prefInfoEnt, prefPacing, prefVisual, prefCommunity,
      useXrai,
      addPreferredGenre, removePreferredGenre, addPreferredChannel, removePreferredChannel, togglePreferredDuration, setPreferredFreshness, setDiscoveryMode, 
      addNgKeyword, removeNgKeyword, addNgChannel, removeNgChannel, isNgChannel,
      setPrefDepth, setPrefVocal, setPrefEra, setPrefRegion, setPrefLive, setPrefInfoEnt, setPrefPacing, setPrefVisual, setPrefCommunity,
      setUseXrai,
      exportUserData, importUserData
    }}>
      {children}
    </PreferenceContext.Provider>
  );
};

export const usePreference = (): PreferenceContextType => {
  const context = useContext(PreferenceContext);
  if (context === undefined) {
    throw new Error('usePreference must be used within a PreferenceProvider');
  }
  return context;
};
