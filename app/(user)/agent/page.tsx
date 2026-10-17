import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "@/app/components/LogoutButton";


export default async function AgentPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: agent } = await supabase
    .from("profile_agents")
    .select("status")
    .eq("id", user.id)
    .single();

  if (agent?.status !== "approved") redirect("/pending");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="h4 mb-0">Agent dashboard</h1>
        <LogoutButton />
      </div>
      <p>Welcome, {profile?.full_name}.</p>
    </div>
  );
}