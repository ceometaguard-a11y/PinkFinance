import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Download } from 'lucide-react';
import { CustomerBreakdownItem, Expense, PinkFinanceDatabase } from '../types/finance';
import {
  addMonths,
  EXPENSE_CATEGORY_LABELS,
  exportToCSV,
  formatCurrency,
  formatMonthTR,
  formatPercent,
  OPEX_CATEGORIES,
} from '../utils/formatters';
import { computeMonthlyPnL } from '../utils/financeEngine';

interface PnLPageProps {
  db: PinkFinanceDatabase;
  selectedMonth: string;
  onSelectCustomer: (customerId: string) => void;
}

export function PnLPage({ db, selectedMonth, onSelectCustomer }: PnLPageProps) {
  const [viewMode, setViewMode] = useState<'single' | '12month'>('single');
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({
    monthlyMrr: true,
    annualMrr: true,
  });

  const toggleRow = (key: string) => {
    setExpandedRows((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const singlePnl = useMemo(
    () => computeMonthlyPnL(db, selectedMonth),
    [db, selectedMonth]
  );

  // 12-Month comparative window ending at 2027-05 or starting 2026-06 (covering June 2026 - May 2027 so user sees future deferred revenue too!)
  const twelveMonths = useMemo(() => {
    return Array.from({ length: 12 }, (_, idx) => addMonths('2026-06', idx));
  }, []);

  const twelveMonthStatements = useMemo(
    () => twelveMonths.map((m) => computeMonthlyPnL(db, m)),
    [db, twelveMonths]
  );

  const handleExportSingle = () => {
    exportToCSV(
      `PinkFinance_PnL_${selectedMonth}`,
      ['Kalem', 'Tutar (TRY)', 'Oran / Marj'],
      [
        ['(+) Aylık MRR Gelirleri', Math.round(singlePnl.monthlyMrr), ''],
        ['(+) Yıllık MRR (Aylık Payı)', Math.round(singlePnl.annualMrrRecognized), ''],
        ['(+) Tek Seferlik Hizmet Gelirleri', Math.round(singlePnl.oneOff), ''],
        ['(+) Donanım Satış Gelirleri', Math.round(singlePnl.hardware), ''],
        ['= TOPLAM GELİR (Ciro)', Math.round(singlePnl.totalRevenue), '%100,0'],
        ['(-) Donanım Maliyeti (COGS)', -Math.round(singlePnl.cogs), ''],
        [
          '= BRÜT KAR',
          Math.round(singlePnl.grossProfit),
          formatPercent(singlePnl.grossMarginPct),
        ],
        ...OPEX_CATEGORIES.map((cat) => [
          `(-) ${EXPENSE_CATEGORY_LABELS[cat]}`,
          -Math.round(singlePnl.opexByCategory[cat]),
          '',
        ]),
        ['= TOPLAM OPERASYONEL GİDER (OPEX)', -Math.round(singlePnl.totalOpex), ''],
        [
          '= NET KAR / ZARAR (EBITDA)',
          Math.round(singlePnl.netIncome),
          formatPercent(singlePnl.netMarginPct),
        ],
      ]
    );
  };

  const handleExport12Month = () => {
    const headers = ['P&L Kalemi', ...twelveMonths.map((m) => formatMonthTR(m, true))];
    const rows: (string | number)[][] = [
      ['(+) Aylık MRR Gelirleri', ...twelveMonthStatements.map((s) => Math.round(s.monthlyMrr))],
      [
        '(+) Yıllık MRR (Aylık Pay)',
        ...twelveMonthStatements.map((s) => Math.round(s.annualMrrRecognized)),
      ],
      ['(+) Tek Seferlik Hizmetler', ...twelveMonthStatements.map((s) => Math.round(s.oneOff))],
      ['(+) Donanım Satışları', ...twelveMonthStatements.map((s) => Math.round(s.hardware))],
      ['= TOPLAM GELİR', ...twelveMonthStatements.map((s) => Math.round(s.totalRevenue))],
      ['(-) Donanım Maliyeti (COGS)', ...twelveMonthStatements.map((s) => -Math.round(s.cogs))],
      ['= BRÜT KAR', ...twelveMonthStatements.map((s) => Math.round(s.grossProfit))],
      ...OPEX_CATEGORIES.map((cat) => [
        `(-) ${EXPENSE_CATEGORY_LABELS[cat]}`,
        ...twelveMonthStatements.map((s) => -Math.round(s.opexByCategory[cat])),
      ]),
      ['= TOPLAM OPEX', ...twelveMonthStatements.map((s) => -Math.round(s.totalOpex))],
      ['= NET KAR / ZARAR', ...twelveMonthStatements.map((s) => Math.round(s.netIncome))],
    ];
    exportToCSV('PinkFinance_12_Aylik_Karsilastirmali_PnL', headers, rows);
  };

  const renderCustomerBreakdown = (items: CustomerBreakdownItem[]) => {
    if (items.length === 0) {
      return (
        <tr className="bg-slate-50/50 dark:bg-[#090E1A]/60">
          <td colSpan={3} className="py-2 pl-12 pr-4 text-xs text-slate-400">
            Bu dönemde kayıtlı müşteri geliri yok.
          </td>
        </tr>
      );
    }
    return items.map((item) => (
      <tr
        key={item.customerId}
        className="bg-slate-50/60 dark:bg-[#090E1A]/60 hover:bg-slate-100/70 dark:hover:bg-slate-800/40 text-xs"
      >
        <td className="py-2 pl-12 pr-4">
          <button
            type="button"
            onClick={() => onSelectCustomer(item.customerId)}
            className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
          >
            {item.customerName}
          </button>
          {item.detailLabel && (
            <span className="ml-2 text-[11px] text-slate-500 dark:text-slate-400">
              · {item.detailLabel}
            </span>
          )}
        </td>
        <td
          className={`py-2 px-4 text-right font-mono tabular-nums ${
            item.amountTry < 0
              ? 'text-rose-600 dark:text-rose-400'
              : 'text-slate-700 dark:text-slate-300'
          }`}
        >
          {formatCurrency(item.amountTry)}
        </td>
        <td className="py-2 px-4 text-right font-mono tabular-nums text-slate-500 dark:text-slate-400">
          {singlePnl.totalRevenue > 0
            ? formatPercent((item.amountTry / singlePnl.totalRevenue) * 100)
            : '—'}
        </td>
      </tr>
    ));
  };

  const renderExpenseBreakdown = (items: Expense[]) => {
    if (items.length === 0) {
      return (
        <tr className="bg-slate-50/50 dark:bg-[#090E1A]/60">
          <td colSpan={3} className="py-2 pl-12 pr-4 text-xs text-slate-400">
            Bu kategoride gider kaydı yok.
          </td>
        </tr>
      );
    }
    return items.map((exp) => (
      <tr
        key={exp.id}
        className="bg-slate-50/60 dark:bg-[#090E1A]/60 text-xs text-slate-600 dark:text-slate-300"
      >
        <td className="py-2 pl-12 pr-4">
          <span>{exp.title}</span>
          <span className="ml-2 text-[11px] text-slate-500">
            · {exp.vendor}
            {exp.currency !== 'TRY'
              ? ` (${formatCurrency(exp.amount, exp.currency)} @ ${exp.fxRate.toFixed(2)})`
              : ''}
          </span>
        </td>
        <td className="py-2 px-4 text-right font-mono tabular-nums text-rose-600 dark:text-rose-400">
          -{formatCurrency(exp.amountTry)}
        </td>
        <td className="py-2 px-4 text-right text-[11px] text-slate-500">
          {exp.status === 'paid' ? 'Ödendi' : 'Ödenecek'}
        </td>
      </tr>
    ));
  };

  return (
    <div className="space-y-5">
      {/* Header Controls */}
      <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#090E1A]">
          <button
            type="button"
            onClick={() => setViewMode('single')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
              viewMode === 'single'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {formatMonthTR(selectedMonth)} Detaylı P&L
          </button>
          <button
            type="button"
            onClick={() => setViewMode('12month')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
              viewMode === '12month'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            12 Aylık Karşılaştırmalı P&L
          </button>
        </div>

        <button
          type="button"
          onClick={viewMode === 'single' ? handleExportSingle : handleExport12Month}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          <span>P&L Tablosunu İndir (Excel / CSV)</span>
        </button>
      </div>

      {viewMode === 'single' ? (
        <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                {formatMonthTR(selectedMonth)} Gelir Tablosu (Kar / Zarar — P&L)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Müşteri veya gider kalem detaylarını görmek için satırlara tıklayın
              </p>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                Net Kar Marjı
              </span>
              <span
                className={`text-sm font-bold font-mono tabular-nums ${
                  singlePnl.netIncome >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {formatPercent(singlePnl.netMarginPct)}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-900/40">
                  <th className="py-3 px-4">P&amp;L Kalemi</th>
                  <th className="py-3 px-4 text-right">Tutar (TRY)</th>
                  <th className="py-3 px-4 text-right">Ciro Payı / Marj</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-sm">
                {/* 1. Aylık MRR */}
                <tr
                  onClick={() => toggleRow('monthlyMrr')}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/30 cursor-pointer"
                >
                  <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    {expandedRows.monthlyMrr ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                    <span>(+) Aylık MRR Gelirleri</span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-slate-900 dark:text-white">
                    {formatCurrency(singlePnl.monthlyMrr)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-500">
                    {singlePnl.totalRevenue > 0
                      ? formatPercent((singlePnl.monthlyMrr / singlePnl.totalRevenue) * 100)
                      : '—'}
                  </td>
                </tr>
                {expandedRows.monthlyMrr && renderCustomerBreakdown(singlePnl.monthlyMrrBreakdown)}

                {/* 2. Yıllık MRR Aylık Payı */}
                <tr
                  onClick={() => toggleRow('annualMrr')}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/30 cursor-pointer"
                >
                  <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    {expandedRows.annualMrr ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                    <span>(+) Yıllık MRR (Ertelenmiş Gelir Aylık Payı)</span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-slate-900 dark:text-white">
                    {formatCurrency(singlePnl.annualMrrRecognized)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-500">
                    {singlePnl.totalRevenue > 0
                      ? formatPercent(
                          (singlePnl.annualMrrRecognized / singlePnl.totalRevenue) * 100
                        )
                      : '—'}
                  </td>
                </tr>
                {expandedRows.annualMrr && renderCustomerBreakdown(singlePnl.annualMrrBreakdown)}

                {/* 3. Tek Seferlik Hizmetler */}
                <tr
                  onClick={() => toggleRow('oneOff')}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/30 cursor-pointer"
                >
                  <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    {expandedRows.oneOff ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                    <span>(+) Tek Seferlik Hizmet Gelirleri</span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-slate-900 dark:text-white">
                    {formatCurrency(singlePnl.oneOff)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-500">
                    {singlePnl.totalRevenue > 0
                      ? formatPercent((singlePnl.oneOff / singlePnl.totalRevenue) * 100)
                      : '—'}
                  </td>
                </tr>
                {expandedRows.oneOff && renderCustomerBreakdown(singlePnl.oneOffBreakdown)}

                {/* 4. Donanım Satışları */}
                <tr
                  onClick={() => toggleRow('hardware')}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/30 cursor-pointer"
                >
                  <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    {expandedRows.hardware ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                    <span>(+) Donanım Satış Gelirleri</span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-slate-900 dark:text-white">
                    {formatCurrency(singlePnl.hardware)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-500">
                    {singlePnl.totalRevenue > 0
                      ? formatPercent((singlePnl.hardware / singlePnl.totalRevenue) * 100)
                      : '—'}
                  </td>
                </tr>
                {expandedRows.hardware && renderCustomerBreakdown(singlePnl.hardwareBreakdown)}

                {/* TOPLAM GELİR */}
                <tr className="bg-blue-50/70 dark:bg-blue-950/25 font-bold text-slate-900 dark:text-white">
                  <td className="py-3.5 px-4">= TOPLAM GELİR (Ciro)</td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                    {formatCurrency(singlePnl.totalRevenue)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs">
                    %100,0
                  </td>
                </tr>

                {/* COGS */}
                <tr
                  onClick={() => toggleRow('cogs')}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/30 cursor-pointer"
                >
                  <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    {expandedRows.cogs ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                    <span>(-) Donanım Maliyeti (COGS)</span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-rose-600 dark:text-rose-400">
                    -{formatCurrency(singlePnl.cogs)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-500">
                    {singlePnl.totalRevenue > 0
                      ? formatPercent((singlePnl.cogs / singlePnl.totalRevenue) * 100)
                      : '—'}
                  </td>
                </tr>
                {expandedRows.cogs && renderExpenseBreakdown(singlePnl.cogsItems)}

                {/* BRÜT KAR */}
                <tr className="bg-slate-100/80 dark:bg-slate-800/50 font-bold text-slate-900 dark:text-white">
                  <td className="py-3.5 px-4">= BRÜT KAR (Gross Profit)</td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                    {formatCurrency(singlePnl.grossProfit)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs text-emerald-600 dark:text-emerald-400">
                    Brüt Marj: {formatPercent(singlePnl.grossMarginPct)}
                  </td>
                </tr>

                {/* OPEX Categories */}
                {OPEX_CATEGORIES.map((cat) => {
                  const amount = singlePnl.opexByCategory[cat];
                  const isOpen = !!expandedRows[cat];
                  return (
                    <Fragment key={cat}>
                      <tr
                        onClick={() => toggleRow(cat)}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/30 cursor-pointer"
                      >
                        <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          {isOpen ? (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-400" />
                          )}
                          <span>(-) {EXPENSE_CATEGORY_LABELS[cat]}</span>
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums text-rose-600 dark:text-rose-400">
                          {amount > 0 ? `-${formatCurrency(amount)}` : '0 ₺'}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums text-xs text-slate-500">
                          {singlePnl.totalRevenue > 0
                            ? formatPercent((amount / singlePnl.totalRevenue) * 100)
                            : '—'}
                        </td>
                      </tr>
                      {isOpen && renderExpenseBreakdown(singlePnl.opexItemsByCategory[cat])}
                    </Fragment>
                  );
                })}

                {/* TOPLAM OPEX */}
                <tr className="bg-slate-100/80 dark:bg-slate-800/50 font-semibold text-slate-900 dark:text-white">
                  <td className="py-3 px-4">= TOPLAM OPERASYONEL GİDER (OPEX)</td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-rose-600 dark:text-rose-400">
                    -{formatCurrency(singlePnl.totalOpex)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-xs">
                    {singlePnl.totalRevenue > 0
                      ? formatPercent((singlePnl.totalOpex / singlePnl.totalRevenue) * 100)
                      : '—'}
                  </td>
                </tr>

                {/* NET KAR / ZARAR */}
                <tr
                  className={`font-bold text-base ${
                    singlePnl.netIncome >= 0
                      ? 'bg-emerald-50/80 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300'
                      : 'bg-rose-50/80 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300'
                  }`}
                >
                  <td className="py-4 px-4">= NET KAR / ZARAR (EBITDA)</td>
                  <td className="py-4 px-4 text-right font-mono tabular-nums">
                    {singlePnl.netIncome >= 0 ? '+' : ''}
                    {formatCurrency(singlePnl.netIncome)}
                  </td>
                  <td className="py-4 px-4 text-right font-mono tabular-nums text-xs">
                    Net Marj: {formatPercent(singlePnl.netMarginPct)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* 12-Month Comparative P&L */
        <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              12 Aylık Karşılaştırmalı P&amp;L Projeksiyon ve Gerçekleşme Tablosu
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Yıllık MRR sözleşmelerinin gelecek aylara yayılan ertelenmiş gelir etkisini içerir
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-900/40">
                  <th className="py-3 px-4 sticky left-0 bg-slate-50 dark:bg-[#0F172A] min-w-[220px]">
                    P&amp;L Kalemi
                  </th>
                  {twelveMonths.map((m) => (
                    <th
                      key={m}
                      className={`py-3 px-3 text-right whitespace-nowrap ${
                        m === selectedMonth ? 'text-blue-600 dark:text-blue-400' : ''
                      }`}
                    >
                      {formatMonthTR(m, true)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 font-mono tabular-nums">
                <tr>
                  <td className="py-2.5 px-4 font-sans font-medium text-slate-700 dark:text-slate-300 sticky left-0 bg-white dark:bg-[#0F172A]">
                    (+) Aylık MRR
                  </td>
                  {twelveMonthStatements.map((s) => (
                    <td key={s.monthKey} className="py-2.5 px-3 text-right whitespace-nowrap">
                      {formatCurrency(s.monthlyMrr)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-sans font-medium text-slate-700 dark:text-slate-300 sticky left-0 bg-white dark:bg-[#0F172A]">
                    (+) Yıllık MRR (Pay)
                  </td>
                  {twelveMonthStatements.map((s) => (
                    <td key={s.monthKey} className="py-2.5 px-3 text-right whitespace-nowrap">
                      {formatCurrency(s.annualMrrRecognized)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-sans font-medium text-slate-700 dark:text-slate-300 sticky left-0 bg-white dark:bg-[#0F172A]">
                    (+) Tek Seferlik
                  </td>
                  {twelveMonthStatements.map((s) => (
                    <td key={s.monthKey} className="py-2.5 px-3 text-right whitespace-nowrap">
                      {formatCurrency(s.oneOff)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-sans font-medium text-slate-700 dark:text-slate-300 sticky left-0 bg-white dark:bg-[#0F172A]">
                    (+) Donanım Satışı
                  </td>
                  {twelveMonthStatements.map((s) => (
                    <td key={s.monthKey} className="py-2.5 px-3 text-right whitespace-nowrap">
                      {formatCurrency(s.hardware)}
                    </td>
                  ))}
                </tr>
                <tr className="bg-blue-50/70 dark:bg-blue-950/25 font-bold text-slate-900 dark:text-white">
                  <td className="py-3 px-4 font-sans sticky left-0 bg-blue-50 dark:bg-[#101C36]">
                    = TOPLAM GELİR
                  </td>
                  {twelveMonthStatements.map((s) => (
                    <td key={s.monthKey} className="py-3 px-3 text-right whitespace-nowrap">
                      {formatCurrency(s.totalRevenue)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-sans text-slate-700 dark:text-slate-300 sticky left-0 bg-white dark:bg-[#0F172A]">
                    (-) COGS
                  </td>
                  {twelveMonthStatements.map((s) => (
                    <td
                      key={s.monthKey}
                      className="py-2.5 px-3 text-right text-rose-600 dark:text-rose-400 whitespace-nowrap"
                    >
                      -{formatCurrency(s.cogs)}
                    </td>
                  ))}
                </tr>
                <tr className="bg-slate-50 dark:bg-slate-800/40 font-semibold text-slate-900 dark:text-white">
                  <td className="py-2.5 px-4 font-sans sticky left-0 bg-slate-50 dark:bg-slate-800/80">
                    = BRÜT KAR
                  </td>
                  {twelveMonthStatements.map((s) => (
                    <td key={s.monthKey} className="py-2.5 px-3 text-right whitespace-nowrap">
                      {formatCurrency(s.grossProfit)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-sans text-slate-700 dark:text-slate-300 sticky left-0 bg-white dark:bg-[#0F172A]">
                    (-) Toplam OPEX
                  </td>
                  {twelveMonthStatements.map((s) => (
                    <td
                      key={s.monthKey}
                      className="py-2.5 px-3 text-right text-rose-600 dark:text-rose-400 whitespace-nowrap"
                    >
                      -{formatCurrency(s.totalOpex)}
                    </td>
                  ))}
                </tr>
                <tr className="bg-emerald-50/60 dark:bg-emerald-950/20 font-bold">
                  <td className="py-3 px-4 font-sans text-slate-900 dark:text-white sticky left-0 bg-emerald-50 dark:bg-[#0E2225]">
                    = NET KAR / ZARAR
                  </td>
                  {twelveMonthStatements.map((s) => (
                    <td
                      key={s.monthKey}
                      className={`py-3 px-3 text-right whitespace-nowrap ${
                        s.netIncome >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {formatCurrency(s.netIncome)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

import { Fragment } from 'react';
