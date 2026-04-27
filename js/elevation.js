export function haversineKm(a, b) {
  const r = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

export function analyzeRoute(points) {
  if (points.length < 2) return { distances: [], slopes: [], gain: 0, distance: 0 };
  const distances = [0];
  const slopes = [];
  let gain = 0;
  for (let i = 1; i < points.length; i += 1) {
    const d = haversineKm(points[i - 1], points[i]);
    distances.push(distances[i - 1] + d);
    const delta = (points[i].ele || 0) - (points[i - 1].ele || 0);
    if (delta > 0) gain += delta;
    slopes.push(d > 0 ? delta / (d * 1000) * 100 : 0);
  }
  return { distances, slopes, gain, distance: distances.at(-1) || 0 };
}

export function drawElevation(canvas, points) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (points.length < 2) return;
  const { distances, slopes } = analyzeRoute(points);
  const elev = points.map((p) => p.ele || 0);
  const min = Math.min(...elev);
  const max = Math.max(...elev);
  ctx.lineWidth = 2;
  for (let i = 0; i < elev.length; i += 1) {
    const x = (distances[i] / (distances.at(-1) || 1)) * canvas.width;
    const y = canvas.height - ((elev[i] - min) / ((max - min) || 1)) * (canvas.height - 20) - 10;
    const steep = Math.abs(slopes[Math.max(0, i - 1)] || 0) > 12;
    ctx.strokeStyle = steep ? '#dc2626' : '#0ea5e9';
    if (i === 0) ctx.beginPath(), ctx.moveTo(x, y);
    else ctx.lineTo(x, y), ctx.stroke(), ctx.beginPath(), ctx.moveTo(x, y);
  }
}
