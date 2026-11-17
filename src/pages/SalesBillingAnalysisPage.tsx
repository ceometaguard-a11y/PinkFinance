import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock,
  Download,
  Edit3,
  Eye,
  FilePlus2,
  PauseCircle,
  PlayCircle,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  BillingCycle,
  BillingUrgency,
  EnrichedInvoice,
  PinkFinanceDatabase,
  WonSale,
  WonSaleAnalysisRow,
} from '../types/finance';
import {
  BILLING_CYCLE_LABELS,
  BILLING_URGENCY_LABELS,
  exportToCSV,
  formatCurrency,
  formatDateTR,
  REVENUE_MODEL_LABELS,
  WON_SALE_STATUS_LABELS,
} from '../utils/formatters';
import { computeWonSalesBillingAnalysis, REFERENCE_TODAY } from '../utils/financeEngine';
import { InvoiceStatusLabel } from '../components/StatusLabel';

interface SalesBillingAnalysisPageProps {
  db: PinkFinanceDatabase;
  enrichedInvoices: EnrichedInvoice[];
  onOpenNewSale: () => void;
  onOpenEditSale: (sale: WonSale) => void;
  onUpdateSaleStatus: (saleId: string, status: WonSale['status']) => void;
  onDeleteSale: (saleId: string) => void;
  onCreateInvoiceFromSale: (sale: WonSale, suggestedIssueDate?: string) => void;
  onSelectCustomer: (customerId: string) => void;
}

type UrgencyFilter =
  | 'all'
  | 'action_required'
  | 'upcoming_30d'
  | 'scheduled'
  | 'completed_or_paused';

function UrgencyLabel({ urgency }: { urgency: BillingUrgency }) {
  const styles: Record<BillingUrgency, { text: string; icon: typeof AlertTriangle }> = {
    overdue_to_bill: { text: 'text-rose-600 dark:text-rose-400', icon: AlertTriangle },
    due_today: { text: 'text-rose-600 dark:text-rose-400', icon: CalendarClock },
    renewal_attention: { text: 'text-amber-600 dark:text-amber-400', icon: AlertTriangle },
    due_soon: { text: 'text-amber-600 dark:text-amber-400', icon: Clock },
    upcoming_30d: { text: 'text-blue-600 dark:text-blue-400', icon: CalendarClock },
    scheduled: { text: 'text-slate-600 dark:text-slate-400', icon: CheckCircle2 },
    billed_complete: { text: 'text-emerald-600 dark:text-emerald-400', icon: CheckCircle2 },
    paused: { text: 'text-slate-500 dark:text-slate-500', icon: PauseCircle },
  };
  const cfg = styles[urgency];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${cfg.text}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{BILLING_URGENCY_LABELS[urgency]}</span>
    </span>
  );
}

function formatCountdownText(days: number | null, urgency: BillingUrgency): string {
  if (urgency === 'paused') return 'Duraklatıldı';
  if (urgency === 'billed_complete') return 'Tamamlandı';
  if (days === null) return '—';
  if (days < 0) return `${Math.abs(days)} gün gecikti`;
  if (days === 0) return 'Bugün kesilmeli';
  return `${days} gün kaldı`;
}

function ProjectionTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{
    name?: string;
    value?: number;
    color?: string;
    payload?: { invoiceCount?: number; totalTry?: number };
  }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const pointMeta = payload[0]?.payload;
  return (
    <div className="bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-700 rounded-lg p-3 shadow-xl text-xs">
      <div className="font-semibold text-slate-900 dark:text-white mb-1.5">
        {label} · {pointMeta?.invoiceCount ?? 0} planlı fatura
      </div>
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
              {formatCurrency(entry.value ?? 0)}
            </span>
          </div>
        ))}
        {typeof pointMeta?.totalTry === 'number' && (
          <div className="pt-1 mt-1 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 font-semibold">
            <span className="text-slate-700 dark:text-slate-200">Toplam</span>
            <span className="font-mono tabular-nums text-blue-600 dark:text-blue-400">
              {formatCurrency(pointMeta.totalTry)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function SalesBillingAnalysisPage({
  db,
  enrichedInvoices,
  onOpenNewSale,
  onOpenEditSale,
  onUpdateSaleStatus,
  onDeleteSale,
  onCreateInvoiceFromSale,
  onSelectCustomer,
}: SalesBillingAnalysisPageProps) {
  const [projectionHorizon, setProjectionHorizon] = useState<6 | 12>(6);
  const [search, setSearch] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilter>('all');
  const [cycleFilter, setCycleFilter] = useState<'all' | BillingCycle>('all');
  const [analyzedSaleId, setAnalyzedSaleId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const analysis = useMemo(
    () =>
      computeWonSalesBillingAnalysis(
        db,
        enrichedInvoices,
        REFERENCE_TODAY,
        projectionHorizon
      ),
    [db, enrichedInvoices, projectionHorizon]
  );

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return analysis.rows.filter((row) => {
      if (cycleFilter !== 'all' && row.sale.billingCycle !== cycleFilter) return false;
      if (urgencyFilter === 'action_required') {
        if (
          row.urgency !== 'overdue_to_bill' &&
          row.urgency !== 'due_today' &&
          row.urgency !== 'due_soon' &&
          row.urgency !== 'renewal_attention'
        ) {
          return false;
        }
      } else if (urgencyFilter === 'upcoming_30d') {
        if (row.urgency !== 'upcoming_30d' && row.urgency !== 'due_soon') return false;
      } else if (urgencyFilter === 'scheduled') {
        if (row.urgency !== 'scheduled') return false;
      } else if (urgencyFilter === 'completed_or_paused') {
        if (row.urgency !== 'billed_complete' && row.urgency !== 'paused') return false;
      }
      if (
        q &&
        !row.customerName.toLowerCase().includes(q) &&
        !row.sale.title.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [analysis.rows, search, urgencyFilter, cycleFilter]);

  const analyzedRow: WonSaleAnalysisRow | null = useMemo(() => {
    if (!analyzedSaleId) return null;
    return analysis.rows.find((r) => r.sale.id === analyzedSaleId) ?? null;
  }, [analysis.rows, analyzedSaleId]);

  const urgencyBuckets = useMemo(() => {
    const counts = {
      immediate: { count: 0, amount: 0 },
      soon30: { count: 0, amount: 0 },
      later: { count: 0, amount: 0 },
      closed: { count: 0, amount: 0 },
    };
    for (const r of analysis.rows) {
      if (
        r.urgency === 'overdue_to_bill' ||
        r.urgency === 'due_today' ||
        r.urgency === 'due_soon' ||
        r.urgency === 'renewal_attention'
      ) {
        counts.immediate.count += 1;
        counts.immediate.amount += r.sale.amountTry;
      } else if (r.urgency === 'upcoming_30d') {
        counts.soon30.count += 1;
        counts.soon30.amount += r.sale.amountTry;
      } else if (r.urgency === 'scheduled') {
        counts.later.count += 1;
        counts.later.amount += r.sale.amountTry;
      } else {
        counts.closed.count += 1;
        counts.closed.amount += r.sale.amountTry;
      }
    }
    return counts;
  }, [analysis.rows]);

  const handleExportCSV = () => {
    exportToCSV(
      'PinkFinance_Kazanilmis_Satislar_Fatura_Analizi',
      [
        'Müşteri',
        'Satış Başlığı',
        'Gelir Modeli',
        'Faturalama Periyodu',
        'Kazanım Tarihi',
        'Dönem Tutarı (TRY)',
        'Son Fatura Tarihi',
        'Sonraki Fatura Tarihi',
        'Fatura Durumu',
        'Kesilen Fatura Adedi',
        'Toplam Faturalanan (TRY)',
        'Müşteri Açık Alacağı (TRY)',
        'Analiz Önerisi',
      ],
      filteredRows.map((r) => [
        r.customerName,
        r.sale.title,
        REVENUE_MODEL_LABELS[r.sale.revenueModel],
        BILLING_CYCLE_LABELS[r.sale.billingCycle],
        formatDateTR(r.sale.wonDate),
        Math.round(r.sale.amountTry),
        r.lastInvoiceDate ? formatDateTR(r.lastInvoiceDate) : 'Henüz Yok',
        r.nextInvoiceDate ? formatDateTR(r.nextInvoiceDate) : '-',
        BILLING_URGENCY_LABELS[r.urgency],
        r.issuedInvoiceCount,
        Math.round(r.totalInvoicedTry),
        Math.round(r.customerOpenReceivableTry),
        r.recommendationNote,
      ])
    );
  };

  const filterTabs: { id: UrgencyFilter; label: string }[] = [
    { id: 'all', label: `Tümü (${analysis.rows.length})` },
    { id: 'action_required', label: `Kesim Zamanı (${analysis.actionRequiredCount})` },
    { id: 'upcoming_30d', label: '30 Gün İçinde' },
    { id: 'scheduled', label: 'İleri Tarihli' },
    { id: 'completed_or_paused', label: 'Kapalı / Duraklatılan' },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Executive KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Hemen Fatura Kesilecek</span>
            <span className="font-mono tabular-nums font-medium text-rose-600 dark:text-rose-400">
              {analysis.actionRequiredCount} satış
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400">
            {formatCurrency(analysis.actionRequiredAmountTry)}
          </div>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Gecikmiş, bugün kesilecek veya 7 gün içindeki işlemler
          </p>
        </div>

        <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Bu Ay Planlanan Faturalama</span>
            <span className="font-mono tabular-nums font-medium text-blue-600 dark:text-blue-400">
              {analysis.dueThisMonthCount} fatura
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {formatCurrency(analysis.dueThisMonthAmountTry)}
          </div>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            İçinde bulunduğumuz ay kesilmesi gereken toplam tutar
          </p>
        </div>

        <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Gelecek {projectionHorizon} Ay Projeksiyonu</span>
            <span className="font-mono tabular-nums text-slate-400">Planlı</span>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
            {formatCurrency(analysis.next6MonthsProjectedTry)}
          </div>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Aktif sözleşmelerden doğacak beklenen fatura hacmi
          </p>
        </div>

        <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Yıllıklandırılmış Aktif Satış</span>
            <span className="font-mono tabular-nums text-slate-400">
              {analysis.activeCount} aktif
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {formatCurrency(analysis.activeAnnualizedVolumeTry)}
          </div>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Bugüne dek faturalanan: <span className="font-mono">{formatCurrency(analysis.totalWonInvoicedTry)}</span>
          </p>
        </div>
      </div>

      {/* 2. Billing Forecast Chart & Urgency Breakdown */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Tekrar Faturalama Zaman Projeksiyonu
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Kazanılmış satışların periyotlarına göre hangi ay ne kadar fatura kesileceğini analiz edin
              </p>
            </div>
            <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#090E1A]">
              {([6, 12] as const).map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setProjectionHorizon(h)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    projectionHorizon === h
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {h} Aylık
                </button>
              ))}
            </div>
          </div>

          {analysis.rows.length === 0 ? (
            <div className="h-[260px] flex flex-col items-center justify-center text-center px-4">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Henüz analiz edilecek kazanılmış satış kaydı bulunmuyor
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md">
                Müşterilerinizden kazandığınız aylık, çeyreklik, yıllık veya tek seferlik satışları girerek
                fatura kesim takviminizi oluşturabilirsiniz.
              </p>
              <button
                type="button"
                onClick={onOpenNewSale}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>İlk Kazanılmış Satışı Ekle</span>
              </button>
            </div>
          ) : (
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={analysis.monthlyProjection}
                  margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.14)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: '#94A3B8', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#94A3B8', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) =>
                      v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)
                    }
                  />
                  <Tooltip content={<ProjectionTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar
                    dataKey="monthlyMrrTry"
                    name="Aylık MRR"
                    stackId="a"
                    fill="#3B82F6"
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey="periodicAndAnnualTry"
                    name="Yıllık / Periyodik Sözleşme"
                    stackId="a"
                    fill="#8B5CF6"
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey="oneOffAndHardwareTry"
                    name="Tek Seferlik & Donanım"
                    stackId="a"
                    fill="#10B981"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Urgency Decision Matrix Card */}
        <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Fatura Kesim Öncelik Analizi
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Listeyi filtrelemek için bir öncelik dilimine tıklayın
            </p>
          </div>

          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => setUrgencyFilter('action_required')}
              className="w-full p-3 rounded-lg bg-slate-50 dark:bg-[#090E1A] border border-slate-200 dark:border-slate-800 hover:border-rose-500/60 transition-colors flex items-center justify-between text-left"
            >
              <div>
                <div className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                  Acil / Kesim Zamanı Geldi
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Gecikmiş, bugün, 7 gün veya yenileme
                </div>
              </div>
              <div className="text-right font-mono tabular-nums">
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  {formatCurrency(urgencyBuckets.immediate.amount)}
                </div>
                <div className="text-[11px] text-slate-500">
                  {urgencyBuckets.immediate.count} satış
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setUrgencyFilter('upcoming_30d')}
              className="w-full p-3 rounded-lg bg-slate-50 dark:bg-[#090E1A] border border-slate-200 dark:border-slate-800 hover:border-blue-500/60 transition-colors flex items-center justify-between text-left"
            >
              <div>
                <div className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                  8 – 30 Gün İçinde Kesilecek
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Yaklaşan dönem faturaları
                </div>
              </div>
              <div className="text-right font-mono tabular-nums">
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  {formatCurrency(urgencyBuckets.soon30.amount)}
                </div>
                <div className="text-[11px] text-slate-500">
                  {urgencyBuckets.soon30.count} satış
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setUrgencyFilter('scheduled')}
              className="w-full p-3 rounded-lg bg-slate-50 dark:bg-[#090E1A] border border-slate-200 dark:border-slate-800 hover:border-slate-500 transition-colors flex items-center justify-between text-left"
            >
              <div>
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  30+ Gün İleri Tarihli
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Takvimi henüz gelmemiş sözleşmeler
                </div>
              </div>
              <div className="text-right font-mono tabular-nums">
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  {formatCurrency(urgencyBuckets.later.amount)}
                </div>
                <div className="text-[11px] text-slate-500">
                  {urgencyBuckets.later.count} satış
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setUrgencyFilter('completed_or_paused')}
              className="w-full p-3 rounded-lg bg-slate-50 dark:bg-[#090E1A] border border-slate-200 dark:border-slate-800 hover:border-emerald-500/60 transition-colors flex items-center justify-between text-left"
            >
              <div>
                <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  Faturalandı / Duraklatıldı
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Tamamlanan veya askıya alınan satışlar
                </div>
              </div>
              <div className="text-right font-mono tabular-nums">
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  {formatCurrency(urgencyBuckets.closed.amount)}
                </div>
                <div className="text-[11px] text-slate-500">
                  {urgencyBuckets.closed.count} satış
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Selected Sale Pre-Invoice Deep Analysis Panel */}
      {analyzedRow && (
        <div className="bg-white dark:bg-[#0F172A] border border-blue-200 dark:border-blue-800/60 rounded-xl p-5 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span>Fatura Öncesi Satış Analizi</span>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => onSelectCustomer(analyzedRow.sale.customerId)}
                  className="text-blue-600 dark:text-blue-400 font-medium hover:underline"
                >
                  {analyzedRow.customerName}
                </button>
                <span>·</span>
                <span>{BILLING_CYCLE_LABELS[analyzedRow.sale.billingCycle]}</span>
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {analyzedRow.sale.title}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                {analyzedRow.recommendationNote}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {analyzedRow.sale.status === 'active' && analyzedRow.urgency !== 'billed_complete' && (
                <button
                  type="button"
                  onClick={() =>
                    onCreateInvoiceFromSale(
                      analyzedRow.sale,
                      analyzedRow.nextInvoiceDate ?? REFERENCE_TODAY
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                >
                  <FilePlus2 className="w-3.5 h-3.5" />
                  <span>Analizi Onayla &amp; Fatura Kes</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setAnalyzedSaleId(null)}
                aria-label="Analiz panelini kapat"
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Customer Risk & Contract Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#090E1A] border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Dönem Fatura Tutarı</span>
              <div className="mt-1 text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                {formatCurrency(analyzedRow.sale.amountTry)}
              </div>
              {analyzedRow.sale.currency !== 'TRY' && (
                <span className="text-[11px] font-mono text-slate-400">
                  {formatCurrency(analyzedRow.sale.amount, analyzedRow.sale.currency)}
                </span>
              )}
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#090E1A] border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Bugüne Dek Faturalanan</span>
              <div className="mt-1 text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                {formatCurrency(analyzedRow.totalInvoicedTry)}
              </div>
              <span className="text-[11px] text-slate-400">
                {analyzedRow.issuedInvoiceCount} kesilmiş fatura
              </span>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#090E1A] border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Bu Satıştan Tahsilat</span>
              <div className="mt-1 text-sm font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatCurrency(analyzedRow.totalCollectedTry)}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#090E1A] border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Müşteri Toplam Açık Alacak</span>
              <div
                className={`mt-1 text-sm font-bold font-mono tabular-nums ${
                  analyzedRow.customerOverdueTry > 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : analyzedRow.customerOpenReceivableTry > 0
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-slate-900 dark:text-white'
                }`}
              >
                {formatCurrency(analyzedRow.customerOpenReceivableTry)}
              </div>
              <span className="text-[11px] text-slate-400">
                {analyzedRow.customerOverdueTry > 0
                  ? `Gecikmiş: ${formatCurrency(analyzedRow.customerOverdueTry)}`
                  : 'Gecikmiş alacak yok'}
              </span>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#090E1A] border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Sonraki Fatura Tarihi</span>
              <div className="mt-1 text-sm font-bold font-mono tabular-nums text-blue-600 dark:text-blue-400">
                {analyzedRow.nextInvoiceDate ? formatDateTR(analyzedRow.nextInvoiceDate) : '—'}
              </div>
              <span className="text-[11px] text-slate-400">
                {formatCountdownText(analyzedRow.daysUntilNextInvoice, analyzedRow.urgency)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Upcoming Billing Schedule */}
            <div>
              <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-2.5">
                Planlanan Gelecek Fatura Takvimi
              </h4>
              {analyzedRow.upcomingScheduleDates.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Bu satış için bekleyen ileri tarihli fatura dönemi bulunmuyor.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800/70 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden text-xs">
                  {analyzedRow.upcomingScheduleDates.map((dt, idx) => (
                    <div
                      key={`${dt}-${idx}`}
                      className="px-3.5 py-2.5 flex items-center justify-between bg-slate-50/50 dark:bg-[#090E1A]"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-slate-400">#{idx + 1}</span>
                        <span className="font-mono tabular-nums font-medium text-slate-800 dark:text-slate-200">
                          {formatDateTR(dt)}
                        </span>
                        {idx === 0 && (
                          <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                            · Sıradaki Kesim
                          </span>
                        )}
                      </div>
                      <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                        {formatCurrency(analyzedRow.sale.amountTry)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Linked Historical Invoices */}
            <div>
              <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-2.5">
                Bu Satışa Bağlı Kesilen Faturalar ({analyzedRow.linkedInvoices.length})
              </h4>
              {analyzedRow.linkedInvoices.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Bu satış için henüz sistem üzerinden fatura kesilmemiş.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800/70 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden text-xs max-h-[240px] overflow-y-auto">
                  {analyzedRow.linkedInvoices.map((inv) => (
                    <div
                      key={inv.id}
                      className="px-3.5 py-2.5 flex items-center justify-between gap-3 bg-slate-50/50 dark:bg-[#090E1A]"
                    >
                      <div>
                        <div className="font-mono text-[11px] text-slate-500">
                          {inv.invoiceNo} · {formatDateTR(inv.issueDate)}
                        </div>
                        <div className="font-medium text-slate-800 dark:text-slate-200">
                          {inv.title}
                        </div>
                      </div>
                      <div className="text-right shrink-0 space-y-0.5">
                        <div className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                          {formatCurrency(inv.amountTry)}
                        </div>
                        <InvoiceStatusLabel
                          status={inv.computedStatus}
                          daysOverdue={inv.daysOverdue}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. Filter Toolbar */}
      <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#090E1A]">
            {filterTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setUrgencyFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  urgencyFilter === tab.id
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV İndir</span>
            </button>
            <button
              type="button"
              onClick={onOpenNewSale}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Kazanılmış Satış Ekle</span>
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
              placeholder="Müşteri adı veya satış başlığı ara..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-[#090E1A] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
            />
          </div>
          <select
            value={cycleFilter}
            onChange={(e) => setCycleFilter(e.target.value as 'all' | BillingCycle)}
            className="px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-[#090E1A] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
          >
            <option value="all">Tüm Faturalama Periyotları</option>
            {Object.entries(BILLING_CYCLE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 5. Won Sales List & Billing Schedule Table */}
      <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-900/40">
                <th className="py-3 px-4">Satış &amp; Müşteri</th>
                <th className="py-3 px-4">Periyot &amp; Model</th>
                <th className="py-3 px-4 text-right">Dönem Tutarı</th>
                <th className="py-3 px-4">Fatura Geçmişi / Risk</th>
                <th className="py-3 px-4">Sonraki Fatura</th>
                <th className="py-3 px-4">Analiz Durumu</th>
                <th className="py-3 px-4 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-xs">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 dark:text-slate-400 space-y-3">
                    <p>
                      {analysis.rows.length === 0
                        ? 'Henüz kazanılmış satış kaydı girilmedi.'
                        : 'Seçili filtrelere uygun kazanılmış satış bulunamadı.'}
                    </p>
                    {analysis.rows.length === 0 && (
                      <button
                        type="button"
                        onClick={onOpenNewSale}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>İlk Kazanılmış Satışı Ekle</span>
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const isAnalyzed = analyzedSaleId === row.sale.id;
                  return (
                    <tr
                      key={row.sale.id}
                      className={`transition-colors ${
                        isAnalyzed
                          ? 'bg-blue-50/50 dark:bg-blue-950/20'
                          : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/30'
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white max-w-xs truncate">
                          {row.sale.title}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          <button
                            type="button"
                            onClick={() => onSelectCustomer(row.sale.customerId)}
                            className="font-medium text-blue-600 dark:text-blue-400 hover:underline text-left"
                          >
                            {row.customerName}
                          </button>
                          <span>·</span>
                          <span>Kazanım: {formatDateTR(row.sale.wonDate)}</span>
                          <span>·</span>
                          <span>{WON_SALE_STATUS_LABELS[row.sale.status]}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-slate-700 dark:text-slate-300">
                        <div className="font-medium">{BILLING_CYCLE_LABELS[row.sale.billingCycle]}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {REVENUE_MODEL_LABELS[row.sale.revenueModel]}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {formatCurrency(row.sale.amountTry)}
                        </div>
                        {row.sale.currency !== 'TRY' && (
                          <div className="text-[11px] text-slate-500">
                            {formatCurrency(row.sale.amount, row.sale.currency)}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-mono tabular-nums text-slate-700 dark:text-slate-300">
                          {row.issuedInvoiceCount > 0
                            ? `${row.issuedInvoiceCount} fatura · Son: ${formatDateTR(row.lastInvoiceDate ?? '')}`
                            : 'Henüz fatura kesilmedi'}
                        </div>
                        {row.customerOverdueTry > 0 ? (
                          <div className="text-[11px] text-rose-600 dark:text-rose-400 font-medium mt-0.5">
                            Müşteride gecikmiş alacak: {formatCurrency(row.customerOverdueTry)}
                          </div>
                        ) : row.customerOpenReceivableTry > 0 ? (
                          <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
                            Açık alacak: {formatCurrency(row.customerOpenReceivableTry)}
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            Toplam faturalanan: {formatCurrency(row.totalInvoicedTry)}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap font-mono tabular-nums">
                        <div className="font-medium text-slate-900 dark:text-white">
                          {row.nextInvoiceDate ? formatDateTR(row.nextInvoiceDate) : '—'}
                        </div>
                        <div
                          className={`text-[11px] ${
                            row.urgency === 'overdue_to_bill' || row.urgency === 'due_today'
                              ? 'text-rose-600 dark:text-rose-400 font-semibold'
                              : row.urgency === 'due_soon' || row.urgency === 'renewal_attention'
                              ? 'text-amber-600 dark:text-amber-400 font-medium'
                              : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {formatCountdownText(row.daysUntilNextInvoice, row.urgency)}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <UrgencyLabel urgency={row.urgency} />
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {confirmDeleteId === row.sale.id ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteSale(row.sale.id);
                                if (analyzedSaleId === row.sale.id) setAnalyzedSaleId(null);
                                setConfirmDeleteId(null);
                              }}
                              className="px-2 py-1 rounded-md text-[11px] font-medium bg-rose-600 hover:bg-rose-700 text-white"
                            >
                              Silmeyi Onayla
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1 text-[11px] font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                            >
                              İptal
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                setAnalyzedSaleId((prev) =>
                                  prev === row.sale.id ? null : row.sale.id
                                )
                              }
                              title="Fatura Öncesi Satış Analizini Aç"
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                                isAnalyzed
                                  ? 'border-blue-500 bg-blue-600/15 text-blue-600 dark:text-blue-400'
                                  : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                              }`}
                            >
                              <Eye className="w-3 h-3" />
                              <span>Analiz</span>
                            </button>

                            {row.sale.status === 'active' &&
                              row.urgency !== 'billed_complete' && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onCreateInvoiceFromSale(
                                      row.sale,
                                      row.nextInvoiceDate ?? REFERENCE_TODAY
                                    )
                                  }
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                                >
                                  <FilePlus2 className="w-3 h-3" />
                                  <span>Fatura Kes</span>
                                </button>
                              )}

                            <button
                              type="button"
                              onClick={() =>
                                onUpdateSaleStatus(
                                  row.sale.id,
                                  row.sale.status === 'paused' ? 'active' : 'paused'
                                )
                              }
                              title={
                                row.sale.status === 'paused'
                                  ? 'Satışı Aktifleştir'
                                  : 'Satışı Duraklat'
                              }
                              aria-label={
                                row.sale.status === 'paused'
                                  ? 'Satışı Aktifleştir'
                                  : 'Satışı Duraklat'
                              }
                              className="p-1.5 rounded-md text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                              {row.sale.status === 'paused' ? (
                                <PlayCircle className="w-3.5 h-3.5" />
                              ) : (
                                <PauseCircle className="w-3.5 h-3.5" />
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => onOpenEditSale(row.sale)}
                              title="Satışı Düzenle"
                              aria-label="Satışı Düzenle"
                              className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(row.sale.id)}
                              title="Satışı Sil"
                              aria-label="Satışı Sil"
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
