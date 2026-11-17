export type CurrencyCode = 'TRY' | 'USD' | 'EUR';

export interface ExchangeRates {
  USD: number;
  EUR: number;
  updatedAt: string;
}

export type CustomerStatus = 'active' | 'inactive';

export interface Customer {
  id: string;
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  taxOffice: string;
  taxNumber: string;
  contractStartDate: string; // YYYY-MM-DD
  status: CustomerStatus;
  notes?: string;
}

export type RevenueModel = 'monthly_mrr' | 'annual_mrr' | 'one_off' | 'hardware';

export type InvoiceStatus = 'draft' | 'issued' | 'partial' | 'paid' | 'overdue';

export type InvoiceType = 'sales' | 'refund';

export type RefundSettlementMode = 'bank_payout' | 'pending_payout' | 'receivable_offset';

export interface Invoice {
  id: string;
  invoiceNo: string;
  customerId: string;
  revenueModel: RevenueModel;
  title: string;
  description?: string;
  issueDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  recognitionStartMonth: string; // YYYY-MM
  recognitionMonths: number; // 12 for annual_mrr, 1 for others
  currency: CurrencyCode;
  amount: number; // Original currency amount (positive magnitude)
  fxRateAtIssue: number; // 1 for TRY
  amountTry: number; // TRY equivalent (positive magnitude)
  linkedCogsTry?: number; // Direct hardware COGS reference if applicable
  wonSaleId?: string; // Optional link back to a WonSale deal
  invoiceType?: InvoiceType; // Defaults to 'sales'
  refundedInvoiceId?: string; // Original sales invoice ID when invoiceType === 'refund'
  refundSettlementMode?: RefundSettlementMode;
  isDraft?: boolean;
}

export type PaymentType = 'collection' | 'refund';

export interface Payment {
  id: string;
  invoiceId: string;
  customerId: string;
  paymentDate: string; // YYYY-MM-DD
  amount: number;
  currency: CurrencyCode;
  fxRate: number;
  amountTry: number;
  bankAccount: string;
  paymentType?: PaymentType; // Defaults to 'collection'
  referenceNo?: string;
  note?: string;
}

export type ExpenseCategory =
  | 'cogs'
  | 'personnel'
  | 'rent'
  | 'office_general'
  | 'representation'
  | 'licenses'
  | 'cloud'
  | 'other_fixed';

export type ExpenseStatus = 'paid' | 'pending';

export interface Expense {
  id: string;
  title: string;
  vendor: string;
  category: ExpenseCategory;
  expenseDate: string; // YYYY-MM-DD (Accrual / P&L month)
  dueDate: string; // YYYY-MM-DD
  paymentDate?: string; // YYYY-MM-DD (Cash Flow month when paid)
  currency: CurrencyCode;
  amount: number;
  fxRate: number;
  amountTry: number;
  status: ExpenseStatus;
  isRecurring: boolean;
  bankAccount?: string;
  linkedInvoiceId?: string;
  note?: string;
}

export interface BankAccount {
  id: string;
  name: string;
  bankName: string;
  currency: CurrencyCode;
  openingBalanceTry: number;
  openingDate: string;
}

export type BillingCycle = 'monthly' | 'quarterly' | 'semi_annual' | 'annual' | 'one_time';

export type WonSaleStatus = 'active' | 'paused' | 'completed';

export interface WonSale {
  id: string;
  customerId: string;
  title: string;
  revenueModel: RevenueModel;
  wonDate: string; // YYYY-MM-DD
  contractStartDate: string; // YYYY-MM-DD
  billingCycle: BillingCycle;
  firstInvoiceDate: string; // YYYY-MM-DD
  nextInvoiceDateOverride?: string; // YYYY-MM-DD
  contractEndDate?: string; // YYYY-MM-DD
  autoRenew: boolean;
  currency: CurrencyCode;
  amount: number;
  fxRate: number;
  amountTry: number;
  linkedCogsTry?: number;
  status: WonSaleStatus;
  notes?: string;
}

export interface PinkFinanceDatabase {
  customers: Customer[];
  invoices: Invoice[];
  payments: Payment[];
  expenses: Expense[];
  bankAccounts: BankAccount[];
  wonSales: WonSale[];
  exchangeRates: ExchangeRates;
}

