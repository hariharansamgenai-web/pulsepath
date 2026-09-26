import { useMemo, useState } from 'react';
import { Calendar, Filter } from 'lucide-react';
import { useActiveProfile } from '@/context/ActiveProfileContext';
import { Card, CardHeader } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Loading } from '@/components/feedback/Loading';
import { ErrorState } from '@/components/feedback/ErrorState';
import { EmptyState } from '@/components/feedback/EmptyState';
import { TimelineEventCard } from '@/components/timeline/TimelineEventCard';
import { SimpleLineChart } from '@/components/timeline/SimpleLineChart';
import { useTimeline } from '@/hooks/useTimeline';
import { useCheckIns } from '@/hooks/useCheckIns';
import { useActivities } from '@/hooks/useActivities';
import { useGoals } from '@/hooks/useGoals';
import {
  weightChartData,
  exerciseChartData,
  waterChartData,
  sleepChartData,
  caloriesChartData,
  type TimelineEventType,
} from '@/lib/timeline';
import { computeGoalProgress } from '@/lib/goals';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { addDays, longDate, todayISO } from '@/lib/health';

type RangePreset = '7d' | '14d' | '30d' | '90d' | 'custom';

const PRESETS: { value: RangePreset; label: string; days: number }[] = [
  { value: '7d', label: 'Last 7 days', days: 7 },
  { value: '14d', label: 'Last 14 days', days: 14 },
  { value: '30d', label: 'Last 30 days', days: 30 },
  { value: '90d', label: 'Last 90 days', days: 90 },
];

const TYPE_OPTIONS: { value: TimelineEventType | 'all'; label: string }[] = [
  { value: 'all', label: 'All events' },
  { value: 'check_in', label: 'Check-ins' },
  { value: 'exercise', label: 'Exercise' },
  { value: 'weight', label: 'Weight' },
  { value: 'goal_created', label: 'Goals created' },
  { value: 'goal_completed', label: 'Goals completed' },
];

type ChartTab = 'weight' | 'exercise' | 'water' | 'sleep' | 'calories' | 'goals';

const CHART_TABS: { value: ChartTab; label: string }[] = [
  { value: 'weight', label: 'Weight' },
  { value: 'exercise', label: 'Exercise' },
  { value: 'water', label: 'Water' },
  { value: 'sleep', label: 'Sleep' },
  { value: 'calories', label: 'Calories' },
  { value: 'goals', label: 'Goals' },
];

