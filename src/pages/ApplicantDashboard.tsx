import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Inbox, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PortalHeader } from "@/components/PortalHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { usePortal } from "@/lib/portal-store";
import { addProgram, loadPrograms, OTHER_PROGRAM_VALUE } from "@/lib/programs";
import { STATUS_STYLES } from "@/lib/portal-types";

export function ApplicantDashboard() {
  const navigate = useNavigate();
  const { submissions, addSubmission, currentUser, authReady } = usePortal(); 
  
  const [programList, setProgramList] = useState<string[]>([]);
  const [program, setProgram] = useState("");
  const [customProgram, setCustomProgram] = useState("");
  const [title, setTitle] = useState("");
  const [essay, setEssay] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);

  useEffect(() => {
    if (authReady && !currentUser) {
      navigate("/login?role=applicant");
    }
  }, [authReady, currentUser, navigate]);

  useEffect(() => {
    setProgramList(loadPrograms());
  }, []);

  if (!authReady) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Loading your workspace...</span>
      </div>
    );
  }

  if (!currentUser) return null;

  const mine = submissions.filter((s) => s.studentEmail === currentUser?.email);

  const submit = (e: FormEvent) => {
    e.preventDefault();

    let finalProgram = program;

    if (program === OTHER_PROGRAM_VALUE) {
      if (!customProgram.trim()) {
        toast.error("Please enter the name of the new program.");
        return;
      }
      finalProgram = customProgram.trim();

      if (!programList.includes(finalProgram)) {
        const updated = addProgram(programList, finalProgram);
        setProgramList(updated);
        toast.success("Program added", {
          description: `"${finalProgram}" is now available for all applicants.`,
        });
      }
    }

    if (!finalProgram || !title.trim() || essay.trim().length < 50) {
      toast.error("Please complete all fields. Essays need at least 50 characters.");
      return;
    }

    addSubmission({
      program: finalProgram,
      title: title.trim(),
      essay: essay.trim(),
      isAnonymous,
    });
    toast.success("Application submitted", {
      description: isAnonymous
        ? `"${title}" was submitted with blind review enabled.`
        : `"${title}" is now pending review.`,
    });
    setProgram("");
    setCustomProgram("");
    setTitle("");
    setEssay("");
    setIsAnonymous(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <PortalHeader subtitle="Applicant workspace" />
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-10">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Welcome back
          </p>
          <h1 className="mt-1 font-serif text-3xl font-semibold text-foreground md:text-4xl">
            Hello, {currentUser?.name.split(" ")[0]}.
          </h1>
          <p className="mt-2 text-muted-foreground">
            Start a new application or check the status of essays you&apos;ve already submitted.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-serif text-xl">
                <FileText className="h-5 w-5 text-primary" />
                New application
              </CardTitle>
              <CardDescription>
                Select a program, add a title, and share your application essay.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={submit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="program">Program</Label>
                  <Select value={program} onValueChange={setProgram}>
                    <SelectTrigger id="program">
                      <SelectValue placeholder="Select a program" />
                    </SelectTrigger>
                    <SelectContent>
                      {programList.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                      <SelectItem value={OTHER_PROGRAM_VALUE} className="font-medium text-primary">
                        + Other (add new program)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {program === OTHER_PROGRAM_VALUE && (
                  <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                    <Label htmlFor="customProgram">New program name</Label>
                    <Input
                      id="customProgram"
                      placeholder="e.g. AUC Empower Scholarship"
                      value={customProgram}
                      onChange={(e) => setCustomProgram(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      This program will be saved permanently for everyone using the portal.
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="title">Essay title</Label>
                  <Input
                    id="title"
                    placeholder="e.g. The library that raised me"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="essay">Your essay</Label>
                    <span className="text-xs text-muted-foreground">
                      {essay.length.toLocaleString()} characters
                    </span>
                  </div>
                  <Textarea
                    id="essay"
                    placeholder="Write or paste your essay here..."
                    value={essay}
                    onChange={(e) => setEssay(e.target.value)}
                    className="min-h-[260px] resize-y leading-relaxed"
                  />
                </div>
                <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-4">
                  <Checkbox
                    id="anonymous"
                    checked={isAnonymous}
                    onCheckedChange={(checked) => setIsAnonymous(checked === true)}
                  />
                  <div className="grid gap-1 leading-none">
                    <Label
                      htmlFor="anonymous"
                      className="cursor-pointer font-medium leading-snug peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Keep my identity anonymous to reviewers
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Reviewers will see a generated ID instead of your name.
                    </p>
                  </div>
                </div>
                <Button type="submit" size="lg" className="gap-2">
                  <Send className="h-4 w-4" />
                  Submit application
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="font-serif text-xl">My submissions</CardTitle>
              <CardDescription>
                {mine.length} {mine.length === 1 ? "essay" : "essays"} submitted
              </CardDescription>
            </CardHeader>
            <CardContent>
              {mine.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12 text-center">
                  <Inbox className="mb-3 h-10 w-10 text-muted-foreground/60" />
                  <p className="text-sm font-medium text-foreground">No submissions yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Your applications will appear here.
                  </p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {mine.map((s) => (
                    <li
                      key={s.id}
                      className="rounded-lg border border-border bg-card p-4 transition-colors hover:bg-secondary/50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{s.title}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {s.program} &middot; {s.submittedAt}
                          </p>
                        </div>
                        <Badge variant="outline" className={STATUS_STYLES[s.status]}>
                          {s.status}
                        </Badge>
                      </div>
                      {s.feedback && (
                        <p className="mt-3 rounded-md bg-secondary p-3 text-sm italic text-secondary-foreground">
                          &ldquo;{s.feedback}&rdquo;
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}