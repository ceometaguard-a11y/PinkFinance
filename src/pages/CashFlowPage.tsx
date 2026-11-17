import { useMemo, useState } from 'react';
import { ArrowRightLeft, Check, Landmark, Plus, Trash2 } from 'lucide-react';
import { BankAccount, CurrencyCode, ExchangeRates, PinkFinanceDatabase } from '../types/finance';
import {
  ALL_EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  formatCurrency,
  formatMonthTR,
} from '../utils/formatters';
import {
  computeBankAccountBalances,
  computeCurrentTotalCash,
  computeCustomerMatrix,
  computeMonthlyCashFlow,
  computeMonthlyPnL,
  REFERENCE_TODAY,
} from '../utils/financeEngine';

interface CashFlowPageProps {
  db: PinkFinanceDatabase;
  selectedMonth: string;
  onUpdateRates: (rates: Partial<ExchangeRates>) => void;
  onAddBankAccount: (account: Omit<BankAccount, 'id'>) => void;
  onDeleteBankAccount: (accountId: string) => void;
  onSelectCustomer: (customerId: string) => void;
}

export function CashFlowPage({
  db,
  selectedMonth,
  onUpdateRates,
  onAddBankAccount,
  onDeleteBankAccount,
  onSelectCustomer,
}: CashFlowPageProps) {
  const cashFlow = useMemo(
    () => computeMonthlyCashFlow(db, selectedMonth),
    [db, selectedMonth]
  );
  const pnl = useMemo(
    () => computeMonthlyPnL(db, selectedMonth),
    [db, selectedMonth]
  );
  const currentTotalCash = computeCurrentTotalCash(db);
  const bankBalances = useMemo(() => computeBankAccountBalances(db), [db]);
  const customerMatrix = useMemo(
    () => computeCustomerMatrix(db, selectedMonth),
    [db, selectedMonth]
  );
  const receivables = customerMatrix.filter((c) => c.receivableTry > 1);
  const totalReceivables = receivables.reduce((s, c) => s + c.receivableTry, 0);

  const [usdInput, setUsdInput] = useState(String(db.exchangeRates.USD));
  const [eurInput, setEurInput] = useState(String(db.exchangeRates.EUR));
  const [rateSaved, setRateSaved] = useState(false);

  // Add Bank Account inline form
  const [showAddBank, setShowAddBank] = useState(false);
  const [bankAccountName, setBankAccountName] = useState('');
  const [bankInstitution, setBankInstitution] = useState('');
  const [bankCurrency, setBankCurrency] = useState<CurrencyCode>('TRY');
  const [openingBalanceTry, setOpeningBalanceTry] = useState('0');
  const [openingDate, setOpeningDate] = useState(REFERENCE_TODAY);

  const handleSaveRates = (e: React.FormEvent) => {
    e.preventDefault();
    const usd = parseFloat(usdInput);
    const eur = parseFloat(eurInput);
    if (usd > 0 && eur > 0) {
      onUpdateRates({ USD: usd, EUR: eur });
      setRateSaved(true);
      setTimeout(() => setRateSaved(false), 3000);
    }
  };

  const handleCreateBankAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankAccountName.trim() || !bankInstitution.trim()) return;
    onAddBankAccount({
      name: bankAccountName.trim(),
      bankName: bankInstitution.trim(),
      currency: bankCurrency,
      openingBalanceTry: parseFloat(openingBalanceTry) || 0,
      openingDate,
    });
    setBankAccountName('');
    setBankInstitution('');
    setOpeningBalanceTry('0');
    setShowAddBank(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Cash Flow Waterfall Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Dönem Başı Kasa ({formatMonthTR(selectedMonth)})
          </span>
          <div className="mt-1.5 text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {formatCurrency(cashFlow.openingCashTry)}
          </div>
        </div>
        <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            (+) Gerçekleşen Tahsilatlar
          </span>
          <div className="mt-1.5 text-xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
            +{formatCurrency(cashFlow.totalCollectionsTry)}
          </div>
        </div>
        <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            (-) Müşteri İade Çıkışları
          </span>
          <div className="mt-1.5 text-xl font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400">
            -{formatCurrency(cashFlow.totalRefundsTry)}
          </div>
        </div>
        <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            (-) Ödenen Giderler
          </span>
          <div className="mt-1.5 text-xl font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400">
            -{formatCurrency(cashFlow.totalPaidExpensesTry)}
          </div>
        </div>
        <div className="bg-white dark:bg-[#0F172A] border border-blue-200 dark:border-blue-800/60 rounded-xl p-5">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            (=) Dönem Sonu Net Nakit
          </span>
          <div className="mt-1.5 text-xl font-bold font-mono tabular-nums text-blue-600 dark:text-blue-400">
            {formatCurrency(cashFlow.closingCashTry)}
          </div>
        </div>
      </div>

      {/* P&L vs Cash Flow Reconciliation Banner */}
      <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <ArrowRightLeft className="w-4 h-4 text-blue-500" />
            <span>{formatMonthTR(selectedMonth)} P&amp;L vs. Nakit Akışı Farkı</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            P&amp;L Net Karı tahakkuk esaslıdır (yıllık sözleşme aylık payları ve ödenmemiş faturalar dahil);
            Nakit Akışı ise yalnızca kasaya giren/çıkan gerçek parayı yansıtır.
          </p>
        </div>
        <div className="flex items-center gap-6 shrink-0 text-xs font-mono tabular-nums">
          <div>
            <span className="block text-slate-500 dark:text-slate-400">P&amp;L Net Kar</span>
            <span className="text-sm font-bold text-slate-900 dark:text-white">
              {formatCurrency(pnl.netIncome)}
            </span>
          </div>
          <div>
            <span className="block text-slate-500 dark:text-slate-400">Net Nakit Değişimi</span>
            <span
              className={`text-sm font-bold ${
                cashFlow.netCashChangeTry >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {cashFlow.netCashChangeTry >= 0 ? '+' : ''}
              {formatCurrency(cashFlow.netCashChangeTry)}
            </span>
          </div>
        </div>
      </div>

      {/* Main Cash Flow Breakdown Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                {formatMonthTR(selectedMonth)} Müşteri Tahsilat Dökümü
              </h3>
              <span className="text-xs font-mono tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                +{formatCurrency(cashFlow.totalCollectionsTry)}
              </span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800/70 text-xs">
              {cashFlow.collectionsByCustomer.length === 0 ? (
                <div className="p-6 text-center text-slate-500">
                  Bu ayda gerçekleşmiş tahsilat bulunmuyor.
                </div>
              ) : (
                cashFlow.collectionsByCustomer.map((item) => (
                  <div
                    key={item.customerId}
                    className="px-5 py-3 flex items-center justify-between hover:bg-slate-50/70 dark:hover:bg-slate-800/30"
                  >
                    <button
                      type="button"
                      onClick={() => onSelectCustomer(item.customerId)}
                      className="font-medium text-blue-600 dark:text-blue-400 hover:underline text-left"
                    >
                      {item.customerName}
                    </button>
                    <span className="font-mono tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                      +{formatCurrency(item.amountTry)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                {formatMonthTR(selectedMonth)} Müşteri İade Çıkışları
              </h3>
              <span className="text-xs font-mono tabular-nums font-semibold text-rose-600 dark:text-rose-400">
                -{formatCurrency(cashFlow.totalRefundsTry)}
              </span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800/70 text-xs">
              {cashFlow.refundsByCustomer.length === 0 ? (
                <div className="p-6 text-center text-slate-500">
                  Bu ayda hesaptan yapılmış müşteri iade çıkışı bulunmuyor.
                </div>
              ) : (
                cashFlow.refundsByCustomer.map((item) => (
                  <div
                    key={item.customerId}
                    className="px-5 py-3 flex items-center justify-between hover:bg-slate-50/70 dark:hover:bg-slate-800/30"
                  >
                    <button
                      type="button"
                      onClick={() => onSelectCustomer(item.customerId)}
                      className="font-medium text-blue-600 dark:text-blue-400 hover:underline text-left"
                    >
                      {item.customerName}
                    </button>
                    <span className="font-mono tabular-nums font-semibold text-rose-600 dark:text-rose-400">
                      -{formatCurrency(item.amountTry)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              {formatMonthTR(selectedMonth)} Ödenen Gider Çıkışları
            </h3>
            <span className="text-xs font-mono tabular-nums font-semibold text-rose-600 dark:text-rose-400">
              -{formatCurrency(cashFlow.totalPaidExpensesTry)}
            </span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800/70 text-xs">
            {ALL_EXPENSE_CATEGORIES.map((cat) => {
              const amount = cashFlow.paidExpensesByCategory[cat];
              return (
                <div
                  key={cat}
                  className="px-5 py-3 flex items-center justify-between hover:bg-slate-50/70 dark:hover:bg-slate-800/30"
                >
                  <span className="text-slate-700 dark:text-slate-300">
                    {EXPENSE_CATEGORY_LABELS[cat]}
                  </span>
                  <span className="font-mono tabular-nums font-medium text-slate-900 dark:text-white">
                    {amount > 0 ? `-${formatCurrency(amount)}` : '0 ₺'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Grid: Bekleyen Alacaklar + Banka Hesapları & Kur Ayarları */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Bekleyen Alacaklar Toplamı (Müşteri Bazlı)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Kesilmiş ancak henüz tahsil edilmemiş açık fatura bakiyeleri
              </p>
            </div>
            <span className="text-sm font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400">
              {formatCurrency(totalReceivables)}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-900/40">
                  <th className="py-2.5 px-4">Müşteri</th>
                  <th className="py-2.5 px-4 text-right">Toplam Faturalanan</th>
                  <th className="py-2.5 px-4 text-right">Tahsil Edilen</th>
                  <th className="py-2.5 px-4 text-right">Bekleyen Alacak</th>
                  <th className="py-2.5 px-4 text-right">Gecikmiş Tutar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {receivables.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      Bekleyen açık alacak bulunmuyor.
                    </td>
                  </tr>
                ) : (
                  receivables.map((row) => (
                    <tr
                      key={row.customer.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30"
                    >
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => onSelectCustomer(row.customer.id)}
                          className="font-medium text-blue-600 dark:text-blue-400 hover:underline text-left"
                        >
                          {row.customer.companyName}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                        {formatCurrency(row.totalBilledTry)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(row.collectedTry)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-amber-600 dark:text-amber-400">
                        {formatCurrency(row.receivableTry)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-rose-600 dark:text-rose-400">
                        {row.overdueTry > 0 ? formatCurrency(row.overdueTry) : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Treasury & FX Settings */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                <Landmark className="w-4 h-4 text-blue-500" />
                <span>Kasa &amp; Banka Hesapları</span>
              </div>
              <button
                type="button"
                onClick={() => setShowAddBank((v) => !v)}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Hesap Ekle</span>
              </button>
            </div>

            <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
              {formatCurrency(currentTotalCash)}
            </div>

            {showAddBank && (
              <form
                onSubmit={handleCreateBankAccount}
                className="p-3 rounded-lg bg-slate-50 dark:bg-[#090E1A] border border-slate-200 dark:border-slate-800 space-y-2.5 text-xs"
              >
                <input
                  type="text"
                  value={bankAccountName}
                  onChange={(e) => setBankAccountName(e.target.value)}
                  placeholder="Hesap Adı (Örn: Garanti BBVA TRY)"
                  maxLength={80}
                  required
                  className="w-full px-2.5 py-1.5 rounded-md bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={bankInstitution}
                    onChange={(e) => setBankInstitution(e.target.value)}
                    placeholder="Banka Adı"
                    maxLength={80}
                    required
                    className="w-full px-2.5 py-1.5 rounded-md bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                  <select
                    value={bankCurrency}
                    onChange={(e) => setBankCurrency(e.target.value as CurrencyCode)}
                    className="w-full px-2.5 py-1.5 rounded-md bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="TRY">TRY</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    value={openingBalanceTry}
                    onChange={(e) => setOpeningBalanceTry(e.target.value)}
                    placeholder="Açılış Bakiyesi (TRY)"
                    className="w-full px-2.5 py-1.5 font-mono rounded-md bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                  <input
                    type="date"
                    value={openingDate}
                    onChange={(e) => setOpeningDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-md bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddBank(false)}
                    className="px-2.5 py-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium"
                  >
                    Kaydet
                  </button>
                </div>
              </form>
            )}

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3 text-xs">
              {bankBalances.length === 0 ? (
                <p className="text-slate-500 dark:text-slate-400">
                  Henüz banka hesabı tanımlanmadı. Açılış bakiyesi eklemek için yukarıdan &ldquo;Hesap Ekle&rdquo; butonunu kullanabilirsiniz.
                </p>
              ) : (
                bankBalances.map((b) => (
                  <div
                    key={b.account.id}
                    className="p-2.5 rounded-lg bg-slate-50/70 dark:bg-[#090E1A]/60 border border-slate-200/70 dark:border-slate-800/80 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                        {b.account.name} ({b.account.currency})
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                          {formatCurrency(b.currentBalanceTry)}
                        </span>
                        <button
                          type="button"
                          onClick={() => onDeleteBankAccount(b.account.id)}
                          title="Hesabı Sil"
                          className="text-slate-400 hover:text-rose-500 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      <span>Açılış: {formatCurrency(b.openingBalanceTry)}</span>
                      <span className="text-emerald-600 dark:text-emerald-400">
                        +{formatCurrency(b.collectionsTry)}
                      </span>
                      {b.refundsTry > 0 && (
                        <span className="text-rose-600 dark:text-rose-400">
                          İade: -{formatCurrency(b.refundsTry)}
                        </span>
                      )}
                      {b.paidExpensesTry > 0 && (
                        <span className="text-rose-500 dark:text-rose-400">
                          Gider: -{formatCurrency(b.paidExpensesTry)}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <form
            onSubmit={handleSaveRates}
            className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3"
          >
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Döviz Kuru Ayarları (TRY Bazlı)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Yeni girilecek USD/EUR Cloud ve Lisans giderlerinde varsayılan kur olarak kullanılır.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                  USD / TRY
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={usdInput}
                  onChange={(e) => setUsdInput(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs font-mono tabular-nums rounded-lg bg-slate-50 dark:bg-[#090E1A] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                  EUR / TRY
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={eurInput}
                  onChange={(e) => setEurInput(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs font-mono tabular-nums rounded-lg bg-slate-50 dark:bg-[#090E1A] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full py-2 px-3 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors inline-flex items-center justify-center gap-1.5"
            >
              {rateSaved ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Kurlar Güncellendi</span>
                </>
              ) : (
                <span>Kurları Güncelle</span>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
