import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "@/app/components/LogoutButton";


export default async function PendingPage() {
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

  if (agent?.status === "approved") redirect("/agent");

  return (
    <div className="container py-4" style={{ maxWidth: 480 }}>
      {agent?.status === "suspended" ? (
        <div className="alert alert-danger">
          Your account is suspended. Please contact the administrator.
        </div>
      ) : (
        <div className="alert alert-info">
          <h5 className="alert-heading">Waiting for approval</h5>
          An administrator is reviewing your account. You will be able to
          publish listings once it is approved.
        </div>
      )}
      <LogoutButton />
    </div>
  );
}