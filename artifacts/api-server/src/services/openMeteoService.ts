import { calculateHtsi, type HtsiInputs } from "../htsi/calculator";

const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";
const SOURCE = "Open-Meteo";

type ProviderResponse = {
  latitude: number;
  longitude: number;
  timezone: string;
  current?: {
    time?: string;
    temperature_2m?: number;
    relative_humidity_2m?: number;
    wind_speed_10m?: number;
    surface_pressure?: number;
    shortwave_radiation?: number;
    weather_code?: number;
    cloud_cover?: number;
  };
  hourly?: {
    time?: string[];
    temperature_2m?: number[];
    relative_humidity_2m?: number[];
    wind_speed_10m?: number[];
    surface_pressure?: number[];
    shortwave_radiation?: number[];
    weather_code?: number[];
    cloud_cover?: number[];
  };
};

export type WeatherSnapshot = {
  temperature_c: number;
  relative_humidity_pct: number;
  wind_speed_ms: number;
  pressure_hpa: number;
  solar_radiation_wm2: number;
  cloud_cover_pct: number;
  weather_code: number;
  weather_label: string;
};

export type WeatherPoint = {
  timestamp: string;
  weather: WeatherSnapshot;
  htsi: ReturnType<typeof calculateHtsi>;
};

export type WeatherPayload = {
  location: {
    latitude: number;
    longitude: number;
    timezone: string;
  };
  timestamp: string;
  source: string;
  calculation: string;
  weather: WeatherSnapshot;
  htsi: ReturnType<typeof calculateHtsi>;
};

export type ForecastPayload = {
  location: WeatherPayload["location"];
  generated_at: string;
  source: string;
  calculation: string;
  points: WeatherPoint[];
  peak: WeatherPoint;
  warning: {
    active: boolean;
    title: string;
    message: string;
    action: string;
    peak_value: number;
    peak_timestamp: string;
    peak_window: string;
  };
  heatwave_risk: "LOW" | "MODERATE" | "HIGH";
};

function finiteNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Open-Meteo returned missing ${field}`);
  }
  return value;
}

function weatherLabel(code: number): string {
  if (code === 0) return "Clear sky";
  if ([1, 2].includes(code)) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if ([45, 48].includes(code)) return "Fog";
  if ([51, 53, 55, 56, 57].includes(code)) return "Drizzle";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "Rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Snow";
  if ([95, 96, 99].includes(code)) return "Thunderstorm";
  return "Weather observed";
}

function snapshotFromValues(values: {
  temperature: unknown;
  humidity: unknown;
  wind: unknown;
  pressure: unknown;
  solar: unknown;
  cloud: unknown;
  code: unknown;
}): WeatherSnapshot {
  const code = finiteNumber(values.code, "weather code");
  return {
    temperature_c: finiteNumber(values.temperature, "temperature"),
    relative_humidity_pct: finiteNumber(values.humidity, "relative humidity"),
    wind_speed_ms: finiteNumber(values.wind, "wind speed"),
    pressure_hpa: finiteNumber(values.pressure, "surface pressure"),
    solar_radiation_wm2: finiteNumber(values.solar, "solar radiation"),
    cloud_cover_pct: finiteNumber(values.cloud, "cloud cover"),
    weather_code: Math.round(code),
    weather_label: weatherLabel(Math.round(code)),
  };
}

function htsiFor(weather: WeatherSnapshot) {
  const inputs: HtsiInputs = {
    temperature_c: weather.temperature_c,
    relative_humidity_pct: weather.relative_humidity_pct,
    wind_speed_ms: weather.wind_speed_ms,
    solar_radiation_wm2: weather.solar_radiation_wm2,
  };
  return calculateHtsi(inputs);
}

async function requestWeather(
  latitude: number,
  longitude: number,
): Promise<ProviderResponse> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current:
      "temperature_2m,relative_humidity_2m,wind_speed_10m,surface_pressure,shortwave_radiation,weather_code,cloud_cover",
    hourly:
      "temperature_2m,relative_humidity_2m,wind_speed_10m,surface_pressure,shortwave_radiation,weather_code,cloud_cover",
    temperature_unit: "celsius",
    wind_speed_unit: "ms",
    pressure_unit: "hPa",
    timezone: "auto",
    forecast_days: "2",
  });

  const response = await fetch(`${OPEN_METEO_URL}?${params.toString()}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) {
    throw new Error(`Open-Meteo returned ${response.status}`);
  }

  return (await response.json()) as ProviderResponse;
}

