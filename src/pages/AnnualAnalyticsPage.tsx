import { Fragment, useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Download,
  Layers,
  Plus,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { EnrichedInvoice, PinkFinanceDatabase } from '../types/finance';
import {
  EXPENSE_CATEGORY_LABELS,
  exportToCSV,
  formatCurrency,
  formatPercent,
  OPEX_CATEGORIES,
} from '../utils/formatters';
import { computeAnnualAnalytics } from '../utils/financeEngine';

interface AnnualAnalyticsPageProps {
  db: PinkFinanceDatabase;
  selectedMonth: string;
  enrichedInvoices: EnrichedInvoice[];
  onSelectCustomer: (customerId: string) => void;
  onOpenNewInvoice: () => void;
  onOpenNewExpense: () => void;
}

const EXPENSE_PIE_COLORS = [
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#8B5CF6',
  '#EC4899',
  '#06B6D4',
  '#F97316',
  '#64748B',
];

type HeroChartMode = 'pnl' | 'cumulative' | 'accrual_vs_cash';
type MatrixDetailMode = 'summary' | 'full';

export function AnnualAnalyticsPage({
  db,
  selectedMonth,
  enrichedInvoices,
  onSelectCustomer,
  onOpenNewInvoice,
  onOpenNewExpense,
}: AnnualAnalyticsPageProps) {
  const availableYears = useMemo(() => {
    const yearSet = new Set<string>(['2025', '2026', '2027']);
    const activeYear = selectedMonth.slice(0, 4);
    if (/^\d{4}$/.test(activeYear)) yearSet.add(activeYear);

    for (const inv of db.invoices) {
      if (inv.issueDate.length >= 4) yearSet.add(inv.issueDate.slice(0, 4));
      if (inv.dueDate.length >= 4) yearSet.add(inv.dueDate.slice(0, 4));
    }
    for (const exp of db.expenses) {
      if (exp.expenseDate.length >= 4) yearSet.add(exp.expenseDate.slice(0, 4));
    }
    for (const pay of db.payments) {
      if (pay.paymentDate.length >= 4) yearSet.add(pay.paymentDate.slice(0, 4));
    }

    return Array.from(yearSet).sort();
  }, [db.invoices, db.expenses, db.payments, selectedMonth]);

  const [selectedYear, setSelectedYear] = useState<string>(() => selectedMonth.slice(0, 4) || '2026');
  const [heroMode, setHeroMode] = useState<HeroChartMode>('pnl');
  const [showMarginLine, setShowMarginLine] = useState<boolean>(true);
  const [matrixMode, setMatrixMode] = useState<MatrixDetailMode>('summary');

  const analytics = useMemo(
    () => computeAnnualAnalytics(db, enrichedInvoices, selectedYear),
    [db, enrichedInvoices, selectedYear]
  );

  const { totals, months, quarters, expenseCategories, customers } = analytics;

  const yearIdx = availableYears.indexOf(selectedYear);
  const canPrevYear = yearIdx > 0;
  const canNextYear = yearIdx >= 0 && yearIdx < availableYears.length - 1;

  // Chart Datasets
  const heroChartData = useMemo(() => {
    return months.map((m) => ({
      month: m.shortLabel,
      fullLabel: m.fullLabel,
      Gelir: Math.round(m.pnl.totalRevenue),
      Gider: Math.round(m.totalExpense),
      'Net Kar': Math.round(m.pnl.netIncome),
      'Net Marj %': Number(m.pnl.netMarginPct.toFixed(1)),
      'Kümülatif Ciro': Math.round(m.cumulativeRevenue),
      'Kümülatif Gider': Math.round(m.cumulativeExpenses),
      'Kümülatif Net Kar': Math.round(m.cumulativeNetIncome),
      'P&L Ciro': Math.round(m.pnl.totalRevenue),
      Faturalanan: Math.round(m.billedTry),
      'Kasa Tahsilatı': Math.round(m.cashFlow.totalCollectionsTry),
      'Ödenen Gider': Math.round(m.cashFlow.totalPaidExpensesTry),
      'Kasa Bakiyesi': Math.round(m.cashFlow.closingCashTry),
    }));
  }, [months]);

  const revenueMixData = useMemo(() => {
    return months.map((m) => ({
      month: m.shortLabel,
      'Aylık MRR': Math.round(m.pnl.monthlyMrr),
      'Yıllık MRR (Pay)': Math.round(m.pnl.annualMrrRecognized),
      'Tek Seferlik': Math.round(m.pnl.oneOff),
      Donanım: Math.round(m.pnl.hardware),
      'Toplam MRR': Math.round(m.totalMrr),
    }));
  }, [months]);

  const cashFlowChartData = useMemo(() => {
    return months.map((m) => ({
      month: m.shortLabel,
      'Tahsilat (+)': Math.round(m.cashFlow.totalCollectionsTry),
      'Ödenen Gider (-)': Math.round(m.cashFlow.totalPaidExpensesTry),
      'Net Nakit': Math.round(m.cashFlow.netCashChangeTry),
      'Dönem Sonu Kasa': Math.round(m.cashFlow.closingCashTry),
    }));
  }, [months]);

  const quarterlyChartData = useMemo(() => {
    return quarters.map((q) => ({
      quarter: q.quarter,
      Ciro: Math.round(q.revenue),
      Gider: Math.round(q.totalExpense),
      'Net Kar': Math.round(q.netIncome),
    }));
  }, [quarters]);

  const expensePieData = useMemo(() => {
    return expenseCategories
      .filter((c) => c.accrualTry > 0)
      .map((c, idx) => ({
        name: EXPENSE_CATEGORY_LABELS[c.category],
        value: Math.round(c.accrualTry),
        paid: Math.round(c.paidTry),
        sharePct: c.sharePct,
        color: EXPENSE_PIE_COLORS[idx % EXPENSE_PIE_COLORS.length],
      }));
  }, [expenseCategories]);

  const mrrShareOfRevenue =
    totals.totalRevenue > 0
      ? ((totals.monthlyMrr + totals.annualMrrRecognized) / totals.totalRevenue) * 100
      : 0;

  const handleExportAnnualCSV = () => {
    const headers = [
      'Finansal Kalem',
      ...months.map((m) => m.shortLabel),
      `${selectedYear} TOPLAM`,
    ];
    const rows: (string | number)[][] = [
      [
        '(+) Aylık MRR Gelirleri',
        ...months.map((m) => Math.round(m.pnl.monthlyMrr)),
        Math.round(totals.monthlyMrr),
      ],
      [
        '(+) Yıllık MRR (Ertelenmiş Pay)',
        ...months.map((m) => Math.round(m.pnl.annualMrrRecognized)),
        Math.round(totals.annualMrrRecognized),
      ],
      [
        '(+) Tek Seferlik Hizmetler',
        ...months.map((m) => Math.round(m.pnl.oneOff)),
        Math.round(totals.oneOff),
      ],
      [
        '(+) Donanım Satışları',
        ...months.map((m) => Math.round(m.pnl.hardware)),
        Math.round(totals.hardware),
      ],
      [
        '= TOPLAM CİRO (P&L)',
        ...months.map((m) => Math.round(m.pnl.totalRevenue)),
        Math.round(totals.totalRevenue),
      ],
      [
        'Faturalanan Tutar (Kesilen Fatura)',
        ...months.map((m) => Math.round(m.billedTry)),
        Math.round(totals.totalBilled),
      ],
      [
        '(-) Donanım Maliyeti (COGS)',
        ...months.map((m) => -Math.round(m.pnl.cogs)),
        -Math.round(totals.cogs),
      ],
      [
        '= BRÜT KAR',
        ...months.map((m) => Math.round(m.pnl.grossProfit)),
        Math.round(totals.grossProfit),
      ],
      ...OPEX_CATEGORIES.map((cat) => [
        `(-) ${EXPENSE_CATEGORY_LABELS[cat]}`,
        ...months.map((m) => -Math.round(m.pnl.opexByCategory[cat])),
        -Math.round(totals.opexByCategory[cat]),
      ]),
      [
        '= TOPLAM OPEX',
        ...months.map((m) => -Math.round(m.pnl.totalOpex)),
        -Math.round(totals.totalOpex),
      ],
      [
        '= NET KAR / ZARAR (EBITDA)',
        ...months.map((m) => Math.round(m.pnl.netIncome)),
        Math.round(totals.netIncome),
      ],
      [
        'Net Kar Marjı (%)',
        ...months.map((m) => `${m.pnl.netMarginPct.toFixed(1)}%`),
        `${totals.netMarginPct.toFixed(1)}%`,
      ],
      [
        '(+) Kasa Tahsilatları',
        ...months.map((m) => Math.round(m.cashFlow.totalCollectionsTry)),
        Math.round(totals.totalCollections),
      ],
      [
        '(-) Ödenen Giderler',
        ...months.map((m) => -Math.round(m.cashFlow.totalPaidExpensesTry)),
        -Math.round(totals.totalPaidExpenses),
      ],
      [
        '= Net Nakit Değişimi',
        ...months.map((m) => Math.round(m.cashFlow.netCashChangeTry)),
        Math.round(totals.netCashChange),
      ],
      [
        'Dönem Sonu Kasa Bakiyesi',
        ...months.map((m) => Math.round(m.cashFlow.closingCashTry)),
        Math.round(totals.closingCashEndOfYear),
      ],
    ];
    exportToCSV(`PinkFinance_Yillik_Analiz_${selectedYear}`, headers, rows);
  };

  const CustomProTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: Array<{ name: string; value: number; color: string; unit?: string }>;
    label?: string;
  }) => {
    if (!active || !payload || payload.length === 0) return null;
    return (
      <div className="bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-700 rounded-lg p-3 shadow-xl text-xs min-w-[200px]">
        {label && (
          <p className="font-semibold text-slate-900 dark:text-white mb-2 pb-1.5 border-b border-slate-100 dark:border-slate-800">
            {label} {selectedYear}
          </p>
        )}
        <div className="space-y-1.5">
          {payload.map((entry) => {
            const isPercent = entry.name.includes('%');
            return (
              <div key={entry.name} className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                  <span
                    className="w-2.5 h-2.5 rounded-xs shrink-0"
                    style={{ backgroundColor: entry.color }}
                  />
                  {entry.name}
                </span>
                <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                  {isPercent ? formatPercent(entry.value) : formatCurrency(entry.value)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const formatAxisK = (v: number) => {
    if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (Math.abs(v) >= 1000) return `${Math.round(v / 1000)}K`;
    return String(Math.round(v));
  };

  return (
    <div className="space-y-6">
      {/* Top Year Control Bar */}
      <section className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <CalendarRange className="w-4 h-4 text-blue-500 shrink-0" />
            <h2>{selectedYear} Yılı 12 Aylık Finansal Analiz Merkezi</h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Ocak–Aralık {selectedYear} dönemi tahakkuk (P&amp;L), nakit akışı, MRR büyümesi,
            çeyreklik performans ve müşteri gelir dağılımı
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {/* Year Stepper + Segmented Year Selector */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#090E1A]">
            <button
              type="button"
              disabled={!canPrevYear}
              onClick={() => canPrevYear && setSelectedYear(availableYears[yearIdx - 1])}
              aria-label="Önceki yıl"
              className="p-1.5 rounded-md text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {availableYears.map((yr) => (
              <button
                key={yr}
                type="button"
                onClick={() => setSelectedYear(yr)}
                className={`px-3 py-1.5 text-xs font-mono tabular-nums font-semibold rounded-md transition-colors whitespace-nowrap ${
                  selectedYear === yr
                    ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {yr}
              </button>
            ))}
            <button
              type="button"
              disabled={!canNextYear}
              onClick={() => canNextYear && setSelectedYear(availableYears[yearIdx + 1])}
              aria-label="Sonraki yıl"
              className="p-1.5 rounded-md text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleExportAnnualCSV}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>12 Aylık Rapor İndir (CSV)</span>
          </button>
        </div>
      </section>

      {/* Empty State Banner when Selected Year Has No Records */}
      {!analytics.hasAnyData && (
        <section className="bg-white dark:bg-[#0F172A] border border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              {selectedYear} yılı için henüz finansal kayıt bulunmuyor
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {selectedYear} tarihli fatura, tahsilat veya gider eklediğinizde 12 aylık tüm grafikler,
              çeyreklik özetler ve P&amp;L matrisi anlık olarak hesaplanır.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenNewInvoice}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Fatura / Gelir Ekle</span>
            </button>
            <button
              type="button"
              onClick={onOpenNewExpense}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>Gider Ekle</span>
            </button>
          </div>
        </section>
      )}

      {/* 6 Executive Annual KPI Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {selectedYear} Toplam Ciro (P&amp;L)
          </span>
          <div className="mt-1.5 text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {formatCurrency(totals.totalRevenue)}
          </div>
          <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            Aylık Ort: {formatCurrency(totals.avgMonthlyRevenue)} · MRR {formatPercent(mrrShareOfRevenue)}
          </p>
        </div>

        <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Yıllık Net Kar / Zarar
          </span>
          <div
            className={`mt-1.5 text-xl font-bold font-mono tabular-nums ${
              totals.netIncome >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {totals.netIncome >= 0 ? '+' : ''}
            {formatCurrency(totals.netIncome)}
          </div>
          <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums flex items-center gap-1">
            {totals.netIncome >= 0 ? (
              <TrendingUp className="w-3 h-3 text-emerald-500 shrink-0" />
            ) : (
              <TrendingDown className="w-3 h-3 text-rose-500 shrink-0" />
            )}
            <span>
              Marj: {formatPercent(totals.netMarginPct)} · {totals.profitableMonths}/12 kârlı ay
            </span>
          </p>
        </div>

        <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Brüt Kar &amp; Brüt Marj
          </span>
          <div className="mt-1.5 text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {formatCurrency(totals.grossProfit)}
          </div>
          <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            Brüt Marj: {formatPercent(totals.grossMarginPct)} · COGS: {formatCurrency(totals.cogs)}
          </p>
        </div>

        <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Toplam Gider (COGS+OPEX)
          </span>
          <div className="mt-1.5 text-xl font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400">
            -{formatCurrency(totals.totalExpenses)}
          </div>
          <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            Aylık Burn: {formatCurrency(totals.avgMonthlyExpense)} · OPEX {formatCurrency(totals.totalOpex)}
          </p>
        </div>

        <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Yıllık Net Nakit Akışı
          </span>
          <div
            className={`mt-1.5 text-xl font-bold font-mono tabular-nums ${
              totals.netCashChange >= 0
                ? 'text-cyan-600 dark:text-cyan-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {totals.netCashChange >= 0 ? '+' : ''}
            {formatCurrency(totals.netCashChange)}
          </div>
          <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            Giriş: {formatCurrency(totals.totalCollections)} · Çıkış: {formatCurrency(totals.totalPaidExpenses)}
          </p>
        </div>

        <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            MRR Run-Rate &amp; Tahsilat
          </span>
          <div className="mt-1.5 text-xl font-bold font-mono tabular-nums text-blue-600 dark:text-blue-400">
            {formatCurrency(totals.mrrDecRunRate)}
            <span className="text-xs font-normal text-slate-500 dark:text-slate-400">/ay</span>
          </div>
          <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            ARR: {formatCurrency(totals.mrrArrRunRate, 'TRY', true)} · Tahsilat: {formatPercent(totals.collectionRatioPct)}
          </p>
        </div>
      </section>

      {/* Secondary Highlights Strip: Best / Peak / Worst & Deferred Revenue */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3.5 flex items-center justify-between gap-3">
          <div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
              En Yüksek Ciro Ayı
            </span>
            <span className="text-sm font-semibold text-slate-900 dark:text-white">
              {analytics.peakRevenueMonth && analytics.peakRevenueMonth.pnl.totalRevenue > 0
                ? analytics.peakRevenueMonth.fullLabel
                : '—'}
            </span>
          </div>
          <span className="text-sm font-bold font-mono tabular-nums text-blue-600 dark:text-blue-400">
            {analytics.peakRevenueMonth && analytics.peakRevenueMonth.pnl.totalRevenue > 0
              ? formatCurrency(analytics.peakRevenueMonth.pnl.totalRevenue)
              : '0 ₺'}
          </span>
        </div>

        <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3.5 flex items-center justify-between gap-3">
          <div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
              En Kârlı Ay (Net Kar)
            </span>
            <span className="text-sm font-semibold text-slate-900 dark:text-white">
              {analytics.bestMonth && analytics.hasAnyData ? analytics.bestMonth.fullLabel : '—'}
            </span>
          </div>
          <span className="text-sm font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5" />
            {analytics.bestMonth && analytics.hasAnyData
              ? formatCurrency(analytics.bestMonth.pnl.netIncome)
              : '0 ₺'}
          </span>
        </div>

        <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3.5 flex items-center justify-between gap-3">
          <div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
              En Düşük Net Sonuç Ayı
            </span>
            <span className="text-sm font-semibold text-slate-900 dark:text-white">
              {analytics.worstMonth && analytics.hasAnyData ? analytics.worstMonth.fullLabel : '—'}
            </span>
          </div>
          <span className="text-sm font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400 inline-flex items-center gap-1">
            <ArrowDownRight className="w-3.5 h-3.5" />
            {analytics.worstMonth && analytics.hasAnyData
              ? formatCurrency(analytics.worstMonth.pnl.netIncome)
              : '0 ₺'}
          </span>
        </div>

        <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3.5 flex items-center justify-between gap-3">
          <div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
              Yıl Sonrası Ertelenmiş Gelir / Açık Alacak
            </span>
            <span className="text-xs font-mono tabular-nums text-slate-700 dark:text-slate-300">
              Ertelenmiş: {formatCurrency(totals.deferredBacklogAfterYear)}
            </span>
          </div>
          <span className="text-sm font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400">
            {formatCurrency(totals.openReceivablesFromYear)}
          </span>
        </div>
      </section>

      {/* HERO PRO CHART: 12-Month Comprehensive Analytical View */}
      <section className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-500 shrink-0" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                {selectedYear} — 12 Aylık Kapsamlı Performans Grafiği
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {heroMode === 'pnl' &&
                'Aylık tahakkuk cirosu, toplam gider (COGS + OPEX), net kar ve net kar marjı eğrisi'}
              {heroMode === 'cumulative' &&
                'Yıl başından itibaren kümülatif gelir, gider ve net kar birikimi (YTD)'}
              {heroMode === 'accrual_vs_cash' &&
                'Tahakkuk eden P&L cirosu ile kesilen faturalar, kasa tahsilatları ve dönem sonu kasa bakiyesi karşılaştırması'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {heroMode === 'pnl' && (
              <button
                type="button"
                onClick={() => setShowMarginLine((v) => !v)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                  showMarginLine
                    ? 'border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                Net Marj % Eğrisi
              </button>
            )}

            <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#090E1A]">
              <button
                type="button"
                onClick={() => setHeroMode('pnl')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  heroMode === 'pnl'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                P&amp;L &amp; Marj
              </button>
              <button
                type="button"
                onClick={() => setHeroMode('cumulative')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  heroMode === 'cumulative'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Kümülatif (YTD)
              </button>
              <button
                type="button"
                onClick={() => setHeroMode('accrual_vs_cash')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  heroMode === 'accrual_vs_cash'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Tahakkuk vs. Nakit
              </button>
            </div>
          </div>
        </div>

        <div className="h-[340px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            {heroMode === 'pnl' ? (
              <ComposedChart data={heroChartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(148,163,184,0.14)"
                  vertical={false}
                />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12, fill: '#94A3B8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 11, fill: '#94A3B8' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={formatAxisK}
                />
                {showMarginLine && (
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 11, fill: '#F59E0B' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `%${v}`}
                  />
                )}
                <ReferenceLine yAxisId="left" y={0} stroke="rgba(148,163,184,0.3)" />
                <Tooltip content={<CustomProTooltip />} />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Bar
                  yAxisId="left"
                  dataKey="Gelir"
                  fill="#3B82F6"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={24}
                />
                <Bar
                  yAxisId="left"
                  dataKey="Gider"
                  fill="#64748B"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={24}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="Net Kar"
                  stroke="#10B981"
                  strokeWidth={2.5}
                  dot={{ r: 3.5, fill: '#10B981' }}
                  activeDot={{ r: 5 }}
                />
                {showMarginLine && (
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="Net Marj %"
                    stroke="#F59E0B"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={{ r: 3, fill: '#F59E0B' }}
                  />
                )}
              </ComposedChart>
            ) : heroMode === 'cumulative' ? (
              <AreaChart data={heroChartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradCumRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.32} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradCumNet" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(148,163,184,0.14)"
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
                  tickFormatter={formatAxisK}
                />
                <ReferenceLine y={0} stroke="rgba(148,163,184,0.3)" />
                <Tooltip content={<CustomProTooltip />} />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Area
                  type="monotone"
                  dataKey="Kümülatif Ciro"
                  stroke="#3B82F6"
                  strokeWidth={2.5}
                  fill="url(#gradCumRev)"
                />
                <Area
                  type="monotone"
                  dataKey="Kümülatif Gider"
                  stroke="#EF4444"
                  strokeWidth={2}
                  fillOpacity={0}
                />
                <Area
                  type="monotone"
                  dataKey="Kümülatif Net Kar"
                  stroke="#10B981"
                  strokeWidth={2.5}
                  fill="url(#gradCumNet)"
                />
              </AreaChart>
            ) : (
              <ComposedChart data={heroChartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(148,163,184,0.14)"
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
                  tickFormatter={formatAxisK}
                />
                <Tooltip content={<CustomProTooltip />} />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Bar
                  dataKey="P&L Ciro"
                  fill="#3B82F6"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={20}
                />
                <Bar
                  dataKey="Faturalanan"
                  fill="#8B5CF6"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={20}
                />
                <Bar
                  dataKey="Kasa Tahsilatı"
                  fill="#10B981"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={20}
                />
                <Line
                  type="monotone"
                  dataKey="Kasa Bakiyesi"
                  stroke="#06B6D4"
                  strokeWidth={2.5}
                  dot={{ r: 3.5, fill: '#06B6D4' }}
                />
              </ComposedChart>
            )}
          </ResponsiveContainer>
        </div>
      </section>

      {/* Chart Row 2: 12-Month Revenue Model Evolution + Expense Category Breakdown */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-7 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  12 Aylık Gelir Modeli Evrimi &amp; MRR Trendi
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Aylık MRR, ertelenmiş Yıllık MRR payı, tek seferlik hizmet ve donanım kırılımı
                </p>
              </div>
              <div className="text-right text-xs font-mono tabular-nums shrink-0">
                <span className="text-slate-500 dark:text-slate-400 block">MRR Yıl İçi Büyüme</span>
                <span
                  className={`font-bold ${
                    totals.mrrGrowthPct >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {totals.mrrGrowthPct >= 0 ? '+' : ''}
                  {formatPercent(totals.mrrGrowthPct)}
                </span>
              </div>
            </div>

            <div className="h-[290px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={revenueMixData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(148,163,184,0.14)"
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
                    tickFormatter={formatAxisK}
                  />
                  <Tooltip content={<CustomProTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                  <Bar dataKey="Aylık MRR" stackId="rev" fill="#3B82F6" maxBarSize={28} />
                  <Bar dataKey="Yıllık MRR (Pay)" stackId="rev" fill="#10B981" maxBarSize={28} />
                  <Bar dataKey="Tek Seferlik" stackId="rev" fill="#F59E0B" maxBarSize={28} />
                  <Bar
                    dataKey="Donanım"
                    stackId="rev"
                    fill="#8B5CF6"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                  />
                  <Line
                    type="monotone"
                    dataKey="Toplam MRR"
                    stroke="#38BDF8"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#38BDF8' }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-slate-500 dark:text-slate-400 block">Aylık MRR</span>
              <span className="font-mono tabular-nums font-semibold text-blue-500">
                {formatCurrency(totals.monthlyMrr)}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block">Yıllık MRR (Pay)</span>
              <span className="font-mono tabular-nums font-semibold text-emerald-500">
                {formatCurrency(totals.annualMrrRecognized)}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block">Tek Seferlik</span>
              <span className="font-mono tabular-nums font-semibold text-amber-500">
                {formatCurrency(totals.oneOff)}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block">Donanım Satışı</span>
              <span className="font-mono tabular-nums font-semibold text-violet-500">
                {formatCurrency(totals.hardware)}
              </span>
            </div>
          </div>
        </div>

        {/* Expense Categories Annual Donut & Table */}
        <div className="xl:col-span-5 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                {selectedYear} Yıllık Gider Dağılımı (8 Kategori)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                Tahakkuk: {formatCurrency(totals.totalExpenses)} · Ödenen:{' '}
                {formatCurrency(totals.totalPaidExpenses)}
              </p>
            </div>
          </div>

          {expensePieData.length === 0 ? (
            <div className="flex-1 min-h-[260px] flex items-center justify-center text-xs text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
              {selectedYear} yılı için gider kaydı bulunmuyor.
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-between">
              <div className="h-[190px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expensePieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={76}
                      paddingAngle={2}
                    >
                      {expensePieData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomProTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-2 divide-y divide-slate-100 dark:divide-slate-800/70 text-xs max-h-[168px] overflow-y-auto pr-1">
                {expensePieData.map((item) => (
                  <div key={item.name} className="py-2 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-slate-700 dark:text-slate-300 truncate">
                      <span
                        className="w-2.5 h-2.5 rounded-xs shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="truncate">{item.name}</span>
                    </span>
                    <div className="flex items-center gap-3 font-mono tabular-nums shrink-0">
                      <span className="text-slate-500 dark:text-slate-400">
                        {formatPercent(item.sharePct)}
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {formatCurrency(item.value)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Chart Row 3: 12-Month Cash Flow & Closing Balance + Quarterly Performance */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-7 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                12 Aylık Gerçekleşen Nakit Akışı &amp; Kasa Bakiyesi Eğrisi
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Yıl başı açılış kasası ({formatCurrency(totals.openingCashStartOfYear)}) üzerinden aylık nakit giriş/çıkış seyri
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums font-semibold text-cyan-600 dark:text-cyan-400 shrink-0">
              Yıl Sonu Kasa: {formatCurrency(totals.closingCashEndOfYear)}
            </span>
          </div>

          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={cashFlowChartData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(148,163,184,0.14)"
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
                  tickFormatter={formatAxisK}
                />
                <ReferenceLine y={0} stroke="rgba(148,163,184,0.3)" />
                <Tooltip content={<CustomProTooltip />} />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                <Bar
                  dataKey="Tahsilat (+)"
                  fill="#10B981"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={22}
                />
                <Bar
                  dataKey="Ödenen Gider (-)"
                  fill="#EF4444"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={22}
                />
                <Line
                  type="monotone"
                  dataKey="Dönem Sonu Kasa"
                  stroke="#06B6D4"
                  strokeWidth={2.5}
                  dot={{ r: 3.5, fill: '#06B6D4' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quarterly Q1-Q4 Summary */}
        <div className="xl:col-span-5 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Layers className="w-4 h-4 text-violet-500 shrink-0" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Çeyreklik Performans (Q1 – Q4)
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              3&apos;er aylık dönemlerde ciro, gider, net kar ve net nakit kıyaslaması
            </p>

            <div className="h-[155px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={quarterlyChartData}
                  margin={{ top: 5, right: 5, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(148,163,184,0.14)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="quarter"
                    tick={{ fontSize: 12, fill: '#94A3B8' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#94A3B8' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={formatAxisK}
                  />
                  <Tooltip content={<CustomProTooltip />} />
                  <Bar dataKey="Ciro" fill="#3B82F6" radius={[3, 3, 0, 0]} maxBarSize={20} />
                  <Bar dataKey="Gider" fill="#64748B" radius={[3, 3, 0, 0]} maxBarSize={20} />
                  <Bar dataKey="Net Kar" fill="#10B981" radius={[3, 3, 0, 0]} maxBarSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
                  <th className="py-2 pr-2">Dönem</th>
                  <th className="py-2 px-2 text-right">Ciro</th>
                  <th className="py-2 px-2 text-right">Net Kar</th>
                  <th className="py-2 px-2 text-right">Marj</th>
                  <th className="py-2 pl-2 text-right">Net Nakit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 font-mono tabular-nums">
                {quarters.map((q) => (
                  <tr key={q.quarter}>
                    <td className="py-2 pr-2 font-sans font-semibold text-slate-800 dark:text-slate-200">
                      {q.quarter}
                    </td>
                    <td className="py-2 px-2 text-right text-slate-700 dark:text-slate-300">
                      {formatCurrency(q.revenue)}
                    </td>
                    <td
                      className={`py-2 px-2 text-right font-semibold ${
                        q.netIncome >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {formatCurrency(q.netIncome)}
                    </td>
                    <td className="py-2 px-2 text-right text-slate-500 dark:text-slate-400">
                      {formatPercent(q.netMarginPct)}
                    </td>
                    <td
                      className={`py-2 pl-2 text-right ${
                        q.netCashChange >= 0
                          ? 'text-cyan-600 dark:text-cyan-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {formatCurrency(q.netCashChange)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Section 4: Customer Annual Performance Ranking */}
      <section className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              {selectedYear} Yılı Müşteri Bazlı Gelir &amp; Tahsilat Performansı
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Seçili yıl içinde tanınan P&amp;L geliri, kesilen fatura tutarı, tahsil edilen nakit ve
              açık alacak bakiyesi
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
            {customers.length} aktif müşteri
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-900/40">
                <th className="py-3 px-4">Müşteri</th>
                <th className="py-3 px-4 text-right">Fatura Adedi</th>
                <th className="py-3 px-4 text-right">Kesilen Fatura</th>
                <th className="py-3 px-4 text-right">P&amp;L Tanınan Gelir</th>
                <th className="py-3 px-4 text-right">Ciro Payı</th>
                <th className="py-3 px-4 text-right">Tahsil Edilen</th>
                <th className="py-3 px-4 text-right">Açık Alacak</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    {selectedYear} yılında müşteri bazlı fatura veya tahsilat kaydı bulunmuyor.
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr
                    key={c.customerId}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => onSelectCustomer(c.customerId)}
                        className="font-medium text-blue-600 dark:text-blue-400 hover:underline text-left"
                      >
                        {c.companyName}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                      {c.invoiceCount}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {formatCurrency(c.billedTry)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                      {formatCurrency(c.recognizedTry)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      {formatPercent(c.sharePct)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(c.collectedTry)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-amber-600 dark:text-amber-400">
                      {c.openReceivableTry > 1 ? formatCurrency(c.openReceivableTry) : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Section 5: Complete 12-Month Financial Matrix Table (Jan-Dec + Total) */}
      <section className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              {selectedYear} — 12 Aylık Tam Finansal Matris (Oca–Ara &amp; Yıl Toplamı)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              P&amp;L tahakkuk kalemleri, operasyonel gider detayları ve gerçekleşen nakit hareketleri
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#090E1A] self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => setMatrixMode('summary')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                matrixMode === 'summary'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Özet Görünüm
            </button>
            <button
              type="button"
              onClick={() => setMatrixMode('full')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                matrixMode === 'full'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Tam Detay (8 OPEX + Nakit)
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-900/40">
                <th className="py-3 px-4 sticky left-0 z-10 bg-slate-50 dark:bg-[#0F172A] min-w-[210px]">
                  Finansal Kalem
                </th>
                {months.map((m) => (
                  <th
                    key={m.monthKey}
                    className={`py-3 px-2.5 text-right whitespace-nowrap ${
                      m.monthKey === selectedMonth ? 'text-blue-600 dark:text-blue-400' : ''
                    }`}
                  >
                    {m.shortLabel}
                  </th>
                ))}
                <th className="py-3 px-4 text-right whitespace-nowrap sticky right-0 z-10 bg-slate-100 dark:bg-[#131D33] text-slate-900 dark:text-white">
                  {selectedYear} TOPLAM
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 font-mono tabular-nums">
              <tr>
                <td className="py-2.5 px-4 font-sans text-slate-700 dark:text-slate-300 sticky left-0 bg-white dark:bg-[#0F172A]">
                  (+) Aylık MRR
                </td>
                {months.map((m) => (
                  <td key={m.monthKey} className="py-2.5 px-2.5 text-right whitespace-nowrap">
                    {formatCurrency(m.pnl.monthlyMrr)}
                  </td>
                ))}
                <td className="py-2.5 px-4 text-right font-semibold sticky right-0 bg-slate-50 dark:bg-[#131D33] whitespace-nowrap">
                  {formatCurrency(totals.monthlyMrr)}
                </td>
              </tr>

              <tr>
                <td className="py-2.5 px-4 font-sans text-slate-700 dark:text-slate-300 sticky left-0 bg-white dark:bg-[#0F172A]">
                  (+) Yıllık MRR (Pay)
                </td>
                {months.map((m) => (
                  <td key={m.monthKey} className="py-2.5 px-2.5 text-right whitespace-nowrap">
                    {formatCurrency(m.pnl.annualMrrRecognized)}
                  </td>
                ))}
                <td className="py-2.5 px-4 text-right font-semibold sticky right-0 bg-slate-50 dark:bg-[#131D33] whitespace-nowrap">
                  {formatCurrency(totals.annualMrrRecognized)}
                </td>
              </tr>

              <tr>
                <td className="py-2.5 px-4 font-sans text-slate-700 dark:text-slate-300 sticky left-0 bg-white dark:bg-[#0F172A]">
                  (+) Tek Seferlik Hizmet
                </td>
                {months.map((m) => (
                  <td key={m.monthKey} className="py-2.5 px-2.5 text-right whitespace-nowrap">
                    {formatCurrency(m.pnl.oneOff)}
                  </td>
                ))}
                <td className="py-2.5 px-4 text-right font-semibold sticky right-0 bg-slate-50 dark:bg-[#131D33] whitespace-nowrap">
                  {formatCurrency(totals.oneOff)}
                </td>
              </tr>

              <tr>
                <td className="py-2.5 px-4 font-sans text-slate-700 dark:text-slate-300 sticky left-0 bg-white dark:bg-[#0F172A]">
                  (+) Donanım Satışı
                </td>
                {months.map((m) => (
                  <td key={m.monthKey} className="py-2.5 px-2.5 text-right whitespace-nowrap">
                    {formatCurrency(m.pnl.hardware)}
                  </td>
                ))}
                <td className="py-2.5 px-4 text-right font-semibold sticky right-0 bg-slate-50 dark:bg-[#131D33] whitespace-nowrap">
                  {formatCurrency(totals.hardware)}
                </td>
              </tr>

              <tr className="bg-blue-50/70 dark:bg-blue-950/25 font-bold text-slate-900 dark:text-white">
                <td className="py-3 px-4 font-sans sticky left-0 bg-blue-50 dark:bg-[#101C36]">
                  = TOPLAM CİRO (P&amp;L)
                </td>
                {months.map((m) => (
                  <td key={m.monthKey} className="py-3 px-2.5 text-right whitespace-nowrap">
                    {formatCurrency(m.pnl.totalRevenue)}
                  </td>
                ))}
                <td className="py-3 px-4 text-right sticky right-0 bg-blue-100/80 dark:bg-[#142343] whitespace-nowrap">
                  {formatCurrency(totals.totalRevenue)}
                </td>
              </tr>

              <tr>
                <td className="py-2.5 px-4 font-sans text-slate-700 dark:text-slate-300 sticky left-0 bg-white dark:bg-[#0F172A]">
                  (-) Donanım Maliyeti (COGS)
                </td>
                {months.map((m) => (
                  <td
                    key={m.monthKey}
                    className="py-2.5 px-2.5 text-right text-rose-600 dark:text-rose-400 whitespace-nowrap"
                  >
                    {m.pnl.cogs > 0 ? `-${formatCurrency(m.pnl.cogs)}` : '0 ₺'}
                  </td>
                ))}
                <td className="py-2.5 px-4 text-right font-semibold text-rose-600 dark:text-rose-400 sticky right-0 bg-slate-50 dark:bg-[#131D33] whitespace-nowrap">
                  {totals.cogs > 0 ? `-${formatCurrency(totals.cogs)}` : '0 ₺'}
                </td>
              </tr>

              <tr className="bg-slate-50 dark:bg-slate-800/40 font-semibold text-slate-900 dark:text-white">
                <td className="py-2.5 px-4 font-sans sticky left-0 bg-slate-50 dark:bg-slate-800/90">
                  = BRÜT KAR
                </td>
                {months.map((m) => (
                  <td key={m.monthKey} className="py-2.5 px-2.5 text-right whitespace-nowrap">
                    {formatCurrency(m.pnl.grossProfit)}
                  </td>
                ))}
                <td className="py-2.5 px-4 text-right sticky right-0 bg-slate-100 dark:bg-[#192338] whitespace-nowrap">
                  {formatCurrency(totals.grossProfit)}
                </td>
              </tr>

              {matrixMode === 'full' && (
                <Fragment>
                  {OPEX_CATEGORIES.map((cat) => (
                    <tr key={cat}>
                      <td className="py-2 px-4 pl-7 font-sans text-slate-500 dark:text-slate-400 sticky left-0 bg-white dark:bg-[#0F172A]">
                        (-) {EXPENSE_CATEGORY_LABELS[cat]}
                      </td>
                      {months.map((m) => {
                        const val = m.pnl.opexByCategory[cat];
                        return (
                          <td
                            key={m.monthKey}
                            className="py-2 px-2.5 text-right text-slate-600 dark:text-slate-400 whitespace-nowrap"
                          >
                            {val > 0 ? `-${formatCurrency(val)}` : '0 ₺'}
                          </td>
                        );
                      })}
                      <td className="py-2 px-4 text-right font-medium text-rose-600 dark:text-rose-400 sticky right-0 bg-slate-50 dark:bg-[#131D33] whitespace-nowrap">
                        {totals.opexByCategory[cat] > 0
                          ? `-${formatCurrency(totals.opexByCategory[cat])}`
                          : '0 ₺'}
                      </td>
                    </tr>
                  ))}
                </Fragment>
              )}

              <tr>
                <td className="py-2.5 px-4 font-sans text-slate-700 dark:text-slate-300 sticky left-0 bg-white dark:bg-[#0F172A]">
                  (-) Toplam OPEX
                </td>
                {months.map((m) => (
                  <td
                    key={m.monthKey}
                    className="py-2.5 px-2.5 text-right text-rose-600 dark:text-rose-400 whitespace-nowrap"
                  >
                    {m.pnl.totalOpex > 0 ? `-${formatCurrency(m.pnl.totalOpex)}` : '0 ₺'}
                  </td>
                ))}
                <td className="py-2.5 px-4 text-right font-semibold text-rose-600 dark:text-rose-400 sticky right-0 bg-slate-50 dark:bg-[#131D33] whitespace-nowrap">
                  {totals.totalOpex > 0 ? `-${formatCurrency(totals.totalOpex)}` : '0 ₺'}
                </td>
              </tr>

              <tr className="bg-emerald-50/60 dark:bg-emerald-950/20 font-bold">
                <td className="py-3 px-4 font-sans text-slate-900 dark:text-white sticky left-0 bg-emerald-50 dark:bg-[#0E2225]">
                  = NET KAR / ZARAR (P&amp;L)
                </td>
                {months.map((m) => (
                  <td
                    key={m.monthKey}
                    className={`py-3 px-2.5 text-right whitespace-nowrap ${
                      m.pnl.netIncome >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {formatCurrency(m.pnl.netIncome)}
                  </td>
                ))}
                <td
                  className={`py-3 px-4 text-right sticky right-0 bg-emerald-100/70 dark:bg-[#102A2E] whitespace-nowrap ${
                    totals.netIncome >= 0
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {formatCurrency(totals.netIncome)}
                </td>
              </tr>

              <tr>
                <td className="py-2 px-4 font-sans text-slate-500 dark:text-slate-400 sticky left-0 bg-white dark:bg-[#0F172A]">
                  Net Kar Marjı (%)
                </td>
                {months.map((m) => (
                  <td
                    key={m.monthKey}
                    className="py-2 px-2.5 text-right text-slate-500 dark:text-slate-400 whitespace-nowrap"
                  >
                    {m.pnl.totalRevenue > 0 ? formatPercent(m.pnl.netMarginPct) : '—'}
                  </td>
                ))}
                <td className="py-2 px-4 text-right font-semibold text-slate-700 dark:text-slate-200 sticky right-0 bg-slate-50 dark:bg-[#131D33] whitespace-nowrap">
                  {totals.totalRevenue > 0 ? formatPercent(totals.netMarginPct) : '—'}
                </td>
              </tr>

              {/* Cash Flow Rows */}
              <tr>
                <td className="py-2.5 px-4 font-sans text-slate-700 dark:text-slate-300 sticky left-0 bg-white dark:bg-[#0F172A]">
                  (+) Kasa Tahsilatları (Nakit Girişi)
                </td>
                {months.map((m) => (
                  <td
                    key={m.monthKey}
                    className="py-2.5 px-2.5 text-right text-emerald-600 dark:text-emerald-400 whitespace-nowrap"
                  >
                    {formatCurrency(m.cashFlow.totalCollectionsTry)}
                  </td>
                ))}
                <td className="py-2.5 px-4 text-right font-semibold text-emerald-600 dark:text-emerald-400 sticky right-0 bg-slate-50 dark:bg-[#131D33] whitespace-nowrap">
                  {formatCurrency(totals.totalCollections)}
                </td>
              </tr>

              {matrixMode === 'full' && (
                <tr>
                  <td className="py-2.5 px-4 font-sans text-slate-700 dark:text-slate-300 sticky left-0 bg-white dark:bg-[#0F172A]">
                    (-) Ödenen Giderler (Nakit Çıkışı)
                  </td>
                  {months.map((m) => (
                    <td
                      key={m.monthKey}
                      className="py-2.5 px-2.5 text-right text-rose-600 dark:text-rose-400 whitespace-nowrap"
                    >
                      {m.cashFlow.totalPaidExpensesTry > 0
                        ? `-${formatCurrency(m.cashFlow.totalPaidExpensesTry)}`
                        : '0 ₺'}
                    </td>
                  ))}
                  <td className="py-2.5 px-4 text-right font-semibold text-rose-600 dark:text-rose-400 sticky right-0 bg-slate-50 dark:bg-[#131D33] whitespace-nowrap">
                    {totals.totalPaidExpenses > 0
                      ? `-${formatCurrency(totals.totalPaidExpenses)}`
                      : '0 ₺'}
                  </td>
                </tr>
              )}

              <tr className="bg-cyan-50/50 dark:bg-cyan-950/15 font-semibold">
                <td className="py-2.5 px-4 font-sans text-slate-900 dark:text-white sticky left-0 bg-cyan-50/90 dark:bg-[#0D1E2E]">
                  = Dönem Sonu Kasa Bakiyesi
                </td>
                {months.map((m) => (
                  <td
                    key={m.monthKey}
                    className="py-2.5 px-2.5 text-right text-cyan-700 dark:text-cyan-400 whitespace-nowrap"
                  >
                    {formatCurrency(m.cashFlow.closingCashTry)}
                  </td>
                ))}
                <td className="py-2.5 px-4 text-right text-cyan-700 dark:text-cyan-300 sticky right-0 bg-cyan-100/70 dark:bg-[#10263A] whitespace-nowrap">
                  {formatCurrency(totals.closingCashEndOfYear)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
