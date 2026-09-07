import { Router, type IRouter } from "express";
import {
  GetWeatherCurrentQueryParams,
  GetWeatherCurrentResponse,
  GetWeatherForecastQueryParams,
  GetWeatherForecastResponse,
} from "@workspace/api-zod";
import {
  getCurrentWeather,
  getForecastWeather,
} from "../services/openMeteoService";

const router: IRouter = Router();

function queryError(res: Parameters<Parameters<IRouter["get"]>[1]>[1]) {
  res.status(400).json({ error: "Latitude and longitude must be valid coordinates." });
}

router.get("/weather/current", async (req, res) => {
  const parsed = GetWeatherCurrentQueryParams.safeParse(req.query);
  if (!parsed.success) {
    queryError(res);
    return;
  }

  try {
    const result = await getCurrentWeather(parsed.data.lat, parsed.data.lon);
    res.json(GetWeatherCurrentResponse.parse(result));
  } catch (error) {
    req.log.error({ err: error }, "Current weather provider request failed");
    res.status(502).json({ error: "Weather update unavailable." });
  }
});

router.get("/weather/forecast", async (req, res) => {
  const parsed = GetWeatherForecastQueryParams.safeParse(req.query);
  if (!parsed.success) {
    queryError(res);
    return;
  }

  try {
    const result = await getForecastWeather(parsed.data.lat, parsed.data.lon);
    res.json(GetWeatherForecastResponse.parse(result));
  } catch (error) {
    req.log.error({ err: error }, "Forecast provider request failed");
    res.status(502).json({ error: "Forecast update unavailable." });
  }
});

export default router;