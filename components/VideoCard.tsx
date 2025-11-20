
import React from 'react';
import { Link } from 'react-router-dom';
import type { Video } from '../types';

interface VideoCardProps {
  video: Video;
  hideChannelInfo?: boolean;
}

const VideoCard: React.FC<VideoCardProps> = ({ video, hideChannelInfo = false }) => {
  const handleChannelLinkClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };
  
  return (
    <Link to={`/watch/${video.id}`} className="flex flex-col group cursor-pointer">
      <div className="relative rounded-xl overflow-hidden aspect-video bg-yt-light dark:bg-yt-dark-gray">
        <img 
            src={video.thumbnailUrl} 
            alt={video.title} 
            className="w-full h-full object-cover" 
        />
        {video.duration && (
            <span className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-xs font-medium px-1.5 py-0.5 rounded-[4px]">
            {video.duration}
            </span>
        )}
      </div>
      <div className="flex mt-3 items-start">
        {!hideChannelInfo && video.channelId && (
          <div className="flex-shrink-0 mr-3">
            <Link to={`/channel/${video.channelId}`} onClick={handleChannelLinkClick}>
              <img src={video.channelAvatarUrl} alt={video.channelName} className="w-9 h-9 rounded-full object-cover" />
            </Link>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-black dark:text-white text-base font-semibold leading-snug line-clamp-2 mb-1">
            {video.title}
          </h3>
          <div className="text-yt-light-gray text-sm">
            {!hideChannelInfo && video.channelId && (
                <Link to={`/channel/${video.channelId}`} onClick={handleChannelLinkClick} className="hover:text-black dark:hover:text-white block truncate">
                    {video.channelName}
                </Link>
            )}
            <p className="truncate">
              {[video.views?.includes('不明') ? null : video.views, video.uploadedAt].filter(Boolean).join(' • ')}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default VideoCard;
