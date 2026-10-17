"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      setLoading(false);
      setError(error?.message ?? "Could not log in.");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    if (profile?.role === "admin") {
      router.push("/admin");
      router.refresh();
      return;
    }

    const { data: agent } = await supabase
      .from("profile_agents")
      .select("status")
      .eq("id", data.user.id)
      .single();

    if (agent?.status === "approved") {
      router.push("/agent");
      router.refresh();
      return;
    }

    // Not approved: end the session and explain on this page
    await supabase.auth.signOut();
    setLoading(false);

    if (agent?.status === "pending") {
      setNotice(
        "Waiting for the admin to approve your request. Please contact the admin."
      );
    } else if (agent?.status === "suspended") {
      setNotice("Your account is suspended. Please contact the admin.");
    } else {
      setError("Your account is not set up yet. Please contact the admin.");
    }
  }

  return (
    <div className="container py-4" style={{ maxWidth: 480 }}>
      <h1 className="h3 mb-3">Log in</h1>

      {params.get("confirmed") && (
        <div className="alert alert-success">
          Email confirmed. You can log in now.
        </div>
      )}
      {params.get("error") === "confirm" && (
        <div className="alert alert-warning">
          We could not complete the confirmation link. If you already confirmed
          your email, just log in below.
        </div>
      )}
      {notice && <div className="alert alert-warning">{notice}</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="form-label" htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            className="form-control form-control-lg"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="mb-4">
          <label className="form-label" htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            className="form-control form-control-lg"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button className="btn btn-primary btn-lg w-100" disabled={loading}>
          {loading ? "Logging in..." : "Log in"}
        </button>
      </form>

      <p className="mt-3 mb-0 text-center">
        New agent? <Link href="/signup">Sign up</Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}