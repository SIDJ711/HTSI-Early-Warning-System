import { HTSI_CONFIG, type HtsiRiskLevel } from "./config";

export type HtsiInputs = {
  temperature_c: number;
  relative_humidity_pct: number;
  wind_speed_ms: number;
  solar_radiation_wm2: number;
};

export type HtsiAssessment = {
  value: number;
  risk_level: HtsiRiskLevel;
  risk_color: string;
  description: string;
};

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function scale(value: number, min: number, max: number): number {
  return clamp((value - min) / (max - min));
}

function describeRisk(level: HtsiRiskLevel): string {
  switch (level) {
    case "LOW":
      return "Thermal stress is limited under current conditions.";
    case "MODERATE":
      return "Heat exposure may become uncomfortable, especially during exertion.";
    case "HIGH":
      return "Heat stress conditions are elevated. Reduce prolonged outdoor exposure.";
    case "VERY_HIGH":
      return "Very high thermal stress is expected. Schedule strenuous activity carefully.";
    case "EXTREME":
      return "Extreme thermal stress conditions. Avoid prolonged outdoor exposure.";
  }
}

export function calculateHtsi(inputs: HtsiInputs): HtsiAssessment {
  const temperatureScore = scale(
    inputs.temperature_c,
    HTSI_CONFIG.normalization.temperatureMinC,
    HTSI_CONFIG.normalization.temperatureMaxC,
  );
  const humidityScore = scale(
    inputs.relative_humidity_pct,
    HTSI_CONFIG.normalization.humidityMinPct,
    HTSI_CONFIG.normalization.humidityMaxPct,
  );
  const solarScore = clamp(
    inputs.solar_radiation_wm2 / HTSI_CONFIG.normalization.solarMaxWm2,
  );
  const windReliefScore =
    1 -
    clamp(inputs.wind_speed_ms / HTSI_CONFIG.normalization.windReliefMaxMs);

  const rawValue =
    (temperatureScore * HTSI_CONFIG.weights.temperature +
      humidityScore * HTSI_CONFIG.weights.humidity +
      solarScore * HTSI_CONFIG.weights.solarRadiation +
      windReliefScore * HTSI_CONFIG.weights.windRelief) *
    100;
  const value = Math.round(clamp(rawValue, 0, 100) * 10) / 10;
  const threshold =
    HTSI_CONFIG.thresholds.find((item) => value < item.max) ??
    HTSI_CONFIG.thresholds[HTSI_CONFIG.thresholds.length - 1];

  return {
    value,
    risk_level: threshold.level,
    risk_color: threshold.color,
    description: describeRisk(threshold.level),
  };
}