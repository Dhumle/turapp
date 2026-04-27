import { storage, defaultState, getActiveTrip } from './js/storage.js';
import { createMap, renderRoute, enableDraw, parseGpx, buildGpx, suggestSegments, estimateTime, renderNotes } from './js/map.js';
import { drawElevation, analyzeRoute } from './js/elevation.js';
import { fetchYr, weatherInsight } from './js/weather.js';
import { gearTotals } from './js/gear.js';
import { buildSafety } from './js/safety.js';
import { setTabs, renderList, priorityColor } from './js/ui.js';

const state = storage.load() || defaultState();
state.activeTripId ||= state.trips[0].id;

const mapCtx = createMap('map');
const el = {
  drawRoute: document.getElementById('draw-route'),
  editRoute: document.getElementById('edit-route'),
  gpxImport: document.getElementById('gpx-import'),
  gpxExport: document.getElementById('gpx-export'),
  autoSegment: document.getElementById('auto-segment'),
  segmentList: document.getElementById('segment-list'),
  elevationCanvas: document.getElementById('elevation-canvas'),
  elevationMeta: document.getElementById('elevation-meta'),
  gearForm: document.getElementById('gear-form'),
  gearList: document.getElementById('gear-list'),
  loadOutput: document.getElementById('load-output'),
  weatherLat: document.getElementById('weather-lat'),
  weatherLon: document.getElementById('weather-lon'),
  fetchWeather: document.getElementById('fetch-weather'),
  weatherSlider: document.getElementById('weather-slider'),
  weatherHourLabel: document.getElementById('weather-hour-label'),
  weatherNow: document.getElementById('weather-now'),
  weatherInsights: document.getElementById('weather-insights'),
  noteForm: document.getElementById('note-form'),
  notesList: document.getElementById('notes-list'),
  summaryToggle: document.getElementById('summary-toggle'),
  summaryContent: document.getElementById('summary-content'),
};

const uiState = { drawMode: false, editMode: false, summaryOpen: false };

function trip() { return getActiveTrip(state); }
function persist() { storage.save(state); render(); }

function render() {
  const t = trip();
  renderRoute(mapCtx, t.route.points, uiState.editMode, (idx, latlng, del = false) => {
    if (del) t.route.points.splice(idx, 1);
    else {
      t.route.points[idx].lat = latlng.lat;
      t.route.points[idx].lon = latlng.lng;
    }
    persist();
  });
  renderNotes(mapCtx, t.notes);
  drawElevation(el.elevationCanvas, t.route.points);
  const routeStats = analyzeRoute(t.route.points);
  el.elevationMeta.textContent = `Distance ${routeStats.distance.toFixed(1)} km · Elevation gain ${routeStats.gain.toFixed(0)} m`;

  const segments = summarizeSegments(t.route.points);
  renderList(el.segmentList, segments.map((s) => `<strong>${s.type}</strong>: ${s.count} points`));

  renderList(el.gearList, t.gear.map((g) => `${g.packed ? '✅' : '⬜'} ${g.name} (${g.weight}kg) ${g.mode}${g.critical ? ' · critical' : ''}`));
  const loads = gearTotals(t.gear, t.route.points);
  const loadWarn = loads.backpack > 20 ? '<p class="alert-high">Heavy backpack for carry terrain.</p>' : '';
  el.loadOutput.innerHTML = `<h3>Load distribution</h3><p>Backpack mode: <strong>${loads.backpack.toFixed(1)} kg</strong></p><p>Raft mode: <strong>${loads.raft.toFixed(1)} kg</strong></p>${loadWarn}`;

  renderWeather();
  renderList(el.notesList, t.notes.map((n) => `<span class="chip">${n.tag}</span> ${n.text}`));
  renderSummary();
}

function summarizeSegments(points) {
  const r = { paddle: 0, carry: 0, unknown: 0 };
  points.forEach((p) => { r[p.segment || 'unknown'] += 1; });
  return Object.entries(r).map(([type, count]) => ({ type, count }));
}

