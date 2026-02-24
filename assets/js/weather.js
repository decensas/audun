const GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const LOCATIONS = {
  tonsberg: "Tønsberg",
  lierskogen: "Lierskogen"
};

const statusEl = document.getElementById("weather-status");
const bodyEl = document.getElementById("weather-body");
const refreshButton = document.getElementById("refresh-weather");
const locationSelect = document.getElementById("weather-location");
const titleEl = document.getElementById("weather-title");

const weatherDescriptions = {
  0: "Klar himmel",
  1: "For det meste klart",
  2: "Delvis skyet",
  3: "Overskyet",
  45: "Tåke",
  48: "Rimtåke",
  51: "Lett yr",
  53: "Moderat yr",
  55: "Kraftig yr",
  56: "Lett yr (frysende)",
  57: "Kraftig yr (frysende)",
  61: "Lett regn",
  63: "Moderat regn",
  65: "Kraftig regn",
  66: "Lett underkjølt regn",
  67: "Kraftig underkjølt regn",
  71: "Lett snø",
  73: "Moderat snø",
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

function formatDate(dateString) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("nb-NO", {
    weekday: "short",
    day: "2-digit",
    month: "short"
  }).format(date);
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("is-error", isError);
}

function clearTable() {
  bodyEl.innerHTML = "";
}

function getSelectedLocationName() {
  if (!locationSelect) {
    return LOCATIONS.tonsberg;
  }
  return LOCATIONS[locationSelect.value] || LOCATIONS.tonsberg;
}

function updateTitle(locationName) {
  if (titleEl) {
    titleEl.textContent = `Vær for ${locationName}`;
  }
}

function addRow(day) {
  const row = document.createElement("tr");
  row.innerHTML = `
    <td>${formatDate(day.date)}</td>
    <td>${day.description}</td>
    <td>${day.max}&deg;</td>
    <td>${day.min}&deg;</td>
    <td>${day.precip} mm</td>
  `;
  bodyEl.appendChild(row);
}

async function fetchWeather() {
  const locationName = getSelectedLocationName();
  updateTitle(locationName);
  setStatus("Henter værdata...");
  clearTable();

  try {
    const geoResponse = await fetch(
      `${GEO_URL}?name=${encodeURIComponent(locationName)}&count=1&language=nb&countryCode=NO`
    );
    const geoData = await geoResponse.json();

    if (!geoData.results || geoData.results.length === 0) {
      setStatus(`Fant ingen lokasjon for ${locationName}.`, true);
      return;
    }

    const { latitude, longitude } = geoData.results[0];
    const forecastResponse = await fetch(
      `${FORECAST_URL}?latitude=${latitude}&longitude=${longitude}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=Europe/Oslo&forecast_days=8`
    );
    const forecast = await forecastResponse.json();

    const days = forecast.daily.time.map((date, index) => ({
      date,
      max: Math.round(forecast.daily.temperature_2m_max[index]),
      min: Math.round(forecast.daily.temperature_2m_min[index]),
      precip: forecast.daily.precipitation_sum[index].toFixed(1),
      description: weatherDescriptions[forecast.daily.weather_code[index]] || "Ukjent"
    }));

    days.forEach(addRow);
    setStatus("Sist oppdatert: " + new Date().toLocaleString("nb-NO"));
  } catch (error) {
    console.error(error);
    setStatus("Kunne ikke hente værdata akkurat nå.", true);
  }
}

if (refreshButton) {
  refreshButton.addEventListener("click", fetchWeather);
}
if (locationSelect) {
  locationSelect.addEventListener("change", fetchWeather);
}

fetchWeather();
