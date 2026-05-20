import type { Submission } from "@/lib/portal-types";

/** Stable anonymous label for reviewers (e.g. Applicant-X89). */
export function getReviewerDisplayName(submission: Submission): string {
  if (!submission.isAnonymous) {
    return submission.studentName;
  }

  const token = submission.id.replace(/[^a-zA-Z0-9]/g, "").slice(-3).toUpperCase() || "UNK";
  return `Applicant-${token}`;
}
