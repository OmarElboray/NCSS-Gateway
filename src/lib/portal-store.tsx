import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  type PortalUser,
  type Submission,
  type SubmissionStatus,
  type UserRole,
} from "@/lib/portal-types";
import { insertSubmission, updateSubmissionInDb } from "@/lib/submissions-api";
import {
  fetchAuthProfile,
  portalUserFromAuth,
} from "@/lib/profile";
import {
  getInitialSession,
  isSupabaseConfigured,
  onAuthStateChange,
  supabase,
} from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

const SESSION_KEY = "school_portal_session";
const USERS_KEY = "school_portal_users";



function loadRegisteredUsers(): PortalUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (raw) return JSON.parse(raw) as PortalUser[];
  } catch {
    /* ignore */
  }
  return [
    {
      id: "demo-applicant",
      name: "Demo Student",
      email: "student@school.edu",
      role: "applicant",
    },
    {
      id: "demo-reviewer",
      name: "Dr. Morgan",
      email: "reviewer@school.edu",
      role: "reviewer",
    },
  ];
}

function loadSession(): PortalUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) return JSON.parse(raw) as PortalUser;
  } catch {
    /* ignore */
  }
  return null;
}

interface PortalContextValue {
  currentUser: PortalUser | null;
  submissions: Submission[];
  authReady: boolean;
  login: (
    email: string,
    password: string,
    role: UserRole
  ) => Promise<{ ok: boolean; error?: string; role?: UserRole }>;
  signup: (
    name: string,
    email: string,
    password: string,
    confirmPassword: string
  ) => Promise<{ ok: boolean; error?: string; message?: string; needsEmailConfirmation?: boolean }>;
  logout: () => Promise<void>;
  addSubmission: (data: {
    program: string;
    title: string;
    essay: string;
    isAnonymous: boolean;
  }) => void;
  updateSubmission: (
    id: string,
    updates: { status?: SubmissionStatus; feedback?: string }
  ) => void;
}

const PortalContext = createContext<PortalContextValue | null>(null);

