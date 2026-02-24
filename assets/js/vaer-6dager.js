const YR_URL = "https://api.met.no/weatherapi/locationforecast/2.0/compact";
const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";

const locations = {
  tonsberg: { id: "tonsberg", name: "Tønsberg", lat: 59.2675, lon: 10.4076 },
  lierskogen: { id: "lierskogen", name: "Lierskogen", lat: 59.79, lon: 10.315 }
};

const openMeteoDescriptions = {
  0: "Klar",
  1: "For det meste klart",
  2: "Delvis skyet",
  3: "Overskyet",
  45: "Tåke",
  48: "Rimtåke",
  51: "Lett yr",
  53: "Moderat yr",
  55: "Kraftig yr",
  56: "Frysende yr",
  57: "Kraftig frysende yr",
  61: "Lett regn",
  63: "Regn",
  65: "Kraftig regn",
  66: "Underkjølt regn",
  67: "Kraftig underkjølt regn",
  71: "Lett snø",
  73: "Snø",
  75: "Kraftig snø",
  77: "Snøkorn",
  80: "Lette regnbyger",
  81: "Regnbyger",
  82: "Kraftige regnbyger",
  85: "Lette snøbyger",
  86: "Kraftige snøbyger",
  95: "Tordenvær",
  96: "Tordenvær med hagl",
  99: "Kraftig tordenvær med hagl"
};

const statusEl = document.getElementById("status");
const refreshBtn = document.getElementById("refresh-btn");
const citySelect = document.getElementById("city-select");
const pageTitleEl = document.getElementById("page-title");
const yrTitleEl = document.getElementById("yr-title");
const openMeteoTitleEl = document.getElementById("openmeteo-title");
const yrBodyEl = document.getElementById("yr-body");
const openMeteoBodyEl = document.getElementById("openmeteo-body");

function formatDate(dateString) {
  return new Intl.DateTimeFormat("nb-NO", {
    weekday: "short",
    day: "2-digit",
    month: "short"
  }).format(new Date(dateString));
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

function getWeatherIconFromSymbol(symbolCode) {
  const code = (symbolCode || "").toLowerCase();
  if (code.includes("thunder")) return "⛈️";
  if (code.includes("snow")) return "❄️";
  if (code.includes("sleet")) return "🌨️";
  if (code.includes("rain")) return "🌧️";
  if (code.includes("fog")) return "🌫️";
  if (code.includes("cloudy")) return "☁️";
  if (code.includes("partlycloudy")) return "⛅";
  if (code.includes("clearsky") || code.includes("fair")) return "☀️";
  return "🌡️";
}

function mapOpenMeteoCodeToYrSymbol(code) {
  if (code === 0) return "clearsky_day";
  if (code === 1) return "fair_day";
  if (code === 2) return "partlycloudy_day";
  if (code === 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if (code === 51 || code === 53 || code === 55) return "lightrain";
  if (code === 56 || code === 57) return "sleet";
  if (code === 61) return "lightrain";
  if (code === 63) return "rain";
  if (code === 65 || code === 66 || code === 67) return "heavyrain";
  if (code === 71) return "lightsnow";
  if (code === 73 || code === 77) return "snow";
  if (code === 75) return "heavysnow";
  if (code === 80) return "rainshowers_day";
  if (code === 81 || code === 82) return "heavyrainshowers_day";
  if (code === 85 || code === 86) return "snowshowers_day";
  if (code === 95) return "thunderstorm";
  if (code === 96 || code === 99) return "heavysleetandthunder";
  return "cloudy";
}

function getYrDescription(symbolCode) {
  const code = (symbolCode || "").toLowerCase();
  if (code.includes("thunder")) return "Tordenvær";
  if (code.includes("heavysnow")) return "Kraftig snø";
  if (code.includes("snow")) return "Snø";
  if (code.includes("sleet")) return "Sludd";
  if (code.includes("heavyrain")) return "Kraftig regn";
  if (code.includes("rain")) return "Regn";
  if (code.includes("fog")) return "Tåke";
  if (code.includes("cloudy")) return "Overskyet";
  if (code.includes("partlycloudy")) return "Delvis skyet";
  if (code.includes("clearsky")) return "Klarvær";
  if (code.includes("fair")) return "Lettskyet";
  return "Ukjent";
}

function getLocalDateKey(isoTime) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(isoTime));
}

