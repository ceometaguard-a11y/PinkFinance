import { useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  Clock,
  CreditCard,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { EnrichedInvoice, PinkFinanceDatabase, NavPage } from '../types/finance';
import {
  addMonths,
  ALL_EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  formatCurrency,
  formatDateTR,
  formatMonthTR,
  formatPercent,
  getMonthKey,
} from '../utils/formatters';
import {
  computeCollectionForecast,
  computeCurrentTotalCash,
  computeCustomerMatrix,
  computeMonthlyPnL,
  getLastNMonths,
} from '../utils/financeEngine';

interface DashboardPageProps {
  db: PinkFinanceDatabase;
  selectedMonth: string;
  enrichedInvoices: EnrichedInvoice[];
  onNavigate: (page: NavPage) => void;
  onOpenPaymentModal: (invoiceId: string) => void;
  onSelectCustomer: (customerId: string) => void;
}

const PIE_COLORS = [
  '#3B82F6', // blue
  '#10B981', // emerald
  '#F59E0B', // amber
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
  '#64748B', // slate
];

export function DashboardPage({
  db,
  selectedMonth,
  enrichedInvoices,
  onNavigate,
  onOpenPaymentModal,
  onSelectCustomer,
}: DashboardPageProps) {
  const [forecastMode, setForecastMode] = useState<'include_current' | 'next_three'>('include_current');
  const currentCash = computeCurrentTotalCash(db);
  const pnl = computeMonthlyPnL(db, selectedMonth);
  const customerMatrix = computeCustomerMatrix(db, selectedMonth);

  const forecastStartMonth =
    forecastMode === 'include_current' ? selectedMonth : addMonths(selectedMonth, 1);
  const collectionForecast = computeCollectionForecast(enrichedInvoices, forecastStartMonth, 3);
  const totalForecastTry = collectionForecast.reduce((s, p) => s + p.totalExpectedTry, 0);
  const totalForecastInvoices = collectionForecast.reduce((s, p) => s + p.invoiceCount, 0);
  const priorOverdueTry = enrichedInvoices
    .filter(
      (inv) =>
        !inv.isDraft &&
        inv.invoiceType !== 'refund' &&
        inv.remainingTry > 1 &&
        getMonthKey(inv.dueDate) < forecastStartMonth
    )
    .reduce((s, inv) => s + inv.remainingTry, 0);

  const forecastChartData = collectionForecast.map((pt) => ({
    month: pt.monthLabel,
    'Vadesi Gelen Tahsilat': pt.expectedOnTimeTry,
    'Gecikmiş (Vadesi Geçen)': pt.overdueInMonthTry,
    invoiceCount: pt.invoiceCount,
  }));

  const totalMrr = pnl.monthlyMrr + pnl.annualMrrRecognized;

  const openReceivables = enrichedInvoices.filter(
    (i) => !i.isDraft && i.invoiceType !== 'refund' && i.remainingTry > 1
  );
  const totalReceivableTry = openReceivables.reduce((s, i) => s + i.remainingTry, 0);
  const overdueInvoices = openReceivables.filter((i) => i.computedStatus === 'overdue');
  const overdueTotalTry = overdueInvoices.reduce((s, i) => s + i.remainingTry, 0);
  const approachingInvoices = openReceivables.filter((i) => i.computedStatus !== 'overdue');

  const concentratedCustomers = customerMatrix.filter((c) => c.concentrationWarning);

  // Chart 1: Son 6 Ay Gelir vs Gider vs Net Kar
  const last6Months = getLastNMonths(selectedMonth, 6);
  const sixMonthData = last6Months.map((m) => {
    const mPnl = computeMonthlyPnL(db, m);
    return {
      month: formatMonthTR(m, true),
      Gelir: Math.round(mPnl.totalRevenue),
      Gider: Math.round(mPnl.cogs + mPnl.totalOpex),
      'Net Kar': Math.round(mPnl.netIncome),
    };
  });

  // Chart 2: Gider Dağılımı Pasta Grafiği (Selected Month)
  const expensePieData = ALL_EXPENSE_CATEGORIES.map((cat, idx) => {
    const value =
      cat === 'cogs' ? pnl.cogs : pnl.opexByCategory[cat];
    return {
      name: EXPENSE_CATEGORY_LABELS[cat],
      value: Math.round(value),
      color: PIE_COLORS[idx % PIE_COLORS.length],
    };
  }).filter((d) => d.value > 0);

  const totalMonthExpenses = expensePieData.reduce((s, d) => s + d.value, 0);

  // Chart 3: En Çok Gelir Getiren İlk 5 Müşteri (Yığılmış Çubuk)
  const top5CustomersData = customerMatrix.slice(0, 5).map((row) => {
    const custInvoices = enrichedInvoices.filter(
      (i) => i.customerId === row.customer.id && !i.isDraft
    );
    const signedAmt = (i: EnrichedInvoice) => (i.invoiceType === 'refund' ? -i.amountTry : i.amountTry);
    const monthlyMrrSum = custInvoices
      .filter((i) => i.revenueModel === 'monthly_mrr')
      .reduce((s, i) => s + signedAmt(i), 0);
    const annualMrrSum = custInvoices
      .filter((i) => i.revenueModel === 'annual_mrr')
      .reduce((s, i) => s + signedAmt(i), 0);

    return {
      id: row.customer.id,
      name:
        row.customer.companyName.length > 22
          ? `${row.customer.companyName.slice(0, 20)}…`
          : row.customer.companyName,
      fullName: row.customer.companyName,
      'Aylık MRR': Math.round(monthlyMrrSum),
      'Yıllık MRR': Math.round(annualMrrSum),
      'Tek Seferlik': Math.round(row.oneOffTotal),
      Donanım: Math.round(row.hardwareTotal),
    };
  });

  const CustomTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: Array<{ name: string; value: number; color: string }>;
    label?: string;
  }) => {
    if (!active || !payload || payload.length === 0) return null;
    return (
      <div className="bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-700 rounded-lg p-3 shadow-xl text-xs">
        {label && (
          <p className="font-semibold text-slate-900 dark:text-white mb-1.5">{label}</p>
        )}
        <div className="space-y-1">
          {payload.map((entry) => (
            <div key={entry.name} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                <span
                  className="w-2 h-2 rounded-xs shrink-0"
                  style={{ backgroundColor: entry.color }}
                />
                {entry.name}
              </span>
              <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                {formatCurrency(entry.value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* 4 Primary KPI Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Güncel Kasa Bakiyesi</span>
            <button
              type="button"
              onClick={() => onNavigate('cashflow')}
              className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-0.5"
            >
              Detay <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {formatCurrency(currentCash)}
          </div>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            {db.bankAccounts.length} aktif banka hesabı toplamı
          </p>
        </div>

        <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{formatMonthTR(selectedMonth)} Net Kar/Zarar</span>
            <button
              type="button"
              onClick={() => onNavigate('pnl')}
              className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-0.5"
            >
              P&L <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          <div
            className={`mt-2 text-2xl font-bold font-mono tabular-nums ${
              pnl.netIncome >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {pnl.netIncome >= 0 ? '+' : ''}
            {formatCurrency(pnl.netIncome)}
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            {pnl.netIncome >= 0 ? (
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
            )}
            <span>
              Net Marj:{' '}
              <strong className="font-mono tabular-nums text-slate-700 dark:text-slate-200">
                {formatPercent(pnl.netMarginPct)}
              </strong>{' '}
              · Ciro: {formatCurrency(pnl.totalRevenue)}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Toplam Aylık MRR</span>
            <button
              type="button"
              onClick={() => onNavigate('customers')}
              className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-0.5"
            >
              Matris <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {formatCurrency(totalMrr)}
          </div>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            Aylık {formatCurrency(pnl.monthlyMrr)} + Yıllık Pay {formatCurrency(pnl.annualMrrRecognized)}
          </p>
        </div>

        <div
          className={`bg-white dark:bg-[#0F172A] border rounded-xl p-5 ${
            overdueTotalTry > 0
              ? 'border-rose-300 dark:border-rose-800/80'
              : 'border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Tahsil Edilmeyi Bekleyen</span>
            <button
              type="button"
              onClick={() => onNavigate('invoices')}
              className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-0.5"
            >
              Faturalar <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {formatCurrency(totalReceivableTry)}
          </div>
          <div className="mt-1.5 text-xs">
            {overdueTotalTry > 0 ? (
              <span className="text-rose-600 dark:text-rose-400 font-medium font-mono tabular-nums">
                {overdueInvoices.length} gecikmiş fatura: {formatCurrency(overdueTotalTry)}
              </span>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400">
                Vadesi geçmiş tahsilat yok
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Alert Cards: Overdue / Approaching Collections & Concentration */}
      {(overdueInvoices.length > 0 || approachingInvoices.length > 0 || concentratedCustomers.length > 0) && (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {overdueInvoices.length > 0 && (
            <div className="bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/60 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-rose-700 dark:text-rose-400">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Gecikmiş Tahsilat Uyarıları ({overdueInvoices.length})</span>
                </div>
                <span className="text-xs font-mono tabular-nums font-bold text-rose-700 dark:text-rose-300">
                  {formatCurrency(overdueTotalTry)}
                </span>
              </div>
              <div className="divide-y divide-rose-200/70 dark:divide-rose-900/40">
                {overdueInvoices.slice(0, 3).map((inv) => (
                  <div
                    key={inv.id}
                    className="py-2 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 dark:text-slate-100 truncate">
                        {inv.customerName}
                      </p>
                      <p className="text-slate-500 dark:text-slate-400">
                        {inv.invoiceNo} · Vade: {formatDateTR(inv.dueDate)} ·{' '}
                        <span className="text-rose-600 dark:text-rose-400 font-medium">
                          {inv.daysOverdue} gün gecikti
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                        {formatCurrency(inv.remainingTry)}
                      </span>
                      <button
                        type="button"
                        onClick={() => onOpenPaymentModal(inv.id)}
                        className="px-2.5 py-1 rounded-md bg-rose-600 hover:bg-rose-700 text-white font-medium transition-colors whitespace-nowrap"
                      >
                        Tahsil Et
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(approachingInvoices.length > 0 || concentratedCustomers.length > 0) && (
            <div className="bg-amber-50/60 dark:bg-amber-950/15 border border-amber-200 dark:border-amber-900/50 rounded-xl p-4 space-y-3">
              {approachingInvoices.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
                      <Clock className="w-4 h-4 shrink-0" />
                      <span>Vadesi Yaklaşan Tahsilatlar ({approachingInvoices.length})</span>
                    </div>
                    <span className="text-xs font-mono tabular-nums font-semibold text-amber-700 dark:text-amber-400">
                      {formatCurrency(
                        approachingInvoices.reduce((s, i) => s + i.remainingTry, 0)
                      )}
                    </span>
                  </div>
                  <div className="divide-y divide-amber-200/70 dark:divide-amber-900/40">
                    {approachingInvoices.slice(0, 2).map((inv) => (
                      <div
                        key={inv.id}
                        className="py-2 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 dark:text-slate-100 truncate">
                            {inv.customerName}
                          </p>
                          <p className="text-slate-500 dark:text-slate-400">
                            {inv.invoiceNo} · Son Ödeme: {formatDateTR(inv.dueDate)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2.5 shrink-0">
                          <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                            {formatCurrency(inv.remainingTry)}
                          </span>
                          <button
                            type="button"
                            onClick={() => onOpenPaymentModal(inv.id)}
                            className="px-2.5 py-1 rounded-md bg-slate-900 dark:bg-slate-800 hover:bg-slate-700 text-white font-medium transition-colors whitespace-nowrap"
                          >
                            Tahsilat İşle
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {concentratedCustomers.length > 0 && (
                <div className="pt-2 border-t border-amber-200/80 dark:border-amber-900/40 flex items-start justify-between gap-3 text-xs">
                  <div>
                    <p className="font-semibold text-amber-800 dark:text-amber-300">
                      Gelir Konsantrasyon Uyarısı
                    </p>
                    <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                      {concentratedCustomers[0].customer.companyName} toplam şirket cirosunun{' '}
                      <strong className="font-mono tabular-nums text-slate-900 dark:text-white">
                        {formatPercent(concentratedCustomers[0].revenueSharePct)}
                      </strong>{' '}
                      kısmını oluşturuyor.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectCustomer(concentratedCustomers[0].customer.id)}
                    className="text-blue-600 dark:text-blue-400 hover:underline font-medium shrink-0"
                  >
                    Müşteri Detayı
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Charts Row 1: 6-Month Revenue vs Expense vs Net Profit + Expense Breakdown Pie */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Son 6 Ay Gelir, Gider ve Net Kar Performansı
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Yıllık MRR sözleşmeleri aylık ertelenmiş gelir payına göre dağıtılmıştır
              </p>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sixMonthData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12, fill: '#94A3B8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94A3B8' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${Math.round(v / 1000)}K`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                <Bar dataKey="Gelir" fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="Gider" fill="#64748B" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="Net Kar" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              {formatMonthTR(selectedMonth)} Gider Dağılımı
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              Toplam Gider (COGS + OPEX): {formatCurrency(totalMonthExpenses)}
            </p>
          </div>
          {expensePieData.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-xs text-slate-500">
              Bu ay için gider kaydı bulunmuyor.
            </div>
          ) : (
            <div className="flex-1 flex flex-col">
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expensePieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={80}
                      paddingAngle={2}
                    >
                      {expensePieData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 space-y-1.5 overflow-y-auto max-h-[120px] pr-1">
                {expensePieData
                  .slice()
                  .sort((a, b) => b.value - a.value)
                  .map((item) => {
                    const pct = totalMonthExpenses > 0 ? (item.value / totalMonthExpenses) * 100 : 0;
                    return (
                      <div key={item.name} className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300 truncate">
                          <span
                            className="w-2.5 h-2.5 rounded-xs shrink-0"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="truncate">{item.name}</span>
                        </span>
                        <span className="font-mono tabular-nums text-slate-800 dark:text-slate-200 shrink-0 ml-2">
                          {formatPercent(pct)}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Chart Row 2: Tahsilat Beklenti (Gelecek 3 Ay) + Tahakkuk vs Nakit */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-emerald-500 shrink-0" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Tahsilat Beklenti (Gelecek 3 Ay Beklenen Nakit Girişi)
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono tabular-nums">
                {totalForecastInvoices} açık fatura · Toplam beklenen:{' '}
                <strong className="text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(totalForecastTry)}
                </strong>
                {priorOverdueTry > 0 && (
                  <span className="text-rose-600 dark:text-rose-400">
                    {' '}
                    · Önceki aylardan devreden gecikmiş: {formatCurrency(priorOverdueTry)}
                  </span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#090E1A] self-start sm:self-auto shrink-0">
              <button
                type="button"
                onClick={() => setForecastMode('include_current')}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap ${
                  forecastMode === 'include_current'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Bu Ay + 2 Ay
              </button>
              <button
                type="button"
                onClick={() => setForecastMode('next_three')}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap ${
                  forecastMode === 'next_three'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Sonraki 3 Ay
              </button>
            </div>
          </div>

          {totalForecastTry === 0 ? (
            <div className="h-[260px] flex flex-col items-center justify-center text-center text-xs text-slate-500 dark:text-slate-400 space-y-2 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
              <p>
                {formatMonthTR(forecastStartMonth, true)} –{' '}
                {formatMonthTR(addMonths(forecastStartMonth, 2), true)} döneminde vadesi gelen açık
                fatura bulunmuyor.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('invoices')}
                className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                Faturaları Görüntüle
              </button>
            </div>
          ) : (
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={forecastChartData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(148,163,184,0.15)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12, fill: '#94A3B8' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#94A3B8' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${Math.round(v / 1000)}K`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                  <Bar
                    dataKey="Vadesi Gelen Tahsilat"
                    stackId="forecast"
                    fill="#10B981"
                    radius={[0, 0, 0, 0]}
                    maxBarSize={48}
                  />
                  <Bar
                    dataKey="Gecikmiş (Vadesi Geçen)"
                    stackId="forecast"
                    fill="#EF4444"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={48}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Summary: P&L vs Nakit Akışı Kıyas Kartı */}
        <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <CreditCard className="w-4 h-4 text-blue-500" />
              <span>{formatMonthTR(selectedMonth)} Tahakkuk vs. Nakit</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Kağıt üzerindeki karlılık ile kasaya giren gerçek nakit arasındaki fark
            </p>

            <div className="mt-5 space-y-3 text-xs">
              <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800/80">
                <span className="text-slate-600 dark:text-slate-400">P&amp;L Tanınan Gelir</span>
                <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                  {formatCurrency(pnl.totalRevenue)}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800/80">
                <span className="text-slate-600 dark:text-slate-400">
                  Brüt Kar ({formatPercent(pnl.grossMarginPct)})
                </span>
                <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                  {formatCurrency(pnl.grossProfit)}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800/80">
                <span className="text-slate-600 dark:text-slate-400">Operasyonel Gider (OPEX)</span>
                <span className="font-mono tabular-nums font-semibold text-rose-600 dark:text-rose-400">
                  -{formatCurrency(pnl.totalOpex)}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="font-medium text-slate-800 dark:text-slate-200">Net Kar / Zarar</span>
                <span
                  className={`font-mono tabular-nums font-bold text-sm ${
                    pnl.netIncome >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {formatCurrency(pnl.netIncome)}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('cashflow')}
            className="mt-4 w-full py-2.5 px-4 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 transition-colors"
          >
            Nakit Akışı &amp; Kasa Raporuna Git
          </button>
        </div>
      </section>

      {/* Chart 3: Top 5 Customers Stacked Bar */}
      <section className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                En Çok Gelir Getiren İlk 5 Müşteri (Gelir Modeli Kırılımı)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Aylık MRR, Yıllık MRR, Tek Seferlik Hizmet ve Donanım satış payları
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('customers')}
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
            >
              Tüm Matrisi Gör
            </button>
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={top5CustomersData}
                layout="vertical"
                margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: '#94A3B8' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${Math.round(v / 1000)}K`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={150}
                  tick={{ fontSize: 11, fill: '#CBD5E1' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                <Bar dataKey="Aylık MRR" stackId="a" fill="#3B82F6" barSize={22} />
                <Bar dataKey="Yıllık MRR" stackId="a" fill="#10B981" barSize={22} />
                <Bar dataKey="Tek Seferlik" stackId="a" fill="#F59E0B" barSize={22} />
                <Bar dataKey="Donanım" stackId="a" fill="#8B5CF6" radius={[0, 4, 4, 0]} barSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
      </section>
    </div>
  );
}
