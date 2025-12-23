# Webhook Information

## Your Public Webhook URL

```
https://kcnibbtigikwvidlxeaj.supabase.co/functions/v1/whatsapp-webhook
```

## What Changed

Previously, you needed to:
1. Run ngrok to create a tunnel
2. Keep your local server running
3. Update webhook URL every time ngrok restarted

Now, you have:
1. A permanent public HTTPS URL
2. 24/7 uptime (no local server needed)
3. Direct Supabase database access
4. Built-in logging and monitoring

## How to Configure in Meta Dashboard

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Navigate to your app → WhatsApp → Configuration
3. Click "Edit" next to Webhook
4. Enter:
   - **Callback URL:** `https://kcnibbtigikwvidlxeaj.supabase.co/functions/v1/whatsapp-webhook`
   - **Verify Token:** Your `META_WEBHOOK_VERIFY_TOKEN` from `.env`
5. Click "Verify and Save"
6. Subscribe to webhook field: `messages`

## Testing the Webhook

### Quick Test
Visit this URL in your browser (replace YOUR_TOKEN):
```
https://kcnibbtigikwvidlxeaj.supabase.co/functions/v1/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=test
```

If configured correctly, it should return: `test`

### Live Test
1. Send any message to your WhatsApp Business number
2. Check Supabase logs:
   - Supabase Dashboard → Edge Functions → whatsapp-webhook → Logs
3. You should see incoming message logs

## Environment Variables

The edge function needs these environment variables (already configured):

- `SUPABASE_URL` - Auto-configured
- `SUPABASE_SERVICE_ROLE_KEY` - Auto-configured
- `META_ACCESS_TOKEN` - Your Meta access token
- `META_PHONE_NUMBER_ID` - Your WhatsApp phone number ID
- `META_WEBHOOK_VERIFY_TOKEN` - Your webhook verification token
- `ENCRYPTION_KEY` - Your encryption key
- `SEPOLIA_RPC_URL` - Ethereum Sepolia RPC endpoint

## How It Works

```
WhatsApp Message
      ↓
Meta Cloud API
      ↓
Edge Function (https://kcnibbtigikwvidlxeaj.supabase.co/functions/v1/whatsapp-webhook)
      ↓
Parse Message → Process Command → Query Database
      ↓
Send Response via WhatsApp API
```

## Monitoring

Check logs in real-time:
1. Go to Supabase Dashboard
2. Navigate to Edge Functions
3. Select `whatsapp-webhook`
4. Click on "Logs" tab

## Advantages Over ngrok

| Feature | ngrok | Supabase Edge Functions |
|---------|-------|-------------------------|
| URL Stability | Changes on restart | Permanent |
| Uptime | Only when running locally | 24/7 |
| HTTPS | Yes | Yes |
| Cost | Free tier limited | Free tier generous |
| Database Access | Via network | Direct/instant |
| Logging | Local console | Dashboard + logs |
| Scalability | Limited | Auto-scaling |

## Local Development

The local Express server (`src/server.js`) is still available for development:
```bash
npm start
```

But for production, the edge function handles everything!

## Troubleshooting

### Webhook verification fails
- Double-check `META_WEBHOOK_VERIFY_TOKEN` matches in both places
- Test the URL directly in browser with verify token

### Messages not received
- Check webhook subscription includes "messages"
- View edge function logs for errors
- Verify Meta access token is valid

### Database errors
- Edge function uses service role key (has full access)
- Check Supabase database is accessible
- Review RLS policies if needed

## Next Steps

1. Configure Meta webhook with the URL above
2. Send a test message to your WhatsApp Business number
3. Check logs to verify it's working
4. Start using your crypto wallet!
