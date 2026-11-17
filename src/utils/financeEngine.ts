import {
  BankAccountBalanceSummary,
  BillingCycle,
  BillingUrgency,
  CashFlowMonthSummary,
  CustomerBreakdownItem,
  CustomerMatrixRow,
  EnrichedInvoice,
  Expense,
  ExpenseCategory,
  InvoiceStatus,
  PinkFinanceDatabase,
  PnLStatement,
  WonSaleAnalysisRow,
  WonSalesAnalysisSummary,
  WonSalesProjectionPoint,
} from '../types/finance';
import {
  addMonths,
  addMonthsToDate,
  ALL_EXPENSE_CATEGORIES,
  formatMonthTR,
  getMonthKey,
  getMonthRange,
  isMonthInRange,
  OPEX_CATEGORIES,
} from './formatters';

export const REFERENCE_TODAY = '2026-11-17';
export const CURRENT_MONTH_KEY = '2026-11';

export function enrichInvoices(
  db: PinkFinanceDatabase,
  referenceToday: string = REFERENCE_TODAY
): EnrichedInvoice[] {
  const customerMap = new Map(db.customers.map((c) => [c.id, c.companyName]));
  const invoiceNoMap = new Map(db.invoices.map((i) => [i.id, i.invoiceNo]));

  const refundTotalsBySalesId = new Map<string, number>();
  const offsetCreditsBySalesId = new Map<string, number>();
  for (const inv of db.invoices) {
    if (inv.isDraft || inv.invoiceType !== 'refund' || !inv.refundedInvoiceId) continue;
    refundTotalsBySalesId.set(
      inv.refundedInvoiceId,
      (refundTotalsBySalesId.get(inv.refundedInvoiceId) ?? 0) + inv.amountTry
    );
    if (inv.refundSettlementMode === 'receivable_offset') {
      offsetCreditsBySalesId.set(
        inv.refundedInvoiceId,
        (offsetCreditsBySalesId.get(inv.refundedInvoiceId) ?? 0) + inv.amountTry
      );
    }
  }

  return db.invoices.map((inv) => {
    const isRefund = inv.invoiceType === 'refund';
    const invPayments = db.payments.filter((p) => p.invoiceId === inv.id);

    let paidTry = 0;
    let paidOriginal = 0;
    let remainingTry = 0;
    let remainingOriginal = 0;
    let refundedTotalTry = 0;
    let offsetCreditTry = 0;

    if (isRefund) {
      const refundPayouts = invPayments.filter((p) => p.paymentType === 'refund');
      paidTry = refundPayouts.reduce((sum, p) => sum + p.amountTry, 0);
      paidOriginal = refundPayouts.reduce((sum, p) => sum + p.amount, 0);
      if (inv.refundSettlementMode === 'receivable_offset' && !inv.isDraft) {
        remainingTry = 0;
        remainingOriginal = 0;
      } else {
        remainingTry = Math.max(0, inv.amountTry - paidTry);
        remainingOriginal = Math.max(0, inv.amount - paidOriginal);
      }
    } else {
      const collectionPayments = invPayments.filter((p) => p.paymentType !== 'refund');
      paidTry = collectionPayments.reduce((sum, p) => sum + p.amountTry, 0);
      paidOriginal = collectionPayments.reduce((sum, p) => sum + p.amount, 0);
      refundedTotalTry = inv.isDraft ? 0 : (refundTotalsBySalesId.get(inv.id) ?? 0);
      offsetCreditTry = inv.isDraft ? 0 : (offsetCreditsBySalesId.get(inv.id) ?? 0);
      remainingTry = Math.max(0, inv.amountTry - paidTry - offsetCreditTry);
      const offsetOriginal = inv.fxRateAtIssue > 0 ? offsetCreditTry / inv.fxRateAtIssue : 0;
      remainingOriginal = Math.max(0, inv.amount - paidOriginal - offsetOriginal);
    }

    let computedStatus: InvoiceStatus = 'issued';
    let daysOverdue = 0;

    if (inv.isDraft) {
      computedStatus = 'draft';
    } else if (remainingTry <= 1) {
      computedStatus = 'paid';
    } else {
      const dueMs = new Date(`${inv.dueDate}T00:00:00Z`).getTime();
      const todayMs = new Date(`${referenceToday}T00:00:00Z`).getTime();
      const diffDays = Math.floor((todayMs - dueMs) / (1000 * 60 * 60 * 24));
      if (diffDays > 0) {
        computedStatus = 'overdue';
        daysOverdue = diffDays;
      } else if (paidTry > 0 || offsetCreditTry > 0) {
        computedStatus = 'partial';
      } else {
        computedStatus = 'issued';
      }
    }

    return {
      ...inv,
      customerName: customerMap.get(inv.customerId) ?? 'Bilinmeyen Müşteri',
      paidTry,
      remainingTry,
      paidOriginal,
      remainingOriginal,
      computedStatus,
      daysOverdue,
      refundedTotalTry,
      offsetCreditTry,
      refundedFromInvoiceNo: inv.refundedInvoiceId
        ? invoiceNoMap.get(inv.refundedInvoiceId)
        : undefined,
    };
  });
}

