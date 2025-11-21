
import React, { useState } from 'react';
import { CloseIcon } from './icons/Icons';
import { usePreference } from '../contexts/PreferenceContext';

interface PreferenceModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const PreferenceModal: React.FC<PreferenceModalProps> = ({ isOpen, onClose }) => {
    const { 
        preferredGenres, 
        preferredDurations, preferredFreshness, discoveryMode, ngKeywords, ngChannels,
        prefDepth, prefVocal, prefInfoEnt, prefVisual, prefCommunity,
        useXrai,
        addPreferredGenre, removePreferredGenre, 
        togglePreferredDuration, setPreferredFreshness, setDiscoveryMode,
        addNgKeyword, removeNgKeyword, removeNgChannel,
        setPrefDepth, setPrefVocal, setPrefInfoEnt, setPrefVisual, setPrefCommunity,
        setUseXrai
    } = usePreference();

    const [genreInput, setGenreInput] = useState('');
    const [ngInput, setNgInput] = useState('');

    if (!isOpen) return null;

    const handleAddGenre = (e: React.FormEvent) => {
        e.preventDefault();
        if (genreInput.trim()) {
            addPreferredGenre(genreInput.trim());
            setGenreInput('');
        }
    };

    const handleAddNg = (e: React.FormEvent) => {
        e.preventDefault();
        if (ngInput.trim()) {
            addNgKeyword(ngInput.trim());
            setNgInput('');
        }
    };
    
    const addQuickTag = (tag: string) => {
        addPreferredGenre(tag);
    }
    
