export default async function handler(req, res) {
  const { memberId, debug } = req.query;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  const CALENDARS_BY_MEMBER = {
    dad: ["TruRating Calendar", "Calendar"],
    mom: ["brienne roney"],
  };
  const ALLOWED_CALENDARS = CALENDARS_BY_MEMBER[memberId] || [];

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Missing env vars' });
  }

  try {
    // Get stored token
    const tokenRes = await fetch(
      `${supabaseUrl}/rest/v1/calendar_tokens?member_id=eq.${memberId}&provider=eq.google`,
      { headers: { "apikey": supabaseKey, "Authorization": `Bearer ${supabaseKey}` } }
    );
    const tokenData = await tokenRes.json();

    if (!tokenData || tokenData.length === 0) {
      return res.status(404).json({ error: `No token found for ${memberId}` });
    }

    let { access_token, refresh_token, expires_at } = tokenData[0];

    // Step 1: Try refresh
    let refreshError = null;
    if (refresh_token) {
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
            headers: { "apikey": supabaseKey, "Authorization": `Bearer ${supabaseKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ access_token, expires_at: new Date(Date.now() + 3600000).toISOString() }),
          }
        );
      } else {
        refreshError = refreshed;
      }
    }

    // Step 2: Test token with userinfo
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo',
      { headers: { 'Authorization': `Bearer ${access_token}` } }
    );
    const userInfo = await userRes.json();

    // Step 3: Get calendar list
    const calListRes = await fetch(
      'https://www.googleapis.com/calendar/v3/users/me/calendarList',
      { headers: { 'Authorization': `Bearer ${access_token}` } }
    );
    const calList = await calListRes.json();

    if (calList.error) {
      return res.status(200).json({
        events: [],
        debug: {
          calendarApiError: calList.error,
          userInfo,
          refreshError,
          hint: 'The access token works for userinfo but not calendar - likely missing calendar scope. Please reconnect in Admin.',
          tokenExpiry: expires_at,
        }
      });
    }

    const allCalendars = calList.items || [];
    const allCalendarNames = allCalendars.map(c => c.summary);
    const filteredCalendars = allCalendars.filter(cal => ALLOWED_CALENDARS.includes(cal.summary));

    const now = new Date().toISOString();
    const future = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString();

    const allEvents = [];
    for (const cal of filteredCalendars) {
      const evRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events?` +
        new URLSearchParams({ timeMin: now, timeMax: future, singleEvents: 'true', orderBy: 'startTime', maxResults: '500' }),
        { headers: { 'Authorization': `Bearer ${access_token}` } }
      );
      const evData = await evRes.json();
      if (evData.items) {
        evData.items.forEach(ev => { ev._calName = cal.summary; });
        allEvents.push(...evData.items);
      }
    }

    function toMountain(dateStr) {
      const mtStr = new Date(dateStr).toLocaleString('en-US', { timeZone: 'America/Denver' });
      return new Date(mtStr);
    }

    const events = allEvents
      .filter(ev => ev.start?.dateTime)
      .map(ev => {
        const startMT = toMountain(ev.start.dateTime);
        const dur = (new Date(ev.end.dateTime) - new Date(ev.start.dateTime)) / 3600000;
        const startH = startMT.getHours() + startMT.getMinutes() / 60;
        return {
          id: ev.id,
          title: ev.summary || 'Busy',
          memberIds: [memberId],
          startH: Math.round(startH * 4) / 4,
          dur: Math.max(0.25, Math.round(dur * 4) / 4),
          recurrence: 'once',
          dows: [startMT.getDay()],
          specificDate: new Date(ev.start.dateTime).toLocaleDateString('en-CA', { timeZone: 'America/Denver' }),
          source: 'google',
        };
      });

    res.status(200).json({
      events,
      calendarsFound: filteredCalendars.map(c => c.summary),
      allCalendarsAvailable: allCalendarNames,
      userEmail: userInfo.email,
      totalEvents: events.length,
    });

  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
}
