import React, { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from './components/Sidebar';
import SearchBar from './components/SearchBar';
import EmailCard from './components/EmailCard';

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

const SkeletonCard = () => (
  <div className="glass-card p-6 rounded-2xl animate-pulse">
    <div className="flex flex-col lg:flex-row justify-between items-start gap-4">
      <div className="flex-1 w-full space-y-3">
        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/4"></div>
        <div className="space-y-2 mt-4">
          <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
          <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-5/6"></div>
        </div>
      </div>
      <div className="flex gap-2">
        <div className="h-6 w-16 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
        <div className="h-6 w-16 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
      </div>
    </div>
  </div>
);

export default function App() {
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') || 'dark';
    }
    return 'dark';
  });

  const [emails, setEmails] = useState([]);
  const [stats, setStats] = useState({ important: 0, normal: 0, ignore: 0 });
  const [filter, setFilter] = useState('ALL');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState('');

  const [toasts, setToasts] = useState([]);

  const [activeTab, setActiveTab] = useState('Dashboard');
  const [selectedIndex, setSelectedIndex] = useState(-1);
  
  const [insights, setInsights] = useState(null);
  const [loadingInsights, setLoadingInsights] = useState(true);
  const [dailyBrief, setDailyBrief] = useState(null);
  const [todayTasks, setTodayTasks] = useState({ do_now: [], today: [], later: [] });

  const [prefs, setPrefs] = useState({ interests: [], ignore: [] });

  const [lastUpdated, setLastUpdated] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  const [runningPipeline, setRunningPipeline] = useState(false);

  const abortControllerRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "1") {
      alert("✅ Google Calendar connected successfully!");
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Poll for reminders every 30 seconds
  useEffect(() => {
    const pollReminders = async () => {
      try {
        const res = await fetch(`${API_BASE}/reminders`);
        if (res.ok) {
          const newReminders = await res.json();
          if (newReminders.length > 0) {
            setToasts(prev => [
              ...prev, 
              ...newReminders.map(r => ({ ...r, id: Date.now() + Math.random() }))
            ]);
          }
        }
      } catch (err) { console.error("Failed to fetch reminders", err); }
    };
    
    pollReminders();
    const interval = setInterval(pollReminders, 30000);
    return () => clearInterval(interval);
  }, []);

  // Auto-dismiss toasts
  useEffect(() => {
    if (toasts.length > 0) {
      const timer = setTimeout(() => {
        setToasts(prev => prev.slice(1));
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [toasts]);

  useEffect(() => {
    const fetchInsights = async () => {
      try {
        const res = await fetch(`${API_BASE}/insights`);
        if (res.ok) {
          const data = await res.json();
          if (data.summary) {
            setInsights(data);
          }
        }
      } catch (err) {
        console.error("Insights failed", err);
      } finally {
        setLoadingInsights(false);
      }
    };
    fetchInsights();
  }, []);

  useEffect(() => {
    if (activeTab === 'Settings') {
      fetch(`${API_BASE}/preferences`)
        .then(res => res.json())
        .then(data => setPrefs(data))
        .catch(console.error);
    }
  }, [activeTab]);

  const savePrefs = async (newPrefs) => {
    setPrefs(newPrefs);
    try {
      await fetch(`${API_BASE}/preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPrefs)
      });
    } catch(e) { console.error(e) }
  };

  const removeKeyword = (type, index) => {
    const newPrefs = { ...prefs };
    newPrefs[type].splice(index, 1);
    savePrefs(newPrefs);
  };

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  // Reset selected index when emails change
  useEffect(() => {
    setSelectedIndex(-1);
  }, [emails]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '/') {
        if (document.activeElement !== searchInputRef.current) {
          e.preventDefault();
          searchInputRef.current?.focus();
        }
      } else if (e.key === 'Escape') {
        setSearchQuery('');
        searchInputRef.current?.blur();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, emails.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, -1));
      } else if (e.key === 'Enter') {
        if (selectedIndex >= 0 && selectedIndex < emails.length) {
          window.open(emails[selectedIndex].link, '_blank', 'noreferrer');
        }
      } else if (e.key === 'd') {
        if (selectedIndex >= 0 && selectedIndex < emails.length) {
          handleMarkDone(emails[selectedIndex].id);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [emails, selectedIndex, setSearchQuery]);

  const getTimeLeft = (dateString) => {
    const target = new Date(dateString);
    const now = new Date();
    const diffMs = target - now;
    
    if (diffMs < 0) return "Overdue";
    
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours < 24) return `${diffHours}h left`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d left`;
  };

  const handleMarkDone = async (id, e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    setTodayTasks(prev => {
      const filterGroup = (group) => group.filter(t => t.id !== id);
      return {
        do_now: filterGroup(prev.do_now || []),
        today: filterGroup(prev.today || []),
        later: filterGroup(prev.later || [])
      };
    });
    
    setEmails(prev => prev.filter(email => email.id !== id));

    try {
      await fetch(`${API_BASE}/mark-done/${id}`, { method: 'POST' });
      fetchData(false);
    } catch (err) { console.error(err); }
  };

  const fetchData = useCallback(async (showLoader = true) => {
    if (filter === 'SEARCH' || isSearching || debouncedQuery) return; 

    if (showLoader) setLoading(true);
    setError(null);
    try {
      const url = filter === 'ALL' ? `${API_BASE}/emails` : `${API_BASE}/emails/${filter}`;
      console.log(`Fetching dashboard data from: ${url}`);
      const [statsRes, emailsRes, todayRes, briefRes] = await Promise.all([
        fetch(`${API_BASE}/stats`),
        fetch(url),
        fetch(`${API_BASE}/today`),
        fetch(`${API_BASE}/daily-brief`)
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (emailsRes.ok) {
        const data = await emailsRes.json();
        setEmails([...data].slice(0, 20)); 
        console.log("Fetched emails:", data);
      }
      if (todayRes.ok) {
        setTodayTasks(await todayRes.json());
      }
      if (briefRes.ok) {
        setDailyBrief(await briefRes.json());
      }
      setLastUpdated(Date.now());
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [filter, isSearching, debouncedQuery]);

  const handleRunPipeline = async () => {
    if (runningPipeline) return;
    setRunningPipeline(true);
    try {
      console.log("Triggering pipeline at /run-pipeline...");
      const response = await fetch(`${API_BASE}/run-pipeline`, { method: 'POST' });
      if (!response.ok) {
        throw new Error(`API failed with status ${response.status}`);
      }
      await fetchData(true);
    } catch (err) {
      console.error("Pipeline API error:", err);
      alert("Pipeline failed: " + err.message);
    } finally {
      setRunningPipeline(false);
    }
  };

  useEffect(() => {
    fetchData(true);
  }, [fetchData]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!isSearching && !debouncedQuery) {
        fetchData(false);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchData, isSearching, debouncedQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
       if (filter === 'SEARCH') setFilter('ALL');
       return;
    }

    const performSearch = async () => {
      setIsSearching(true);
      setLoading(true);
      setError(null);
      setFilter('SEARCH');
      
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      
      try {
        const res = await fetch(`${API_BASE}/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: debouncedQuery }),
          signal: abortControllerRef.current.signal
        });
        if (!res.ok) throw new Error("Search failed");
        const data = await res.json();
        setEmails(data.slice(0, 20)); 
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError("Something went wrong. Please try again.");
        }
      } finally {
        setIsSearching(false);
        setLoading(false);
      }
    };
    
    performSearch();
  }, [debouncedQuery]);

  return (
    <div className="flex h-screen bg-[#F5F5F7] dark:bg-[#050505] font-sans overflow-hidden transition-colors duration-500 text-slate-800 dark:text-slate-200">
      
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        theme={theme} 
        toggleTheme={toggleTheme} 
      />

      <main className="flex-1 overflow-y-auto relative scrollbar-hide py-6 pr-6 scroll-smooth">
        
        <SearchBar 
          searchQuery={searchQuery} 
          setSearchQuery={setSearchQuery} 
          isSearching={isSearching} 
          inputRef={searchInputRef}
        />

        <div className="max-w-4xl mx-auto px-4 md:px-10 space-y-8 pb-10">
          
          {activeTab === 'Dashboard' && (
            <div className="space-y-8">
              
              {/* Today's Focus Section */}
              {dailyBrief && (
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent border border-indigo-500/20 dark:border-indigo-400/20 p-6 shadow-sm">
                  <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-indigo-500/20 rounded-full blur-2xl"></div>
                  <div className="relative z-10 flex flex-col gap-4">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                      <h2 className="text-[15px] font-bold tracking-tight text-indigo-950 dark:text-indigo-100 uppercase">Today's Focus</h2>
                    </div>
                    <p className="text-[14px] text-slate-700 dark:text-slate-300 leading-relaxed max-w-3xl whitespace-pre-line">
                      {dailyBrief.message}
                    </p>
                  </div>
                </div>
              )}

              {/* What Should I Do Today Section */}
              <div className="glass-card p-6 rounded-2xl relative overflow-hidden group">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-appPrimary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path></svg>
                      <h2 className="text-[16px] font-semibold tracking-tight text-slate-900 dark:text-white">What Should I Do Today</h2>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[12px] text-slate-500 font-medium">Last updated: {Math.floor((now - lastUpdated) / 1000)} seconds ago</span>
                      <button 
                        onClick={handleRunPipeline}
                        disabled={runningPipeline}
                        className="px-4 py-2 bg-appPrimary hover:bg-appPrimary/90 disabled:opacity-50 text-white rounded-lg text-[13px] font-semibold tracking-wide transition-colors flex items-center gap-2 shadow-sm"
                      >
                        {runningPipeline ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-1 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Running...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            Run Pipeline
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-6">
                    {/* DO_NOW Group */}
                    {todayTasks?.do_now?.length > 0 && (
                      <div>
                        <h4 className="text-[11px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5 text-red-500">
                          🔴 Do Now
                        </h4>
                        <div className="space-y-1.5">
                          {todayTasks.do_now.map(t => (
                            <div key={t.id} className="group flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-white/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700 shadow-sm hover:shadow-md">
                              <div className="flex items-center gap-3 overflow-hidden mb-2 sm:mb-0">
                                <button onClick={(e) => handleMarkDone(t.id, e)} className="w-5 h-5 shrink-0 rounded-md border border-slate-300 dark:border-slate-600 hover:border-green-500 hover:bg-green-500/10 flex items-center justify-center transition-colors" title="Mark Done">
                                  <span className="opacity-0 group-hover:opacity-100 text-green-500 text-[12px]">✅</span>
                                </button>
                                <span className="text-[14px] font-medium text-slate-800 dark:text-slate-200 truncate" title={t.subject}>{t.subject}</span>
                                {t.priority === 'HIGH' && <span className="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 text-[10px] font-bold tracking-wide">HIGH</span>}
                                {t.priority === 'MEDIUM' && <span className="px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 text-[10px] font-bold tracking-wide">MED</span>}
                              </div>
                              <div className="flex items-center gap-4 shrink-0 sm:ml-3 pl-8 sm:pl-0">
                                <span className={`text-[12px] font-semibold ${getTimeLeft(t.date) === 'Overdue' ? 'text-red-500' : 'text-slate-500 dark:text-slate-400'}`}>
                                  {getTimeLeft(t.date)}
                                </span>
                                <a href={`https://calendar.google.com/calendar/u/0/r/day/${t.date.split('T')[0].replace(/-/g, '/')}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors text-[11px] font-medium" title="Open Calendar Event">
                                  📅 Calendar
                                </a>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* TODAY Group */}
                    {todayTasks?.today?.length > 0 && (
                      <div>
                        <h4 className="text-[11px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5 text-yellow-500">
                          🟡 Today
                        </h4>
                        <div className="space-y-1.5">
                          {todayTasks.today.map(t => (
                            <div key={t.id} className="group flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-white/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700 shadow-sm hover:shadow-md">
                              <div className="flex items-center gap-3 overflow-hidden mb-2 sm:mb-0">
                                <button onClick={(e) => handleMarkDone(t.id, e)} className="w-5 h-5 shrink-0 rounded-md border border-slate-300 dark:border-slate-600 hover:border-green-500 hover:bg-green-500/10 flex items-center justify-center transition-colors" title="Mark Done">
                                  <span className="opacity-0 group-hover:opacity-100 text-green-500 text-[12px]">✅</span>
                                </button>
                                <span className="text-[14px] font-medium text-slate-800 dark:text-slate-200 truncate" title={t.subject}>{t.subject}</span>
                                {t.priority === 'HIGH' && <span className="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 text-[10px] font-bold tracking-wide">HIGH</span>}
                                {t.priority === 'MEDIUM' && <span className="px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 text-[10px] font-bold tracking-wide">MED</span>}
                              </div>
                              <div className="flex items-center gap-4 shrink-0 sm:ml-3 pl-8 sm:pl-0">
                                <span className="text-[12px] font-semibold text-slate-500 dark:text-slate-400">
                                  {getTimeLeft(t.date)}
                                </span>
                                <a href={`https://calendar.google.com/calendar/u/0/r/day/${t.date.split('T')[0].replace(/-/g, '/')}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors text-[11px] font-medium" title="Open Calendar Event">
                                  📅 Calendar
                                </a>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* LATER Group */}
                    {todayTasks?.later?.length > 0 && (
                      <div>
                        <h4 className="text-[11px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5 text-slate-400">
                          ⚪ Later
                        </h4>
                        <div className="space-y-1.5">
                          {todayTasks.later.map(t => (
                            <div key={t.id} className="group flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-white/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700 shadow-sm hover:shadow-md">
                              <div className="flex items-center gap-3 overflow-hidden mb-2 sm:mb-0">
                                <button onClick={(e) => handleMarkDone(t.id, e)} className="w-5 h-5 shrink-0 rounded-md border border-slate-300 dark:border-slate-600 hover:border-green-500 hover:bg-green-500/10 flex items-center justify-center transition-colors" title="Mark Done">
                                  <span className="opacity-0 group-hover:opacity-100 text-green-500 text-[12px]">✅</span>
                                </button>
                                <span className="text-[14px] font-medium text-slate-800 dark:text-slate-200 truncate" title={t.subject}>{t.subject}</span>
                                {t.priority === 'HIGH' && <span className="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 text-[10px] font-bold tracking-wide">HIGH</span>}
                                {t.priority === 'MEDIUM' && <span className="px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 text-[10px] font-bold tracking-wide">MED</span>}
                              </div>
                              <div className="flex items-center gap-4 shrink-0 sm:ml-3 pl-8 sm:pl-0">
                                <span className="text-[12px] font-semibold text-slate-500 dark:text-slate-400">
                                  {getTimeLeft(t.date)}
                                </span>
                                <a href={`https://calendar.google.com/calendar/u/0/r/day/${t.date.split('T')[0].replace(/-/g, '/')}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors text-[11px] font-medium" title="Open Calendar Event">
                                  📅 Calendar
                                </a>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {(!todayTasks?.do_now?.length && !todayTasks?.today?.length && !todayTasks?.later?.length) && (
                      <p className="text-[13px] text-slate-500">No actionable tasks right now. You're all caught up! 🎉</p>
                    )}
                  </div>
              </div>
              {loadingInsights ? (
                <div className="glass-card p-6 rounded-2xl animate-pulse">
                  <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-1/4 mb-4"></div>
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full mb-2"></div>
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-5/6"></div>
                </div>
              ) : insights && insights.summary ? (
                <div className="glass-card p-6 rounded-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-appPrimary/5 rounded-bl-full -z-10 transition-transform group-hover:scale-110"></div>
                  <div className="flex items-center gap-2 mb-4">
                    <svg className="w-5 h-5 text-appPrimary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                    <h2 className="text-[16px] font-semibold tracking-tight text-slate-900 dark:text-white">AI Insights</h2>
                  </div>
                  <p className="text-[14px] text-slate-600 dark:text-slate-300 mb-5 leading-relaxed font-medium">
                    {insights.summary}
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {insights.urgent && insights.urgent.length > 0 && (
                      <div>
                        <h3 className="text-[11px] font-bold text-appImportant uppercase tracking-wider mb-3 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-appImportant"></span> Urgent</h3>
                        <ul className="space-y-2.5">
                          {insights.urgent.slice(0, 3).map((item, i) => (
                            <li key={i} className="flex items-start text-[13px] text-slate-700 dark:text-slate-300 font-medium pl-3 border-l-2 border-appImportant/20">
                              <span className="leading-snug">{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {insights.suggestions && insights.suggestions.length > 0 && (
                      <div>
                        <h3 className="text-[11px] font-bold text-appPrimary uppercase tracking-wider mb-3 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-appPrimary"></span> Suggested Actions</h3>
                        <ul className="space-y-2.5">
                          {insights.suggestions.slice(0, 3).map((item, i) => (
                            <li key={i} className="flex items-start text-[13px] text-slate-700 dark:text-slate-300 font-medium pl-3 border-l-2 border-appPrimary/20">
                              <span className="leading-snug">{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="glass-card p-6 rounded-2xl hover:-translate-y-0.5 cursor-default transition-transform duration-200">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[12px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Important</p>
                    <div className="w-2 h-2 rounded-full bg-appImportant"></div>
                  </div>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">{stats.important}</p>
                </div>
                <div className="glass-card p-6 rounded-2xl hover:-translate-y-0.5 cursor-default transition-transform duration-200">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[12px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Normal</p>
                    <div className="w-2 h-2 rounded-full bg-appPrimary"></div>
                  </div>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">{stats.normal}</p>
                </div>
                <div className="glass-card p-6 rounded-2xl hover:-translate-y-0.5 cursor-default transition-transform duration-200">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[12px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ignored</p>
                    <div className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500"></div>
                  </div>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">{stats.ignore}</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Settings' && (
            <div className="space-y-6">
              <div className="glass-card p-6 rounded-2xl">
                <h2 className="text-[16px] font-semibold tracking-tight text-slate-900 dark:text-white mb-6">AI Personalization</h2>
                
                <div className="space-y-8">
                  <div>
                    <h3 className="text-[13px] font-semibold text-green-600 dark:text-green-500 uppercase tracking-wider mb-2">Interests (👍)</h3>
                    <p className="text-[12px] text-slate-500 mb-4 font-medium">Emails matching these keywords will be prioritized.</p>
                    <div className="flex flex-wrap gap-2">
                      {prefs.interests.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-1 bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 px-3 py-1.5 rounded-full text-[13px] font-medium border border-green-200 dark:border-green-500/20">
                          {item}
                          <button onClick={() => removeKeyword('interests', idx)} className="ml-1 hover:text-green-900 dark:hover:text-green-200 transition-colors">×</button>
                        </div>
                      ))}
                      {prefs.interests.length === 0 && <span className="text-[13px] text-slate-400 font-medium">No interests saved yet.</span>}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-[13px] font-semibold text-appImportant uppercase tracking-wider mb-2">Ignore List (👎)</h3>
                    <p className="text-[12px] text-slate-500 mb-4 font-medium">Emails matching these keywords will be deprioritized.</p>
                    <div className="flex flex-wrap gap-2">
                      {prefs.ignore.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-1 bg-appImportant/10 text-appImportant px-3 py-1.5 rounded-full text-[13px] font-medium border border-appImportant/20">
                          {item}
                          <button onClick={() => removeKeyword('ignore', idx)} className="ml-1 hover:text-red-900 dark:hover:text-red-200 transition-colors">×</button>
                        </div>
                      ))}
                      {prefs.ignore.length === 0 && <span className="text-[13px] text-slate-400 font-medium">No ignored keywords yet.</span>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab !== 'Settings' && (
            <>
            <div className="flex space-x-2 pb-2">
            {['ALL', 'IMPORTANT', 'NORMAL', 'IGNORE'].map(cat => (
              <button
                key={cat}
                onClick={() => {
                  setFilter(cat);
                  setSearchQuery('');
                }}
                className={`px-4 py-2 rounded-full text-[12px] font-semibold tracking-wide transition-all duration-200 whitespace-nowrap active:scale-[0.98] ${
                  filter === cat 
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm' 
                    : 'glass-panel hover:bg-slate-200/50 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300'
                }`}
              >
                {cat}
              </button>
            ))}
            {filter === 'SEARCH' && (
              <button className="px-4 py-2 rounded-full text-[12px] font-semibold tracking-wide whitespace-nowrap bg-appPrimary/10 text-appPrimary border border-appPrimary/20">
                SEARCH RESULTS
              </button>
            )}
          </div>

          <div className="space-y-4">
            {loading && emails.length === 0 ? (
              <div className="space-y-4 pt-2">
                {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
              </div>
            ) : error ? (
              <div className="text-center py-8 text-appImportant glass-card !border-appImportant/20 !bg-appImportant/5 text-[14px] font-medium">
                {error}
              </div>
            ) : emails.length === 0 && !loading ? (
              <div className="text-center py-24 glass-card text-slate-500 dark:text-slate-400 text-[15px] font-medium">
                {debouncedQuery ? (
                  <>
                    <p>No results for '<span className="font-semibold text-slate-700 dark:text-slate-300">{debouncedQuery}</span>'</p>
                    <p className="text-[13px] mt-1">Try a different keyword</p>
                  </>
                ) : (
                  <p>Inbox zero. No emails here.</p>
                )}
              </div>
            ) : (
              <div className={loading ? "opacity-50 pointer-events-none transition-opacity duration-300 space-y-4" : "transition-opacity duration-300 space-y-4"}>
                {emails.map((email, idx) => (
                  <EmailCard 
                    key={email.id || idx} 
                    email={email} 
                    searchQuery={debouncedQuery} 
                    isSelected={selectedIndex === idx}
                  />
                ))}
              </div>
            )}
          </div>
            </>
          )}
          
        </div>
      </main>

      {/* Reminder Toasts */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
        {toasts.map(toast => (
          <div key={toast.id} className={`p-4 rounded-xl shadow-2xl border backdrop-blur-md flex items-start gap-3 w-80 transform transition-all duration-300 translate-y-0 ${
            toast.type === 'urgent' ? 'bg-red-500/95 text-white border-red-400' :
            toast.type === 'warning' ? 'bg-orange-500/95 text-white border-orange-400' :
            'bg-yellow-500/95 text-white border-yellow-400'
          }`}>
            <span className="text-xl">
              {toast.type === 'urgent' ? '🚨' : toast.type === 'warning' ? '⏰' : '📅'}
            </span>
            <div className="flex-1">
              <p className="font-semibold text-[13px]">{toast.message}</p>
            </div>
            <button 
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))} 
              className="text-white/70 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

    </div>
  );
}
