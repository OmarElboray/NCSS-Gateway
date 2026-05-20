export type UserRole = "applicant" | "reviewer";

export type SubmissionStatus =
  | "Pending"
  | "Under Review"
  | "Accepted"
  | "Rejected"
  | "Revision Requested";

export interface PortalUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface Submission {
  id: string;
  studentName: string;
  studentEmail: string;
  program: string;
  title: string;
  essay: string;
  status: SubmissionStatus;
  feedback: string;
  submittedAt: string;
  isAnonymous: boolean;
}

export const STATUS_STYLES: Record<SubmissionStatus, string> = {
  Pending: "border-amber-200 bg-amber-50 text-amber-800",
  "Under Review": "border-blue-200 bg-blue-50 text-blue-800",
  Accepted: "border-emerald-200 bg-emerald-50 text-emerald-800",
  Rejected: "border-red-200 bg-red-50 text-red-800",
  "Revision Requested": "border-violet-200 bg-violet-50 text-violet-800",
};
