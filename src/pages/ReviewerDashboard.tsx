import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  CheckCircle2,
  ClipboardList,
  FileSearch,
  RotateCcw,
  XCircle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { PortalHeader } from "@/components/PortalHeader";
import { ReviewerExpertiseSection } from "@/components/ReviewerExpertiseSection";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getReviewerDisplayName } from "@/lib/blind-review";
import { usePortal } from "@/lib/portal-store";
import { STATUS_STYLES, type Submission, type SubmissionStatus } from "@/lib/portal-types";

export function ReviewerDashboard() {
  const navigate = useNavigate();
  // 👉 ADDED authReady and currentUser
  const { submissions, updateSubmission, currentUser, authReady } = usePortal();
  
  const [selected, setSelected] = useState<Submission | null>(null);
  const [feedback, setFeedback] = useState("");

  // 👉 ADDED: The Dashboard Bouncer
  useEffect(() => {
    if (authReady && !currentUser) {
      navigate("/login?role=reviewer");
    }
  }, [authReady, currentUser, navigate]);

  const stats = useMemo(() => {
    const total = submissions.length;
    const pending = submissions.filter(
      (s) => s.status === "Pending" || s.status === "Under Review"
    ).length;
    return { total, pending };
  }, [submissions]);

  const openSubmission = (submission: Submission) => {
    setSelected(submission);
    setFeedback(submission.feedback);
  };

  const closeModal = () => {
    setSelected(null);
    setFeedback("");
  };

  const applyReview = (status: SubmissionStatus) => {
    if (!selected) return;
    if (!feedback.trim() && status !== "Under Review") {
      toast.error("Please add feedback before updating the decision.");
      return;
    }

    updateSubmission(selected.id, { status, feedback: feedback.trim() });
    toast.success("Review saved", {
      description: `${getReviewerDisplayName(selected)}'s application is now "${status}".`,
    });
    closeModal();
  };

  // 👉 ADDED: Show a loading spinner while Supabase checks local storage
  if (!authReady) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Loading reviewer dashboard...</span>
      </div>
    );
  }

  // 👉 ADDED: Prevent the page from flashing briefly before the redirect happens
  if (!currentUser) return null;

  return (
    <div className="min-h-screen bg-background">
      <PortalHeader subtitle="Reviewer workspace" />
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-10">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Faculty dashboard
          </p>
          <h1 className="mt-1 font-serif text-3xl font-semibold text-foreground md:text-4xl">
            Application reviews
          </h1>
          <p className="mt-2 text-muted-foreground">
            Review student essays, leave feedback, and update application status.
          </p>
        </div>

        <ReviewerExpertiseSection />

        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:max-w-xl">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Total applications
              </CardDescription>
              <CardTitle className="text-3xl font-serif">{stats.total}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />
                Pending reviews
              </CardDescription>
              <CardTitle className="text-3xl font-serif">{stats.pending}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif text-xl">
              <FileSearch className="h-5 w-5 text-primary" />
              All submissions
            </CardTitle>
            <CardDescription>Click a row to read the full essay and submit a review.</CardDescription>
          </CardHeader>
          <CardContent>
            {submissions.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
                <ClipboardList className="mb-3 h-10 w-10 text-muted-foreground/60" />
                <p className="text-sm font-medium text-foreground">No submissions yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Student applications will appear here when submitted.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="pb-3 pr-4 font-medium">Student</th>
                      <th className="pb-3 pr-4 font-medium">Program</th>
                      <th className="pb-3 pr-4 font-medium">Title</th>
                      <th className="pb-3 pr-4 font-medium">Date</th>
                      <th className="pb-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submissions.map((s) => (
                      <tr
                        key={s.id}
                        className="cursor-pointer border-b border-border/70 transition-colors hover:bg-secondary/40"
                        onClick={() => openSubmission(s)}
                      >
                        <td className="py-4 pr-4 font-medium text-foreground">
                          <span className="flex items-center gap-2">
                            {getReviewerDisplayName(s)}
                            {s.isAnonymous && (
                              <Badge variant="secondary" className="text-[10px] font-normal">
                                Blind
                              </Badge>
                            )}
                          </span>
                        </td>
                        <td className="py-4 pr-4 text-muted-foreground">{s.program}</td>
                        <td className="max-w-[200px] truncate py-4 pr-4">{s.title}</td>
                        <td className="py-4 pr-4 text-muted-foreground">{s.submittedAt}</td>
                        <td className="py-4">
                          <Badge variant="outline" className={STATUS_STYLES[s.status]}>
                            {s.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="max-w-3xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="font-serif text-xl">{selected.title}</DialogTitle>
                <DialogDescription>
                  {getReviewerDisplayName(selected)}
                  {selected.isAnonymous ? " (blind review)" : ""} &middot; {selected.program}{" "}
                  &middot; {selected.submittedAt}
                </DialogDescription>
              </DialogHeader>

              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {selected.essay}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="feedback">Feedback for student</Label>
                <Textarea
                  id="feedback"
                  placeholder="Share constructive feedback on this application..."
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  className="min-h-[120px]"
                />
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  className="gap-2"
                  onClick={() => applyReview("Accepted")}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Accept
                </Button>
                <Button
                  variant="destructive"
                  className="gap-2"
                  onClick={() => applyReview("Rejected")}
                >
                  <XCircle className="h-4 w-4" />
                  Reject
                </Button>
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => applyReview("Revision Requested")}
                >
                  <RotateCcw className="h-4 w-4" />
                  Request revision
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => applyReview("Under Review")}
                >
                  Mark under review
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}