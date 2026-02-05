import React, { useState, useEffect } from 'react';
import { getTodayDailyXP, getWeeklyDailyXP } from '../supabase/secondaryClient';

const UserDailyXP = ({ userCode, themeClasses = {}, language = 'english' }) => {
  const [todayData, setTodayData] = useState(null);
  const [weeklyData, setWeeklyData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isHebrew = language === 'hebrew';

  useEffect(() => {
    if (!userCode) {
      setLoading(false);
      setTodayData(null);
      setWeeklyData([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [todayRes, weeklyRes] = await Promise.all([
          getTodayDailyXP(userCode),
          getWeeklyDailyXP(userCode)
        ]);
        if (cancelled) return;
        if (todayRes.error) setError(todayRes.error.message);
        else setTodayData(todayRes.data);
        if (weeklyRes.error && !todayRes.error) setError(weeklyRes.error.message);
        else if (weeklyRes.data) setWeeklyData(Array.isArray(weeklyRes.data) ? weeklyRes.data : []);
      } catch (e) {
        if (!cancelled) setError(e.message || (isHebrew ? 'שגיאה בטעינה' : 'Failed to load'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userCode, isHebrew]);

  if (!userCode) return null;

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T12:00:00');
    return isHebrew
      ? d.toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'short' })
      : d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const maxXp = Math.max(150, ...weeklyData.map((d) => d.total_xp || 0), todayData?.total_xp || 0);

  return (
    <div className={`rounded-xl border ${themeClasses.bgCard || 'bg-white'} ${themeClasses.borderColor || 'border-gray-200'} p-4 sm:p-5 mb-4 shadow-sm`} dir={isHebrew ? 'rtl' : 'ltr'}>
      <h3 className={`text-lg font-semibold mb-3 ${themeClasses.textPrimary || 'text-gray-900'}`}>
        {isHebrew ? 'התקדמות יומית (XP)' : 'Daily progress (XP)'}
      </h3>
      {loading && (
        <p className={themeClasses.textMuted || 'text-gray-500'}>
          {isHebrew ? 'טוען...' : 'Loading...'}
        </p>
      )}
      {error && !loading && (
        <p className="text-amber-600 dark:text-amber-400 text-sm">{error}</p>
      )}
      {!loading && !error && (
        <>
          {todayData ? (
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <span className={`text-2xl font-bold ${themeClasses.textPrimary || 'text-gray-900'}`}>
                {todayData.total_xp ?? 0} XP
              </span>
              <span className={`text-lg ${themeClasses.textSecondary || 'text-gray-600'}`}>
                {todayData.rank_title ?? ''}
              </span>
              {(todayData.actual_cals != null || todayData.target_cals != null) && (
                <span className={`text-sm ${themeClasses.textMuted || 'text-gray-500'}`}>
                  {todayData.actual_cals ?? 0} / {todayData.target_cals ?? 0} {isHebrew ? 'קלוריות' : 'cal'}
                </span>
              )}
            </div>
          ) : (
            <p className={`text-sm mb-4 ${themeClasses.textMuted || 'text-gray-500'}`}>
              {isHebrew ? 'עדיין לא תועדו ארוחות היום.' : 'No meals logged for today yet.'}
            </p>
          )}
          {weeklyData.length > 0 && (
            <div>
              <p className={`text-sm font-medium mb-2 ${themeClasses.textSecondary || 'text-gray-600'}`}>
                {isHebrew ? 'שבוע אחרון' : 'Last 7 days'}
              </p>
              <div className="space-y-2">
                {weeklyData.map((row) => (
                  <div key={row.log_date} className="flex items-center gap-2">
                    <span className={`text-xs w-20 flex-shrink-0 ${themeClasses.textMuted || 'text-gray-500'}`}>
                      {formatDate(row.log_date)}
                    </span>
                    <div className="flex-1 h-6 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden" style={{ minWidth: 60 }}>
                      <div
                        className="h-full bg-emerald-500 rounded"
                        style={{ width: `${Math.min(100, ((row.total_xp || 0) / maxXp) * 100)}%` }}
                      />
                    </div>
                    <span className={`text-sm font-medium w-10 ${themeClasses.textPrimary || 'text-gray-900'}`}>
                      {row.total_xp ?? 0}
                    </span>
                    <span className="text-sm opacity-80">{row.rank_title ?? ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default UserDailyXP;
