import { type ChangeEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import { useGetWeatherCurrent, useGetWeatherForecast, useHealthCheck, getGetWeatherCurrentQueryKey, getGetWeatherForecastQueryKey, getHealthCheckQueryKey } from '@workspace/api-client-react';
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet';
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, Check, ChevronDown, CircleHelp, CloudSun, Crosshair, Droplets, Gauge, Globe2, LocateFixed, MapPin, Menu, Moon, RefreshCw, Satellite, ShieldCheck, Sun, Thermometer, Wind, X, Zap } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

type City = { name: string; state: string; lat: number; lon: number; timezone: string };

const CITIES: City[] = [
  { name: 'Delhi', state: 'National Capital Territory', lat: 28.6139, lon: 77.209, timezone: 'Asia/Kolkata' },
  { name: 'Ahmedabad', state: 'Gujarat', lat: 23.0225, lon: 72.5714, timezone: 'Asia/Kolkata' },
  { name: 'Bengaluru', state: 'Karnataka', lat: 12.9716, lon: 77.5946, timezone: 'Asia/Kolkata' },
  { name: 'Chennai', state: 'Tamil Nadu', lat: 13.0827, lon: 80.2707, timezone: 'Asia/Kolkata' },
  { name: 'Hyderabad', state: 'Telangana', lat: 17.385, lon: 78.4867, timezone: 'Asia/Kolkata' },
  { name: 'Jaipur', state: 'Rajasthan', lat: 26.9124, lon: 75.7873, timezone: 'Asia/Kolkata' },
  { name: 'Kolkata', state: 'West Bengal', lat: 22.5726, lon: 88.3639, timezone: 'Asia/Kolkata' },
  { name: 'Lucknow', state: 'Uttar Pradesh', lat: 26.8467, lon: 80.9462, timezone: 'Asia/Kolkata' },
  { name: 'Mumbai', state: 'Maharashtra', lat: 19.076, lon: 72.8777, timezone: 'Asia/Kolkata' },
  { name: 'Patna', state: 'Bihar', lat: 25.5941, lon: 85.1376, timezone: 'Asia/Kolkata' },
  { name: 'Pune', state: 'Maharashtra', lat: 18.5204, lon: 73.8567, timezone: 'Asia/Kolkata' },
  { name: 'Bhubaneswar', state: 'Odisha', lat: 20.2961, lon: 85.8245, timezone: 'Asia/Kolkata' },
  { name: 'Guwahati', state: 'Assam', lat: 26.1445, lon: 91.7362, timezone: 'Asia/Kolkata' },
];

const DEFAULT_CITY = CITIES[0];
const riskLabels = ['LOW', 'MODERATE', 'HIGH', 'VERY HIGH', 'EXTREME'];
const riskStyles: Record<string, { bg: string; ink: string; line: string }> = {
  LOW: { bg: '#e4efad', ink: '#365039', line: '#8cad43' },
  MODERATE: { bg: '#f2e8a4', ink: '#6e581e', line: '#d0ad33' },
  HIGH: { bg: '#f6c18c', ink: '#7d3e1f', line: '#df793b' },
  VERY_HIGH: { bg: '#e89a75', ink: '#702c26', line: '#c84b44' },
  EXTREME: { bg: '#bd5b5b', ink: '#fff7ed', line: '#9f3038' },
};

function formatTime(timestamp: string | undefined, timezone: string) {
  if (!timestamp) return '—';
  try {
    if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(timestamp)) {
      const time = timestamp.split('T')[1]?.slice(0, 5);
      return time ?? '—';
    }
    return new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timezone }).format(new Date(timestamp));
  } catch {
    return '—';
  }
}

function formatDateTime(timestamp: string | undefined, timezone: string) {
  if (!timestamp) return '—';
  try {
    if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(timestamp)) {
      const [date, time] = timestamp.split('T');
      if (!date || !time) return '—';
      const [, month, day] = date.split('-');
      return `${day} ${new Intl.DateTimeFormat('en-IN', { month: 'short' }).format(new Date(2020, Number(month) - 1, 1))}, ${time.slice(0, 5)}`;
    }
    return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timezone }).format(new Date(timestamp));
  } catch {
    return '—';
  }
}

