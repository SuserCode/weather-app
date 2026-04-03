const UI = {
  weatherCard: document.getElementById("current-weather"),
  mainIcon: document.getElementById("weather-main-icon"),
  weatherForecast: document.getElementById("weather-forecast"),
  currentWeatherMetaData: document.getElementById("current-weather-meta-data"),
  metaData: document.getElementById("meta-data"),
  url: "https://api.open-meteo.com/v1/forecast",
};

let data = {};
let abortController;

// ==========================
// 📍 Get User Location
// ==========================

// Ask for user's location with better error handling and options
function getCurrentLocation(options = {}) {
  const defaultOptions = {
    enableHighAccuracy: true, // Use GPS if available for better accuracy
    timeout: 10000, // 10 seconds timeout
    maximumAge: 0, // Don't use cached location
    ...options,
  };
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by this browser."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      },
      (err) => {
        // 🔥 Better error handling
        switch (err.code) {
          case err.PERMISSION_DENIED:
            reject(new Error("User denied Geolocation"));
            break;
          case err.POSITION_UNAVAILABLE:
            reject(new Error("Location information unavailable"));
            break;
          case err.TIMEOUT:
            reject(new Error("Location request timed out"));
            break;
          default:
            reject(new Error("Unknown geolocation error"));
        }
      },
      defaultOptions,
    );
  });
}

// ==========================
// 🌤️ Weather Icon Logic
// ==========================
function getIconByWeatherState(day, isCurrent = false) {
  if (!data?.daily || !data?.current) {
    return "assets/cloudy.png";
  }

  // ✅ Use weathercode if available (better accuracy)
  const code = isCurrent
    ? data.current.weathercode
    : data.daily.weathercode?.[day];

  if (code !== undefined) {
    if (code >= 61) return "assets/heavy-rain.png"; // rain
    if (code >= 51) return "assets/light-rain.png";
    if (code === 0) return "assets/sun.png";
    if (code <= 3) return "assets/partly-cloudy.png";
  }

  // fallback logic
  let precip = 0;
  let temp = 0;

  if (!isCurrent) {
    precip = data.daily.precipitation_sum[day];
    temp = data.daily.temperature_2m_max[day];
  } else {
    temp = data.current.temperature_2m;
  }

  if (precip > 10) return "assets/heavy-rain.png";
  if (precip > 0) return "assets/light-rain.png";
  if (temp > 25) return "assets/sun.png";
  if (temp > 15) return "assets/partly-cloudy.png";

  return "assets/cloudy.png";
}

// ==========================
// 🔗 URL Builder
// ==========================
function urlBuilder(params) {
  const url = new URL(UI.url);

  url.searchParams.set("latitude", params.latitude);
  url.searchParams.set("longitude", params.longitude);
  url.searchParams.set(
    "current",
    "temperature_2m,relative_humidity_2m,wind_speed_10m,weathercode",
  );
  url.searchParams.set(
    "daily",
    "temperature_2m_min,temperature_2m_max,precipitation_sum,weathercode",
  );
  url.searchParams.set("timezone", "auto");

  return url.toString();
}

// ==========================
// 🌐 Fetch Weather
// ==========================
function fetchWeatherData(lat, lon) {
  if (abortController) abortController.abort();

  abortController = new AbortController();

  return apiFetchJSON(
    urlBuilder({ latitude: lat, longitude: lon }),
    abortController.signal,
  );
}

async function apiFetchJSON(url, signal) {
  const res = await fetch(url, { signal });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  return res.json();
}

// ==========================
// 🎨 Render UI
// ==========================
function render() {
  renderCurrentWeather();
  renderForecast();
}

// ==========================
// 🌡️ Current Weather
// ==========================
function renderCurrentWeather() {
  if (!data?.current) return;

  UI.mainIcon.src = getIconByWeatherState(0, true);
  UI.mainIcon.alt = "Current weather icon";

  const { temperature_2m, relative_humidity_2m, wind_speed_10m } = data.current;

  UI.currentWeatherMetaData.innerHTML = `
    <div class="current-weather">
      <h3 class="current-weather__temp">${temperature_2m}°C</h3>
      <p class="current-weather__details">
        Humidity: ${relative_humidity_2m}% | Wind: ${wind_speed_10m} km/h
      </p>
    </div>
  `;
}

// ==========================
// 📅 Forecast (7 days max)
// ==========================
function renderForecast() {
  if (!data?.daily) return;

  UI.weatherForecast.innerHTML = data.daily.time
    .slice(0, 7)
    .map((day, index) => {
      return `
        <div class="forecast-day">
          <h4 class="forecast-day__name">${getDayName(day)}</h4>
          <span class="forecast-day__temp">
            ${data.daily.temperature_2m_min[index]}°C /
            ${data.daily.temperature_2m_max[index]}°C
          </span>
          <div class="forecast-day__icon">
            <img src="${getIconByWeatherState(index)}"
                 alt="Weather condition"
                 class="forecast-day__image" />
          </div>
        </div>
      `;
    })
    .join("");
}

// ==========================
// 📆 Day Name
// ==========================
function getDayName(dateString) {
  return new Date(dateString).toLocaleDateString("en-US", {
    weekday: "short",
  });
}

// ==========================
// ℹ️ Metadata
// ==========================
function updateMetadata(data) {
  const updateTime = new Date(data.current.time).toLocaleString();

  UI.metaData.innerHTML = `
    <span>📍 ${data.timezone}</span>
    <span>🕐 Updated: ${updateTime}</span>
    <span>⛰️ Elevation: ${data.elevation}m</span>
  `;
}

// ==========================
// 🚀 Init
// ==========================
(async function init() {
  try {
    UI.metaData.textContent = "Loading weather...";

    const loc = await getCurrentLocation();

    data = await fetchWeatherData(loc.latitude, loc.longitude);

    updateMetadata(data);
    render();
  } catch (err) {
    if (err.name === "AbortError") return;

    console.error(err);
    console.error("error fetching weather data:", err.message);
    UI.metaData.textContent = "⚠️ Failed to load weather.";
  }
})();
