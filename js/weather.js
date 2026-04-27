export async function fetchYr(lat, lon) {
  const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'NordicPackraftPlanner/1.0 github-pages' } });
  if (!res.ok) throw new Error('Weather fetch failed');
  const data = await res.json();
  const hourly = data.properties.timeseries.slice(0, 24).map((entry) => {
    const d = entry.data.instant.details;
    return {
      time: entry.time,
      temp: d.air_temperature,
      wind: d.wind_speed,
      windDir: d.wind_from_direction,
      precip: entry.data.next_1_hours?.details?.precipitation_amount ?? 0,
    };
  });
  return { hourly, fetchedAt: new Date().toISOString(), source: 'live' };
}

export function weatherInsight(hourly) {
  if (!hourly?.length) return [];
  const avgWind = hourly.reduce((s, h) => s + h.wind, 0) / hourly.length;
  const afternoon = hourly.slice(8, 18);
  const morning = hourly.slice(0, 8);
  const morningWind = morning.reduce((s, h) => s + h.wind, 0) / Math.max(1, morning.length);
  const afternoonWind = afternoon.reduce((s, h) => s + h.wind, 0) / Math.max(1, afternoon.length);
  const rain = hourly.reduce((s, h) => s + h.precip, 0);
  const insights = [];
  if (afternoonWind - morningWind > 2) insights.push('Wind increasing in afternoon – consider early start.');
  if (rain > 8) insights.push('Rain may increase river flow and flood potential.');
  if (avgWind < 5 && rain < 3) insights.push('Stable conditions likely in next 24h.');
  return insights;
}
