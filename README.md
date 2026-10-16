# PALEnvest – Project Documentation

Working name: **PALEnvest** (check domain and trademark before it is final). A real estate catalog plus a content-creation tool for agents. Solo build, used to practice system design and AI engineering.

## 1. Goal

Two parts:

1. **Admin page**: CRUD for rentals, brokerage listings, and developer projects.
2. **Public page**: browse published listings.

On top of that, a **content hub for agents**: posters, videos, captions, and a chatbot generated from listing data. Today agents juggle many apps (ChatGPT for posters, other tools for video). The system replaces that by reusing the listing data already stored.

Constraint for now: **free or nearly free**.

## 2. Tech stack

- **Next.js** with two route groups: `/admin/*` (protected) and public listing pages (server-rendered for SEO).
- **Supabase**: Postgres, Auth, Storage, Realtime.
- **Bootstrap** for fast UI work (no custom design needed).
- AI and rendering services are called from server routes only, so API keys never reach the browser.

## 3. Architecture notes

- Supabase Auth for admin login. **Row Level Security**: the public can only read `published` listings; only admins can write.
- Supabase Storage for photos, posters, and videos.
- Generation is a **job**: admin clicks generate, a row is created with status `pending` -> `processing` -> `done` / `failed`, and the UI updates through Realtime.
- Video rendering should not run in a normal serverless function (timeouts, CPU). Use a small server or worker, or render in the browser with `ffmpeg.wasm`.
- Rate-limit AI calls per admin so one user cannot use up free quotas.
- Put every external provider behind an interface (for example `VideoProvider.generate(...)`) so a provider can be swapped or removed without changes elsewhere. The Sora shutdown showed why.

## 4. Data model (draft)

One `listings` table for all three types is simpler than three tables.

- `listings`: id, type (`rental` | `brokerage` | `dev_project`), title, description, price (PHP), status (`draft` | `published` | `sold_or_rented`), location fields, created\_by, timestamps
- `listing_media`: listing\_id, url, sort\_order
- `listing_attributes`: type-specific details (beds, baths, lot area, developer, turnover date), or a JSONB column on `listings`
- `brand_profiles`: logo, primary and accent colors, font pair, agent photo, name, phone, license number
- `poster_templates`: id, type, layout config (JSON), supported sizes
- `video_templates`: id, video\_url, size, duration, slots (JSON), text zones (JSON), music
- `generated_assets`: listing\_id, kind (`poster` | `video` | `caption`), url, status, created\_at
- `chat_sessions` / `chat_messages` (optional)

## 5. Poster feature (decision: template-based)

Decision for now: **HTML/CSS templates**, not AI image generation.

- Fixed canvas (for example 1080x1080 feed, 1080x1920 story), exported to PNG with `html-to-image` or `satori`.
- Variation handled by: `object-fit: cover` for photos, text length limits, optional elements rendered only when data exists.
- **Not every poster should look the same.** Each agent has a **brand kit** (logo, colors, font, photo, contact) that templates read as CSS variables. Add layout variants (photo layout, badge position, footer style) and campaign templates (Just listed, Open house, Price drop, Sold).
- Optional editor step: change headline, toggle elements, pick photos, live preview.
- Later upgrade: AI-generated background with the exact text still overlaid by the template.

## 6. Video feature (decision: green-screen templates)

Decision for now: **template video with green slots**, filled automatically with listing photos (CapCut-style).

How it works:

1. Design a template video with pure green (#00FF00) rectangles where photos go.
2. Store each slot's position, size, and time range as JSON (a script can detect green rectangles to prefill this).
3. Render: listing photos are placed underneath, the template video goes on top with the green keyed out (ffmpeg `colorkey`), then text is drawn over it.

Design rules:

- No other green in the design; keep slot edges sharp; export at a high bitrate.
- Slots should be flat, fixed rectangles (moving or rotating slots need tracking, which is much harder).
- Do not bake price or contact text into the video; leave text zones.
- Fixed format, for example 1080x1920. Put the music in the template.
- Decide a rule for fewer photos than slots (repeat photos, or make templates for 3, 5, and 8 photos).
- Crop photos to fill each slot.
- Alternative: export the template with a real alpha channel to avoid green fringes.
- Remotion (templates as React code) is a second route; check its license terms if the product becomes commercial.
- Use your own designs and licensed music. Do not copy CapCut's templates.

Example template JSON:

```json
{
  "template_id": "modern-reel-01",
  "video_url": "...",
  "size": [1080, 1920],
  "duration": 8,
  "slots": [
    { "x": 140, "y": 500, "w": 800, "h": 600, "start": 0, "end": 3 }
  ],
  "text_zones": [
    { "field": "price", "x": 100, "y": 1500, "font": "Poppins", "size": 64 }
  ]
}
```

## 7. Chatbot

- Call a free-tier LLM from a Next.js API route.
- Ground answers in real listings: query Supabase for matches and pass them as context, so the bot does not invent properties.
- Options: Google AI Studio (Gemini) free tier, with OpenRouter or Groq as a fallback. Free tiers change often; check limits. Gemini's free tier may use data to train models, so avoid private client data. OpenRouter's terms restrict reselling API access, so read them.

## 8. AI options and costs (for later upgrades)

Prices are approximate, from sources checked in October 2026, converted at about PHP 58 per USD. Verify before committing.

**Images**

- ChatGPT app free tier is not the same as the API. The API is paid per image and needs prepaid credits.
- gpt-image-2 via API: about PHP 2 to 5 per image. gpt-image-1-mini is cheaper for drafts. gpt-image-1 and 1.5 are being removed.
- AI-rendered text can contain errors (prices, phone numbers), so show a preview or overlay exact text.

**Video**

- OpenAI no longer offers video: the Sora apps ended in April 2026 and the Sora API was shut down in September 2026. A ChatGPT subscription does not include video.
- Candidates: Seedance 2.0 (about PHP 70 to 140 per 8-second clip), Kling 3.0 Standard (about PHP 58), Veo 3.1 Lite (about PHP 23). Test the same listing on each.
- Test Tagalog or Taglish dialog before promising it.
- Prompt for simple camera moves only (no added rooms or objects) so ads stay truthful.

**ChatGPT subscriptions** (not usable to power the app): Go about PHP 465, Plus about PHP 1,160, Pro about PHP 5,800 per month.

**Free options**

- Text: Gemini free tier, OpenRouter free models, Groq, Cloudflare Workers AI.
- Images: Cloudflare Workers AI (FLUX, Stable Diffusion XL; about 10,000 free neurons per day, shared with text). Google's image free tier is unclear; check their pricing page.
- Video: no truly free AI video API found. Use the template slideshow.

## 9. Payments

- OpenAI API is **pay-as-you-go with prepaid credits**, not a monthly plan.
- It needs a real bank-issued credit or debit card. GCash prepaid cards were reported as declined (community reports, not official). Try a Philippine bank card with online or international payments enabled.
- Payment support for fal, OpenRouter, and Replicate is not verified; check before choosing.
- To charge agents later, PayMongo supports cards, GCash, and GrabPay. A credits system (agents buy credits that cover AI costs) is one option.

## 10. Decisions so far

- Single `listings` table for all listing types.
- Template-based posters (HTML/CSS plus agent brand kits).
- Template-based videos (green-screen slots filled with listing photos).
- Free AI for chatbot and captions; paid AI image and video are optional upgrades.
- Provider-swappable design for all AI services.

## 11. Suggested build order

1. Supabase schema, RLS, and auth
2. Admin CRUD with image upload
3. Public listing pages with filters and search
4. Brand profiles and poster templates
5. Chatbot and AI captions
6. Video templates and render jobs
7. Optional paid AI upgrades (AI backgrounds, AI video clips)

## 12. Open questions

- Where will video rendering run (own machine, small server, or in the browser)?
- Which bank card will be used if paid APIs are added?
- Will agents be charged, and how (credits or subscription)?
- Final name and domain for PALEnvest.
- Which languages must the chatbot and video dialog support?
