"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createListing } from "./actions";

type Option = { id: number; name: string };
type Photo = { id: string; file: File; url: string };
type Stage = "input" | "reading" | "preview";

type UnitRow = {
  key: string;
  name: string;
  lot_area_sqm: string;
  floor_area_sqm: string;
  bedrooms: string;
  bathrooms: string;
  parking_slots: string;
  balconies: string;
  price_from: string;
};

type Fields = {
  type: string;
  property_type_id: string;
  title: string;
  description: string;
  price: string;
  price_text: string;
  city: string;
  province: string;
  barangay: string;
  street_address: string;
  latitude: string;
  longitude: string;
  bedrooms: string;
  bathrooms: string;
  parking_slots: string;
  floor_area_sqm: string;
  lot_area_sqm: string;
  site_area_hectares: string;
  total_units: string;
  promo_title: string;
  promo_details: string;
  promo_ends_on: string;
  amenity_ids: number[];
  units: UnitRow[];
};
type TextKey = Exclude<keyof Fields, "amenity_ids" | "units">;
type UnitKey = Exclude<keyof UnitRow, "key">;

interface ApiUnit {
  name?: string;
  lot_area_sqm?: number | null;
  floor_area_sqm?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  parking_slots?: number | null;
  balconies?: number | null;
  price_from?: number | null;
}
interface ApiDraft {
  type?: string;
  title?: string;
  description?: string;
  property_type_id?: number | null;
  price?: number | null;
  price_text?: string | null;
  city?: string | null;
  province?: string | null;
  barangay?: string | null;
  street_address?: string | null;
  site_area_hectares?: number | null;
  total_units?: number | null;
  promo_title?: string | null;
  promo_details?: string | null;
  promo_ends_on?: string | null;
  units?: ApiUnit[];
}

const MAX_PHOTOS = 20;
const MAX_TEXT = 3000;

const EMPTY: Fields = {
  type: "rental",
  property_type_id: "",
  title: "",
  description: "",
  price: "",
  price_text: "",
  city: "",
  province: "",
  barangay: "",
  street_address: "",
  latitude: "",
  longitude: "",
  bedrooms: "",
  bathrooms: "",
  parking_slots: "",
  floor_area_sqm: "",
  lot_area_sqm: "",
  site_area_hectares: "",
  total_units: "",
  promo_title: "",
  promo_details: "",
  promo_ends_on: "",
  amenity_ids: [],
  units: [],
};

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const n = (v: string) => {
  if (v.trim() === "") return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
};

function emptyUnit(): UnitRow {
  return {
    key: uid(),
    name: "",
    lot_area_sqm: "",
    floor_area_sqm: "",
    bedrooms: "",
    bathrooms: "",
    parking_slots: "",
    balconies: "",
    price_from: "",
  };
}

function draftToFields(d: ApiDraft): Fields {
  return {
    ...EMPTY,
    type: d.type ?? "rental",
    property_type_id: s(d.property_type_id),
    title: s(d.title),
    description: s(d.description),
    price: s(d.price),
    price_text: s(d.price_text),
    city: s(d.city),
    province: s(d.province),
    barangay: s(d.barangay),
    street_address: s(d.street_address),
    site_area_hectares: s(d.site_area_hectares),
    total_units: s(d.total_units),
    promo_title: s(d.promo_title),
    promo_details: s(d.promo_details),
    promo_ends_on: s(d.promo_ends_on),
    units: (d.units ?? []).map((u) => ({
      key: uid(),
      name: s(u.name),
      lot_area_sqm: s(u.lot_area_sqm),
      floor_area_sqm: s(u.floor_area_sqm),
      bedrooms: s(u.bedrooms),
      bathrooms: s(u.bathrooms),
      parking_slots: s(u.parking_slots),
      balconies: s(u.balconies),
      price_from: s(u.price_from),
    })),
  };
}

async function compressImage(file: File, maxSize = 1600, quality = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not resize photo"))),
      "image/jpeg",
      quality
    )
  );
}

const UNIT_FIELDS: [UnitKey, string][] = [
  ["lot_area_sqm", "Lot area (sqm)"],
  ["floor_area_sqm", "Floor area (sqm)"],
  ["bedrooms", "Bedrooms"],
  ["bathrooms", "T&B / bathrooms"],
  ["parking_slots", "Carport / parking"],
  ["balconies", "Balcony"],
  ["price_from", "Price from (₱)"],
];