export function computeMonthlyPnL(db: PinkFinanceDatabase, monthKey: string): PnLStatement {
  const customerMap = new Map(db.customers.map((c) => [c.id, c.companyName]));

  const monthlyMrrMap = new Map<string, CustomerBreakdownItem>();
  const annualMrrMap = new Map<string, CustomerBreakdownItem>();
  const oneOffMap = new Map<string, CustomerBreakdownItem>();
  const hardwareMap = new Map<string, CustomerBreakdownItem>();

  const addToMap = (
    map: Map<string, CustomerBreakdownItem>,
    customerId: string,
    amountTry: number,
    detailLabel?: string
  ) => {
    const prev = map.get(customerId);
    const customerName = customerMap.get(customerId) ?? 'Bilinmeyen Müşteri';
    if (prev) {
      prev.amountTry += amountTry;
      if (detailLabel && prev.detailLabel && !prev.detailLabel.includes(detailLabel)) {
        prev.detailLabel = `${prev.detailLabel}, ${detailLabel}`;
      }
    } else {
      map.set(customerId, { customerId, customerName, amountTry, detailLabel });
    }
  };

  for (const inv of db.invoices) {
    if (inv.isDraft) continue;

    const invMonth = getMonthKey(inv.issueDate);
    const isRefund = inv.invoiceType === 'refund';
    const sign = isRefund ? -1 : 1;
    const signedAmount = sign * inv.amountTry;

    if (inv.revenueModel === 'monthly_mrr') {
      if (invMonth === monthKey) {
        addToMap(
          monthlyMrrMap,
          inv.customerId,
          signedAmount,
          isRefund ? `${inv.invoiceNo} (İade)` : inv.invoiceNo
        );
      }
    } else if (inv.revenueModel === 'annual_mrr') {
      const startMonth = inv.recognitionStartMonth || invMonth;
      const duration = Math.max(1, inv.recognitionMonths || 12);
      if (isMonthInRange(monthKey, startMonth, duration)) {
        const monthlyPortion = signedAmount / duration;
        addToMap(
          annualMrrMap,
          inv.customerId,
          monthlyPortion,
          isRefund
            ? `${inv.invoiceNo} (İade · ${formatMonthTR(startMonth, true)} başl. 1/${duration})`
            : `${inv.invoiceNo} (${formatMonthTR(startMonth, true)} başl. 1/${duration})`
        );
      }
    } else if (inv.revenueModel === 'one_off') {
      if (invMonth === monthKey) {
        addToMap(
          oneOffMap,
          inv.customerId,
          signedAmount,
          isRefund ? `${inv.title} (İade)` : inv.title
        );
      }
    } else if (inv.revenueModel === 'hardware') {
      if (invMonth === monthKey) {
        addToMap(
          hardwareMap,
          inv.customerId,
          signedAmount,
          isRefund ? `${inv.title} (İade)` : inv.title
        );
      }
    }
  }

  const sortDesc = (arr: CustomerBreakdownItem[]) => arr.sort((a, b) => b.amountTry - a.amountTry);

  const monthlyMrrBreakdown = sortDesc(Array.from(monthlyMrrMap.values()));
  const annualMrrBreakdown = sortDesc(Array.from(annualMrrMap.values()));
  const oneOffBreakdown = sortDesc(Array.from(oneOffMap.values()));
  const hardwareBreakdown = sortDesc(Array.from(hardwareMap.values()));

  const monthlyMrr = monthlyMrrBreakdown.reduce((s, i) => s + i.amountTry, 0);
  const annualMrrRecognized = annualMrrBreakdown.reduce((s, i) => s + i.amountTry, 0);
  const oneOff = oneOffBreakdown.reduce((s, i) => s + i.amountTry, 0);
  const hardware = hardwareBreakdown.reduce((s, i) => s + i.amountTry, 0);
  const totalRevenue = monthlyMrr + annualMrrRecognized + oneOff + hardware;

  const monthExpenses = db.expenses.filter((e) => getMonthKey(e.expenseDate) === monthKey);
  const cogsItems = monthExpenses.filter((e) => e.category === 'cogs');
  const cogs = cogsItems.reduce((s, e) => s + e.amountTry, 0);

  const grossProfit = totalRevenue - cogs;
  const grossMarginPct = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  const opexByCategory = {} as Record<Exclude<ExpenseCategory, 'cogs'>, number>;
  const opexItemsByCategory = {} as Record<Exclude<ExpenseCategory, 'cogs'>, Expense[]>;

  for (const cat of OPEX_CATEGORIES) {
    const items = monthExpenses.filter((e) => e.category === cat);
    opexItemsByCategory[cat] = items;
    opexByCategory[cat] = items.reduce((s, e) => s + e.amountTry, 0);
  }

  const totalOpex = OPEX_CATEGORIES.reduce((s, cat) => s + opexByCategory[cat], 0);
  const netIncome = grossProfit - totalOpex;
  const netMarginPct = totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0;

  return {
    monthKey,
    monthlyMrr,
    monthlyMrrBreakdown,
    annualMrrRecognized,
    annualMrrBreakdown,
    oneOff,
    oneOffBreakdown,
    hardware,
    hardwareBreakdown,
    totalRevenue,
    cogs,
    cogsItems,
    grossProfit,
    grossMarginPct,
    opexByCategory,
    opexItemsByCategory,
    totalOpex,
    netIncome,
    netMarginPct,
  };
}

export function computeCustomerMatrix(
  db: PinkFinanceDatabase,
  activeMonthKey: string = CURRENT_MONTH_KEY
): CustomerMatrixRow[] {
  const enriched = enrichInvoices(db);

  const rows: CustomerMatrixRow[] = db.customers.map((customer) => {
    const custInvoices = enriched.filter((i) => i.customerId === customer.id && !i.isDraft);
    const signedAmt = (i: EnrichedInvoice) => (i.invoiceType === 'refund' ? -i.amountTry : i.amountTry);

    // Active Monthly MRR: net sum of monthly_mrr invoices (sales - refunds) in activeMonthKey
    const activeMonthMrrInvoices = custInvoices.filter(
      (i) => i.revenueModel === 'monthly_mrr' && getMonthKey(i.issueDate) === activeMonthKey
    );
    const activeMonthlyMrr = activeMonthMrrInvoices.reduce((s, i) => s + signedAmt(i), 0);

    // Active Annual contracts covering activeMonthKey
    const activeAnnualInvoices = custInvoices.filter((i) => {
      if (i.revenueModel !== 'annual_mrr') return false;
      const start = i.recognitionStartMonth || getMonthKey(i.issueDate);
      return isMonthInRange(activeMonthKey, start, Math.max(1, i.recognitionMonths || 12));
    });
    const annualMrrMonthlyContribution = activeAnnualInvoices.reduce(
      (s, i) => s + signedAmt(i) / Math.max(1, i.recognitionMonths || 12),
      0
    );
    const annualMrrTotalContract = custInvoices
      .filter((i) => i.revenueModel === 'annual_mrr')
      .reduce((s, i) => s + signedAmt(i), 0);

    const oneOffTotal = custInvoices
      .filter((i) => i.revenueModel === 'one_off')
      .reduce((s, i) => s + signedAmt(i), 0);

    const hardwareTotal = custInvoices
      .filter((i) => i.revenueModel === 'hardware')
      .reduce((s, i) => s + signedAmt(i), 0);

    const monthlyMrrTotalAll = custInvoices
      .filter((i) => i.revenueModel === 'monthly_mrr')
      .reduce((s, i) => s + signedAmt(i), 0);

    const totalBilledTry = custInvoices.reduce((s, i) => s + signedAmt(i), 0);
    const totalRecognizedRevenue = monthlyMrrTotalAll + annualMrrTotalContract + oneOffTotal + hardwareTotal;

    const custPayments = db.payments.filter((p) => p.customerId === customer.id);
    const collectedTry = custPayments.reduce(
      (s, p) => s + (p.paymentType === 'refund' ? -p.amountTry : p.amountTry),
      0
    );
    const salesInvoices = custInvoices.filter((i) => i.invoiceType !== 'refund');
    const receivableTry = salesInvoices.reduce((s, i) => s + i.remainingTry, 0);
    const overdueTry = salesInvoices
      .filter((i) => i.computedStatus === 'overdue')
      .reduce((s, i) => s + i.remainingTry, 0);

    return {
      customer,
      activeMonthlyMrr,
      annualMrrMonthlyContribution,
      annualMrrTotalContract,
      oneOffTotal,
      hardwareTotal,
      totalRecognizedRevenue,
      totalBilledTry,
      revenueSharePct: 0,
      concentrationWarning: false,
      collectedTry,
      receivableTry,
      overdueTry,
      invoiceCount: custInvoices.length,
    };
  });

  const grandTotalRevenue = rows.reduce((s, r) => s + r.totalBilledTry, 0);

  return rows
    .map((r) => {
      const share = grandTotalRevenue > 0 ? Math.max(0, (r.totalBilledTry / grandTotalRevenue) * 100) : 0;
      return {
        ...r,
        revenueSharePct: share,
        concentrationWarning: share >= 35,
      };
    })
    .sort((a, b) => b.totalBilledTry - a.totalBilledTry);
}

