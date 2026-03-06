"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Category = "不具合報告" | "機能要望" | "その他";

export default function SettingsPage() {
  const router = useRouter();

  // プロフィール
  const [displayName, setDisplayName] = useState("");
  const [originalDisplayName, setOriginalDisplayName] = useState("");
  const [nameLoading, setNameLoading] = useState(false);
  const [nameMsg, setNameMsg] = useState("");

  // メールアドレス
  const [currentEmail, setCurrentEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailMsg, setEmailMsg] = useState("");

  // パスワード
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState("");

  // お問い合わせ
  const [showContact, setShowContact] = useState(false);
  const [category, setCategory] = useState<Category>("不具合報告");
  const [subject, setSubject] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [contactLoading, setContactLoading] = useState(false);
  const [contactMsg, setContactMsg] = useState("");

  // ログアウト確認
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setCurrentEmail(user.email ?? "");

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle();
      const name = profile?.display_name ?? "";
      setDisplayName(name);
      setOriginalDisplayName(name);
    };
    load();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const handleNameSave = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setNameLoading(true);
    setNameMsg("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setNameLoading(false); return; }
    const { error } = await supabase
      .from("user_profiles")
      .upsert({ id: user.id, display_name: displayName });
    if (error) {
      setNameMsg("保存に失敗しました");
    } else {
      setNameMsg("保存しました");
      setOriginalDisplayName(displayName);
    }
    setNameLoading(false);
  };

  const handleEmailSave = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setEmailLoading(true);
    setEmailMsg("");
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    if (error) {
      setEmailMsg("更新に失敗しました: " + error.message);
    } else {
      setEmailMsg("確認メールを送信しました。メール内のリンクをクリックして変更を完了してください。");
      setNewEmail("");
    }
    setEmailLoading(false);
  };

  const handlePasswordSave = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordMsg("パスワードが一致しません");
      return;
    }
    setPasswordLoading(true);
    setPasswordMsg("");
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setPasswordMsg("更新に失敗しました: " + error.message);
    } else {
      setPasswordMsg("パスワードを更新しました");
      setNewPassword("");
      setConfirmPassword("");
    }
    setPasswordLoading(false);
  };

  const handleContactSend = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setContactLoading(true);
    setContactMsg("");
    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, subject, message: contactMessage }),
    });
    if (res.ok) {
      setContactMsg("送信しました。ありがとうございます。");
      setSubject("");
      setContactMessage("");
      setShowContact(false);
    } else {
      setContactMsg("送信に失敗しました");
    }
    setContactLoading(false);
  };

  const nameChanged = displayName !== originalDisplayName;
  const emailChanged = newEmail.trim().length > 0;
  const passwordValid = newPassword.length >= 6 && confirmPassword.length >= 6;
  const passwordChanged = passwordValid && newPassword === confirmPassword;

  const inputClass = "w-full px-4 py-3 bg-slate-900/60 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-800 text-sm";
  const sectionClass = "space-y-3 p-5 bg-slate-900/40 border border-slate-800/60 rounded-2xl";
  const labelClass = "text-xs text-slate-500";

  const saveBtn = (enabled: boolean, loading: boolean) =>
    `px-5 py-2 rounded-xl text-xs tracking-wide transition-colors ml-auto
     ${enabled && !loading
      ? "bg-emerald-900/40 border border-emerald-800/50 text-emerald-300 hover:bg-emerald-900/60 cursor-pointer"
      : "bg-slate-800/40 border border-slate-700 text-slate-600 cursor-not-allowed opacity-50"
    }`;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center p-6 pt-10 space-y-6">
      <div className="w-full max-w-md flex items-center justify-between">
        <Link href="/" className="text-xs text-slate-600 hover:text-slate-400 transition-colors">
          ← 温室へ戻る
        </Link>
        <h1 className="text-sm font-light tracking-widest text-slate-400">設定</h1>
        <div className="w-16" />
      </div>

      <div className="w-full max-w-md space-y-4">

        {/* 名前 */}
        <section className={sectionClass}>
          <p className="text-xs text-slate-400 tracking-wide">呼ばれたい名前</p>
          <form onSubmit={handleNameSave} className="space-y-3">
            <div className="space-y-1">
              <label className={labelClass}>表示名</label>
              <input
                type="text"
                value={displayName}
                onChange={e => { setDisplayName(e.target.value); setNameMsg(""); }}
                required
                className={inputClass}
              />
            </div>
            <div className="flex items-center gap-3">
              {nameMsg && (
                <p className={`text-xs flex-1 ${nameMsg.includes("失敗") ? "text-red-400" : "text-emerald-400"}`}>
                  {nameMsg}
                </p>
              )}
              <button type="submit" disabled={!nameChanged || nameLoading} className={saveBtn(nameChanged, nameLoading)}>
                {nameLoading ? "保存中..." : "保存する"}
              </button>
            </div>
          </form>
        </section>

        {/* メールアドレス */}
        <section className={sectionClass}>
          <p className="text-xs text-slate-400 tracking-wide">メールアドレス</p>
          <p className="text-xs text-slate-600">現在: {currentEmail}</p>
          <form onSubmit={handleEmailSave} className="space-y-3">
            <div className="space-y-1">
              <label className={labelClass}>新しいメールアドレス</label>
              <input
                type="email"
                value={newEmail}
                onChange={e => { setNewEmail(e.target.value); setEmailMsg(""); }}
                placeholder="new@email.com"
                required
                className={inputClass}
              />
            </div>
            <div className="flex items-center gap-3">
              {emailMsg && (
                <p className={`text-xs flex-1 leading-relaxed ${emailMsg.includes("失敗") ? "text-red-400" : "text-emerald-400"}`}>
                  {emailMsg}
                </p>
              )}
              <button type="submit" disabled={!emailChanged || emailLoading} className={saveBtn(emailChanged, emailLoading)}>
                {emailLoading ? "送信中..." : "変更する"}
              </button>
            </div>
          </form>
        </section>

        {/* パスワード */}
        <section className={sectionClass}>
          <p className="text-xs text-slate-400 tracking-wide">パスワード</p>
          <div className="space-y-1">
            <label className={labelClass}>現在のパスワード</label>
            <p className="text-slate-600 text-sm tracking-widest px-1">••••••••</p>
          </div>
          <form onSubmit={handlePasswordSave} className="space-y-3">
            <div className="space-y-1">
              <label className={labelClass}>新しいパスワード</label>
              <input
                type="password"
                value={newPassword}
                onChange={e => { setNewPassword(e.target.value); setPasswordMsg(""); }}
                placeholder="6文字以上"
                minLength={6}
                className={inputClass}
              />
            </div>
            <div className="space-y-1">
              <label className={labelClass}>確認用パスワード</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => { setConfirmPassword(e.target.value); setPasswordMsg(""); }}
                placeholder="もう一度入力"
                className={inputClass}
              />
              {newPassword && confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-red-400 mt-1">パスワードが一致しません</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              {passwordMsg && (
                <p className={`text-xs flex-1 ${passwordMsg.includes("失敗") ? "text-red-400" : "text-emerald-400"}`}>
                  {passwordMsg}
                </p>
              )}
              <button type="submit" disabled={!passwordChanged || passwordLoading} className={saveBtn(passwordChanged, passwordLoading)}>
                {passwordLoading ? "更新中..." : "更新する"}
              </button>
            </div>
          </form>
        </section>

        {/* お問い合わせ */}
        <section className={sectionClass}>
          <button
            onClick={() => { setShowContact(!showContact); setContactMsg(""); }}
            className="w-full flex items-center justify-between text-xs text-slate-400 tracking-wide"
          >
            <span>お問い合わせ</span>
            <span className="text-slate-600">{showContact ? "▲" : "▼"}</span>
          </button>

          {contactMsg && (
            <p className={`text-xs ${contactMsg.includes("失敗") ? "text-red-400" : "text-emerald-400"}`}>{contactMsg}</p>
          )}

          {showContact && (
            <form onSubmit={handleContactSend} className="space-y-4 pt-2">
              <div className="space-y-2">
                <label className={labelClass}>種類</label>
                <div className="flex gap-2">
                  {(["不具合報告", "機能要望", "その他"] as Category[]).map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategory(c)}
                      className={`flex-1 py-2 rounded-xl text-xs border transition-colors ${
                        category === c
                          ? "bg-emerald-900/40 border-emerald-700 text-emerald-300"
                          : "border-slate-700 text-slate-500 hover:border-slate-600"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className={labelClass}>件名 <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="例: 音声が再生されない問題"
                  required
                  className={inputClass}
                />
              </div>

              <div className="space-y-1">
                <label className={labelClass}>内容 <span className="text-red-400">*</span></label>
                <textarea
                  value={contactMessage}
                  onChange={e => setContactMessage(e.target.value)}
                  placeholder="不具合の詳細や機能要望の内容をご記入ください..."
                  required
                  rows={5}
                  className={inputClass + " resize-none"}
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowContact(false)}
                  className="flex-1 py-2 border border-slate-700 rounded-xl text-slate-500 text-xs hover:border-slate-600 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={contactLoading}
                  className="flex-1 py-2 bg-emerald-900/40 border border-emerald-700 rounded-xl text-emerald-300 text-xs hover:bg-emerald-900/60 transition-colors disabled:opacity-50"
                >
                  {contactLoading ? "送信中..." : "送信"}
                </button>
              </div>
            </form>
          )}
        </section>

        {/* ログアウト */}
        <button
          onClick={() => setShowLogoutConfirm(true)}
          className="w-full py-3 text-xs text-red-400/60 hover:text-red-400 transition-colors"
        >
          ログアウト
        </button>

      </div>

      {/* ログアウト確認ダイアログ */}
      {showLogoutConfirm && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-6"
          onClick={e => { if (e.target === e.currentTarget) setShowLogoutConfirm(false); }}
        >
          <div className="w-full max-w-xs bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-5 shadow-2xl">
            <p className="text-sm text-slate-300 text-center leading-relaxed">
              本当にログアウトしますか？
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2 border border-slate-700 rounded-xl text-slate-400 text-xs hover:border-slate-600 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 py-2 bg-red-900/30 border border-red-800/50 rounded-xl text-red-400 text-xs hover:bg-red-900/50 transition-colors"
              >
                ログアウト
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
