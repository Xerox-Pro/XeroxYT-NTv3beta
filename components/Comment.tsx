

import React from 'react';
import type { Comment } from '../types';
// FIX: Removed DislikeIcon import as it is not exported from './icons/Icons'.
import { LikeIcon } from './icons/Icons';

interface CommentProps {
  comment: Comment;
}

const CommentComponent: React.FC<CommentProps> = ({ comment }) => {
  const authorThumbnail = comment.author.thumbnails?.[0]?.url || '';
  
  // Clean up like count text (e.g., "711" from "711 likes")
  const likeCount = comment.like_count.split(' ')[0];

  return (
    <div className="flex items-start space-x-4 my-4">
      <img src={authorThumbnail} alt={comment.author.name} className="w-10 h-10 rounded-full" />
      <div className="flex-1">
        <div className="flex items-baseline space-x-2">
          <p className="font-semibold text-sm">{comment.author.name}</p>
          <p className="text-xs text-yt-light-gray">{comment.published_time}</p>
        </div>
        <p className="text-sm mt-1 whitespace-pre-wrap">{comment.text}</p>
        <div className="flex items-center space-x-1 mt-2">
            <button className="flex items-center p-2 rounded-full hover:bg-yt-spec-light-10 dark:hover:bg-yt-spec-10">
                <LikeIcon />
                {likeCount && <span className="ml-2 text-xs text-yt-light-gray">{likeCount}</span>}
            </button>
            {/* FIX: The DislikeIcon component was not exported. The dislike button has been removed. */}
            <button className="text-xs text-yt-light-gray font-semibold px-3 py-2 rounded-full hover:bg-yt-spec-light-10 dark:hover:bg-yt-spec-10">
              返信
            </button>
        </div>
      </div>
    </div>
  );
};

export default CommentComponent;