import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!isSupabaseConfigured || !supabase) {
      setError("App is not configured.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    // Supabase's password-recovery link signs the user into a temporary
    // session automatically when they land on this page, so updateUser()
    // here applies to the account that requested the reset.
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message || "Couldn't reset password. The link may have expired.");
      return;
    }
    setDone(true);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-primary/5 to-background px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Set a new password</CardTitle>
          <CardDescription>
            {done ? "Your password has been updated." : "Choose a new password for your account."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {done ? (
            <Button className="w-full" onClick={() => navigate("/login")}>
              Continue to sign in
            </Button>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm password</Label>
                <Input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
              </div>
              {error && (
                <p className="rounded-none border-2 border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating…
                  </>
                ) : (
                  "Update password"
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
