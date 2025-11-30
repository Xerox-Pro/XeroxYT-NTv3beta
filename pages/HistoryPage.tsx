

import React, { useState } from 'react';
import { useHistory } from '../contexts/HistoryContext';
import SearchVideoResultCard from '../components/SearchVideoResultCard';
import ShortsShelf from '../components/ShortsShelf';

type HistoryTab = 'videos' | 'shorts';

const HistoryPage: React.FC = () => {
    const { history, shortsHistory } = useHistory();
    const [activeTab, setActiveTab] = useState<HistoryTab>('videos');

    return (
        <div className="max-w-4xl mx-auto px-4 py-4">
            <h1 className="text-2xl font-bold mb-6">視聴履歴</h1>
            
            <div className="flex items-center space-x-2 mb-6 border-b border-yt-spec-light-20 dark:border-yt-spec-20">
                <button
                    onClick={() => setActiveTab('videos')}
                    className={`px-4 py-2 font-medium text-sm transition-colors relative ${activeTab === 'videos' ? 'text-black dark:text-white' : 'text-yt-light-gray hover:text-black dark:hover:text-white'}`}
                >
                    すべての動画
                    {activeTab === 'videos' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black dark:bg-white"></div>}
                </button>
                <button
                    onClick={() => setActiveTab('shorts')}
                    className={`px-4 py-2 font-medium text-sm transition-colors relative ${activeTab === 'shorts' ? 'text-black dark:text-white' : 'text-yt-light-gray hover:text-black dark:hover:text-white'}`}
                >
                    ショート
                    {activeTab === 'shorts' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black dark:bg-white"></div>}
                </button>
            </div>

            {activeTab === 'videos' && (
                <>
                    {history.length === 0 ? (
                        <p className="text-center text-yt-light-gray py-10">動画の視聴履歴はありません。</p>
                    ) : (
                        <div className="flex flex-col space-y-4">
                            {history.map((video, index) => (
                                <SearchVideoResultCard key={`${video.id}-${index}`} video={video} />
                            ))}
                        </div>
                    )}
                </>
            )}

            {activeTab === 'shorts' && (
                <>
                    {shortsHistory.length === 0 ? (
                        <p className="text-center text-yt-light-gray py-10">ショート動画の視聴履歴はありません。</p>
                    ) : (
                        <div className="py-2">
                             {/* Use ShortsShelf but force it to display grid-like or just the shelf logic if needed. 
                                Since ShortsShelf is horizontal scrolling, we might want a grid here or just list.
                                Reusing ShortsShelf is simplest for UI consistency, but stacking shelves looks weird if we map one by one.
                                Let's put them all in one shelf or just grid them.
                                Since user might have many, a Grid of ShortsCards is better.
                              */}
                             <ShortsShelf shorts={shortsHistory} isLoading={false} />
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default HistoryPage;