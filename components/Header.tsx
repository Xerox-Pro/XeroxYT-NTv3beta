

import React, { useState, useEffect, useRef } from 'react';
// FIX: Use named imports for react-router-dom components and hooks.
import { useNavigate, Link } from 'react-router-dom';
import { MenuIcon, SearchIcon, SettingsIcon, SaveIcon, DownloadIcon, TrashIcon, HistoryIcon, CheckIcon, SunIcon, MoonIcon, LightbulbIcon, XeroxLogo } from './icons/Icons';
import { useSearchHistory } from '../contexts/SearchHistoryContext';
import { usePreference } from '../contexts/PreferenceContext';
import { useHistory } from '../contexts/HistoryContext';
import { useTheme, type Theme } from '../hooks/useTheme';

interface HeaderProps {
  toggleSidebar: () => void;
  openHistoryDeletionModal: () => void;
  openSearchHistoryDeletionModal: () => void;
}

const Header: React.FC<HeaderProps> = ({ toggleSidebar, openHistoryDeletionModal, openSearchHistoryDeletionModal }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [useProxy, setUseProxy] = useState(localStorage.getItem('useChannelHomeProxy') !== 'false');

  const { theme, setTheme } = useTheme();
  const { addSearchTerm, clearSearchHistory } = useSearchHistory();
  const { exportUserData, importUserData, isShortsAutoplayEnabled, toggleShortsAutoplay } = usePreference();
  const { clearHistory } = useHistory();
  const navigate = useNavigate();
  const settingsRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      addSearchTerm(searchQuery.trim());
      navigate(`/results?search_query=${encodeURIComponent(searchQuery.trim())}`);
    }
  };
  
  const handleSettingsClick = () => {
      setIsSettingsOpen(prev => !prev);
  };

  const toggleProxy = () => {
      const newValue = !useProxy;
      setUseProxy(newValue);
      localStorage.setItem('useChannelHomeProxy', String(newValue));
      window.location.reload();
  };

  const handleImportClick = () => {
      fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          await importUserData(file);
      }
  };

  const handleClearAllHistory = () => {
      if (window.confirm('視聴履歴をすべて削除しますか？この操作は取り消せません。')) {
          clearHistory();
          alert('視聴履歴を削除しました。');
      }
  };

  const handleClearAllSearchHistory = () => {
      if (window.confirm('検索履歴をすべて削除しますか？この操作は取り消せません。')) {
          clearSearchHistory();
          alert('検索履歴を削除しました。');
      }
  };

  const handleResetUserData = () => {
    if (window.confirm('警告: すべてのユーザーデータ（登録チャンネル、履歴、設定など）がリセットされます。この操作は元に戻せません。よろしいですか？')) {
        const currentTheme = localStorage.getItem('theme');
        localStorage.clear();
        if (currentTheme) {
            localStorage.setItem('theme', currentTheme);
        }
        window.location.reload();
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
            setIsSettingsOpen(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  let headerBgClass = 'bg-yt-white dark:bg-yt-black border-b border-yt-spec-light-20 dark:border-yt-spec-20';
  if (theme === 'light-glass') {
    // Use the class defined in styles.css for the strong glass effect
    headerBgClass = 'glass-panel';
  }

  // Determine logo variant
  const logoVariant = theme === 'light-glass' ? 'glass' : theme === 'light' ? 'light' : 'dark';

  const ThemeSelectItem: React.FC<{ value: Theme, label: string, icon: React.ReactNode }> = ({ value, label, icon }) => (
    <button
        onClick={() => setTheme(value)}
        className="w-full text-left flex items-center justify-between px-4 py-2 hover:bg-yt-spec-light-10 dark:hover:bg-yt-spec-10 text-sm text-black dark:text-white"
    >
        <div className="flex items-center gap-2">
            {icon}
            <span>{label}</span>
        </div>
        {theme === value && <CheckIcon />}
    </button>
  );

  return (
    <header className={`fixed top-0 left-0 right-0 h-14 flex items-center justify-between px-4 z-50 transition-colors duration-300 ${headerBgClass}`}>
      {/* Left Section */}
      <div className="flex items-center space-x-4">
        <button onClick={toggleSidebar} className="p-2 rounded-full hover:bg-yt-spec-light-10 dark:hover:bg-yt-spec-10 active:scale-95 transform transition-transform duration-150 hidden md:block" aria-label="サイドバーの切り替え">
          <MenuIcon />
        </button>
        <Link to="/" className="flex items-center gap-2" aria-label="YouTubeホーム">
            <XeroxLogo className="h-8 w-auto" variant={logoVariant} />
            <div className="hidden sm:flex items-baseline">
                <span className="text-black dark:text-white text-xl font-bold tracking-tighter font-sans">XeroxYT-NTv3β</span>
            </div>
        </Link>
      </div>

      {/* Center Section */}
      <div className="flex-1 flex justify-center px-4 lg:px-16 max-w-[720px] mx-auto">
        <form onSubmit={handleSearch} className="w-full flex items-center gap-4">
          <div className="flex w-full items-center rounded-full shadow-inner border border-yt-light-gray/20 dark:border-white/10 bg-white/20 dark:bg-black/20 focus-within:border-yt-blue focus-within:bg-white/40 dark:focus-within:bg-black/40 transition-all overflow-hidden ml-0 md:ml-8 backdrop-blur-sm">
            <div className="flex-1 relative">
                 <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none sm:hidden">
                    <SearchIcon />
                 </div>
                <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="検索"
                className="w-full h-10 bg-transparent pl-10 sm:pl-4 pr-4 text-base text-black dark:text-white placeholder-yt-light-gray focus:outline-none"
                />
            </div>
            <button
                type="submit"
                className="bg-yt-light/50 dark:bg-white/5 h-10 px-6 border-l border-yt-light-gray/20 dark:border-white/10 hover:bg-stone-200 dark:hover:bg-white/10 transition-colors w-16 flex items-center justify-center"
                aria-label="検索"
            >
                <SearchIcon />
            </button>
          </div>
        </form>
      </div>

      {/* Right Section */}
      <div className="flex items-center space-x-0 sm:space-x-2 md:space-x-4">
        <div className="relative" ref={settingsRef}>
            <button 
                onClick={handleSettingsClick}
                className="p-2 rounded-full hover:bg-yt-spec-light-10 dark:hover:bg-yt-spec-10 active:scale-95 transform transition-transform duration-150" 
                aria-label="設定"
            >
                <SettingsIcon />
            </button>
            
            <div className={`absolute top-12 right-0 w-72 bg-yt-white/70 dark:bg-black/70 backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/20 dark:border-white/10 py-2 overflow-hidden z-50 transition-all duration-200 ease-out ${isSettingsOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'}`}>
                <div className="max-h-[80vh] overflow-y-auto">
                    <div className="py-2">
                        <div className="px-4 py-2 text-xs font-bold text-yt-light-gray uppercase tracking-wider">テーマ</div>
                        <ThemeSelectItem value="light-glass" label="ライト (ガラス)" icon={<SunIcon />} />
                        <ThemeSelectItem value="light" label="ライト (標準)" icon={<SunIcon />} />
                        <ThemeSelectItem value="dark" label="ダーク (標準)" icon={<MoonIcon />} />

                        <hr className="my-2 border-yt-spec-light-20 dark:border-yt-spec-20" />
                        <div className="px-4 py-2 text-xs font-bold text-yt-light-gray uppercase tracking-wider">一般設定</div>
                        <label className="flex items-center justify-between px-4 py-2 hover:bg-yt-spec-light-10 dark:hover:bg-yt-spec-10 cursor-pointer">
                            <span className="text-sm text-black dark:text-white">Proxy経由で取得</span>
                            <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
                                <input 
                                    type="checkbox" 
                                    name="toggle" 
                                    id="toggle" 
                                    className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer checked:right-0 right-5"
                                    checked={useProxy}
                                    onChange={toggleProxy}
                                />
                                <div className={`toggle-label block overflow-hidden h-5 rounded-full cursor-pointer ${useProxy ? 'bg-yt-blue' : 'bg-yt-light-gray'}`}></div>
                            </div>
                        </label>
                        <label className="flex items-center justify-between px-4 py-2 hover:bg-yt-spec-light-10 dark:hover:bg-yt-spec-10 cursor-pointer">
                            <span className="text-sm text-black dark:text-white">ショートを自動再生</span>
                            <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
                                <input 
                                    type="checkbox" 
                                    name="shortsAutoplayToggle" 
                                    id="shortsAutoplayToggle" 
                                    className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer checked:right-0 right-5"
                                    checked={isShortsAutoplayEnabled}
                                    onChange={toggleShortsAutoplay}
                                />
                                <div className={`toggle-label block overflow-hidden h-5 rounded-full cursor-pointer ${isShortsAutoplayEnabled ? 'bg-yt-blue' : 'bg-yt-light-gray'}`}></div>
                            </div>
                        </label>

                        <hr className="my-2 border-yt-spec-light-20 dark:border-yt-spec-20" />

                        <div className="px-4 py-2 text-xs font-bold text-yt-light-gray uppercase tracking-wider">コンテンツ管理</div>
                        <Link 
                            to="/management"
                            onClick={() => setIsSettingsOpen(false)}
                            className="w-full text-left flex items-center px-4 py-2 hover:bg-yt-spec-light-10 dark:hover:bg-yt-spec-10 text-sm text-black dark:text-white gap-2"
                        >
                            <SettingsIcon />
                            非表示/ブロックの管理
                        </Link>

                        <hr className="my-2 border-yt-spec-light-20 dark:border-yt-spec-20" />

                        <div className="px-4 py-2 text-xs font-bold text-yt-light-gray uppercase tracking-wider">履歴管理</div>
                        
                        {/* Watch History */}
                        <button 
                            onClick={handleClearAllHistory}
                            className="w-full text-left flex items-center px-4 py-2 hover:bg-yt-spec-light-10 dark:hover:bg-yt-spec-10 text-sm text-black dark:text-white gap-2"
                        >
                            <TrashIcon />
                            全ての視聴履歴を削除
                        </button>
                        <button 
                            onClick={() => { openHistoryDeletionModal(); setIsSettingsOpen(false); }}
                            className="w-full text-left flex items-center px-4 py-2 hover:bg-yt-spec-light-10 dark:hover:bg-yt-spec-10 text-sm text-black dark:text-white gap-2"
                        >
                            <HistoryIcon />
                            視聴履歴を選択して削除
                        </button>

                        <div className="my-1"></div>

                        {/* Search History */}
                        <button 
                            onClick={handleClearAllSearchHistory}
                            className="w-full text-left flex items-center px-4 py-2 hover:bg-yt-spec-light-10 dark:hover:bg-yt-spec-10 text-sm text-black dark:text-white gap-2"
                        >
                            <TrashIcon />
                            全ての検索履歴を削除
                        </button>
                        <button 
                            onClick={() => { openSearchHistoryDeletionModal(); setIsSettingsOpen(false); }}
                            className="w-full text-left flex items-center px-4 py-2 hover:bg-yt-spec-light-10 dark:hover:bg-yt-spec-10 text-sm text-black dark:text-white gap-2"
                        >
                            <SearchIcon />
                            検索履歴を選択して削除
                        </button>

                        <hr className="my-2 border-yt-spec-light-20 dark:border-yt-spec-20" />
                        
                        <div className="px-4 py-2 text-xs font-bold text-yt-light-gray uppercase tracking-wider">データのバックアップ (JSON)</div>
                        
                        <button 
                            onClick={exportUserData}
                            className="w-full text-left flex items-center px-4 py-2 hover:bg-yt-spec-light-10 dark:hover:bg-yt-spec-10 text-sm text-black dark:text-white gap-2"
                        >
                            <DownloadIcon />
                            エクスポート (保存)
                        </button>
                        
                        <button 
                            onClick={handleImportClick}
                            className="w-full text-left flex items-center px-4 py-2 hover:bg-yt-spec-light-10 dark:hover:bg-yt-spec-10 text-sm text-black dark:text-white gap-2"
                        >
                            <SaveIcon />
                            インポート (復元)
                        </button>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            accept=".json" 
                            onChange={handleFileChange} 
                        />

                        <div className="px-4 py-2 text-xs text-yt-light-gray mt-1">
                            登録チャンネル、履歴、設定を含みます。
                        </div>
                        
                        <hr className="my-2 border-yt-spec-light-20 dark:border-yt-spec-20" />
                        <div className="px-4 py-2 text-xs font-bold text-yt-light-gray uppercase tracking-wider">データリセット</div>
                        <button 
                            onClick={handleResetUserData}
                            className="w-full text-left flex items-center px-4 py-2 hover:bg-red-100 dark:hover:bg-red-900/50 text-sm text-red-600 dark:text-red-400 gap-2"
                        >
                            <TrashIcon />
                            全ユーザーデータをリセット
                        </button>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </header>
  );
};

export default Header;