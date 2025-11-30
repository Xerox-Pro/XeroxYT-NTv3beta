

import React from 'react';

const VideoPlayerPageSkeleton: React.FC = () => {
    const RelatedVideoSkeleton = () => (
        <div className="flex gap-2">
            <div className="w-40 h-24 bg-yt-light dark:bg-yt-dark-gray rounded-lg flex-shrink-0"></div>
            <div className="flex-1 space-y-2">
                <div className="h-4 bg-yt-light dark:bg-yt-dark-gray rounded w-full"></div>
                <div className="h-4 bg-yt-light dark:bg-yt-dark-gray rounded w-3/4"></div>
                <div className="h-3 bg-yt-light dark:bg-yt-dark-gray rounded w-1/2"></div>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col lg:flex-row gap-6 max-w-[1750px] mx-auto pt-2 md:pt-6 px-4 md:px-6 justify-center animate-pulse">
            <div className="flex-1 min-w-0 max-w-full">
                {/* Video Player Placeholder */}
                <div className="w-full aspect-video bg-yt-light dark:bg-yt-dark-gray rounded-xl shadow-lg"></div>
                
                <div className="">
                    <div className="h-7 bg-yt-light dark:bg-yt-dark-gray rounded w-3/4 mt-4"></div>
                    
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mt-4">
                        <div className="flex items-center">
                            <div className="w-10 h-10 rounded-full bg-yt-light dark:bg-yt-dark-gray"></div>
                            <div className="ml-3 space-y-2">
                                <div className="h-4 bg-yt-light dark:bg-yt-dark-gray rounded w-32"></div>
                                <div className="h-3 bg-yt-light dark:bg-yt-dark-gray rounded w-24"></div>
                            </div>
                            <div className="ml-6 h-9 w-24 bg-yt-light dark:bg-yt-dark-gray rounded-full hidden sm:block"></div>
                        </div>
                        <div className="flex items-center space-x-2 mt-4 sm:mt-0">
                            <div className="h-9 w-32 bg-yt-light dark:bg-yt-dark-gray rounded-full"></div>
                            <div className="h-9 w-24 bg-yt-light dark:bg-yt-dark-gray rounded-full"></div>
                            <div className="h-9 w-24 bg-yt-light dark:bg-yt-dark-gray rounded-full"></div>
                        </div>
                    </div>

                    <div className="mt-4 bg-yt-light dark:bg-yt-dark-gray p-3 rounded-xl space-y-2">
                        <div className="h-4 bg-yt-gray dark:bg-yt-gray rounded w-48"></div>
                        <div className="h-3 bg-yt-gray dark:bg-yt-gray rounded w-full"></div>
                        <div className="h-3 bg-yt-gray dark:bg-yt-gray rounded w-full"></div>
                        <div className="h-3 bg-yt-gray dark:bg-yt-gray rounded w-2/3"></div>
                    </div>
                </div>
            </div>
            
            <div className="w-full lg:w-[350px] xl:w-[400px] flex-shrink-0">
                <div className="flex flex-col space-y-3">
                    {Array.from({ length: 10 }).map((_, index) => <RelatedVideoSkeleton key={index} />)}
                </div>
            </div>
        </div>
    );
};

export default VideoPlayerPageSkeleton;