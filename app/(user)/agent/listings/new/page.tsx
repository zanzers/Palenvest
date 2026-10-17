import { createClient } from "@/lib/supabase/server";
import ListingForm from "./ListingForm";

export default async function NewListingPage() {
  const supabase = await createClient();
  const [{ data: propertyTypes }, { data: amenities }] = await Promise.all([
    supabase.from("property_types").select("id, name").order("name"),
    supabase.from("amenities").select("id, name").order("name"),
  ]);

  return (
    <div className="container py-4" style={{ maxWidth: 640 }}>
      <h1 className="h4 mb-3">New listing</h1>
      <ListingForm
        propertyTypes={propertyTypes ?? []}
        amenities={amenities ?? []}
      />
    </div>
  );
}