
export default async function handler(req, res) {
  const { memberId } = req.query;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  try {
    // Get stored token for this member
    const tokenRes = await fetch(
      `${supabaseUrl}/rest/v1/calendar_tokens?member_id=eq.${memberId}&provider=eq.google`,
      {
        headers: {
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`,
        },
      }
    );
    const tokens = await tokenRes.json();

    if (!tokens || tokens.length === 0) {
      return res.status(404).json({ error: "No calendar connected for this member" });
    }

    let { access_token, refresh_token, expires_at } = tokens[0];

    // Refresh token if expired
    if (new Date(expires_at) < new Date()) {
      const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          refresh_token,
          grant_type: "refresh_token",
        }),
      });
      const refreshed = await refreshRes.json();
      if (refreshed.access_token) {
        access_token = refreshed.access_token;
        // Update stored token
        await fetch(
          `${supabaseUrl}/rest/v1/calendar_tokens?member_id=eq.${memberId}&provider=eq.google`,
          {
            method: "PATCH",
            headers: {
              "apikey": supabaseKey,
              "Authorization": `Bearer ${supabaseKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              access_token,
              expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
            }),
          }
        );
      }
    }

    // Fetch events from Google Calendar for next 4 weeks
    const now = new Date().toISOString();
    const future = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString();

    const calRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
      new URLSearchParams({
        timeMin: now,
        timeMax: future,
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: "100",
      }),
      { headers: { Authorization: `Bearer ${access_token}` } }
    );

    const calData = await calRes.json();

    if (calData.error) {
      return res.status(400).json({ error: calData.error.message });
    }

    // Transform Google Calendar events to our app format
    const events = (calData.items || [])
      .filter(ev => ev.start?.dateTime) // only timed events, not all-day
      .map(ev => {
        const start = new Date(ev.start.dateTime);
        const end = new Date(ev.end.dateTime);
        const dow = start.getDay();
        const startH = start.getHours() + start.getMinutes() / 60;
        const dur = (end - start) / (1000 * 60 * 60);

        return {
          id: ev.id,
          title: ev.summary || "Busy",
          memberIds: [memberId],
          startH: Math.round(startH * 2) / 2, // round to nearest 0.5hr
          dur: Math.max(0.5, Math.round(dur * 2) / 2),
          recurrence: "once",
          dows: [dow],
          specificDate: start.toISOString().slice(0, 10),
          source: "google",
          originalStart: ev.start.dateTime,
        };
      });

    res.status(200).json({ events });

  } catch (err) {
    console.error("Calendar fetch error:", err);
    res.status(500).json({ error: err.message });
  }
}
