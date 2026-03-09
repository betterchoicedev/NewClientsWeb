import { useUserScores, useUserWeeklyScores } from "@/hooks/useUserDetail";
import { Loader2 } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";
import { format } from "date-fns";

const ANIM = { duration: 1200, easing: "ease-out" as const };

function KPICard({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

export function ScoringTab({ userId }: { userId: string }) {
  const { data: dailyScores, isLoading: loadingDaily } = useUserScores(userId);
  const { data: weeklyScores, isLoading: loadingWeekly } =
    useUserWeeklyScores(userId);

  if (loadingDaily || loadingWeekly) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
      </div>
    );
  }

  const latestDaily = dailyScores?.length
    ? dailyScores[dailyScores.length - 1]
    : null;
  const latestWeekly = weeklyScores?.length ? weeklyScores[0] : null;

  const dailyChartData = (dailyScores || []).map((s) => ({
    date: format(new Date(s.score_date), "MMM d"),
    "Daily Score": Math.round(s.daily_score),
    "On-Plan": Math.round(s.on_plan_score),
    Health: Math.round(s.health_score),
    Longevity: Math.round(s.longevity_score),
  }));

  const weeklyChartData = [...(weeklyScores || [])].reverse().map((s) => ({
    week: format(new Date(s.week_start), "MMM d"),
    Score: Math.round(s.weekly_score),
    "On-Plan": Math.round(s.avg_on_plan),
    Health: Math.round(s.avg_health),
    Longevity: Math.round(s.avg_longevity),
  }));

  // Radar chart data from latest score
  const radarData = latestDaily
    ? [
        { subject: "On-Plan", value: Math.round(latestDaily.on_plan_score) },
        { subject: "Health", value: Math.round(latestDaily.health_score) },
        { subject: "Longevity", value: Math.round(latestDaily.longevity_score) },
      ]
    : [];

  // Meals logged per day from daily scores
  const mealsLoggedData = (dailyScores || []).map((s) => ({
    date: format(new Date(s.score_date), "MMM d"),
    Meals: s.meals_logged,
  }));

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KPICard
          label="Today's Score"
          value={latestDaily ? Math.round(latestDaily.daily_score) : "-"}
          color={
            latestDaily && latestDaily.daily_score >= 80
              ? "text-green-600"
              : latestDaily && latestDaily.daily_score >= 60
                ? "text-yellow-600"
                : "text-red-600"
          }
        />
        <KPICard
          label="On-Plan"
          value={latestDaily ? Math.round(latestDaily.on_plan_score) : "-"}
          color="text-blue-600"
        />
        <KPICard
          label="Health"
          value={latestDaily ? Math.round(latestDaily.health_score) : "-"}
          color="text-emerald-600"
        />
        <KPICard
          label="Longevity"
          value={latestDaily ? Math.round(latestDaily.longevity_score) : "-"}
          color="text-purple-600"
        />
      </div>

      {/* Weekly trend info */}
      {latestWeekly && (
        <div className="flex items-center gap-4 rounded-lg bg-white p-4 border border-gray-200">
          <div>
            <span className="text-sm text-gray-500">Weekly Score:</span>{" "}
            <span className="font-semibold">
              {Math.round(latestWeekly.weekly_score)}
            </span>
          </div>
          <div>
            <span className="text-sm text-gray-500">Trend:</span>{" "}
            <span
              className={`font-medium ${
                latestWeekly.trend_direction === "improving"
                  ? "text-green-600"
                  : latestWeekly.trend_direction === "declining"
                    ? "text-red-600"
                    : "text-gray-600"
              }`}
            >
              {latestWeekly.trend_direction}{" "}
              {latestWeekly.week_over_week_change !== 0 && (
                <span>
                  ({latestWeekly.week_over_week_change > 0 ? "+" : ""}
                  {Math.round(latestWeekly.week_over_week_change)})
                </span>
              )}
            </span>
          </div>
        </div>
      )}

      {/* Score Components Stacked Area + Radar */}
      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-700">
            Score Components (30 days)
          </h3>
          {dailyChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={dailyChartData}>
                <defs>
                  <linearGradient id="gradOnPlan" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradHealth" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradLongevity" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="On-Plan"
                  stroke="#6366f1"
                  fill="url(#gradOnPlan)"
                  strokeWidth={2}
                  animationDuration={ANIM.duration}
                  animationEasing={ANIM.easing}
                />
                <Area
                  type="monotone"
                  dataKey="Health"
                  stroke="#10b981"
                  fill="url(#gradHealth)"
                  strokeWidth={2}
                  animationDuration={ANIM.duration}
                  animationEasing={ANIM.easing}
                  animationBegin={200}
                />
                <Area
                  type="monotone"
                  dataKey="Longevity"
                  stroke="#8b5cf6"
                  fill="url(#gradLongevity)"
                  strokeWidth={2}
                  animationDuration={ANIM.duration}
                  animationEasing={ANIM.easing}
                  animationBegin={400}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-8 text-center text-gray-400">No score data yet</p>
          )}
        </div>

        {/* Score Radar */}
        {radarData.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-gray-700">
              Today's Breakdown
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#e5e7eb" />
                <PolarAngleAxis
                  dataKey="subject"
                  tick={{ fontSize: 12, fill: "#6b7280" }}
                />
                <PolarRadiusAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 10 }}
                  axisLine={false}
                />
                <Radar
                  name="Score"
                  dataKey="value"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.25}
                  animationDuration={ANIM.duration}
                  animationEasing={ANIM.easing}
                />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Daily Score Line */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-gray-700">
          Daily Score Trend (30 days)
        </h3>
        {dailyChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="Daily Score"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                animationDuration={ANIM.duration}
                animationEasing={ANIM.easing}
              />
              <Line
                type="monotone"
                dataKey="On-Plan"
                stroke="#6366f1"
                strokeWidth={1}
                strokeDasharray="4 4"
                dot={false}
                animationDuration={ANIM.duration}
                animationEasing={ANIM.easing}
                animationBegin={300}
              />
              <Line
                type="monotone"
                dataKey="Health"
                stroke="#10b981"
                strokeWidth={1}
                strokeDasharray="4 4"
                dot={false}
                animationDuration={ANIM.duration}
                animationEasing={ANIM.easing}
                animationBegin={600}
              />
              <Line
                type="monotone"
                dataKey="Longevity"
                stroke="#8b5cf6"
                strokeWidth={1}
                strokeDasharray="4 4"
                dot={false}
                animationDuration={ANIM.duration}
                animationEasing={ANIM.easing}
                animationBegin={900}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="py-8 text-center text-gray-400">No score data yet</p>
        )}
      </div>

      {/* Weekly Score Bar Chart + Meals Logged */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-700">
            Weekly Scores
          </h3>
          {weeklyChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={weeklyChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar
                  dataKey="Score"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                  animationDuration={ANIM.duration}
                  animationEasing={ANIM.easing}
                />
                <Bar
                  dataKey="On-Plan"
                  fill="#6366f1"
                  radius={[4, 4, 0, 0]}
                  animationDuration={ANIM.duration}
                  animationEasing={ANIM.easing}
                  animationBegin={200}
                />
                <Bar
                  dataKey="Health"
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                  animationDuration={ANIM.duration}
                  animationEasing={ANIM.easing}
                  animationBegin={400}
                />
                <Bar
                  dataKey="Longevity"
                  fill="#8b5cf6"
                  radius={[4, 4, 0, 0]}
                  animationDuration={ANIM.duration}
                  animationEasing={ANIM.easing}
                  animationBegin={600}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-8 text-center text-gray-400">
              No weekly data yet
            </p>
          )}
        </div>

        {/* Meals Logged Per Day */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-700">
            Meals Logged Per Day
          </h3>
          {mealsLoggedData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={mealsLoggedData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  interval={Math.floor(mealsLoggedData.length / 8)}
                />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar
                  dataKey="Meals"
                  fill="#f59e0b"
                  radius={[3, 3, 0, 0]}
                  animationDuration={ANIM.duration}
                  animationEasing={ANIM.easing}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-8 text-center text-gray-400">
              No meal data yet
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
