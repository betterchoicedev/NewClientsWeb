import React, { useState } from 'react';

const TrainingPlanTab = ({ themeClasses, language, trainingPlanData, loading, error, isDarkMode }) => {
  const [expandedWeeks, setExpandedWeeks] = useState({});
  const [expandedDays, setExpandedDays] = useState({});

  const toggleWeek = (weekNumber) => {
    setExpandedWeeks((prev) => ({
      ...prev,
      [weekNumber]: !prev[weekNumber],
    }));
  };

  const toggleDay = (weekNumber, dayNumber) => {
    const key = `${weekNumber}-${dayNumber}`;
    setExpandedDays((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
          <p className={themeClasses.textSecondary}>
            {language === 'hebrew' ? 'טוען תוכנית אימונים...' : 'Loading training plan...'}
          </p>
        </div>
      </div>
    );
  }

  if (error || !trainingPlanData) {
    return (
      <div className="min-h-screen p-4 sm:p-6 md:p-8 animate-fadeIn flex items-center justify-center">
        <div className="max-w-2xl w-full text-center">
          <div className="flex justify-center mb-6">
            <div className="w-24 h-24 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/25">
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <h2 className={`${themeClasses.textPrimary} text-3xl sm:text-4xl font-bold mb-4`}>
            {language === 'hebrew' ? 'אין תוכנית אימונים זמינה' : 'No Training Plan Available'}
          </h2>
          <p className={`${themeClasses.textSecondary} text-lg sm:text-xl`}>
            {error
              ? language === 'hebrew'
                ? `שגיאה: ${error}`
                : `Error: ${error}`
              : language === 'hebrew'
                ? 'עדיין לא נוצרה עבורך תוכנית אימונים. אנא צור קשר עם המאמן שלך.'
                : 'No training plan has been created for you yet. Please contact your trainer.'}
          </p>
        </div>
      </div>
    );
  }

  const planStructure = trainingPlanData.plan_structure || {};
  const weeks = planStructure.weeks || [];

  return (
    <div className="min-h-screen p-4 sm:p-6 md:p-8 animate-fadeIn">
      {/* Plan Header */}
      <div
        className="mb-6 sm:mb-8 animate-slideInUp relative rounded-xl p-4 sm:p-6"
        style={{
          borderLeft: '3px solid',
          borderLeftColor: isDarkMode ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.2)',
          borderRight: '2px solid',
          borderRightColor: isDarkMode ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.15)',
          borderTop: '2px solid',
          borderTopColor: isDarkMode ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.15)',
          borderBottom: '2px solid',
          borderBottomColor: isDarkMode ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.15)',
          boxShadow: isDarkMode
            ? 'inset 1px 0 0 rgba(59, 130, 246, 0.1), 0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)'
            : 'inset 1px 0 0 rgba(59, 130, 246, 0.1), 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-indigo-500/5 pointer-events-none rounded-xl" />
        <div className="relative z-10">
          <div className="flex items-center mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mr-4 shadow-lg shadow-blue-500/25">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className={`${themeClasses.textPrimary} text-2xl sm:text-3xl font-bold tracking-tight`}>
                {trainingPlanData.plan_name || (language === 'hebrew' ? 'תוכנית אימונים' : 'Training Plan')}
              </h2>
              {trainingPlanData.description && (
                <p className={`${themeClasses.textSecondary} text-sm sm:text-base mt-1`}>{trainingPlanData.description}</p>
              )}
            </div>
          </div>

          {/* Plan Info */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
            {trainingPlanData.goal && (
              <div>
                <p className={`${themeClasses.textSecondary} text-xs sm:text-sm mb-1`}>{language === 'hebrew' ? 'מטרה' : 'Goal'}</p>
                <p className={`${themeClasses.textPrimary} text-sm sm:text-base font-semibold`}>{trainingPlanData.goal}</p>
              </div>
            )}
            {trainingPlanData.difficulty_level && (
              <div>
                <p className={`${themeClasses.textSecondary} text-xs sm:text-sm mb-1`}>{language === 'hebrew' ? 'רמת קושי' : 'Difficulty'}</p>
                <p className={`${themeClasses.textPrimary} text-sm sm:text-base font-semibold`}>{trainingPlanData.difficulty_level}</p>
              </div>
            )}
            {trainingPlanData.duration_weeks && (
              <div>
                <p className={`${themeClasses.textSecondary} text-xs sm:text-sm mb-1`}>{language === 'hebrew' ? 'משך זמן' : 'Duration'}</p>
                <p className={`${themeClasses.textPrimary} text-sm sm:text-base font-semibold`}>
                  {trainingPlanData.duration_weeks} {language === 'hebrew' ? 'שבועות' : 'weeks'}
                </p>
              </div>
            )}
            {trainingPlanData.weekly_frequency && (
              <div>
                <p className={`${themeClasses.textSecondary} text-xs sm:text-sm mb-1`}>
                  {language === 'hebrew' ? 'תדירות שבועית' : 'Weekly Frequency'}
                </p>
                <p className={`${themeClasses.textPrimary} text-sm sm:text-base font-semibold`}>
                  {trainingPlanData.weekly_frequency} {language === 'hebrew' ? 'פעמים' : 'times/week'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Weeks */}
      {weeks.length > 0 ? (
        <div className="space-y-4">
          {weeks.map((week, weekIndex) => {
            const weekNumber = week.week_number || weekIndex + 1;
            const isWeekExpanded = expandedWeeks[weekNumber];

            return (
              <div
                key={weekIndex}
                className={`${themeClasses.bgCard} rounded-xl p-4 sm:p-6 shadow-lg border ${themeClasses.borderPrimary} animate-slideInUp`}
                style={{ animationDelay: `${weekIndex * 0.1}s` }}
              >
                {/* Week Header */}
                <button onClick={() => toggleWeek(weekNumber)} className="w-full flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center mr-3 shadow-md">
                      <span className="text-white font-bold text-lg">{weekNumber}</span>
                    </div>
                    <div className="text-left">
                      <h3 className={`${themeClasses.textPrimary} text-lg sm:text-xl font-bold`}>
                        {language === 'hebrew' ? `שבוע ${weekNumber}` : `Week ${weekNumber}`}
                      </h3>
                      {week.focus && <p className={`${themeClasses.textSecondary} text-sm mt-1`}>{week.focus}</p>}
                    </div>
                  </div>
                  <svg
                    className={`w-5 h-5 ${themeClasses.textSecondary} transition-transform duration-300 ${isWeekExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Week Days */}
                {isWeekExpanded && week.days && week.days.length > 0 && (
                  <div className="space-y-3 mt-4">
                    {week.days.map((day, dayIndex) => {
                      const dayNumber = day.day_number || dayIndex + 1;
                      const dayKey = `${weekNumber}-${dayNumber}`;
                      const isDayExpanded = expandedDays[dayKey];

                      return (
                        <div key={dayIndex} className={`${themeClasses.bgSecondary} rounded-lg p-4 border ${themeClasses.borderPrimary}`}>
                          {/* Day Header */}
                          <button onClick={() => toggleDay(weekNumber, dayNumber)} className="w-full flex items-center justify-between">
                            <div className="flex items-center">
                              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center mr-3">
                                <span className="text-white font-bold text-sm">{dayNumber}</span>
                              </div>
                              <h4 className={`${themeClasses.textPrimary} text-base sm:text-lg font-semibold`}>
                                {day.day_name || (language === 'hebrew' ? `יום ${dayNumber}` : `Day ${dayNumber}`)}
                              </h4>
                            </div>
                            <svg
                              className={`w-5 h-5 ${themeClasses.textSecondary} transition-transform duration-300 ${isDayExpanded ? 'rotate-180' : ''}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>

                          {/* Exercises */}
                          {isDayExpanded && day.exercises && day.exercises.length > 0 && (
                            <div className="mt-4 space-y-3">
                              {day.exercises
                                .sort((a, b) => (a.order || 0) - (b.order || 0))
                                .map((exercise, exerciseIndex) => (
                                  <div
                                    key={exerciseIndex}
                                    className={`${themeClasses.bgCard} rounded-lg p-4 border ${themeClasses.borderPrimary}`}
                                  >
                                    <div className="flex items-start justify-between mb-2">
                                      <div className="flex-1">
                                        <h5 className={`${themeClasses.textPrimary} font-bold text-base mb-1`}>{exercise.exercise_name}</h5>
                                        <div className="flex flex-wrap gap-3 text-sm">
                                          <span className={`${themeClasses.textSecondary}`}>
                                            <span className="font-semibold">{language === 'hebrew' ? 'סטים:' : 'Sets:'}</span> {exercise.sets}
                                          </span>
                                          <span className={`${themeClasses.textSecondary}`}>
                                            <span className="font-semibold">{language === 'hebrew' ? 'חזרות:' : 'Reps:'}</span> {exercise.reps}
                                          </span>
                                          {exercise.rest_seconds && (
                                            <span className={`${themeClasses.textSecondary}`}>
                                              <span className="font-semibold">{language === 'hebrew' ? 'מנוחה:' : 'Rest:'}</span> {exercise.rest_seconds}s
                                            </span>
                                          )}
                                          {exercise.target_weight_kg && (
                                            <span className={`${themeClasses.textSecondary}`}>
                                              <span className="font-semibold">{language === 'hebrew' ? 'משקל:' : 'Weight:'}</span>{' '}
                                              {exercise.target_weight_kg}kg
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    {exercise.notes && <p className={`${themeClasses.textSecondary} text-sm mt-2 italic`}>{exercise.notes}</p>}
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className={`${themeClasses.bgCard} rounded-xl p-8 text-center`}>
          <p className={themeClasses.textSecondary}>
            {language === 'hebrew' ? 'אין שבועות זמינים בתוכנית' : 'No weeks available in plan'}
          </p>
        </div>
      )}

      {/* Notes */}
      {trainingPlanData.notes && (
        <div className={`${themeClasses.bgCard} rounded-xl p-4 sm:p-6 mt-6 border ${themeClasses.borderPrimary}`}>
          <h3 className={`${themeClasses.textPrimary} font-bold text-lg mb-2`}>{language === 'hebrew' ? 'הערות' : 'Notes'}</h3>
          <p className={themeClasses.textSecondary}>{trainingPlanData.notes}</p>
        </div>
      )}
    </div>
  );
};

export default TrainingPlanTab;
