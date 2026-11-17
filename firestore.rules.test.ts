// Security Rules Verification Specification for PinkFinance
// Covers the 12 "Dirty Dozen" adversarial payloads defined in security_spec.md

export interface SecurityTestCase {
  id: string;
  description: string;
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  expected: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TESTS: SecurityTestCase[] = [
  {
    id: 'DD-01',
    description: 'Unauthenticated client attempts to list shared workspace customers',
    path: '/workspaces/pinkfinance/customers',
    operation: 'list',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-02',
    description: 'Unverified email token attempting write operation',
    path: '/workspaces/pinkfinance/expenses/exp-1',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-03',
    description: 'Member spoofing: User A attempts to register membership for User B',
    path: '/workspaces/pinkfinance/members/userB',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-04',
    description: 'Shadow field injection (superAdmin: true) on Customer create',
    path: '/workspaces/pinkfinance/customers/cust-2',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-05',
    description: 'Orphaned Invoice referencing non-existent customerId',
    path: '/workspaces/pinkfinance/invoices/inv-1',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-06',
    description: 'Orphaned Payment referencing non-existent invoiceId',
    path: '/workspaces/pinkfinance/payments/pay-1',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-07',
    description: 'ID poisoning with oversized / invalid character document ID',
    path: '/workspaces/pinkfinance/customers/invalid id $$$',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-08',
    description: 'Client timestamp spoofing on createdAt instead of serverTimestamp',
    path: '/workspaces/pinkfinance/invoices/inv-2',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-09',
    description: 'Immutable createdBy / createdAt mutation on Customer update',
    path: '/workspaces/pinkfinance/customers/cust-1',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-10',
    description: 'Negative financial amount injection on Invoice create',
    path: '/workspaces/pinkfinance/invoices/inv-3',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-11',
    description: 'Immutable workspaceId/createdBy mutation during Invoice update',
    path: '/workspaces/pinkfinance/invoices/inv-1',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-12',
    description: 'PII blanket read on /users/userA/private/profile by non-owner',
    path: '/users/userA/private/profile',
    operation: 'get',
    expected: 'PERMISSION_DENIED',
  },
];
