# health-summary Edge Function

## What it does
Generates a plain-language summary of the last 7–30 days of health habits.

## Deployment

```bash
# Deploy the function (JWT verification is ON by default)
supabase functions deploy health-summary

# Set the OpenAI secret — never committed to source control
supabase secrets set OPENAI_API_KEY=sk-...
```

## Environment variables (set as Supabase secrets)
| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | Server-side OpenAI key — never exposed to the browser |
| `SUPABASE_URL` | Auto-injected by Supabase |
| `SUPABASE_ANON_KEY` | Auto-injected by Supabase |

## Request format
```
POST /functions/v1/health-summary
Authorization: Bearer <supabase-user-jwt>
Content-Type: application/json

{ "profile_id": "<uuid>", "days": 7 }
```

## Security controls
1. **Authentication**: JWT must be valid — function calls `supabase.auth.getUser()`.
2. **Authorization**: all DB queries use the user's token so RLS is enforced automatically.
3. **Rate limit**: 1 call per profile per 10 minutes (checked via `ai_summaries`).
4. **Data sent to OpenAI**: aggregated counts and averages only — no names, IDs, or document contents.
5. **OpenAI key**: stored as a Deno env secret, never in frontend code or logs.
6. **Error responses**: generic messages only — no DB errors, stack traces, or OpenAI details leaked.

## Model used
`gpt-4o-mini` — cost-efficient, sufficient for structured summarisation.

## Rate limit
One generation per profile per 10 minutes, enforced by querying `ai_summaries.generated_at`.