function formatPeakWindow(window: string | undefined, timezone: string) {
  if (!window) return '—';
  return window
    .split(' – ')
    .map((timestamp) => formatDateTime(timestamp, timezone))
    .join(' – ');
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-[hsl(var(--muted))] ${className}`} />;
}

function SectionLabel({ eyebrow, title, action }: { eyebrow: string; title: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div>
        <div className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">{eyebrow}</div>
        <h2 className="mt-1 font-display text-[19px] font-semibold tracking-[-0.03em]">{title}</h2>
      </div>
      {action}
    </div>
  );
}

function RiskPill({ level, compact = false }: { level?: string; compact?: boolean }) {
  const style = riskStyles[level ?? 'MODERATE'] ?? riskStyles.MODERATE;
  return (
    <span data-testid="status-risk-level" className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] font-medium tracking-[0.12em] ${compact ? 'py-0.5' : ''}`} style={{ background: style.bg, color: style.ink }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: style.line }} />
      {(level ?? 'MODERATE').replace('_', ' ')}
    </span>
  );
}

function HtsiGauge({ value = 0, level = 'MODERATE', color }: { value?: number; level?: string; color?: string }) {
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0));
  const style = riskStyles[level] ?? riskStyles.MODERATE;
  return (
    <div className="relative mx-auto h-[190px] w-[190px]" data-testid="gauge-htsi">
      <div className="absolute inset-0 rounded-full" style={{ background: `conic-gradient(${color || style.line} ${safeValue * 3.6}deg, hsl(var(--muted)) 0deg)` }} />
      <div className="absolute inset-[10px] rounded-full bg-[hsl(var(--card))]" />
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))]">HTSI</div>
        <div className="font-display text-[48px] font-semibold leading-none tracking-[-0.08em]" data-testid="text-htsi-value">{Math.round(safeValue)}</div>
        <RiskPill level={level} compact />
      </div>
      <div className="absolute left-1/2 top-0 h-2.5 w-2.5 -translate-x-1/2 rounded-full border-2 border-[hsl(var(--card))]" style={{ background: color || style.line }} />
    </div>
  );
}

function Metric({ icon: Icon, label, value, unit, tone = 'default' }: { icon: typeof Thermometer; label: string; value: string | number; unit: string; tone?: 'default' | 'warm' | 'cool' }) {
  return (
    <div className="group rounded-lg border border-[hsl(var(--card-border))] bg-[hsl(var(--card))] p-3 transition-transform duration-200 hover:-translate-y-0.5" data-testid={`metric-${label.toLowerCase().replaceAll(' ', '-')}`}>
      <div className={`mb-3 flex h-7 w-7 items-center justify-center rounded-md ${tone === 'warm' ? 'bg-[#f6c18c]/45 text-[#a4512d]' : tone === 'cool' ? 'bg-[#b9dfe2]/45 text-[#287681]' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'}`}>
        <Icon size={15} strokeWidth={1.8} />
      </div>
      <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[hsl(var(--muted-foreground))]">{label}</div>
      <div className="mt-1 font-display text-[22px] font-semibold tracking-[-0.05em]">{value}<span className="ml-1 font-mono text-[10px] font-normal tracking-normal text-[hsl(var(--muted-foreground))]">{unit}</span></div>
    </div>
  );
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; payload: { risk: string } }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[hsl(var(--card-border))] bg-[hsl(var(--card))] px-3 py-2 shadow-lg">
      <div className="font-mono text-[10px] text-[hsl(var(--muted-foreground))]">{label}</div>
      <div className="mt-1 font-display text-lg font-semibold">{payload[0].value}<span className="ml-1 font-mono text-[10px] font-normal">HTSI</span></div>
      <RiskPill level={payload[0].payload.risk} compact />
    </div>
  );
}

function MapViewSync({ city }: { city: City }) {
  const map = useMap();

  useEffect(() => {
    map.setView([city.lat, city.lon], 9, { animate: true });
  }, [city, map]);

  return null;
}

function MapPanel({ city, htsiValue, riskLevel, temperature }: { city: City; htsiValue?: number; riskLevel?: string; temperature?: number }) {
  return (
    <div className="relative h-[260px] overflow-hidden rounded-lg border border-[hsl(var(--card-border))] bg-[#d7ddd0]" data-testid="map-location">
      <MapContainer center={[city.lat, city.lon]} zoom={9} scrollWheelZoom={false} zoomControl className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapViewSync city={city} />
        <CircleMarker center={[city.lat, city.lon]} radius={10} pathOptions={{ color: '#9f3038', fillColor: '#c84b44', fillOpacity: 0.9, weight: 3 }}>
          <Popup>
            <div className="space-y-1 text-sm">
              <strong>{city.name}</strong>
              <div>HTSI: {htsiValue ?? '—'}</div>
              <div>Risk: {riskLevel?.replace('_', ' ') ?? '—'}</div>
              <div>Temperature: {temperature?.toFixed(1) ?? '—'}°C</div>
            </div>
          </Popup>
        </CircleMarker>
      </MapContainer>
      <div className="pointer-events-none absolute left-3 top-3 rounded-md border border-white/60 bg-[hsl(var(--card)/.88)] px-2.5 py-2 shadow-sm backdrop-blur-sm">
        <div className="flex items-center gap-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.1em]"><MapPin size={12} className="text-[#ba4f3f]" /> active location</div>
        <div className="mt-1 font-display text-sm font-semibold">{city.name}</div>
      </div>
      <div className="absolute bottom-1 right-2 rounded bg-white/70 px-1.5 py-0.5 text-[9px] text-slate-700">Leaflet / OpenStreetMap</div>
    </div>
  );
}

