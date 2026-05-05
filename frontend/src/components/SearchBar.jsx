import React from 'react';

export default function SearchBar({ searchQuery, setSearchQuery, isSearching, inputRef }) {
  return (
    <header className="sticky top-0 z-30 pt-2 pb-6 px-4 md:px-10 bg-[#F5F5F7]/90 dark:bg-[#050505]/90 backdrop-blur-md">
      <div className="max-w-4xl mx-auto relative group">
        <svg className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-appPrimary transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
        <input 
          ref={inputRef}
          type="text" 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search or ask anything... (Press '/' to focus)"
          className="glass-input w-full rounded-full py-3.5 pl-12 pr-12 text-[15px] font-medium text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 shadow-sm focus:ring-2 focus:ring-appPrimary/50 focus:border-appPrimary transition-all duration-200 outline-none"
        />
        {isSearching && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center text-appPrimary">
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          </div>
        )}
      </div>
    </header>
  );
}