function requireCurrent(data: ProviderResponse) {
  if (!data.current || !data.timezone) {
    throw new Error("Open-Meteo returned incomplete current data");
  }
  return data.current;
}

export async function getCurrentWeather(
  latitude: number,
  longitude: number,
): Promise<WeatherPayload> {
  const data = await requestWeather(latitude, longitude);
  const current = requireCurrent(data);
  const weather = snapshotFromValues({
    temperature: current.temperature_2m,
    humidity: current.relative_humidity_2m,
    wind: current.wind_speed_10m,
    pressure: current.surface_pressure,
    solar: current.shortwave_radiation,
    cloud: current.cloud_cover,
    code: current.weather_code,
  });

  return {
    location: {
      latitude: finiteNumber(data.latitude, "latitude"),
      longitude: finiteNumber(data.longitude, "longitude"),
      timezone: data.timezone,
    },
    timestamp: current.time ?? new Date().toISOString(),
    source: SOURCE,
    calculation: "Prototype HTSI model",
    weather,
    htsi: htsiFor(weather),
  };
}

export async function getForecastWeather(
  latitude: number,
  longitude: number,
): Promise<ForecastPayload> {
  const data = await requestWeather(latitude, longitude);
  const current = requireCurrent(data);
  const hourly = data.hourly;
  if (
    !hourly?.time ||
    !hourly.temperature_2m ||
    !hourly.relative_humidity_2m ||
    !hourly.wind_speed_10m ||
    !hourly.surface_pressure ||
    !hourly.shortwave_radiation ||
    !hourly.weather_code ||
    !hourly.cloud_cover
  ) {
    throw new Error("Open-Meteo returned incomplete hourly data");
  }
  const times = hourly.time;

  const startIndex = Math.max(
    0,
    times.findIndex((time) => time >= (current.time ?? times[0])),
  );
  const points: WeatherPoint[] = [];
  for (let index = startIndex; index < Math.min(startIndex + 24, times.length); index += 1) {
    const weather = snapshotFromValues({
      temperature: hourly.temperature_2m[index],
      humidity: hourly.relative_humidity_2m[index],
      wind: hourly.wind_speed_10m[index],
      pressure: hourly.surface_pressure[index],
      solar: hourly.shortwave_radiation[index],
      cloud: hourly.cloud_cover[index],
      code: hourly.weather_code[index],
    });
    points.push({
      timestamp: times[index],
      weather,
      htsi: htsiFor(weather),
    });
  }

  if (points.length === 0) throw new Error("Open-Meteo returned no forecast points");

  const peak = points.reduce((highest, point) =>
    point.htsi.value > highest.htsi.value ? point : highest,
  );
  const atRisk = points.filter((point) => point.htsi.value >= 65);
  const warningActive = atRisk.length > 0;
  const firstRisk = atRisk[0];
  const lastRisk = atRisk[atRisk.length - 1];
  const warning = {
    active: warningActive,
    title: warningActive ? "Early warning" : "No significant warning",
    message: warningActive
      ? "Elevated thermal stress is expected in the next 24 hours."
      : "No significant thermal stress warning is expected within the next 24 hours.",
    action: warningActive
      ? "Avoid prolonged outdoor exposure during the peak heat period."
      : "Continue monitoring conditions as the forecast updates.",
    peak_value: peak.htsi.value,
    peak_timestamp: peak.timestamp,
    peak_window:
      firstRisk && lastRisk
        ? `${firstRisk.timestamp} – ${lastRisk.timestamp}`
        : peak.timestamp,
  };
  const highPeriods = points.filter((point) => point.htsi.value >= 65).length;
  const heatwaveRisk =
    highPeriods >= 8 ? "HIGH" : highPeriods >= 3 ? "MODERATE" : "LOW";

  return {
    location: {
      latitude: finiteNumber(data.latitude, "latitude"),
      longitude: finiteNumber(data.longitude, "longitude"),
      timezone: data.timezone,
    },
    generated_at: new Date().toISOString(),
    source: SOURCE,
    calculation: "Prototype HTSI model",
    points,
    peak,
    warning,
    heatwave_risk: heatwaveRisk,
  };
}