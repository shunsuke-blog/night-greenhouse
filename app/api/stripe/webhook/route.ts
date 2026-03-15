import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase-server";
import type Stripe from "stripe";

// Next.js がボディを自動パースしないよう raw text で読む
export const runtime = "nodejs";

function periodEndISO(sub: any): string | null {
  const ts: number | undefined = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end;
  if (!ts) return null;
  return new Date(ts * 1000).toISOString();
}

/** Stripe subscription status → アプリ側の subscription_status */
function toAppStatus(stripeStatus: Stripe.Subscription["status"]): string {
  switch (stripeStatus) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
    case "unpaid":
    case "incomplete_expired":
      return "canceled";
    default:
      return "past_due";
  }
}

export async function POST(req: NextRequest) {
  // STRIPE_WEBHOOK_SECRET 未設定時はスキップ（ローカル開発用）
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ received: true });
  }

  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "署名がありません" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch {
    return NextResponse.json({ error: "署名検証に失敗しました" }, { status: 400 });
  }

  const supabase = createAdminClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription") break;

      const customerId = session.customer as string;
      const subscription = await stripe.subscriptions.retrieve(
        session.subscription as string
      );

      const priceId = subscription.items.data[0]?.price?.id ?? "";
      const planType = priceId === process.env.STRIPE_PRICE_ID_YEARLY ? "yearly" : "monthly";
      const sub = subscription as any;
      const item = sub.items?.data?.[0];
      const periodEnd: number | null = sub.current_period_end ?? item?.current_period_end ?? null;
      console.log("[webhook] periodEnd:", periodEnd);

      await supabase
        .from("user_profiles")
        .update({
          subscription_status: toAppStatus(subscription.status),
          current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
          plan_type: planType,
        })
        .eq("stripe_customer_id", customerId);
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as any;
      const customerId = subscription.customer as string;

      await supabase
        .from("user_profiles")
        .update({
          subscription_status: toAppStatus(subscription.status),
          current_period_end: periodEndISO(subscription),
        })
        .eq("stripe_customer_id", customerId);
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as any;
      const customerId = subscription.customer as string;

      await supabase
        .from("user_profiles")
        .update({
          subscription_status: "canceled",
          current_period_end: periodEndISO(subscription),
        })
        .eq("stripe_customer_id", customerId);
      break;
    }

    default:
      // 未処理のイベントは無視
      break;
  }

  return NextResponse.json({ received: true });
}
