// Read-only transport for the public busy-slot feed. Never forwards user input
// as an upstream action/URL or returns client names, phones or notes.
const ENDPOINT = 'https://script.google.com/macros/s/AKfycbxWE5GsJqR05MTabvUrtmb1_siLD-pmLwpXHiG3T7AAUkwr07xpOhBbqCZeV4fqx7E/exec';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ success: false, error: 'method_not_allowed' });
  }
  const month = req.query.month;
  if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return res.status(400).json({ success: false, error: 'invalid_month' });
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(`${ENDPOINT}?action=availability&month=${month}`, {
        signal: controller.signal, redirect: 'follow', cache: 'no-store'
      });
      if (!response.ok) throw new Error(`upstream_http_${response.status}`);
      const data = await response.json();
      if (!data || data.success !== true || data.month !== month || !Array.isArray(data.appointments)
          || !data.appointments.every(a => a && typeof a.date === 'string'
            && a.date.startsWith(month + '-') && /^\d{4}-\d{2}-\d{2}$/.test(a.date)
            && /^([01]\d|2[0-3]):[0-5]\d$/.test(a.time)
            && Number.isFinite(a.duration) && a.duration > 0)) throw new Error('invalid_upstream');
      return res.status(200).json({ success: true, month, appointments: data.appointments.map(a => ({
        date: a.date, time: a.time, duration: a.duration, status: String(a.status || 'pending')
      })) });
    } catch (error) {
      console.warn('Availability upstream failure', { attempt: attempt + 1, reason: error.name === 'AbortError' ? 'timeout' : error.message });
    } finally { clearTimeout(timer); }
  }
  return res.status(503).json({ success: false, error: 'availability_unavailable' });
}
