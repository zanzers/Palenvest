"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Team = { id: number; name: string };

export default function SignUpPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    team_id: "",
    invited_by_name: "",
    email: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    createClient()
      .from("teams")
      .select("id, name")
      .order("name")
      .then(({ data }) => setTeams(data ?? []));
  }, []);

  const update =
    (field: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm({ ...form, [field]: e.target.value });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name: form.full_name,
          phone: form.phone,
          team_id: form.team_id,
          invited_by_name: form.invited_by_name,
        },
      },
    });
   
    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    };

    await supabase.auth.signOut();
    setLoading(false);
    setDone(true);
  }

    if (done) {
    return (
      <div className="container py-4" style={{ maxWidth: 480 }}>
        <div className="alert alert-success">
          <h5 className="alert-heading">Request sent</h5>
          Your account was created. Waiting for the admin to approve your
          request. Please contact the admin.
        </div>
        <Link href="/login" className="btn btn-outline-primary btn-lg w-100">
          Go to login
        </Link>
      </div>
    );
  }



  return (
    <div className="container py-4" style={{ maxWidth: 480 }}>
      <h1 className="h3 mb-1">Agent sign up</h1>
      <p className="text-muted">
        New accounts are reviewed by an administrator before they are activated.
      </p>

      {error && <div className="alert alert-danger">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="form-label" htmlFor="full_name">Full name</label>
          <input
            id="full_name"
            className="form-control form-control-lg"
            autoComplete="name"
            required
            value={form.full_name}
            onChange={update("full_name")}
          />
        </div>

        <div className="mb-3">
          <label className="form-label" htmlFor="phone">Mobile number</label>
          <input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="09xx xxx xxxx"
            className="form-control form-control-lg"
            required
            value={form.phone}
            onChange={update("phone")}
          />
        </div>

        <div className="mb-3">
          <label className="form-label" htmlFor="team_id">Team</label>
          <select
            id="team_id"
            className="form-select form-select-lg"
            required
            value={form.team_id}
            onChange={update("team_id")}
          >
            <option value="">Select your team</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <div className="form-text">
            Team not listed? Ask your team leader to contact the admin.
          </div>
        </div>

        <div className="mb-3">
          <label className="form-label" htmlFor="invited_by_name">Who invited you?</label>
          <input
            id="invited_by_name"
            className="form-control form-control-lg"
            placeholder="e.g. Ramos"
            required
            value={form.invited_by_name}
            onChange={update("invited_by_name")}
          />
        </div>

        <div className="mb-3">
          <label className="form-label" htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            className="form-control form-control-lg"
            required
            value={form.email}
            onChange={update("email")}
          />
        </div>

        <div className="mb-4">
          <label className="form-label" htmlFor="password">Password</label>
          <div className="input-group input-group-lg">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              className="form-control"
              required
              minLength={8}
              value={form.password}
              onChange={update("password")}
            />
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          <div className="form-text">At least 8 characters.</div>
        </div>

        <button className="btn btn-primary btn-lg w-100" disabled={loading}>
          {loading ? "Creating account..." : "Create account"}
        </button>
      </form>

      <p className="mt-3 mb-0 text-center">
        Already registered? <Link href="/login">Log in</Link>
      </p>
    </div>
  );
}