export function PortalProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<PortalUser | null>(loadSession);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [registeredUsers, setRegisteredUsers] = useState<PortalUser[]>(loadRegisteredUsers);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    localStorage.setItem(USERS_KEY, JSON.stringify(registeredUsers));
  }, [registeredUsers]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(currentUser));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  }, [currentUser]);

  // 1. Bootstrap Authentication
  useEffect(() => {
    let cancelled = false;

    const syncUserFromSupabase = async (authUser: User) => {
      const { profile, error } = await fetchAuthProfile(authUser.id);
      if (cancelled) return;
      if (error) {
        console.error("Failed to load profile:", error);
        setCurrentUser(portalUserFromAuth(authUser, null));
        return;
      }
      setCurrentUser(portalUserFromAuth(authUser, profile));
    };

    const bootstrap = async () => {
      const session = await getInitialSession();
      if (!cancelled && session?.user) {
        if (isSupabaseConfigured) {
          await syncUserFromSupabase(session.user);
        } else {
          const meta = session.user.user_metadata ?? {};
          setCurrentUser({
            id: session.user.id,
            name: (meta.full_name as string) ?? session.user.email ?? "User",
            email: session.user.email ?? "",
            role: (meta.role as UserRole) ?? "applicant",
          });
        }
      }
      if (!cancelled) setAuthReady(true);
    };

    bootstrap();

    const unsubscribe = onAuthStateChange((session) => {
      if (!session?.user) {
        if (!localStorage.getItem(SESSION_KEY)) setCurrentUser(null);
        return;
      }
      if (isSupabaseConfigured) {
        void syncUserFromSupabase(session.user);
        return;
      }
      const meta = session.user.user_metadata ?? {};
      setCurrentUser({
        id: session.user.id,
        name: (meta.full_name as string) ?? session.user.email ?? "User",
        email: session.user.email ?? "",
        role: (meta.role as UserRole) ?? "applicant",
      });
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  // 👉 2. NEW: Fetch LIVE Submissions from Supabase with Bulletproof Data Mapping
  useEffect(() => {
    if (!currentUser || !isSupabaseConfigured || !supabase) {
      setSubmissions([]);
      return;
    }

    const fetchLiveSubmissions = async () => {
      if (!supabase) return; 

      // 1. Fetch the data without the strict SQL ordering to prevent column-name crashes
      const { data, error } = await supabase
        .from("submissions")
        .select("*");

      if (error) {
        console.error("Error fetching submissions:", error);
        return;
      }
      
      if (data) {
        // 2. Translate the database snake_case columns to frontend camelCase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const formattedData = data.map((row: any) => ({
          id: row.id,
          studentName: row.student_name || row.studentName || "Unknown Student",
          studentEmail: row.student_email || row.studentEmail || "No Email",
          program: row.program || "Unknown Program",
          title: row.title || "Untitled",
          essay: row.essay || "",
          status: row.status || "Pending",
          feedback: row.feedback || "",
          submittedAt: row.created_at || row.submitted_at || row.submittedAt || new Date().toISOString(),
          isAnonymous: Boolean(row.is_anonymous || row.isAnonymous),
        }));

        // 3. Sort the array newest-to-oldest in JavaScript instead of SQL
        const sortedData = formattedData.sort((a, b) => 
          new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
        );

        setSubmissions(sortedData);
      }
    };
    
    fetchLiveSubmissions();
  }, [currentUser]);

  const login = useCallback(
    async (email: string, password: string, role: UserRole) => {
      const normalized = email.trim().toLowerCase();
      if (!normalized || password.length < 6) {
        return { ok: false, error: "Invalid credentials" };
      }

      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: normalized,
          password,
        });

        if (error) {
          return { ok: false, error: "Invalid credentials" };
        }

        const { profile, error: profileError } = await fetchAuthProfile(data.user.id);

        if (profileError) {
          await supabase.auth.signOut();
          return { ok: false, error: profileError };
        }

        if (!profile) {
          await supabase.auth.signOut();
          return {
            ok: false,
            error: "No profile found for this account. Contact an administrator.",
          };
        }

        const user = portalUserFromAuth(data.user, profile);
        setCurrentUser(user);
        return { ok: true, role: user.role };
      }

      const user = registeredUsers.find(
        (u) => u.email.toLowerCase() === normalized && u.role === role
      );

      if (!user) {
        return { ok: false, error: "Invalid credentials" };
      }

      setCurrentUser(user);
      return { ok: true, role: user.role };
    },
    [registeredUsers]
  );

  const signup = useCallback(
    async (name: string, email: string, password: string, confirmPassword: string) => {
      const normalized = email.trim().toLowerCase();
      if (!name.trim()) return { ok: false, error: "Full name is required." };
      if (!normalized.includes("@")) return { ok: false, error: "Enter a valid email." };
      if (password.length < 6) return { ok: false, error: "Password must be at least 6 characters." };
      if (password !== confirmPassword) return { ok: false, error: "Passwords do not match." };

      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.auth.signUp({
          email: normalized,
          password,
          options: {
            data: {
              full_name: name.trim(),
              role: "applicant",
            },
          },
        });

        if (error) {
          return { ok: false, error: error.message };
        }

        if (data?.user?.identities && data.user.identities.length === 0) {
          return { ok: false, error: "An account with this email already exists." };
        }

        if (data.user && !data.session) {
          return { 
            ok: true, 
            needsEmailConfirmation: true, 
            message: "Success! Please check your email to verify your account." 
          };
        }

        if (!data.user) {
          return { ok: false, error: "Could not create account." };
        }

        if (data.session) {
          setCurrentUser({
            id: data.user.id,
            name: name.trim(),
            email: normalized,
            role: "applicant",
          });
          return { ok: true, message: "Account created successfully!" };
        }
      }

      if (registeredUsers.some((u) => u.email.toLowerCase() === normalized)) {
        return { ok: false, error: "An account with this email already exists." };
      }

      const user: PortalUser = {
        id: `user-${Date.now()}`,
        name: name.trim(),
        email: normalized,
        role: "applicant",
      };

      setRegisteredUsers((prev) => [...prev, user]);
      setCurrentUser(user);
      return { ok: true, message: "Account created successfully!" };
    },
    [registeredUsers]
  );

  const logout = useCallback(async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    setCurrentUser(null);
    localStorage.removeItem(SESSION_KEY);
  }, []);

  const addSubmission = useCallback(
    async (data: { program: string; title: string; essay: string; isAnonymous: boolean }) => {
      if (!currentUser) return;

      let id = `sub-${Date.now()}`;

      if (isSupabaseConfigured && !currentUser.id.startsWith("demo-")) {
        // 👉 Using your existing submissions-api wrapper to insert!
        const { id: dbId, error } = await insertSubmission({
          studentUserId: currentUser.id,
          studentName: currentUser.name,
          studentEmail: currentUser.email,
          program: data.program,
          title: data.title,
          essay: data.essay,
          isAnonymous: data.isAnonymous,
        });

        if (error) {
          console.error("Supabase submission insert failed:", error);
          return; // Stop if it fails to save to the DB
        } else if (dbId) {
          id = dbId;
        }
      }

      const entry: Submission = {
        id,
        studentName: currentUser.name,
        studentEmail: currentUser.email,
        program: data.program,
        title: data.title,
        essay: data.essay,
        status: "Pending",
        feedback: "",
        submittedAt: new Date().toISOString().slice(0, 10),
        isAnonymous: data.isAnonymous,
      };
      
      // Update the UI immediately without needing to refresh the page
      setSubmissions((prev) => [entry, ...prev]);
    },
    [currentUser]
  );

  const updateSubmission = useCallback(
    async (id: string, updates: { status?: SubmissionStatus; feedback?: string }) => {
      if (isSupabaseConfigured && !id.startsWith("sub-")) {
        const { error } = await updateSubmissionInDb(id, updates);
        if (error) {
          console.error("Supabase submission update failed:", error);
          return;
        }
      }

      setSubmissions((prev) =>
        prev.map((s) =>
          s.id === id
            ? {
                ...s,
                ...(updates.status !== undefined ? { status: updates.status } : {}),
                ...(updates.feedback !== undefined ? { feedback: updates.feedback } : {}),
              }
            : s
        )
      );
    },
    []
  );

  const value = useMemo(
    () => ({
      currentUser,
      submissions,
      authReady,
      login,
      signup,
      logout,
      addSubmission,
      updateSubmission,
    }),
    [
      currentUser,
      submissions,
      authReady,
      login,
      signup,
      logout,
      addSubmission,
      updateSubmission,
    ]
  );

  return <PortalContext.Provider value={value}>{children}</PortalContext.Provider>;
}

export function usePortal() {
  const ctx = useContext(PortalContext);
  if (!ctx) throw new Error("usePortal must be used within PortalProvider");
  return ctx;
}