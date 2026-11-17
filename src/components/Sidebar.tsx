import {
  BarChart3,
  Briefcase,
  FileSpreadsheet,
  Landmark,
  LayoutDashboard,
  LogOut,
  Moon,
  ReceiptText,
  Sun,
  Trash2,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { ExchangeRates, NavPage } from '../types/finance';

interface SidebarProps {
  user: User;
  activePage: NavPage;
  onNavigate: (page: NavPage) => void;
  isDark: boolean;
  onToggleTheme: () => void;
  exchangeRates: ExchangeRates;
  onClearDatabase: () => void;
  onSignOut: () => void;
  overdueCount: number;
  dueBillingCount?: number;
  adminCount?: number;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS: { id: NavPage; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Genel Bakış', icon: LayoutDashboard },
  { id: 'annual', label: 'Yıllık Analiz', icon: BarChart3 },
  { id: 'sales', label: 'Satış & Fatura Planı', icon: Briefcase },
  { id: 'invoices', label: 'Gelir & Tahsilatlar', icon: ReceiptText },
  { id: 'customers', label: 'Müşteri Analizi', icon: Users },
  { id: 'expenses', label: 'Gider Yönetimi', icon: Wallet },
  { id: 'pnl', label: 'Aylık P&L Tablosu', icon: FileSpreadsheet },
  { id: 'cashflow', label: 'Nakit Akışı & Kasa', icon: Landmark },
];

export function Sidebar({
  user,
  activePage,
  onNavigate,
  isDark,
  onToggleTheme,
  exchangeRates,
  onClearDatabase,
  onSignOut,
  overdueCount,
  dueBillingCount,
  adminCount,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const initials = (user.displayName || user.email || 'P')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const content = (
    <div className="flex flex-col h-full bg-white dark:bg-[#0D1322] border-r border-slate-200 dark:border-slate-800/90 text-slate-700 dark:text-slate-300">
      {/* Brand Lockup */}
      <div className="h-16 px-5 flex items-center justify-between border-b border-slate-200 dark:border-slate-800/80 shrink-0">
        <button
          type="button"
          onClick={() => {
            onNavigate('dashboard');
            onCloseMobile();
          }}
          className="flex items-center gap-2.5 text-left focus:outline-none"
        >
          <div className="w-8 h-8 rounded-lg bg-pink-600 flex items-center justify-center text-white font-bold text-sm tracking-tight shrink-0">
            P
          </div>
          <div className="leading-tight">
            <span className="block text-sm font-bold text-slate-900 dark:text-white tracking-tight whitespace-nowrap">
              PinkFinance
            </span>
            <span className="block text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
              Finans Yönetimi
            </span>
          </div>
        </button>
        <button
          type="button"
          onClick={onCloseMobile}
          className="lg:hidden p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-white"
          aria-label="Menüyü kapat"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Ana Menü">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onNavigate(item.id);
                onCloseMobile();
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 ${
                isActive
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-600/15 dark:text-blue-400'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <span className="flex items-center gap-3 whitespace-nowrap truncate">
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-600 dark:text-blue-400' : ''}`} />
                <span>{item.label}</span>
              </span>
              {item.id === 'sales' && (dueBillingCount ?? 0) > 0 && (
                <span className="text-xs font-mono tabular-nums text-amber-600 dark:text-amber-400 font-semibold">
                  {dueBillingCount}
                </span>
              )}
              {item.id === 'invoices' && overdueCount > 0 && (
                <span className="text-xs font-mono tabular-nums text-rose-600 dark:text-rose-400 font-semibold">
                  {overdueCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom User, FX & Theme Controls */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800/80 space-y-3 shrink-0">
        <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
          <div className="flex items-center justify-between">
            <span>Dolar Kuru (USD)</span>
            <span className="font-mono tabular-nums text-slate-800 dark:text-slate-200 font-medium">
              {exchangeRates.USD.toFixed(2)} ₺
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Euro Kuru (EUR)</span>
            <span className="font-mono tabular-nums text-slate-800 dark:text-slate-200 font-medium">
              {exchangeRates.EUR.toFixed(2)} ₺
            </span>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-200 dark:border-slate-800/60 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onToggleTheme}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            <span>{isDark ? 'Aydınlık Mod' : 'Karanlık Mod'}</span>
          </button>
          <button
            type="button"
            onClick={onClearDatabase}
            title="Veritabanını Temizle"
            className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
            aria-label="Veritabanını Temizle"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Authenticated Google Account */}
        <div className="pt-2.5 border-t border-slate-200 dark:border-slate-800/60 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName ?? 'Kullanıcı'}
                referrerPolicy="no-referrer"
                className="w-7 h-7 rounded-full object-cover shrink-0 border border-slate-300 dark:border-slate-700"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-blue-600/20 text-blue-500 text-xs font-semibold flex items-center justify-center shrink-0">
                {initials}
              </div>
            )}
            <div className="min-w-0 leading-tight">
              <div className="text-xs font-medium text-slate-900 dark:text-white truncate">
                {user.displayName || 'PinkFinance Kullanıcısı'}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {user.email}
              </div>
              <div className="text-[10px] text-blue-600 dark:text-blue-400 font-medium truncate mt-0.5">
                Admin · Tam Erişim{typeof adminCount === 'number' && adminCount > 0 ? ` (${adminCount} üye)` : ''}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            title="Çıkış Yap"
            aria-label="Çıkış Yap"
            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block w-64 shrink-0 h-screen sticky top-0">
        {content}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={onCloseMobile}
          />
          <aside className="relative w-68 max-w-[85vw] h-full z-10">
            {content}
          </aside>
        </div>
      )}
    </>
  );
}
