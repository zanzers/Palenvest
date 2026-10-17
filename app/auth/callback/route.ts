import { createClient } from "@/lib/supabase/client";
import { NextResponse } from "next/server";


export async function GET(request: Request){
    const { searchParams, origin} = new URL(request.url);
    const code = searchParams.get("code");

    if(code){
        const supabase = await createClient();
        const { error} = await supabase.auth.exchangeCodeForSession(code);

        if(!error){
            return NextResponse.redirect(`${origin}/login?confirmed=1`);
        }
    }
    return NextResponse.redirect(`${origin}/login?error=confirm`);
}