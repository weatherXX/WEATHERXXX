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
  origin: function(origin, callback) {
    const allowed = [
      "https://weatherxxx.vercel.app",
      "http://localhost:3000"
    ];
    if(!origin || allowed.some(a => origin.startsWith(a))) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  }
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

    // Moonrise/moonset calculation (improved)
    function getMoonTimes(lat, lon, tzOffset) {
      const rad = Math.PI / 180;
      const now = new Date();
      const localDate = new Date(now.getTime() + tzOffset * 1000);
      const year = localDate.getUTCFullYear();
      const month = localDate.getUTCMonth() + 1;
      const day = localDate.getUTCDate();
      const JD = 367*year - Math.floor(7*(year+Math.floor((month+9)/12))/4)
               + Math.floor(275*month/9) + day + 1721013.5;
      const T = (JD - 2451545.0) / 36525;
      const L0 = (218.3164477 + 481267.88123421*T) % 360;
      const M  = (357.5291092 + 35999.0502909*T) % 360;
      const Mm = (134.9633964 + 477198.8675055*T) % 360;
      const F  = (93.2720950 + 483202.0175233*T) % 360;
      const lon2 = L0 + 6.289*Math.sin(Mm*rad) - 1.274*Math.sin((2*F-Mm)*rad)
                 + 0.658*Math.sin(2*F*rad) - 0.186*Math.sin(M*rad);
      const B = 5.128*Math.sin(F*rad) + 0.280*Math.sin((Mm+F)*rad);
      const eps = 23.4393 - 0.0000004*T;
      const RA  = Math.atan2(Math.sin(lon2*rad)*Math.cos(eps*rad) - Math.tan(B*rad)*Math.sin(eps*rad), Math.cos(lon2*rad)) / rad;
      const dec = Math.asin(Math.sin(B*rad)*Math.cos(eps*rad) + Math.cos(B*rad)*Math.sin(eps*rad)*Math.sin(lon2*rad)) / rad;
      const cosH = (Math.sin(-0.833*rad) - Math.sin(lat*rad)*Math.sin(dec*rad)) / (Math.cos(lat*rad)*Math.cos(dec*rad));
      if (Math.abs(cosH) > 1) return { moonrise: "N/A", moonset: "N/A" };
      const H = Math.acos(cosH) / rad;
      const GMST = (280.46061837 + 360.98564736629*(JD-2451545)) % 360;
      const transit = ((((RA - lon - GMST) % 360) + 360) % 360) / 15;
      const riseUTC = (transit - H/15 + 24) % 24;
      const setUTC  = (transit + H/15 + 24) % 24;
      const offsetHrs = tzOffset / 3600;
      const riseLocal = (riseUTC + offsetHrs + 24) % 24;
      const setLocal  = (setUTC  + offsetHrs + 24) % 24;
      const toTime = h => {
        const hrs  = Math.floor(h);
        const mins = Math.round((h - hrs) * 60);
        const ampm = hrs >= 12 ? "PM" : "AM";
        return `${hrs % 12 || 12}:${mins.toString().padStart(2,"0")} ${ampm}`;
      };
      return { moonrise: toTime(riseLocal), moonset: toTime(setLocal) };
    }
    const moonTimes = getMoonTimes(clat, clon, currentRes.data.timezone);

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