export default function ListingForm({
  propertyTypes,
  amenities,
}: {
  propertyTypes: Option[];
  amenities: Option[];
}) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("input");
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [f, setF] = useState<Fields>(EMPTY);
  const [flags, setFlags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  const set =
    (key: TextKey) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setF((p) => ({ ...p, [key]: e.target.value }));

  const setUnit = (key: string, field: UnitKey, value: string) =>
    setF((p) => ({
      ...p,
      units: p.units.map((u) => (u.key === key ? { ...u, [field]: value } : u)),
    }));

  const toggleAmenity = (id: number) =>
    setF((p) => ({
      ...p,
      amenity_ids: p.amenity_ids.includes(id)
        ? p.amenity_ids.filter((a) => a !== id)
        : [...p.amenity_ids, id],
    }));

  function addPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).filter((file) =>
      file.type.startsWith("image/")
    );
    e.target.value = "";
    const room = MAX_PHOTOS - photos.length;
    if (files.length > room) setError(`You can add up to ${MAX_PHOTOS} photos.`);
    const added = files.slice(0, Math.max(room, 0)).map((file) => ({
      id: uid(),
      file,
      url: URL.createObjectURL(file),
    }));
    setPhotos((p) => [...p, ...added]);
  }

  function removePhoto(id: string) {
    const target = photos.find((p) => p.id === id);
    if (target) URL.revokeObjectURL(target.url);
    setPhotos((p) => p.filter((x) => x.id !== id));
  }

  function makeCover(id: string) {
    const target = photos.find((p) => p.id === id);
    if (!target) return;
    setPhotos((p) => [target, ...p.filter((x) => x.id !== id)]);
  }

  async function readPost() {
    setError(null);
    if (!text.trim()) {
      setError("Paste the post first.");
      return;
    }
    setStage("reading");
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data: { draft?: ApiDraft; flags?: string[]; error?: string } = await res.json();
      if (!res.ok || !data.draft) {
        setStage("input");
        setError(data.error ?? "Could not read the post.");
        return;
      }
      setF(draftToFields(data.draft));
      setFlags(data.flags ?? []);
      setStage("preview");
    } catch {
      setStage("input");
      setError("Network problem. Try again, or fill in the form yourself.");
    }
  }

  function fillManually() {
    setError(null);
    setF({ ...EMPTY, description: text.normalize("NFKC").slice(0, MAX_TEXT) });
    setFlags([]);
    setStage("preview");
  }

  function fillCurrentLocation() {
    setLocError(null);
    if (!navigator.geolocation) {
      setLocError("Location is not supported on this device.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setF((p) => ({
          ...p,
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
        }));
        setLocating(false);
      },
      () => {
        setLocError("Could not get your location. Allow access or enter it manually.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function save() {
    setError(null);
    if (!f.property_type_id) {
      setError("Choose a property type.");
      return;
    }
    if (!f.title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!f.city.trim()) {
      setError("City is required.");
      return;
    }

    const isDev = f.type === "dev_project";
    const payload = {
      type: f.type,
      property_type_id: Number(f.property_type_id),
      title: f.title.trim(),
      description: f.description,
      price: n(f.price),
      city: f.city.trim(),
      province: f.province.trim(),
      barangay: f.barangay.trim(),
      street_address: f.street_address.trim(),
      latitude: n(f.latitude),
      longitude: n(f.longitude),
      specs: {
        bedrooms: n(f.bedrooms),
        bathrooms: n(f.bathrooms),
        parking_slots: n(f.parking_slots),
        floor_area_sqm: n(f.floor_area_sqm),
        lot_area_sqm: n(f.lot_area_sqm),
      },
      amenity_ids: f.amenity_ids,
      units: isDev
        ? f.units
            .filter((u) => u.name.trim())
            .map((u) => ({
              name: u.name.trim(),
              lot_area_sqm: n(u.lot_area_sqm),
              floor_area_sqm: n(u.floor_area_sqm),
              bedrooms: n(u.bedrooms),
              bathrooms: n(u.bathrooms),
              parking_slots: n(u.parking_slots),
              balconies: n(u.balconies),
              price_from: n(u.price_from),
            }))
        : [],
      site_area_hectares: isDev ? n(f.site_area_hectares) : null,
      total_units: isDev ? n(f.total_units) : null,
      promo: f.promo_title.trim()
        ? {
            title: f.promo_title.trim(),
            details: f.promo_details.trim(),
            ends_on: f.promo_ends_on || null,
          }
        : null,
    };

    setSaving(true);
    setProgress("Saving listing...");
    const result = await createListing(payload);
    if ("error" in result) {
      setSaving(false);
      setProgress(null);
      setError(result.error);
      return;
    }

    const supabase = createClient();
    const uploaded: string[] = [];
    try {
      for (let i = 0; i < photos.length; i++) {
        setProgress(`Uploading photo ${i + 1} of ${photos.length}...`);
        const blob = await compressImage(photos[i].file);
        const path = `${result.agentId}/${result.id}/${uid()}.jpg`;
        const { error: upError } = await supabase.storage
          .from("listing-media")
          .upload(path, blob, { contentType: "image/jpeg" });
        if (upError) throw upError;
        uploaded.push(path);
      }

      if (uploaded.length > 0) {
        const rows = uploaded.map((path, i) => ({
          listing_id: result.id,
          storage_path: path,
          url: supabase.storage.from("listing-media").getPublicUrl(path).data.publicUrl,
          sort_order: i,
        }));
        const { error: dbError } = await supabase.from("listing_media").insert(rows);
        if (dbError) throw dbError;
      }
    } catch {
      if (uploaded.length > 0) {
        await supabase.storage.from("listing-media").remove(uploaded);
      }
      await supabase.from("listings").delete().eq("id", result.id);
      setSaving(false);
      setProgress(null);
      setError(
        "The photos could not be uploaded, so nothing was saved. Check your connection and try again."
      );
      return;
    }

    router.push("/agent/listings?created=1");
    router.refresh();
  }

  const PhotoGrid = (
    <>
      {photos.length > 0 && (
        <div className="row g-2 mt-1">
          {photos.map((p, i) => (
            <div className="col-4" key={p.id}>
              <div className="position-relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url}
                  alt=""
                  className="w-100 rounded"
                  style={{ aspectRatio: "1", objectFit: "cover" }}
                />
                {i === 0 && (
                  <span className="badge text-bg-primary position-absolute top-0 start-0 m-1">
                    Cover
                  </span>
                )}
              </div>
              <div className="d-flex gap-1 mt-1">
                {i !== 0 && (
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm flex-fill"
                    onClick={() => makeCover(p.id)}
                    disabled={saving}
                  >
                    Cover
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-outline-danger btn-sm flex-fill"
                  onClick={() => removePhoto(p.id)}
                  disabled={saving}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );

  /* ---------- Screen 1: paste and upload ---------- */
  if (stage !== "preview") {
    const reading = stage === "reading";
    return (
      <div>
        {error && <div className="alert alert-danger">{error}</div>}

        <div className="card mb-3">
          <div className="card-body">
            <label className="form-label fw-semibold" htmlFor="post">
              Paste the post here
            </label>
            <textarea
              id="post"
              rows={9}
              maxLength={MAX_TEXT}
              className="form-control form-control-lg"
              placeholder="Paste the developer's post or your own description"
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={reading}
            />
            <div className="form-text text-end">
              {text.length} / {MAX_TEXT}
            </div>
          </div>
        </div>

        <div className="card mb-3">
          <div className="card-body">
            <label className="form-label fw-semibold" htmlFor="photos">
              Upload images
            </label>
            <input
              id="photos"
              type="file"
              accept="image/*"
              multiple
              className="form-control form-control-lg"
              onChange={addPhotos}
              disabled={reading}
            />
            <div className="form-text">
              Up to {MAX_PHOTOS} photos. Only the text is read by the AI, not the photos.
            </div>
            {PhotoGrid}
          </div>
        </div>

        <button
          className="btn btn-primary btn-lg w-100 mb-2"
          onClick={readPost}
          disabled={reading || !text.trim()}
        >
          {reading ? "Reading your post..." : "Read details"}
        </button>
        <button
          className="btn btn-link w-100"
          onClick={fillManually}
          disabled={reading}
        >
          Fill in manually instead
        </button>
      </div>
    );
  }

  /* ---------- Screen 2: preview and edit ---------- */
  const isDev = f.type === "dev_project";
  const priceFlagged = flags.includes("price");

  return (
    <div>
      {error && <div className="alert alert-danger">{error}</div>}

      <div className="alert alert-info">
        Please check everything before saving. Nothing is saved yet.
        {flags.length > 0 && (
          <div className="mt-2">
            <strong>Not clearly stated in the post, please check:</strong>{" "}
            {flags.join(", ")}
          </div>
        )}
      </div>

      <details className="card mb-3">
        <summary className="card-body py-2 small text-muted">Show original post</summary>
        <div className="card-body pt-0">
          <pre className="small mb-0" style={{ whiteSpace: "pre-wrap" }}>
            {text.normalize("NFKC")}
          </pre>
        </div>
      </details>

      {/* Info */}
      <div className="card mb-3">
        <div className="card-body">
          <h2 className="h6 text-uppercase text-muted mb-3">Info</h2>

          <div className="mb-3">
            <label className="form-label" htmlFor="type">Listing type</label>
            <select id="type" className="form-select form-select-lg" value={f.type} onChange={set("type")}>
              <option value="rental">Rental</option>
              <option value="brokerage">Brokerage (for sale)</option>
              <option value="dev_project">Development project</option>
            </select>
          </div>

          <div className="mb-3">
            <label className="form-label" htmlFor="property_type_id">Property type</label>
            <select
              id="property_type_id"
              className={`form-select form-select-lg ${f.property_type_id ? "" : "is-invalid"}`}
              value={f.property_type_id}
              onChange={set("property_type_id")}
            >
              <option value="">Select property type</option>
              {propertyTypes.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="mb-3">
            <label className="form-label" htmlFor="title">Title</label>
            <input id="title" maxLength={120} className="form-control form-control-lg" value={f.title} onChange={set("title")} />
          </div>

          <div className="mb-3">
            <label className="form-label" htmlFor="price">
              {f.type === "rental" ? "Monthly rent (₱)" : "Price (₱)"}{" "}
              <span className="text-muted">(optional)</span>
            </label>
            <input
              id="price"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              className={`form-control form-control-lg ${priceFlagged && !f.price ? "is-invalid" : ""}`}
              value={f.price}
              onChange={set("price")}
            />
            {f.price_text && (
              <div className="form-text">From the post: “{f.price_text}”</div>
            )}
            {priceFlagged && !f.price && (
              <div className="invalid-feedback">
                The price was not clearly stated in the post. Enter it if you have it.
              </div>
            )}
          </div>

          <div>
            <label className="form-label" htmlFor="description">Description</label>
            <textarea
              id="description"
              rows={6}
              maxLength={MAX_TEXT}
              className="form-control form-control-lg"
              value={f.description}
              onChange={set("description")}
            />
          </div>
        </div>
      </div>

      {/* Promo */}
      <div className="card mb-3">
        <div className="card-body">
          <h2 className="h6 text-uppercase text-muted mb-1">Limited promo</h2>
          <div className="form-text mb-3">
            Optional. Shown highlighted to the public. Leave the title empty for no promo.
          </div>
          <div className="mb-3">
            <label className="form-label" htmlFor="promo_title">Promo title</label>
            <input
              id="promo_title"
              maxLength={80}
              className="form-control form-control-lg"
              placeholder="e.g. 50% off reservation fee"
              value={f.promo_title}
              onChange={set("promo_title")}
            />
          </div>
          {f.promo_title.trim() && (
            <>
              <div className="mb-3">
                <label className="form-label" htmlFor="promo_details">Conditions</label>
                <textarea
                  id="promo_details"
                  rows={2}
                  maxLength={500}
                  className="form-control form-control-lg"
                  value={f.promo_details}
                  onChange={set("promo_details")}
                />
              </div>
              <div>
                <label className="form-label" htmlFor="promo_ends_on">Ends on</label>
                <input
                  id="promo_ends_on"
                  type="date"
                  className="form-control form-control-lg"
                  value={f.promo_ends_on}
                  onChange={set("promo_ends_on")}
                />
                <div className="form-text">Leave empty for “while slots last”.</div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* House types (developments) */}
      {isDev && (
        <div className="card mb-3">
          <div className="card-body">
            <h2 className="h6 text-uppercase text-muted mb-3">House types</h2>

            {f.units.map((u) => (
              <div className="border rounded p-3 mb-3" key={u.key}>
                <div className="mb-3">
                  <label className="form-label">Name</label>
                  <input
                    className="form-control form-control-lg"
                    placeholder="e.g. Townhouse"
                    value={u.name}
                    onChange={(e) => setUnit(u.key, "name", e.target.value)}
                  />
                </div>
                <div className="row g-2">
                  {UNIT_FIELDS.map(([field, label]) => (
                    <div className="col-6" key={field}>
                      <label className="form-label small">{label}</label>
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="any"
                        className="form-control"
                        value={u[field]}
                        onChange={(e) => setUnit(u.key, field, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="btn btn-outline-danger btn-sm mt-3"
                  onClick={() => setF((p) => ({ ...p, units: p.units.filter((x) => x.key !== u.key) }))}
                >
                  Remove this house type
                </button>
              </div>
            ))}

            <button
              type="button"
              className="btn btn-outline-primary w-100 mb-3"
              onClick={() => setF((p) => ({ ...p, units: [...p.units, emptyUnit()] }))}
            >
              + Add house type
            </button>

            <div className="row g-3">
              <div className="col-6">
                <label className="form-label" htmlFor="site_area_hectares">Site area (hectares)</label>
                <input
                  id="site_area_hectares"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  className="form-control form-control-lg"
                  value={f.site_area_hectares}
                  onChange={set("site_area_hectares")}
                />
              </div>
              <div className="col-6">
                <label className="form-label" htmlFor="total_units">Total units</label>
                <input
                  id="total_units"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  className="form-control form-control-lg"
                  value={f.total_units}
                  onChange={set("total_units")}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Location */}
      <div className="card mb-3">
        <div className="card-body">
          <h2 className="h6 text-uppercase text-muted mb-3">Location</h2>

          <button
            type="button"
            className="btn btn-outline-primary w-100 mb-2"
            onClick={fillCurrentLocation}
            disabled={locating}
          >
            {locating ? "Locating..." : "Use my current location"}
          </button>
          {locError && <div className="text-danger small mb-2">{locError}</div>}
          <div className="form-text mb-3">A map with a draggable pin is coming.</div>

          <div className="mb-3">
            <label className="form-label" htmlFor="city">City / Municipality</label>
            <input
              id="city"
              className={`form-control form-control-lg ${f.city ? "" : "is-invalid"}`}
              value={f.city}
              onChange={set("city")}
            />
          </div>
          <div className="mb-3">
            <label className="form-label" htmlFor="province">Province</label>
            <input id="province" className="form-control form-control-lg" value={f.province} onChange={set("province")} />
          </div>
          <div className="mb-3">
            <label className="form-label" htmlFor="barangay">Barangay</label>
            <input id="barangay" className="form-control form-control-lg" value={f.barangay} onChange={set("barangay")} />
          </div>
          <div className="mb-3">
            <label className="form-label" htmlFor="street_address">Street address</label>
            <input id="street_address" className="form-control form-control-lg" value={f.street_address} onChange={set("street_address")} />
          </div>
          <div className="row g-3">
            <div className="col-6">
              <label className="form-label" htmlFor="latitude">Latitude</label>
              <input id="latitude" type="number" step="any" inputMode="decimal" className="form-control form-control-lg" value={f.latitude} onChange={set("latitude")} />
            </div>
            <div className="col-6">
              <label className="form-label" htmlFor="longitude">Longitude</label>
              <input id="longitude" type="number" step="any" inputMode="decimal" className="form-control form-control-lg" value={f.longitude} onChange={set("longitude")} />
            </div>
          </div>
        </div>
      </div>

      {/* Gallery */}
      <div className="card mb-3">
        <div className="card-body">
          <h2 className="h6 text-uppercase text-muted mb-3">Gallery</h2>
          <input
            type="file"
            accept="image/*"
            multiple
            className="form-control form-control-lg"
            onChange={addPhotos}
            disabled={saving}
          />
          <div className="form-text">The first photo is the cover.</div>
          {PhotoGrid}
        </div>
      </div>

      {/* More details */}
      <details className="card mb-4">
        <summary className="card-body fw-semibold">
          More details <span className="text-muted fw-normal">(optional)</span>
        </summary>
        <div className="card-body pt-0">
          {!isDev && (
            <div className="row g-3 mb-3">
              {(
                [
                  ["bedrooms", "Bedrooms"],
                  ["bathrooms", "Bathrooms"],
                  ["parking_slots", "Parking slots"],
                  ["floor_area_sqm", "Floor area (sqm)"],
                  ["lot_area_sqm", "Lot area (sqm)"],
                ] as [TextKey, string][]
              ).map(([key, label]) => (
                <div className="col-6" key={key}>
                  <label className="form-label" htmlFor={key}>{label}</label>
                  <input
                    id={key}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="any"
                    className="form-control form-control-lg"
                    value={f[key]}
                    onChange={set(key)}
                  />
                </div>
              ))}
            </div>
          )}

          <div className="form-label">Amenities</div>
          <div className="row row-cols-2 g-2">
            {amenities.map((a) => (
              <div className="col" key={a.id}>
                <div className="form-check">
                  <input
                    id={`amenity-${a.id}`}
                    className="form-check-input"
                    type="checkbox"
                    checked={f.amenity_ids.includes(a.id)}
                    onChange={() => toggleAmenity(a.id)}
                  />
                  <label className="form-check-label" htmlFor={`amenity-${a.id}`}>
                    {a.name}
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>
      </details>

      <div className="d-grid gap-2">
        <button className="btn btn-primary btn-lg" onClick={save} disabled={saving}>
          {saving ? (progress ?? "Saving...") : "Save as draft"}
        </button>
        <button
          className="btn btn-outline-secondary"
          onClick={() => setStage("input")}
          disabled={saving}
        >
          Back to the post
        </button>
      </div>
    </div>
  );
}