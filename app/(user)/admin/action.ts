"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function setAgentStatus(formData: FormData) {
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  if (!["approved", "suspended"].includes(status)) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_agent_status", {
    p_agent: id,
    p_status: status,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/admin");
}