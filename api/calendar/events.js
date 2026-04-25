const https = require('https');

function httpsGet(url, headers) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error('Invalid JSON: ' + data.slice(0, 100))); }
      });
    });
    req.on('error', reject);
  });
}

function httpsPost(url, body, headers) {
  return new Promise((resolve, reject) => {
    const data = typeof body === 'string' ? body : JSON.stringify(body);
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: { ...headers, 'Content-Length': Buffer.byteLength(data) },
    };
    const req = https.request(options, (res) => {
      let resp = '';
      res.on('data', chunk => resp += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(resp)); }
        catch(e) { reject(new Error('Invalid JSON: ' + resp.slice(0, 100))); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

module.exports = async function handler(req, res) {
  const { memberId } = req.query;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env vars' });
  }

  try {
    // Get token from Supabase
    const tokenData = await httpsGet(
      `${supabaseUrl}/rest/v1/calendar_tokens?member_id=eq.${memberId}&provider=eq.google`,
      { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
    );

    if (!tokenData || tokenData.length === 0) {
      return res.status(404).json({ error: 'No calendar connected for this member' });
    }

    let { access_token, refresh_token, expires_at } = tokenData[0];

    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return res.status(500).json({ error: 'Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET' });
    }

    // Refresh if expired
    if (new Date(expires_at) < new Date()) {
      const refreshed = await httpsPost(
        'https://oauth2.googleapis.com/token',
        new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          refresh_token,
          grant_type: 'refresh_token',
        }).toString(),
        { 'Content-Type': 'application/x-www-form-urlencoded' }
      );
      if (refreshed.access_token) {
        access_token = refreshed.access_token;
      }
    }

    const authHeaders = { 'Authorization': `Bearer ${access_token}` };

    // Get calendar list
    const calList = await httpsGet(
      'https://www.googleapis.com/calendar/v3/users/me/calendarList',
      authHeaders
    );

    const calendars = calList.items || [];
    const now = new Date().toISOString();
    const future = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString();
    const allEvents = [];

    for (const cal of calendars) {
      try {
        const params = new URLSearchParams({
          timeMin: now, timeMax: future,
          singleEvents: 'true', orderBy: 'startTime', maxResults: '100'
        });
        const evData = await httpsGet(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events?${params}`,
          authHeaders
        );
        if (evData.items) {
          evData.items.forEach(ev => { ev._calName = cal.summary; });
          allEvents.push(...evData.items);
        }
      } catch(e) {
        console.warn('Calendar fetch failed for', cal.id, e.message);
      }
    }

    const events = allEvents
      .filter(ev => ev.start && ev.start.dateTime)
      .map(ev => {
        const start = new Date(ev.start.dateTime);
        const end = new Date(ev.end.dateTime);
        const startH = start.getHours() + start.getMinutes() / 60;
        const dur = (end - start) / (1000 * 60 * 60);
        return {
          id: ev.id,
          title: ev.summary || 'Busy',
          memberIds: [memberId],
          startH: Math.round(startH * 2) / 2,
          dur: Math.max(0.5, Math.round(dur * 2) / 2),
          recurrence: 'once',
          dows: [start.getDay()],
          specificDate: start.toISOString().slice(0, 10),
          source: 'google',
          calendarName: ev._calName,
        };
      });

    res.status(200).json({ events, calendarsFound: calendars.map(c => c.summary) });

  } catch (err) {
    console.error('events.js error:', err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
};
