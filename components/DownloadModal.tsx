import React from 'react';
import { createPortal } from 'react-dom';
import { CloseIcon, DownloadIcon } from './icons/Icons';

interface DownloadModalProps {
    isOpen: boolean;
    onClose: () => void;
    streamData: any;
    isLoading: boolean;
    onRetry: () => void;
}

const DownloadModal: React.FC<DownloadModalProps> = ({ isOpen, onClose, streamData, isLoading, onRetry }) => {
    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center animate-fade-in" onClick={onClose}>
            <div className="bg-yt-white dark:bg-yt-light-black w-full max-w-md rounded-xl shadow-2xl overflow-hidden animate-scale-in border border-yt-spec-light-20 dark:border-yt-spec-20" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-yt-spec-light-20 dark:border-yt-spec-20 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-black dark:text-white flex items-center gap-2">
                        <DownloadIcon /> ダウンロード
                    </h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-yt-spec-light-10 dark:hover:bg-yt-spec-20">
                        <CloseIcon />
                    </button>
                </div>
                
                <div className="p-6">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-8 gap-4">
                            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-yt-blue"></div>
                            <p className="text-yt-light-gray font-medium">リンクを取得中...</p>
                        </div>
                    ) : !streamData ? (
                        <div className="text-center py-8">
                            <p className="text-red-500 mb-4">情報の取得に失敗しました。</p>
                            <button onClick={onRetry} className="px-6 py-2 bg-yt-blue text-white rounded-full hover:opacity-90 transition-opacity">
                                再試行
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                            <div>
                                <h3 className="text-xs font-bold text-yt-light-gray mb-2 uppercase tracking-wider">動画 (MP4)</h3>
                                <div className="space-y-2">
                                    {/* 1080p Separate */}
                                    {streamData.separate1080p?.video?.url && (
                                        <a 
                                            href={streamData.separate1080p.video.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center justify-between p-3 rounded-lg bg-yt-light dark:bg-yt-dark-gray hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors group"
                                            onClick={onClose}
                                        >
                                            <span className="font-semibold text-black dark:text-white">1080p (映像のみ)</span>
                                            <span className="text-xs bg-black/10 dark:bg-white/10 px-2 py-1 rounded text-black dark:text-white group-hover:bg-white group-hover:text-black transition-colors">MP4</span>
                                        </a>
                                    )}

                                    {/* Combined Formats (360p, 720p, etc.) */}
                                    {streamData.combinedFormats && streamData.combinedFormats.map((format: any, index: number) => {
                                        const quality = format.quality || 'Unknown';
                                        return (
                                            <a 
                                                key={index}
                                                href={format.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center justify-between p-3 rounded-lg bg-yt-light dark:bg-yt-dark-gray hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors group"
                                                onClick={onClose}
                                            >
                                                <span className="font-semibold text-black dark:text-white">{quality} (音声あり)</span>
                                                <span className="text-xs bg-black/10 dark:bg-white/10 px-2 py-1 rounded text-black dark:text-white group-hover:bg-white group-hover:text-black transition-colors">MP4</span>
                                            </a>
                                        );
                                    })}
                                </div>
                            </div>
                            
                            {streamData.audioOnlyFormat?.url && (
                                <div>
                                    <h3 className="text-xs font-bold text-yt-light-gray mb-2 uppercase tracking-wider mt-4">音声 (M4A)</h3>
                                    <a 
                                        href={streamData.audioOnlyFormat.url}
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-between p-3 rounded-lg bg-yt-light dark:bg-yt-dark-gray hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors group"
                                        onClick={onClose}
                                    >
                                        <span className="font-semibold text-black dark:text-white">音声のみ ({streamData.audioOnlyFormat.quality || ''})</span>
                                        <span className="text-xs bg-black/10 dark:bg-white/10 px-2 py-1 rounded text-black dark:text-white group-hover:bg-white group-hover:text-black transition-colors">M4A</span>
                                    </a>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default DownloadModal;