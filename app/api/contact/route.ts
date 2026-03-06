import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { category, subject, message } = await req.json();
    if (!message?.trim() || !subject?.trim()) {
      return NextResponse.json({ error: "件名と内容を入力してください" }, { status: 400 });
    }

    const { error } = await supabase
      .from("contact_messages")
      .insert({
        user_id: user.id,
        category: category ?? "その他",
        subject: subject.trim(),
        message: message.trim(),
      });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