export function TimelinePage() {
  const { activeProfile } = useActiveProfile();
  const today = todayISO();

  const [preset, setPreset] = useState<RangePreset>('30d');
  const [customFrom, setCustomFrom] = useState(addDays(today, -29));
  const [customTo, setCustomTo] = useState(today);
  const [typeFilter, setTypeFilter] = useState<TimelineEventType | 'all'>('all');
  const [chartTab, setChartTab] = useState<ChartTab>('weight');

  const days = PRESETS.find((p) => p.value === preset)?.days ?? 30;
  const from = preset === 'custom' ? customFrom : addDays(today, -(days - 1));
  const to = preset === 'custom' ? customTo : today;

  const { events, loading, error, reload } = useTimeline({
    profileId: activeProfile?.id,
    from,
    to,
    typeFilter,
  });

  const { checkIns } = useCheckIns(activeProfile?.id, days);
  const { activities } = useActivities(activeProfile?.id, days);
  const { goals } = useGoals(activeProfile?.id);

  // Group events by date
  const grouped = useMemo(() => {
    const map = new Map<string, typeof events>();
    for (const e of events) {
      const list = map.get(e.date) ?? [];
      list.push(e);
      map.set(e.date, list);
    }
    return [...map.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [events]);

  // Chart data
  const chartData = useMemo(() => ({
    weight: weightChartData(checkIns),
    exercise: exerciseChartData(activities),
    water: waterChartData(checkIns),
    sleep: sleepChartData(checkIns),
    calories: caloriesChartData(activities),
  }), [checkIns, activities]);

  const activeGoals = useMemo(() => goals.filter((g) => g.status === 'active'), [goals]);

  if (!activeProfile) return <Loading label="Loading profile" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">Health timeline</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Everything logged for {activeProfile.display_name} in one place.
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <Button
                key={p.value}
                size="sm"
                variant={preset === p.value ? 'primary' : 'outline'}
                onClick={() => setPreset(p.value)}
              >
                {p.label}
              </Button>
            ))}
            <Button
              size="sm"
              variant={preset === 'custom' ? 'primary' : 'outline'}
              onClick={() => setPreset('custom')}
            >
              Custom
            </Button>
          </div>
          {preset === 'custom' && (
            <div className="flex items-end gap-2">
              <Input
                label="From"
                type="date"
                name="from"
                value={customFrom}
                max={customTo}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
              <Input
                label="To"
                type="date"
                name="to"
                value={customTo}
                min={customFrom}
                max={today}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </div>
          )}
          <Select
            name="type"
            value={typeFilter}
            options={TYPE_OPTIONS}
            onChange={(e) => setTypeFilter(e.target.value as TimelineEventType | 'all')}
          />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Charts */}
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <div className="mb-4 flex flex-wrap gap-1.5">
              {CHART_TABS.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setChartTab(t.value)}
                  className={
                    chartTab === t.value
                      ? 'rounded-full bg-primary-600 px-3 py-1 text-xs font-medium text-white'
                      : 'rounded-full border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50'
                  }
                >
                  {t.label}
                </button>
              ))}
            </div>

            {chartTab === 'weight' && (
              <>
                <CardHeader title="Weight" subtitle="kg" className="mb-3" />
                <SimpleLineChart data={chartData.weight} unit="kg" color="#0ea5e9" />
              </>
            )}
            {chartTab === 'exercise' && (
              <>
                <CardHeader title="Exercise" subtitle="minutes per day" className="mb-3" />
                <SimpleLineChart data={chartData.exercise} unit="min" color="#14b8a6" goalLine={30} goalLabel="30 min" />
              </>
            )}
            {chartTab === 'water' && (
              <>
                <CardHeader title="Water" subtitle="ml per day" className="mb-3" />
                <SimpleLineChart data={chartData.water} unit="ml" color="#0284c7" goalLine={2000} goalLabel="2 L" />
              </>
            )}
            {chartTab === 'sleep' && (
              <>
                <CardHeader title="Sleep" subtitle="hours per night" className="mb-3" />
                <SimpleLineChart data={chartData.sleep} unit="h" color="#d97706" goalLine={7} goalLabel="7 h" />
              </>
            )}
            {chartTab === 'calories' && (
              <>
                <CardHeader title="Calories burned" subtitle="kcal from logged activities" className="mb-3" />
                <SimpleLineChart data={chartData.calories} unit="kcal" color="#dc2626" />
              </>
            )}
            {chartTab === 'goals' && (
              <>
                <CardHeader title="Goal progress" subtitle="Active goals, tracked from real data" className="mb-3" />
                {activeGoals.length === 0 ? (
                  <p className="py-8 text-center text-sm text-neutral-500">No active goals.</p>
                ) : (
                  <div className="space-y-4">
                    {activeGoals.map((g) => {
                      const p = computeGoalProgress(g, checkIns, activities);
                      return (
                        <div key={g.id}>
                          <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                            <span className="truncate font-medium text-neutral-800">{g.title}</span>
                            <span className="text-xs text-neutral-500">{p.periodLabel}</span>
                          </div>
                          {p.measurable ? (
                            <ProgressBar
                              value={p.value ?? 0}
                              max={p.target ?? 1}
                              label={`${p.value !== null ? (Number.isInteger(p.value) ? p.value : p.value.toFixed(1)) : 0} / ${p.target ?? '?'} ${g.unit ?? ''}`}
                            />
                          ) : (
                            <p className="text-xs text-neutral-500">Tracked manually</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            <p className="mt-4 text-xs text-neutral-500">
              All data shown is from your logged check-ins and activities. Nothing is simulated or estimated.
            </p>
          </Card>
        </div>

        {/* Event feed */}
        <div className="lg:col-span-3">
          <Card noPadding>
            <div className="border-b border-neutral-200 px-5 py-4">
              <CardHeader
                title="Events"
                subtitle={`${events.length} event${events.length !== 1 ? 's' : ''} · ${longDate(from)} to ${longDate(to)}`}
                action={<Filter className="h-4 w-4 text-neutral-400" />}
              />
            </div>

            {loading && events.length === 0 ? (
              <Loading label="Loading timeline" />
            ) : error ? (
              <div className="p-5">
                <ErrorState message={error} onRetry={reload} />
              </div>
            ) : events.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  icon={<Calendar className="h-6 w-6" />}
                  title="No events in this period"
                  description="Adjust the date range or filters, or log a check-in or activity."
                />
              </div>
            ) : (
              <div className="max-h-[40rem] divide-y divide-neutral-100 overflow-y-auto">
                {grouped.map(([date, dayEvents]) => (
                  <div key={date} className="px-5 py-4">
                    <div className="mb-3 flex items-center gap-2">
                      <Badge variant="neutral">{longDate(date)}</Badge>
                      <span className="text-xs text-neutral-500">
                        {dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="space-y-3">
                      {dayEvents.map((event) => (
                        <TimelineEventCard key={event.id} event={event} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
