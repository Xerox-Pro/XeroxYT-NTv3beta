

import React from 'react';

const iconClasses = "fill-current text-black dark:text-white";
const secondaryIconClasses = "fill-current text-yt-icon dark:text-yt-light-gray";

export const MenuIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" focusable="false" className={iconClasses}>
    <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"></path>
  </svg>
);

export const YouTubeLogo: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-auto" viewBox="0 0 28.9 20.21" focusable="false">
        <path fill="#FF0000" d="M28.3,3.12a3.58,3.58,0,0,0-2.52-2.52C23.6,0,14.45,0,14.45,0S5.3,0,3.12,0.6A3.58,3.58,0,0,0,0.6,3.12C0,5.35,0,10.1,0,10.1s0,4.75,0.6,7a3.58,3.58,0,0,0,2.52,2.52c2.18,0.6,11.33,0.6,11.33,0.6s9.15,0,11.33-0.6a3.58,3.58,0,0,0,2.52-2.52c0.6-2.18,0.6-7,0.6-7S28.9,5.35,28.3,3.12Z"/>
        <path fill="#FFFFFF" d="M11.56,14.49,19,10.1,11.56,5.71V14.49Z"/>
    </svg>
);

interface XeroxLogoProps {
    className?: string;
    variant?: 'dark' | 'light' | 'glass';
}

export const XeroxLogo: React.FC<XeroxLogoProps> = ({className, variant = 'dark'}) => {
    // Determine colors based on variant
    let bgFill = "#202020"; // Dark default
    let arrowFill = "#fff";
    
    if (variant === 'light') {
        bgFill = "#ffffff";
        arrowFill = "#0f0f0f";
    } else if (variant === 'glass') {
        bgFill = "rgba(255, 255, 255, 0.4)"; // Translucent
        arrowFill = "#1e293b"; // Dark slate for contrast on glass
    }

    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 68 48" className={className}>
            <defs>
                <linearGradient id="xeroxGradient" x1="0%" y1="100%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#ef4444" />
                </linearGradient>
            </defs>
            {/* Background Shape */}
            <path d="M66.52,7.74c-0.78-2.93-2.49-5.41-5.42-6.19C55.79,.13,34,0,34,0S12.21,.13,6.9,1.55 C3.97,2.33,2.27,4.81,1.48,7.74C0.06,13.05,0,24,0,24s0.06,10.95,1.48,16.26c0.78,2.93,2.49,5.41,5.42,6.19 C12.21,47.87,34,48,34,48s21.79-0.13,27.1-1.55c2.93-0.78,4.64-3.26,5.42-6.19C67.94,34.95,68,24,68,24S67.94,13.05,66.52,7.74z" fill={bgFill} stroke="url(#xeroxGradient)" strokeWidth="6" />
            {/* Play Arrow */}
            <path d="M 45,24 27,14 27,34" fill={arrowFill} />
        </svg>
    );
};


export const SearchIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" focusable="false" className={iconClasses}>
    <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"></path>
  </svg>
);

export const MicIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" focusable="false" className={iconClasses}>
    <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.49 6-3.31 6-6.72h-1.7z"></path>
  </svg>
);

export const VideoPlusIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" focusable="false" className={iconClasses}>
    <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4zM14 13h-3v3H9v-3H6v-2h3V8h2v3h3v2z"></path>
  </svg>
);

export const BellIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" focusable="false" className={iconClasses}>
    <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"></path>
  </svg>
);

export const HomeIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" focusable="false" className={iconClasses}>
        <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"></path>
    </svg>
);

export const ShortsIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" focusable="false" className={iconClasses}>
        <path d="M10 14.5v-5l4 2.5-4 2.5zM17.5 3C18.88 3 20 4.12 20 5.5v13c0 1.38-1.12 2.5-2.5 2.5h-11C5.12 21 4 19.88 4 18.5v-13C4 4.12 5.12 3 6.5 3h11zm0 1H6.5c-.83 0-1.5.67-1.5 1.5v13c0 .83.67 1.5 1.5 1.5h11c.83 0 1.5-.67 1.5-1.5v-13c0-.83-.67-1.5-1.5-1.5z"></path>
    </svg>
);

export const SubscriptionsIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" focusable="false" className={iconClasses}>
        <path d="M10,18v-6l5,3L10,18z M17,3H7v1h10V3z M20,6H4v1h16V6z M22,9H2v12h20V9z M3,10h18v10H3V10z"></path>
    </svg>
);