export default function Dashboard() {
  const [city, setCity] = useState<City>(DEFAULT_CITY);
  const [locationMode, setLocationMode] = useState<'city' | 'browser'>('city');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem('htsi-theme') !== 'light');
  const [geoMessage, setGeoMessage] = useState('');
  const params = useMemo(() => ({ lat: city.lat, lon: city.lon }), [city]);
  const current = useGetWeatherCurrent(params, { query: { queryKey: getGetWeatherCurrentQueryKey(params), refetchInterval: 300000 } });
  const forecast = useGetWeatherForecast(params, { query: { queryKey: getGetWeatherForecastQueryKey(params), refetchInterval: 900000 } });
  const health = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey(), refetchInterval: 30000 } });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('htsi-theme', dark ? 'dark' : 'light');
  }, [dark]);

  useEffect(() => {
    if (sessionStorage.getItem('htsi-location-prompted') === '1') return;
    sessionStorage.setItem('htsi-location-prompted', '1');
    if (!navigator.geolocation) {
      setGeoMessage('Location access unavailable. Choose a city manually.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCity({ name: 'Current position', state: 'Browser location', lat: position.coords.latitude, lon: position.coords.longitude, timezone: 'Asia/Kolkata' });
        setLocationMode('browser');
        setGeoMessage('Using browser location');
      },
      () => setGeoMessage('Location access unavailable. Choose a city manually.'),
      { enableHighAccuracy: false, timeout: 8000 },
    );
  }, []);

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setGeoMessage('Browser location is unavailable. Choose a city instead.');
      return;
    }
    setGeoMessage('Requesting browser location…');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCity({ name: 'Current position', state: 'Browser location', lat: position.coords.latitude, lon: position.coords.longitude, timezone: 'Asia/Kolkata' });
        setLocationMode('browser');
        setGeoMessage('Using browser location');
      },
      () => setGeoMessage('Location permission was not granted. Choose a city instead.'),
      { enableHighAccuracy: false, timeout: 8000 },
    );
  };

  const selectCity = (event: ChangeEvent<HTMLSelectElement>) => {
    const next = CITIES.find((item) => item.name === event.target.value);
    if (next) {
      setCity(next);
      setLocationMode('city');
      setGeoMessage('');
    }
  };

  const handleRefresh = () => {
    void current.refetch();
    void forecast.refetch();
  };

  const weather = current.data?.weather;
  const htsi = current.data?.htsi;
  const forecastData = forecast.data;
  const resolvedTimezone = current.data?.location.timezone || city.timezone;
  const resolvedLatitude = current.data?.location.latitude ?? city.lat;
  const resolvedLongitude = current.data?.location.longitude ?? city.lon;
  const chartData = useMemo(() => (forecastData?.points ?? []).map((point) => ({
    time: formatTime(point.timestamp, resolvedTimezone),
    value: Math.round(point.htsi.value),
    temperature: Math.round(point.weather.temperature_c),
    risk: point.htsi.risk_level,
  })), [forecastData?.points, resolvedTimezone]);
  const warning = forecastData?.warning;
  const loading = current.isLoading || forecast.isLoading;
  const hasError = current.isError || forecast.isError;
  const coordinates = `${resolvedLatitude.toFixed(4)}° N, ${resolvedLongitude.toFixed(4)}° E`;
  const currentRiskStyle = riskStyles[htsi?.risk_level ?? 'MODERATE'] ?? riskStyles.MODERATE;
  const riskIndex = Math.max(0, riskLabels.indexOf(htsi?.risk_level ?? 'MODERATE'));

  return (
    <div className="noise min-h-[100dvh] bg-[hsl(var(--background))]">
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[236px] flex-col bg-[hsl(var(--sidebar))] px-4 py-5 text-[hsl(var(--sidebar-foreground))] transition-transform duration-300 md:translate-x-0 ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-start justify-between px-2">
          <div>
            <div className="flex items-center gap-2 font-display text-[17px] font-semibold tracking-[-0.04em]"><span className="flex h-7 w-7 items-center justify-center rounded-md bg-[hsl(var(--sidebar-primary))] text-[hsl(var(--sidebar-primary-foreground))]"><Activity size={16} strokeWidth={2.5} /></span> HTSI</div>
            <div className="mt-1 pl-9 font-mono text-[9px] uppercase tracking-[0.17em] text-[hsl(var(--sidebar-foreground)/.52)]">early warning system</div>
          </div>
          <button type="button" onClick={() => setMobileNavOpen(false)} className="rounded-md p-1 text-[hsl(var(--sidebar-foreground)/.65)] hover:bg-[hsl(var(--sidebar-accent))] md:hidden" data-testid="button-close-mobile-nav"><X size={18} /></button>
        </div>
        <div className="mt-10 px-2 font-mono text-[9px] uppercase tracking-[0.18em] text-[hsl(var(--sidebar-foreground)/.45)]">monitoring desk</div>
        <nav className="mt-2 space-y-1">
          <button type="button" className="flex w-full items-center gap-3 rounded-md bg-[hsl(var(--sidebar-accent))] px-3 py-2.5 text-left text-sm font-medium text-[hsl(var(--sidebar-accent-foreground))]" data-testid="nav-monitoring"><Gauge size={16} /> Live monitoring <span className="ml-auto h-1.5 w-1.5 animate-pulse-dot rounded-full bg-[hsl(var(--sidebar-primary))]" /></button>
          <button type="button" onClick={() => document.getElementById('forecast')?.scrollIntoView({ behavior: 'smooth' })} className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm text-[hsl(var(--sidebar-foreground)/.7)] transition hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-accent-foreground))]" data-testid="nav-forecast"><Satellite size={16} /> 24-hour forecast</button>
          <button type="button" onClick={() => document.getElementById('location')?.scrollIntoView({ behavior: 'smooth' })} className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm text-[hsl(var(--sidebar-foreground)/.7)] transition hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-accent-foreground))]" data-testid="nav-location"><Globe2 size={16} /> Location context</button>
        </nav>
        <div className="mt-auto rounded-lg border border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-accent)/.55)] p-3">
          <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.13em] text-[hsl(var(--sidebar-foreground)/.6)]"><span className={`h-1.5 w-1.5 rounded-full ${health.isError ? 'bg-[#e89a75]' : 'bg-[hsl(var(--sidebar-primary))]'} animate-pulse-dot`} /> system status</div>
          <div className="mt-2 text-sm font-medium">{health.isError ? 'Provider check failed' : 'All feeds operational'}</div>
          <div className="mt-1 text-[11px] leading-relaxed text-[hsl(var(--sidebar-foreground)/.55)]">Refreshes every 5 minutes while this desk is open.</div>
        </div>
        <div className="mt-4 border-t border-[hsl(var(--sidebar-border))] px-2 pt-4 font-mono text-[9px] leading-relaxed text-[hsl(var(--sidebar-foreground)/.4)]">HTSI v0.1 · operational prototype<br />Built for Indian city heat response</div>
      </aside>

      {mobileNavOpen && <button type="button" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} className="fixed inset-0 z-30 bg-[hsl(var(--foreground)/.35)] md:hidden" data-testid="button-mobile-nav-backdrop" />}

      <div className="md:pl-[236px]">
        <header className="sticky top-0 z-20 border-b border-[hsl(var(--border))] bg-[hsl(var(--background)/.9)] backdrop-blur-md">
          <div className="flex min-h-[68px] items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setMobileNavOpen(true)} className="rounded-md border border-[hsl(var(--border))] p-2 md:hidden" data-testid="button-open-mobile-nav"><Menu size={18} /></button>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">live operations / India</div>
                <h1 className="mt-0.5 font-display text-[20px] font-semibold tracking-[-0.04em] sm:text-[23px]">Thermal stress overview</h1>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 sm:flex">
                <span className={`h-1.5 w-1.5 rounded-full ${health.isError ? 'bg-[#c84b44]' : 'bg-[#8cad43]'} animate-pulse-dot`} />
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[hsl(var(--muted-foreground))]">{health.isError ? 'degraded' : 'live data'}</span>
              </div>
              <button type="button" onClick={() => setDark((value) => !value)} className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-2 transition hover:-translate-y-0.5 hover:bg-[hsl(var(--muted))]" title="Toggle dark mode" data-testid="button-toggle-theme">{dark ? <Sun size={16} /> : <Moon size={16} />}</button>
              <button type="button" onClick={handleRefresh} disabled={current.isFetching || forecast.isFetching} className="flex items-center gap-2 rounded-md bg-[hsl(var(--primary))] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-[hsl(var(--primary-foreground))] transition hover:-translate-y-0.5 disabled:opacity-60" data-testid="button-refresh-data"><RefreshCw size={14} className={current.isFetching || forecast.isFetching ? 'animate-spin' : ''} /> <span className="hidden sm:inline">refresh</span></button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
          <section className="animate-rise-in border-b border-[hsl(var(--border))] pb-5" data-testid="section-location-context">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--accent))] px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-[hsl(var(--accent-foreground))]"><span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-[#718c39]" /> live data</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.11em] text-[hsl(var(--muted-foreground))]">{locationMode === 'browser' ? 'browser location' : 'manual city selection'}</span>
                </div>
                <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h2 className="font-display text-[32px] font-semibold tracking-[-0.065em] sm:text-[42px]" data-testid="text-current-location">{city.name}</h2>
                  <span className="text-sm text-[hsl(var(--muted-foreground))]">{city.state}</span>
                </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] text-[hsl(var(--muted-foreground))]"><span className="inline-flex items-center gap-1"><Crosshair size={11} /> {coordinates}</span><span className="inline-flex items-center gap-1"><Globe2 size={11} /> {resolvedTimezone}</span></div>
              </div>
              <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                <label className="relative">
                  <span className="sr-only">Select an Indian city</span>
                  <select value={CITIES.some((item) => item.name === city.name) ? city.name : ''} onChange={selectCity} className="h-10 w-full appearance-none rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--card))] pl-3 pr-9 text-sm outline-none transition focus:border-[hsl(var(--ring))] focus:ring-2 focus:ring-[hsl(var(--ring)/.2)] sm:w-[190px]" data-testid="select-indian-city">
                    <option value="" disabled>Choose Indian city</option>
                    {CITIES.map((item) => <option key={item.name} value={item.name}>{item.name}, {item.state}</option>)}
                  </select>
                  <ChevronDown size={15} className="pointer-events-none absolute right-3 top-3 text-[hsl(var(--muted-foreground))]" />
                </label>
                <button type="button" onClick={requestLocation} className="flex h-10 items-center justify-center gap-2 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm font-medium transition hover:-translate-y-0.5 hover:border-[hsl(var(--foreground)/.35)]" data-testid="button-use-location"><LocateFixed size={15} /> Use my location</button>
              </div>
            </div>
            {geoMessage && <div className="mt-3 flex items-center gap-1.5 font-mono text-[10px] text-[hsl(var(--muted-foreground))]" data-testid="status-location-message"><CircleHelp size={12} /> {geoMessage}</div>}
          </section>

          {loading && <section className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_1.45fr]"><Skeleton className="h-[306px]" /><Skeleton className="h-[306px]" /></section>}
          {hasError && !loading && <section className="mt-6 flex items-start gap-3 rounded-lg border border-[#d9876b]/50 bg-[#f6c18c]/20 p-4" data-testid="status-data-error"><AlertTriangle className="mt-0.5 text-[#a4512d]" size={19} /><div><div className="font-display font-semibold">Live weather feed unavailable</div><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">The provider did not return a current observation. Retry the connection or choose another city.</p><button type="button" onClick={handleRefresh} className="mt-3 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em]" data-testid="button-retry-data">Retry connection</button></div></section>}

          {!loading && !hasError && current.data && (
            <>
              <section className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_1.45fr]">
                <article className="relative overflow-hidden rounded-xl border border-[hsl(var(--card-border))] bg-[hsl(var(--card))] p-5 shadow-[var(--shadow-sm)] sm:p-6" data-testid="card-current-assessment">
                  <div className="absolute right-0 top-0 h-40 w-40 rounded-full opacity-20 blur-3xl" style={{ background: currentRiskStyle.line }} />
                    <SectionLabel eyebrow="01 / current assessment" title="Right now" action={<span className="font-mono text-[10px] text-[hsl(var(--muted-foreground))]">last updated {formatDateTime(current.data.timestamp, resolvedTimezone)} local</span>} />
                  <div className="grid items-center gap-5 sm:grid-cols-[210px_1fr]">
                    <HtsiGauge value={htsi?.value} level={htsi?.risk_level} color={htsi?.risk_color} />
                    <div>
                      <div className="flex items-center gap-2"><RiskPill level={htsi?.risk_level} /><span className="font-mono text-[10px] text-[hsl(var(--muted-foreground))]">prototype HTSI model</span></div>
                      <p className="mt-4 max-w-[410px] text-[15px] leading-relaxed text-[hsl(var(--foreground)/.78)]" data-testid="text-htsi-description">{htsi?.description ?? 'No assessment description available.'}</p>
                      <div className="mt-5 flex items-center gap-2 border-t border-[hsl(var(--border))] pt-4 font-mono text-[10px] text-[hsl(var(--muted-foreground))]"><ShieldCheck size={13} className="text-[#78943f]" /> Decision support only · not medical or government guidance</div>
                    </div>
                  </div>
                  <div className="mt-6">
                    <div className="mb-2 flex justify-between font-mono text-[9px] uppercase tracking-[0.08em] text-[hsl(var(--muted-foreground))]"><span>lower stress</span><span>higher stress</span></div>
                    <div className="flex h-2.5 gap-1 overflow-hidden rounded-full">{riskLabels.map((label, index) => <div key={label} className="flex-1 first:rounded-l-full last:rounded-r-full" style={{ background: riskStyles[label.replace(' ', '_')]?.line, opacity: index <= riskIndex ? 1 : .24 }} />)}</div>
                  </div>
                </article>
                <article className="rounded-xl border border-[hsl(var(--card-border))] bg-[hsl(var(--card))] p-5 shadow-[var(--shadow-sm)] sm:p-6" data-testid="card-environmental-conditions">
                  <SectionLabel eyebrow="02 / observed conditions" title="Environmental conditions" action={<span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.11em] text-[#668839]"><Check size={12} /> observation live</span>} />
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <Metric icon={Thermometer} label="air temperature" value={weather?.temperature_c?.toFixed(1) ?? '—'} unit="°C" tone="warm" />
                    <Metric icon={Droplets} label="relative humidity" value={weather?.relative_humidity_pct?.toFixed(0) ?? '—'} unit="%" tone="cool" />
                    <Metric icon={Wind} label="wind speed" value={weather?.wind_speed_ms?.toFixed(1) ?? '—'} unit="m/s" />
                    <Metric icon={Gauge} label="pressure" value={weather?.pressure_hpa?.toFixed(0) ?? '—'} unit="hPa" />
                    <Metric icon={Sun} label="solar radiation" value={weather?.solar_radiation_wm2?.toFixed(0) ?? '—'} unit="W/m²" tone="warm" />
                    <Metric icon={CloudSun} label="cloud cover" value={weather?.cloud_cover_pct?.toFixed(0) ?? '—'} unit="%" />
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-[hsl(var(--border))] pt-3"><div className="flex items-center gap-2 text-sm"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-[hsl(var(--muted))]"><CloudSun size={14} /></span>{weather?.weather_label ?? 'Conditions unavailable'}</div><span className="font-mono text-[10px] text-[hsl(var(--muted-foreground))]">weather code {weather?.weather_code ?? '—'}</span></div>
                </article>
              </section>

              <section id="forecast" className="mt-7 grid gap-4 xl:grid-cols-[1.55fr_.85fr]">
                <article className="rounded-xl border border-[hsl(var(--card-border))] bg-[hsl(var(--card))] p-5 shadow-[var(--shadow-sm)] sm:p-6" data-testid="card-forecast-chart">
                  <SectionLabel eyebrow="03 / next 24 hours" title="Thermal stress forecast" action={<span className="font-mono text-[10px] text-[hsl(var(--muted-foreground))]">weather-provider forecast</span>} />
                  {chartData.length ? <div className="h-[250px] w-full" data-testid="chart-forecast"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={chartData} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}><defs><linearGradient id="htsiArea" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#d9783c" stopOpacity=".28" /><stop offset="100%" stopColor="#d9783c" stopOpacity=".02" /></linearGradient></defs><CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 4" vertical={false} /><XAxis dataKey="time" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} minTickGap={24} /><YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} /><ReferenceLine y={65} stroke="#d0ad33" strokeDasharray="4 4" label={{ value: 'high', fill: '#a08025', fontSize: 10, position: 'insideTopRight' }} /><Area type="monotone" dataKey="value" stroke="none" fill="url(#htsiArea)" /><Line type="monotone" dataKey="value" stroke="#c9603e" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: '#c9603e', stroke: 'hsl(var(--card))', strokeWidth: 2 }} /><Tooltip content={<ChartTooltip />} /></ComposedChart></ResponsiveContainer></div> : <div className="flex h-[250px] flex-col items-center justify-center rounded-lg border border-dashed border-[hsl(var(--border))] text-center"><Satellite size={22} className="text-[hsl(var(--muted-foreground))]" /><div className="mt-3 font-display font-medium">Forecast points are not available</div><div className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">Refresh to request the provider forecast again.</div></div>}
                  <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[hsl(var(--border))] pt-3 font-mono text-[10px] text-[hsl(var(--muted-foreground))]"><span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#c9603e]" /> HTSI value</span><span className="inline-flex items-center gap-1.5"><i className="h-px w-3 border-t border-dashed border-[#d0ad33]" /> high threshold</span><span>Open-Meteo hourly input</span></div>
                </article>
                <article className="rounded-xl border border-[hsl(var(--card-border))] bg-[hsl(var(--card))] p-5 shadow-[var(--shadow-sm)] sm:p-6" data-testid="card-peak-summary">
                  <SectionLabel eyebrow="peak window" title="What to watch" />
                  <div className="rounded-lg border border-[#df793b]/35 bg-[#f6c18c]/20 p-4"><div className="flex items-start justify-between gap-3"><div><div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#9c4c2d]">forecast peak</div><div className="mt-1 font-display text-[38px] font-semibold tracking-[-0.08em] text-[#913f2d]" data-testid="text-peak-value">{forecastData?.peak?.htsi.value ?? '—'}<span className="ml-1 font-mono text-[11px] font-normal tracking-normal">HTSI</span></div></div><ArrowUpRight className="text-[#b65a34]" size={20} /></div><div className="mt-3 space-y-2 text-sm"><div className="flex justify-between gap-2"><span className="text-[hsl(var(--muted-foreground))]">Expected at</span><strong className="font-mono text-xs">{formatDateTime(forecastData?.peak?.timestamp, resolvedTimezone)}</strong></div><div className="flex justify-between gap-2"><span className="text-[hsl(var(--muted-foreground))]">Window</span><strong className="font-mono text-xs">{formatPeakWindow(warning?.peak_window, resolvedTimezone)}</strong></div></div></div>
                  <div className="mt-5"><div className="mb-2 flex items-center justify-between"><span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[hsl(var(--muted-foreground))]">prototype heatwave risk</span><RiskPill level={forecastData?.heatwave_risk} /></div><div className="flex h-2 gap-1">{['LOW', 'MODERATE', 'HIGH'].map((level) => <div key={level} className="flex-1 rounded-sm" style={{ background: riskStyles[level].line, opacity: ['LOW', 'MODERATE', 'HIGH'].indexOf(forecastData?.heatwave_risk ?? 'LOW') >= ['LOW', 'MODERATE', 'HIGH'].indexOf(level) ? 1 : .2 }} />)}</div></div>
                  <div className="mt-5 flex items-center gap-2 border-t border-[hsl(var(--border))] pt-4 text-xs text-[hsl(var(--muted-foreground))]"><ArrowDownRight size={14} className="text-[#668839]" /> Plan around the forecast peak, not the average.</div>
                </article>
              </section>

              <section className="mt-7 grid gap-4 lg:grid-cols-[1.1fr_.9fr]" data-testid="section-early-warning">
                <article className={`rounded-xl border p-5 shadow-[var(--shadow-sm)] sm:p-6 ${warning?.active ? 'border-[#d9876b]/45 bg-[#f6c18c]/15' : 'border-[hsl(var(--card-border))] bg-[hsl(var(--card))]'}`}>
                  <SectionLabel eyebrow="04 / action signal" title="Early warning" action={warning?.active ? <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e89a75]/35 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-[#7d3e1f]"><Zap size={11} /> active</span> : <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#668839]">no active warning</span>} />
                  <div className="flex gap-4"><div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e89a75]/35 text-[#a4512d]"><AlertTriangle size={18} /></div><div><h3 className="font-display text-lg font-semibold">{warning?.title ?? 'No warning signal returned'}</h3><p className="mt-1 max-w-[680px] text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">{warning?.message ?? 'The provider did not return additional guidance for this forecast window.'}</p>{warning?.action && <div className="mt-4 rounded-md border-l-2 border-[#d9783c] bg-[hsl(var(--card)/.7)] px-3 py-2 text-sm font-medium">{warning.action}</div>}</div></div>
                </article>
                <article className="rounded-xl border border-[hsl(var(--card-border))] bg-[hsl(var(--card))] p-5 shadow-[var(--shadow-sm)] sm:p-6">
                  <SectionLabel eyebrow="model note" title="Read the signal correctly" />
                  <p className="text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">HTSI combines the live observation with heat-relevant atmospheric conditions to create a human-readable operational signal. It is a <strong className="font-semibold text-[hsl(var(--foreground))]">prototype HTSI model</strong>, not an official medical, government, or AI prediction.</p>
                  <div className="mt-4 flex flex-wrap gap-2"><span className="rounded-md bg-[hsl(var(--muted))] px-2.5 py-1.5 font-mono text-[10px]">temperature</span><span className="rounded-md bg-[hsl(var(--muted))] px-2.5 py-1.5 font-mono text-[10px]">humidity</span><span className="rounded-md bg-[hsl(var(--muted))] px-2.5 py-1.5 font-mono text-[10px]">wind</span><span className="rounded-md bg-[hsl(var(--muted))] px-2.5 py-1.5 font-mono text-[10px]">solar load</span></div>
                </article>
              </section>

              <section id="location" className="mt-7 grid gap-4 lg:grid-cols-[1.05fr_.95fr]">
                <article className="rounded-xl border border-[hsl(var(--card-border))] bg-[hsl(var(--card))] p-5 shadow-[var(--shadow-sm)] sm:p-6">
                  <SectionLabel eyebrow="05 / spatial context" title="Location context" action={<span className="font-mono text-[10px] text-[hsl(var(--muted-foreground))]">coordinates resolved</span>} />
                  <MapPanel city={city} htsiValue={htsi?.value} riskLevel={htsi?.risk_level} temperature={weather?.temperature_c} />
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] text-[hsl(var(--muted-foreground))]"><span>{coordinates}</span><a href={`https://www.openstreetmap.org/?mlat=${city.lat}&mlon=${city.lon}#map=10/${city.lat}/${city.lon}`} target="_blank" rel="noreferrer" className="underline decoration-[hsl(var(--border))] underline-offset-2 hover:text-[hsl(var(--foreground))]" data-testid="link-open-map">open full map</a></div>
                </article>
                <article className="rounded-xl border border-[hsl(var(--card-border))] bg-[hsl(var(--card))] p-5 shadow-[var(--shadow-sm)] sm:p-6">
                  <SectionLabel eyebrow="06 / provenance" title="Data & methodology" />
                  <div className="space-y-0">
                    <div className="flex gap-3 border-b border-[hsl(var(--border))] py-3 first:pt-0"><div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[hsl(var(--muted))]"><Satellite size={14} /></div><div><div className="font-display text-sm font-semibold">Open-Meteo</div><div className="mt-0.5 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">Live observed weather inputs and hourly forecast feed.</div></div></div>
                    <div className="flex gap-3 border-b border-[hsl(var(--border))] py-3"><div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[hsl(var(--muted))]"><Activity size={14} /></div><div><div className="font-display text-sm font-semibold">Prototype HTSI model</div><div className="mt-0.5 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">{current.data.calculation || 'Calculated from the current weather snapshot.'}</div></div></div>
                    <div className="flex gap-3 py-3 last:pb-0"><div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[hsl(var(--muted))]"><CloudSun size={14} /></div><div><div className="font-display text-sm font-semibold">Weather-provider forecast</div><div className="mt-0.5 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">{forecastData?.calculation || 'Hourly conditions translated into a 24-hour HTSI view.'}</div></div></div>
                  </div>
                  <div className="mt-4 rounded-md bg-[hsl(var(--muted)/.65)] px-3 py-2 font-mono text-[9px] leading-relaxed text-[hsl(var(--muted-foreground))]">This tool supports situational awareness. It does not provide official medical advice, government alerts, or certified AI predictions.</div>
                </article>
              </section>
            </>
          )}
        </main>

        <footer className="border-t border-[hsl(var(--border))] px-4 py-5 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-[1500px] flex-col justify-between gap-2 font-mono text-[9px] uppercase tracking-[0.1em] text-[hsl(var(--muted-foreground))] sm:flex-row"><span>HTSI Early Warning System · live operations interface</span><span>sources: Open-Meteo · OpenStreetMap</span></div>
        </footer>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-20 flex h-14 items-center justify-around border-t border-[hsl(var(--border))] bg-[hsl(var(--card)/.96)] px-3 backdrop-blur-md md:hidden">
        <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex flex-col items-center gap-1 text-[hsl(var(--foreground))]" data-testid="mobile-nav-monitoring"><Gauge size={17} /><span className="font-mono text-[9px] uppercase">monitor</span></button>
        <button type="button" onClick={() => document.getElementById('forecast')?.scrollIntoView({ behavior: 'smooth' })} className="flex flex-col items-center gap-1 text-[hsl(var(--muted-foreground))]" data-testid="mobile-nav-forecast"><Satellite size={17} /><span className="font-mono text-[9px] uppercase">forecast</span></button>
        <button type="button" onClick={() => document.getElementById('location')?.scrollIntoView({ behavior: 'smooth' })} className="flex flex-col items-center gap-1 text-[hsl(var(--muted-foreground))]" data-testid="mobile-nav-location"><MapPin size={17} /><span className="font-mono text-[9px] uppercase">location</span></button>
      </nav>
    </div>
  );
}