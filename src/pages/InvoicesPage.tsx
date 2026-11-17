import { useMemo, useState } from 'react';
import { Download, Plus, RotateCcw, Search, Trash2 } from 'lucide-react';
import { EnrichedInvoice, InvoiceStatus, InvoiceType, RevenueModel } from '../types/finance';
import {
  exportToCSV,
  formatCurrency,
  formatDateTR,
  INVOICE_STATUS_LABELS,
  INVOICE_TYPE_LABELS,
  REFUND_SETTLEMENT_LABELS,
  REVENUE_MODEL_LABELS,
} from '../utils/formatters';
import { InvoiceStatusLabel } from '../components/StatusLabel';

interface InvoicesPageProps {
  enrichedInvoices: EnrichedInvoice[];
  onOpenNewInvoice: () => void;
  onOpenRefundModal: (salesInvoice?: EnrichedInvoice) => void;
  onOpenPaymentModal: (invoiceId: string) => void;
  onToggleDraft: (invoiceId: string, isDraft: boolean) => void;
  onDeleteInvoice: (invoiceId: string) => void;
  onSelectCustomer: (customerId: string) => void;
}

export function InvoicesPage({
  enrichedInvoices,
  onOpenNewInvoice,
  onOpenRefundModal,
  onOpenPaymentModal,
  onToggleDraft,
  onDeleteInvoice,
  onSelectCustomer,
}: InvoicesPageProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | InvoiceStatus>('all');
  const [modelFilter, setModelFilter] = useState<'all' | RevenueModel>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | InvoiceType>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enrichedInvoices
      .filter((inv) => {
        const invType: InvoiceType = inv.invoiceType === 'refund' ? 'refund' : 'sales';
        if (typeFilter !== 'all' && invType !== typeFilter) return false;
        if (statusFilter !== 'all' && inv.computedStatus !== statusFilter) return false;
        if (modelFilter !== 'all' && inv.revenueModel !== modelFilter) return false;
        if (
          q &&
          !inv.customerName.toLowerCase().includes(q) &&
          !inv.invoiceNo.toLowerCase().includes(q) &&
          !inv.title.toLowerCase().includes(q) &&
          !(inv.refundedFromInvoiceNo || '').toLowerCase().includes(q)
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => b.issueDate.localeCompare(a.issueDate));
  }, [enrichedInvoices, search, statusFilter, modelFilter, typeFilter]);

  const activeInvoices = enrichedInvoices.filter((i) => !i.isDraft);
  const salesInvoices = activeInvoices.filter((i) => i.invoiceType !== 'refund');
  const refundInvoices = activeInvoices.filter((i) => i.invoiceType === 'refund');

  const totalRefundsBilled = refundInvoices.reduce((s, i) => s + i.amountTry, 0);
  const totalRefundsPaidOut = refundInvoices.reduce((s, i) => s + i.paidTry, 0);
  const totalPendingRefunds = refundInvoices.reduce((s, i) => s + i.remainingTry, 0);

  const totalBilled = salesInvoices.reduce((s, i) => s + i.amountTry, 0) - totalRefundsBilled;
  const totalCollected = salesInvoices.reduce((s, i) => s + i.paidTry, 0) - totalRefundsPaidOut;
  const totalOpen = salesInvoices.reduce((s, i) => s + i.remainingTry, 0);
  const totalOverdue = salesInvoices
    .filter((i) => i.computedStatus === 'overdue')
    .reduce((s, i) => s + i.remainingTry, 0);

  const handleExport = () => {
    exportToCSV(
      'PinkFinance_Faturalar_ve_Tahsilatlar',
      [
        'Fatura No',
        'Fatura Tipi',
        'Referans Fatura',
        'Müşteri',
        'Gelir Modeli',
        'Açıklama',
        'Fatura Tarihi',
        'Vade Tarihi',
        'Para Birimi',
        'Fatura Tutarı (TRY)',
        'Ödenen / Çıkılan (TRY)',
        'Kalan Bakiye (TRY)',
        'Durum',
      ],
      filtered.map((i) => {
        const isRefund = i.invoiceType === 'refund';
        const sign = isRefund ? -1 : 1;
        return [
          i.invoiceNo,
          INVOICE_TYPE_LABELS[isRefund ? 'refund' : 'sales'],
          i.refundedFromInvoiceNo || '-',
          i.customerName,
          REVENUE_MODEL_LABELS[i.revenueModel],
          i.title,
          formatDateTR(i.issueDate),
          formatDateTR(i.dueDate),
          i.currency,
          Math.round(i.amountTry * sign),
          Math.round(i.paidTry * sign),
          Math.round(i.remainingTry * sign),
          INVOICE_STATUS_LABELS[i.computedStatus],
        ];
      })
    );
  };

  const statusTabs: { id: 'all' | InvoiceStatus; label: string }[] = [
    { id: 'all', label: 'Tümü' },
    { id: 'overdue', label: 'Gecikmiş' },
    { id: 'issued', label: 'Bekliyor' },
    { id: 'partial', label: 'Kısmi' },
    { id: 'paid', label: 'Kapandı / Ödendi' },
    { id: 'draft', label: 'Taslak' },
  ];

  return (
    <div className="space-y-5">
      {/* Top KPI Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-500 dark:text-slate-400">Net Kesilen Fatura</span>
          <div className="mt-1 text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {formatCurrency(totalBilled)}
          </div>
          {totalRefundsBilled > 0 && (
            <div className="mt-0.5 text-[11px] font-mono tabular-nums text-rose-500 dark:text-rose-400">
              İade Düşülen: -{formatCurrency(totalRefundsBilled)}
            </div>
          )}
        </div>
        <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-500 dark:text-slate-400">Net Tahsilat</span>
          <div className="mt-1 text-lg font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
            {formatCurrency(totalCollected)}
          </div>
          {totalRefundsPaidOut > 0 && (
            <div className="mt-0.5 text-[11px] font-mono tabular-nums text-rose-500 dark:text-rose-400">
              Banka İadesi: -{formatCurrency(totalRefundsPaidOut)}
            </div>
          )}
        </div>
        <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-500 dark:text-slate-400">Açık Alacak</span>
          <div className="mt-1 text-lg font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400">
            {formatCurrency(totalOpen)}
          </div>
          {totalPendingRefunds > 0 && (
            <div className="mt-0.5 text-[11px] font-mono tabular-nums text-rose-500 dark:text-rose-400">
              Ödenecek İade: -{formatCurrency(totalPendingRefunds)}
            </div>
          )}
        </div>
        <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-500 dark:text-slate-400">Vadesi Geçmiş Alacak</span>
          <div className="mt-1 text-lg font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400">
            {formatCurrency(totalOverdue)}
          </div>
        </div>
      </div>

      {/* Filter & Actions Bar */}
      <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#090E1A]">
            {statusTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  statusFilter === tab.id
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
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
              onClick={() => onOpenRefundModal()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 transition-colors whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>İade Faturası Kes</span>
            </button>
            <button
              type="button"
              onClick={onOpenNewInvoice}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Yeni Fatura</span>
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
              placeholder="Fatura no, referans fatura, müşteri adı veya kalem başlığı ara..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-[#090E1A] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as 'all' | InvoiceType)}
            className="px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-[#090E1A] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
          >
            <option value="all">Tüm Fatura Tipleri</option>
            <option value="sales">Satış Faturaları</option>
            <option value="refund">İade Faturaları</option>
          </select>
          <select
            value={modelFilter}
            onChange={(e) => setModelFilter(e.target.value as 'all' | RevenueModel)}
            className="px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-[#090E1A] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
          >
            <option value="all">Tüm Gelir Modelleri</option>
            {Object.entries(REVENUE_MODEL_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-900/40">
                <th className="py-3 px-4">Fatura &amp; Kalem</th>
                <th className="py-3 px-4">Müşteri</th>
                <th className="py-3 px-4">Gelir Modeli</th>
                <th className="py-3 px-4">Fatura / Vade</th>
                <th className="py-3 px-4 text-right">Fatura Tutarı</th>
                <th className="py-3 px-4 text-right">Kalan Bakiye</th>
                <th className="py-3 px-4">Durum</th>
                <th className="py-3 px-4 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-xs">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 dark:text-slate-400">
                    Filtrelere uygun fatura kaydı bulunamadı.
                  </td>
                </tr>
              ) : (
                filtered.map((inv) => {
                  const isRefund = inv.invoiceType === 'refund';
                  return (
                    <tr
                      key={inv.id}
                      className={`transition-colors ${
                        isRefund
                          ? 'bg-rose-500/[0.03] hover:bg-rose-500/[0.07]'
                          : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/30'
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          <span>{inv.invoiceNo}</span>
                          {isRefund && (
                            <span className="px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-600 dark:text-rose-400 font-sans font-semibold text-[10px]">
                              İADE
                            </span>
                          )}
                        </div>
                        <div className="font-medium text-slate-900 dark:text-slate-100 max-w-xs truncate">
                          {inv.title}
                        </div>
                        {isRefund && inv.refundedFromInvoiceNo && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            Ref: <span className="font-mono">{inv.refundedFromInvoiceNo}</span>
                            {inv.refundSettlementMode
                              ? ` · ${REFUND_SETTLEMENT_LABELS[inv.refundSettlementMode]}`
                              : ''}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => onSelectCustomer(inv.customerId)}
                          className="font-medium text-blue-600 dark:text-blue-400 hover:underline text-left"
                        >
                          {inv.customerName}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        <div>{REVENUE_MODEL_LABELS[inv.revenueModel]}</div>
                        {inv.revenueModel === 'annual_mrr' && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                            {isRefund ? '-' : ''}
                            {formatCurrency(inv.amountTry / inv.recognitionMonths)}/ay ×{' '}
                            {inv.recognitionMonths} ay
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-mono tabular-nums text-slate-600 dark:text-slate-300">
                        <div>{formatDateTR(inv.issueDate)}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          Vade: {formatDateTR(inv.dueDate)}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                        <div
                          className={`font-semibold ${
                            isRefund
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-slate-900 dark:text-white'
                          }`}
                        >
                          {isRefund ? '-' : ''}
                          {formatCurrency(inv.amountTry)}
                        </div>
                        {inv.currency !== 'TRY' && (
                          <div className="text-[11px] text-slate-500">
                            {isRefund ? '-' : ''}
                            {formatCurrency(inv.amount, inv.currency)}
                          </div>
                        )}
                        {!isRefund && inv.refundedTotalTry > 0 && (
                          <div className="text-[11px] text-rose-500 dark:text-rose-400">
                            İade: -{formatCurrency(inv.refundedTotalTry)}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                        <span
                          className={
                            inv.remainingTry > 0
                              ? inv.computedStatus === 'overdue'
                                ? 'font-semibold text-rose-600 dark:text-rose-400'
                                : 'font-semibold text-amber-600 dark:text-amber-400'
                              : 'text-slate-400'
                          }
                        >
                          {isRefund && inv.remainingTry > 0 ? '-' : ''}
                          {formatCurrency(inv.remainingTry)}
                        </span>
                        {!isRefund && inv.offsetCreditTry > 0 && (
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">
                            Mahsup: {formatCurrency(inv.offsetCreditTry)}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <InvoiceStatusLabel
                          status={inv.computedStatus}
                          daysOverdue={inv.daysOverdue}
                          isRefund={isRefund}
                          refundSettlementMode={inv.refundSettlementMode}
                        />
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {confirmDeleteId === inv.id ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteInvoice(inv.id);
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
                          <div className="inline-flex items-center gap-1.5">
                            {inv.computedStatus === 'draft' ? (
                              <button
                                type="button"
                                onClick={() => onToggleDraft(inv.id, false)}
                                className="px-2.5 py-1 rounded-md text-xs font-medium bg-blue-600/10 text-blue-600 dark:text-blue-400 hover:bg-blue-600/20 transition-colors"
                              >
                                Faturayı Kes
                              </button>
                            ) : isRefund ? (
                              inv.remainingTry > 1 ? (
                                <button
                                  type="button"
                                  onClick={() => onOpenPaymentModal(inv.id)}
                                  className="px-2.5 py-1 rounded-md text-xs font-medium bg-rose-600 hover:bg-rose-700 text-white transition-colors"
                                >
                                  İade Çıkışı İşle
                                </button>
                              ) : (
                                <span className="text-[11px] text-slate-400">
                                  {inv.refundSettlementMode === 'receivable_offset'
                                    ? 'Mahsup'
                                    : 'Ödendi'}
                                </span>
                              )
                            ) : (
                              <>
                                {inv.remainingTry > 1 ? (
                                  <button
                                    type="button"
                                    onClick={() => onOpenPaymentModal(inv.id)}
                                    className="px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                                  >
                                    Tahsilat Ekle
                                  </button>
                                ) : (
                                  <span className="text-[11px] text-slate-400">Kapandı</span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => onOpenRefundModal(inv)}
                                  title="Bu Faturaya İade Kes"
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>İade Kes</span>
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(inv.id)}
                              title="Faturayı Sil"
                              aria-label="Faturayı Sil"
                              className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
