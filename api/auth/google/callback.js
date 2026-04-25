
export default async function handler(req, res) {
  const { code, state: memberId } = req.query;

  if (!code) {
    return res.status(400).send("No authorization code received");
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });

    const tokens = await tokenRes.json();

    if (tokens.error) {
      console.error("Token error:", tokens);
      return res.status(400).send(`Token error: ${tokens.error_description}`);
    }

    // Get user email
    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const user = await userRes.json();

    // Store tokens in Supabase
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    await fetch(`${supabaseUrl}/rest/v1/calendar_tokens`, {
      method: "POST",
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
      },
      body: JSON.stringify({
        member_id: memberId || "dad",
        email: user.email,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        provider: "google",
      }),
    });

    // Redirect back to app with success
    res.redirect(`https://family-os-snowy.vercel.app/#admin&calendar_connected=true`);

  } catch (err) {
    console.error("Callback error:", err);
    res.status(500).send(`Error: ${err.message}`);
  }
}
