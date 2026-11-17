import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  BankAccount,
  BillingCycle,
  CurrencyCode,
  Customer,
  CustomerStatus,
  EnrichedInvoice,
  ExchangeRates,
  Expense,
  ExpenseCategory,
  ExpenseStatus,
  Invoice,
  Payment,
  RefundSettlementMode,
  RevenueModel,
  WonSale,
  WonSaleStatus,
} from '../types/finance';
import {
  ALL_EXPENSE_CATEGORIES,
  BILLING_CYCLE_LABELS,
  EXPENSE_CATEGORY_LABELS,
  formatCurrency,
  formatDateTR,
  getMonthKey,
  REVENUE_MODEL_LABELS,
  WON_SALE_STATUS_LABELS,
} from '../utils/formatters';
import { REFERENCE_TODAY } from '../utils/financeEngine';

interface ModalShellProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}

function ModalShell({ title, subtitle, onClose, children }: ModalShellProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs">
      <div
        className="w-full max-w-xl bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
      >
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h2>
            {subtitle && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Kapat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

const inputCls =
  'w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#090E1A] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600/40 focus:border-blue-600';
const labelCls = 'block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5';

function addDaysISO(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return isoDate;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// 1. Yeni Fatura / Gelir Modal
interface NewInvoiceModalProps {
  customers: Customer[];
  exchangeRates: ExchangeRates;
  bankAccounts: BankAccount[];
  wonSales?: WonSale[];
  prefillFromWonSale?: { sale: WonSale; suggestedIssueDate?: string } | null;
  onClose: () => void;
  onOpenNewCustomer: () => void;
  onSave: (
    invoice: Omit<Invoice, 'id' | 'invoiceNo'>,
    linkedCogs?: Omit<Expense, 'id' | 'linkedInvoiceId'>
  ) => void;
}

export function NewInvoiceModal({
  customers,
  exchangeRates,
  bankAccounts,
  wonSales = [],
  prefillFromWonSale,
  onClose,
  onOpenNewCustomer,
  onSave,
}: NewInvoiceModalProps) {
  const preSale = prefillFromWonSale?.sale;
  const initialIssue = prefillFromWonSale?.suggestedIssueDate || REFERENCE_TODAY;
  const initialDue = addDaysISO(initialIssue, 14);

  const [customerId, setCustomerId] = useState(preSale?.customerId ?? customers[0]?.id ?? '');
  const [wonSaleId, setWonSaleId] = useState(preSale?.id ?? '');
  const [revenueModel, setRevenueModel] = useState<RevenueModel>(
    preSale?.revenueModel ?? 'monthly_mrr'
  );
  const [title, setTitle] = useState(preSale?.title ?? '');
  const [issueDate, setIssueDate] = useState(initialIssue);
  const [dueDate, setDueDate] = useState(initialDue);
  const [recognitionStartMonth, setRecognitionStartMonth] = useState(getMonthKey(initialIssue));
  const [recognitionMonths, setRecognitionMonths] = useState(12);
  const [currency, setCurrency] = useState<CurrencyCode>(preSale?.currency ?? 'TRY');
  const [amount, setAmount] = useState(preSale ? String(preSale.amount) : '');
  const [fxRate, setFxRate] = useState(() => {
    if (preSale) {
      if (preSale.currency === 'TRY') return '1';
      if (preSale.currency === 'USD') return String(exchangeRates.USD);
      if (preSale.currency === 'EUR') return String(exchangeRates.EUR);
    }
    return '1';
  });
  const [isDraft, setIsDraft] = useState(false);

  // Hardware COGS optional linkage
  const [addCogs, setAddCogs] = useState(true);
  const [cogsVendor, setCogsVendor] = useState('');
  const [cogsAmountTry, setCogsAmountTry] = useState(
    preSale?.linkedCogsTry ? String(preSale.linkedCogsTry) : ''
  );

  useEffect(() => {
    if (currency === 'TRY') setFxRate('1');
    else if (currency === 'USD') setFxRate(String(exchangeRates.USD));
    else if (currency === 'EUR') setFxRate(String(exchangeRates.EUR));
  }, [currency, exchangeRates]);

  useEffect(() => {
    setRecognitionStartMonth(getMonthKey(issueDate));
  }, [issueDate]);

  const customerWonSales = wonSales.filter((s) => s.customerId === customerId);

  const numericAmount = parseFloat(amount) || 0;
  const numericFx = parseFloat(fxRate) || 1;
  const amountTry = Math.round(numericAmount * numericFx);
  const effectiveMonths = revenueModel === 'annual_mrr' ? Math.max(1, recognitionMonths) : 1;
  const monthlyRecognitionPreview = amountTry / effectiveMonths;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId || !title.trim() || numericAmount <= 0) return;

    const cogsNum = parseFloat(cogsAmountTry) || 0;
    const shouldCreateCogs = revenueModel === 'hardware' && addCogs && cogsNum > 0;

    onSave(
      {
        customerId,
        revenueModel,
        title: title.trim(),
        issueDate,
        dueDate,
        recognitionStartMonth,
        recognitionMonths: effectiveMonths,
        currency,
        amount: numericAmount,
        fxRateAtIssue: numericFx,
        amountTry,
        linkedCogsTry: shouldCreateCogs ? cogsNum : undefined,
        wonSaleId: wonSaleId || undefined,
        isDraft,
      },
      shouldCreateCogs
        ? {
            title: `${title.trim()} — Donanım Tedariği`,
            vendor: cogsVendor.trim() || 'Donanım Tedarikçisi',
            category: 'cogs',
            expenseDate: issueDate,
            dueDate,
            paymentDate: issueDate,
            currency: 'TRY',
            amount: cogsNum,
            fxRate: 1,
            amountTry: cogsNum,
            status: 'paid',
            isRecurring: false,
            bankAccount: bankAccounts[0]?.name ?? 'Garanti BBVA TRY',
          }
        : undefined
    );
    onClose();
  };

  return (
    <ModalShell
      title="Yeni Fatura / Gelir Ekle"
      subtitle="Fatura tarihi P&L gelir tahakkukunu, tahsilat tarihi ise nakit akışını belirler."
      onClose={onClose}
    >
      {customers.length === 0 ? (
        <div className="py-6 text-center space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Fatura veya gelir kaydı oluşturmak için önce en az bir müşteri kartı eklemelisiniz.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Kapat
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenNewCustomer();
              }}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
            >
              İlk Müşteriyi Ekle
            </button>
          </div>
        </div>
      ) : (
      <form onSubmit={handleSubmit} className="space-y-4">
        {preSale && (
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 text-xs text-blue-800 dark:text-blue-200">
            <span className="font-semibold">Kazanılmış Satıştan Fatura Oluşturuluyor:</span>{' '}
            <span>{preSale.title}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Müşteri Kartı</label>
            <select
              value={customerId}
              onChange={(e) => {
                setCustomerId(e.target.value);
                setWonSaleId('');
              }}
              className={inputCls}
              required
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.companyName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Gelir Modeli</label>
            <select
              value={revenueModel}
              onChange={(e) => setRevenueModel(e.target.value as RevenueModel)}
              className={inputCls}
            >
              {Object.entries(REVENUE_MODEL_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        </div>

        {customerWonSales.length > 0 && (
          <div>
            <label className={labelCls}>İlişkili Kazanılmış Satış (Tekrar Takibi İçin)</label>
            <select
              value={wonSaleId}
              onChange={(e) => setWonSaleId(e.target.value)}
              className={inputCls}
            >
              <option value="">Bağımsız Fatura (Satışa Bağlama)</option>
              {customerWonSales.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title} · {BILLING_CYCLE_LABELS[s.billingCycle]} ({formatCurrency(s.amountTry)})
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className={labelCls}>Fatura / Kalem Başlığı</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Örn: Kurumsal Güvenlik Platformu Yıllık Abonelik"
            className={inputCls}
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Para Birimi</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
              className={inputCls}
            >
              <option value="TRY">TRY (₺)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Tutar ({currency})</label>
            <input
              type="number"
              min="1"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={`${inputCls} font-mono tabular-nums`}
              required
            />
          </div>
          <div>
            <label className={labelCls}>Kur (TRY)</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={fxRate}
              onChange={(e) => setFxRate(e.target.value)}
              disabled={currency === 'TRY'}
              className={`${inputCls} font-mono tabular-nums disabled:opacity-60`}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Fatura Tarihi (P&L)</label>
            <input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className={inputCls}
              required
            />
          </div>
          <div>
            <label className={labelCls}>Son Ödeme / Vade Tarihi</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={inputCls}
              required
            />
          </div>
        </div>

        {revenueModel === 'annual_mrr' && (
          <div className="p-3.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 space-y-3">
            <div className="text-xs text-blue-800 dark:text-blue-200 font-medium">
              Ertelenmiş Gelir (Deferred Revenue) Dağıtımı
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Başlangıç Ayı</label>
                <input
                  type="month"
                  value={recognitionStartMonth}
                  onChange={(e) => setRecognitionStartMonth(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Dağıtım Süresi (Ay)</label>
                <input
                  type="number"
                  min="2"
                  max="36"
                  value={recognitionMonths}
                  onChange={(e) => setRecognitionMonths(parseInt(e.target.value, 10) || 12)}
                  className={`${inputCls} font-mono`}
                />
              </div>
            </div>
            <p className="text-xs text-blue-700 dark:text-blue-300 font-mono tabular-nums">
              Toplam {formatCurrency(amountTry)} tutar, {effectiveMonths} ay boyunca aylık{' '}
              <strong>{formatCurrency(monthlyRecognitionPreview)}</strong> olarak P&L'e yansıyacaktır.
            </p>
          </div>
        )}

        {revenueModel === 'hardware' && (
          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 space-y-3">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={addCogs}
                onChange={(e) => setAddCogs(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-700 text-blue-600"
              />
              <span>Eşleşen Donanım Maliyetini (COGS) otomatik gider olarak kaydet</span>
            </label>
            {addCogs && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Tedarikçi Firma</label>
                  <input
                    type="text"
                    value={cogsVendor}
                    onChange={(e) => setCogsVendor(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Donanım Maliyeti (TRY)</label>
                  <input
                    type="number"
                    min="0"
                    value={cogsAmountTry}
                    onChange={(e) => setCogsAmountTry(e.target.value)}
                    placeholder="Örn: 180000"
                    className={`${inputCls} font-mono tabular-nums`}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
          <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={isDraft}
              onChange={(e) => setIsDraft(e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-700 text-blue-600"
            />
            <span>Taslak olarak kaydet (P&L'e dahil etme)</span>
          </label>
          <div className="text-right">
            <span className="block text-[11px] text-slate-500 dark:text-slate-400">TL Karşılığı</span>
            <span className="text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-white">
              {formatCurrency(amountTry)}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            İptal
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
          >
            Faturayı Kaydet
          </button>
        </div>
      </form>
      )}
    </ModalShell>
  );
}

// 2. Tahsilat İşle Modal
interface AddPaymentModalProps {
  openInvoices: EnrichedInvoice[];
  preselectedInvoiceId?: string | null;
  bankAccounts: BankAccount[];
  exchangeRates: ExchangeRates;
  onClose: () => void;
  onSave: (payment: Omit<Payment, 'id'>) => void;
}

export function AddPaymentModal({
  openInvoices,
  preselectedInvoiceId,
  bankAccounts,
  exchangeRates,
  onClose,
  onSave,
}: AddPaymentModalProps) {
  const initialInv =
    openInvoices.find((i) => i.id === preselectedInvoiceId) ?? openInvoices[0];

  const [invoiceId, setInvoiceId] = useState(initialInv?.id ?? '');
  const selectedInv = openInvoices.find((i) => i.id === invoiceId);

  const [paymentDate, setPaymentDate] = useState(REFERENCE_TODAY);
  const [amount, setAmount] = useState(
    initialInv ? String(Math.round(initialInv.remainingOriginal)) : ''
  );
  const [bankAccount, setBankAccount] = useState(bankAccounts[0]?.name ?? 'Ana Kasa / Banka');
  const [referenceNo, setReferenceNo] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (selectedInv) {
      setAmount(String(Math.round(selectedInv.remainingOriginal)));
    }
  }, [invoiceId]);

  const numericAmount = parseFloat(amount) || 0;
  const isRefund = selectedInv?.invoiceType === 'refund';
  const fxRate =
    !selectedInv || selectedInv.currency === 'TRY'
      ? 1
      : selectedInv.currency === 'USD'
      ? exchangeRates.USD
      : exchangeRates.EUR;
  const amountTry = Math.round(numericAmount * fxRate);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInv || numericAmount <= 0) return;

    onSave({
      invoiceId: selectedInv.id,
      customerId: selectedInv.customerId,
      paymentDate,
      amount: numericAmount,
      currency: selectedInv.currency,
      fxRate,
      amountTry,
      bankAccount,
      paymentType: isRefund ? 'refund' : 'collection',
      referenceNo: referenceNo.trim() || undefined,
      note: note.trim() || undefined,
    });
    onClose();
  };

  return (
    <ModalShell
      title={isRefund ? 'Hesaptan İade Çıkışı İşle' : 'Tahsilat İşle'}
      subtitle={
        isRefund
          ? 'İşlenen iade ödemesi seçilen banka hesabından düşülür ve nakit akışına gider/iade çıkışı olarak yansır.'
          : 'İşlenen tahsilatlar ilgili faturayı günceller ve nakit akışına anında yansır.'
      }
      onClose={onClose}
    >
      {openInvoices.length === 0 ? (
        <div className="py-8 text-center space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Tahsilat veya iade ödemesi bekleyen açık fatura bulunmuyor.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 text-white"
          >
            Tamam
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelCls}>Açık Fatura Seçin</label>
            <select
              value={invoiceId}
              onChange={(e) => setInvoiceId(e.target.value)}
              className={inputCls}
              required
            >
              {openInvoices.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.invoiceType === 'refund' ? '[İADE] ' : ''}
                  {inv.invoiceNo} · {inv.customerName} — Kalan: {formatCurrency(inv.remainingTry)}
                </option>
              ))}
            </select>
          </div>

          {selectedInv && (
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-500 dark:text-slate-400">
                  {isRefund ? 'İade Fatura Tutarı: ' : 'Fatura Tutarı: '}
                </span>
                <span
                  className={`font-mono tabular-nums font-semibold ${
                    isRefund
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-slate-900 dark:text-white'
                  }`}
                >
                  {isRefund ? '-' : ''}
                  {formatCurrency(selectedInv.amountTry)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400">
                  {isRefund ? 'Ödenecek İade Bakiyesi: ' : 'Kalan Bakiye: '}
                </span>
                <span className="font-mono tabular-nums font-semibold text-amber-600 dark:text-amber-400">
                  {formatCurrency(selectedInv.remainingTry)}
                </span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>
                {isRefund ? 'İade Ödeme Tutarı' : 'Tahsilat Tutarı'} ({selectedInv?.currency ?? 'TRY'})
              </label>
              <input
                type="number"
                min="1"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={`${inputCls} font-mono tabular-nums`}
                required
              />
            </div>
            <div>
              <label className={labelCls}>
                {isRefund ? 'İade Tarihi (Nakit Çıkışı)' : 'Tahsilat Tarihi (Nakit Akışı)'}
              </label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className={inputCls}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>
                {isRefund ? 'Çıkış Yapılacak Banka Hesabı' : 'Banka Hesabı'}
              </label>
              <select
                value={bankAccount}
                onChange={(e) => setBankAccount(e.target.value)}
                className={inputCls}
              >
                {bankAccounts.length === 0 ? (
                  <option value="Ana Kasa / Banka">Ana Kasa / Banka</option>
                ) : (
                  bankAccounts.map((b) => (
                    <option key={b.id} value={b.name}>
                      {b.name}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div>
              <label className={labelCls}>Dekont / Referans No</label>
              <input
                type="text"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                placeholder="Örn: EFT-2026-884"
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Açıklama / Not</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={isRefund ? 'İade dekont veya sebep notu' : 'İsteğe bağlı ödeme notu'}
              className={inputCls}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              İptal
            </button>
            <button
              type="submit"
              className={`px-4 py-2 text-xs font-medium rounded-lg text-white transition-colors ${
                isRefund
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {isRefund
                ? `İade Çıkışını Onayla (-${formatCurrency(amountTry)})`
                : `Tahsilatı Onayla (${formatCurrency(amountTry)})`}
            </button>
          </div>
        </form>
      )}
    </ModalShell>
  );
}

// 3. Yeni Gider Ekle Modal
interface NewExpenseModalProps {
  exchangeRates: ExchangeRates;
  bankAccounts: BankAccount[];
  hardwareInvoices: EnrichedInvoice[];
  onClose: () => void;
  onSave: (expense: Omit<Expense, 'id'>) => void;
}

export function NewExpenseModal({
  exchangeRates,
  bankAccounts,
  hardwareInvoices,
  onClose,
  onSave,
}: NewExpenseModalProps) {
  const [category, setCategory] = useState<ExpenseCategory>('cloud');
  const [title, setTitle] = useState('');
  const [vendor, setVendor] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>('USD');
  const [amount, setAmount] = useState('');
  const [fxRate, setFxRate] = useState(String(exchangeRates.USD));
  const [expenseDate, setExpenseDate] = useState(REFERENCE_TODAY);
  const [dueDate, setDueDate] = useState('2026-11-28');
  const [status, setStatus] = useState<ExpenseStatus>('pending');
  const [paymentDate, setPaymentDate] = useState(REFERENCE_TODAY);
  const [bankAccount, setBankAccount] = useState(bankAccounts[0]?.name ?? 'Ana Kasa / Banka');
  const [isRecurring, setIsRecurring] = useState(false);
  const [linkedInvoiceId, setLinkedInvoiceId] = useState('');

  useEffect(() => {
    if (currency === 'TRY') setFxRate('1');
    else if (currency === 'USD') setFxRate(String(exchangeRates.USD));
    else if (currency === 'EUR') setFxRate(String(exchangeRates.EUR));
  }, [currency, exchangeRates]);

  const numericAmount = parseFloat(amount) || 0;
  const numericFx = parseFloat(fxRate) || 1;
  const amountTry = Math.round(numericAmount * numericFx);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !vendor.trim() || numericAmount <= 0) return;

    onSave({
      title: title.trim(),
      vendor: vendor.trim(),
      category,
      expenseDate,
      dueDate,
      paymentDate: status === 'paid' ? paymentDate : undefined,
      currency,
      amount: numericAmount,
      fxRate: numericFx,
      amountTry,
      status,
      isRecurring,
      bankAccount: status === 'paid' ? bankAccount : undefined,
      linkedInvoiceId: category === 'cogs' && linkedInvoiceId ? linkedInvoiceId : undefined,
    });
    onClose();
  };

  return (
    <ModalShell
      title="Yeni Gider Ekle"
      subtitle="Yabancı para (USD/EUR) giderler girilen kurla otomatik TRY karşılığına çevrilir."
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Gider Kategorisi</label>
            <select
              value={category}
              onChange={(e) => {
                const next = e.target.value as ExpenseCategory;
                setCategory(next);
                if (next === 'cloud' || next === 'licenses') setCurrency('USD');
                else setCurrency('TRY');
              }}
              className={inputCls}
            >
              {ALL_EXPENSE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {EXPENSE_CATEGORY_LABELS[cat]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Tedarikçi / Kurum</label>
            <input
              type="text"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              placeholder="Örn: Amazon Web Services"
              className={inputCls}
              required
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>Gider Açıklaması</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Örn: Kasım Ayı Production Sunucu & RDS Maliyeti"
            className={inputCls}
            required
          />
        </div>

        {category === 'cogs' && hardwareInvoices.length > 0 && (
          <div>
            <label className={labelCls}>İlişkili Donanım Satış Faturası (Opsiyonel)</label>
            <select
              value={linkedInvoiceId}
              onChange={(e) => setLinkedInvoiceId(e.target.value)}
              className={inputCls}
            >
              <option value="">Seçilmedi</option>
              {hardwareInvoices.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.invoiceNo} · {inv.customerName} ({formatCurrency(inv.amountTry)})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Para Birimi</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
              className={inputCls}
            >
              <option value="TRY">TRY (₺)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Tutar ({currency})</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className={`${inputCls} font-mono tabular-nums`}
              required
            />
          </div>
          <div>
            <label className={labelCls}>Kur (TRY)</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={fxRate}
              onChange={(e) => setFxRate(e.target.value)}
              disabled={currency === 'TRY'}
              className={`${inputCls} font-mono tabular-nums disabled:opacity-60`}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Gider Tarihi (P&L)</label>
            <input
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              className={inputCls}
              required
            />
          </div>
          <div>
            <label className={labelCls}>Vade Tarihi</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={inputCls}
              required
            />
          </div>
          <div>
            <label className={labelCls}>Ödeme Durumu</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ExpenseStatus)}
              className={inputCls}
            >
              <option value="paid">Ödendi (Kasadan Düştü)</option>
              <option value="pending">Ödenecek (Bekliyor)</option>
            </select>
          </div>
        </div>

        {status === 'paid' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Ödeme Tarihi (Nakit Çıkışı)</label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className={inputCls}
                required
              />
            </div>
            <div>
              <label className={labelCls}>Ödenen Banka Hesabı</label>
              <select
                value={bankAccount}
                onChange={(e) => setBankAccount(e.target.value)}
                className={inputCls}
              >
                {bankAccounts.length === 0 ? (
                  <option value="Ana Kasa / Banka">Ana Kasa / Banka</option>
                ) : (
                  bankAccounts.map((b) => (
                    <option key={b.id} value={b.name}>
                      {b.name}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
          <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-700 text-blue-600"
            />
            <span>Her ay tekrarlayan gider şablonu olarak işaretle</span>
          </label>
          <div className="text-right">
            <span className="block text-[11px] text-slate-500 dark:text-slate-400">TL Karşılığı</span>
            <span className="text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-white">
              {formatCurrency(amountTry)}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            İptal
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
          >
            Gideri Kaydet
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// 4. Yeni Müşteri / Düzenle Modal
interface CustomerModalProps {
  initialCustomer?: Customer | null;
  onClose: () => void;
  onSave: (data: Omit<Customer, 'id'>, existingId?: string) => void;
}

export function CustomerModal({ initialCustomer, onClose, onSave }: CustomerModalProps) {
  const [companyName, setCompanyName] = useState(initialCustomer?.companyName ?? '');
  const [contactPerson, setContactPerson] = useState(initialCustomer?.contactPerson ?? '');
  const [email, setEmail] = useState(initialCustomer?.email ?? '');
  const [phone, setPhone] = useState(initialCustomer?.phone ?? '');
  const [taxOffice, setTaxOffice] = useState(initialCustomer?.taxOffice ?? '');
  const [taxNumber, setTaxNumber] = useState(initialCustomer?.taxNumber ?? '');
  const [contractStartDate, setContractStartDate] = useState(
    initialCustomer?.contractStartDate ?? REFERENCE_TODAY
  );
  const [status, setStatus] = useState<CustomerStatus>(initialCustomer?.status ?? 'active');
  const [notes, setNotes] = useState(initialCustomer?.notes ?? '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || !contactPerson.trim()) return;
    onSave(
      {
        companyName: companyName.trim(),
        contactPerson: contactPerson.trim(),
        email: email.trim(),
        phone: phone.trim(),
        taxOffice: taxOffice.trim(),
        taxNumber: taxNumber.trim(),
        contractStartDate,
        status,
        notes: notes.trim() || undefined,
      },
      initialCustomer?.id
    );
    onClose();
  };

  return (
    <ModalShell
      title={initialCustomer ? 'Müşteri Kartını Düzenle' : 'Yeni Müşteri Ekle'}
      subtitle="Kesilecek faturalar ve müşteri bazlı gelir kırılımı bu kart ile eşleştirilir."
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelCls}>Firma Ünvanı</label>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Örn: Atlas Savunma ve Bilişim A.Ş."
            className={inputCls}
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>İlgili Kişi</label>
            <input
              type="text"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              placeholder="Ad Soyad"
              className={inputCls}
              required
            />
          </div>
          <div>
            <label className={labelCls}>Durum</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as CustomerStatus)}
              className={inputCls}
            >
              <option value="active">Aktif Müşteri</option>
              <option value="inactive">Pasif</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>E-posta</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="iletisim@firma.com"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Telefon</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+90 212 000 00 00"
              className={inputCls}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Vergi Dairesi</label>
            <input
              type="text"
              value={taxOffice}
              onChange={(e) => setTaxOffice(e.target.value)}
              placeholder="Örn: Beşiktaş V.D."
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Vergi / TCKN No</label>
            <input
              type="text"
              value={taxNumber}
              onChange={(e) => setTaxNumber(e.target.value)}
              placeholder="10 haneli VKN"
              className={`${inputCls} font-mono`}
            />
          </div>
          <div>
            <label className={labelCls}>Sözleşme Başlangıcı</label>
            <input
              type="date"
              value={contractStartDate}
              onChange={(e) => setContractStartDate(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>Notlar</label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Sözleşme veya hizmet kapsamı hakkında kısa not..."
            className={inputCls}
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            İptal
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
          >
            {initialCustomer ? 'Değişiklikleri Kaydet' : 'Müşteri Oluştur'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// 5. Kazanılmış Satış Ekle / Düzenle Modal
interface WonSaleModalProps {
  customers: Customer[];
  exchangeRates: ExchangeRates;
  initialSale?: WonSale | null;
  onClose: () => void;
  onOpenNewCustomer: () => void;
  onSave: (data: Omit<WonSale, 'id'>, existingId?: string) => void;
}

export function WonSaleModal({
  customers,
  exchangeRates,
  initialSale,
  onClose,
  onOpenNewCustomer,
  onSave,
}: WonSaleModalProps) {
  const [customerId, setCustomerId] = useState(initialSale?.customerId ?? customers[0]?.id ?? '');
  const [title, setTitle] = useState(initialSale?.title ?? '');
  const [revenueModel, setRevenueModel] = useState<RevenueModel>(
    initialSale?.revenueModel ?? 'monthly_mrr'
  );
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(
    initialSale?.billingCycle ?? 'monthly'
  );
  const [wonDate, setWonDate] = useState(initialSale?.wonDate ?? REFERENCE_TODAY);
  const [contractStartDate, setContractStartDate] = useState(
    initialSale?.contractStartDate ?? REFERENCE_TODAY
  );
  const [firstInvoiceDate, setFirstInvoiceDate] = useState(
    initialSale?.firstInvoiceDate ?? REFERENCE_TODAY
  );
  const [nextInvoiceDateOverride, setNextInvoiceDateOverride] = useState(
    initialSale?.nextInvoiceDateOverride ?? ''
  );
  const [contractEndDate, setContractEndDate] = useState(initialSale?.contractEndDate ?? '');
  const [autoRenew, setAutoRenew] = useState(initialSale?.autoRenew ?? true);
  const [currency, setCurrency] = useState<CurrencyCode>(initialSale?.currency ?? 'TRY');
  const [amount, setAmount] = useState(initialSale ? String(initialSale.amount) : '');
  const [fxRate, setFxRate] = useState(initialSale ? String(initialSale.fxRate) : '1');
  const [linkedCogsTry, setLinkedCogsTry] = useState(
    initialSale?.linkedCogsTry ? String(initialSale.linkedCogsTry) : ''
  );
  const [status, setStatus] = useState<WonSaleStatus>(initialSale?.status ?? 'active');
  const [notes, setNotes] = useState(initialSale?.notes ?? '');

  useEffect(() => {
    if (currency === 'TRY') setFxRate('1');
    else if (currency === 'USD') setFxRate(String(exchangeRates.USD));
    else if (currency === 'EUR') setFxRate(String(exchangeRates.EUR));
  }, [currency, exchangeRates]);

  const handleRevenueModelChange = (nextModel: RevenueModel) => {
    setRevenueModel(nextModel);
    if (!initialSale) {
      if (nextModel === 'monthly_mrr') setBillingCycle('monthly');
      else if (nextModel === 'annual_mrr') setBillingCycle('annual');
      else setBillingCycle('one_time');
    }
  };

  const numericAmount = parseFloat(amount) || 0;
  const numericFx = parseFloat(fxRate) || 1;
  const amountTry = Math.round(numericAmount * numericFx);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId || !title.trim() || numericAmount <= 0) return;

    const cogsNum = parseFloat(linkedCogsTry);

    onSave(
      {
        customerId,
        title: title.trim(),
        revenueModel,
        wonDate,
        contractStartDate,
        billingCycle,
        firstInvoiceDate,
        nextInvoiceDateOverride: nextInvoiceDateOverride || undefined,
        contractEndDate: contractEndDate || undefined,
        autoRenew,
        currency,
        amount: numericAmount,
        fxRate: numericFx,
        amountTry,
        linkedCogsTry:
          revenueModel === 'hardware' && !Number.isNaN(cogsNum) && cogsNum >= 0
            ? cogsNum
            : undefined,
        status,
        notes: notes.trim() || undefined,
      },
      initialSale?.id
    );
    onClose();
  };

  return (
    <ModalShell
      title={initialSale ? 'Kazanılmış Satışı Düzenle' : 'Yeni Kazanılmış Satış Ekle'}
      subtitle="Müşteriden kazanılan satışları kaydedin; sistem tekrar fatura tarihlerini ve kesim önceliğini otomatik analiz eder."
      onClose={onClose}
    >
      {customers.length === 0 ? (
        <div className="py-6 text-center space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Kazanılmış satış girebilmek için önce en az bir müşteri kartı oluşturmalısınız.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Kapat
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenNewCustomer();
              }}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
            >
              İlk Müşteriyi Ekle
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Müşteri Kartı</label>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className={inputCls}
                required
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Satış Durumu</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as WonSaleStatus)}
                className={inputCls}
              >
                {Object.entries(WON_SALE_STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Satış / Sözleşme Başlığı</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Örn: PinkFinance Kurumsal Abonelik + Yıllık Destek Paketi"
              className={inputCls}
              maxLength={200}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Gelir Modeli</label>
              <select
                value={revenueModel}
                onChange={(e) => handleRevenueModelChange(e.target.value as RevenueModel)}
                className={inputCls}
              >
                {Object.entries(REVENUE_MODEL_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Tekrar Faturalama Periyodu</label>
              <select
                value={billingCycle}
                onChange={(e) => setBillingCycle(e.target.value as BillingCycle)}
                className={inputCls}
              >
                {Object.entries(BILLING_CYCLE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Para Birimi</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                className={inputCls}
              >
                <option value="TRY">TRY (₺)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Fatura Dönemi Tutarı ({currency})</label>
              <input
                type="number"
                min="1"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={`${inputCls} font-mono tabular-nums`}
                required
              />
            </div>
            <div>
              <label className={labelCls}>Kur (TRY)</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={fxRate}
                onChange={(e) => setFxRate(e.target.value)}
                disabled={currency === 'TRY'}
                className={`${inputCls} font-mono tabular-nums disabled:opacity-60`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Satış Kazanım Tarihi</label>
              <input
                type="date"
                value={wonDate}
                onChange={(e) => setWonDate(e.target.value)}
                className={inputCls}
                required
              />
            </div>
            <div>
              <label className={labelCls}>Sözleşme Başlangıcı</label>
              <input
                type="date"
                value={contractStartDate}
                onChange={(e) => setContractStartDate(e.target.value)}
                className={inputCls}
                required
              />
            </div>
            <div>
              <label className={labelCls}>İlk / Başlangıç Fatura Tarihi</label>
              <input
                type="date"
                value={firstInvoiceDate}
                onChange={(e) => setFirstInvoiceDate(e.target.value)}
                className={inputCls}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Planlanan Sonraki Fatura (Opsiyonel Override)</label>
              <input
                type="date"
                value={nextInvoiceDateOverride}
                onChange={(e) => setNextInvoiceDateOverride(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Sözleşme Bitiş Tarihi (Opsiyonel)</label>
              <input
                type="date"
                value={contractEndDate}
                onChange={(e) => setContractEndDate(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          {revenueModel === 'hardware' && (
            <div>
              <label className={labelCls}>Tahmini Donanım Maliyeti / COGS (TRY, Opsiyonel)</label>
              <input
                type="number"
                min="0"
                value={linkedCogsTry}
                onChange={(e) => setLinkedCogsTry(e.target.value)}
                placeholder="Örn: 140000"
                className={`${inputCls} font-mono tabular-nums`}
              />
            </div>
          )}

          <div>
            <label className={labelCls}>Satış / Faturalama Notları</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Özel fatura kesim koşulları, PO numarası veya yenileme notu..."
              maxLength={1000}
              className={inputCls}
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
            <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRenew}
                onChange={(e) => setAutoRenew(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-700 text-blue-600"
              />
              <span>Sözleşme bitiminde yenileme uyarısı / otomatik devam</span>
            </label>
            <div className="text-right">
              <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                Dönemlik TL Tutarı
              </span>
              <span className="text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                {formatCurrency(amountTry)}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              İptal
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
            >
              {initialSale ? 'Satışı Güncelle' : 'Kazanılmış Satışı Kaydet'}
            </button>
          </div>
        </form>
      )}
    </ModalShell>
  );
}

// 6. İade Faturası Kes Modal
interface RefundInvoiceModalProps {
  salesInvoices: EnrichedInvoice[];
  preselectedSalesInvoice?: EnrichedInvoice | null;
  bankAccounts: BankAccount[];
  exchangeRates: ExchangeRates;
  onClose: () => void;
  onSave: (
    refundData: Omit<Invoice, 'id' | 'invoiceNo' | 'invoiceType'>,
    immediatePayout?: {
      paymentDate: string;
      bankAccount: string;
      referenceNo?: string;
      note?: string;
    }
  ) => void;
}

export function RefundInvoiceModal({
  salesInvoices,
  preselectedSalesInvoice,
  bankAccounts,
  exchangeRates,
  onClose,
  onSave,
}: RefundInvoiceModalProps) {
  const eligibleSales = salesInvoices.filter((i) => !i.isDraft && i.invoiceType !== 'refund');
  const defaultOrig =
    eligibleSales.find((i) => i.id === preselectedSalesInvoice?.id) ?? eligibleSales[0];

  const [selectedSalesId, setSelectedSalesId] = useState(defaultOrig?.id ?? '');
  const orig = eligibleSales.find((i) => i.id === selectedSalesId);

  const computeSuggestedRefundAmount = (target?: EnrichedInvoice) => {
    if (!target) return '';
    const remainingRefundableTry = Math.max(0, target.amountTry - target.refundedTotalTry);
    const fx = Math.max(0.01, target.fxRateAtIssue || 1);
    const suggestedOrig =
      remainingRefundableTry > 1 ? remainingRefundableTry / fx : target.amount;
    return String(Math.round(suggestedOrig * 100) / 100);
  };

  const computeDefaultMode = (target?: EnrichedInvoice): RefundSettlementMode => {
    if (!target) return 'bank_payout';
    if (target.paidTry > 0) return 'bank_payout';
    if (target.remainingTry > 0) return 'receivable_offset';
    return 'pending_payout';
  };

  const [title, setTitle] = useState(defaultOrig ? `İade: ${defaultOrig.title}` : '');
  const [issueDate, setIssueDate] = useState(REFERENCE_TODAY);
  const [dueDate, setDueDate] = useState(REFERENCE_TODAY);
  const [currency, setCurrency] = useState<CurrencyCode>(defaultOrig?.currency ?? 'TRY');
  const [amount, setAmount] = useState(() => computeSuggestedRefundAmount(defaultOrig));
  const [fxRate, setFxRate] = useState(() => {
    if (!defaultOrig) return '1';
    if (defaultOrig.currency === 'TRY') return '1';
    return String(defaultOrig.fxRateAtIssue);
  });
  const [pnlMode, setPnlMode] = useState<'single_month' | 'spread'>('single_month');
  const [settlementMode, setSettlementMode] = useState<RefundSettlementMode>(() =>
    computeDefaultMode(defaultOrig)
  );
  const [bankAccount, setBankAccount] = useState(bankAccounts[0]?.name ?? 'Ana Kasa / Banka');
  const [paymentDate, setPaymentDate] = useState(REFERENCE_TODAY);
  const [referenceNo, setReferenceNo] = useState('');
  const [reasonNote, setReasonNote] = useState('');

  useEffect(() => {
    if (!orig) return;
    setTitle(`İade: ${orig.title}`);
    setCurrency(orig.currency);
    setFxRate(
      orig.currency === 'TRY'
        ? '1'
        : String(
            orig.fxRateAtIssue ||
              (orig.currency === 'USD' ? exchangeRates.USD : exchangeRates.EUR)
          )
    );
    setAmount(computeSuggestedRefundAmount(orig));
    setSettlementMode(computeDefaultMode(orig));
    setPnlMode('single_month');
  }, [selectedSalesId]);

  const numericAmount = parseFloat(amount) || 0;
  const numericFx = currency === 'TRY' ? 1 : parseFloat(fxRate) || 1;
  const amountTry = Math.round(numericAmount * numericFx);
  const remainingRefundableTry = orig ? Math.max(0, orig.amountTry - orig.refundedTotalTry) : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orig || !title.trim() || numericAmount <= 0 || amountTry <= 0) return;

    const useSpread = orig.revenueModel === 'annual_mrr' && pnlMode === 'spread';
    const recognitionMonths = useSpread ? Math.max(1, orig.recognitionMonths || 12) : 1;
    const recognitionStartMonth = useSpread
      ? orig.recognitionStartMonth || getMonthKey(issueDate)
      : getMonthKey(issueDate);

    onSave(
      {
        customerId: orig.customerId,
        revenueModel: orig.revenueModel,
        title: title.trim(),
        description: reasonNote.trim() || `${orig.invoiceNo} numaralı faturaya istinaden iade`,
        issueDate,
        dueDate: settlementMode === 'bank_payout' ? paymentDate : dueDate,
        recognitionStartMonth,
        recognitionMonths,
        currency,
        amount: numericAmount,
        fxRateAtIssue: numericFx,
        amountTry,
        wonSaleId: orig.wonSaleId,
        refundedInvoiceId: orig.id,
        refundSettlementMode: settlementMode,
        isDraft: false,
      },
      settlementMode === 'bank_payout'
        ? {
            paymentDate,
            bankAccount,
            referenceNo: referenceNo.trim() || undefined,
            note: reasonNote.trim() || `${orig.invoiceNo} iade ödemesi`,
          }
        : undefined
    );
    onClose();
  };

  return (
    <ModalShell
      title="İade Faturası Kes & Hesaba İşle"
      subtitle="İade faturası gelirden (P&L) düşülür; seçiminize göre banka hesabından nakit çıkışı yapılır veya açık alacaktan mahsup edilir."
      onClose={onClose}
    >
      {eligibleSales.length === 0 ? (
        <div className="py-8 text-center space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            İade faturası kesilebilecek onaylı bir satış faturası bulunmuyor.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 text-white"
          >
            Tamam
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelCls}>İade Edilecek Satış Faturası</label>
            <select
              value={selectedSalesId}
              onChange={(e) => setSelectedSalesId(e.target.value)}
              className={inputCls}
              required
            >
              {eligibleSales.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.invoiceNo} · {inv.customerName} ({formatCurrency(inv.amountTry)})
                </option>
              ))}
            </select>
          </div>

          {orig && (
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#090E1A] border border-slate-200 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="block text-[11px] text-slate-500">Fatura Tutarı</span>
                <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                  {formatCurrency(orig.amountTry)}
                </span>
              </div>
              <div>
                <span className="block text-[11px] text-slate-500">Tahsil Edilen</span>
                <span className="font-mono tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(orig.paidTry)}
                </span>
              </div>
              <div>
                <span className="block text-[11px] text-slate-500">Açık Alacak</span>
                <span className="font-mono tabular-nums font-semibold text-amber-600 dark:text-amber-400">
                  {formatCurrency(orig.remainingTry)}
                </span>
              </div>
              <div>
                <span className="block text-[11px] text-slate-500">Önceki İadeler</span>
                <span className="font-mono tabular-nums font-semibold text-rose-600 dark:text-rose-400">
                  {orig.refundedTotalTry > 0 ? `-${formatCurrency(orig.refundedTotalTry)}` : '0 ₺'}
                </span>
              </div>
            </div>
          )}

          <div>
            <label className={labelCls}>İade Fatura Başlığı</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              className={inputCls}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Para Birimi</label>
              <select
                value={currency}
                onChange={(e) => {
                  const next = e.target.value as CurrencyCode;
                  setCurrency(next);
                  if (next === 'TRY') setFxRate('1');
                  else if (next === 'USD') setFxRate(String(exchangeRates.USD));
                  else setFxRate(String(exchangeRates.EUR));
                }}
                className={inputCls}
              >
                <option value="TRY">TRY (₺)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>İade Tutarı ({currency})</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={`${inputCls} font-mono tabular-nums`}
                required
              />
            </div>
            <div>
              <label className={labelCls}>Kur (TRY)</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={fxRate}
                onChange={(e) => setFxRate(e.target.value)}
                disabled={currency === 'TRY'}
                className={`${inputCls} font-mono tabular-nums disabled:opacity-60`}
              />
            </div>
          </div>

          {orig && amountTry > remainingRefundableTry + 1 && (
            <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-[11px] text-amber-800 dark:text-amber-300">
              Dikkat: Girilen iade tutarı ({formatCurrency(amountTry)}), kalan net iade edilebilir tutardan ({formatCurrency(remainingRefundableTry)}) yüksek görünüyor.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>İade Fatura Tarihi (P&L)</label>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className={inputCls}
                required
              />
            </div>
            <div>
              <label className={labelCls}>
                {settlementMode === 'bank_payout' ? 'Nakit Çıkış Tarihi' : 'İade Ödeme Vadesi'}
              </label>
              <input
                type="date"
                value={settlementMode === 'bank_payout' ? paymentDate : dueDate}
                onChange={(e) => {
                  if (settlementMode === 'bank_payout') setPaymentDate(e.target.value);
                  else setDueDate(e.target.value);
                }}
                className={inputCls}
                required
              />
            </div>
          </div>

          {orig?.revenueModel === 'annual_mrr' && (
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#090E1A] border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="text-xs font-medium text-slate-700 dark:text-slate-200">
                Yıllık MRR Gelir Düzeltme Yöntemi (P&L)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <label className="flex items-start gap-2 p-2 rounded-md border border-slate-200 dark:border-slate-800 cursor-pointer">
                  <input
                    type="radio"
                    name="pnlMode"
                    checked={pnlMode === 'single_month'}
                    onChange={() => setPnlMode('single_month')}
                    className="mt-0.5 text-blue-600"
                  />
                  <span>
                    <strong className="block text-slate-800 dark:text-slate-200">
                      İade Ayından Tek Seferde Düş
                    </strong>
                    <span className="text-[11px] text-slate-500">
                      {getMonthKey(issueDate)} ayı P&L cirosundan düşülür.
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2 p-2 rounded-md border border-slate-200 dark:border-slate-800 cursor-pointer">
                  <input
                    type="radio"
                    name="pnlMode"
                    checked={pnlMode === 'spread'}
                    onChange={() => setPnlMode('spread')}
                    className="mt-0.5 text-blue-600"
                  />
                  <span>
                    <strong className="block text-slate-800 dark:text-slate-200">
                      {orig.recognitionMonths} Aya Yayarak Düş
                    </strong>
                    <span className="text-[11px] text-slate-500">
                      {formatDateTR(orig.issueDate)} sözleşme aylarına orantılı yansır.
                    </span>
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Hesaplara İade Giriş Şekli */}
          <div className="space-y-2">
            <label className={labelCls}>Hesaplara ve Bakiyeye İşleme Şekli</label>
            <div className="space-y-2 text-xs">
              <label
                className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                  settlementMode === 'bank_payout'
                    ? 'border-rose-500/70 bg-rose-50/50 dark:bg-rose-950/20'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <input
                  type="radio"
                  name="settlementMode"
                  checked={settlementMode === 'bank_payout'}
                  onChange={() => setSettlementMode('bank_payout')}
                  className="mt-0.5 text-rose-600"
                />
                <div>
                  <div className="font-semibold text-slate-900 dark:text-white">
                    Banka Hesabından İade Çıkışı Yap (Nakit İade)
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    İade faturası kesilir ve seçilen banka hesabından nakit iade çıkışı anında düşülür.
                  </div>
                </div>
              </label>

              <label
                className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                  settlementMode === 'receivable_offset'
                    ? 'border-blue-500/70 bg-blue-50/50 dark:bg-blue-950/20'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <input
                  type="radio"
                  name="settlementMode"
                  checked={settlementMode === 'receivable_offset'}
                  onChange={() => setSettlementMode('receivable_offset')}
                  className="mt-0.5 text-blue-600"
                />
                <div>
                  <div className="font-semibold text-slate-900 dark:text-white">
                    Açık Alacaktan Mahsup Et (Nakit Çıkışı Yok)
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Tahsil edilmemiş satış faturasının kalan alacağını iade tutarı kadar kapatır; banka bakiyesi değişmez.
                  </div>
                </div>
              </label>

              <label
                className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                  settlementMode === 'pending_payout'
                    ? 'border-amber-500/70 bg-amber-50/50 dark:bg-amber-950/20'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <input
                  type="radio"
                  name="settlementMode"
                  checked={settlementMode === 'pending_payout'}
                  onChange={() => setSettlementMode('pending_payout')}
                  className="mt-0.5 text-amber-600"
                />
                <div>
                  <div className="font-semibold text-slate-900 dark:text-white">
                    İade Faturası Kes, Ödemeyi Sonra Çık
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    İade faturası &ldquo;İade Bekliyor&rdquo; durumunda oluşur; banka çıkışı daha sonra yapılır.
                  </div>
                </div>
              </label>
            </div>
          </div>

          {settlementMode === 'bank_payout' && (
            <div className="p-3.5 rounded-lg bg-rose-50/40 dark:bg-rose-950/15 border border-rose-200 dark:border-rose-900/50 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>İade Çıkılacak Banka Hesabı</label>
                <select
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value)}
                  className={inputCls}
                >
                  {bankAccounts.length === 0 ? (
                    <option value="Ana Kasa / Banka">Ana Kasa / Banka</option>
                  ) : (
                    bankAccounts.map((b) => (
                      <option key={b.id} value={b.name}>
                        {b.name}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div>
                <label className={labelCls}>İade Dekont / Referans No</label>
                <input
                  type="text"
                  value={referenceNo}
                  onChange={(e) => setReferenceNo(e.target.value)}
                  placeholder="Örn: IADE-EFT-102"
                  className={inputCls}
                />
              </div>
            </div>
          )}

          <div>
            <label className={labelCls}>İade Sebebi / Not (Opsiyonel)</label>
            <input
              type="text"
              value={reasonNote}
              onChange={(e) => setReasonNote(e.target.value)}
              placeholder="Örn: Fazla faturalama düzeltmesi veya sözleşme iptali"
              maxLength={400}
              className={inputCls}
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
            <div>
              <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                İade Edilecek TL Tutarı
              </span>
              <span className="text-sm font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400">
                -{formatCurrency(amountTry)}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                İptal
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-medium rounded-lg bg-rose-600 hover:bg-rose-700 text-white transition-colors"
              >
                İade Faturasını Kes
              </button>
            </div>
          </div>
        </form>
      )}
    </ModalShell>
  );
}