    // Helper to handle both single string and array of strings for selection state
    const ToggleGroup: React.FC<{ 
        label: string, 
        options: { id: string, label: string }[], 
        current: string | string[], 
        onChange: (val: string) => void 
    }> = ({ label, options, current, onChange }) => {
        const isSelected = (id: string) => {
            if (Array.isArray(current)) {
                return current.includes(id);
            }
            return current === id;
        };

        return (
            <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-yt-light-gray uppercase tracking-wider">{label}</label>
                <div className="flex gap-2 flex-wrap">
                    {options.map(opt => (
                        <button
                            key={opt.id}
                            onClick={() => onChange(opt.id)}
                            className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all transform active:scale-95 flex items-center justify-center gap-2 flex-1 min-w-[80px] ${
                                isSelected(opt.id)
                                ? 'bg-yt-blue text-white border-yt-blue shadow-md'
                                : 'bg-yt-light dark:bg-yt-spec-10 text-yt-gray dark:text-yt-light-gray border-transparent hover:bg-gray-200 dark:hover:bg-yt-spec-20'
                            }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60]" onClick={onClose}>
            <div className="bg-yt-white dark:bg-[#1f1f1f] w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col m-4 overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-6 border-b border-yt-spec-light-20 dark:border-yt-spec-20 flex-shrink-0 bg-yt-white dark:bg-[#1f1f1f]">
                    <div>
                        <h2 className="text-2xl font-black text-black dark:text-white tracking-tight">おすすめ表示の設定</h2>
                        <p className="text-xs text-yt-light-gray mt-1">好みを設定して、AIによるレコメンド精度を向上させます</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-yt-spec-light-10 dark:hover:bg-yt-spec-10 transition-colors">
                        <CloseIcon />
                    </button>
                </div>

                <div className="overflow-y-auto p-6 space-y-10 flex-1">
                    {/* Section 0: Engine Selection */}
                    <section>
                        <h3 className="text-lg font-bold text-black dark:text-white mb-4 flex items-center gap-2">
                           推薦エンジン設定
                        </h3>
                         <div className="bg-yt-light dark:bg-yt-spec-10 p-4 rounded-xl flex items-center justify-between">
                            <div>
                                <h4 className="font-bold text-black dark:text-white">XRAIエンジンを有効にする</h4>
                                <p className="text-xs text-yt-light-gray mt-1">あなた専用に最適化された、より高度なAI推薦を利用します。</p>
                            </div>
                            <label className="relative inline-block w-12 h-6 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={useXrai}
                                    onChange={() => setUseXrai(!useXrai)}
                                    className="sr-only"
                                />
                                <div className={`block h-6 rounded-full transition-colors ${useXrai ? 'bg-yt-blue' : 'bg-yt-gray'}`}></div>
                                <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${useXrai ? 'transform translate-x-6' : ''}`}></div>
                            </label>
                         </div>
                    </section>
                    
                    {/* Section 1: Vibe Check */}
                    <section>
                         <h3 className="text-lg font-bold text-black dark:text-white mb-4 flex items-center gap-2">
                            映像・音声の好み
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-6">
                             <ToggleGroup 
                                label="映像スタイル" 
                                current={prefVisual} 
                                onChange={setPrefVisual} 
                                options={[
                                    { id: 'avatar', label: 'アニメ・CG' }, 
                                    { id: 'real', label: '実写' }, 
                                    { id: 'any', label: '好き' }
                                ]} 
                            />
                            <ToggleGroup 
                                label="音声タイプ" 
                                current={prefVocal} 
                                onChange={setPrefVocal} 
                                options={[
                                    { id: 'instrumental', label: '音楽・BGM' }, 
                                    { id: 'vocal', label: 'トーク・歌' }, 
                                    { id: 'any', label: '普通' }
                                ]} 
                            />
                        </div>
                    </section>

                    {/* Section 2: Content Style */}
                    <section>
                        <h3 className="text-lg font-bold text-black dark:text-white mb-4 flex items-center gap-2">
                            動画の傾向
                        </h3>
                         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-6">
                            <ToggleGroup 
                                label="内容の深さ" 
                                current={prefDepth} 
                                onChange={setPrefDepth} 
                                options={[
                                    { id: 'casual', label: '手軽に' }, 
                                    { id: 'deep', label: '詳細・解説' }, 
                                    { id: 'any', label: '普通' }
                                ]} 
                            />
                             <ToggleGroup 
                                label="ジャンル傾向" 
                                current={prefInfoEnt} 
                                onChange={setPrefInfoEnt} 
                                options={[
                                    { id: 'entertainment', label: 'エンタメ' }, 
                                    { id: 'education', label: '知識・学習' }, 
                                    { id: 'any', label: '普通' }
                                ]} 
                            />
                            <ToggleGroup 
                                label="出演スタイル" 
                                current={prefCommunity} 
                                onChange={setPrefCommunity} 
                                options={[
                                    { id: 'solo', label: 'ソロ' }, 
                                    { id: 'collab', label: 'コラボ' }, 
                                    { id: 'any', label: '普通' }
                                ]} 
                            />
                         </div>
                    </section>

                    <hr className="border-yt-spec-light-20 dark:border-yt-spec-20" />
                    
                    {/* Section 3: Search Filters */}
                     <section>
                        <h3 className="text-lg font-bold text-black dark:text-white mb-4 flex items-center gap-2">
                            検索・フィルター設定
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                            <ToggleGroup 
                                label="動画の長さ（複数選択可）" 
                                current={preferredDurations} 
                                onChange={togglePreferredDuration} 
                                options={[
                                    { id: 'short', label: '短い (4分未満)' }, 
                                    { id: 'medium', label: '普通 (4-20分)' }, 
                                    { id: 'long', label: '長い (20分以上)' }
                                ]} 
                            />
                            <ToggleGroup 
                                label="新しさ" 
                                current={preferredFreshness} 
                                onChange={setPreferredFreshness} 
                                options={[
                                    { id: 'new', label: '最新' }, 
                                    { id: 'popular', label: '人気' }, 
                                    { id: 'balanced', label: 'バランス' }
                                ]} 
                            />
                            <ToggleGroup 
                                label="選出モード" 
                                current={discoveryMode} 
                                onChange={setDiscoveryMode} 
                                options={[
                                    { id: 'subscribed', label: '登録優先' }, 
                                    { id: 'discovery', label: '新規開拓' }, 
                                    { id: 'balanced', label: 'バランス' }
                                ]} 
                            />
                        </div>
                    </section>

                    {/* Section 4: Specific Interests (Tags) */}
                    <section>
                        <h3 className="text-lg font-bold text-black dark:text-white mb-4 flex items-center gap-2">
                            キーワード設定
                        </h3>
                        
                        <div className="mb-4">
                            <p className="text-xs text-yt-light-gray mb-2 font-bold uppercase">人気のタグ</p>
                            <div className="flex flex-wrap gap-2">
                                {['Vtuber', '都市伝説', 'Gaming', '歌ってみた', 'ASMR', 'ボカロ', '料理', '猫', 'メイク'].map(tag => (
                                    <button 
                                        key={tag}
                                        onClick={() => addQuickTag(tag)}
                                        disabled={preferredGenres.includes(tag)}
                                        className={`px-3 py-1 rounded-full text-sm font-medium border transition-all ${
                                            preferredGenres.includes(tag)
                                            ? 'bg-yt-blue/20 border-yt-blue text-yt-blue cursor-default'
                                            : 'bg-transparent border-yt-spec-light-20 dark:border-yt-spec-20 text-black dark:text-white hover:bg-yt-spec-light-10 dark:hover:bg-yt-spec-10'
                                        }`}
                                    >
                                        + {tag}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-6">
                             {/* Genres Input Only */}
                            <div>
                                <form onSubmit={handleAddGenre} className="flex gap-2 mb-3">
                                    <input
                                        type="text"
                                        value={genreInput}
                                        onChange={(e) => setGenreInput(e.target.value)}
                                        placeholder="好きなキーワードを追加..."
                                        className="flex-1 bg-yt-light dark:bg-black border border-transparent focus:border-yt-blue rounded-xl px-4 py-2.5 text-black dark:text-white outline-none text-sm transition-colors"
                                    />
                                    <button type="submit" className="bg-yt-black dark:bg-white text-white dark:text-black px-4 py-2.5 rounded-xl text-sm font-bold hover:opacity-80 transition-opacity">追加</button>
                                </form>
                                <div className="flex flex-wrap gap-2">
                                    {preferredGenres.map((genre, idx) => (
                                        <span key={idx} className="inline-flex items-center bg-yt-blue text-white px-3 py-1 rounded-full text-sm font-medium shadow-sm">
                                            {genre}
                                            <button onClick={() => removePreferredGenre(genre)} className="ml-2 hover:text-black/50">
                                                <CloseIcon />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* NG Zone */}
                    <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-xl border border-red-100 dark:border-red-900/30">
                        <h3 className="text-sm font-bold text-red-500 mb-3 uppercase tracking-wider">NG設定（ブロック・除外）</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             <form onSubmit={handleAddNg} className="flex gap-2">
                                <input
                                    type="text"
                                    value={ngInput}
                                    onChange={(e) => setNgInput(e.target.value)}
                                    placeholder="除外したい単語を入力..."
                                    className="flex-1 bg-white dark:bg-black border border-transparent focus:border-red-500 rounded-lg px-3 py-2 text-black dark:text-white outline-none text-sm"
                                />
                                <button type="submit" className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-600">NG追加</button>
                            </form>
                             <div className="flex flex-wrap gap-2">
                                {ngKeywords.map((k, i) => (
                                    <span key={i} className="inline-flex items-center bg-red-100 text-red-600 px-2 py-1 rounded-md text-xs font-bold">
                                        {k} <button onClick={() => removeNgKeyword(k)} className="ml-1"><CloseIcon /></button>
                                    </span>
                                ))}
                                {ngChannels.map((id, i) => (
                                    <span key={i} className="inline-flex items-center bg-red-100 text-red-600 px-2 py-1 rounded-md text-xs font-bold">
                                        ID:{id} <button onClick={() => removeNgChannel(id)} className="ml-1"><CloseIcon /></button>
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
                
                <div className="p-6 border-t border-yt-spec-light-20 dark:border-yt-spec-20 flex justify-end bg-yt-white dark:bg-[#1f1f1f]">
                    <button onClick={onClose} className="bg-yt-blue text-white font-bold px-8 py-3 hover:bg-yt-blue/90 rounded-xl shadow-lg transform transition-all active:scale-95">
                        設定を保存
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PreferenceModal;
