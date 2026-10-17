import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { setAgentStatus } from "./action";
import LogoutButton from "@/app/components/LogoutButton";


type AgentRow = {
  id: string;
  phone: string | null;
  invited_by_name: string | null;
  created_at: string;
  profiles: { full_name: string | null } | { full_name: string | null }[] | null;
  teams: { name: string } | { name: string }[] | null;
};

function first<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (me?.role !== "admin") redirect("/login");

  const { data, error } = await supabase
    .from("profile_agents")
    .select(
      "id, phone, invited_by_name, created_at, profiles(full_name), teams(name)"
    )
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  const agents = (data ?? []) as unknown as AgentRow[];

  return (
    <div className="container py-4" style={{ maxWidth: 720 }}>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="h4 mb-0">
          Requests{" "}
          <span className="badge text-bg-primary">{agents.length}</span>
        </h1>
        <LogoutButton />
      </div>

      {error && (
        <div className="alert alert-danger">Could not load requests: {error.message}</div>
      )}

      {agents.length === 0 && !error && (
        <div className="alert alert-light border">No pending requests.</div>
      )}

      {agents.map((a) => {
        const profile = first(a.profiles);
        const team = first(a.teams);
        return (
          <div key={a.id} className="card mb-3">
            <div className="card-body">
              <h2 className="h5 card-title">{profile?.full_name ?? "No name"}</h2>
              <ul className="list-unstyled mb-3 text-muted">
                <li>
                  Mobile:{" "}
                  {a.phone ? <a href={`tel:${a.phone}`}>{a.phone}</a> : "-"}
                </li>
                <li>Team: {team?.name ?? "-"}</li>
                <li>Invited by: {a.invited_by_name ?? "-"}</li>
                <li>
                  Requested:{" "}
                  {new Date(a.created_at).toLocaleDateString("en-PH")}
                </li>
              </ul>

              <div className="d-grid gap-2 d-sm-flex">
                <form action={setAgentStatus} className="flex-sm-fill">
                  <input type="hidden" name="id" value={a.id} />
                  <input type="hidden" name="status" value="approved" />
                  <button className="btn btn-success btn-lg w-100">Approve</button>
                </form>
                <form action={setAgentStatus} className="flex-sm-fill">
                  <input type="hidden" name="id" value={a.id} />
                  <input type="hidden" name="status" value="suspended" />
                  <button className="btn btn-outline-danger btn-lg w-100">Suspend</button>
                </form>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}