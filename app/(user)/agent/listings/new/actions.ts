"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const nn = (max: number) => z.number().min(0).max(max).nullable();

const Unit = z.object({
  name: z.string().trim().min(1).max(60),
  lot_area_sqm: nn(100000),
  floor_area_sqm: nn(100000),
  bedrooms: nn(50),
  bathrooms: nn(50),
  parking_slots: nn(50),
  balconies: nn(50),
  price_from: nn(5_000_000_000),
});

const Payload = z
  .object({
    type: z.enum(["rental", "brokerage", "dev_project"]),
    property_type_id: z.number().int(),
    title: z.string().trim().min(1, "Title is required.").max(120),
    description: z.string().max(3000),
    price: nn(5_000_000_000),
    city: z.string().trim().min(1, "City is required."),
    province: z.string().trim(),
    barangay: z.string().trim(),
    street_address: z.string().trim(),
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
    specs: z.object({
      bedrooms: nn(50),
      bathrooms: nn(50),
      parking_slots: nn(50),
      floor_area_sqm: nn(100000),
      lot_area_sqm: nn(1000000),
    }),
    amenity_ids: z.array(z.number().int()),
    units: z.array(Unit).max(30),
    site_area_hectares: nn(100000),
    total_units: nn(1000000),
    promo: z
      .object({
        title: z.string().trim().min(1).max(80),
        details: z.string().trim().max(500),
        ends_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
      })
      .nullable(),
  })
  .refine((p) => (p.latitude === null) === (p.longitude === null), {
    message: "Enter both latitude and longitude, or leave both empty.",
  });

export type CreateResult = { error: string } | { id: string; agentId: string };

export async function createListing(input: unknown): Promise<CreateResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You are not logged in." };

  const parsed = Payload.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  }
  const p = parsed.data;

  const { data: areaId, error: areaError } = await supabase.rpc("get_or_create_area", {
    p_province: p.province,
    p_city: p.city,
    p_barangay: p.barangay,
  });
  if (areaError) return { error: areaError.message };

  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .insert({
      agent_id: user.id,
      type: p.type,
      status: "draft",
      title: p.title,
      property_type_id: p.property_type_id,
    })
    .select("id")
    .single();
  if (listingError || !listing) {
    return { error: listingError?.message ?? "Could not create the listing." };
  }
  const id = listing.id;

  const jobs: PromiseLike<{ error: { message: string } | null }>[] = [
    supabase.from("listing_details").insert({
      listing_id: id,
      description: p.description.normalize("NFKC") || null,
      price: p.price,
      price_unit: p.type === "rental" ? "per_month" : "total",
    }),
    supabase.from("locations").insert({
      listing_id: id,
      area_id: areaId,
      street_address: p.street_address || null,
      latitude: p.latitude,
      longitude: p.longitude,
    }),
  ];

  if (p.type !== "dev_project") {
    jobs.push(supabase.from("property_specs").insert({ listing_id: id, ...p.specs }));
  }
  if (p.amenity_ids.length) {
    jobs.push(
      supabase
        .from("listing_amenities")
        .insert(p.amenity_ids.map((amenity_id) => ({ listing_id: id, amenity_id })))
    );
  }
  if (p.type === "dev_project") {
    if (p.units.length) {
      jobs.push(
        supabase.from("project_units").insert(
          p.units.map((u) => ({
            listing_id: id,
            unit_name: u.name,
            lot_area_sqm: u.lot_area_sqm,
            floor_area_sqm: u.floor_area_sqm,
            bedrooms: u.bedrooms,
            bathrooms: u.bathrooms,
            parking_slots: u.parking_slots,
            balconies: u.balconies,
            price_from: u.price_from,
          }))
        )
      );
    }
    if (p.site_area_hectares !== null || p.total_units !== null) {
      jobs.push(
        supabase.from("dev_project_details").insert({
          listing_id: id,
          site_area_hectares: p.site_area_hectares,
          total_units: p.total_units,
        })
      );
    }
  }
  if (p.promo) {
    jobs.push(
      supabase.from("listing_promos").insert({
        listing_id: id,
        title: p.promo.title,
        details: p.promo.details || null,
        ends_on: p.promo.ends_on,
      })
    );
  }

  const results = await Promise.all(jobs);
  const failed = results.find((r) => r.error);
  if (failed?.error) {
    await supabase.from("listings").delete().eq("id", id);
    return { error: failed.error.message };
  }

  return { id, agentId: user.id };
}