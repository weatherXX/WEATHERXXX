const express = require("express");
const rateLimit = require("express-rate-limit");
const axios = require("axios");
const cors = require("cors");
require("dotenv").config();

const app = express();
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many requests, please try again later." }
});
app.use(limiter);

app.use(cors({
  origin: [
    "https://weatherxxx.vercel.app",
    "http://localhost:3000"
  ]
}));

const OWM = process.env.OPENWEATHER_API_KEY;
const TMW = process.env.TOMORROW_API_KEY;

app.get("/api/weather/all", async (req, res) => {
  try {
    const { city, lat, lon } = req.query;
    const location = lat && lon ? `lat=${lat}&lon=${lon}` : `q=${encodeURIComponent(city)}`;

    const [currentRes, forecastRes] = await Promise.all([
      axios.get(`https://api.openweathermap.org/data/2.5/weather?${location}&appid=${OWM}&units=metric`,{timeout:8000}),
      axios.get(`https://api.openweathermap.org/data/2.5/forecast?${location}&appid=${OWM}&units=metric`,{timeout:8000}),
    ]);

    const clat = currentRes.data.coord.lat;
    const clon = currentRes.data.coord.lon;

    const airRes = await axios.get(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${clat}&lon=${clon}&appid=${OWM}`);

    // Tomorrow.io — UV + free fields
    let tomorrow = null;
    try {
      const fields = "uvIndex,uvHealthConcern,visibility,dewPoint,pressureSurfaceLevel";
      const tmRes = await axios.get(`https://api.tomorrow.io/v4/weather/realtime?location=${clat},${clon}&fields=${fields}&apikey=${TMW}&units=metric`);
      tomorrow = tmRes.data?.data?.values || null;
    } catch(e) {
      console.log("Tomorrow.io error:", e.response?.status || "unknown");
    }

    // Open-Meteo pollen (free, no key!)
    let pollen = null;
    try {
      const polRes = await axios.get(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${clat}&longitude=${clon}&hourly=alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,ragweed_pollen&forecast_days=1`);
      const h = polRes.data?.hourly;
      if (h) {
        const now = new Date().getHours();
        const getLevel = v => v === null ? "N/A" : v < 10 ? "None" : v < 30 ? "Low" : v < 90 ? "Moderate" : v < 300 ? "High" : "Very High";
        const tree = Math.max(...[h.alder_pollen?.[now] ?? 0, h.birch_pollen?.[now] ?? 0].filter(x => x !== null));
        pollen = {
          tree: getLevel(tree),
          grass: getLevel(h.grass_pollen?.[now] ?? null),
          ragweed: getLevel(h.ragweed_pollen?.[now] ?? null),
          mugwort: getLevel(h.mugwort_pollen?.[now] ?? null),
        };
      }
    } catch(e) {
      console.log("Pollen error:", e.message);
    }

    // Moonrise/moonset calculation
    function getMoonTimes(lat, lon, date) {
      const rad = Math.PI / 180;
      const d = new Date(date);
      const JD = Math.floor(365.25*(d.getFullYear()+4716)) + Math.floor(30.6001*(d.getMonth()+2)) + d.getDate() - 1524.5;
      const L = (218.316 + 13.176396 * (JD - 2451545)) % 360;
      const M = (134.963 + 13.064993 * (JD - 2451545)) % 360;
      const F = (93.272 + 13.229350 * (JD - 2451545)) % 360;
      const dec = Math.asin(Math.sin(F * rad) * Math.sin(23.45 * rad)) / rad;
      const cosH = (Math.sin(-0.833 * rad) - Math.sin(lat * rad) * Math.sin(dec * rad)) / (Math.cos(lat * rad) * Math.cos(dec * rad));
      if (Math.abs(cosH) > 1) return null;
      const H = Math.acos(cosH) / rad;
      const RA = (L + 6.289 * Math.sin(M * rad)) % 360;
      const transit = (RA - lon - (-360)) % 360 / 360 * 24;
      const rise = (transit - H / 15 + 24) % 24;
      const set = (transit + H / 15 + 24) % 24;
      const toTime = h => {
        const hrs = Math.floor(h);
        const mins = Math.round((h - hrs) * 60);
        const ampm = hrs >= 12 ? "PM" : "AM";
        return `${hrs % 12 || 12}:${mins.toString().padStart(2,"0")} ${ampm}`;
      };
      return { moonrise: toTime(rise), moonset: toTime(set) };
    }

    const moonTimes = getMoonTimes(clat, clon, new Date());

    res.json({
      current: currentRes.data,
      forecast: forecastRes.data,
      air: airRes.data,
      tomorrow,
      pollen,
      moonTimes
    });
  } catch(e) {
    res.json({ error: e.message });
  }
});

app.listen(process.env.PORT || 5000, () => console.log("Backend running on port 5000"));
