

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { usePlaylist } from '../contexts/PlaylistContext';
import type { Video } from '../types';
import { CloseIcon, AddToPlaylistIcon } from './icons/Icons';

interface PlaylistModalProps {
    isOpen: boolean;
    onClose: () => void;
    video: Video;
}

const PlaylistModal: React.FC<PlaylistModalProps> = ({ isOpen, onClose, video }) => {
    const { playlists, createPlaylist, addVideoToPlaylist, removeVideoFromPlaylist, getPlaylistsContainingVideo } = usePlaylist();
    const [newPlaylistName, setNewPlaylistName] = useState('');
    const [showNewPlaylistInput, setShowNewPlaylistInput] = useState(false);

    if (!isOpen) return null;
    
    const playlistsWithVideo = getPlaylistsContainingVideo(video.id);

    const handlePlaylistToggle = (playlistId: string, isChecked: boolean) => {
        if (isChecked) {
            addVideoToPlaylist(playlistId, video.id);
        } else {
            removeVideoFromPlaylist(playlistId, video.id);
        }
    };
    
    const handleCreatePlaylist = () => {
        if (newPlaylistName.trim()) {
            createPlaylist(newPlaylistName.trim(), [video.id]);
            setNewPlaylistName('');
            setShowNewPlaylistInput(false);
        }
    };

    const modalContent = (
        <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[1000] animate-fade-in"
            onClick={onClose}
        >
            <div 
                className="bg-yt-white dark:bg-yt-light-black w-full max-w-sm rounded-xl shadow-2xl flex flex-col border border-yt-spec-light-20 dark:border-yt-spec-20 animate-scale-in"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-between items-center p-4 border-b border-yt-spec-light-20 dark:border-yt-spec-20">
                    <h2 className="text-lg font-bold text-black dark:text-white">再生リストに保存...</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-yt-spec-light-10 dark:hover:bg-yt-spec-20">
                        <CloseIcon />
                    </button>
                </div>
                
                <div className="max-h-60 overflow-y-auto p-2">
                    {playlists.length > 0 ? (
                        playlists.map(playlist => (
                            <label key={playlist.id} className="flex items-center p-3 hover:bg-yt-spec-light-10 dark:hover:bg-yt-spec-10 cursor-pointer rounded-lg">
                                <input 
                                    type="checkbox"
                                    className="w-6 h-6 accent-yt-blue bg-transparent border-yt-light-gray rounded"
                                    checked={playlistsWithVideo.includes(playlist.id)}
                                    onChange={e => handlePlaylistToggle(playlist.id, e.target.checked)}
                                />
                                <span className="ml-4 text-black dark:text-white text-base">{playlist.name}</span>
                            </label>
                        ))
                    ) : (
                        <p className="text-yt-light-gray text-center p-4">作成された再生リストはありません。</p>
                    )}
                </div>
                
                <div className="p-4 border-t border-yt-spec-light-20 dark:border-yt-spec-20">
                    {showNewPlaylistInput ? (
                        <div>
                            <input
                                type="text"
                                value={newPlaylistName}
                                onChange={(e) => setNewPlaylistName(e.target.value)}
                                placeholder="新しい再生リストのタイトル"
                                className="w-full bg-transparent border-b-2 border-yt-gray focus:border-yt-blue dark:focus:border-yt-blue outline-none px-1 py-1 mb-3 text-black dark:text-white"
                                autoFocus
                                onKeyDown={e => e.key === 'Enter' && handleCreatePlaylist()}
                            />
                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => setShowNewPlaylistInput(false)}
                                    className="text-yt-light-gray font-semibold px-4 py-2 rounded-full hover:bg-yt-spec-light-10 dark:hover:bg-yt-spec-10"
                                >
                                    キャンセル
                                </button>
                                <button
                                    onClick={handleCreatePlaylist}
                                    className="text-white bg-yt-blue font-semibold px-4 py-2 rounded-full hover:opacity-80 disabled:bg-yt-gray disabled:text-yt-light-gray disabled:hover:opacity-100"
                                    disabled={!newPlaylistName.trim()}
                                >
                                    作成
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button 
                            onClick={() => setShowNewPlaylistInput(true)} 
                            className="flex items-center p-3 rounded-lg hover:bg-yt-spec-light-10 dark:hover:bg-yt-spec-10 w-full"
                        >
                            <AddToPlaylistIcon />
                            <span className="ml-4 text-black dark:text-white font-semibold">新しい再生リストを作成</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};

export default PlaylistModal;