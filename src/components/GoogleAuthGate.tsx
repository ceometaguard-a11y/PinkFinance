import { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { Cloud, Lock, ShieldCheck } from 'lucide-react';
import { auth, googleProvider } from '../lib/firebase';

export function GoogleAuthGate() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('popup-closed-by-user')) {
        setError('Giriş penceresi kapatıldı. Devam etmek için Google hesabınızı seçin.');
      } else if (msg.includes('popup-blocked')) {
        setError('Tarayıcı açılır pencereyi engelledi. Lütfen popup izni verip tekrar deneyin.');
      } else {
        setError('Google ile giriş yapılırken bir hata oluştu. Lütfen tekrar deneyin.');
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090E1A] text-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-[#0F172A] border border-slate-800 rounded-xl p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-pink-600 flex items-center justify-center text-white font-bold text-lg">
            P
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">PinkFinance</h1>
            <p className="text-xs text-slate-400">
              P&amp;L, Müşteri Gelirleri ve Nakit Akışı Yönetimi
            </p>
          </div>
        </div>

        <div className="space-y-3 py-2 border-y border-slate-800/80 text-xs text-slate-300">
          <div className="flex items-start gap-2.5">
            <Cloud className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <span>
              Tüm müşteri, fatura, tahsilat ve gider verileriniz tarayıcı yerine{' '}
              <strong className="text-white">Cloud Firestore</strong> bulut veritabanında gerçek
              zamanlı olarak saklanır.
            </span>
          </div>
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              Google hesabınızla giriş yapan kullanıcılar ortak{' '}
              <strong className="text-white">PinkFinance</strong> çalışma alanında{' '}
              <strong className="text-white">Admin</strong> yetkisiyle tüm finansal verilere
              erişebilir.
            </span>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full py-3 px-4 rounded-lg bg-white hover:bg-slate-100 text-slate-900 font-semibold text-sm flex items-center justify-center gap-3 transition-colors disabled:opacity-60 cursor-pointer"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
            />
          </svg>
          <span>{loading ? 'Giriş Yapılıyor...' : 'Google ile Giriş Yap'}</span>
        </button>

        <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
          <Lock className="w-3 h-3" />
          <span>Firebase Authentication &amp; Cloud Firestore ile korunmaktadır</span>
        </div>
      </div>
    </div>
  );
}
