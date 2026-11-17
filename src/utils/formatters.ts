import {
  BillingCycle,
  BillingUrgency,
  CurrencyCode,
  ExpenseCategory,
  InvoiceStatus,
  InvoiceType,
  RefundSettlementMode,
  RevenueModel,
  WonSaleStatus,
} from '../types/finance';

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  cogs: 'Donanım Maliyeti (COGS)',
  personnel: 'Personel Giderleri',
  rent: 'Ofis Kira Gideri',
  office_general: 'Ofis Genel Giderleri',
  representation: 'Temsil ve Ağırlama',
  licenses: 'Lisans Giderleri',
  cloud: 'Cloud Giderleri',
  other_fixed: 'Diğer Sabit Giderler',
};

export const OPEX_CATEGORIES: Exclude<ExpenseCategory, 'cogs'>[] = [
  'personnel',
  'rent',
  'office_general',
  'representation',
  'licenses',
  'cloud',
  'other_fixed',
];

export const ALL_EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'cogs',
  ...OPEX_CATEGORIES,
];

export const REVENUE_MODEL_LABELS: Record<RevenueModel, string> = {
  monthly_mrr: 'Aylık MRR',
  annual_mrr: 'Yıllık MRR (Ertelenmiş)',
  one_off: 'Tek Seferlik Hizmet',
  hardware: 'Donanım Satışı',
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: 'Taslak',
  issued: 'Kesildi / Bekliyor',
  partial: 'Kısmi Tahsilat',
  paid: 'Tahsil Edildi',
  overdue: 'Gecikmiş',
};

export const INVOICE_TYPE_LABELS: Record<InvoiceType, string> = {
  sales: 'Satış Faturası',
  refund: 'İade Faturası',
};

export const REFUND_SETTLEMENT_LABELS: Record<RefundSettlementMode, string> = {
  bank_payout: 'Banka Hesabından İade Çıkışı',
  pending_payout: 'İade Ödemesi Bekliyor',
  receivable_offset: 'Açık Alacaktan Mahsup',
};

export const BILLING_CYCLE_LABELS: Record<BillingCycle, string> = {
  monthly: 'Aylık',
  quarterly: '3 Aylık (Çeyreklik)',
  semi_annual: '6 Aylık',
  annual: 'Yıllık',
  one_time: 'Tek Seferlik',
};

export const WON_SALE_STATUS_LABELS: Record<WonSaleStatus, string> = {
  active: 'Aktif Sözleşme',
  paused: 'Duraklatıldı',
  completed: 'Tamamlandı',
};

export const BILLING_URGENCY_LABELS: Record<BillingUrgency, string> = {
  overdue_to_bill: 'Fatura Kesimi Gecikti',
  due_today: 'Bugün Kesilmeli',
  due_soon: '7 Gün İçinde',
  upcoming_30d: '30 Gün İçinde',
  scheduled: 'Planlı (İleri Tarih)',
  renewal_attention: 'Sözleşme Yenileme',
  billed_complete: 'Faturalandı / Kapandı',
  paused: 'Duraklatıldı',
};

const TR_MONTHS = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
];

const TR_MONTHS_SHORT = [
  'Oca',
  'Şub',
  'Mar',
  'Nis',
  'May',
  'Haz',
  'Tem',
  'Ağu',
  'Eyl',
  'Eki',
  'Kas',
  'Ara',
];

export function formatCurrency(amount: number, currency: CurrencyCode = 'TRY', compact = false): string {
  const symbol = currency === 'TRY' ? '₺' : currency === 'USD' ? '$' : '€';
  if (compact && Math.abs(amount) >= 1_000_000) {
    return `${symbol}${(amount / 1_000_000).toLocaleString('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}M`;
  }
  const formatted = new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
  return currency === 'TRY' ? `${formatted} ₺` : `${symbol}${formatted}`;
}

export function formatCurrencyExact(amount: number, currency: CurrencyCode = 'TRY'): string {
  const symbol = currency === 'TRY' ? '₺' : currency === 'USD' ? '$' : '€';
  const formatted = new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return currency === 'TRY' ? `${formatted} ₺` : `${symbol}${formatted}`;
}

export function formatPercent(value: number): string {
  return `%${value.toLocaleString('tr-TR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}`;
}

export function formatDateTR(isoDate: string): string {
  if (!isoDate) return '-';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

export function getMonthKey(isoDate: string): string {
  return isoDate.slice(0, 7);
}

export function formatMonthTR(monthKey: string, short = false): string {
  const [yearStr, monthStr] = monthKey.split('-');
  const monthIdx = parseInt(monthStr, 10) - 1;
  if (Number.isNaN(monthIdx) || monthIdx < 0 || monthIdx > 11) return monthKey;
  const label = short ? TR_MONTHS_SHORT[monthIdx] : TR_MONTHS[monthIdx];
  return `${label} ${yearStr}`;
}

export function addMonths(monthKey: string, offset: number): string {
  const [yearStr, monthStr] = monthKey.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  const d = new Date(Date.UTC(year, month + offset, 1));
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function addMonthsToDate(isoDate: string, months: number): string {
  const parts = isoDate.split('-').map((n) => parseInt(n, 10));
  if (parts.length !== 3 || parts.some(Number.isNaN)) return isoDate;
  const [year, month, day] = parts;
  const targetMonthIndex = month - 1 + months;
  const firstOfTarget = new Date(Date.UTC(year, targetMonthIndex, 1));
  const targetYear = firstOfTarget.getUTCFullYear();
  const targetMonth = firstOfTarget.getUTCMonth();
  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const clampedDay = Math.min(day, daysInTargetMonth);
  return `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
}

export function getMonthRange(startMonth: string, count: number): string[] {
  return Array.from({ length: count }, (_, idx) => addMonths(startMonth, idx));
}

export function isMonthInRange(targetMonth: string, startMonth: string, durationMonths: number): boolean {
  const endMonth = addMonths(startMonth, durationMonths - 1);
  return targetMonth >= startMonth && targetMonth <= endMonth;
}

export function exportToCSV(filename: string, headers: string[], rows: (string | number)[][]): void {
  const escapeCell = (cell: string | number): string => {
    const str = String(cell ?? '');
    if (str.includes(';') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const csvContent =
    '\uFEFF' +
    [headers.map(escapeCell).join(';'), ...rows.map((r) => r.map(escapeCell).join(';'))].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
