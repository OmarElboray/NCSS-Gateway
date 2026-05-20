import { Link } from "react-router-dom";
import { BookOpen, ClipboardCheck, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { isAdminEmail } from "@/lib/admin";
import { usePortal } from "@/lib/portal-store";

export function LandingPage() {
  const { currentUser, authReady } = usePortal();
  const showAdminLink = authReady && isAdminEmail(currentUser?.email);

  return (
    <div className="min-h-screen bg-background">
      <main>
        <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-primary/5 via-background to-background">
          <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">
              Admissions workspace
            </p>
            <h1 className="mt-4 max-w-3xl font-serif text-4xl font-semibold leading-tight text-foreground md:text-5xl">
              Apply with confidence. Review with clarity.
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
              Students submit program essays in one place. Faculty review submissions, leave
              feedback, and update decisions without leaving the portal.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button asChild size="lg" className="text-base">
                <Link to="/login?role=applicant">I&apos;m an applicant</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="text-base">
                <Link to="/login?role=reviewer">I&apos;m a reviewer</Link>
              </Button>
              {showAdminLink && (
                <Button asChild size="lg" variant="secondary" className="text-base">
                  <Link to="/admin-dashboard">Admin dashboard</Link>
                </Button>
              )}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <BookOpen className="mb-4 h-8 w-8 text-primary" />
                <h2 className="font-serif text-lg font-semibold">Submit essays</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Choose a program, add a title, and submit your application essay in minutes.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <ClipboardCheck className="mb-4 h-8 w-8 text-primary" />
                <h2 className="font-serif text-lg font-semibold">Track status</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  See whether your submission is pending, under review, accepted, or needs revision.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <Shield className="mb-4 h-8 w-8 text-primary" />
                <h2 className="font-serif text-lg font-semibold">Faculty review</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Reviewers read full essays, write feedback, and update application decisions.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </div>
  );
}