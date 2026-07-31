/**
 * TypeScript types for OrangeHRM API v5.
 * Docs: https://opensource.orangehrmlive.com/apidoc/
 */

export type OrangeHRMEmployee = {
  empNumber: number;
  employeeId: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  email?: string;
  mobileNumber?: string;
  joinedDate?: string;
  terminationId?: number | null;
};

export type OrangeHRMSalary = {
  id: number;
  empNumber: number;
  amount: string;
  currencyId: string;
  currencyType?: {
    id: string;
    name: string;
  };
  salaryComponent: {
    id: number;
    name: string;
  };
  payGrade?: {
    id: number;
    name: string;
  };
  payFrequency?: {
    id: number;
    name: string;
  };
  directDebit?: {
    account?: string;
    accountType?: string;
    routingNumber?: string;
  };
};

export type OrangeHRMUser = {
  id: number;
  userName: string;
  userRole: {
    id: number;
    name: string;
    displayName: string;
  };
  status: boolean;
  employee: {
    empNumber: number;
    employeeId: string;
    firstName: string;
    lastName: string;
    terminationId: number | null;
  };
};

export type CreateEmployeePayload = {
  firstName: string;
  middleName?: string;
  lastName: string;
  employeeId?: string;
  empNumber?: number;
};

export type CreateUserPayload = {
  username: string;
  password: string;
  status: boolean;
  userRoleId: number;
  empNumber: number;
};
