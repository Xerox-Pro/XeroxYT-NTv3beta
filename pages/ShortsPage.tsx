

import React, { useState, useEffect, useCallback, useRef } from 'react';
import ShortsPlayer from '../components/ShortsPlayer';
import { getPlayerConfig, getComments, parseDuration } from '../utils/api';
import { getXraiShorts } from '../utils/recommendation';
import type { Video, Comment } from '../types';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useSearchHistory } from '../contexts/SearchHistoryContext';
import { useHistory } from '../contexts/HistoryContext';
import { usePreference } from '../contexts/PreferenceContext';
import { LikeIcon, CommentIcon, CloseIcon, BlockIcon, TrashIcon, RepeatIcon } from '../components/icons/Icons';
import CommentComponent from '../components/Comment';
import { useTheme } from '../hooks/useTheme';

const ChevronUpIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" height="32" viewBox="0 0 24 24" width="32" className="fill-current text-black dark:text-white"><path d="M7.41 15.41 12 10.83l4.59 4.58L18 14l-6-6-6 6z"/></svg> );
const ChevronDownIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" height="32" viewBox="0 0 24 24" width="32" className="fill-current text-black dark:text-white"><path d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg> );

const ShortsPage: React.FC = () => {
    const [videos, setVideos] = useState<Video[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [playerParams, setPlayerParams] = useState<string | null>(null);
    const [showComments, setShowComments] = useState(false);
    const [comments, setComments] = useState<Comment[]>([]);
    const [areCommentsLoading, setAreCommentsLoading] = useState(false);
    const [isAutoplayOn, setIsAutoplayOn] = useState(false);

    const { theme } = useTheme();
    const { subscribedChannels } = useSubscription();
    const { searchHistory } = useSearchHistory();
    const { history: watchHistory, shortsHistory, addShortToHistory } = useHistory();
    const { ngKeywords, ngChannels, hiddenVideos, negativeKeywords, addHiddenVideo, addNgChannel } = usePreference();
    
    const loadedRef = useRef(false);
    const wheelTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const loadShorts = useCallback(async () => {
        if (loadedRef.current) return;
        loadedRef.current = true;
        setIsLoading(true);
        setError(null);
        
        try {
            const paramsPromise = getPlayerConfig().then(p => p.replace(/&?autoplay=[01]/g, "") + "&playsinline=1");
            const videosPromise = getXraiShorts({ searchHistory, watchHistory, shortsHistory, subscribedChannels, ngKeywords, ngChannels, hiddenVideos, negativeKeywords, page: 1 });
            const [params, shorts] = await Promise.all([paramsPromise, videosPromise]);
            
            setPlayerParams(params);
            if (shorts.length === 0) setError("ショート動画が見つかりませんでした。");
            else setVideos(shorts);

        } catch (err: any) {
            setError(err.message || 'ショート動画の読み込みに失敗しました。');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, [searchHistory, watchHistory, shortsHistory, subscribedChannels, ngKeywords, ngChannels, hiddenVideos, negativeKeywords]);

    useEffect(() => { loadShorts(); }, [loadShorts]);
    
    useEffect(() => {
        setShowComments(false);
        setComments([]);
    }, [currentIndex]);

    const handleNext = useCallback(() => {
        if (currentIndex < videos.length - 1) {
            setCurrentIndex(prev => prev + 1);
        }
    }, [currentIndex, videos.length]);

    useEffect(() => {
        const video = videos[currentIndex];
        if (!video) return;

        const durationSec = parseDuration(video.isoDuration, video.duration);
        if (durationSec === 0) return;

        const historyTimer = setTimeout(() => { addShortToHistory(video); }, (durationSec * 1000) / 2);
        
        let autoplayTimer: ReturnType<typeof setTimeout> | null = null;
        if (isAutoplayOn) {
            autoplayTimer = setTimeout(() => { handleNext(); }, durationSec * 1000 + 500); // Add 500ms buffer
        }

        return () => {
            clearTimeout(historyTimer);
            if (autoplayTimer) clearTimeout(autoplayTimer);
        };
    }, [currentIndex, videos, addShortToHistory, isAutoplayOn, handleNext]);

    const handlePrev = () => {
        if (currentIndex > 0) setCurrentIndex(prev => prev - 1);
    };

    const handleToggleComments = async () => {
        setShowComments(prev => !prev);
        if (!showComments && comments.length === 0 && videos[currentIndex]) {
            setAreCommentsLoading(true);
            try {
                const data = await getComments(videos[currentIndex].id);
                setComments(data);
            } catch (e) { console.error("Failed to fetch comments", e); } 
            finally { setAreCommentsLoading(false); }
        }
    };
    
    const handleNotInterested = () => {
        const video = videos[currentIndex];
        if(!video) return;
        addHiddenVideo({ id: video.id, title: video.title, channelName: video.channelName });
        const newVideos = videos.filter(v => v.id !== video.id);
        if (currentIndex >= newVideos.length && newVideos.length > 0) {
            setCurrentIndex(newVideos.length - 1);
        }
        setVideos(newVideos);
    };

    const handleBlockChannel = () => {
        const video = videos[currentIndex];
        if(!video) return;
        addNgChannel({ id: video.channelId, name: video.channelName, avatarUrl: video.channelAvatarUrl });
        const newVideos = videos.filter(v => v.channelId !== video.channelId);
        if (currentIndex >= newVideos.length && newVideos.length > 0) {
             setCurrentIndex(newVideos.length - 1);
        }
        setVideos(newVideos);
    };

    useEffect(() => {
        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            if (wheelTimeoutRef.current) return;

            if (e.deltaY > 5) handleNext();
            else if (e.deltaY < -5) handlePrev();
            
            wheelTimeoutRef.current = setTimeout(() => { wheelTimeoutRef.current = null; }, 200);
        };
        const container = document.querySelector('.shorts-container');
        if(container) container.addEventListener('wheel', handleWheel, { passive: false });
        return () => { 
            if(container) container.removeEventListener('wheel', handleWheel);
            if(wheelTimeoutRef.current) clearTimeout(wheelTimeoutRef.current);
        };
    }, [handleNext, handlePrev]);

    if (isLoading) return <div className="flex justify-center items-center h-[calc(100vh-64px)]"><div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-yt-blue"></div></div>;
    if (error) return <div className="text-center text-red-500 bg-red-100 dark:bg-red-900/50 p-4 rounded-lg m-4">{error}</div>;
    if (videos.length === 0 || !playerParams) return <div className="text-center p-8">No shorts found.</div>;

    const currentVideo = videos[currentIndex];
    const extendedParams = `${playerParams}&autoplay=1`;
    const isTransparentTheme = theme.includes('glass');
    const bgClass = isTransparentTheme ? 'bg-transparent' : 'bg-yt-white dark:bg-yt-black';

    return (
        <div className={`shorts-container flex justify-center items-center h-[calc(100vh-3.5rem)] w-full overflow-hidden relative ${bgClass}`}>
            <div className="relative flex items-center justify-center gap-4 h-full pb-8">
                <div className="relative h-[80vh] aspect-[9/16] rounded-2xl shadow-2xl overflow-hidden bg-black flex-shrink-0 z-10">
                     <ShortsPlayer key={currentVideo.id} video={currentVideo} playerParams={extendedParams} />
                </div>

                <div className="flex flex-col gap-5 pb-2 z-10">
                    <div className="flex flex-col gap-3">
                        <button onClick={() => {}} className="flex flex-col items-center p-2 rounded-full bg-yt-light/50 dark:bg-yt-light-black/50 hover:bg-yt-light dark:hover:bg-yt-light-black backdrop-blur-sm transition-all group">
                            <LikeIcon /><span className="text-xs font-semibold text-black dark:text-white mt-1">高評価</span>
                        </button>
                        <button onClick={handleToggleComments} className={`flex flex-col items-center p-2 rounded-full bg-yt-light/50 dark:bg-yt-light-black/50 hover:bg-yt-light dark:hover:bg-yt-light-black backdrop-blur-sm transition-all group ${showComments ? 'bg-white text-black hover:bg-white/90' : ''}`}>
                            <CommentIcon /><span className="text-xs font-semibold text-black dark:text-white mt-1">コメント</span>
                        </button>
                        <button onClick={handleNotInterested} className="flex flex-col items-center p-2 rounded-full bg-yt-light/50 dark:bg-yt-light-black/50 hover:bg-yt-light dark:hover:bg-yt-light-black backdrop-blur-sm transition-all group">
                            <TrashIcon /><span className="text-xs font-semibold text-black dark:text-white mt-1">興味なし</span>
                        </button>
                        <button onClick={handleBlockChannel} className="flex flex-col items-center p-2 rounded-full bg-yt-light/50 dark:bg-yt-light-black/50 hover:bg-yt-light dark:hover:bg-yt-light-black backdrop-blur-sm transition-all group">
                            <BlockIcon /><span className="text-xs font-semibold text-black dark:text-white mt-1">非表示</span>
                        </button>
                        <button onClick={() => setIsAutoplayOn(p => !p)} className={`flex flex-col items-center p-2 rounded-full bg-yt-light/50 dark:bg-yt-light-black/50 backdrop-blur-sm transition-all group ${isAutoplayOn ? 'bg-yt-blue/80' : 'hover:bg-yt-light dark:hover:bg-yt-light-black'}`}>
                            <RepeatIcon className={isAutoplayOn ? 'fill-current text-white' : ''} /><span className={`text-xs font-semibold mt-1 ${isAutoplayOn ? 'text-white' : 'text-black dark:text-white'}`}>連続再生</span>
                        </button>
                    </div>

                    <div className="flex flex-col gap-4 mt-auto">
                        <button onClick={handlePrev} disabled={currentIndex === 0} className={`p-3 rounded-full bg-yt-light/50 dark:bg-yt-light-black/50 hover:bg-yt-light dark:hover:bg-yt-light-black backdrop-blur-sm transition-all ${currentIndex === 0 ? 'opacity-30 cursor-not-allowed' : ''}`}><ChevronUpIcon /></button>
                        <button onClick={handleNext} disabled={currentIndex === videos.length - 1} className={`p-3 rounded-full bg-yt-light/50 dark:bg-yt-light-black/50 hover:bg-yt-light dark:hover:bg-yt-light-black backdrop-blur-sm transition-all ${currentIndex === videos.length - 1 ? 'opacity-30 cursor-not-allowed' : ''}`}><ChevronDownIcon /></button>
                    </div>
                </div>

                {showComments && (
                    <div className="w-[360px] h-[80vh] glass-panel rounded-2xl shadow-2xl flex flex-col animate-scale-in ml-2 z-20">
                         <div className="flex items-center justify-between p-4 border-b border-white/20">
                             <h3 className="font-bold text-black dark:text-white">コメント {comments.length > 0 && `(${comments.length})`}</h3>
                             <button onClick={() => setShowComments(false)} className="p-2 hover:bg-white/10 rounded-full"><CloseIcon /></button>
                         </div>
                         <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                             {areCommentsLoading ? <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-yt-blue"></div></div>
                             : comments.length > 0 ? (
                                 <div className="space-y-2">
                                     {comments.map((comment, idx) => ( <div key={idx} className="bg-black/5 dark:bg-white/5 rounded-lg p-2 backdrop-blur-sm"><CommentComponent comment={comment} /></div> ))}
                                 </div>
                             ) : <div className="text-center text-yt-light-gray py-10">コメントはありません</div> }
                         </div>
                    </div>
                )}
            </div>
        </div>
    );
};
export default ShortsPage;