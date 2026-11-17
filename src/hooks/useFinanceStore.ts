import { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  BankAccount,
  Customer,
  ExchangeRates,
  Expense,
  Invoice,
  PinkFinanceDatabase,
  Payment,
  WonSale,
} from '../types/finance';
import { addMonths, getMonthKey } from '../utils/formatters';

export const SHARED_WORKSPACE_ID = 'pinkfinance';
const LEGACY_SHARED_WORKSPACE_ID = 'metaguard';

const INITIAL_EXCHANGE_RATES: ExchangeRates = {
  USD: 34.45,
  EUR: 36.8,
  updatedAt: '2026-11-17',
};

const EMPTY_DB: PinkFinanceDatabase = {
  customers: [],
  invoices: [],
  payments: [],
  expenses: [],
  bankAccounts: [],
  wonSales: [],
  exchangeRates: INITIAL_EXCHANGE_RATES,
};

function clip(val: string | undefined, maxLen: number): string {
  return (val ?? '').trim().slice(0, maxLen);
}

function buildCustomerCreatePayload(c: Customer, uid: string) {
  const payload: Record<string, unknown> = {
    id: c.id,
    workspaceId: SHARED_WORKSPACE_ID,
    createdBy: uid,
    updatedBy: uid,
    companyName: clip(c.companyName, 160),
    contactPerson: clip(c.contactPerson, 120),
    email: clip(c.email, 160),
    phone: clip(c.phone, 40),
    taxOffice: clip(c.taxOffice, 100),
    taxNumber: clip(c.taxNumber, 20),
    contractStartDate: c.contractStartDate,
    status: c.status,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (c.notes && c.notes.trim()) payload.notes = clip(c.notes, 1000);
  return payload;
}

function buildCustomerUpdatePayload(c: Customer, uid: string, hadNotesBefore: boolean) {
  const payload: Record<string, unknown> = {
    updatedBy: uid,
    companyName: clip(c.companyName, 160),
    contactPerson: clip(c.contactPerson, 120),
    email: clip(c.email, 160),
    phone: clip(c.phone, 40),
    taxOffice: clip(c.taxOffice, 100),
    taxNumber: clip(c.taxNumber, 20),
    contractStartDate: c.contractStartDate,
    status: c.status,
    updatedAt: serverTimestamp(),
  };
  if (c.notes && c.notes.trim()) {
    payload.notes = clip(c.notes, 1000);
  } else if (hadNotesBefore) {
    payload.notes = '';
  }
  return payload;
}

function buildInvoicePayload(inv: Invoice, uid: string) {
  const payload: Record<string, unknown> = {
    id: inv.id,
    workspaceId: SHARED_WORKSPACE_ID,
    createdBy: uid,
    updatedBy: uid,
    invoiceNo: clip(inv.invoiceNo, 40),
    customerId: inv.customerId,
    revenueModel: inv.revenueModel,
    title: clip(inv.title, 200),
    issueDate: inv.issueDate,
    dueDate: inv.dueDate,
    recognitionStartMonth: inv.recognitionStartMonth,
    recognitionMonths: Math.min(60, Math.max(1, Math.round(inv.recognitionMonths || 1))),
    currency: inv.currency,
    amount: Number(inv.amount),
    fxRateAtIssue: Number(inv.fxRateAtIssue),
    amountTry: Number(inv.amountTry),
    isDraft: Boolean(inv.isDraft),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (inv.description && inv.description.trim()) {
    payload.description = clip(inv.description, 500);
  }
  if (typeof inv.linkedCogsTry === 'number' && inv.linkedCogsTry >= 0) {
    payload.linkedCogsTry = Number(inv.linkedCogsTry);
  }
  if (inv.wonSaleId && inv.wonSaleId.trim()) {
    payload.wonSaleId = inv.wonSaleId.trim();
  }
  if (inv.invoiceType) {
    payload.invoiceType = inv.invoiceType;
  }
  if (inv.refundedInvoiceId && inv.refundedInvoiceId.trim()) {
    payload.refundedInvoiceId = inv.refundedInvoiceId.trim();
  }
  if (inv.refundSettlementMode) {
    payload.refundSettlementMode = inv.refundSettlementMode;
  }
  return payload;
}

function buildPaymentPayload(p: Payment, uid: string) {
  const payload: Record<string, unknown> = {
    id: p.id,
    workspaceId: SHARED_WORKSPACE_ID,
    createdBy: uid,
    updatedBy: uid,
    invoiceId: p.invoiceId,
    customerId: p.customerId,
    paymentDate: p.paymentDate,
    amount: Number(p.amount),
    currency: p.currency,
    fxRate: Number(p.fxRate),
    amountTry: Number(p.amountTry),
    bankAccount: clip(p.bankAccount, 80),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (p.paymentType) payload.paymentType = p.paymentType;
  if (p.referenceNo && p.referenceNo.trim()) payload.referenceNo = clip(p.referenceNo, 80);
  if (p.note && p.note.trim()) payload.note = clip(p.note, 500);
  return payload;
}

function buildExpensePayload(e: Expense, uid: string) {
  const payload: Record<string, unknown> = {
    id: e.id,
    workspaceId: SHARED_WORKSPACE_ID,
    createdBy: uid,
    updatedBy: uid,
    title: clip(e.title, 200),
    vendor: clip(e.vendor, 120),
    category: e.category,
    expenseDate: e.expenseDate,
    dueDate: e.dueDate,
    currency: e.currency,
    amount: Number(e.amount),
    fxRate: Number(e.fxRate),
    amountTry: Number(e.amountTry),
    status: e.status,
    isRecurring: Boolean(e.isRecurring),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (e.paymentDate) payload.paymentDate = e.paymentDate;
  if (e.bankAccount && e.bankAccount.trim()) payload.bankAccount = clip(e.bankAccount, 80);
  if (e.linkedInvoiceId) payload.linkedInvoiceId = e.linkedInvoiceId;
  if (e.note && e.note.trim()) payload.note = clip(e.note, 500);
  return payload;
}

function buildBankAccountPayload(acc: BankAccount, uid: string) {
  return {
    id: acc.id,
    workspaceId: SHARED_WORKSPACE_ID,
    createdBy: uid,
    updatedBy: uid,
    name: clip(acc.name, 80),
    bankName: clip(acc.bankName, 80),
    currency: acc.currency,
    openingBalanceTry: Number(acc.openingBalanceTry),
    openingDate: acc.openingDate,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

function buildWonSaleCreatePayload(sale: WonSale, uid: string) {
  const payload: Record<string, unknown> = {
    id: sale.id,
    workspaceId: SHARED_WORKSPACE_ID,
    createdBy: uid,
    updatedBy: uid,
    customerId: sale.customerId,
    title: clip(sale.title, 200),
    revenueModel: sale.revenueModel,
    wonDate: sale.wonDate,
    contractStartDate: sale.contractStartDate,
    billingCycle: sale.billingCycle,
    firstInvoiceDate: sale.firstInvoiceDate,
    autoRenew: Boolean(sale.autoRenew),
    currency: sale.currency,
    amount: Number(sale.amount),
    fxRate: Number(sale.fxRate),
    amountTry: Number(sale.amountTry),
    status: sale.status,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (sale.nextInvoiceDateOverride) payload.nextInvoiceDateOverride = sale.nextInvoiceDateOverride;
  if (sale.contractEndDate) payload.contractEndDate = sale.contractEndDate;
  if (typeof sale.linkedCogsTry === 'number' && sale.linkedCogsTry >= 0) {
    payload.linkedCogsTry = Number(sale.linkedCogsTry);
  }
  if (sale.notes && sale.notes.trim()) payload.notes = clip(sale.notes, 1000);
  return payload;
}

function buildWonSaleUpdatePayload(sale: WonSale, uid: string, prev: WonSale) {
  const payload: Record<string, unknown> = {
    updatedBy: uid,
    customerId: sale.customerId,
    title: clip(sale.title, 200),
    revenueModel: sale.revenueModel,
    wonDate: sale.wonDate,
    contractStartDate: sale.contractStartDate,
    billingCycle: sale.billingCycle,
    firstInvoiceDate: sale.firstInvoiceDate,
    autoRenew: Boolean(sale.autoRenew),
    currency: sale.currency,
    amount: Number(sale.amount),
    fxRate: Number(sale.fxRate),
    amountTry: Number(sale.amountTry),
    status: sale.status,
    updatedAt: serverTimestamp(),
  };
  if (sale.nextInvoiceDateOverride) {
    payload.nextInvoiceDateOverride = sale.nextInvoiceDateOverride;
  } else if (prev.nextInvoiceDateOverride) {
    payload.nextInvoiceDateOverride = deleteField();
  }
  if (sale.contractEndDate) {
    payload.contractEndDate = sale.contractEndDate;
  } else if (prev.contractEndDate) {
    payload.contractEndDate = deleteField();
  }
  if (typeof sale.linkedCogsTry === 'number' && sale.linkedCogsTry >= 0) {
    payload.linkedCogsTry = Number(sale.linkedCogsTry);
  } else if (typeof prev.linkedCogsTry === 'number') {
    payload.linkedCogsTry = deleteField();
  }
  if (sale.notes && sale.notes.trim()) {
    payload.notes = clip(sale.notes, 1000);
  } else if (prev.notes) {
    payload.notes = deleteField();
  }
  return payload;
}

async function deleteAllWorkspaceCollections() {
  const subCollections = ['payments', 'expenses', 'invoices', 'wonSales', 'customers', 'bankAccounts'];
  const batch = writeBatch(db);
  for (const colName of subCollections) {
    const snap = await getDocs(
      query(
        collection(db, 'workspaces', SHARED_WORKSPACE_ID, colName),
        where('workspaceId', '==', SHARED_WORKSPACE_ID)
      )
    );
    snap.docs.forEach((d) => batch.delete(d.ref));
  }
  await batch.commit();
}

async function migrateLegacyUserWorkspaceIfNeeded(uid: string) {
  const legacyMetaRef = doc(db, 'users', uid, 'settings', 'workspace');
  const legacyMetaSnap = await getDoc(legacyMetaRef);
  if (!legacyMetaSnap.exists()) return;

  const meta = legacyMetaSnap.data() as { seedVersion?: number };
  if (meta.seedVersion === 3) return;

  const legacyCols = ['payments', 'expenses', 'invoices', 'customers', 'bankAccounts'] as const;

  if (meta.seedVersion === 1) {
    // Discard old v1 demo data cleanly
    const delBatch = writeBatch(db);
    for (const colName of legacyCols) {
      const snap = await getDocs(
        query(collection(db, 'users', uid, colName), where('ownerId', '==', uid))
      );
      snap.docs.forEach((d) => delBatch.delete(d.ref));
    }
    await delBatch.commit();
    await updateDoc(legacyMetaRef, {
      seeded: false,
      seedVersion: 3,
      updatedAt: serverTimestamp(),
    });
    return;
  }

  // Migrate real user-entered v2 records from /users/{uid}/... into /workspaces/pinkfinance/...
  const [custSnap, invSnap, paySnap, expSnap, bankSnap, existingSharedCustSnap, existingSharedInvSnap] =
    await Promise.all([
      getDocs(query(collection(db, 'users', uid, 'customers'), where('ownerId', '==', uid))),
      getDocs(query(collection(db, 'users', uid, 'invoices'), where('ownerId', '==', uid))),
      getDocs(query(collection(db, 'users', uid, 'payments'), where('ownerId', '==', uid))),
      getDocs(query(collection(db, 'users', uid, 'expenses'), where('ownerId', '==', uid))),
      getDocs(query(collection(db, 'users', uid, 'bankAccounts'), where('ownerId', '==', uid))),
      getDocs(
        query(
          collection(db, 'workspaces', SHARED_WORKSPACE_ID, 'customers'),
          where('workspaceId', '==', SHARED_WORKSPACE_ID)
        )
      ),
      getDocs(
        query(
          collection(db, 'workspaces', SHARED_WORKSPACE_ID, 'invoices'),
          where('workspaceId', '==', SHARED_WORKSPACE_ID)
        )
      ),
    ]);

  const hasLegacyDocs =
    custSnap.size + invSnap.size + paySnap.size + expSnap.size + bankSnap.size > 0;

  if (hasLegacyDocs) {
    const validCustomerIds = new Set<string>(
      existingSharedCustSnap.docs.map((d) => d.id)
    );
    const validInvoiceIds = new Set<string>(
      existingSharedInvSnap.docs.map((d) => d.id)
    );

    const copyBatch = writeBatch(db);
    custSnap.docs.forEach((d) => {
      const raw = d.data() as Customer;
      const sanitized: Customer = {
        ...raw,
        companyName: clip(raw.companyName || 'Müşteri', 160),
        contactPerson: clip(raw.contactPerson || 'Yetkili', 120),
      };
      validCustomerIds.add(sanitized.id);
      copyBatch.set(
        doc(db, 'workspaces', SHARED_WORKSPACE_ID, 'customers', sanitized.id),
        buildCustomerCreatePayload(sanitized, uid)
      );
    });
    bankSnap.docs.forEach((d) => {
      const raw = d.data() as BankAccount;
      const sanitized: BankAccount = {
        ...raw,
        name: clip(raw.name || 'Banka Hesabı', 80),
        bankName: clip(raw.bankName || 'Banka', 80),
      };
      copyBatch.set(
        doc(db, 'workspaces', SHARED_WORKSPACE_ID, 'bankAccounts', sanitized.id),
        buildBankAccountPayload(sanitized, uid)
      );
    });
    invSnap.docs.forEach((d) => {
      const raw = d.data() as Invoice;
      if (!validCustomerIds.has(raw.customerId)) return;
      const sanitized: Invoice = {
        ...raw,
        invoiceNo: clip(raw.invoiceNo || raw.id, 40),
        title: clip(raw.title || 'Fatura Kalemi', 200),
      };
      validInvoiceIds.add(sanitized.id);
      copyBatch.set(
        doc(db, 'workspaces', SHARED_WORKSPACE_ID, 'invoices', sanitized.id),
        buildInvoicePayload(sanitized, uid)
      );
    });
    paySnap.docs.forEach((d) => {
      const raw = d.data() as Payment;
      if (!validInvoiceIds.has(raw.invoiceId) || !validCustomerIds.has(raw.customerId)) return;
      const sanitized: Payment = {
        ...raw,
        bankAccount: clip(raw.bankAccount || 'Banka Hesabı', 80),
      };
      copyBatch.set(
        doc(db, 'workspaces', SHARED_WORKSPACE_ID, 'payments', sanitized.id),
        buildPaymentPayload(sanitized, uid)
      );
    });
    expSnap.docs.forEach((d) => {
      const raw = d.data() as Expense;
      const sanitized: Expense = {
        ...raw,
        title: clip(raw.title || 'Gider', 200),
        vendor: clip(raw.vendor || 'Tedarikçi', 120),
        linkedInvoiceId:
          raw.linkedInvoiceId && validInvoiceIds.has(raw.linkedInvoiceId)
            ? raw.linkedInvoiceId
            : undefined,
      };
      copyBatch.set(
        doc(db, 'workspaces', SHARED_WORKSPACE_ID, 'expenses', sanitized.id),
        buildExpensePayload(sanitized, uid)
      );
    });
    await copyBatch.commit();

    const cleanupBatch = writeBatch(db);
    [...paySnap.docs, ...expSnap.docs, ...invSnap.docs, ...custSnap.docs, ...bankSnap.docs].forEach(
      (d) => cleanupBatch.delete(d.ref)
    );
    await cleanupBatch.commit();
  }

  await updateDoc(legacyMetaRef, {
    seeded: false,
    seedVersion: 3,
    updatedAt: serverTimestamp(),
  });
}

async function commitInChunks(
  ops: Array<(batch: ReturnType<typeof writeBatch>) => void>,
  chunkSize = 350
) {
  for (let i = 0; i < ops.length; i += chunkSize) {
    const batch = writeBatch(db);
    const slice = ops.slice(i, i + chunkSize);
    slice.forEach((fn) => fn(batch));
    await batch.commit();
  }
}

async function migrateLegacySharedWorkspaceIfNeeded(uid: string) {
  const legacyWorkspaceSnap = await getDoc(doc(db, 'workspaces', LEGACY_SHARED_WORKSPACE_ID));
  if (!legacyWorkspaceSnap.exists()) return;

  const [custSnap, bankSnap, wonSnap, invSnap, paySnap, expSnap, ratesSnap] = await Promise.all([
    getDocs(
      query(
        collection(db, 'workspaces', LEGACY_SHARED_WORKSPACE_ID, 'customers'),
        where('workspaceId', '==', LEGACY_SHARED_WORKSPACE_ID)
      )
    ),
    getDocs(
      query(
        collection(db, 'workspaces', LEGACY_SHARED_WORKSPACE_ID, 'bankAccounts'),
        where('workspaceId', '==', LEGACY_SHARED_WORKSPACE_ID)
      )
    ),
    getDocs(
      query(
        collection(db, 'workspaces', LEGACY_SHARED_WORKSPACE_ID, 'wonSales'),
        where('workspaceId', '==', LEGACY_SHARED_WORKSPACE_ID)
      )
    ),
    getDocs(
      query(
        collection(db, 'workspaces', LEGACY_SHARED_WORKSPACE_ID, 'invoices'),
        where('workspaceId', '==', LEGACY_SHARED_WORKSPACE_ID)
      )
    ),
    getDocs(
      query(
        collection(db, 'workspaces', LEGACY_SHARED_WORKSPACE_ID, 'payments'),
        where('workspaceId', '==', LEGACY_SHARED_WORKSPACE_ID)
      )
    ),
    getDocs(
      query(
        collection(db, 'workspaces', LEGACY_SHARED_WORKSPACE_ID, 'expenses'),
        where('workspaceId', '==', LEGACY_SHARED_WORKSPACE_ID)
      )
    ),
    getDoc(doc(db, 'workspaces', LEGACY_SHARED_WORKSPACE_ID, 'settings', 'exchangeRates')),
  ]);

  if (ratesSnap.exists()) {
    const rateData = ratesSnap.data() as {
      USD?: number;
      EUR?: number;
      updatedAtLabel?: string;
    };
    await updateDoc(doc(db, 'workspaces', SHARED_WORKSPACE_ID, 'settings', 'exchangeRates'), {
      USD: rateData.USD ?? INITIAL_EXCHANGE_RATES.USD,
      EUR: rateData.EUR ?? INITIAL_EXCHANGE_RATES.EUR,
      updatedAtLabel: rateData.updatedAtLabel ?? INITIAL_EXCHANGE_RATES.updatedAt,
      updatedBy: uid,
      updatedAt: serverTimestamp(),
    });
  }

  const validCustomerIds = new Set<string>();
  const baseOps: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];

  custSnap.docs.forEach((d) => {
    const raw = d.data() as Customer;
    const sanitized: Customer = {
      ...raw,
      id: d.id,
      companyName: clip(raw.companyName || 'Müşteri', 160),
      contactPerson: clip(raw.contactPerson || 'Yetkili', 120),
    };
    validCustomerIds.add(sanitized.id);
    baseOps.push((b) =>
      b.set(
        doc(db, 'workspaces', SHARED_WORKSPACE_ID, 'customers', sanitized.id),
        buildCustomerCreatePayload(sanitized, uid)
      )
    );
  });

  bankSnap.docs.forEach((d) => {
    const raw = d.data() as BankAccount;
    const sanitized: BankAccount = {
      ...raw,
      id: d.id,
      name: clip(raw.name || 'Banka Hesabı', 80),
      bankName: clip(raw.bankName || 'Banka', 80),
    };
    baseOps.push((b) =>
      b.set(
        doc(db, 'workspaces', SHARED_WORKSPACE_ID, 'bankAccounts', sanitized.id),
        buildBankAccountPayload(sanitized, uid)
      )
    );
  });

  await commitInChunks(baseOps);

  const wonOps: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];
  wonSnap.docs.forEach((d) => {
    const raw = d.data() as WonSale;
    if (!validCustomerIds.has(raw.customerId)) return;
    const sanitized: WonSale = {
      ...raw,
      id: d.id,
      title: clip(raw.title || 'Satış', 200),
    };
    wonOps.push((b) =>
      b.set(
        doc(db, 'workspaces', SHARED_WORKSPACE_ID, 'wonSales', sanitized.id),
        buildWonSaleCreatePayload(sanitized, uid)
      )
    );
  });
  await commitInChunks(wonOps);

  const validInvoiceIds = new Set<string>();
  const salesInvOps: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];
  const refundInvOps: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];

  invSnap.docs.forEach((d) => {
    const raw = d.data() as Invoice;
    if (!validCustomerIds.has(raw.customerId)) return;
    const sanitized: Invoice = {
      ...raw,
      id: d.id,
      invoiceNo: clip(raw.invoiceNo || raw.id, 40),
      title: clip(raw.title || 'Fatura Kalemi', 200),
    };
    validInvoiceIds.add(sanitized.id);
    if (sanitized.invoiceType === 'refund' && sanitized.refundedInvoiceId) {
      refundInvOps.push((b) =>
        b.set(
          doc(db, 'workspaces', SHARED_WORKSPACE_ID, 'invoices', sanitized.id),
          buildInvoicePayload(sanitized, uid)
        )
      );
    } else {
      salesInvOps.push((b) =>
        b.set(
          doc(db, 'workspaces', SHARED_WORKSPACE_ID, 'invoices', sanitized.id),
          buildInvoicePayload(sanitized, uid)
        )
      );
    }
  });

  await commitInChunks(salesInvOps);
  await commitInChunks(refundInvOps);

  const dependentOps: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];
  paySnap.docs.forEach((d) => {
    const raw = d.data() as Payment;
    if (!validInvoiceIds.has(raw.invoiceId) || !validCustomerIds.has(raw.customerId)) return;
    const sanitized: Payment = {
      ...raw,
      id: d.id,
      bankAccount: clip(raw.bankAccount || 'Banka Hesabı', 80),
    };
    dependentOps.push((b) =>
      b.set(
        doc(db, 'workspaces', SHARED_WORKSPACE_ID, 'payments', sanitized.id),
        buildPaymentPayload(sanitized, uid)
      )
    );
  });

  expSnap.docs.forEach((d) => {
    const raw = d.data() as Expense;
    const sanitized: Expense = {
      ...raw,
      id: d.id,
      title: clip(raw.title || 'Gider', 200),
      vendor: clip(raw.vendor || 'Tedarikçi', 120),
      linkedInvoiceId:
        raw.linkedInvoiceId && validInvoiceIds.has(raw.linkedInvoiceId)
          ? raw.linkedInvoiceId
          : undefined,
    };
    dependentOps.push((b) =>
      b.set(
        doc(db, 'workspaces', SHARED_WORKSPACE_ID, 'expenses', sanitized.id),
        buildExpensePayload(sanitized, uid)
      )
    );
  });

  await commitInChunks(dependentOps);
}

export function useFinanceStore(user: User | null) {
  const [dbState, setDbState] = useState<PinkFinanceDatabase>(EMPTY_DB);
  const [loadingCloud, setLoadingCloud] = useState<boolean>(true);
  const [syncError, setSyncError] = useState<Error | null>(null);
  const [adminCount, setAdminCount] = useState<number>(1);

  if (syncError) {
    throw syncError;
  }

  useEffect(() => {
    if (!user) {
      setDbState(EMPTY_DB);
      setLoadingCloud(false);
      return;
    }

    let cancelled = false;
    const uid = user.uid;
    setLoadingCloud(true);

    const unsubscribers: Array<() => void> = [];

    const setupSharedWorkspaceAndListeners = async () => {
      try {
        const displayName = clip(user.displayName || 'PinkFinance Yöneticisi', 120);

        // 1. Upsert private Google profile (isolated PII per user)
        const profileRef = doc(db, 'users', uid, 'private', 'profile');
        const profileSnap = await getDoc(profileRef);
        const profileData: Record<string, unknown> = {
          ownerId: uid,
          displayName,
          email: clip(user.email || 'user@pinkfinance.com', 160),
          updatedAt: serverTimestamp(),
        };
        if (user.photoURL) {
          profileData.photoURL = clip(user.photoURL, 500);
        }
        if (!profileSnap.exists()) {
          await setDoc(profileRef, { ...profileData, createdAt: serverTimestamp() });
        } else {
          await updateDoc(profileRef, profileData);
        }

        // 2. Ensure shared PinkFinance workspace + admin membership for signed-in user
        const workspaceRef = doc(db, 'workspaces', SHARED_WORKSPACE_ID);
        const memberRef = doc(db, 'workspaces', SHARED_WORKSPACE_ID, 'members', uid);
        const ratesRef = doc(db, 'workspaces', SHARED_WORKSPACE_ID, 'settings', 'exchangeRates');

        const workspaceSnap = await getDoc(workspaceRef);
        if (!workspaceSnap.exists()) {
          const initBatch = writeBatch(db);
          initBatch.set(memberRef, {
            id: uid,
            workspaceId: SHARED_WORKSPACE_ID,
            userId: uid,
            displayName,
            role: 'admin',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          initBatch.set(workspaceRef, {
            id: SHARED_WORKSPACE_ID,
            name: 'PinkFinance',
            createdBy: uid,
            seeded: false,
            seedVersion: 2,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          initBatch.set(ratesRef, {
            workspaceId: SHARED_WORKSPACE_ID,
            updatedBy: uid,
            USD: INITIAL_EXCHANGE_RATES.USD,
            EUR: INITIAL_EXCHANGE_RATES.EUR,
            updatedAtLabel: INITIAL_EXCHANGE_RATES.updatedAt,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          await initBatch.commit();

          // One-time migration from legacy shared workspace if present
          await migrateLegacySharedWorkspaceIfNeeded(uid);
        } else {
          const memberSnap = await getDoc(memberRef);
          if (!memberSnap.exists()) {
            await setDoc(memberRef, {
              id: uid,
              workspaceId: SHARED_WORKSPACE_ID,
              userId: uid,
              displayName,
              role: 'admin',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } else {
            await updateDoc(memberRef, {
              displayName,
              updatedAt: serverTimestamp(),
            });
          }

          const ratesSnap = await getDoc(ratesRef);
          if (!ratesSnap.exists()) {
            await setDoc(ratesRef, {
              workspaceId: SHARED_WORKSPACE_ID,
              updatedBy: uid,
              USD: INITIAL_EXCHANGE_RATES.USD,
              EUR: INITIAL_EXCHANGE_RATES.EUR,
              updatedAtLabel: INITIAL_EXCHANGE_RATES.updatedAt,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        }

        // 3. One-time migration of any existing real records from /users/{uid} -> /workspaces/pinkfinance
        await migrateLegacyUserWorkspaceIfNeeded(uid);

        if (cancelled) return;

        // 4. Attach real-time shared workspace listeners AFTER membership & workspace are ready
        const loaded = {
          customers: false,
          invoices: false,
          payments: false,
          expenses: false,
          bankAccounts: false,
          wonSales: false,
          exchangeRates: false,
        };

        const markLoaded = (key: keyof typeof loaded) => {
          loaded[key] = true;
          if (Object.values(loaded).every(Boolean) && !cancelled) {
            setLoadingCloud(false);
          }
        };

        unsubscribers.push(
          onSnapshot(
            query(
              collection(db, 'workspaces', SHARED_WORKSPACE_ID, 'members'),
              where('workspaceId', '==', SHARED_WORKSPACE_ID)
            ),
            (snap) => {
              setAdminCount(snap.size);
            },
            (err) => {
              try {
                handleFirestoreError(
                  err,
                  OperationType.LIST,
                  `workspaces/${SHARED_WORKSPACE_ID}/members`
                );
              } catch (wrapped) {
                setSyncError(wrapped as Error);
              }
            }
          )
        );

        unsubscribers.push(
          onSnapshot(
            query(
              collection(db, 'workspaces', SHARED_WORKSPACE_ID, 'customers'),
              where('workspaceId', '==', SHARED_WORKSPACE_ID)
            ),
            (snap) => {
              const customers = snap.docs.map((d) => d.data() as Customer);
              setDbState((prev) => ({ ...prev, customers }));
              markLoaded('customers');
            },
            (err) => {
              try {
                handleFirestoreError(
                  err,
                  OperationType.LIST,
                  `workspaces/${SHARED_WORKSPACE_ID}/customers`
                );
              } catch (wrapped) {
                setSyncError(wrapped as Error);
              }
            }
          )
        );

        unsubscribers.push(
          onSnapshot(
            query(
              collection(db, 'workspaces', SHARED_WORKSPACE_ID, 'invoices'),
              where('workspaceId', '==', SHARED_WORKSPACE_ID)
            ),
            (snap) => {
              const invoices = snap.docs.map((d) => d.data() as Invoice);
              setDbState((prev) => ({ ...prev, invoices }));
              markLoaded('invoices');
            },
            (err) => {
              try {
                handleFirestoreError(
                  err,
                  OperationType.LIST,
                  `workspaces/${SHARED_WORKSPACE_ID}/invoices`
                );
              } catch (wrapped) {
                setSyncError(wrapped as Error);
              }
            }
          )
        );

        unsubscribers.push(
          onSnapshot(
            query(
              collection(db, 'workspaces', SHARED_WORKSPACE_ID, 'payments'),
              where('workspaceId', '==', SHARED_WORKSPACE_ID)
            ),
            (snap) => {
              const payments = snap.docs.map((d) => d.data() as Payment);
              setDbState((prev) => ({ ...prev, payments }));
              markLoaded('payments');
            },
            (err) => {
              try {
                handleFirestoreError(
                  err,
                  OperationType.LIST,
                  `workspaces/${SHARED_WORKSPACE_ID}/payments`
                );
              } catch (wrapped) {
                setSyncError(wrapped as Error);
              }
            }
          )
        );

        unsubscribers.push(
          onSnapshot(
            query(
              collection(db, 'workspaces', SHARED_WORKSPACE_ID, 'expenses'),
              where('workspaceId', '==', SHARED_WORKSPACE_ID)
            ),
            (snap) => {
              const expenses = snap.docs.map((d) => d.data() as Expense);
              setDbState((prev) => ({ ...prev, expenses }));
              markLoaded('expenses');
            },
            (err) => {
              try {
                handleFirestoreError(
                  err,
                  OperationType.LIST,
                  `workspaces/${SHARED_WORKSPACE_ID}/expenses`
                );
              } catch (wrapped) {
                setSyncError(wrapped as Error);
              }
            }
          )
        );

        unsubscribers.push(
          onSnapshot(
            query(
              collection(db, 'workspaces', SHARED_WORKSPACE_ID, 'bankAccounts'),
              where('workspaceId', '==', SHARED_WORKSPACE_ID)
            ),
            (snap) => {
              const bankAccounts = snap.docs.map((d) => d.data() as BankAccount);
              setDbState((prev) => ({ ...prev, bankAccounts }));
              markLoaded('bankAccounts');
            },
            (err) => {
              try {
                handleFirestoreError(
                  err,
                  OperationType.LIST,
                  `workspaces/${SHARED_WORKSPACE_ID}/bankAccounts`
                );
              } catch (wrapped) {
                setSyncError(wrapped as Error);
              }
            }
          )
        );

        unsubscribers.push(
          onSnapshot(
            query(
              collection(db, 'workspaces', SHARED_WORKSPACE_ID, 'wonSales'),
              where('workspaceId', '==', SHARED_WORKSPACE_ID)
            ),
            (snap) => {
              const wonSales = snap.docs.map((d) => d.data() as WonSale);
              setDbState((prev) => ({ ...prev, wonSales }));
              markLoaded('wonSales');
            },
            (err) => {
              try {
                handleFirestoreError(
                  err,
                  OperationType.LIST,
                  `workspaces/${SHARED_WORKSPACE_ID}/wonSales`
                );
              } catch (wrapped) {
                setSyncError(wrapped as Error);
              }
            }
          )
        );

        unsubscribers.push(
          onSnapshot(
            ratesRef,
            (snap) => {
              if (snap.exists()) {
                const data = snap.data() as {
                  USD?: number;
                  EUR?: number;
                  updatedAtLabel?: string;
                };
                setDbState((prev) => ({
                  ...prev,
                  exchangeRates: {
                    USD: data.USD ?? INITIAL_EXCHANGE_RATES.USD,
                    EUR: data.EUR ?? INITIAL_EXCHANGE_RATES.EUR,
                    updatedAt: data.updatedAtLabel ?? INITIAL_EXCHANGE_RATES.updatedAt,
                  },
                }));
              }
              markLoaded('exchangeRates');
            },
            (err) => {
              try {
                handleFirestoreError(
                  err,
                  OperationType.GET,
                  `workspaces/${SHARED_WORKSPACE_ID}/settings/exchangeRates`
                );
              } catch (wrapped) {
                setSyncError(wrapped as Error);
              }
            }
          )
        );
      } catch (err) {
        if (!cancelled) {
          try {
            handleFirestoreError(err, OperationType.WRITE, `workspaces/${SHARED_WORKSPACE_ID}`);
          } catch (wrapped) {
            setSyncError(wrapped as Error);
          }
        }
      }
    };

    void setupSharedWorkspaceAndListeners();

    return () => {
      cancelled = true;
      unsubscribers.forEach((u) => u());
    };
  }, [user]);

  const requireUid = (): string => {
    if (!user) throw new Error('Oturum açılmadı.');
    return user.uid;
  };

  const addCustomer = async (customerData: Omit<Customer, 'id'>): Promise<Customer> => {
    const uid = requireUid();
    const id = `cust-${Date.now()}`;
    const newCustomer: Customer = { ...customerData, id };
    const path = `workspaces/${SHARED_WORKSPACE_ID}/customers/${id}`;
    try {
      await setDoc(
        doc(db, 'workspaces', SHARED_WORKSPACE_ID, 'customers', id),
        buildCustomerCreatePayload(newCustomer, uid)
      );
      return newCustomer;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  const updateCustomer = async (id: string, patch: Partial<Customer>) => {
    const uid = requireUid();
    const existingCust = dbState.customers.find((c) => c.id === id);
    if (!existingCust) return;
    const merged: Customer = { ...existingCust, ...patch, id };
    const hadNotesBefore = typeof existingCust.notes === 'string';
    const payload = buildCustomerUpdatePayload(merged, uid, hadNotesBefore);
    const path = `workspaces/${SHARED_WORKSPACE_ID}/customers/${id}`;
    try {
      await updateDoc(doc(db, 'workspaces', SHARED_WORKSPACE_ID, 'customers', id), payload);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const deleteCustomer = async (customerId: string) => {
    const uid = requireUid();
    const path = `workspaces/${SHARED_WORKSPACE_ID}/customers/${customerId}`;
    try {
      const batch = writeBatch(db);
      const customerInvoices = dbState.invoices.filter((i) => i.customerId === customerId);
      const customerInvoiceIds = new Set(customerInvoices.map((i) => i.id));

      dbState.payments
        .filter((p) => p.customerId === customerId || customerInvoiceIds.has(p.invoiceId))
        .forEach((p) => {
          batch.delete(doc(db, 'workspaces', SHARED_WORKSPACE_ID, 'payments', p.id));
        });

      dbState.expenses
        .filter((e) => e.linkedInvoiceId && customerInvoiceIds.has(e.linkedInvoiceId))
        .forEach((e) => {
          batch.update(doc(db, 'workspaces', SHARED_WORKSPACE_ID, 'expenses', e.id), {
            linkedInvoiceId: deleteField(),
            updatedBy: uid,
            updatedAt: serverTimestamp(),
          });
        });

      customerInvoices.forEach((inv) => {
        batch.delete(doc(db, 'workspaces', SHARED_WORKSPACE_ID, 'invoices', inv.id));
      });

      dbState.wonSales
        .filter((s) => s.customerId === customerId)
        .forEach((s) => {
          batch.delete(doc(db, 'workspaces', SHARED_WORKSPACE_ID, 'wonSales', s.id));
        });

      batch.delete(doc(db, 'workspaces', SHARED_WORKSPACE_ID, 'customers', customerId));
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const addInvoice = async (
    invoiceData: Omit<Invoice, 'id' | 'invoiceNo'>,
    linkedCogsExpense?: Omit<Expense, 'id' | 'linkedInvoiceId'>
  ): Promise<Invoice> => {
    const uid = requireUid();
    const nextNum = dbState.invoices.length + 101;
    const invoiceId = `inv-${Date.now()}`;
    const yearPrefix = (invoiceData.issueDate || '2026').slice(0, 4);
    const newInvoice: Invoice = {
      ...invoiceData,
      id: invoiceId,
      invoiceNo: `PF-${yearPrefix}-${nextNum}`,
    };
    const path = `workspaces/${SHARED_WORKSPACE_ID}/invoices/${invoiceId}`;
    try {
      const batch = writeBatch(db);
      batch.set(
        doc(db, 'workspaces', SHARED_WORKSPACE_ID, 'invoices', invoiceId),
        buildInvoicePayload(newInvoice, uid)
      );
      if (linkedCogsExpense) {
        const expId = `exp-cogs-${Date.now()}`;
        const cogsExp: Expense = {
          ...linkedCogsExpense,
          id: expId,
          linkedInvoiceId: invoiceId,
        };
        batch.set(
          doc(db, 'workspaces', SHARED_WORKSPACE_ID, 'expenses', expId),
          buildExpensePayload(cogsExp, uid)
        );
      }
      await batch.commit();
      return newInvoice;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  const addRefundInvoice = async (
    refundData: Omit<Invoice, 'id' | 'invoiceNo' | 'invoiceType'>,
    immediatePayout?: {
      paymentDate: string;
      bankAccount: string;
      referenceNo?: string;
      note?: string;
    }
  ): Promise<Invoice> => {
    const uid = requireUid();
    const nextNum = dbState.invoices.length + 101;
    const invoiceId = `inv-ret-${Date.now()}`;
    const yearPrefix = (refundData.issueDate || '2026').slice(0, 4);
    const newInvoice: Invoice = {
      ...refundData,
      id: invoiceId,
      invoiceNo: `PF-IADE-${yearPrefix}-${nextNum}`,
      invoiceType: 'refund',
    };
    const path = `workspaces/${SHARED_WORKSPACE_ID}/invoices/${invoiceId}`;
    try {
      const batch = writeBatch(db);
      batch.set(
        doc(db, 'workspaces', SHARED_WORKSPACE_ID, 'invoices', invoiceId),
        buildInvoicePayload(newInvoice, uid)
      );
      if (immediatePayout && !newInvoice.isDraft) {
        const payId = `pay-ret-${Date.now()}`;
        const refundPayment: Payment = {
          id: payId,
          invoiceId,
          customerId: newInvoice.customerId,
          paymentDate: immediatePayout.paymentDate,
          amount: newInvoice.amount,
          currency: newInvoice.currency,
          fxRate: newInvoice.fxRateAtIssue,
          amountTry: newInvoice.amountTry,
          bankAccount: immediatePayout.bankAccount,
          paymentType: 'refund',
          referenceNo: immediatePayout.referenceNo,
          note: immediatePayout.note || `${newInvoice.invoiceNo} iade çıkışı`,
        };
        batch.set(
          doc(db, 'workspaces', SHARED_WORKSPACE_ID, 'payments', payId),
          buildPaymentPayload(refundPayment, uid)
        );
      }
      await batch.commit();
      return newInvoice;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  const updateInvoice = async (invoiceId: string, patch: Partial<Invoice>) => {
    const uid = requireUid();
    const existingInv = dbState.invoices.find((i) => i.id === invoiceId);
    if (!existingInv) return;
    const merged: Invoice = { ...existingInv, ...patch, id: invoiceId };
    const path = `workspaces/${SHARED_WORKSPACE_ID}/invoices/${invoiceId}`;
    try {
      const payload: Record<string, unknown> = {
        invoiceNo: clip(merged.invoiceNo, 40),
        customerId: merged.customerId,
        revenueModel: merged.revenueModel,
        title: clip(merged.title, 200),
        issueDate: merged.issueDate,
        dueDate: merged.dueDate,
        recognitionStartMonth: merged.recognitionStartMonth,
        recognitionMonths: Math.min(60, Math.max(1, Math.round(merged.recognitionMonths || 1))),
        currency: merged.currency,
        amount: Number(merged.amount),
        fxRateAtIssue: Number(merged.fxRateAtIssue),
        amountTry: Number(merged.amountTry),
        isDraft: Boolean(merged.isDraft),
        updatedBy: uid,
        updatedAt: serverTimestamp(),
      };
      if (merged.description && merged.description.trim()) {
        payload.description = clip(merged.description, 500);
      } else if (existingInv.description) {
        payload.description = deleteField();
      }
      if (typeof merged.linkedCogsTry === 'number' && merged.linkedCogsTry >= 0) {
        payload.linkedCogsTry = Number(merged.linkedCogsTry);
      } else if (typeof existingInv.linkedCogsTry === 'number') {
        payload.linkedCogsTry = deleteField();
      }
      if (merged.wonSaleId && merged.wonSaleId.trim()) {
        payload.wonSaleId = merged.wonSaleId.trim();
      } else if (existingInv.wonSaleId) {
        payload.wonSaleId = deleteField();
      }
      if (merged.invoiceType) {
        payload.invoiceType = merged.invoiceType;
      } else if (existingInv.invoiceType) {
        payload.invoiceType = deleteField();
      }
      if (merged.refundedInvoiceId && merged.refundedInvoiceId.trim()) {
        payload.refundedInvoiceId = merged.refundedInvoiceId.trim();
      } else if (existingInv.refundedInvoiceId) {
        payload.refundedInvoiceId = deleteField();
      }
      if (merged.refundSettlementMode) {
        payload.refundSettlementMode = merged.refundSettlementMode;
      } else if (existingInv.refundSettlementMode) {
        payload.refundSettlementMode = deleteField();
      }
      await updateDoc(doc(db, 'workspaces', SHARED_WORKSPACE_ID, 'invoices', invoiceId), payload);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const toggleInvoiceDraft = async (invoiceId: string, isDraft: boolean) => {
    const uid = requireUid();
    const path = `workspaces/${SHARED_WORKSPACE_ID}/invoices/${invoiceId}`;
    try {
      await updateDoc(doc(db, 'workspaces', SHARED_WORKSPACE_ID, 'invoices', invoiceId), {
        isDraft,
        updatedBy: uid,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const deleteInvoice = async (invoiceId: string) => {
    const uid = requireUid();
    const path = `workspaces/${SHARED_WORKSPACE_ID}/invoices/${invoiceId}`;
    try {
      const batch = writeBatch(db);
      dbState.payments
        .filter((p) => p.invoiceId === invoiceId)
        .forEach((p) => {
          batch.delete(doc(db, 'workspaces', SHARED_WORKSPACE_ID, 'payments', p.id));
        });
      dbState.expenses
        .filter((e) => e.linkedInvoiceId === invoiceId)
        .forEach((e) => {
          batch.update(doc(db, 'workspaces', SHARED_WORKSPACE_ID, 'expenses', e.id), {
            linkedInvoiceId: deleteField(),
            updatedBy: uid,
            updatedAt: serverTimestamp(),
          });
        });
      dbState.invoices
        .filter((i) => i.refundedInvoiceId === invoiceId)
        .forEach((i) => {
          batch.update(doc(db, 'workspaces', SHARED_WORKSPACE_ID, 'invoices', i.id), {
            refundedInvoiceId: deleteField(),
            updatedBy: uid,
            updatedAt: serverTimestamp(),
          });
        });
      batch.delete(doc(db, 'workspaces', SHARED_WORKSPACE_ID, 'invoices', invoiceId));
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const addPayment = async (paymentData: Omit<Payment, 'id'>): Promise<Payment> => {
    const uid = requireUid();
    const id = `pay-${Date.now()}`;
    const newPayment: Payment = { ...paymentData, id };
    const path = `workspaces/${SHARED_WORKSPACE_ID}/payments/${id}`;
    try {
      await setDoc(
        doc(db, 'workspaces', SHARED_WORKSPACE_ID, 'payments', id),
        buildPaymentPayload(newPayment, uid)
      );
      return newPayment;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  const deletePayment = async (paymentId: string) => {
    requireUid();
    const path = `workspaces/${SHARED_WORKSPACE_ID}/payments/${paymentId}`;
    try {
      await deleteDoc(doc(db, 'workspaces', SHARED_WORKSPACE_ID, 'payments', paymentId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const addExpense = async (expenseData: Omit<Expense, 'id'>): Promise<Expense> => {
    const uid = requireUid();
    const id = `exp-${Date.now()}`;
    const newExpense: Expense = { ...expenseData, id };
    const path = `workspaces/${SHARED_WORKSPACE_ID}/expenses/${id}`;
    try {
      await setDoc(
        doc(db, 'workspaces', SHARED_WORKSPACE_ID, 'expenses', id),
        buildExpensePayload(newExpense, uid)
      );
      return newExpense;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  const markExpensePaid = async (
    expenseId: string,
    paymentDate: string,
    bankAccount: string
  ) => {
    const uid = requireUid();
    const path = `workspaces/${SHARED_WORKSPACE_ID}/expenses/${expenseId}`;
    try {
      await updateDoc(doc(db, 'workspaces', SHARED_WORKSPACE_ID, 'expenses', expenseId), {
        status: 'paid',
        paymentDate,
        bankAccount: clip(bankAccount, 80),
        updatedBy: uid,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const markExpensePending = async (expenseId: string) => {
    const uid = requireUid();
    const existingExp = dbState.expenses.find((e) => e.id === expenseId);
    const path = `workspaces/${SHARED_WORKSPACE_ID}/expenses/${expenseId}`;
    try {
      const payload: Record<string, unknown> = {
        status: 'pending',
        updatedBy: uid,
        updatedAt: serverTimestamp(),
      };
      if (existingExp?.paymentDate) payload.paymentDate = deleteField();
      if (existingExp?.bankAccount) payload.bankAccount = deleteField();
      await updateDoc(doc(db, 'workspaces', SHARED_WORKSPACE_ID, 'expenses', expenseId), payload);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const deleteExpense = async (expenseId: string) => {
    requireUid();
    const path = `workspaces/${SHARED_WORKSPACE_ID}/expenses/${expenseId}`;
    try {
      await deleteDoc(doc(db, 'workspaces', SHARED_WORKSPACE_ID, 'expenses', expenseId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const generateRecurringExpensesForMonth = async (
    targetMonthKey: string
  ): Promise<number> => {
    const uid = requireUid();
    const prevMonth = addMonths(targetMonthKey, -1);
    const existingThisMonth = dbState.expenses.filter(
      (e) => getMonthKey(e.expenseDate) === targetMonthKey
    );

    const recurringTemplates = dbState.expenses.filter(
      (e) => e.isRecurring && getMonthKey(e.expenseDate) === prevMonth
    );

    const toCreate: Expense[] = [];
    recurringTemplates.forEach((tpl, idx) => {
      const alreadyExists = existingThisMonth.some(
        (e) => e.title === tpl.title && e.category === tpl.category
      );
      if (!alreadyExists) {
        const day = tpl.expenseDate.slice(8, 10) || '01';
        const dueDay = tpl.dueDate.slice(8, 10) || '15';
        const currentFx =
          tpl.currency === 'TRY'
            ? 1
            : tpl.currency === 'USD'
            ? dbState.exchangeRates.USD
            : dbState.exchangeRates.EUR;

        toCreate.push({
          ...tpl,
          id: `exp-rec-${targetMonthKey}-${Date.now()}-${idx}`,
          expenseDate: `${targetMonthKey}-${day}`,
          dueDate: `${targetMonthKey}-${dueDay}`,
          paymentDate: undefined,
          fxRate: currentFx,
          amountTry: Math.round(tpl.amount * currentFx),
          status: 'pending',
          note: `${targetMonthKey} tekrarlayan gider taslağı`,
        });
      }
    });

    if (toCreate.length > 0) {
      const path = `workspaces/${SHARED_WORKSPACE_ID}/expenses`;
      try {
        const batch = writeBatch(db);
        toCreate.forEach((exp) => {
          batch.set(
            doc(db, 'workspaces', SHARED_WORKSPACE_ID, 'expenses', exp.id),
            buildExpensePayload(exp, uid)
          );
        });
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
    }

    return toCreate.length;
  };

  const addBankAccount = async (accountData: Omit<BankAccount, 'id'>): Promise<BankAccount> => {
    const uid = requireUid();
    const id = `bank-${Date.now()}`;
    const newAccount: BankAccount = { ...accountData, id };
    const path = `workspaces/${SHARED_WORKSPACE_ID}/bankAccounts/${id}`;
    try {
      await setDoc(
        doc(db, 'workspaces', SHARED_WORKSPACE_ID, 'bankAccounts', id),
        buildBankAccountPayload(newAccount, uid)
      );
      return newAccount;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  const deleteBankAccount = async (accountId: string) => {
    requireUid();
    const path = `workspaces/${SHARED_WORKSPACE_ID}/bankAccounts/${accountId}`;
    try {
      await deleteDoc(doc(db, 'workspaces', SHARED_WORKSPACE_ID, 'bankAccounts', accountId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const updateExchangeRates = async (rates: Partial<ExchangeRates>) => {
    const uid = requireUid();
    const nextUsd = rates.USD ?? dbState.exchangeRates.USD;
    const nextEur = rates.EUR ?? dbState.exchangeRates.EUR;
    const updatedAtLabel = new Date().toISOString().slice(0, 10);
    const path = `workspaces/${SHARED_WORKSPACE_ID}/settings/exchangeRates`;
    try {
      await updateDoc(
        doc(db, 'workspaces', SHARED_WORKSPACE_ID, 'settings', 'exchangeRates'),
        {
          USD: Number(nextUsd),
          EUR: Number(nextEur),
          updatedAtLabel,
          updatedBy: uid,
          updatedAt: serverTimestamp(),
        }
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const clearAllData = async () => {
    requireUid();
    const path = `workspaces/${SHARED_WORKSPACE_ID}`;
    try {
      await deleteAllWorkspaceCollections();
      await updateDoc(doc(db, 'workspaces', SHARED_WORKSPACE_ID), {
        seeded: false,
        seedVersion: 2,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const addWonSale = async (saleData: Omit<WonSale, 'id'>): Promise<WonSale> => {
    const uid = requireUid();
    const id = `sale-${Date.now()}`;
    const newSale: WonSale = { ...saleData, id };
    const path = `workspaces/${SHARED_WORKSPACE_ID}/wonSales/${id}`;
    try {
      await setDoc(
        doc(db, 'workspaces', SHARED_WORKSPACE_ID, 'wonSales', id),
        buildWonSaleCreatePayload(newSale, uid)
      );
      return newSale;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  const updateWonSale = async (saleId: string, patch: Partial<WonSale>) => {
    const uid = requireUid();
    const existingSale = dbState.wonSales.find((s) => s.id === saleId);
    if (!existingSale) return;
    const merged: WonSale = { ...existingSale, ...patch, id: saleId };
    const path = `workspaces/${SHARED_WORKSPACE_ID}/wonSales/${saleId}`;
    try {
      await updateDoc(
        doc(db, 'workspaces', SHARED_WORKSPACE_ID, 'wonSales', saleId),
        buildWonSaleUpdatePayload(merged, uid, existingSale)
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const deleteWonSale = async (saleId: string) => {
    const uid = requireUid();
    const path = `workspaces/${SHARED_WORKSPACE_ID}/wonSales/${saleId}`;
    try {
      const batch = writeBatch(db);
      dbState.invoices
        .filter((inv) => inv.wonSaleId === saleId)
        .forEach((inv) => {
          batch.update(doc(db, 'workspaces', SHARED_WORKSPACE_ID, 'invoices', inv.id), {
            wonSaleId: deleteField(),
            updatedBy: uid,
            updatedAt: serverTimestamp(),
          });
        });
      batch.delete(doc(db, 'workspaces', SHARED_WORKSPACE_ID, 'wonSales', saleId));
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  return {
    db: dbState,
    loadingCloud,
    adminCount,
    currentRole: 'admin' as const,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    addInvoice,
    addRefundInvoice,
    updateInvoice,
    toggleInvoiceDraft,
    deleteInvoice,
    addPayment,
    deletePayment,
    addExpense,
    markExpensePaid,
    markExpensePending,
    deleteExpense,
    generateRecurringExpensesForMonth,
    addBankAccount,
    deleteBankAccount,
    addWonSale,
    updateWonSale,
    deleteWonSale,
    updateExchangeRates,
    clearAllData,
  };
}
