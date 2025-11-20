
import React from 'react';
import { NavLink } from 'react-router-dom';
import { HomeIcon, ShortsIcon, SubscriptionsIcon, HistoryIcon, PlaylistIcon } from './icons/Icons';
import { useSubscription } from '../contexts/SubscriptionContext';

interface SidebarProps {
  isOpen: boolean;
}

const SidebarItem: React.FC<{ icon: React.ReactNode; label: string; to: string; }> = ({ icon, label, to }) => (
    <NavLink 
      to={to} 
      end
      className={({ isActive }) => 
        `flex items-center px-3 py-2.5 mx-2 rounded-xl text-[15px] ${isActive ? 'bg-yt-spec-light-10 dark:bg-[#272727] font-medium' : 'hover:bg-yt-spec-light-10 dark:hover:bg-[#272727] font-normal'}`
      }
    >
        <span className="mr-5">{icon}</span>
        <span className="truncate">{label}</span>
    </NavLink>
);

const SmallSidebarItem: React.FC<{ icon: React.ReactNode; label: string; to: string; }> = ({ icon, label, to }) => (
    <NavLink 
      to={to}
      end
      className={({ isActive }) => `flex flex-col items-center justify-center py-4 rounded-lg text-[10px] w-full hover:bg-yt-spec-light-10 dark:hover:bg-[#272727] ${isActive ? '' : ''}`}
    >
        <span className="mb-1.5">{icon}</span>
        <span className="text-ellipsis overflow-hidden whitespace-nowrap w-full text-center px-1">{label}</span>
    </NavLink>
);


const Sidebar: React.FC<SidebarProps> = ({ isOpen }) => {
  const { subscribedChannels } = useSubscription();

  if (!isOpen) {
    return (
        <div className="fixed top-14 left-0 w-[72px] h-full bg-yt-white dark:bg-yt-black flex flex-col items-center px-1 space-y-0 z-40">
            <SmallSidebarItem to="/" icon={<HomeIcon />} label="ホーム" />
            <SmallSidebarItem to="/shorts" icon={<ShortsIcon />} label="ショート" />
            <SmallSidebarItem to="/subscriptions" icon={<SubscriptionsIcon />} label="登録チャンネル" />
            <SmallSidebarItem to="/you" icon={<PlaylistIcon />} label="ライブラリ" />
        </div>
    );
  }

  return (
    <aside className="fixed top-14 left-0 w-60 h-full bg-yt-white dark:bg-yt-black pb-3 hover:overflow-y-auto overflow-y-hidden z-40 group">
      <nav className="flex flex-col space-y-0.5 py-3">
        <SidebarItem to="/" icon={<HomeIcon />} label="ホーム" />
        <SidebarItem to="/shorts" icon={<ShortsIcon />} label="ショート" />
        <SidebarItem to="/subscriptions" icon={<SubscriptionsIcon />} label="登録チャンネル" />
      </nav>
      <hr className="my-3 border-yt-spec-light-20 dark:border-yt-spec-20 mx-4" />
      <nav className="flex flex-col space-y-0.5">
        <div className="px-5 py-2 text-base font-bold flex items-center">
            <span>ライブラリ</span>
        </div>
        <SidebarItem to="/you" icon={<PlaylistIcon />} label="プレイリスト" />
        <SidebarItem to="/history" icon={<HistoryIcon />} label="履歴" />
      </nav>
      {subscribedChannels.length > 0 && (
          <>
            <hr className="my-3 border-yt-spec-light-20 dark:border-yt-spec-20 mx-4" />
            <h2 className="px-5 py-2 text-base font-bold">登録チャンネル</h2>
            <nav className="flex flex-col space-y-0.5">
                {subscribedChannels.map(channel => (
                    <NavLink
                        key={channel.id}
                        to={`/channel/${channel.id}`}
                        className={({ isActive }) => 
                            `flex items-center px-3 py-2 mx-2 rounded-xl text-[15px] ${isActive ? 'bg-yt-spec-light-10 dark:bg-[#272727] font-medium' : 'hover:bg-yt-spec-light-10 dark:hover:bg-[#272727] font-normal'}`
                        }
                    >
                        <img src={channel.avatarUrl} alt={channel.name} className="w-6 h-6 rounded-full flex-shrink-0" />
                        <span className="ml-5 truncate">{channel.name}</span>
                    </NavLink>
                ))}
            </nav>
          </>
      )}
    </aside>
  );
};

export default Sidebar;
