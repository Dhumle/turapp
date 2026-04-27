import { analyzeRoute } from './elevation.js';
import { routeBearing } from './map.js';
import { criticalMissing, gearTotals } from './gear.js';

function windExposure(routeDir, windFrom) {
  const rel = Math.abs(((windFrom - routeDir + 540) % 360) - 180);
  if (rel > 140) return 'headwind';
  if (rel > 70) return 'crosswind';
  return 'tailwind';
}

export function buildSafety(trip) {
  const alerts = [];
  const points = trip.route.points;
  const weather = trip.weather?.hourly || [];
  const slopes = analyzeRoute(points).slopes;
  const steep = slopes.filter((s) => Math.abs(s) > 12).length;

  if (weather.length) {
    const cold = weather.some((h) => h.temp <= 5);
    const windy = weather.some((h) => h.wind >= 10);
    const rain24 = weather.reduce((s, h) => s + h.precip, 0);
    const avgWindFrom = weather.reduce((s, h) => s + h.windDir, 0) / weather.length;
    const exposure = windExposure(routeBearing(points), avgWindFrom);

    if (cold && windy) alerts.push({ level: 'high', text: 'High wind + cold water = dangerous paddling conditions.' });
    if (cold && weather.some((h) => h.wind > 7)) alerts.push({ level: 'med', text: 'Cold water risk – use dry suit.' });
    if (exposure !== 'tailwind' && weather.some((h) => h.wind >= 8)) alerts.push({ level: 'med', text: `Exposed paddling section: ${exposure} likely.` });

    const slopeFactor = steep > 8 ? 1.4 : 1;
    const floodScore = rain24 * slopeFactor;
    if (floodScore > 14) alerts.push({ level: 'high', text: 'High water / potential flood risk.' });
    else if (floodScore < 4) alerts.push({ level: 'low', text: 'Low water level likely.' });
    else alerts.push({ level: 'low', text: 'Normal conditions.' });
  }

  const loads = gearTotals(trip.gear, points);
  const longCarry = points.filter((p) => p.segment === 'carry').length > points.length * 0.25;
  if (longCarry && loads.backpack > 18) alerts.push({ level: 'med', text: 'Long carry with heavy load – risk of fatigue.' });

  const missing = criticalMissing(trip.gear);
  if (missing.length) alerts.push({ level: 'high', text: `Critical gear missing: ${missing.join(', ')}.` });

  return alerts;
}
