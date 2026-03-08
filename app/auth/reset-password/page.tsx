"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sessionReady, setSessionReady] = useState(false);
  const [show, setShow] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // URLのcodeをセッションに交換する
  useEffect(() => {
    const code = searchParams.get("code");
    if (!code) {
      setError("リンクが無効です。パスワードリセットをもう一度お試しください。");
      return;
    }
    supabase.auth.exchangeCodeForSession(code).then(({ error }: { error: Error | null }) => {
      if (error) {
        setError("リンクが無効か期限切れです。パスワードリセットをもう一度お試しください。");
      } else {
        setSessionReady(true);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("パスワードが一致しません");
      return;
    }
    setLoading(true);
    setError("");
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) {
      setError("パスワードの更新に失敗しました: " + updateError.message);
      setLoading(false);
    } else {
      await supabase.auth.signOut();
      router.push("/login?reset=done");
    }
  };

  const inputClass = "w-full px-4 py-3 bg-slate-900/60 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-800 text-base pr-12";

  return (
    <div className="w-full max-w-sm space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-light tracking-widest text-emerald-400">夜の温室</h1>
        <p className="text-xs text-slate-500">Night Greenhouse</p>
      </div>

      {!sessionReady && !error ? (
        <p className="text-center text-xs text-slate-600 animate-pulse">確認中...</p>
      ) : error ? (
        <div className="p-6 bg-slate-900/40 rounded-2xl border border-red-900/30 text-center space-y-4">
          <p className="text-red-400 text-sm">{error}</p>
          <button
            onClick={() => router.push("/login")}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors underline"
          >
            ログイン画面へ戻る
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-xs text-slate-400 text-center">新しいパスワードを設定してください</p>

          <div className="space-y-2">
            <label className="text-xs text-slate-400">新しいパスワード</label>
            <div className="relative">
              <input
                type={show ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="6文字以上"
                required
                minLength={6}
                autoComplete="new-password"
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => setShow(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                aria-label={show ? "パスワードを隠す" : "パスワードを表示"}
              >
                {show ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-slate-400">確認用パスワード</label>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="もう一度入力"
                required
                autoComplete="new-password"
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                aria-label={showConfirm ? "パスワードを隠す" : "パスワードを表示"}
              >
                {showConfirm ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
            {newPassword && confirmPassword && newPassword !== confirmPassword && (
              <p className="text-xs text-red-400 mt-1">パスワードが一致しません</p>
            )}
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <button
            type="submit"
            disabled={loading || newPassword !== confirmPassword || newPassword.length < 6}
            className="w-full py-3 bg-emerald-900/40 border border-emerald-800/50 rounded-xl text-emerald-300 text-sm tracking-wide hover:bg-emerald-900/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "更新中..." : "パスワードを更新する"}
          </button>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center justify-center px-4 py-8 sm:px-6">
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </main>
  );
}
