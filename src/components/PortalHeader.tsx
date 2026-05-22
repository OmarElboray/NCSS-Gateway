import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GraduationCap, LogOut, MessageSquare, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePortal } from "@/lib/portal-store";
import { supabase } from "@/lib/supabase";

interface PortalHeaderProps {
  subtitle?: string;
}

export function PortalHeader({ subtitle }: PortalHeaderProps) {
  const { currentUser, logout } = usePortal();
  const navigate = useNavigate();

  // Modal State
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackType, setFeedbackType] = useState("help");
  const [message, setMessage] = useState("");

  const handleSignOut = () => {
    logout();
    navigate("/");
  };

  const handleSubmitFeedback = async (e: FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setIsSubmitting(true);

    // 👉 FIX 1: Tell TypeScript we are safely checking if Supabase exists
    if (!supabase) {
      toast.error("Database connection error");
      setIsSubmitting(false);
      return;
    }

    const { error } = await supabase.from('feedback').insert({ 
      user_email: currentUser?.email,
      category: feedbackType, 
      message: message 
    });

    setIsSubmitting(false);

    if (error) {
      toast.error("Failed to send message", { description: error.message });
      return;
    }

    // Reset the form and close the modal on success
    setIsOpen(false);
    setMessage("");
    setFeedbackType("help");

    toast.success("Message sent successfully!", {
      description: "Our administration team will review your request shortly.",
    });
  };

  return (
    <header className="border-b border-border bg-card/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <p className="font-serif text-lg font-semibold leading-tight text-foreground">
              School Portal
            </p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </Link>

        <div className="flex items-center gap-3">
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="hidden gap-2 sm:flex text-muted-foreground hover:text-foreground"
              >
                <MessageSquare className="h-4 w-4" />
                Feedback & Help
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle className="font-serif text-xl">Contact Administration</DialogTitle>
                <DialogDescription>
                  Send a message directly to the portal support team. We generally respond within 24 hours.
                </DialogDescription>
              </DialogHeader>
              
              <form onSubmit={handleSubmitFeedback} className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="category">How can we help?</Label>
                  <Select value={feedbackType} onValueChange={setFeedbackType}>
                    <SelectTrigger id="category">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="help">I need help with my application</SelectItem>
                      <SelectItem value="bug">I found a bug / error</SelectItem>
                      <SelectItem value="feature">I have a feature recommendation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Your Message</Label>
                  <Textarea
                    id="message"
                    placeholder="Please provide as much detail as possible..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="min-h-[120px] resize-none"
                    required
                  />
                </div>

                {/* 👉 FIX 2: Replaced DialogFooter with standard flexbox styling */}
                <div className="flex flex-col-reverse pt-4 sm:flex-row sm:justify-end sm:space-x-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setIsOpen(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting || !message.trim()} className="gap-2">
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Send Message
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          {currentUser && (
            <span className="hidden text-sm text-muted-foreground sm:inline border-l border-border pl-3 ml-1">
              {currentUser.name}
            </span>
          )}
          <Button variant="outline" size="sm" className="gap-2" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}