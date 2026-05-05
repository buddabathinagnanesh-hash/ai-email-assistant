import React, { useState } from 'react';

const categoryColors = {
  IMPORTANT: 'bg-appImportant/10 text-appImportant border-appImportant/20',
  NORMAL: 'bg-appPrimary/10 text-appPrimary border-appPrimary/20',
  IGNORE: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
};

const priorityColors = {
  HIGH: 'bg-appImportant/10 text-appImportant border-appImportant/20',
  MEDIUM: 'bg-appMedium/10 text-appMedium border-appMedium/20',
  LOW: 'bg-appLow/10 text-appLow border-appLow/20',
};

const HighlightText = ({ text, highlight }) => {
  if (!highlight || !text) return <>{text}</>;
  const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === highlight.toLowerCase() ? (
          <span key={index} className="bg-yellow-200 dark:bg-yellow-500/30 text-slate-900 dark:text-yellow-100 rounded-sm px-0.5">{part}</span>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </>
  );
};

const formatTime = (isoString) => {
  if (!isoString) return "";
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "";
    return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch { return ""; }
};

// Auto-calendar logic is handled entirely by the backend now

const EmailCard = React.memo(({ email, searchQuery, isSelected }) => {
  const [feedbackStatus, setFeedbackStatus] = useState(null);

  const handleFeedback = async (e, type) => {
    e.preventDefault();
    e.stopPropagation();
    setFeedbackStatus(type);
    try {
      await fetch('http://127.0.0.1:8000/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: email.subject, feedback: type })
      });
      setTimeout(() => setFeedbackStatus(null), 2000);
    } catch (err) {
      console.error(err);
      setFeedbackStatus(null);
    }
  };

  return (
  <div className={`glass-card p-6 rounded-2xl group cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.01] hover:shadow-md ${isSelected ? 'ring-2 ring-appPrimary/50 bg-slate-50 dark:bg-white/5' : ''}`}>
    <div className="flex flex-col lg:flex-row justify-between items-start gap-4">
      <div className="flex-1 w-full space-y-2">
        <div>
          <div className="flex items-start justify-between gap-4">
            <h3 className="text-[15px] font-semibold text-slate-900 dark:text-slate-100 leading-snug tracking-tight">
              <HighlightText text={email.subject} highlight={searchQuery} />
            </h3>
            {email.created_at && (
              <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 whitespace-nowrap mt-1">
                {formatTime(email.created_at)}
              </span>
            )}
          </div>
          <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400 mt-1 flex items-center">
            <svg className="w-3.5 h-3.5 mr-1.5 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
            <HighlightText text={email.sender} highlight={searchQuery} />
          </p>
        </div>
        
        <div className="mt-3">
          <p className="text-slate-600 dark:text-slate-300 text-[14px] leading-relaxed font-normal">
            <HighlightText text={email.summary} highlight={searchQuery} />
          </p>
        </div>

        {email.date && email.date !== null && (
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="text-[11px] font-semibold px-2.5 py-1 bg-green-500/10 text-green-600 dark:text-green-400 rounded-md border border-green-500/20 flex items-center gap-1.5">
              📅 {email.calendar_added === 1 ? 'Added to Calendar' : 'Deadline Detected'} ({formatTime(email.date)})
            </span>
          </div>
        )}
      </div>
      
      <div className="flex flex-row lg:flex-col items-center lg:items-end gap-3 w-full lg:w-auto shrink-0 pt-2 lg:pt-0">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 mr-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              onClick={(e) => handleFeedback(e, 'like')} 
              className={`p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors ${feedbackStatus === 'like' ? 'text-green-500' : 'text-slate-400'}`}
              title="More like this"
            >
              {feedbackStatus === 'like' ? '✓' : '👍'}
            </button>
            <button 
              onClick={(e) => handleFeedback(e, 'dislike')} 
              className={`p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors ${feedbackStatus === 'dislike' ? 'text-appImportant' : 'text-slate-400'}`}
              title="Less like this"
            >
              {feedbackStatus === 'dislike' ? '✓' : '👎'}
            </button>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${categoryColors[email.category] || categoryColors.NORMAL}`}>
            {email.category}
          </span>
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${priorityColors[email.priority] || priorityColors.LOW}`}>
            {email.priority}
          </span>
        </div>
        <a 
          href={email.link} 
          target="_blank" 
          rel="noreferrer"
          className="mt-auto px-5 py-2 text-[13px] font-semibold text-white bg-appPrimary hover:bg-appPrimary/90 rounded-full transition-all duration-200 active:scale-95 text-center w-full lg:w-auto flex items-center justify-center gap-1.5 shadow-sm"
        >
          <span>Open</span>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
        </a>
      </div>
    </div>
  </div>
  );
});

export default EmailCard;
