"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("error") === "auth_failed") {
      setError("リンクが無効か期限切れです。もう一度送り直してください。");
    }
  }, [searchParams]);

  const handleLogin = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  };

  return (
    <div className="w-full max-w-sm space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-light tracking-widest text-emerald-400">夜の温室</h1>
        <p className="text-xs text-slate-500">Night Greenhouse</p>
      </div>

      {sent ? (
        <div className="p-6 bg-slate-900/40 rounded-2xl border border-emerald-900/30 text-center space-y-3">
          <p className="text-emerald-400 text-sm">✉️ メールを送信しました</p>
          <p className="text-slate-400 text-xs leading-relaxed">
            {email} に届いたリンクをクリックしてください。<br />
            リンクの有効期限は1時間です。<br />
            メールが届かない場合は迷惑メールフォルダをご確認ください。
          </p>
        </div>
      ) : (
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs text-slate-400">メールアドレス</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className="w-full px-4 py-3 bg-slate-900/60 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-800 text-sm"
            />
          </div>

          {error && (
            <p className="text-red-400 text-xs">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-emerald-900/40 border border-emerald-800/50 rounded-xl text-emerald-300 text-sm tracking-wide hover:bg-emerald-900/60 transition-colors disabled:opacity-50"
          >
            {loading ? "送信中..." : "マジックリンクを送る"}
          </button>

          <p className="text-center text-xs text-slate-600">
            パスワード不要。メールのリンクから入れます。
          </p>
        </form>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center justify-center p-6">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
