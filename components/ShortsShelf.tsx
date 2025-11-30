

import React, { useRef, useState, useEffect, useCallback } from 'react';
import type { Video } from '../types';
import ShortsCard from './ShortsCard';
import { ShortsIcon, ChevronLeftIcon, ChevronRightIcon } from './icons/Icons';

const ShortsCardSkeleton: React.FC = () => (
  <div className="w-44 flex-shrink-0 animate-pulse">
    <div className="w-full aspect-[9/16] rounded-xl bg-yt-light dark:bg-yt-dark-gray"></div>
    <div className="mt-2 space-y-2">
      <div className="h-4 bg-yt-light dark:bg-yt-dark-gray rounded w-full"></div>
      <div className="h-4 bg-yt-light dark:bg-yt-dark-gray rounded w-2/3"></div>
    </div>
  </div>
);

interface ShortsShelfProps {
  shorts: Video[];
  isLoading: boolean;
}

const ShortsShelf: React.FC<ShortsShelfProps> = ({ shorts, isLoading }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScrollability = useCallback(() => {
    const el = scrollContainerRef.current;
    if (el) {
      const isScrollable = el.scrollWidth > el.clientWidth;
      setCanScrollLeft(isScrollable && el.scrollLeft > 1);
      setCanScrollRight(isScrollable && el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
    } else {
        setCanScrollLeft(false);
        setCanScrollRight(false);
    }
  }, []);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el && !isLoading) {
      checkScrollability();
      const resizeObserver = new ResizeObserver(checkScrollability);
      resizeObserver.observe(el);
      el.addEventListener('scroll', checkScrollability, { passive: true });
      
      return () => {
        resizeObserver.disconnect();
        el.removeEventListener('scroll', checkScrollability);
      };
    }
  }, [isLoading, shorts, checkScrollability]);

  const handleScroll = (direction: 'left' | 'right') => {
    const el = scrollContainerRef.current;
    if (el) {
      const scrollAmount = el.clientWidth * 0.8;
      el.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };


  return (
    <section>
      <div className="flex items-center mb-4">
        <ShortsIcon />
        <h2 className="text-2xl font-bold ml-3 text-black dark:text-white">ショート</h2>
      </div>
      <div className="relative group">
        <div className="overflow-hidden">
            <div 
              ref={scrollContainerRef}
              className="flex flex-nowrap space-x-4 overflow-x-auto pb-4 no-scrollbar scroll-smooth"
            >
              {isLoading ? (
                Array.from({ length: 10 }).map((_, index) => <ShortsCardSkeleton key={index} />)
              ) : (
                shorts.map(video => (
                  <div key={video.id} className="w-44 flex-shrink-0">
                    <ShortsCard video={video} context={{ type: 'home' }} />
                  </div>
                ))
              )}
            </div>
        </div>
        {canScrollLeft && (
          <button
            onClick={() => handleScroll('left')}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-yt-white/90 dark:bg-yt-light-black/90 shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110 active:scale-100"
            aria-label="スクロール（左）"
          >
            <ChevronLeftIcon />
          </button>
        )}
        {canScrollRight && (
          <button
            onClick={() => handleScroll('right')}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-yt-white/90 dark:bg-yt-light-black/90 shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110 active:scale-100"
            aria-label="スクロール（右）"
          >
            <ChevronRightIcon />
          </button>
        )}
      </div>
    </section>
  );
};

export default ShortsShelf;