function aggregateDailyFromYr(timeseries) {
  const byDay = new Map();

  for (const point of timeseries) {
    const key = getLocalDateKey(point.time);
    const details = point.data.instant.details;
    const next1 = point.data.next_1_hours;
    const next6 = point.data.next_6_hours;
    const next12 = point.data.next_12_hours;
    const hourUtc = new Date(point.time).getUTCHours();

    let precip = 0;
    if (next1?.details?.precipitation_amount != null) {
      precip = next1.details.precipitation_amount;
    } else if (next6?.details?.precipitation_amount != null && hourUtc % 6 === 0) {
      precip = next6.details.precipitation_amount;
    } else if (next12?.details?.precipitation_amount != null && hourUtc % 12 === 0) {
      precip = next12.details.precipitation_amount;
    }

    const symbolCode =
      next1?.summary?.symbol_code ||
      next6?.summary?.symbol_code ||
      next12?.summary?.symbol_code ||
      "";
    const temp = details.air_temperature;

    if (!byDay.has(key)) {
      byDay.set(key, {
        date: key,
        min: temp,
        max: temp,
        precip: 0,
        description: getYrDescription(symbolCode),
        symbolCode: symbolCode || "cloudy"
      });
      continue;
    }

    const day = byDay.get(key);
    day.min = Math.min(day.min, temp);
    day.max = Math.max(day.max, temp);
    day.precip += precip;
  }

  return Array.from(byDay.values()).slice(0, 6);
}

function mapOpenMeteoDays(daily) {
  return daily.time.map((date, index) => {
    const code = daily.weather_code[index];
    const description = openMeteoDescriptions[code] || "Ukjent";
    return {
      date,
      min: daily.temperature_2m_min[index],
      max: daily.temperature_2m_max[index],
      precip: daily.precipitation_sum[index],
      description,
      symbolCode: mapOpenMeteoCodeToYrSymbol(code)
    };
  }).slice(0, 6);
}

function renderRows(targetBodyEl, days) {
  targetBodyEl.innerHTML = "";

  for (const day of days) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${formatDate(day.date)}</td>
      <td><span class="weather-icon" aria-hidden="true">${getWeatherIconFromSymbol(day.symbolCode)}</span> ${day.description}</td>
      <td>${Math.round(day.max)}°C</td>
      <td>${Math.round(day.min)}°C</td>
      <td>${Number(day.precip).toFixed(1)} mm</td>
    `;
    targetBodyEl.appendChild(row);
  }
}

async function fetchYrDaily(location) {
  const url = `${YR_URL}?lat=${location.lat}&lon=${location.lon}`;
  const response = await fetch(url, {
    headers: { "User-Agent": "decens-weather-compare/1.0" }
  });
  if (!response.ok) {
    throw new Error(`Yr-feil (${response.status})`);
  }
  const data = await response.json();
  return aggregateDailyFromYr(data.properties?.timeseries || []);
}

async function fetchOpenMeteoDaily(location) {
  const url = `${OPEN_METEO_URL}?latitude=${location.lat}&longitude=${location.lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=Europe/Oslo&forecast_days=6`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Open-Meteo-feil (${response.status})`);
  }
  const data = await response.json();
  return mapOpenMeteoDays(data.daily);
}

function getSelectedLocation() {
  const selectedId = citySelect ? citySelect.value : "lierskogen";
  return locations[selectedId] || locations.lierskogen;
}

function updateTitles(location) {
  pageTitleEl.textContent = location.name;
  yrTitleEl.textContent = `Yr.no (MET) - ${location.name}`;
  openMeteoTitleEl.textContent = `Weather.js (Open-Meteo) - ${location.name}`;
}

function clearTables() {
  yrBodyEl.innerHTML = "";
  openMeteoBodyEl.innerHTML = "";
}

async function loadForecastComparison() {
  const selectedLocation = getSelectedLocation();
  updateTitles(selectedLocation);
  clearTables();
  setStatus("Henter værdata fra begge kilder...");

  const [yrResult, openMeteoResult] = await Promise.allSettled([
    fetchYrDaily(selectedLocation),
    fetchOpenMeteoDaily(selectedLocation)
  ]);

  let okCount = 0;

  if (yrResult.status === "fulfilled") {
    renderRows(yrBodyEl, yrResult.value);
    okCount += 1;
  } else {
    yrBodyEl.innerHTML = `<tr><td colspan="5">Kunne ikke hente data fra Yr.no.</td></tr>`;
  }

  if (openMeteoResult.status === "fulfilled") {
    renderRows(openMeteoBodyEl, openMeteoResult.value);
    okCount += 1;
  } else {
    openMeteoBodyEl.innerHTML = `<tr><td colspan="5">Kunne ikke hente data fra Open-Meteo.</td></tr>`;
  }

  if (okCount === 2) {
    setStatus(`Sist oppdatert: ${new Date().toLocaleString("nb-NO")}`);
  } else if (okCount === 1) {
    setStatus("Kun én kilde svarte akkurat nå. Prøv oppdater igjen.", true);
  } else {
    setStatus("Ingen av kildene svarte akkurat nå.", true);
  }
}

refreshBtn.addEventListener("click", loadForecastComparison);
if (citySelect) {
  citySelect.addEventListener("change", loadForecastComparison);
}
loadForecastComparison();
