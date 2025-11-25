
import React, { useState, useEffect, useRef } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { MenuIcon, YouTubeLogo, SearchIcon, BellIcon, LightbulbIcon, MoonIcon, SettingsIcon, SaveIcon, DownloadIcon, TrashIcon, HistoryIcon } from './icons/Icons';
import { useNotification } from '../contexts/NotificationContext';
import { useSearchHistory } from '../contexts/SearchHistoryContext';
import { usePreference } from '../contexts/PreferenceContext';
import { useHistory } from '../contexts/HistoryContext';
import NotificationDropdown from './NotificationDropdown';
import HistoryDeletionModal from './HistoryDeletionModal';
import SearchHistoryDeletionModal from './SearchHistoryDeletionModal';

const { useNavigate, Link } = ReactRouterDOM;

interface HeaderProps {
  toggleSidebar: () => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

const Header: React.FC<HeaderProps> = ({ toggleSidebar, theme, toggleTheme }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryDeletionModalOpen, setIsHistoryDeletionModalOpen] = useState(false);
  const [isSearchHistoryDeletionModalOpen, setIsSearchHistoryDeletionModalOpen] = useState(false);
  const [useProxy, setUseProxy] = useState(localStorage.getItem('useChannelHomeProxy') !== 'false');

  const { notifications, unreadCount, markAsRead } = useNotification();
  const { addSearchTerm, clearSearchHistory } = useSearchHistory();
  const { exportUserData, importUserData } = usePreference();
  const { clearHistory } = useHistory();
  const navigate = useNavigate();
  const notificationRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      addSearchTerm(searchQuery.trim());
      navigate(`/results?search_query=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleBellClick = () => {
    setIsNotificationOpen(prev => !prev);
    setIsSettingsOpen(false);
    if (!isNotificationOpen && unreadCount > 0) {
        markAsRead();
    }
  };
  
  const handleSettingsClick = () => {
      setIsSettingsOpen(prev => !prev);
      setIsNotificationOpen(false);
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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
            setIsNotificationOpen(false);
        }
        if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
            setIsSettingsOpen(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 bg-yt-white dark:bg-yt-black h-14 flex items-center justify-between px-4 z-50">
      {/* Left Section */}
      <div className="flex items-center space-x-4">
        <button onClick={toggleSidebar} className="p-2 rounded-full hover:bg-yt-spec-light-10 dark:hover:bg-yt-spec-10 active:scale-95 transform transition-transform duration-150 hidden md:block" aria-label="サイドバーの切り替え">
          <MenuIcon />
        </button>
        <Link to="/" className="flex items-center" aria-label="YouTubeホーム">
            <YouTubeLogo />
            <div className="hidden sm:flex items-baseline ml-1.5">
                <span className="text-black dark:text-white text-xl font-bold tracking-tighter font-sans">XeroxYT-NTv3β</span>
            </div>
        </Link>
      </div>

      {/* Center Section */}
      <div className="flex-1 flex justify-center px-4 lg:px-16 max-w-[720px] mx-auto">
        <form onSubmit={handleSearch} className="w-full flex items-center gap-4">
          <div className="flex w-full items-center rounded-full shadow-inner border border-yt-light-gray/20 dark:border-[#303030] bg-transparent focus-within:border-yt-blue transition-colors overflow-hidden ml-0 md:ml-8">
            <div className="flex-1 relative">
                 <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none sm:hidden">
                    <SearchIcon />
                 </div>
                <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="検索"
                className="w-full h-10 bg-transparent pl-10 sm:pl-4 pr-4 text-base text-black dark:text-white placeholder-yt-light-gray focus:outline-none dark:bg-[#121212]"
                />
            </div>
            <button
                type="submit"
                className="bg-yt-light dark:bg-[#222222] h-10 px-6 border-l border-yt-light-gray/20 dark:border-[#303030] hover:bg-stone-200 dark:hover:bg-[#2a2a2a] transition-colors w-16 flex items-center justify-center"
                aria-label="検索"
            >
                <SearchIcon />
            </button>
          </div>
        </form>
      </div>

      {/* Right Section */}
      <div className="flex items-center space-x-0 sm:space-x-2 md:space-x-4">
        <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-yt-spec-light-10 dark:hover:bg-yt-spec-10 active:scale-95 transform transition-transform duration-150 hidden sm:block" aria-label="テーマの切り替え">
          {theme === 'light' ? <MoonIcon /> : <LightbulbIcon />}
        </button>
        <div className="relative" ref={notificationRef}>
            <button onClick={handleBellClick} className="p-2 rounded-full hover:bg-yt-spec-light-10 dark:hover:bg-yt-spec-10 active:scale-95 transform transition-transform duration-150" aria-label="通知">
                <BellIcon />
                 {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-yt-red rounded-full ring-2 ring-white dark:ring-yt-black">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>
            {isNotificationOpen && <NotificationDropdown notifications={notifications} onClose={() => setIsNotificationOpen(false)} />}
        </div>
        
        <div className="relative" ref={settingsRef}>
            <button 
                onClick={handleSettingsClick}
                className="p-2 rounded-full hover:bg-yt-spec-light-10 dark:hover:bg-yt-spec-10 active:scale-95 transform transition-transform duration-150" 
                aria-label="設定"
            >
                <SettingsIcon />
            </button>
            
            {isSettingsOpen && (
                <div className="absolute top-12 right-0 w-72 bg-yt-white dark:bg-yt-light-black rounded-lg shadow-lg border border-yt-spec-light-20 dark:border-yt-spec-20 py-2 overflow-hidden z-50">
                    <div className="py-2">
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

                         <button 
                            onClick={toggleTheme}
                            className="w-full text-left flex items-center justify-between px-4 py-2 hover:bg-yt-spec-light-10 dark:hover:bg-yt-spec-10 sm:hidden"
                        >
                            <span className="text-sm text-black dark:text-white">テーマ変更</span>
                             {theme === 'light' ? <MoonIcon /> : <LightbulbIcon />}
                        </button>

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
                            onClick={() => { setIsHistoryDeletionModalOpen(true); setIsSettingsOpen(false); }}
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
                            onClick={() => { setIsSearchHistoryDeletionModalOpen(true); setIsSettingsOpen(false); }}
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
                    </div>
                </div>
            )}
        </div>
      </div>
      {isHistoryDeletionModalOpen && (
        <HistoryDeletionModal 
          isOpen={isHistoryDeletionModalOpen} 
          onClose={() => setIsHistoryDeletionModalOpen(false)} 
        />
      )}
      {isSearchHistoryDeletionModalOpen && (
        <SearchHistoryDeletionModal 
          isOpen={isSearchHistoryDeletionModalOpen} 
          onClose={() => setIsSearchHistoryDeletionModalOpen(false)} 
        />
      )}
    </header>
  );
};

export default Header;
