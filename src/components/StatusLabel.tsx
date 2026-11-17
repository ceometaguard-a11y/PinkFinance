import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileEdit,
  PieChart,
} from 'lucide-react';
import { ExpenseStatus, InvoiceStatus, RefundSettlementMode } from '../types/finance';
import { INVOICE_STATUS_LABELS } from '../utils/formatters';

interface InvoiceStatusLabelProps {
  status: InvoiceStatus;
  daysOverdue?: number;
  isRefund?: boolean;
  refundSettlementMode?: RefundSettlementMode;
}

export function InvoiceStatusLabel({
  status,
  daysOverdue,
  isRefund,
  refundSettlementMode,
}: InvoiceStatusLabelProps) {
  const styles: Record<InvoiceStatus, string> = {
    paid: 'text-emerald-600 dark:text-emerald-400',
    partial: 'text-sky-600 dark:text-sky-400',
    issued: 'text-amber-600 dark:text-amber-400',
    overdue: 'text-rose-600 dark:text-rose-400 font-medium',
    draft: 'text-slate-500 dark:text-slate-400',
  };

  const Icon =
    status === 'paid'
      ? CheckCircle2
      : status === 'overdue'
      ? AlertCircle
      : status === 'partial'
      ? PieChart
      : status === 'draft'
      ? FileEdit
      : Clock;

  const refundLabels: Record<InvoiceStatus, string> = {
    draft: 'İade Taslağı',
    paid: refundSettlementMode === 'receivable_offset' ? 'Mahsup Edildi' : 'İade Ödendi',
    partial: 'Kısmi İade',
    overdue: 'Vadesi Geçmiş İade',
    issued: 'İade Bekliyor',
  };

  const label = isRefund ? refundLabels[status] : INVOICE_STATUS_LABELS[status];

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs whitespace-nowrap ${styles[status]}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>
        {label}
        {status === 'overdue' && daysOverdue ? ` (${daysOverdue} gün)` : ''}
      </span>
    </span>
  );
}

export function ExpenseStatusLabel({ status }: { status: ExpenseStatus }) {
  if (status === 'paid') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        <span>Ödendi</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 whitespace-nowrap">
      <Clock className="w-3.5 h-3.5 shrink-0" />
      <span>Ödenecek</span>
    </span>
  );
}
