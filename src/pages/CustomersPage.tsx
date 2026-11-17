import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Download,
  Edit3,
  Mail,
  Phone,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-react';
import {
  Customer,
  EnrichedInvoice,
  PinkFinanceDatabase,
} from '../types/finance';
import {
  exportToCSV,
  formatCurrency,
  formatDateTR,
  formatPercent,
  REVENUE_MODEL_LABELS,
} from '../utils/formatters';
import { computeCustomerMatrix } from '../utils/financeEngine';
import { InvoiceStatusLabel } from '../components/StatusLabel';

interface CustomersPageProps {
  db: PinkFinanceDatabase;
  selectedMonth: string;
  enrichedInvoices: EnrichedInvoice[];
  selectedCustomerId: string | null;
  onSelectCustomer: (customerId: string | null) => void;
  onOpenNewCustomer: () => void;
  onOpenEditCustomer: (customer: Customer) => void;
  onDeleteCustomer: (customerId: string) => void;
  onDeleteInvoice: (invoiceId: string) => void;
  onDeletePayment: (paymentId: string) => void;
  onOpenPaymentModal: (invoiceId: string) => void;
  onOpenRefundModal: (salesInvoice?: EnrichedInvoice) => void;
}

export function CustomersPage({
  db,
  selectedMonth,
  enrichedInvoices,
  selectedCustomerId,
  onSelectCustomer,
  onOpenNewCustomer,
  onOpenEditCustomer,
  onDeleteCustomer,
  onDeleteInvoice,
  onDeletePayment,
  onOpenPaymentModal,
  onOpenRefundModal,
}: CustomersPageProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [confirmDeleteCustomer, setConfirmDeleteCustomer] = useState(false);
  const [confirmDeletePaymentId, setConfirmDeletePaymentId] = useState<string | null>(null);

  const matrix = useMemo(
    () => computeCustomerMatrix(db, selectedMonth),
    [db, selectedMonth]
  );

  const filteredMatrix = useMemo(() => {
    const q = search.trim().toLowerCase();
    return matrix.filter((row) => {
      if (statusFilter !== 'all' && row.customer.status !== statusFilter) return false;
      if (
        q &&
        !row.customer.companyName.toLowerCase().includes(q) &&
        !row.customer.contactPerson.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [matrix, search, statusFilter]);

  const selectedCustomerRow = selectedCustomerId
    ? matrix.find((r) => r.customer.id === selectedCustomerId) ?? null
    : null;

  // Drill-down Customer Detail View
  if (selectedCustomerRow) {
    const { customer } = selectedCustomerRow;
    const custInvoices = enrichedInvoices
      .filter((i) => i.customerId === customer.id)
      .sort((a, b) => b.issueDate.localeCompare(a.issueDate));

    const custPayments = db.payments
      .filter((p) => p.customerId === customer.id)
      .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));

    const invoiceNoMap = new Map(custInvoices.map((i) => [i.id, i.invoiceNo]));

    const subscriptionsAndHardware = custInvoices.filter(
      (i) => i.revenueModel === 'monthly_mrr' || i.revenueModel === 'annual_mrr' || i.revenueModel === 'hardware'
    );

    return (
      <div className="space-y-6">
        {/* Back & Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              setConfirmDeleteCustomer(false);
              onSelectCustomer(null);
            }}
            className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Müşteri Gelir Matrisine Dön</span>
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenEditCustomer(customer)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Müşteri Kartını Düzenle</span>
            </button>

            {confirmDeleteCustomer ? (
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60">
                <span className="text-[11px] text-rose-700 dark:text-rose-300">
                  Müşteri ve bağlı {custInvoices.length} fatura silinsin mi?
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmDeleteCustomer(false);
                    onDeleteCustomer(customer.id);
                    onSelectCustomer(null);
                  }}
                  className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-rose-600 hover:bg-rose-700 text-white"
                >
                  Onayla
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteCustomer(false)}
                  className="px-2 py-1 text-[11px] font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                >
                  İptal
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDeleteCustomer(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Müşteriyi Sil</span>
              </button>
            )}
          </div>
        </div>

        {/* Customer Header Card */}
        <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl p-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Building2 className="w-5 h-5 text-blue-500 shrink-0" />
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {customer.companyName}
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                <span>İlgili Kişi: {customer.contactPerson}</span>
                <span>·</span>
                <span>
                  {customer.taxOffice} / VKN: <span className="font-mono">{customer.taxNumber}</span>
                </span>
                <span>·</span>
                <span>Sözleşme Başlangıcı: {formatDateTR(customer.contractStartDate)}</span>
                <span>·</span>
                <span
                  className={
                    customer.status === 'active'
                      ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                      : 'text-slate-500'
                  }
                >
                  {customer.status === 'active' ? 'Aktif Müşteri' : 'Pasif'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-300 pt-1">
                {customer.email && (
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    {customer.email}
                  </span>
                )}
                {customer.phone && (
                  <span className="inline-flex items-center gap-1.5 font-mono">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    {customer.phone}
                  </span>
                )}
              </div>
              {customer.notes && (
                <p className="text-xs text-slate-500 dark:text-slate-400 pt-1">{customer.notes}</p>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 lg:w-auto shrink-0">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#090E1A] border border-slate-200 dark:border-slate-800">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">Aylık MRR Payı</span>
                <div className="mt-1 text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                  {formatCurrency(
                    selectedCustomerRow.activeMonthlyMrr +
                      selectedCustomerRow.annualMrrMonthlyContribution
                  )}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#090E1A] border border-slate-200 dark:border-slate-800">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">Toplam Ciro</span>
                <div className="mt-1 text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                  {formatCurrency(selectedCustomerRow.totalBilledTry)}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#090E1A] border border-slate-200 dark:border-slate-800">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">Tahsil Edilen</span>
                <div className="mt-1 text-sm font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(selectedCustomerRow.collectedTry)}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#090E1A] border border-slate-200 dark:border-slate-800">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">Açık Alacak</span>
                <div className="mt-1 text-sm font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400">
                  {formatCurrency(selectedCustomerRow.receivableTry)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Invoices & Payment Timeline */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Kesilen Faturalar ({custInvoices.length})
              </h3>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                Ciro Payı: {formatPercent(selectedCustomerRow.revenueSharePct)}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-900/40">
                    <th className="py-2.5 px-4">Fatura No / Kalem</th>
                    <th className="py-2.5 px-4">Model</th>
                    <th className="py-2.5 px-4">Tarih</th>
                    <th className="py-2.5 px-4 text-right">Tutar</th>
                    <th className="py-2.5 px-4">Durum</th>
                    <th className="py-2.5 px-4 text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                  {custInvoices.map((inv) => {
                    const isRefund = inv.invoiceType === 'refund';
                    return (
                      <tr
                        key={inv.id}
                        className={
                          isRefund
                            ? 'bg-rose-500/[0.03] hover:bg-rose-500/[0.07]'
                            : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/30'
                        }
                      >
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-500">
                            <span>{inv.invoiceNo}</span>
                            {isRefund && (
                              <span className="px-1 py-0.5 rounded bg-rose-500/15 text-rose-600 dark:text-rose-400 font-sans font-semibold text-[10px]">
                                İADE
                              </span>
                            )}
                          </div>
                          <div className="font-medium text-slate-900 dark:text-slate-100">
                            {inv.title}
                          </div>
                        </td>
                        <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {REVENUE_MODEL_LABELS[inv.revenueModel]}
                        </td>
                        <td className="py-2.5 px-4 font-mono tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {formatDateTR(inv.issueDate)}
                        </td>
                        <td
                          className={`py-2.5 px-4 text-right font-mono tabular-nums font-semibold whitespace-nowrap ${
                            isRefund
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-slate-900 dark:text-white'
                          }`}
                        >
                          {isRefund ? '-' : ''}
                          {formatCurrency(inv.amountTry)}
                        </td>
                        <td className="py-2.5 px-4">
                          <InvoiceStatusLabel
                            status={inv.computedStatus}
                            daysOverdue={inv.daysOverdue}
                            isRefund={isRefund}
                            refundSettlementMode={inv.refundSettlementMode}
                          />
                        </td>
                        <td className="py-2.5 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            {isRefund ? (
                              inv.remainingTry > 1 ? (
                                <button
                                  type="button"
                                  onClick={() => onOpenPaymentModal(inv.id)}
                                  className="px-2.5 py-1 rounded-md bg-rose-600 hover:bg-rose-700 text-white font-medium"
                                >
                                  İade Çık
                                </button>
                              ) : (
                                <span className="text-slate-400">
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
                                    className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                                  >
                                    Tahsil Et
                                  </button>
                                ) : (
                                  <span className="text-slate-400">Ödendi</span>
                                )}
                                {!inv.isDraft && (
                                  <button
                                    type="button"
                                    onClick={() => onOpenRefundModal(inv)}
                                    title="İade Faturası Kes"
                                    className="p-1 rounded-md text-rose-500 hover:bg-rose-500/10 transition-colors"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </>
                            )}
                            <button
                              type="button"
                              onClick={() => onDeleteInvoice(inv.id)}
                              title="Faturayı Sil"
                              aria-label="Faturayı Sil"
                              className="p-1 rounded-md text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Column: Payment History & Hardware/Subscription Timeline */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
                Ödeme Geçmişi Zaman Çizelgesi
              </h3>
              {custPayments.length === 0 ? (
                <p className="text-xs text-slate-500">Henüz tahsilat kaydı bulunmuyor.</p>
              ) : (
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {custPayments.map((pay) => (
                    <div
                      key={pay.id}
                      className="pb-3 border-b border-slate-100 dark:border-slate-800/70 last:border-0 last:pb-0 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-slate-500 dark:text-slate-400">
                          {formatDateTR(pay.paymentDate)} · {invoiceNoMap.get(pay.invoiceId)}
                        </span>
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-mono tabular-nums font-semibold ${
                              pay.paymentType === 'refund'
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {pay.paymentType === 'refund' ? '-' : '+'}
                            {formatCurrency(pay.amountTry)}
                            {pay.paymentType === 'refund' ? ' (İade)' : ''}
                          </span>
                          {confirmDeletePaymentId === pay.id ? (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  onDeletePayment(pay.id);
                                  setConfirmDeletePaymentId(null);
                                }}
                                className="px-1.5 py-0.5 rounded bg-rose-600 text-white text-[10px] font-medium"
                              >
                                Sil
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeletePaymentId(null)}
                                className="px-1 py-0.5 text-[10px] text-slate-400 hover:text-slate-200"
                              >
                                İptal
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeletePaymentId(pay.id)}
                              title="Tahsilatı Sil"
                              aria-label="Tahsilatı Sil"
                              className="p-1 rounded text-slate-400 hover:text-rose-500 transition-colors"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="text-slate-600 dark:text-slate-300 mt-0.5">
                        {pay.bankAccount} {pay.referenceNo ? `· ${pay.referenceNo}` : ''}
                      </div>
                      {pay.note && (
                        <div className="text-[11px] text-slate-500 mt-0.5">{pay.note}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
                Aktif Sözleşmeler &amp; Donanım Alımları
              </h3>
              <div className="space-y-2.5 text-xs max-h-[240px] overflow-y-auto pr-1">
                {subscriptionsAndHardware.slice(0, 8).map((item) => {
                  const isRefund = item.invoiceType === 'refund';
                  return (
                    <div
                      key={item.id}
                      className="flex items-start justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800/70 last:border-0"
                    >
                      <div>
                        <div className="font-medium text-slate-800 dark:text-slate-200">
                          {item.title}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {REVENUE_MODEL_LABELS[item.revenueModel]} · {formatDateTR(item.issueDate)}
                        </div>
                      </div>
                      <span
                        className={`font-mono tabular-nums font-semibold shrink-0 ${
                          isRefund
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        {isRefund ? '-' : ''}
                        {formatCurrency(item.amountTry)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Matrix Overview
  const concentratedList = matrix.filter((r) => r.concentrationWarning);
  const grandTotal = matrix.reduce((s, r) => s + r.totalBilledTry, 0);

  const handleExportMatrix = () => {
    exportToCSV(
      'PinkFinance_Musteri_Gelir_Kirilim_Matrisi',
      [
        'Müşteri Ünvanı',
        'Aktif Aylık MRR (TRY)',
        'Yıllık MRR Aylık Pay (TRY)',
        'Yıllık Sözleşme Toplamı (TRY)',
        'Tek Seferlik Hizmet (TRY)',
        'Donanım Satışı (TRY)',
        'Toplam Ciro (TRY)',
        'Ciro Payı (%)',
        'Tahsil Edilen (TRY)',
        'Bekleyen Alacak (TRY)',
      ],
      filteredMatrix.map((r) => [
        r.customer.companyName,
        Math.round(r.activeMonthlyMrr),
        Math.round(r.annualMrrMonthlyContribution),
        Math.round(r.annualMrrTotalContract),
        Math.round(r.oneOffTotal),
        Math.round(r.hardwareTotal),
        Math.round(r.totalBilledTry),
        r.revenueSharePct.toFixed(1),
        Math.round(r.collectedTry),
        Math.round(r.receivableTry),
      ])
    );
  };

  return (
    <div className="space-y-5">
      {/* Concentration Alert */}
      {concentratedList.length > 0 && (
        <div className="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-amber-800 dark:text-amber-300">
                Gelir Konsantrasyon Riski:
              </span>{' '}
              <span className="text-slate-700 dark:text-slate-300">
                {concentratedList
                  .map(
                    (c) =>
                      `${c.customer.companyName} (${formatPercent(c.revenueSharePct)})`
                  )
                  .join(', ')}{' '}
                toplam cironun %35 eşiğinin üzerinde paya sahip.
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onSelectCustomer(concentratedList[0].customer.id)}
            className="text-xs font-medium text-amber-800 dark:text-amber-300 hover:underline whitespace-nowrap shrink-0"
          >
            Müşteri Kartını İncele
          </button>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[260px]">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Firma adı veya ilgili kişi ara..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-[#090E1A] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
            />
          </div>
          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#090E1A]">
            {(['all', 'active', 'inactive'] as const).map((st) => (
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
                {st === 'all' ? 'Tümü' : st === 'active' ? 'Aktif' : 'Pasif'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportMatrix}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Matrisi İndir (CSV)</span>
          </button>
          <button
            type="button"
            onClick={onOpenNewCustomer}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Yeni Müşteri</span>
          </button>
        </div>
      </div>

      {/* Customer Revenue Breakdown Matrix Table */}
      <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Müşteri Bazlı Gelir Kırılım Matrisi
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Detaylı fatura ve ödeme zaman çizelgesi için müşteri satırına tıklayın
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
            Toplam Ciro: <strong className="text-slate-900 dark:text-white">{formatCurrency(grandTotal)}</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-900/40">
                <th className="py-3 px-4">Müşteri Adı</th>
                <th className="py-3 px-4 text-right">Aktif Aylık MRR</th>
                <th className="py-3 px-4 text-right">Yıllık MRR (Ay / Sözleşme)</th>
                <th className="py-3 px-4 text-right">Tek Seferlik</th>
                <th className="py-3 px-4 text-right">Donanım Satışı</th>
                <th className="py-3 px-4 text-right">Toplam Ciro &amp; Pay</th>
                <th className="py-3 px-4 text-right">Tahsil Edilen / Alacak</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-xs">
              {filteredMatrix.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 dark:text-slate-400 space-y-3">
                    <p>Henüz kayıtlı müşteri kartı bulunmuyor.</p>
                    <button
                      type="button"
                      onClick={onOpenNewCustomer}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>İlk Müşteriyi Ekle</span>
                    </button>
                  </td>
                </tr>
              ) : (
                filteredMatrix.map((row) => (
                <tr
                  key={row.customer.id}
                  onClick={() => onSelectCustomer(row.customer.id)}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                >
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>{row.customer.companyName}</span>
                      {row.concentrationWarning && (
                        <AlertTriangle
                          className="w-3.5 h-3.5 text-amber-500 shrink-0"
                          aria-label="Yüksek Gelir Konsantrasyonu"
                        />
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {row.customer.contactPerson} · {row.invoiceCount} fatura
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-800 dark:text-slate-200 whitespace-nowrap">
                    {row.activeMonthlyMrr > 0 ? formatCurrency(row.activeMonthlyMrr) : '—'}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                    {row.annualMrrTotalContract > 0 ? (
                      <div>
                        <span className="text-slate-900 dark:text-white font-medium">
                          {formatCurrency(row.annualMrrMonthlyContribution)}/ay
                        </span>
                        <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                          Sözleşme: {formatCurrency(row.annualMrrTotalContract)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-800 dark:text-slate-200 whitespace-nowrap">
                    {row.oneOffTotal > 0 ? formatCurrency(row.oneOffTotal) : '—'}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-800 dark:text-slate-200 whitespace-nowrap">
                    {row.hardwareTotal > 0 ? formatCurrency(row.hardwareTotal) : '—'}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                    <div className="font-bold text-slate-900 dark:text-white">
                      {formatCurrency(row.totalBilledTry)}
                    </div>
                    <div
                      className={`text-[11px] ${
                        row.concentrationWarning
                          ? 'text-amber-600 dark:text-amber-400 font-semibold'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      Pay: {formatPercent(row.revenueSharePct)}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                    <div className="text-emerald-600 dark:text-emerald-400 font-medium">
                      {formatCurrency(row.collectedTry)}
                    </div>
                    <div
                      className={`text-[11px] ${
                        row.overdueTry > 0
                          ? 'text-rose-600 dark:text-rose-400 font-semibold'
                          : row.receivableTry > 0
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-slate-400'
                      }`}
                    >
                      Açık: {formatCurrency(row.receivableTry)}
                    </div>
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
