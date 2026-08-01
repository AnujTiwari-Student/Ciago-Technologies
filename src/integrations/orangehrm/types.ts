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

export type UpdateEmployeeDetailsPayload = {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  employeeId?: string;
  otherId?: string;
  drivingLicenseNo?: string;
  drivingLicenseExpiredDate?: string;
  gender?: 1 | 2 | 3; // 1=Male, 2=Female, 3=Other
  maritalStatus?: string;
  birthday?: string;
  nationalityId?: number;
  militaryService?: string;
  smoker?: boolean;
};

export type EmployeeJobDetailsPayload = {
  jobTitleId?: number;
  empStatusId?: number; // Employment status ID
  jobCategoryId?: number;
  joinedDate?: string; // YYYY-MM-DD
  subUnitId?: number; // Department/Sub Unit
  locationId?: number;
};

export type EmployeeContactDetailsPayload = {
  addressStreet1?: string;
  addressStreet2?: string;
  city?: string;
  province?: string;
  zipCode?: string;
  countryCode?: string;
  homeTelephone?: string;
  mobile?: string;
  workTelephone?: string;
  workEmail?: string;
  otherEmail?: string;
};

export type JobVacancy = {
  id: number;
  jobTitleId: number;
  jobTitle: {
    id: number;
    title: string;
  };
  name: string;
  description?: string;
  numOfPositions?: number;
  status: boolean; // true = active, false = closed
  publishedInFeed: boolean;
  isPublished: boolean;
};

export type CreateJobVacancyPayload = {
  jobTitleId: number;
  name: string; // Job posting name/title
  description?: string;
  numOfPositions?: number;
  status?: boolean; // true = active, false = closed
  isPublished?: boolean;
};

export type UpdateJobVacancyPayload = Partial<CreateJobVacancyPayload>;

export type CreateUserPayload = {
  username: string;
  password: string;
  status: boolean;
  userRoleId: number;
  empNumber: number;
};
