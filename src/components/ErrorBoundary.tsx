import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { FirestoreErrorInfo } from '../lib/firebase';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
  details: string | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '', details: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let parsed: FirestoreErrorInfo | null = null;
    try {
      parsed = JSON.parse(error.message) as FirestoreErrorInfo;
    } catch {
      parsed = null;
    }

    if (parsed && parsed.operationType) {
      return {
        hasError: true,
        message: 'Bulut veritabanı erişimi sırasında bir yetki veya bağlantı hatası oluştu.',
        details: `${parsed.operationType.toUpperCase()} · ${parsed.path ?? ''} · ${parsed.error}`,
      };
    }

    return {
      hasError: true,
      message: error.message || 'Beklenmeyen bir uygulama hatası oluştu.',
      details: null,
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#090E1A] text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[#0F172A] border border-rose-800/60 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-rose-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h2 className="text-base font-semibold">Bağlantı / Yetki Hatası</h2>
            </div>
            <p className="text-sm text-slate-300">{this.state.message}</p>
            {this.state.details && (
              <pre className="text-[11px] font-mono bg-[#090E1A] border border-slate-800 rounded-lg p-3 text-slate-400 overflow-x-auto whitespace-pre-wrap">
                {this.state.details}
              </pre>
            )}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Sayfayı Yenile</span>
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
