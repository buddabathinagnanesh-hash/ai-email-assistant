import React from 'react';

export default function Sidebar({ activeTab, setActiveTab, theme, toggleTheme }) {
  const handleConnectGoogle = async () => {
    try {
      const response = await fetch('http://localhost:8000/auth/google');
      const data = await response.json();
      if (data.auth_url) {
        window.location.href = data.auth_url;
      }
    } catch (error) {
      console.error('Error connecting to Google:', error);
    }
  };

  return (
    <aside className="w-64 glass-panel m-4 md:m-6 rounded-2xl flex flex-col flex-shrink-0 relative z-20 shadow-sm">
      <div className="p-6 flex items-center justify-between border-b border-white/20 dark:border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-appPrimary/10 border border-appPrimary/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-appPrimary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
          </div>
          <h1 className="text-[17px] font-semibold tracking-tight">Mail<span className="text-appPrimary">AI</span></h1>
        </div>
      </div>
      
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto scrollbar-hide">
        {['Dashboard', 'Emails', 'Search', 'Settings'].map((item) => (
          <button
            key={item}
            onClick={() => setActiveTab(item)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-[14px] font-medium transition-all duration-200 active:scale-[0.98]
              ${activeTab === item 
                ? 'bg-slate-200/50 dark:bg-white/10 text-slate-900 dark:text-white shadow-sm' 
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/30 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
          >
            {item === 'Dashboard' && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>}
            {item === 'Emails' && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>}
            {item === 'Search' && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>}
            {item === 'Settings' && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>}
            {item}
          </button>
        ))}
      </nav>
      
      <div className="p-4 border-t border-white/20 dark:border-white/5">
        <button 
          onClick={handleConnectGoogle}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white transition-colors mb-4 active:scale-[0.98] shadow-sm"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12.545 10.239v3.821h5.445c-.712 2.315-2.647 3.972-5.445 3.972a5.952 5.952 0 1 1 0-11.904c1.451 0 2.76.5 3.784 1.459l2.745-2.745c-1.745-1.637-4.041-2.646-6.529-2.646C5.929 2.226 1 7.155 1 13.226s4.929 11 11.545 11c6.643 0 11.455-4.667 11.455-11.487 0-.745-.067-1.472-.187-2.187h-11.268z"/></svg>
          <span className="text-[13px] font-medium">Connect Google Calendar</span>
        </button>

        <button 
          onClick={toggleTheme}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-slate-200/50 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors border border-white/20 dark:border-white/10 mb-4 active:scale-[0.98]"
        >
          <span className="text-[13px] font-medium">{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>
          {theme === 'dark' ? (
            <svg className="w-4 h-4 text-appMedium" fill="currentColor" viewBox="0 0 20 20"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"></path></svg>
          ) : (
            <svg className="w-4 h-4 text-appMedium" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
          )}
        </button>

        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-white/10 border border-slate-300 dark:border-white/10 flex items-center justify-center text-slate-600 dark:text-slate-300 font-semibold text-xs">
            JD
          </div>
          <div>
            <p className="text-[13px] font-medium leading-tight">John Doe</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Pro Plan</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