export function computeMonthlyCashFlow(
  db: PinkFinanceDatabase,
  monthKey: string
): CashFlowMonthSummary {
  const customerMap = new Map(db.customers.map((c) => [c.id, c.companyName]));

  const baseOpeningTry = db.bankAccounts.reduce((s, b) => s + b.openingBalanceTry, 0);

  // Accumulate all cash events strictly BEFORE monthKey
  const priorCollections = db.payments
    .filter((p) => p.paymentType !== 'refund' && getMonthKey(p.paymentDate) < monthKey)
    .reduce((s, p) => s + p.amountTry, 0);

  const priorRefunds = db.payments
    .filter((p) => p.paymentType === 'refund' && getMonthKey(p.paymentDate) < monthKey)
    .reduce((s, p) => s + p.amountTry, 0);

  const priorPaidExpenses = db.expenses
    .filter((e) => e.status === 'paid' && getMonthKey(e.paymentDate || e.expenseDate) < monthKey)
    .reduce((s, e) => s + e.amountTry, 0);

  const openingCashTry = baseOpeningTry + priorCollections - priorRefunds - priorPaidExpenses;

  const groupPaymentsByCustomer = (list: typeof db.payments): CustomerBreakdownItem[] => {
    const map = new Map<string, CustomerBreakdownItem>();
    for (const p of list) {
      const prev = map.get(p.customerId);
      const customerName = customerMap.get(p.customerId) ?? 'Bilinmeyen Müşteri';
      if (prev) {
        prev.amountTry += p.amountTry;
      } else {
        map.set(p.customerId, {
          customerId: p.customerId,
          customerName,
          amountTry: p.amountTry,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.amountTry - a.amountTry);
  };

  // Collections IN monthKey
  const monthCollections = db.payments.filter(
    (p) => p.paymentType !== 'refund' && getMonthKey(p.paymentDate) === monthKey
  );
  const collectionsByCustomer = groupPaymentsByCustomer(monthCollections);
  const totalCollectionsTry = monthCollections.reduce((s, p) => s + p.amountTry, 0);

  // Refunds IN monthKey
  const monthRefunds = db.payments.filter(
    (p) => p.paymentType === 'refund' && getMonthKey(p.paymentDate) === monthKey
  );
  const refundsByCustomer = groupPaymentsByCustomer(monthRefunds);
  const totalRefundsTry = monthRefunds.reduce((s, p) => s + p.amountTry, 0);

  // Paid Expenses IN monthKey
  const monthPaidExpenses = db.expenses.filter(
    (e) => e.status === 'paid' && getMonthKey(e.paymentDate || e.expenseDate) === monthKey
  );

  const paidExpensesByCategory: Record<ExpenseCategory, number> = {
    cogs: 0,
    personnel: 0,
    rent: 0,
    office_general: 0,
    representation: 0,
    licenses: 0,
    cloud: 0,
    other_fixed: 0,
  };

  for (const e of monthPaidExpenses) {
    paidExpensesByCategory[e.category] += e.amountTry;
  }

  const totalPaidExpensesTry = monthPaidExpenses.reduce((s, e) => s + e.amountTry, 0);
  const netCashChangeTry = totalCollectionsTry - totalRefundsTry - totalPaidExpensesTry;
  const closingCashTry = openingCashTry + netCashChangeTry;

  const pendingPayablesTry = db.expenses
    .filter((e) => e.status === 'pending' && getMonthKey(e.expenseDate) <= monthKey)
    .reduce((s, e) => s + e.amountTry, 0);

  return {
    monthKey,
    openingCashTry,
    totalCollectionsTry,
    collectionsByCustomer,
    totalRefundsTry,
    refundsByCustomer,
    totalPaidExpensesTry,
    paidExpensesByCategory,
    netCashChangeTry,
    closingCashTry,
    pendingPayablesTry,
  };
}

export function computeCurrentTotalCash(db: PinkFinanceDatabase): number {
  const baseOpeningTry = db.bankAccounts.reduce((s, b) => s + b.openingBalanceTry, 0);
  const allCollections = db.payments
    .filter((p) => p.paymentType !== 'refund')
    .reduce((s, p) => s + p.amountTry, 0);
  const allRefunds = db.payments
    .filter((p) => p.paymentType === 'refund')
    .reduce((s, p) => s + p.amountTry, 0);
  const allPaidExpenses = db.expenses
    .filter((e) => e.status === 'paid')
    .reduce((s, e) => s + e.amountTry, 0);
  return baseOpeningTry + allCollections - allRefunds - allPaidExpenses;
}

export function computeBankAccountBalances(db: PinkFinanceDatabase): BankAccountBalanceSummary[] {
  return db.bankAccounts.map((acc) => {
    const collectionsTry = db.payments
      .filter((p) => p.paymentType !== 'refund' && p.bankAccount === acc.name)
      .reduce((s, p) => s + p.amountTry, 0);
    const refundsTry = db.payments
      .filter((p) => p.paymentType === 'refund' && p.bankAccount === acc.name)
      .reduce((s, p) => s + p.amountTry, 0);
    const paidExpensesTry = db.expenses
      .filter((e) => e.status === 'paid' && e.bankAccount === acc.name)
      .reduce((s, e) => s + e.amountTry, 0);
    const currentBalanceTry = acc.openingBalanceTry + collectionsTry - refundsTry - paidExpensesTry;

    return {
      account: acc,
      openingBalanceTry: acc.openingBalanceTry,
      collectionsTry,
      refundsTry,
      paidExpensesTry,
      currentBalanceTry,
    };
  });
}

export function getLastNMonths(endMonthKey: string, count: number): string[] {
  const months: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    months.push(addMonths(endMonthKey, -i));
  }
  return months;
}

export interface CollectionForecastPoint {
  monthKey: string;
  monthLabel: string;
  expectedOnTimeTry: number;
  overdueInMonthTry: number;
  totalExpectedTry: number;
  invoiceCount: number;
}

export function computeCollectionForecast(
  enrichedInvoices: EnrichedInvoice[],
  startMonthKey: string,
  monthsCount = 3
): CollectionForecastPoint[] {
  const months = getMonthRange(startMonthKey, monthsCount);
  return months.map((mKey) => {
    const matching = enrichedInvoices.filter(
      (inv) =>
        !inv.isDraft &&
        inv.invoiceType !== 'refund' &&
        inv.remainingTry > 1 &&
        getMonthKey(inv.dueDate) === mKey
    );
    const expectedOnTimeTry = matching
      .filter((i) => i.computedStatus !== 'overdue')
      .reduce((s, i) => s + i.remainingTry, 0);
    const overdueInMonthTry = matching
      .filter((i) => i.computedStatus === 'overdue')
      .reduce((s, i) => s + i.remainingTry, 0);

    return {
      monthKey: mKey,
      monthLabel: formatMonthTR(mKey, true),
      expectedOnTimeTry: Math.round(expectedOnTimeTry),
      overdueInMonthTry: Math.round(overdueInMonthTry),
      totalExpectedTry: Math.round(expectedOnTimeTry + overdueInMonthTry),
      invoiceCount: matching.length,
    };
  });
}

export interface AnnualMonthPoint {
  monthKey: string;
  monthIndex: number;
  shortLabel: string;
  fullLabel: string;
  pnl: PnLStatement;
  cashFlow: CashFlowMonthSummary;
  totalMrr: number;
  totalExpense: number;
  billedTry: number;
  dueTry: number;
  cumulativeRevenue: number;
  cumulativeExpenses: number;
  cumulativeNetIncome: number;
  cumulativeCollections: number;
  cumulativePaidExpenses: number;
}

export interface AnnualQuarterSummary {
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  label: string;
  revenue: number;
  cogs: number;
  opex: number;
  totalExpense: number;
  grossProfit: number;
  netIncome: number;
  netMarginPct: number;
  collections: number;
  paidExpenses: number;
  netCashChange: number;
}

export interface AnnualExpenseCategorySummary {
  category: ExpenseCategory;
  accrualTry: number;
  paidTry: number;
  sharePct: number;
  count: number;
}

export interface AnnualCustomerSummary {
  customerId: string;
  companyName: string;
  billedTry: number;
  recognizedTry: number;
  collectedTry: number;
  openReceivableTry: number;
  sharePct: number;
  invoiceCount: number;
}

export interface AnnualAnalyticsData {
  year: string;
  months: AnnualMonthPoint[];
  quarters: AnnualQuarterSummary[];
  totals: {
    monthlyMrr: number;
    annualMrrRecognized: number;
    oneOff: number;
    hardware: number;
    totalRevenue: number;
    totalBilled: number;
    totalDueInYear: number;
    cogs: number;
    grossProfit: number;
    grossMarginPct: number;
    opexByCategory: Record<Exclude<ExpenseCategory, 'cogs'>, number>;
    totalOpex: number;
    totalExpenses: number;
    netIncome: number;
    netMarginPct: number;
    totalCollections: number;
    totalPaidExpenses: number;
    netCashChange: number;
    openingCashStartOfYear: number;
    closingCashEndOfYear: number;
    avgMonthlyRevenue: number;
    avgMonthlyExpense: number;
    collectionRatioPct: number;
    mrrDecRunRate: number;
    mrrArrRunRate: number;
    mrrGrowthPct: number;
    profitableMonths: number;
    deferredBacklogAfterYear: number;
    openReceivablesFromYear: number;
  };
  bestMonth: AnnualMonthPoint | null;
  worstMonth: AnnualMonthPoint | null;
  peakRevenueMonth: AnnualMonthPoint | null;
  expenseCategories: AnnualExpenseCategorySummary[];
  customers: AnnualCustomerSummary[];
  hasAnyData: boolean;
}

const SHORT_TR_MONTHS_ONLY = [
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

export function computeAnnualAnalytics(
  db: PinkFinanceDatabase,
  enrichedInvoices: EnrichedInvoice[],
  year: string
): AnnualAnalyticsData {
  const monthKeys = Array.from({ length: 12 }, (_, idx) => {
    const m = String(idx + 1).padStart(2, '0');
    return `${year}-${m}`;
  });

  let cumulativeRevenue = 0;
  let cumulativeExpenses = 0;
  let cumulativeNetIncome = 0;
  let cumulativeCollections = 0;
  let cumulativePaidExpenses = 0;

  const months: AnnualMonthPoint[] = monthKeys.map((monthKey, idx) => {
    const pnl = computeMonthlyPnL(db, monthKey);
    const cashFlow = computeMonthlyCashFlow(db, monthKey);
    const totalMrr = pnl.monthlyMrr + pnl.annualMrrRecognized;
    const totalExpense = pnl.cogs + pnl.totalOpex;

    const billedTry = db.invoices
      .filter((i) => !i.isDraft && getMonthKey(i.issueDate) === monthKey)
      .reduce((s, i) => s + (i.invoiceType === 'refund' ? -i.amountTry : i.amountTry), 0);

    const dueTry = db.invoices
      .filter((i) => !i.isDraft && i.invoiceType !== 'refund' && getMonthKey(i.dueDate) === monthKey)
      .reduce((s, i) => s + i.amountTry, 0);

    cumulativeRevenue += pnl.totalRevenue;
    cumulativeExpenses += totalExpense;
    cumulativeNetIncome += pnl.netIncome;
    cumulativeCollections += cashFlow.totalCollectionsTry;
    cumulativePaidExpenses += cashFlow.totalPaidExpensesTry;

    return {
      monthKey,
      monthIndex: idx,
      shortLabel: SHORT_TR_MONTHS_ONLY[idx],
      fullLabel: formatMonthTR(monthKey),
      pnl,
      cashFlow,
      totalMrr,
      totalExpense,
      billedTry,
      dueTry,
      cumulativeRevenue,
      cumulativeExpenses,
      cumulativeNetIncome,
      cumulativeCollections,
      cumulativePaidExpenses,
    };
  });

  const opexByCategory = {} as Record<Exclude<ExpenseCategory, 'cogs'>, number>;
  for (const cat of OPEX_CATEGORIES) {
    opexByCategory[cat] = months.reduce((s, m) => s + m.pnl.opexByCategory[cat], 0);
  }

  const monthlyMrr = months.reduce((s, m) => s + m.pnl.monthlyMrr, 0);
  const annualMrrRecognized = months.reduce((s, m) => s + m.pnl.annualMrrRecognized, 0);
  const oneOff = months.reduce((s, m) => s + m.pnl.oneOff, 0);
  const hardware = months.reduce((s, m) => s + m.pnl.hardware, 0);
  const totalRevenue = months.reduce((s, m) => s + m.pnl.totalRevenue, 0);
  const totalBilled = months.reduce((s, m) => s + m.billedTry, 0);
  const totalDueInYear = months.reduce((s, m) => s + m.dueTry, 0);
  const cogs = months.reduce((s, m) => s + m.pnl.cogs, 0);
  const grossProfit = totalRevenue - cogs;
  const grossMarginPct = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
  const totalOpex = OPEX_CATEGORIES.reduce((s, cat) => s + opexByCategory[cat], 0);
  const totalExpenses = cogs + totalOpex;
  const netIncome = grossProfit - totalOpex;
  const netMarginPct = totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0;

  const totalCollections = months.reduce((s, m) => s + m.cashFlow.totalCollectionsTry, 0);
  const totalPaidExpenses = months.reduce((s, m) => s + m.cashFlow.totalPaidExpensesTry, 0);
  const netCashChange = totalCollections - totalPaidExpenses;
  const openingCashStartOfYear = months[0]?.cashFlow.openingCashTry ?? 0;
  const closingCashEndOfYear = months[11]?.cashFlow.closingCashTry ?? openingCashStartOfYear;

  const avgMonthlyRevenue = totalRevenue / 12;
  const avgMonthlyExpense = totalExpenses / 12;
  const collectionRatioPct = totalBilled > 0 ? (totalCollections / totalBilled) * 100 : 0;

  // MRR run rate & growth within year
  const activeMrrMonths = months.filter((m) => m.totalMrr > 0);
  const mrrDecRunRate =
    months[11].totalMrr > 0
      ? months[11].totalMrr
      : activeMrrMonths.length > 0
        ? activeMrrMonths[activeMrrMonths.length - 1].totalMrr
        : 0;
  const mrrArrRunRate = mrrDecRunRate * 12;
  const firstMrr = activeMrrMonths.length > 0 ? activeMrrMonths[0].totalMrr : 0;
  const mrrGrowthPct =
    activeMrrMonths.length >= 2 && firstMrr > 0
      ? ((activeMrrMonths[activeMrrMonths.length - 1].totalMrr - firstMrr) / firstMrr) * 100
      : 0;

  const profitableMonths = months.filter((m) => m.pnl.netIncome > 0).length;

  // Deferred revenue remaining after Dec of selected year
  const yearEndMonthKey = `${year}-12`;
  const deferredBacklogAfterYear = db.invoices
    .filter((inv) => !inv.isDraft && inv.revenueModel === 'annual_mrr')
    .reduce((sum, inv) => {
      const sign = inv.invoiceType === 'refund' ? -1 : 1;
      const start = inv.recognitionStartMonth || getMonthKey(inv.issueDate);
      const duration = Math.max(1, inv.recognitionMonths || 12);
      const monthlyShare = (sign * inv.amountTry) / duration;
      let futureMonthsCount = 0;
      for (let i = 0; i < duration; i++) {
        const mk = addMonths(start, i);
        if (mk > yearEndMonthKey && start <= yearEndMonthKey) {
          futureMonthsCount += 1;
        }
      }
      return sum + monthlyShare * futureMonthsCount;
    }, 0);

  const openReceivablesFromYear = enrichedInvoices
    .filter(
      (i) =>
        !i.isDraft &&
        i.invoiceType !== 'refund' &&
        i.issueDate.startsWith(`${year}-`) &&
        i.remainingTry > 1
    )
    .reduce((s, i) => s + i.remainingTry, 0);

  // Quarters
  const quarterMeta: { quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4'; label: string; startIdx: number }[] = [
    { quarter: 'Q1', label: '1. Çeyrek (Oca–Mar)', startIdx: 0 },
    { quarter: 'Q2', label: '2. Çeyrek (Nis–Haz)', startIdx: 3 },
    { quarter: 'Q3', label: '3. Çeyrek (Tem–Eyl)', startIdx: 6 },
    { quarter: 'Q4', label: '4. Çeyrek (Eki–Ara)', startIdx: 9 },
  ];

  const quarters: AnnualQuarterSummary[] = quarterMeta.map(({ quarter, label, startIdx }) => {
    const slice = months.slice(startIdx, startIdx + 3);
    const revenue = slice.reduce((s, m) => s + m.pnl.totalRevenue, 0);
    const qCogs = slice.reduce((s, m) => s + m.pnl.cogs, 0);
    const qOpex = slice.reduce((s, m) => s + m.pnl.totalOpex, 0);
    const qGross = revenue - qCogs;
    const qNet = qGross - qOpex;
    const qCollections = slice.reduce((s, m) => s + m.cashFlow.totalCollectionsTry, 0);
    const qPaid = slice.reduce((s, m) => s + m.cashFlow.totalPaidExpensesTry, 0);
    return {
      quarter,
      label,
      revenue,
      cogs: qCogs,
      opex: qOpex,
      totalExpense: qCogs + qOpex,
      grossProfit: qGross,
      netIncome: qNet,
      netMarginPct: revenue > 0 ? (qNet / revenue) * 100 : 0,
      collections: qCollections,
      paidExpenses: qPaid,
      netCashChange: qCollections - qPaid,
    };
  });

  // Best / Worst / Peak Revenue Month (among months with any activity, or all 12)
  const activeMonths = months.filter(
    (m) => m.pnl.totalRevenue > 0 || m.totalExpense > 0 || m.cashFlow.totalCollectionsTry > 0
  );
  const pool = activeMonths.length > 0 ? activeMonths : months;
  const bestMonth =
    pool.length > 0
      ? pool.reduce((best, cur) => (cur.pnl.netIncome > best.pnl.netIncome ? cur : best), pool[0])
      : null;
  const worstMonth =
    pool.length > 0
      ? pool.reduce((worst, cur) => (cur.pnl.netIncome < worst.pnl.netIncome ? cur : worst), pool[0])
      : null;
  const peakRevenueMonth =
    pool.length > 0
      ? pool.reduce(
          (peak, cur) => (cur.pnl.totalRevenue > peak.pnl.totalRevenue ? cur : peak),
          pool[0]
        )
      : null;

  // Expense categories summary
  const yearExpensesAccrual = db.expenses.filter((e) => e.expenseDate.startsWith(`${year}-`));
  const yearExpensesPaid = db.expenses.filter(
    (e) => e.status === 'paid' && (e.paymentDate || e.expenseDate).startsWith(`${year}-`)
  );
  const expenseCategories: AnnualExpenseCategorySummary[] = ALL_EXPENSE_CATEGORIES.map((cat) => {
    const accrualItems = yearExpensesAccrual.filter((e) => e.category === cat);
    const accrualTry = accrualItems.reduce((s, e) => s + e.amountTry, 0);
    const paidTry = yearExpensesPaid
      .filter((e) => e.category === cat)
      .reduce((s, e) => s + e.amountTry, 0);
    return {
      category: cat,
      accrualTry,
      paidTry,
      sharePct: totalExpenses > 0 ? (accrualTry / totalExpenses) * 100 : 0,
      count: accrualItems.length,
    };
  }).sort((a, b) => b.accrualTry - a.accrualTry);

  // Customer performance in year
  const customerMap = new Map<string, AnnualCustomerSummary>();
  for (const cust of db.customers) {
    customerMap.set(cust.id, {
      customerId: cust.id,
      companyName: cust.companyName,
      billedTry: 0,
      recognizedTry: 0,
      collectedTry: 0,
      openReceivableTry: 0,
      sharePct: 0,
      invoiceCount: 0,
    });
  }

  for (const inv of enrichedInvoices) {
    if (inv.isDraft) continue;
    const entry = customerMap.get(inv.customerId) ?? {
      customerId: inv.customerId,
      companyName: inv.customerName,
      billedTry: 0,
      recognizedTry: 0,
      collectedTry: 0,
      openReceivableTry: 0,
      sharePct: 0,
      invoiceCount: 0,
    };
    if (inv.issueDate.startsWith(`${year}-`)) {
      entry.billedTry += inv.invoiceType === 'refund' ? -inv.amountTry : inv.amountTry;
      if (inv.invoiceType !== 'refund') {
        entry.openReceivableTry += inv.remainingTry;
      }
      entry.invoiceCount += 1;
    }
    customerMap.set(inv.customerId, entry);
  }

  // Add recognized revenue per customer across the 12 months of the year
  for (const m of months) {
    const allBreakdowns = [
      ...m.pnl.monthlyMrrBreakdown,
      ...m.pnl.annualMrrBreakdown,
      ...m.pnl.oneOffBreakdown,
      ...m.pnl.hardwareBreakdown,
    ];
    for (const item of allBreakdowns) {
      const entry = customerMap.get(item.customerId) ?? {
        customerId: item.customerId,
        companyName: item.customerName,
        billedTry: 0,
        recognizedTry: 0,
        collectedTry: 0,
        openReceivableTry: 0,
        sharePct: 0,
        invoiceCount: 0,
      };
      entry.recognizedTry += item.amountTry;
      customerMap.set(item.customerId, entry);
    }
  }

  // Add net collections (collections minus refunds) received in the year per customer
  for (const pay of db.payments) {
    if (!pay.paymentDate.startsWith(`${year}-`)) continue;
    const entry = customerMap.get(pay.customerId);
    if (entry) {
      entry.collectedTry += pay.paymentType === 'refund' ? -pay.amountTry : pay.amountTry;
    }
  }

  const customers = Array.from(customerMap.values())
    .filter(
      (c) => c.billedTry > 0 || c.recognizedTry > 0 || c.collectedTry > 0 || c.openReceivableTry > 0
    )
    .map((c) => ({
      ...c,
      sharePct: totalRevenue > 0 ? (c.recognizedTry / totalRevenue) * 100 : 0,
    }))
    .sort((a, b) => b.recognizedTry - a.recognizedTry || b.billedTry - a.billedTry);

  const hasAnyData =
    totalRevenue > 0 ||
    totalExpenses > 0 ||
    totalBilled > 0 ||
    totalCollections > 0 ||
    totalPaidExpenses > 0;

  return {
    year,
    months,
    quarters,
    totals: {
      monthlyMrr,
      annualMrrRecognized,
      oneOff,
      hardware,
      totalRevenue,
      totalBilled,
      totalDueInYear,
      cogs,
      grossProfit,
      grossMarginPct,
      opexByCategory,
      totalOpex,
      totalExpenses,
      netIncome,
      netMarginPct,
      totalCollections,
      totalPaidExpenses,
      netCashChange,
      openingCashStartOfYear,
      closingCashEndOfYear,
      avgMonthlyRevenue,
      avgMonthlyExpense,
      collectionRatioPct,
      mrrDecRunRate,
      mrrArrRunRate,
      mrrGrowthPct,
      profitableMonths,
      deferredBacklogAfterYear,
      openReceivablesFromYear,
    },
    bestMonth,
    worstMonth,
    peakRevenueMonth,
    expenseCategories,
    customers,
    hasAnyData,
  };
}

function getCycleMonthsCount(cycle: BillingCycle): number {
  switch (cycle) {
    case 'monthly':
      return 1;
    case 'quarterly':
      return 3;
    case 'semi_annual':
      return 6;
    case 'annual':
      return 12;
    case 'one_time':
      return 0;
  }
}

function diffDaysISO(fromIso: string, toIso: string): number {
  const fromMs = new Date(`${fromIso}T00:00:00Z`).getTime();
  const toMs = new Date(`${toIso}T00:00:00Z`).getTime();
  return Math.round((toMs - fromMs) / (1000 * 60 * 60 * 24));
}

export function computeWonSalesBillingAnalysis(
  db: PinkFinanceDatabase,
  enrichedInvoices: EnrichedInvoice[],
  referenceToday: string = REFERENCE_TODAY,
  projectionMonthsCount: number = 6
): WonSalesAnalysisSummary {
  const customerMap = new Map(db.customers.map((c) => [c.id, c]));
  const currentMonthKey = getMonthKey(referenceToday);
  const projectionMonthKeys = getMonthRange(currentMonthKey, projectionMonthsCount);

  // Pre-compute open/overdue receivables per customer so pre-billing risk check is instant
  const customerOpenMap = new Map<string, { open: number; overdue: number }>();
  for (const inv of enrichedInvoices) {
    if (inv.isDraft || inv.invoiceType === 'refund' || inv.remainingTry <= 1) continue;
    const prev = customerOpenMap.get(inv.customerId) ?? { open: 0, overdue: 0 };
    prev.open += inv.remainingTry;
    if (inv.computedStatus === 'overdue') {
      prev.overdue += inv.remainingTry;
    }
    customerOpenMap.set(inv.customerId, prev);
  }

  const projectionMap = new Map<string, WonSalesProjectionPoint>();
  for (const mk of projectionMonthKeys) {
    projectionMap.set(mk, {
      monthKey: mk,
      label: formatMonthTR(mk, true),
      monthlyMrrTry: 0,
      periodicAndAnnualTry: 0,
      oneOffAndHardwareTry: 0,
      totalProjectedTry: 0,
      invoiceCount: 0,
    });
  }

  const rows: WonSaleAnalysisRow[] = db.wonSales.map((sale) => {
    const customer = customerMap.get(sale.customerId);
    const customerName = customer?.companyName ?? 'Bilinmeyen Müşteri';
    const customerStatus = customer?.status ?? 'active';
    const cycleMonths = getCycleMonthsCount(sale.billingCycle);

    const linkedInvoices = enrichedInvoices
      .filter((inv) => inv.wonSaleId === sale.id)
      .sort((a, b) => b.issueDate.localeCompare(a.issueDate));

    const issuedInvoices = linkedInvoices.filter((inv) => !inv.isDraft && inv.invoiceType !== 'refund');
    const allNonDraftInvoices = linkedInvoices.filter((inv) => !inv.isDraft);
    const draftInvoices = linkedInvoices.filter((inv) => inv.isDraft);

    const totalInvoicedTry = allNonDraftInvoices.reduce(
      (s, i) => s + (i.invoiceType === 'refund' ? -i.amountTry : i.amountTry),
      0
    );
    const totalCollectedTry = allNonDraftInvoices.reduce(
      (s, i) => s + (i.invoiceType === 'refund' ? -i.paidTry : i.paidTry),
      0
    );
    const lastInvoiceDate = issuedInvoices[0]?.issueDate ?? null;

    const custRecv = customerOpenMap.get(sale.customerId) ?? { open: 0, overdue: 0 };

    // Determine next invoice date
    let nextInvoiceDate: string | null = null;
    if (sale.status === 'active') {
      if (sale.billingCycle === 'one_time') {
        if (issuedInvoices.length === 0) {
          nextInvoiceDate = sale.nextInvoiceDateOverride || sale.firstInvoiceDate;
        }
      } else {
        const computedFromHistory = lastInvoiceDate
          ? addMonthsToDate(lastInvoiceDate, cycleMonths)
          : sale.firstInvoiceDate;

        if (
          sale.nextInvoiceDateOverride &&
          (!lastInvoiceDate || sale.nextInvoiceDateOverride > lastInvoiceDate)
        ) {
          nextInvoiceDate = sale.nextInvoiceDateOverride;
        } else {
          nextInvoiceDate = computedFromHistory;
        }
      }
    }

    const daysUntilNextInvoice = nextInvoiceDate
      ? diffDaysISO(referenceToday, nextInvoiceDate)
      : null;

    // Determine billing urgency
    let urgency: BillingUrgency = 'scheduled';
    if (sale.status === 'paused') {
      urgency = 'paused';
    } else if (sale.status === 'completed' || (sale.billingCycle === 'one_time' && issuedInvoices.length > 0)) {
      urgency = 'billed_complete';
    } else if (nextInvoiceDate && sale.contractEndDate && nextInvoiceDate > sale.contractEndDate) {
      urgency = sale.autoRenew ? 'renewal_attention' : 'billed_complete';
    } else if (daysUntilNextInvoice !== null) {
      if (daysUntilNextInvoice < 0) urgency = 'overdue_to_bill';
      else if (daysUntilNextInvoice === 0) urgency = 'due_today';
      else if (daysUntilNextInvoice <= 7) urgency = 'due_soon';
      else if (daysUntilNextInvoice <= 30) urgency = 'upcoming_30d';
      else urgency = 'scheduled';
    }

    // Build upcoming schedule dates (next 6 cycles) & feed projection chart
    const upcomingScheduleDates: string[] = [];
    if (
      sale.status === 'active' &&
      nextInvoiceDate &&
      urgency !== 'billed_complete' &&
      urgency !== 'paused'
    ) {
      if (sale.billingCycle === 'one_time') {
        upcomingScheduleDates.push(nextInvoiceDate);
      } else {
        let cursor = nextInvoiceDate;
        for (let i = 0; i < 12 && upcomingScheduleDates.length < 6; i++) {
          if (sale.contractEndDate && cursor > sale.contractEndDate && !sale.autoRenew) break;
          upcomingScheduleDates.push(cursor);
          cursor = addMonthsToDate(cursor, cycleMonths);
        }
      }

      // Project into the next N months chart
      const lastProjMonth = projectionMonthKeys[projectionMonthKeys.length - 1];
      const firstProjMonth = projectionMonthKeys[0];

      const scheduleToProject =
        sale.billingCycle === 'one_time'
          ? [nextInvoiceDate]
          : (() => {
              const list: string[] = [];
              let cursor = nextInvoiceDate;
              for (let i = 0; i < 18; i++) {
                if (sale.contractEndDate && cursor > sale.contractEndDate && !sale.autoRenew) break;
                const mk = getMonthKey(cursor);
                if (mk > lastProjMonth) break;
                list.push(cursor);
                cursor = addMonthsToDate(cursor, cycleMonths);
              }
              return list;
            })();

      for (const dt of scheduleToProject) {
        let mk = getMonthKey(dt);
        // If overdue to bill (before currentMonthKey), bucket into currentMonthKey so action is visible
        if (mk < firstProjMonth) mk = firstProjMonth;
        const point = projectionMap.get(mk);
        if (!point) continue;

        if (sale.revenueModel === 'monthly_mrr') {
          point.monthlyMrrTry += sale.amountTry;
        } else if (sale.revenueModel === 'annual_mrr') {
          point.periodicAndAnnualTry += sale.amountTry;
        } else {
          point.oneOffAndHardwareTry += sale.amountTry;
        }
        point.totalProjectedTry += sale.amountTry;
        point.invoiceCount += 1;
      }
    }

    const annualizedValueTry =
      sale.status !== 'active'
        ? 0
        : cycleMonths > 0
        ? (sale.amountTry * 12) / cycleMonths
        : sale.amountTry;

    // Generate concise Turkish analysis recommendation
    let recommendationNote = 'Takvime uygun ilerliyor.';
    if (urgency === 'paused') {
      recommendationNote = 'Satış duraklatıldı; tekrar fatura üretilmiyor.';
    } else if (urgency === 'billed_complete') {
      recommendationNote = 'Sözleşme / tek seferlik faturalama tamamlandı.';
    } else if (urgency === 'renewal_attention') {
      recommendationNote =
        custRecv.overdue > 0
          ? 'Sözleşme bitişi geldi; önce vadesi geçmiş alacak tahsil edilip yenileme görüşülmeli.'
          : 'Sözleşme bitiş tarihi doldu; yenileme onayı sonrası fatura kesilebilir.';
    } else if (custRecv.overdue > 0 && (urgency === 'overdue_to_bill' || urgency === 'due_today' || urgency === 'due_soon')) {
      recommendationNote = 'Fatura zamanı geldi ancak müşterinin gecikmiş alacağı var; tahsilat kontrolü önerilir.';
    } else if (draftInvoices.length > 0) {
      recommendationNote = `${draftInvoices.length} adet taslak fatura mevcut; onaylayıp kesebilirsiniz.`;
    } else if (urgency === 'overdue_to_bill') {
      recommendationNote = `Planlanan kesim tarihi ${Math.abs(daysUntilNextInvoice ?? 0)} gün geçti; hemen fatura kesilmeli.`;
    } else if (urgency === 'due_today') {
      recommendationNote = 'Bugün tekrar fatura kesim günü.';
    } else if (urgency === 'due_soon') {
      recommendationNote = `${daysUntilNextInvoice} gün içinde fatura kesimi planlanıyor.`;
    } else if (urgency === 'upcoming_30d') {
      recommendationNote = `Önümüzdeki ${daysUntilNextInvoice} gün içinde faturalama dönemi gelecek.`;
    }

    return {
      sale,
      customerName,
      customerStatus,
      linkedInvoices,
      issuedInvoiceCount: issuedInvoices.length,
      draftInvoiceCount: draftInvoices.length,
      totalInvoicedTry,
      totalCollectedTry,
      customerOpenReceivableTry: custRecv.open,
      customerOverdueTry: custRecv.overdue,
      lastInvoiceDate,
      nextInvoiceDate,
      daysUntilNextInvoice,
      urgency,
      cycleMonths,
      annualizedValueTry,
      upcomingScheduleDates,
      recommendationNote,
    };
  });

  // Sort by action priority (overdue -> due_today -> renewal -> due_soon -> upcoming_30d -> scheduled -> completed -> paused)
  const urgencyOrder: Record<BillingUrgency, number> = {
    overdue_to_bill: 0,
    due_today: 1,
    renewal_attention: 2,
    due_soon: 3,
    upcoming_30d: 4,
    scheduled: 5,
    billed_complete: 6,
    paused: 7,
  };

  rows.sort((a, b) => {
    const uDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    if (uDiff !== 0) return uDiff;
    if (a.nextInvoiceDate && b.nextInvoiceDate) {
      return a.nextInvoiceDate.localeCompare(b.nextInvoiceDate);
    }
    return b.sale.wonDate.localeCompare(a.sale.wonDate);
  });

  const activeRows = rows.filter((r) => r.sale.status === 'active');
  const actionRows = rows.filter(
    (r) =>
      r.urgency === 'overdue_to_bill' ||
      r.urgency === 'due_today' ||
      r.urgency === 'due_soon' ||
      r.urgency === 'renewal_attention'
  );
  const dueThisMonthRows = rows.filter(
    (r) =>
      r.nextInvoiceDate !== null &&
      r.urgency !== 'paused' &&
      r.urgency !== 'billed_complete' &&
      (getMonthKey(r.nextInvoiceDate) <= currentMonthKey)
  );

  const monthlyProjection = Array.from(projectionMap.values());
  const next6MonthsProjectedTry = monthlyProjection.reduce(
    (s, m) => s + m.totalProjectedTry,
    0
  );

  return {
    rows,
    activeCount: activeRows.length,
    actionRequiredCount: actionRows.length,
    actionRequiredAmountTry: actionRows.reduce((s, r) => s + r.sale.amountTry, 0),
    dueThisMonthAmountTry: dueThisMonthRows.reduce((s, r) => s + r.sale.amountTry, 0),
    dueThisMonthCount: dueThisMonthRows.length,
    next6MonthsProjectedTry,
    activeAnnualizedVolumeTry: activeRows.reduce((s, r) => s + r.annualizedValueTry, 0),
    totalWonInvoicedTry: rows.reduce((s, r) => s + r.totalInvoicedTry, 0),
    monthlyProjection,
  };
}
