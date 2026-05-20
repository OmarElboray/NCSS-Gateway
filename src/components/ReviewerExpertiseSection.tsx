import { useEffect, useState } from "react";
import { BookMarked, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { loadPrograms } from "@/lib/programs";
import {
  ensureReviewerProfile,
  fetchReviewerProfile,
  isSupabaseConfigured,
  saveReviewerExpertise,
} from "@/lib/reviewer-profile";
import { usePortal } from "@/lib/portal-store";

export function ReviewerExpertiseSection() {
  const { currentUser } = usePortal();
  const [programList, setProgramList] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setProgramList(loadPrograms());
  }, []);

  useEffect(() => {
    if (!currentUser || currentUser.role !== "reviewer") return;

    const load = async () => {
      setLoading(true);

      if (!isSupabaseConfigured) {
        setLoading(false);
        return;
      }

      let { profile, error } = await fetchReviewerProfile(currentUser.id);

      if (!profile && !error) {
        const ensured = await ensureReviewerProfile(
          currentUser.id,
          currentUser.email,
          currentUser.name
        );
        if (!ensured.ok) {
          toast.error("Could not load profile", { description: ensured.error ?? undefined });
          setLoading(false);
          return;
        }
        const refetch = await fetchReviewerProfile(currentUser.id);
        profile = refetch.profile;
        error = refetch.error;
      }

      if (error) {
        toast.error("Could not load expertise", { description: error });
      } else if (profile) {
        setSelected(new Set(profile.expertise_programs));
      }

      setLoading(false);
    };

    load();
  }, [currentUser]);

  const toggleProgram = (program: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(program);
      else next.delete(program);
      return next;
    });
  };

  const handleSave = async () => {
    if (!currentUser) return;

    if (!isSupabaseConfigured) {
      toast.error("Connect Supabase in the Lovable sidebar to save expertise.");
      return;
    }

    setSaving(true);
    const expertise = Array.from(selected).sort();
    const result = await saveReviewerExpertise(currentUser.id, expertise);
    setSaving(false);

    if (!result.ok) {
      toast.error("Could not save expertise", { description: result.error ?? undefined });
      return;
    }

    toast.success("Expertise saved", {
      description:
        expertise.length === 0
          ? "You will not receive program-routed emails until you select programs."
          : `You will be notified for ${expertise.length} program(s).`,
    });
  };

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-serif text-xl">
          <BookMarked className="h-5 w-5 text-primary" />
          My expertise
        </CardTitle>
        <CardDescription>
          Select the programs you can review. When an applicant submits for one of these programs,
          you will automatically receive an email notification.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!isSupabaseConfigured ? (
          <p className="rounded-lg border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            Add <code className="text-xs">VITE_SUPABASE_URL</code> and{" "}
            <code className="text-xs">VITE_SUPABASE_ANON_KEY</code> in the Lovable sidebar to
            enable expertise routing and email notifications.
          </p>
        ) : loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading your expertise…
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              {programList.map((program) => {
                const id = `expertise-${program.replace(/\W+/g, "-")}`;
                const checked = selected.has(program);
                return (
                  <div
                    key={program}
                    className="flex items-start gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-secondary/30"
                  >
                    <Checkbox
                      id={id}
                      checked={checked}
                      onCheckedChange={(value) => toggleProgram(program, value === true)}
                    />
                    <Label htmlFor={id} className="cursor-pointer text-sm leading-snug">
                      {program}
                    </Label>
                  </div>
                );
              })}
            </div>
            <div className="mt-6 flex items-center justify-between gap-4">
              <p className="text-xs text-muted-foreground">
                {selected.size} program{selected.size === 1 ? "" : "s"} selected
              </p>
              <Button onClick={handleSave} disabled={saving} className="gap-2">
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save expertise
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
