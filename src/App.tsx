import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import {
  Briefcase,
  CreditCard,
  Menu,
  Plus,
  ReceiptText,
  RotateCcw,
  UserPlus,
  Wallet,
} from 'lucide-react';
import { auth } from './lib/firebase';
import { GoogleAuthGate } from './components/GoogleAuthGate';
import { Sidebar } from './components/Sidebar';
import {
  AddPaymentModal,
  CustomerModal,
  NewExpenseModal,
  NewInvoiceModal,
  RefundInvoiceModal,
  WonSaleModal,
} from './components/ActionModals';
import { DashboardPage } from './pages/DashboardPage';
import { AnnualAnalyticsPage } from './pages/AnnualAnalyticsPage';
import { SalesBillingAnalysisPage } from './pages/SalesBillingAnalysisPage';
import { InvoicesPage } from './pages/InvoicesPage';
import { CustomersPage } from './pages/CustomersPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { PnLPage } from './pages/PnLPage';
import { CashFlowPage } from './pages/CashFlowPage';
import { useFinanceStore } from './hooks/useFinanceStore';
import { Customer, EnrichedInvoice, NavPage, WonSale } from './types/finance';
import { addMonths, formatMonthTR } from './utils/formatters';
import {
  computeWonSalesBillingAnalysis,
  CURRENT_MONTH_KEY,
  enrichInvoices,
} from './utils/financeEngine';

