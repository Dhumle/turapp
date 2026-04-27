import { analyzeRoute, haversineKm } from './elevation.js';

export function createMap(elId) {
  const map = L.map(elId).setView([61.0, 8.0], 6);
  const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; OpenStreetMap' });
  const kartverket = L.tileLayer('https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/{z}/{y}/{x}.png', { maxZoom: 18, attribution: 'Kartverket' });
  kartverket.on('tileerror', () => { if (!map.hasLayer(osm)) osm.addTo(map); });
  kartverket.addTo(map);
  const routeLayer = L.polyline([], { color: '#0ea5e9', weight: 4 }).addTo(map);
  const markerLayer = L.layerGroup().addTo(map);
  const noteLayer = L.layerGroup().addTo(map);
  return { map, routeLayer, markerLayer, noteLayer };
}

export function renderRoute(ctx, points, editMode, onPointUpdate) {
  const latlngs = points.map((p) => [p.lat, p.lon]);
  ctx.routeLayer.setLatLngs(latlngs);
  ctx.markerLayer.clearLayers();
  if (points.length) ctx.map.fitBounds(ctx.routeLayer.getBounds(), { padding: [20, 20] });
  if (!editMode) return;
  points.forEach((p, idx) => {
    const m = L.marker([p.lat, p.lon], { draggable: true }).addTo(ctx.markerLayer);
    m.on('dragend', (e) => onPointUpdate(idx, e.target.getLatLng()));
    m.on('click', () => onPointUpdate(idx, null, true));
  });
}

export function enableDraw(ctx, enabled, addPoint) {
  ctx.map.off('click');
  if (enabled) ctx.map.on('click', (e) => addPoint(e.latlng));
}

export function parseGpx(text) {
  const xml = new DOMParser().parseFromString(text, 'application/xml');
  return [...xml.getElementsByTagName('trkpt')].map((n) => ({
    lat: Number(n.getAttribute('lat')),
    lon: Number(n.getAttribute('lon')),
    ele: Number(n.getElementsByTagName('ele')[0]?.textContent || 0),
    segment: 'unknown',
  }));
}

export function buildGpx(points) {
  const body = points.map((p) => `<trkpt lat="${p.lat}" lon="${p.lon}"><ele>${p.ele || 0}</ele></trkpt>`).join('');
  return `<?xml version="1.0"?><gpx version="1.1" creator="NordicPackraft"><trk><name>Route</name><trkseg>${body}</trkseg></trk></gpx>`;
}

export function suggestSegments(points) {
  const { slopes } = analyzeRoute(points);
  return points.map((p, i) => {
    const slope = Math.abs(slopes[Math.max(0, i - 1)] || 0);
    const nearWaterHeuristic = (i % 5) < 3;
    if (slope > 14) return { ...p, segment: 'carry' };
    if (nearWaterHeuristic && slope < 8) return { ...p, segment: 'paddle' };
    return { ...p, segment: 'unknown' };
  });
}

export function routeBearing(points) {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    const y = Math.sin((b.lon - a.lon) * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180);
    const x = Math.cos(a.lat * Math.PI / 180) * Math.sin(b.lat * Math.PI / 180) - Math.sin(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.cos((b.lon - a.lon) * Math.PI / 180);
    total += (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }
  return total / (points.length - 1);
}

export function estimateTime(points) {
  if (points.length < 2) return 0;
  let hours = 0;
  for (let i = 1; i < points.length; i += 1) {
    const dist = haversineKm(points[i - 1], points[i]);
    const mode = points[i].segment || 'unknown';
    const speed = mode === 'carry' ? 2.8 : mode === 'paddle' ? 4.5 : 3.5;
    hours += dist / speed;
  }
  return hours;
}

export function renderNotes(ctx, notes) {
  ctx.noteLayer.clearLayers();
  notes.filter((n) => n.lat && n.lon).forEach((n) => L.marker([n.lat, n.lon]).bindPopup(`${n.tag}: ${n.text}`).addTo(ctx.noteLayer));
}
