import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const MAX_TEXT = 3000;

const Unit = z.object({
  name: z.string(),
  lot_area_sqm: z.number().nullish(),
  floor_area_sqm: z.number().nullish(),
  bedrooms: z.number().nullish(),
  bathrooms: z.number().nullish(),
  parking_slots: z.number().nullish(),
  balconies: z.number().nullish(),
  price_from: z.number().nullish(),
});

const Draft = z.object({
  type: z.enum(["rental", "brokerage", "dev_project"]),
  title: z.string(),
  description: z.string(),
  property_type: z.string().nullish(),
  street_address: z.string().nullish(),
  barangay: z.string().nullish(),
  city: z.string().nullish(),
  province: z.string().nullish(),
  price: z.number().nullish(),
  price_text: z.string().nullish(),
  site_area_hectares: z.number().nullish(),
  total_units: z.number().nullish(),
  promo_title: z.string().nullish(),
  promo_details: z.string().nullish(),
  promo_quote: z.string().nullish(),
  promo_ends_on: z.string().nullish(),
  units: z.array(Unit).default([]),
});

function buildPrompt(propertyTypes: string[]) {
  return `You extract real estate listing data from a social media post
written in English or Taglish (Philippines). Return ONLY a JSON object with these keys:
type, title, description, property_type, street_address, barangay, city, province,
price, price_text, site_area_hectares, total_units, promo_title, promo_details,
promo_quote, promo_ends_on, units (array of: name, lot_area_sqm, floor_area_sqm,
bedrooms, bathrooms, parking_slots, balconies, price_from).

Rules:
- Use null for anything not clearly stated. Never guess or invent prices, areas, or numbers.
- type: "dev_project" for developer projects with several house or unit types,
  "rental" for rent, "brokerage" for a single property for sale.
- title: the project or property name in normal capitalization.
- description: facts about the property only, as clean plain text. Do not include the
  promo, marketing hype, emojis, or the phone number.
- property_type: exactly one of [${propertyTypes.join(", ")}], or null if unsure.
  For a development of houses, use the closest house option.
- price: one number in pesos only if a clear price is stated. "PM for pricing" means null.
  price_text: the exact words from the post that state the price, copied exactly.
- promo: only if the post advertises a limited offer (discount, waived fees, first N buyers,
  promo price). promo_title is a short headline (max 60 characters), promo_details has the
  conditions, promo_quote is the exact words from the post, copied exactly.
  promo_ends_on is YYYY-MM-DD only if a full date with year is stated, otherwise null.
  If there is no promo, all four promo fields are null.
- site_area_hectares and total_units only if the post states them.
- units: one entry per house or unit type named in the post.
  T&B means toilet and bath (bathrooms). Carport or garage counts as parking_slots.`;
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

function checkDraft(draft: z.infer<typeof Draft>, text: string) {
  const flags: string[] = [];
  const source = norm(text);
  const inPost = (quote?: string | null) => !!quote && source.includes(norm(quote));

  if (draft.price != null) {
    if (!inPost(draft.price_text) || draft.price <= 0 || draft.price > 5_000_000_000) {
      draft.price = null;
      flags.push("price");
    }
  }

  if (draft.promo_title) {
    if (!inPost(draft.promo_quote)) {
      draft.promo_title = null;
      draft.promo_details = null;
      draft.promo_ends_on = null;
      flags.push("promo");
    }
  }
  if (draft.promo_ends_on && !/^\d{4}-\d{2}-\d{2}$/.test(draft.promo_ends_on)) {
    draft.promo_ends_on = null;
  }

  for (const u of draft.units) {
    for (const key of ["lot_area_sqm", "floor_area_sqm"] as const) {
      const v = u[key];
      if (v != null && (v <= 0 || v > 100000)) {
        u[key] = null;
        flags.push(`${u.name}: ${key}`);
      }
    }
    if (u.bedrooms != null && (u.bedrooms < 0 || u.bedrooms > 20)) {
      u.bedrooms = null;
      flags.push(`${u.name}: bedrooms`);
    }
  }
  return flags;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const { data: agent } = await supabase
    .from("profile_agents")
    .select("status")
    .eq("id", user.id)
    .single();
  if (agent?.status !== "approved") {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const body = await request.json();
  // NFKC turns styled Unicode letters into plain letters
  const text = String(body.text ?? "").normalize("NFKC").trim();
  if (!text) {
    return NextResponse.json({ error: "Paste the post first." }, { status: 400 });
  }
  if (text.length > MAX_TEXT) {
    return NextResponse.json(
      { error: `The post is too long (max ${MAX_TEXT} characters). Remove hashtags or repeated lines.` },
      { status: 400 }
    );
  }

  const { data: types } = await supabase.from("property_types").select("id, name");
  const propertyTypes = types ?? [];

  let raw: string | undefined;
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL!,
      contents: `${buildPrompt(propertyTypes.map((t) => t.name))}\n\nPOST:\n${text}`,
      config: { responseMimeType: "application/json" },
    });
    raw = response.text;
  } catch {
    return NextResponse.json(
      { error: "The AI service is busy or unavailable. You can fill in the form yourself." },
      { status: 502 }
    );
  }

  try {
    const draft = Draft.parse(JSON.parse(raw ?? ""));
    const flags = checkDraft(draft, text);
    const matched = propertyTypes.find(
      (t) => t.name.toLowerCase() === (draft.property_type ?? "").toLowerCase()
    );
    return NextResponse.json({
      draft: { ...draft, property_type_id: matched?.id ?? null },
      flags,
    });
  } catch {
    return NextResponse.json(
      { error: "Could not read the post. Try again, or fill in the form yourself." },
      { status: 422 }
    );
  }
}