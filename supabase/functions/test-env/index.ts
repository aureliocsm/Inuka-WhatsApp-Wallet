import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

Deno.serve((req: Request) => {
  const envVars = {
    META_ACCESS_TOKEN: Deno.env.get('META_ACCESS_TOKEN') ? '✅ Set' : '❌ Not Set',
    META_PHONE_NUMBER_ID: Deno.env.get('META_PHONE_NUMBER_ID') ? '✅ Set' : '❌ Not Set',
    META_WEBHOOK_VERIFY_TOKEN: Deno.env.get('META_WEBHOOK_VERIFY_TOKEN') ? '✅ Set' : '❌ Not Set',
    ENCRYPTION_KEY: Deno.env.get('ENCRYPTION_KEY') ? '✅ Set' : '❌ Not Set',
    SCROLL_SEPOLIA_RPC_URL: Deno.env.get('SCROLL_SEPOLIA_RPC_URL') ? '✅ Set' : '❌ Not Set',
    SUPABASE_URL: Deno.env.get('SUPABASE_URL') ? '✅ Set' : '❌ Not Set',
    SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ? '✅ Set' : '❌ Not Set',
  };

  return new Response(JSON.stringify(envVars, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
});