

import React, { useState, useEffect, useMemo, useRef } from 'react';
// FIX: Use named imports for react-router-dom components and hooks.
import { useParams, useNavigate, Link } from 'react-router-dom';
import { usePlaylist } from '../contexts/PlaylistContext';
import { getVideosByIds } from '../utils/api';
import type { Video } from '../types';
import { EditIcon, TrashIcon, PlayIcon, ShuffleIcon, RepeatIcon, DragHandleIcon, MoreIconHorizontal, CheckIcon } from '../components/icons/Icons';
import { useTheme } from '../hooks/useTheme';

const PlaylistPage: React.FC = () => {
    const { playlistId } = useParams<{ playlistId: string }>();
    const navigate = useNavigate();
    const { playlists, renamePlaylist, removeVideoFromPlaylist, deletePlaylist, reorderVideosInPlaylist } = usePlaylist();
    const { theme } = useTheme();
    
    const playlist = useMemo(() => playlists.find(p => p.id === playlistId), [playlists, playlistId]);
    
    const [videos, setVideos] = useState<Video[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditingName, setIsEditingName] = useState(false);
    const [playlistName, setPlaylistName] = useState(playlist?.name || '');

    const dragItem = useRef<number | null>(null);
    const dragOverItem = useRef<number | null>(null);

    useEffect(() => {
        if (!playlist) {
            return;
        }
        setPlaylistName(playlist.name);
        
        const fetchVideos = async () => {
            setIsLoading(true);
            if (playlist.videoIds.length > 0) {
                const fetchedVideos = await getVideosByIds(playlist.videoIds);
                const videoMap = new Map(fetchedVideos.map(v => [v.id, v]));
                // Preserve order of IDs
                setVideos(playlist.videoIds.map(id => videoMap.get(id)).filter((v): v is Video => !!v));
            } else {
                setVideos([]);
            }
            setIsLoading(false);
        };
        fetchVideos();
    }, [playlist]);

    if (!playlist) {
        return <div className="text-center p-8 text-black dark:text-white">プレイリストが見つかりません。</div>;
    }
    
    const handleNameSave = () => {
        if (playlistName.trim() && playlistId) {
            renamePlaylist(playlistId, playlistName.trim());
        }
        setIsEditingName(false);
    }
    
    const handleDeletePlaylist = () => {
        if (window.confirm(`「${playlist.name}」を削除しますか？`)) {
            if(playlistId) deletePlaylist(playlistId);
            navigate('/you');
        }
    }

    const handleDragSort = () => {
        if (dragItem.current === null || dragOverItem.current === null || dragItem.current === dragOverItem.current) return;
        if (playlistId) {
            reorderVideosInPlaylist(playlistId, dragItem.current, dragOverItem.current);
        }
        dragItem.current = null;
        dragOverItem.current = null;
    };
    
    const firstVideoId = videos.length > 0 ? videos[0].id : null;
    const coverImage = videos.length > 0 ? videos[0].thumbnailUrl : '';

    const isGlassTheme = theme.includes('glass');
    const panelBgClass = isGlassTheme ? 'glass-panel text-black dark:text-white' : 'bg-white/20 dark:bg-black/40 backdrop-blur-md border border-white/10 shadow-2xl text-black dark:text-white';

    const secondaryButtonClass = isGlassTheme 
        ? 'bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-black dark:text-white'
        : 'bg-yt-light dark:bg-yt-dark-gray hover:bg-yt-spec-light-20 dark:hover:bg-yt-gray text-black dark:text-white';

    return (
        <div className={`min-h-screen ${isGlassTheme ? '' : 'bg-yt-white dark:bg-yt-black'} text-black dark:text-white transition-colors duration-300`}>
            {/* Background Gradient Blur */}
            {coverImage && (
                <div 
                    className="fixed inset-0 z-0 opacity-30 pointer-events-none"
                    style={{
                        backgroundImage: `url(${coverImage})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        filter: 'blur(100px)',
                        maskImage: 'linear-gradient(to bottom, black 0%, transparent 100%)'
                    }}
                />
            )}

            <div className="relative z-10 flex flex-col lg:flex-row gap-8 p-6 max-w-[1600px] mx-auto">
                {/* Left Sidebar (Info) */}
                <div className="lg:w-[360px] flex-shrink-0">
                    <div className={`lg:sticky lg:top-24 flex flex-col gap-6 p-6 rounded-3xl ${panelBgClass}`}>
                        {/* Cover Image */}
                        <div className="relative group aspect-video md:aspect-square rounded-xl overflow-hidden shadow-lg bg-yt-dark-gray">
                            {coverImage ? (
                                <img src={coverImage} alt={playlist.name} className="w-full h-full object-cover" />
                            ) : (
                                <div className="flex items-center justify-center h-full text-yt-light-gray">No Videos</div>
                            )}
                             {firstVideoId && (
                                <Link 
                                    to={`/watch/${firstVideoId}?list=${playlist.id}`}
                                    className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                                >
                                    <div className="flex items-center gap-2 text-white font-semibold">
                                        <PlayIcon /> すべて再生
                                    </div>
                                </Link>
                             )}
                        </div>

                        {/* Metadata */}
                        <div className="flex flex-col gap-2">
                            {isEditingName ? (
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={playlistName}
                                        onChange={(e) => setPlaylistName(e.target.value)}
                                        className="w-full bg-transparent border-b-2 border-black dark:border-white text-2xl font-bold outline-none pb-1"
                                        autoFocus
                                        onBlur={handleNameSave}
                                        onKeyDown={e => e.key === 'Enter' && handleNameSave()}
                                    />
                                    <button onClick={handleNameSave} className="p-2"><CheckIcon /></button>
                                </div>
                            ) : (
                                <h1 
                                    className="text-3xl font-bold cursor-pointer hover:opacity-80 line-clamp-2"
                                    onClick={() => setIsEditingName(true)}
                                    title="クリックして編集"
                                >
                                    {playlist.name}
                                </h1>
                            )}
                            
                            <div className="flex flex-col gap-1">
                                <span className="text-lg font-semibold">{playlist.authorName}</span>
                                <div className="flex items-center text-sm opacity-80 gap-2">
                                    <span>{videos.length} 本の動画</span>
                                    <span>•</span>
                                    <span>最終更新: {new Date(playlist.createdAt).toLocaleDateString()}</span>
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2">
                             {firstVideoId ? (
                                <>
                                    <Link 
                                        to={`/watch/${firstVideoId}?list=${playlist.id}`}
                                        className="flex-1 bg-black dark:bg-white text-white dark:text-black hover:opacity-80 rounded-full py-2.5 px-4 font-bold text-sm flex items-center justify-center gap-2 transition-colors"
                                    >
                                        <PlayIcon className="fill-current text-white dark:text-black w-5 h-5" />
                                        <span>再生</span>
                                    </Link>
                                    <Link 
                                        to={`/watch/${firstVideoId}?list=${playlist.id}&shuffle=1`}
                                        className={`flex-1 rounded-full py-2.5 px-4 font-bold text-sm flex items-center justify-center gap-2 transition-colors ${secondaryButtonClass}`}
                                    >
                                        <ShuffleIcon className="fill-current text-black dark:text-white w-5 h-5" />
                                        <span>シャッフル</span>
                                    </Link>
                                </>
                             ) : (
                                 <button disabled className="flex-1 bg-yt-light dark:bg-yt-dark-gray text-yt-light-gray rounded-full py-2.5 font-bold text-sm cursor-not-allowed">再生</button>
                             )}
                        </div>

                        {/* Additional Actions */}
                        <div className="flex justify-center gap-4 pt-2 border-t border-black/10 dark:border-white/10">
                            <button onClick={handleDeletePlaylist} className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-yt-light-gray hover:text-red-500 transition-colors" title="プレイリストを削除">
                                <TrashIcon />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right List (Videos) */}
                <div className="flex-1 min-w-0">
                    {isLoading ? (
                         <div className="flex flex-col gap-4">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="h-24 bg-yt-light dark:bg-yt-dark-gray rounded-xl animate-pulse" />
                            ))}
                         </div>
                    ) : videos.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-yt-light-gray border-2 border-dashed border-yt-light dark:border-yt-spec-20 rounded-xl">
                            <p>このプレイリストには動画がありません。</p>
                            <Link to="/" className="mt-4 text-yt-blue hover:underline">動画を探す</Link>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2 pb-20">
                            {videos.map((video, index) => (
                                <div
                                    key={`${video.id}-${index}`}
                                    className="group flex gap-4 p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                                    draggable
                                    onDragStart={() => dragItem.current = index}
                                    onDragEnter={() => dragOverItem.current = index}
                                    onDragEnd={handleDragSort}
                                    onDragOver={(e) => e.preventDefault()}
                                >
                                    {/* Index / Handle */}
                                    <div className="w-8 flex items-center justify-center flex-shrink-0 text-yt-light-gray font-medium text-sm">
                                        <span className="group-hover:hidden">{index + 1}</span>
                                        <PlayIcon className="hidden group-hover:block w-4 h-4 fill-current text-black dark:text-white" />
                                    </div>

                                    {/* Thumbnail */}
                                    <Link to={`/watch/${video.id}?list=${playlist.id}`} className="relative w-40 aspect-video flex-shrink-0 rounded-lg overflow-hidden bg-yt-dark-gray">
                                        <img src={video.thumbnailUrl} alt={video.title} className="w-full h-full object-cover" />
                                        <span className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1 rounded">{video.duration}</span>
                                    </Link>

                                    {/* Info */}
                                    <Link to={`/watch/${video.id}?list=${playlist.id}`} className="flex-1 flex flex-col justify-center min-w-0">
                                        <h3 className="text-base font-bold text-black dark:text-white line-clamp-2 mb-1 group-hover:opacity-80">{video.title}</h3>
                                        <div className="flex items-center gap-2 text-sm text-yt-light-gray">
                                            <span>{video.channelName}</span>
                                            <span>•</span>
                                            <span>{video.views}</span>
                                            <span>•</span>
                                            <span>{video.uploadedAt}</span>
                                        </div>
                                    </Link>

                                    {/* Menu Actions */}
                                    <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                         <div className="cursor-grab p-2 hover:bg-black/10 dark:hover:bg-white/20 rounded-full text-yt-light-gray">
                                            <DragHandleIcon />
                                        </div>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); playlistId && removeVideoFromPlaylist(playlistId, video.id); }} 
                                            className="p-2 hover:bg-black/10 dark:hover:bg-white/20 rounded-full text-yt-light-gray hover:text-red-500"
                                            title="削除"
                                        >
                                            <TrashIcon />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PlaylistPage;