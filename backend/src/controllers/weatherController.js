const svc = require("../services/weatherService");

async function getAll(req, res) {
  try {
    const { city, lat, lon } = req.query;
    const current = city
      ? await svc.getByCity(city)
      : await svc.getByCoords(parseFloat(lat), parseFloat(lon));
    const { lat: la, lon: lo } = current.coord;
    const [forecast, air] = await Promise.all([
      svc.getForecast(la, lo),
      svc.getAirPollution(la, lo),
    ]);
    res.json({ current, forecast, air });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { getAll };
