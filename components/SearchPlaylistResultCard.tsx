import React from 'react';
// FIX: Use named import for Link from react-router-dom
import { Link } from 'react-router-dom';
import type { ApiPlaylist } from '../types';
import { PlaylistIcon } from './icons/Icons';

interface SearchPlaylistResultCardProps {
  playlist: ApiPlaylist;
}

const SearchPlaylistResultCard: React.FC<SearchPlaylistResultCardProps> = ({ playlist }) => {
  return (
    <Link to={`/playlist/${playlist.id}`} className="flex flex-col sm:flex-row gap-4 group mb-4">
      {/* Thumbnail */}
      <div className="relative flex-shrink-0 w-full sm:w-[360px] aspect-video rounded-xl overflow-hidden bg-yt-light dark:bg-yt-dark-gray">
        {playlist.thumbnailUrl ? (
          <img src={playlist.thumbnailUrl} alt={playlist.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
        ) : (
            <div className="w-full h-full flex items-center justify-center bg-yt-gray">
                <PlaylistIcon className="w-12 h-12 text-yt-light-gray" />
            </div>
        )}
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-white font-bold text-sm">▶ プレイリストを表示</span>
        </div>
        <div className="absolute bottom-0 right-0 bg-black/70 text-white text-xs font-semibold px-2 py-1 m-1.5 rounded-md flex items-center gap-1.5">
          <PlaylistIcon className="w-4 h-4 fill-current text-white" />
          <span>{playlist.videoCount} 本の動画</span>
        </div>
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0 py-1">
        <h3 className="text-lg font-semibold text-black dark:text-white line-clamp-2 mb-1 group-hover:text-opacity-80">{playlist.title}</h3>
        {playlist.author && (
            <p className="text-sm text-yt-light-gray mb-2">{playlist.author}</p>
        )}
        <p className="text-xs text-yt-light-gray line-clamp-2 hidden sm:block">
            プレイリスト全体を表示して、すべての動画をご覧ください。
        </p>
      </div>
    </Link>
  );
};

export default SearchPlaylistResultCard;
