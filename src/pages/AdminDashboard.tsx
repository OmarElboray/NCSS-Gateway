import { FormEvent, useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Shield, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { PortalHeader } from "@/components/PortalHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { bulkInviteReviewers, type BulkInviteResult } from "@/lib/admin-api";
import { parseEmailList } from "@/lib/admin";
import { isSupabaseConfigured } from "@/lib/supabase";
import { usePortal } from "@/lib/portal-store"; // 👉 ADDED

export function AdminDashboard() {
  const navigate = useNavigate();
  // 👉 ADDED authReady and currentUser
  const { currentUser, authReady } = usePortal(); 

  const [rawEmails, setRawEmails] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BulkInviteResult | null>(null);

  // 👉 ADDED: The Dashboard Bouncer
  useEffect(() => {
    if (authReady && !currentUser) {
      // Boot unauthenticated users back to the home page
      navigate("/");
    }
  }, [authReady, currentUser, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setResult(null);

    const emails = parseEmailList(rawEmails);
    if (emails.length === 0) {
      toast.error("No valid emails", {
        description: "Paste one address per line (commas and semicolons also work).",
      });
      return;
    }

    if (!isSupabaseConfigured) {
      toast.error("Supabase is not configured.");
      return;
    }

    setLoading(true);
    const { data, error } = await bulkInviteReviewers(emails);
    setLoading(false);

    if (error) {
      toast.error("Bulk invite failed", { description: error });
      return;
    }

    if (!data) {
      toast.error("No response from server.");
      return;
    }

    setResult(data);
    const total = data.created.length + data.updated.length;
    toast.success("Bulk invite finished", {
      description: `${total} reviewer(s) processed, ${data.failed.length} failed.`,
    });
  };

  // 👉 ADDED: Show a loading spinner while Supabase checks local storage
  if (!authReady) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Loading admin dashboard...</span>
      </div>
    );
  }

  // 👉 ADDED: Prevent the page from flashing briefly before the redirect happens
  if (!currentUser) return null;

  return (
    <div className="min-h-screen bg-background">
      <PortalHeader subtitle="Admin — bulk reviewer invites" />

      <main className="mx-auto max-w-3xl px-6 py-10">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif text-2xl">
              <Shield className="h-6 w-6 text-primary" />
              Admin dashboard
            </CardTitle>
            <CardDescription>
              Create Supabase Auth accounts for reviewers and set their{" "}
              <code className="text-xs">profiles.role</code> to{" "}
              <code className="text-xs">reviewer</code>. Accounts use the default
              invite password configured on the server.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="emails">Reviewer email addresses</Label>
                <Textarea
                  id="emails"
                  placeholder={"reviewer1@school.edu\nreviewer2@school.edu"}
                  value={rawEmails}
                  onChange={(e) => setRawEmails(e.target.value)}
                  className="min-h-[220px] font-mono text-sm"
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">
                  {parseEmailList(rawEmails).length} valid address(es) detected
                </p>
              </div>

              <Button type="submit" className="w-full gap-2" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating accounts…
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    Bulk Add Reviewers
                  </>
                )}
              </Button>
            </form>

            {result && (
              <div className="mt-8 space-y-4 rounded-lg border border-border bg-muted/30 p-4 text-sm">
                <p>
                  <strong>Created:</strong> {result.created.length}
                  {result.created.length > 0 && (
                    <span className="mt-1 block font-mono text-xs text-muted-foreground">
                      {result.created.join(", ")}
                    </span>
                  )}
                </p>
                <p>
                  <strong>Updated to reviewer:</strong> {result.updated.length}
                  {result.updated.length > 0 && (
                    <span className="mt-1 block font-mono text-xs text-muted-foreground">
                      {result.updated.join(", ")}
                    </span>
                  )}
                </p>
                {result.failed.length > 0 && (
                  <div>
                    <strong className="text-destructive">Failed:</strong>
                    <ul className="mt-2 list-inside list-disc space-y-1 font-mono text-xs">
                      {result.failed.map((f) => (
                        <li key={f.email}>
                          {f.email}: {f.error}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <p className="mt-6 text-center text-sm">
              <Link to="/" className="text-muted-foreground hover:text-foreground">
                &larr; Back to home
              </Link>
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}