export const YouIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" focusable="false" className={iconClasses}>
        <path d="M12,8c1.66,0,3,1.34,3,3s-1.34,3-3,3s-3-1.34-3-3S10.34,8,12,8z M12,6c-2.76,0-5,2.24-5,5s2.24,5,5,5s5-2.24,5-5 S14.76,6,12,6z M20,3H4v1h16V3z M20,5H4v1h16V5z M21,7H3v11h18V7z M4,17V8h16v9H4z"></path>
    </svg>
);

export const HistoryIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" focusable="false" className={iconClasses}>
        <path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6a7 7 0 0 1 7-7 7 7 0 0 1 7 7 7 7 0 0 1-7 7v2a9 9 0 0 0 9-9 9 9 0 0 0-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"></path>
    </svg>
);

export const LikeIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" focusable="false" className={iconClasses}>
        <path d="M18.77,11h-4.23l1.52-4.94C16.38,5.03,15.54,4,14.38,4c-0.58,0-1.14,0.24-1.52,0.65L7,11H3v10h4h1h9.43 c1.06,0,1.98-0.67,2.19-1.61l1.34-6C21.23,12.15,20.18,11,18.77,11z M7,20H4v-8h3V20z M19.98,13.17l-1.34,6 C18.54,19.65,18.03,20,17.43,20H8v-8.61l5.6-6.06C13.79,5.12,14.08,5,14.38,5c0.26,0,0.5,0.11,0.63,0.3 c0.11,0.15,0.15,0.34,0.09,0.51l-1.52,4.94L13.18,12h1.35h4.23c0.41,0,0.8,0.17,1.03,0.46C19.92,12.61,20.05,12.86,19.98,13.17z"></path>
    </svg>
);

export const LikeIconFilled: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" focusable="false" className={iconClasses}>
        <path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"></path>
    </svg>
);

export const DislikeIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" focusable="false" className={iconClasses}>
        <path d="M17 4h-1H6.57C5.5 4 4.59 4.67 4.38 5.61l-1.34 6C2.77 12.85 3.82 14 5.23 14h4.23l-1.52 4.94C7.62 19.97 8.46 21 9.62 21c0.58 0 1.14-0.24 1.52-0.65L17 14h4V4h-4z M10.4 19.63L10.82 19l1.52-4.94L12.65 13h-1.35h-4.23c-0.41 0-0.8-0.17-1.03-0.46C5.77 12.24 5.64 11.99 5.71 11.68l1.34-6C7.34 4.7 7.85 4.35 8.45 4.35H16v8.61l-5.6 6.06C10.1 19.38 10.24 19.51 10.4 19.63z M20 13h-3V5h3V13z"></path>
    </svg>
);

export const SaveIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" focusable="false" className={iconClasses}>
        <path d="M14 10H2v2h12v-2zm0-4H2v2h12V6zm4 8v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zM2 16h8v-2H2v2z"></path>
    </svg>
);

export const ShareIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" focusable="false" className={iconClasses}>
        <path d="M15 5.63 20.66 12 15 18.37V14h-1c-3.96 0-7.14 1-9.75 3.09 1.84-4.07 5.11-6.4 9.89-7.1l.86-.13V5.63M14 3v6C6.22 10.13 3.11 15.33 2 21c2.78-3.97 6.44-6 12-6v6l8-9-8-9z"></path>
    </svg>
);

export const DownloadIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" focusable="false" className={iconClasses}>
        <path d="M17 18v1H6v-1h11zm-.5-6.6-.7-.7-3.8 3.7V4h-1v10.4l-3.8-3.8-.7.7 5 5 5-4.9z"></path>
    </svg>
);

export const ThanksIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" focusable="false" className={iconClasses}>
        <path d="M16.5 3C19.54 3 22 5.46 22 8.5c0 3.75-3.69 6.86-8.65 11.36l-1.35 1.22-1.35-1.22C5.69 15.36 2 12.25 2 8.5 2 5.46 4.46 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3zm0 1c-1.46 0-2.88.71-3.79 1.88l-.71.91-.71-.91C10.38 4.71 8.96 4 7.5 4 5.02 4 3 6.02 3 8.5c0 2.9 2.91 5.53 7.59 9.8l1.41 1.28 1.41-1.28C18.09 14.03 21 11.4 21 8.5 21 6.02 18.98 4 16.5 4zM11.5 7.5h1l2.5 3.33v.92l-2.5 3.33h-1l-1.82-2.5H8v-1.17h1.68L11.5 7.5zm0 1.91L10.81 10.5h1.38L11.5 9.41zm0 3.18 1.31-1.75h-2.62l1.31 1.75z"></path>
    </svg>
);

