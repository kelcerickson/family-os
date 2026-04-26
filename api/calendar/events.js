export default async function handler(req, res) {
  const { memberId } = req.query;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  // Only fetch from these calendars (add more names here if needed)
  // Try both the display name and the fallback name Google assigns to shared Outlook calendars
  // Calendars to show per family member
  const CALENDARS_BY_MEMBER = {
    dad: ["TruRating Calendar", "Calendar"],
    mom: ["brienne roney"],
  };
  const ALLOWED_CALENDARS = CALENDARS_BY_MEMBER[memberId] || [];

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_KEY' });
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

    // Get all calendars then filter to allowed ones only
    const calListRes = await fetch(
      'https://www.googleapis.com/calendar/v3/users/me/calendarList',
      { headers: authHeaders }
    );
    const calList = await calListRes.json();
    const allCalendars = calList.items || [];

    // Only keep the TruRating Calendar
    const filteredCalendars = allCalendars.filter(cal =>
      ALLOWED_CALENDARS.includes(cal.summary)
    );

    console.log('All calendars:', allCalendars.map(c => c.summary));
    console.log('Fetching from:', filteredCalendars.map(c => c.summary));

    if (filteredCalendars.length === 0) {
      return res.status(200).json({
        events: [],
        message: 'No matching calendars found',
        allCalendarsFound: allCalendars.map(c => c.summary)
      });
    }

    const allEvents = [];
    for (const cal of filteredCalendars) {
      try {
        const params = new URLSearchParams({
          timeMin: now,
          timeMax: future,
          singleEvents: 'true',
          orderBy: 'startTime',
          maxResults: '500',
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

    // Convert to Mountain Time (America/Denver)
    function toMountain(dateStr) {
      const date = new Date(dateStr);
      // Get the time in Mountain timezone
      const mtStr = date.toLocaleString('en-US', { timeZone: 'America/Denver' });
      return new Date(mtStr);
    }

    function getMountainDateStr(dateStr) {
      const date = new Date(dateStr);
      const mtStr = date.toLocaleDateString('en-CA', { timeZone: 'America/Denver' }); // YYYY-MM-DD format
      return mtStr;
    }

    const events = allEvents
      .filter(ev => ev.start?.dateTime)
      .map(ev => {
        const startMT = toMountain(ev.start.dateTime);
        const endMT = toMountain(ev.end.dateTime);
        const startH = startMT.getHours() + startMT.getMinutes() / 60;
        const dur = (new Date(ev.end.dateTime) - new Date(ev.start.dateTime)) / (1000 * 60 * 60);
        const specificDate = getMountainDateStr(ev.start.dateTime);
        return {
          id: ev.id,
          title: ev.summary || 'Busy',
          memberIds: [memberId],
          startH: Math.round(startH * 4) / 4, // round to nearest 15min
          dur: Math.max(0.25, Math.round(dur * 4) / 4),
          recurrence: 'once',
          dows: [startMT.getDay()],
          specificDate,
          source: 'google',
          calendarName: ev._calName,
        };
      });

    res.status(200).json({
      events,
      calendarsFound: filteredCalendars.map(c => c.summary),
      totalEvents: events.length,
    });

  } catch (err) {
    console.error('events.js crash:', err.message);
    res.status(500).json({ error: err.message });
  }
}
