

import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback } from 'react';
import { useSubscription } from './SubscriptionContext';
import type { Notification, Video } from '../types';
import { getChannelVideos } from '../utils/api';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  markAsRead: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { subscribedChannels } = useSubscription();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState<number>(0);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        try {
            const storedNotifications = localStorage.getItem('notifications');
            if (storedNotifications) {
                setNotifications(JSON.parse(storedNotifications));
            }
        } catch (error) {
            console.error("Failed to load notifications from localStorage", error);
        }
    }, []);

    const fetchNotifications = useCallback(async () => {
        if (subscribedChannels.length === 0 || isLoading) {
            return;
        }
        setIsLoading(true);

        const lastCheckStr = localStorage.getItem('lastNotificationCheck');
        const lastCheckDate = lastCheckStr ? new Date(lastCheckStr) : null;
        const channelMap = new Map(subscribedChannels.map(c => [c.id, c]));
        
        const requests = subscribedChannels.map(channel => 
            getChannelVideos(channel.id).then(res => res.videos.length > 0 ? res.videos[0] : null)
        );

        try {
            const results = await Promise.allSettled(requests);
            const newNotifications: Notification[] = [];
            const existingNotificationIds = new Set(notifications.map(n => n.id));

            results.forEach(result => {
                if (result.status === 'fulfilled' && result.value) {
                    const video: Video = result.value;
                    const channel = channelMap.get(video.channelId);
                    
                    // Simple check to avoid adding duplicates and assume new if not seen
                    if (channel && !existingNotificationIds.has(video.id)) {
                        newNotifications.push({
                            id: video.id,
                            channel: {
                                id: channel.id,
                                name: channel.name,
                                avatarUrl: channel.avatarUrl,
                            },
                            video: {
                                id: video.id,
                                title: video.title,
                                thumbnailUrl: video.thumbnailUrl,
                                uploadedAt: video.uploadedAt,
                            },
                            // The proxy doesn't provide reliable ISO dates, so we use current time for sorting.
                            // The `formatTimeAgo` will show the video's original upload time text.
                            publishedAt: new Date().toISOString(), 
                        });
                    }
                }
            });

            if (newNotifications.length > 0) {
                // We add a check for lastCheckDate here, although it's less reliable without ISO dates.
                // This prevents old videos from channels being re-added as "new" notifications on first load after subscribing.
                const trulyNew = lastCheckDate ? newNotifications : [];

                if(trulyNew.length > 0) {
                    setNotifications(prev => {
                        const combined = [...trulyNew, ...prev];
                        const uniqueNotifications = Array.from(new Map(combined.map(item => [item.id, item])).values());
                        const sorted = uniqueNotifications.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
                        const finalNotifications = sorted.slice(0, 30);
                        localStorage.setItem('notifications', JSON.stringify(finalNotifications));
                        return finalNotifications;
                    });
                    setUnreadCount(prev => prev + trulyNew.length);
                }
            }
        } catch (error) {
            console.error("Failed to fetch notifications:", error);
        } finally {
            setIsLoading(false);
            // Set initial check date after first fetch to avoid re-notifying
            if (!lastCheckStr) {
                 localStorage.setItem('lastNotificationCheck', new Date().toISOString());
            }
        }
    }, [subscribedChannels, isLoading, notifications]);

    useEffect(() => {
        const timer = setTimeout(() => {
             fetchNotifications();
        }, 1000);
        return () => clearTimeout(timer);
    }, [subscribedChannels]); // eslint-disable-line react-hooks/exhaustive-deps

    const markAsRead = useCallback(() => {
        setUnreadCount(0);
        localStorage.setItem('lastNotificationCheck', new Date().toISOString());
    }, []);

    return (
        <NotificationContext.Provider value={{ notifications, unreadCount, isLoading, markAsRead }}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotification = (): NotificationContextType => {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
};