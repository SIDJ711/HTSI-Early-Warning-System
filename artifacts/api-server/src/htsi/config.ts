export const HTSI_CONFIG = {
  modelName: "Prototype HTSI model",
  highRiskThreshold: 65,
  thresholds: [
    { max: 25, level: "LOW", color: "#2dd4bf" },
    { max: 45, level: "MODERATE", color: "#facc15" },
    { max: 65, level: "HIGH", color: "#fb923c" },
    { max: 82, level: "VERY_HIGH", color: "#f87171" },
    { max: 100, level: "EXTREME", color: "#c084fc" },
  ] as const,
  weights: {
    temperature: 0.45,
    humidity: 0.2,
    solarRadiation: 0.2,
    windRelief: 0.15,
  },
  normalization: {
    temperatureMinC: 24,
    temperatureMaxC: 42,
    humidityMinPct: 35,
    humidityMaxPct: 90,
    solarMaxWm2: 900,
    windReliefMaxMs: 3,
  },
} as const;

export type HtsiRiskLevel =
  (typeof HTSI_CONFIG.thresholds)[number]["level"];