// @ts-nocheck — Deno runtime.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, fail, json } from '../_shared/cors.ts';

/**
 * Rider job sheet backend.
 *
 * Riders have no account. The opaque per-order token is the credential,
 * and it is only ever checked here with the service role — the token
 * never grants table access, and the database functions it calls
 * validate the transition and the OTP themselves.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return fail('Use POST', 405);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL'),
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  );

  let body;
  try {
    body = await req.json();
  } catch {
    return fail('Invalid request body');
  }

  const { action, token } = body;
  if (!token || typeof token !== 'string' || token.length < 32) {
    return fail('Invalid link', 401);
  }

  if (action === 'get') {
    const { data, error } = await admin.rpc('rider_order_by_token', { p_token: token });
    if (error) return fail(error.message, 500);
    if (!data) return fail('This link is no longer valid.', 404);
    return json(data);
  }

  if (action === 'advance') {
    const allowed = ['picked_up', 'out_for_delivery', 'delivered'];
    if (!allowed.includes(body.next)) return fail('Unsupported status');

    const { data, error } = await admin.rpc('rider_advance_status', {
      p_token: token,
      p_next: body.next,
      p_otp: body.otp ?? null,
    });
    if (error) return fail(error.message, 500);

    if (!data?.ok) {
      const messages = {
        invalid_token: 'This link is no longer valid.',
        invalid_transition: 'That status cannot be set from here.',
        invalid_otp: 'That OTP does not match. Ask the receiver to check their confirmation.',
      };
      return fail(messages[data?.error] ?? 'Could not update the order', 422);
    }
    return json(data);
  }

  return fail('Unknown action');
});