export type NavPage =
  | 'dashboard'
  | 'annual'
  | 'sales'
  | 'invoices'
  | 'customers'
  | 'expenses'
  | 'pnl'
  | 'cashflow';

export interface EnrichedInvoice extends Invoice {
  customerName: string;
  paidTry: number;
  remainingTry: number;
  paidOriginal: number;
  remainingOriginal: number;
  computedStatus: InvoiceStatus;
  daysOverdue: number;
  refundedTotalTry: number;
  offsetCreditTry: number;
  refundedFromInvoiceNo?: string;
}

export interface CustomerBreakdownItem {
  customerId: string;
  customerName: string;
  amountTry: number;
  detailLabel?: string;
}

export interface PnLStatement {
  monthKey: string;
  monthlyMrr: number;
  monthlyMrrBreakdown: CustomerBreakdownItem[];
  annualMrrRecognized: number;
  annualMrrBreakdown: CustomerBreakdownItem[];
  oneOff: number;
  oneOffBreakdown: CustomerBreakdownItem[];
  hardware: number;
  hardwareBreakdown: CustomerBreakdownItem[];
  totalRevenue: number;
  cogs: number;
  cogsItems: Expense[];
  grossProfit: number;
  grossMarginPct: number;
  opexByCategory: Record<Exclude<ExpenseCategory, 'cogs'>, number>;
  opexItemsByCategory: Record<Exclude<ExpenseCategory, 'cogs'>, Expense[]>;
  totalOpex: number;
  netIncome: number;
  netMarginPct: number;
}

export interface CustomerMatrixRow {
  customer: Customer;
  activeMonthlyMrr: number;
  annualMrrMonthlyContribution: number;
  annualMrrTotalContract: number;
  oneOffTotal: number;
  hardwareTotal: number;
  totalRecognizedRevenue: number;
  totalBilledTry: number;
  revenueSharePct: number;
  concentrationWarning: boolean;
  collectedTry: number;
  receivableTry: number;
  overdueTry: number;
  invoiceCount: number;
}

export interface CashFlowMonthSummary {
  monthKey: string;
  openingCashTry: number;
  totalCollectionsTry: number;
  collectionsByCustomer: CustomerBreakdownItem[];
  totalRefundsTry: number;
  refundsByCustomer: CustomerBreakdownItem[];
  totalPaidExpensesTry: number;
  paidExpensesByCategory: Record<ExpenseCategory, number>;
  netCashChangeTry: number;
  closingCashTry: number;
  pendingPayablesTry: number;
}

export interface BankAccountBalanceSummary {
  account: BankAccount;
  openingBalanceTry: number;
  collectionsTry: number;
  refundsTry: number;
  paidExpensesTry: number;
  currentBalanceTry: number;
}

export type BillingUrgency =
  | 'overdue_to_bill'
  | 'due_today'
  | 'due_soon'
  | 'upcoming_30d'
  | 'scheduled'
  | 'renewal_attention'
  | 'billed_complete'
  | 'paused';

export interface WonSaleAnalysisRow {
  sale: WonSale;
  customerName: string;
  customerStatus: CustomerStatus;
  linkedInvoices: EnrichedInvoice[];
  issuedInvoiceCount: number;
  draftInvoiceCount: number;
  totalInvoicedTry: number;
  totalCollectedTry: number;
  customerOpenReceivableTry: number;
  customerOverdueTry: number;
  lastInvoiceDate: string | null;
  nextInvoiceDate: string | null;
  daysUntilNextInvoice: number | null;
  urgency: BillingUrgency;
  cycleMonths: number;
  annualizedValueTry: number;
  upcomingScheduleDates: string[];
  recommendationNote: string;
}

export interface WonSalesProjectionPoint {
  monthKey: string;
  label: string;
  monthlyMrrTry: number;
  periodicAndAnnualTry: number;
  oneOffAndHardwareTry: number;
  totalProjectedTry: number;
  invoiceCount: number;
}

export interface WonSalesAnalysisSummary {
  rows: WonSaleAnalysisRow[];
  activeCount: number;
  actionRequiredCount: number;
  actionRequiredAmountTry: number;
  dueThisMonthAmountTry: number;
  dueThisMonthCount: number;
  next6MonthsProjectedTry: number;
  activeAnnualizedVolumeTry: number;
  totalWonInvoicedTry: number;
  monthlyProjection: WonSalesProjectionPoint[];
}
