"use client";
export const dynamic = "force-dynamic";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Mode = "signin" | "signup" | "forgot";

function toJapaneseError(msg: string): string {
  if (msg.includes("Invalid login credentials")) return "メールアドレスまたはパスワードが違います";
  if (msg.includes("User already registered")) return "このメールアドレスはすでに登録されています";
  if (msg.includes("Password should be at least")) return "パスワードは6文字以上で設定してください";
  if (msg.includes("Email not confirmed")) return "メールアドレスの確認が完了していません。届いたメールのリンクをクリックしてください";
  if (msg.includes("signup is disabled")) return "現在、新規登録は受け付けていません";
  return msg;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(
    searchParams.get("error") === "auth_failed"
      ? "リンクが無効か期限切れです。もう一度お試しください。"
      : ""
  );
  const [successMsg] = useState(
    searchParams.get("reset") === "done"
      ? "パスワードを更新しました。新しいパスワードでログインしてください。"
      : ""
  );
  const [confirmSent, setConfirmSent] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (mode === "signup") {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (signUpError) {
        setError(toJapaneseError(signUpError.message));
      } else if (data.session) {
        // メール確認なし → 即ログイン
        await supabase.from("user_profiles").upsert({
          id: data.session.user.id,
          display_name: displayName,
        });
        router.push("/");
      } else {
        // メール確認あり → 確認メール送信済み
        setConfirmSent(true);
      }
    } else if (mode === "forgot") {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      if (resetError) {
        setError(toJapaneseError(resetError.message));
      } else {
        setResetSent(true);
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(toJapaneseError(signInError.message));
      } else {
        router.push("/");
      }
    }

    setLoading(false);
  };

  if (resetSent) {
    return (
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-light tracking-widest text-emerald-400">BLOOMINE</h1>
          <p className="text-xs text-slate-500">ブルーマイン</p>
        </div>
        <div className="p-6 bg-slate-900/40 rounded-2xl border border-emerald-900/30 text-center space-y-3">
          <p className="text-emerald-400 text-sm">リセットメールを送信しました</p>
          <p className="text-slate-400 text-xs leading-relaxed">
            {email} に届いたリンクをクリックして、<br />
            新しいパスワードを設定してください。<br />
            メールが届かない場合は迷惑メールフォルダをご確認ください。
          </p>
          <button
            onClick={() => { setResetSent(false); setMode("signin"); setEmail(""); }}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors underline"
          >
            ログイン画面に戻る
          </button>
        </div>
      </div>
    );
  }

  if (confirmSent) {
    return (
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-light tracking-widest text-emerald-400">BLOOMINE</h1>
          <p className="text-xs text-slate-500">ブルーマイン</p>
        </div>
        <div className="p-6 bg-slate-900/40 rounded-2xl border border-emerald-900/30 text-center space-y-3">
          <p className="text-emerald-400 text-sm">確認メールを送信しました</p>
          <p className="text-slate-400 text-xs leading-relaxed">
            {email} に届いたリンクをクリックして、<br />
            登録を完了してください。<br />
            メールが届かない場合は迷惑メールフォルダをご確認ください。
          </p>
          <button
            onClick={() => { setConfirmSent(false); setMode("signin"); }}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors underline"
          >
            ログイン画面に戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-light tracking-widest text-emerald-400">BLOOMINE</h1>
        <p className="text-xs text-slate-500">ブルーマイン</p>
      </div>

      {/* モード切替（パスワードリセット中は非表示） */}
      {mode !== "forgot" && (
        <div className="flex rounded-xl overflow-hidden border border-slate-800">
          <button
            type="button"
            onClick={() => { setMode("signin"); setError(""); setEmail(""); setPassword(""); setDisplayName(""); }}
            className={`flex-1 py-2 text-xs transition-colors ${mode === "signin"
              ? "bg-emerald-900/40 text-emerald-300"
              : "text-slate-500 hover:text-slate-300"
              }`}
          >
            ログイン
          </button>
          <button
            type="button"
            onClick={() => { setMode("signup"); setError(""); setEmail(""); setPassword(""); setDisplayName(""); }}
            className={`flex-1 py-2 text-xs transition-colors ${mode === "signup"
              ? "bg-emerald-900/40 text-emerald-300"
              : "text-slate-500 hover:text-slate-300"
              }`}
          >
            新規登録
          </button>
        </div>
      )}

      {mode === "forgot" ? (
        /* パスワードリセット申請フォーム */
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-xs text-slate-400 leading-relaxed">
            登録したメールアドレスを入力してください。パスワードをリセットするためのリンクを送信します。
          </p>
          <div className="space-y-2">
            <label className="text-xs text-slate-400">メールアドレス</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              autoComplete="email"
              className="w-full px-4 py-3 bg-slate-900/60 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-800 text-base"
            />
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-emerald-900/40 border border-emerald-800/50 rounded-xl text-emerald-300 text-sm tracking-wide hover:bg-emerald-900/60 transition-colors disabled:opacity-50"
          >
            {loading ? "送信中..." : "リセットメールを送信"}
          </button>
          <button
            type="button"
            onClick={() => { setMode("signin"); setError(""); setEmail(""); }}
            className="w-full text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            ← ログインに戻る
          </button>
        </form>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4" autoComplete={mode === "signup" ? "off" : undefined}>
          {mode === "signup" && (
            <div className="space-y-2">
              <label className="text-xs text-slate-400">呼ばれたい名前</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="例: たろう"
                required
                autoComplete="off"
                className="w-full px-4 py-3 bg-slate-900/60 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-800 text-base"
              />
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs text-slate-400">メールアドレス</label>
            <input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              autoComplete={mode === "signup" ? "off" : "email"}
              className="w-full px-4 py-3 bg-slate-900/60 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-800 text-base"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-slate-400">パスワード</label>
              {mode === "signin" && (
                <button
                  type="button"
                  onClick={() => { setMode("forgot"); setError(""); setPassword(""); }}
                  className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
                >
                  パスワードをお忘れですか？
                </button>
              )}
            </div>
            <input
              id="password"
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="6文字以上"
              required
              minLength={6}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              className="w-full px-4 py-3 bg-slate-900/60 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-800 text-base"
            />
          </div>

          {successMsg && (
            <p className="text-emerald-400 text-xs">{successMsg}</p>
          )}

          {error && (
            <p className="text-red-400 text-xs">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-emerald-900/40 border border-emerald-800/50 rounded-xl text-emerald-300 text-sm tracking-wide hover:bg-emerald-900/60 transition-colors disabled:opacity-50"
          >
            {loading
              ? (mode === "signup" ? "登録中..." : "ログイン中...")
              : (mode === "signup" ? "自己分析をはじめる" : "ログイン")
            }
          </button>
        </form>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center justify-center px-4 py-8 sm:px-6">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
