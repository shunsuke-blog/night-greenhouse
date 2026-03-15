import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { stripe } from "@/lib/stripe";

export async function POST(req: Request) {
  try {
    const { plan } = await req.json().catch(() => ({ plan: "monthly" }));
    const priceId = plan === "yearly"
      ? process.env.STRIPE_PRICE_ID_YEARLY!
      : process.env.STRIPE_PRICE_ID_MONTHLY!;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("stripe_customer_id, is_admin")
      .eq("id", user.id)
      .maybeSingle();

    // 管理者は課金不要
    if (profile?.is_admin) {
      return NextResponse.json({ error: "管理者は課金不要です" }, { status: 400 });
    }

    // Stripe Customer を取得または作成
    let customerId = profile?.stripe_customer_id ?? null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      await supabase
        .from("user_profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);
    }

    const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${origin}/upgrade?success=true`,
      cancel_url: `${origin}/upgrade?canceled=true`,
      locale: "ja",
    });

    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
