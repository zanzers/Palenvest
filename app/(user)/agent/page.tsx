import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AgentNav from "@/app/components/AgentNav";

export default async function AgentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
  if (agent?.status !== "approved") redirect("/login");

  return (
    <>
      <AgentNav />
      <main>{children}</main>
      {/* keeps content clear of the mobile bottom bar */}
      <div className="d-md-none" style={{ height: 96 }} />
    </>
  );
}