export const PlaylistIcon: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" focusable="false" className={className || iconClasses}>
        <path d="M3 10h11v2H3v-2zm0-4h11v2H3V6zm0 8h7v2H3v-2zm13-1v-6l5 3-5 3z"></path>
    </svg>
);

export const PlayIcon: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" focusable="false" className={className || iconClasses}>
        <path d="M8 5v14l11-7z"></path>
    </svg>
);

export const MoreIconHorizontal: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" focusable="false" className={iconClasses}>
        <path d="M6 10h2v2H6zm6 0h2v2h-2zm6 0h2v2h-2z"></path>
    </svg>
);

export const SunIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" focusable="false" className={iconClasses}>
    <g>
        <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.93c.39-.39.39-1.02 0-1.41-.39-.39-1.02-.39-1.41 0l-1.41 1.41c-.39.39-.39 1.02 0 1.41.39.39 1.02.39 1.41 0l1.41-1.41zm13.41 14.15c.39-.39.39-1.02 0-1.41l-1.41-1.41c-.39-.39-1.02-.39-1.41 0-.39.39-.39 1.02 0 1.41l1.41 1.41c.39.39 1.02.39 1.41 0zM4.58 19.41c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41l-1.41-1.41c-.39-.39-1.02-.39-1.41 0-.39.39-.39 1.02 0 1.41l1.41 1.41zm14.83-14.83c.39-.39.39-1.02 0-1.41-.39-.39-1.02-.39-1.41 0L16.59 4.58c-.39.39-.39 1.02 0 1.41.39.39 1.02.39 1.41 0l1.41-1.41z"/>
    </g>
  </svg>
);

export const MoonIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" focusable="false" className={iconClasses}>
    <path d="M10 2c-1.82 0-3.53.5-5 1.35C7.99 5.08 10 8.3 10 12s-2.01 6.92-5 8.65C6.47 21.5 8.18 22 10 22c5.52 0 10-4.48 10-10S15.52 2 10 2"></path>
  </svg>
);

export const LightbulbIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" focusable="false" className={iconClasses}>
    <path d="M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7zM9 21a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-1H9z"></path>
  </svg>
);

export const CloseIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" focusable="false" className={iconClasses}>
    <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"></path>
  </svg>
);

export const BlockIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" focusable="false" className={iconClasses}>
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM4 12c0-4.42 3.58-8 8-8 1.85 0 3.55.63 4.9 1.69L5.69 16.9C4.63 15.55 4 13.85 4 12zm8 8c-1.85 0-3.55-.63-4.9-1.69L18.31 7.1C19.37 8.45 20 10.15 20 12c0 4.42-3.58 8-8 8z"></path>
    </svg>
);

export const CheckIcon: React.FC<{className?: string}> = ({className}) => (
  <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" focusable="false" className={className || "fill-current text-yt-blue"}>
    <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"></path>
  </svg>
);

export const TrashIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" focusable="false" className={iconClasses}>
        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"></path>
    </svg>
);

export const EditIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" focusable="false" className={iconClasses}>
        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"></path>
    </svg>
);

export const SettingsIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" focusable="false" className={iconClasses}>
        <path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"></path>
    </svg>
);

export const CommentIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" focusable="false" className="fill-current text-white">
        <path d="M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18zM20 4v12H5.17L4 17.17V4h16z"></path>
    </svg>
);

export const MusicNoteIcon: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" height="16" viewBox="0 0 24 24" width="16" focusable="false" className={className}>
        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"></path>
    </svg>
);

export const ChevronLeftIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" focusable="false" className={iconClasses}>
    <path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z"></path>
  </svg>
);

export const ChevronRightIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" focusable="false" className={iconClasses}>
    <path d="M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"></path>
  </svg>
);

export const ShuffleIcon: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" focusable="false" className={className || iconClasses}>
        <path d="m14.83 5.17 2.83 2.83H4v2h13.66l-2.83 2.83 1.41 1.41L21.41 12l-5.17-5.17-1.41 1.41zM4 15h6.17l-2.83 2.83 1.41 1.41L12.41 15.5l-3.66-3.66-1.41 1.41L10.17 16H4v-1z"></path>
    </svg>
);

export const RepeatIcon: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" focusable="false" className={className || iconClasses}>
        <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"></path>
    </svg>
);

export const AddToPlaylistIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" focusable="false" className={iconClasses}>
        <path d="M14 10H2v2h12v-2zm0-4H2v2h12V6zm4 8v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zM2 16h8v-2H2v2z"></path>
    </svg>
);

export const DragHandleIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" focusable="false" className={iconClasses}>
        <path d="M20 9H4v2h16V9zM4 15h16v-2H4v2z"></path>
    </svg>
);