const PAGE_TITLES: Record<NavPage, string> = {
  dashboard: 'Genel Bakış',
  annual: 'Yıllık Analiz (12 Ay)',
  sales: 'Kazanılmış Satışlar & Fatura Kesim Analizi',
  invoices: 'Gelir & Tahsilat Yönetimi',
  customers: 'Müşteri Yönetimi & Gelir Matrisi',
  expenses: 'Gider Yönetimi',
  pnl: 'Aylık P&L (Kar / Zarar) Tablosu',
  cashflow: 'Nakit Akışı & Kasa Durumu',
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const {
    db,
    loadingCloud,
    adminCount,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    addWonSale,
    updateWonSale,
    deleteWonSale,
    addInvoice,
    addRefundInvoice,
    toggleInvoiceDraft,
    deleteInvoice,
    addPayment,
    deletePayment,
    addExpense,
    markExpensePaid,
    markExpensePending,
    deleteExpense,
    generateRecurringExpensesForMonth,
    addBankAccount,
    deleteBankAccount,
    updateExchangeRates,
    clearAllData,
  } = useFinanceStore(user);

  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const [activePage, setActivePage] = useState<NavPage>('dashboard');
  const [selectedMonth, setSelectedMonth] = useState<string>(CURRENT_MONTH_KEY);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [isDark, setIsDark] = useState<boolean>(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Modal states
  const [showNewInvoice, setShowNewInvoice] = useState(false);
  const [refundModalTarget, setRefundModalTarget] = useState<EnrichedInvoice | null | undefined>(
    undefined
  );
  const [invoicePrefillSale, setInvoicePrefillSale] = useState<{
    sale: WonSale;
    suggestedIssueDate?: string;
  } | null>(null);
  const [showNewExpense, setShowNewExpense] = useState(false);
  const [paymentModalInvoiceId, setPaymentModalInvoiceId] = useState<string | null | undefined>(
    undefined
  );
  const [customerModalTarget, setCustomerModalTarget] = useState<Customer | null | undefined>(
    undefined
  );
  const [wonSaleModalTarget, setWonSaleModalTarget] = useState<WonSale | null | undefined>(
    undefined
  );

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) root.classList.add('dark');
    else root.classList.remove('dark');
  }, [isDark]);

  const enrichedInvoices = useMemo(() => enrichInvoices(db), [db]);

  const openInvoices = useMemo(
    () =>
      enrichedInvoices
        .filter(
          (i) =>
            !i.isDraft &&
            i.remainingTry > 1 &&
            !(i.invoiceType === 'refund' && i.refundSettlementMode === 'receivable_offset')
        )
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [enrichedInvoices]
  );

  const overdueCount = useMemo(
    () =>
      openInvoices.filter((i) => i.invoiceType !== 'refund' && i.computedStatus === 'overdue')
        .length,
    [openInvoices]
  );

  const dueBillingCount = useMemo(
    () => computeWonSalesBillingAnalysis(db, enrichedInvoices).actionRequiredCount,
    [db, enrichedInvoices]
  );

  const hardwareInvoices = useMemo(
    () => enrichedInvoices.filter((i) => i.revenueModel === 'hardware'),
    [enrichedInvoices]
  );

  const availableMonths = useMemo(() => {
    return Array.from({ length: 12 }, (_, idx) => addMonths('2026-06', idx));
  }, []);

  const handleSelectCustomer = (customerId: string | null) => {
    setSelectedCustomerId(customerId);
    if (customerId) {
      setActivePage('customers');
    }
  };

  const handleNavigate = (page: NavPage) => {
    setActivePage(page);
    if (page !== 'customers') {
      setSelectedCustomerId(null);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#090E1A] text-slate-200 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-400">Oturum kontrol ediliyor...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <GoogleAuthGate />;
  }

  if (loadingCloud) {
    return (
      <div className="min-h-screen bg-[#090E1A] text-slate-200 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-400">
            Cloud Firestore verileri senkronize ediliyor...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-[#090E1A] text-slate-900 dark:text-slate-100">
      <Sidebar
        user={user}
        activePage={activePage}
        onNavigate={handleNavigate}
        isDark={isDark}
        onToggleTheme={() => setIsDark((prev) => !prev)}
        exchangeRates={db.exchangeRates}
        onClearDatabase={() => setShowClearConfirm(true)}
        onSignOut={() => void handleSignOut()}
        overdueCount={overdueCount}
        dueBillingCount={dueBillingCount}
        adminCount={adminCount}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar Contract */}
        <header className="h-16 px-4 sm:px-6 lg:px-8 border-b border-slate-200 dark:border-slate-800/80 bg-white/85 dark:bg-[#0B1120]/90 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Menüyü aç"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm truncate">
              <span className="text-slate-500 dark:text-slate-400 hidden sm:inline">
                PinkFinance
              </span>
              <span className="text-slate-400 hidden sm:inline">/</span>
              <h1 className="font-semibold text-slate-900 dark:text-white truncate">
                {PAGE_TITLES[activePage]}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              aria-label="Dönem Seçimi"
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 dark:bg-[#0F172A] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-600"
            >
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {formatMonthTR(m)}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setShowNewInvoice(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Yeni Fatura / Gelir Ekle</span>
              <span className="sm:hidden">Fatura</span>
            </button>
          </div>
        </header>

        {/* Always-Accessible Quick Actions Toolbar */}
        <div className="px-4 sm:px-6 lg:px-8 py-3 border-b border-slate-200/80 dark:border-slate-800/60 bg-slate-50/70 dark:bg-[#0B1120]/50 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Hızlı İşlemler
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowNewInvoice(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:border-blue-500/60 hover:text-blue-600 dark:hover:text-blue-400 transition-colors whitespace-nowrap"
            >
              <ReceiptText className="w-3.5 h-3.5 text-blue-500" />
              <span>Yeni Fatura/Gelir Ekle</span>
            </button>
            <button
              type="button"
              onClick={() => setShowNewExpense(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:border-rose-500/60 hover:text-rose-600 dark:hover:text-rose-400 transition-colors whitespace-nowrap"
            >
              <Wallet className="w-3.5 h-3.5 text-rose-500" />
              <span>Yeni Gider Ekle</span>
            </button>
            <button
              type="button"
              onClick={() => setPaymentModalInvoiceId(null)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:border-emerald-500/60 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors whitespace-nowrap"
            >
              <CreditCard className="w-3.5 h-3.5 text-emerald-500" />
              <span>Tahsilat / İade İşle</span>
            </button>
            <button
              type="button"
              onClick={() => setRefundModalTarget(null)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:border-rose-500/60 hover:text-rose-600 dark:hover:text-rose-400 transition-colors whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5 text-rose-500" />
              <span>İade Faturası Kes</span>
            </button>
            <button
              type="button"
              onClick={() => setWonSaleModalTarget(null)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:border-amber-500/60 hover:text-amber-600 dark:hover:text-amber-400 transition-colors whitespace-nowrap"
            >
              <Briefcase className="w-3.5 h-3.5 text-amber-500" />
              <span>Kazanılmış Satış Ekle</span>
            </button>
            <button
              type="button"
              onClick={() => setCustomerModalTarget(null)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:border-violet-500/60 hover:text-violet-600 dark:hover:text-violet-400 transition-colors whitespace-nowrap"
            >
              <UserPlus className="w-3.5 h-3.5 text-violet-500" />
              <span>Yeni Müşteri Ekle</span>
            </button>
          </div>
        </div>

        {/* Main Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          {activePage === 'dashboard' && (
            <DashboardPage
              db={db}
              selectedMonth={selectedMonth}
              enrichedInvoices={enrichedInvoices}
              onNavigate={handleNavigate}
              onOpenPaymentModal={(id) => setPaymentModalInvoiceId(id)}
              onSelectCustomer={handleSelectCustomer}
            />
          )}

          {activePage === 'annual' && (
            <AnnualAnalyticsPage
              db={db}
              selectedMonth={selectedMonth}
              enrichedInvoices={enrichedInvoices}
              onSelectCustomer={handleSelectCustomer}
              onOpenNewInvoice={() => setShowNewInvoice(true)}
              onOpenNewExpense={() => setShowNewExpense(true)}
            />
          )}

          {activePage === 'sales' && (
            <SalesBillingAnalysisPage
              db={db}
              enrichedInvoices={enrichedInvoices}
              onOpenNewSale={() => setWonSaleModalTarget(null)}
              onOpenEditSale={(sale) => setWonSaleModalTarget(sale)}
              onUpdateSaleStatus={(id, status) => void updateWonSale(id, { status })}
              onDeleteSale={(id) => void deleteWonSale(id)}
              onCreateInvoiceFromSale={(sale, suggestedIssueDate) => {
                setInvoicePrefillSale({ sale, suggestedIssueDate });
                setShowNewInvoice(true);
              }}
              onSelectCustomer={handleSelectCustomer}
            />
          )}

          {activePage === 'invoices' && (
            <InvoicesPage
              enrichedInvoices={enrichedInvoices}
              onOpenNewInvoice={() => setShowNewInvoice(true)}
              onOpenRefundModal={(salesInv) => setRefundModalTarget(salesInv ?? null)}
              onOpenPaymentModal={(id) => setPaymentModalInvoiceId(id)}
              onToggleDraft={(id, isDraft) => void toggleInvoiceDraft(id, isDraft)}
              onDeleteInvoice={(id) => void deleteInvoice(id)}
              onSelectCustomer={handleSelectCustomer}
            />
          )}

          {activePage === 'customers' && (
            <CustomersPage
              db={db}
              selectedMonth={selectedMonth}
              enrichedInvoices={enrichedInvoices}
              selectedCustomerId={selectedCustomerId}
              onSelectCustomer={setSelectedCustomerId}
              onOpenNewCustomer={() => setCustomerModalTarget(null)}
              onOpenEditCustomer={(cust) => setCustomerModalTarget(cust)}
              onDeleteCustomer={(id) => void deleteCustomer(id)}
              onDeleteInvoice={(id) => void deleteInvoice(id)}
              onDeletePayment={(id) => void deletePayment(id)}
              onOpenPaymentModal={(id) => setPaymentModalInvoiceId(id)}
              onOpenRefundModal={(salesInv) => setRefundModalTarget(salesInv ?? null)}
            />
          )}

          {activePage === 'expenses' && (
            <ExpensesPage
              expenses={db.expenses}
              selectedMonth={selectedMonth}
              onOpenNewExpense={() => setShowNewExpense(true)}
              onMarkPaid={(id, payDate, acc) => void markExpensePaid(id, payDate, acc)}
              onMarkPending={(id) => void markExpensePending(id)}
              onDeleteExpense={(id) => void deleteExpense(id)}
              onGenerateRecurring={generateRecurringExpensesForMonth}
            />
          )}

          {activePage === 'pnl' && (
            <PnLPage
              db={db}
              selectedMonth={selectedMonth}
              onSelectCustomer={handleSelectCustomer}
            />
          )}

          {activePage === 'cashflow' && (
            <CashFlowPage
              db={db}
              selectedMonth={selectedMonth}
              onUpdateRates={(rates) => void updateExchangeRates(rates)}
              onAddBankAccount={(acc) => void addBankAccount(acc)}
              onDeleteBankAccount={(id) => void deleteBankAccount(id)}
              onSelectCustomer={handleSelectCustomer}
            />
          )}
        </main>
      </div>

      {/* Modals */}
      {showNewInvoice && (
        <NewInvoiceModal
          customers={db.customers}
          exchangeRates={db.exchangeRates}
          bankAccounts={db.bankAccounts}
          wonSales={db.wonSales}
          prefillFromWonSale={invoicePrefillSale}
          onClose={() => {
            setShowNewInvoice(false);
            setInvoicePrefillSale(null);
          }}
          onOpenNewCustomer={() => setCustomerModalTarget(null)}
          onSave={(inv, cogs) => void addInvoice(inv, cogs)}
        />
      )}

      {refundModalTarget !== undefined && (
        <RefundInvoiceModal
          salesInvoices={enrichedInvoices}
          preselectedSalesInvoice={refundModalTarget}
          bankAccounts={db.bankAccounts}
          exchangeRates={db.exchangeRates}
          onClose={() => setRefundModalTarget(undefined)}
          onSave={(refundData, payout) => void addRefundInvoice(refundData, payout)}
        />
      )}

      {paymentModalInvoiceId !== undefined && (
        <AddPaymentModal
          openInvoices={openInvoices}
          preselectedInvoiceId={paymentModalInvoiceId}
          bankAccounts={db.bankAccounts}
          exchangeRates={db.exchangeRates}
          onClose={() => setPaymentModalInvoiceId(undefined)}
          onSave={(p) => void addPayment(p)}
        />
      )}

      {showNewExpense && (
        <NewExpenseModal
          exchangeRates={db.exchangeRates}
          bankAccounts={db.bankAccounts}
          hardwareInvoices={hardwareInvoices}
          onClose={() => setShowNewExpense(false)}
          onSave={(exp) => void addExpense(exp)}
        />
      )}

      {customerModalTarget !== undefined && (
        <CustomerModal
          initialCustomer={customerModalTarget}
          onClose={() => setCustomerModalTarget(undefined)}
          onSave={(data, existingId) => {
            if (existingId) void updateCustomer(existingId, data);
            else void addCustomer(data);
          }}
        />
      )}

      {wonSaleModalTarget !== undefined && (
        <WonSaleModal
          customers={db.customers}
          exchangeRates={db.exchangeRates}
          initialSale={wonSaleModalTarget}
          onClose={() => setWonSaleModalTarget(undefined)}
          onOpenNewCustomer={() => setCustomerModalTarget(null)}
          onSave={(data, existingId) => {
            if (existingId) void updateWonSale(existingId, data);
            else void addWonSale(data);
          }}
        />
      )}

      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Veritabanını Temizle
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Cloud Firestore üzerindeki tüm müşteri, fatura, tahsilat, gider ve banka hesabı
              kayıtları kalıcı olarak silinecektir. Bu işlem geri alınamaz.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 text-xs font-medium rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowClearConfirm(false);
                  void clearAllData();
                }}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-rose-600 hover:bg-rose-700 text-white"
              >
                Tüm Kayıtları Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