function renderWeather() {
  const t = trip();
  const w = t.weather?.hourly || [];
  if (!w.length) {
    el.weatherNow.innerHTML = '<p class="muted">No forecast loaded.</p>';
    el.weatherInsights.innerHTML = t.weather?.source === 'cached' ? '<p class="alert-med">Showing cached forecast.</p>' : '';
    return;
  }
  const idx = Number(el.weatherSlider.value);
  const hour = w[Math.min(idx, w.length - 1)];
  el.weatherHourLabel.textContent = String(idx);
  el.weatherNow.innerHTML = `<div>${hour.time}</div><div>Temp ${hour.temp}°C · Wind ${hour.wind} m/s (${hour.windDir}°) · Rain ${hour.precip} mm</div>`;
  const insights = weatherInsight(w);
  renderList(el.weatherInsights, insights.map((i) => i));
}

function renderSummary() {
  const t = trip();
  const stats = analyzeRoute(t.route.points);
  const alerts = buildSafety(t).slice(0, 3);
  const est = estimateTime(t.route.points);
  const segmentCounts = summarizeSegments(t.route.points);
  const weatherText = t.weather?.hourly?.length ? `${t.weather.hourly[0].temp}°C now, wind ${t.weather.hourly[0].wind} m/s` : 'No weather data';
  el.summaryContent.innerHTML = `
    <h4>Main trip</h4>
    <p><strong>Total distance:</strong> ${stats.distance.toFixed(1)} km</p>
    <p><strong>Paddle vs carry:</strong> ${segmentCounts.find((s) => s.type === 'paddle')?.count || 0} / ${segmentCounts.find((s) => s.type === 'carry')?.count || 0}</p>
    <p><strong>Elevation gain:</strong> ${stats.gain.toFixed(0)} m</p>
    <p><strong>Estimated total time:</strong> ${est.toFixed(1)} h</p>
    <p><strong>Weather summary:</strong> ${weatherText}</p>
    <div class="alerts">${alerts.map((a) => `<p class="${priorityColor(a.level)}">${a.text}</p>`).join('')}</div>
  `;
}

el.drawRoute.addEventListener('click', () => {
  uiState.drawMode = !uiState.drawMode;
  enableDraw(mapCtx, uiState.drawMode, (latlng) => {
    trip().route.points.push({ lat: latlng.lat, lon: latlng.lng, ele: 0, segment: 'unknown' });
    persist();
  });
  el.drawRoute.textContent = uiState.drawMode ? 'Stop drawing' : 'Draw route';
});

el.editRoute.addEventListener('click', () => {
  uiState.editMode = !uiState.editMode;
  el.editRoute.classList.toggle('primary', uiState.editMode);
  persist();
});

el.autoSegment.addEventListener('click', () => {
  trip().route.points = suggestSegments(trip().route.points);
  persist();
});

el.gpxImport.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => { trip().route.points = parseGpx(reader.result); persist(); };
  reader.readAsText(file);
});

el.gpxExport.addEventListener('click', () => {
  const blob = new Blob([buildGpx(trip().route.points)], { type: 'application/gpx+xml' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'route.gpx';
  a.click();
  URL.revokeObjectURL(a.href);
});

el.gearForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = new FormData(el.gearForm);
  trip().gear.push({ id: crypto.randomUUID(), name: data.get('name'), weight: Number(data.get('weight')), mode: data.get('mode'), critical: data.get('critical') === 'on', packed: true });
  el.gearForm.reset();
  persist();
});

el.gearList.addEventListener('click', (e) => {
  const i = [...el.gearList.children].indexOf(e.target.closest('.list-item'));
  if (i < 0) return;
  trip().gear[i].packed = !trip().gear[i].packed;
  persist();
});

el.fetchWeather.addEventListener('click', async () => {
  const lat = Number(el.weatherLat.value);
  const lon = Number(el.weatherLon.value);
  if (!lat || !lon) return;
  try {
    trip().weather = await fetchYr(lat, lon);
  } catch {
    if (trip().weather) trip().weather.source = 'cached';
  }
  persist();
});

el.weatherSlider.addEventListener('input', renderWeather);

el.noteForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = new FormData(el.noteForm);
  const c = mapCtx.map.getCenter();
  trip().notes.push({ id: crypto.randomUUID(), tag: data.get('tag'), text: data.get('text'), lat: data.get('pin') === 'on' ? c.lat : null, lon: data.get('pin') === 'on' ? c.lng : null });
  el.noteForm.reset();
  persist();
});

el.summaryToggle.addEventListener('click', () => {
  uiState.summaryOpen = !uiState.summaryOpen;
  document.getElementById('summary-panel').classList.toggle('open', uiState.summaryOpen);
});

setTabs();
render();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
