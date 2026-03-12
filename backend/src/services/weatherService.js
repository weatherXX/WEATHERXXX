const axios = require("axios");
const BASE = "https://api.openweathermap.org";
const KEY = process.env.OPENWEATHER_API_KEY;

async function getByCity(city) {
  const r = await axios.get(BASE + "/data/2.5/weather", {
    params: { q: city, appid: KEY, units: "metric" }
  });
  return r.data;
}

async function getByCoords(lat, lon) {
  const r = await axios.get(BASE + "/data/2.5/weather", {
    params: { lat, lon, appid: KEY, units: "metric" }
  });
  return r.data;
}

async function getForecast(lat, lon) {
  const r = await axios.get(BASE + "/data/2.5/forecast", {
    params: { lat, lon, appid: KEY, units: "metric", cnt: 40 }
  });
  return r.data;
}

async function getAirPollution(lat, lon) {
  const r = await axios.get(BASE + "/data/2.5/air_pollution", {
    params: { lat, lon, appid: KEY }
  });
  return r.data;
}

module.exports = { getByCity, getByCoords, getForecast, getAirPollution };
