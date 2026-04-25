export default async function handler(req, res) {
  const { memberId } = req.query;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_KEY' });
  }
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(500).json({ error: 'Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET' });
  }

  try {
    const sbHeaders = { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` };
    const tokenRes = await fetch(
      `${supabaseUrl}/rest/v1/calendar_tokens?member_id=eq.${memberId}&provider=eq.google`,
      { headers: sbHeaders }
    );
    const tokenData = await tokenRes.json();

    if (!tokenData || tokenData.length === 0) {
      return res.status(404).json({ error: 'No calendar connected for this member' });
    }

    let { access_token, refresh_token, expires_at } = tokenData[0];

    // Refresh token if expired
    if (new Date(expires_at) < new Date()) {
      const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          refresh_token,
          grant_type: 'refresh_token',
        }),
      });
      const refreshed = await refreshRes.json();
      if (refreshed.access_token) {
        access_token = refreshed.access_token;
        await fetch(
          `${supabaseUrl}/rest/v1/calendar_tokens?member_id=eq.${memberId}&provider=eq.google`,
          {
            method: 'PATCH',
            headers: { ...sbHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              access_token,
              expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
            }),
          }
        );
      }
    }

    const authHeaders = { 'Authorization': `Bearer ${access_token}` };
    const now = new Date().toISOString();
    const future = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString();

    // Get all calendars
    const calListRes = await fetch(
      'https://www.googleapis.com/calendar/v3/users/me/calendarList',
      { headers: authHeaders }
    );
    const calList = await calListRes.json();
    const calendars = calList.items || [];

    const allEvents = [];
    for (const cal of calendars) {
      try {
        const params = new URLSearchParams({
          timeMin: now, timeMax: future,
          singleEvents: 'true', orderBy: 'startTime', maxResults: '100',
        });
        const evRes = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events?${params}`,
          { headers: authHeaders }
        );
        const evData = await evRes.json();
        if (evData.items) {
          evData.items.forEach(ev => { ev._calName = cal.summary; });
          allEvents.push(...evData.items);
        }
      } catch (e) {
        console.warn('Failed calendar:', cal.id, e.message);
      }
    }

    const events = allEvents
      .filter(ev => ev.start?.dateTime)
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
    console.error('events.js crash:', err.message, err.stack);
    res.status(500).json({ error: err.message });
  }
}
