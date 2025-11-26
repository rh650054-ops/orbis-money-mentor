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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { sessionId } = await req.json();

    // Get session data
    const { data: session, error: sessionError } = await supabaseClient
      .from('work_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single();

    if (sessionError || !session) {
      throw new Error('Session not found');
    }

    // Check if user has Google Calendar connected
    const { data: calendarToken } = await supabaseClient
      .from('google_calendar_tokens')
      .select('access_token, refresh_token, token_expiry, google_email')
      .eq('user_id', user.id)
      .maybeSingle();

    if (calendarToken) {
      // Sync with Google Calendar
      await syncWithGoogleCalendar(
        calendarToken.access_token,
        session.planning_date,
        session.meta_dia,
        user.id
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error syncing work blocks:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function syncWithGoogleCalendar(
  accessToken: string,
  date: string,
  metaDia: number,
  userId: string
) {
  try {
    // Get user profile for work hours
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('goal_hours')
      .eq('user_id', userId)
      .single();

    if (!profile?.goal_hours) return;

    const workHours = profile.goal_hours;
    const ritmoHora = metaDia / workHours;

    // Create main event
    const startTime = new Date(date + 'T08:00:00');
    const endTime = new Date(startTime);
    endTime.setHours(startTime.getHours() + workHours);

    const mainEvent = {
      summary: `Meta Orbis — R$${metaDia.toFixed(2)}`,
      description: `Meta diária: R$${metaDia.toFixed(2)}\nHoras trabalhadas: ${workHours}\nRitmo por hora: R$${ritmoHora.toFixed(2)}\n\norbis_automation=true`,
      start: {
        dateTime: startTime.toISOString(),
        timeZone: 'America/Sao_Paulo',
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: 'America/Sao_Paulo',
      },
    };

    // Create main event
    await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mainEvent),
    });

    // Create hourly reminders
    for (let i = 0; i < workHours; i++) {
      const reminderTime = new Date(startTime);
      reminderTime.setHours(startTime.getHours() + i);
      
      const reminderEnd = new Date(reminderTime);
      reminderEnd.setMinutes(reminderEnd.getMinutes() + 1);

      const reminderEvent = {
        summary: 'Orbis — Conferir progresso da meta',
        description: `Ritmo ideal: R$${ritmoHora.toFixed(2)} por hora.\nAtualize seu progresso no Orbis.\n\norbis_automation=true`,
        start: {
          dateTime: reminderTime.toISOString(),
          timeZone: 'America/Sao_Paulo',
        },
        end: {
          dateTime: reminderEnd.toISOString(),
          timeZone: 'America/Sao_Paulo',
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'popup', minutes: 0 },
          ],
        },
      };

      await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reminderEvent),
      });
    }

    console.log('Successfully synced with Google Calendar');
  } catch (error) {
    console.error('Error creating calendar events:', error);
    throw error;
  }
}
