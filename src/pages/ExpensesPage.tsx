import { useMemo, useState } from 'react';
import { Check, Download, Plus, RefreshCw, RotateCcw, Search, Trash2 } from 'lucide-react';
import { Expense, ExpenseCategory, ExpenseStatus } from '../types/finance';
import {
  ALL_EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  exportToCSV,
  formatCurrency,
  formatDateTR,
  formatMonthTR,
  getMonthKey,
} from '../utils/formatters';
import { REFERENCE_TODAY } from '../utils/financeEngine';
import { ExpenseStatusLabel } from '../components/StatusLabel';

interface ExpensesPageProps {
  expenses: Expense[];
  selectedMonth: string;
  onOpenNewExpense: () => void;
  onMarkPaid: (expenseId: string, paymentDate: string, bankAccount: string) => void;
  onMarkPending: (expenseId: string) => void;
  onDeleteExpense: (expenseId: string) => void;
  onGenerateRecurring: (monthKey: string) => Promise<number>;
}

export function ExpensesPage({
  expenses,
  selectedMonth,
  onOpenNewExpense,
  onMarkPaid,
  onMarkPending,
  onDeleteExpense,
  onGenerateRecurring,
}: ExpensesPageProps) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | ExpenseCategory>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ExpenseStatus>('all');
  const [monthScope, setMonthScope] = useState<'selected' | 'all'>('selected');
  const [recurringFeedback, setRecurringFeedback] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return expenses
      .filter((e) => {
        if (monthScope === 'selected' && getMonthKey(e.expenseDate) !== selectedMonth) {
          return false;
        }
        if (categoryFilter !== 'all' && e.category !== categoryFilter) return false;
        if (statusFilter !== 'all' && e.status !== statusFilter) return false;
        if (
          q &&
          !e.title.toLowerCase().includes(q) &&
          !e.vendor.toLowerCase().includes(q)
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => b.expenseDate.localeCompare(a.expenseDate));
  }, [expenses, monthScope, selectedMonth, categoryFilter, statusFilter, search]);

  const totalFiltered = filtered.reduce((s, e) => s + e.amountTry, 0);
  const paidFiltered = filtered
    .filter((e) => e.status === 'paid')
    .reduce((s, e) => s + e.amountTry, 0);
  const pendingFiltered = filtered
    .filter((e) => e.status === 'pending')
    .reduce((s, e) => s + e.amountTry, 0);

  const handleGenerateRecurring = async () => {
    const createdCount = await onGenerateRecurring(selectedMonth);
    if (createdCount > 0) {
      setRecurringFeedback(
        `${formatMonthTR(selectedMonth)} için ${createdCount} adet tekrarlayan gider taslağı oluşturuldu.`
      );
    } else {
      setRecurringFeedback(
        `${formatMonthTR(selectedMonth)} için oluşturulacak yeni tekrarlayan gider bulunmuyor (tüm şablonlar zaten mevcut).`
      );
    }
    setTimeout(() => setRecurringFeedback(null), 5000);
  };

  const handleExport = () => {
    exportToCSV(
      `PinkFinance_Giderler_${monthScope === 'selected' ? selectedMonth : 'Tumu'}`,
      [
        'Gider Tarihi',
        'Vade Tarihi',
        'Kategori',
        'Tedarikçi',
        'Açıklama',
        'Para Birimi',
        'Orijinal Tutar',
        'Kur',
        'TL Karşılığı',
        'Durum',
        'Tekrarlayan',
      ],
      filtered.map((e) => [
        formatDateTR(e.expenseDate),
        formatDateTR(e.dueDate),
        EXPENSE_CATEGORY_LABELS[e.category],
        e.vendor,
        e.title,
        e.currency,
        e.amount,
        e.fxRate,
        Math.round(e.amountTry),
        e.status === 'paid' ? 'Ödendi' : 'Ödenecek',
        e.isRecurring ? 'Evet' : 'Hayır',
      ])
    );
  };

  return (
    <div className="space-y-5">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Toplam Gider ({monthScope === 'selected' ? formatMonthTR(selectedMonth) : 'Tüm Dönem'})
          </span>
          <div className="mt-1 text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {formatCurrency(totalFiltered)}
          </div>
        </div>
        <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-500 dark:text-slate-400">Ödenmiş Giderler</span>
          <div className="mt-1 text-xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
            {formatCurrency(paidFiltered)}
          </div>
        </div>
        <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-500 dark:text-slate-400">Ödeme Bekleyen (Borçlar)</span>
          <div className="mt-1 text-xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400">
            {formatCurrency(pendingFiltered)}
          </div>
        </div>
      </div>

      {recurringFeedback && (
        <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 text-xs text-blue-800 dark:text-blue-200">
          {recurringFeedback}
        </div>
      )}

      {/* Filter & Recurring Toolbar */}
      <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#090E1A]">
              <button
                type="button"
                onClick={() => setMonthScope('selected')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  monthScope === 'selected'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {formatMonthTR(selectedMonth)}
              </button>
              <button
                type="button"
                onClick={() => setMonthScope('all')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  monthScope === 'all'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Tüm Aylar
              </button>
            </div>

            <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#090E1A]">
              {(['all', 'paid', 'pending'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    statusFilter === st
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {st === 'all' ? 'Tümü' : st === 'paid' ? 'Ödendi' : 'Ödenecek'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleGenerateRecurring}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Tekrarlayan Giderleri Üret</span>
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV İndir</span>
            </button>
            <button
              type="button"
              onClick={onOpenNewExpense}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Yeni Gider</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Gider açıklaması veya tedarikçi ara..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-[#090E1A] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as 'all' | ExpenseCategory)}
            className="px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-[#090E1A] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
          >
            <option value="all">Tüm Gider Kategorileri (8)</option>
            {ALL_EXPENSE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {EXPENSE_CATEGORY_LABELS[cat]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-900/40">
                <th className="py-3 px-4">Açıklama &amp; Tedarikçi</th>
                <th className="py-3 px-4">Kategori</th>
                <th className="py-3 px-4">Tarih / Vade</th>
                <th className="py-3 px-4 text-right">Döviz &amp; Kur</th>
                <th className="py-3 px-4 text-right">TL Karşılığı</th>
                <th className="py-3 px-4">Durum</th>
                <th className="py-3 px-4 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-xs">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 dark:text-slate-400">
                    Seçili filtrelere ait gider kaydı bulunamadı.
                  </td>
                </tr>
              ) : (
                filtered.map((exp) => (
                  <tr
                    key={exp.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900 dark:text-white flex items-center gap-2">
                        <span>{exp.title}</span>
                        {exp.isRecurring && (
                          <span className="text-[11px] text-blue-600 dark:text-blue-400">
                            · Tekrarlayan
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {exp.vendor}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {EXPENSE_CATEGORY_LABELS[exp.category]}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      <div>{formatDateTR(exp.expenseDate)}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Vade: {formatDateTR(exp.dueDate)}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                      {exp.currency !== 'TRY' ? (
                        <div>
                          <span className="text-slate-800 dark:text-slate-200 font-medium">
                            {formatCurrency(exp.amount, exp.currency)}
                          </span>
                          <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                            Kur: {exp.fxRate.toFixed(2)} ₺
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400">TRY</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                      {formatCurrency(exp.amountTry)}
                    </td>
                    <td className="py-3 px-4">
                      <ExpenseStatusLabel status={exp.status} />
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      {confirmDeleteId === exp.id ? (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteExpense(exp.id);
                              setConfirmDeleteId(null);
                            }}
                            className="px-2 py-1 rounded-md text-[11px] font-medium bg-rose-600 hover:bg-rose-700 text-white transition-colors"
                          >
                            Silmeyi Onayla
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-1 rounded-md text-[11px] font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                          >
                            İptal
                          </button>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-2">
                          {exp.status === 'pending' ? (
                            <button
                              type="button"
                              onClick={() =>
                                onMarkPaid(exp.id, REFERENCE_TODAY, 'Garanti BBVA TRY')
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                            >
                              <Check className="w-3 h-3" />
                              <span>Ödendi Yap</span>
                            </button>
                          ) : (
                            <>
                              <span className="text-[11px] text-slate-400 font-mono">
                                {exp.paymentDate ? formatDateTR(exp.paymentDate) : 'Ödendi'}
                              </span>
                              <button
                                type="button"
                                onClick={() => onMarkPending(exp.id)}
                                title="Ödenecek Durumuna Geri Al"
                                aria-label="Ödenecek Durumuna Geri Al"
                                className="p-1.5 rounded-md text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(exp.id)}
                            title="Gideri Sil"
                            aria-label="Gideri Sil"
                            className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
