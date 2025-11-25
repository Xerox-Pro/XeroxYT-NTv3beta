
import React, { useState } from 'react';
import { useSearchHistory } from '../contexts/SearchHistoryContext';
import { CloseIcon, TrashIcon } from './icons/Icons';

interface SearchHistoryDeletionModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const SearchHistoryDeletionModal: React.FC<SearchHistoryDeletionModalProps> = ({ isOpen, onClose }) => {
    const { searchHistory, removeSearchTerms } = useSearchHistory();
    const [selectedTerms, setSelectedTerms] = useState<Set<string>>(new Set());

    if (!isOpen) return null;

    const handleToggleTerm = (term: string) => {
        const newSelected = new Set(selectedTerms);
        if (newSelected.has(term)) {
            newSelected.delete(term);
        } else {
            newSelected.add(term);
        }
        setSelectedTerms(newSelected);
    };

    const handleDeleteSelected = () => {
        if (selectedTerms.size > 0) {
            if (window.confirm(`${selectedTerms.size}件の検索履歴を削除しますか？`)) {
                removeSearchTerms(Array.from(selectedTerms));
                setSelectedTerms(new Set());
            }
        }
    };

    const handleSelectAll = () => {
        if (selectedTerms.size === searchHistory.length) {
            setSelectedTerms(new Set());
        } else {
            setSelectedTerms(new Set(searchHistory));
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-yt-white dark:bg-yt-light-black w-full max-w-lg rounded-xl shadow-2xl flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-yt-spec-light-20 dark:border-yt-spec-20 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-black dark:text-white">検索履歴の管理</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-yt-spec-light-10 dark:hover:bg-yt-spec-10">
                        <CloseIcon />
                    </button>
                </div>
                
                <div className="p-2 border-b border-yt-spec-light-20 dark:border-yt-spec-20 flex justify-between items-center bg-yt-light dark:bg-yt-black">
                    <button 
                        onClick={handleSelectAll}
                        className="text-sm font-semibold text-yt-blue px-4 py-2 rounded hover:bg-yt-blue/10"
                    >
                        {selectedTerms.size === searchHistory.length ? 'すべて選択解除' : 'すべて選択'}
                    </button>
                    <button 
                        onClick={handleDeleteSelected}
                        disabled={selectedTerms.size === 0}
                        className={`flex items-center gap-2 px-4 py-2 rounded font-semibold text-sm transition-colors ${selectedTerms.size > 0 ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20' : 'text-yt-light-gray cursor-not-allowed'}`}
                    >
                        <TrashIcon />
                        <span>削除 ({selectedTerms.size})</span>
                    </button>
                </div>

                <div className="overflow-y-auto flex-1 p-4">
                    {searchHistory.length === 0 ? (
                        <div className="text-center py-10 text-yt-light-gray">履歴はありません。</div>
                    ) : (
                        <div className="space-y-2">
                            {searchHistory.map((term, index) => (
                                <div 
                                    key={`${term}-${index}`} 
                                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${selectedTerms.has(term) ? 'bg-yt-blue/10 dark:bg-yt-blue/20 border border-yt-blue/30' : 'hover:bg-yt-spec-light-10 dark:hover:bg-yt-spec-10 border border-transparent'}`}
                                    onClick={() => handleToggleTerm(term)}
                                >
                                    <input 
                                        type="checkbox" 
                                        checked={selectedTerms.has(term)}
                                        onChange={() => {}} 
                                        className="w-5 h-5 accent-yt-blue cursor-pointer"
                                    />
                                    <span className="text-base text-black dark:text-white flex-1 truncate">{term}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SearchHistoryDeletionModal;
