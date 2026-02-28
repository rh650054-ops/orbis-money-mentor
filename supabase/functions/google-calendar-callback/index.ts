import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const stateParam = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    // Parse state which now contains user_id and origin
    let userId: string | null = null;
    let allowedOrigin = '*';
    
    if (stateParam) {
      try {
        const stateObj = JSON.parse(atob(stateParam));
        userId = stateObj.user_id || null;
        allowedOrigin = stateObj.origin || '*';
      } catch {
        // Fallback for legacy plain user_id state
        userId = stateParam;
      }
    }

    if (error || !code || !userId) {
      console.error('OAuth error or missing params:', error, code, userId);
      const sanitizedError = (error || 'Missing parameters').replace(/'/g, "\\'").replace(/[<>]/g, '');
      return new Response(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'google-calendar-error', error: '${sanitizedError}' }, '${allowedOrigin}');
              }
              window.close();
            </script>
          </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
    const redirectUri = `${supabaseUrl}/functions/v1/google-calendar-callback`;

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId!,
        client_secret: clientSecret!,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenResponse.json();

    if (!tokens.access_token || !tokens.refresh_token) {
      console.error('Failed to get tokens:', tokens);
      return new Response(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'google-calendar-error', error: 'Failed to get tokens' }, '${allowedOrigin}');
              }
              window.close();
            </script>
          </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    // Get user email from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userInfo = await userInfoResponse.json();

    // Sanitize email for safe embedding in HTML
    const safeEmail = (userInfo.email || '').replace(/'/g, "\\'").replace(/[<>]/g, '');

    // Calculate token expiry
    const expiryDate = new Date();
    expiryDate.setSeconds(expiryDate.getSeconds() + tokens.expires_in);

    // Check if token already exists
    const { data: existingToken } = await supabase
      .from('google_calendar_tokens')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (existingToken) {
      await supabase
        .from('google_calendar_tokens')
        .update({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expiry: expiryDate.toISOString(),
          google_email: userInfo.email,
        })
        .eq('user_id', userId);
    } else {
      await supabase
        .from('google_calendar_tokens')
        .insert({
          user_id: userId,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expiry: expiryDate.toISOString(),
          google_email: userInfo.email,
        });
    }

    return new Response(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'google-calendar-success', email: '${safeEmail}' }, '${allowedOrigin}');
            }
            window.close();
          </script>
        </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' },
    });
  } catch (error) {
    console.error('Error in google-calendar-callback:', error);
    // Use a safe fallback origin - restrict to known app domains
    const fallbackOrigin = Deno.env.get('SUPABASE_URL') ? new URL(Deno.env.get('SUPABASE_URL')!).origin : 'null';
    return new Response(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'google-calendar-error', error: 'Authentication failed' }, '${fallbackOrigin}');
            }
            window.close();
          </script>
        </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' },
    });
  }
});
