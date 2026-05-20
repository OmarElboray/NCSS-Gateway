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
const SUBMISSIONS_KEY = "school_portal_submissions";
const USERS_KEY = "school_portal_users";

const MOCK_SUBMISSIONS: Submission[] = [
  {
    id: "sub-1",
    studentName: "Alex Rivera",
    studentEmail: "alex@student.edu",
    program: "Yale Young Global Scholars (YYGS)",
    title: "Why I Build Software",
    essay:
      "From my first line of Python to leading our robotics club, technology has been the lens through which I understand the world. I want to study computer science to design tools that make education more accessible in underserved communities.",
    status: "Under Review",
    feedback: "",
    submittedAt: "2026-05-10",
    isAnonymous: false,
  },
  {
    id: "sub-2",
    studentName: "Jordan Lee",
    studentEmail: "jordan@student.edu",
    program: "United World Colleges (UWC)",
    title: "Entrepreneurship and Community",
    essay:
      "Running a small tutoring marketplace taught me that business is not only about profit but about solving real problems for people you care about. I hope to combine finance and social impact in my undergraduate studies.",
    status: "Pending",
    feedback: "",
    submittedAt: "2026-05-14",
    isAnonymous: true,
  },
];

function normalizeSubmission(s: Submission): Submission {
  return { ...s, isAnonymous: Boolean(s.isAnonymous) };
}

function loadSubmissions(): Submission[] {
  try {
    const raw = localStorage.getItem(SUBMISSIONS_KEY);
    if (raw) {
      return (JSON.parse(raw) as Submission[]).map(normalizeSubmission);
    }
  } catch {
    /* ignore */
  }
  return MOCK_SUBMISSIONS;
}

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
  const [submissions, setSubmissions] = useState<Submission[]>(loadSubmissions);
  const [registeredUsers, setRegisteredUsers] = useState<PortalUser[]>(loadRegisteredUsers);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    localStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(submissions));
  }, [submissions]);

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

        // 🐛 THE DEBUG LOGGER: Check your browser console when you click signup!
        console.log("SUPABASE RAW RESPONSE:", { data, error });

        // 1. Catch actual errors 
        if (error) {
          return { ok: false, error: error.message };
        }

        // 🚨 1.5. THE ENUMERATION BYPASS: Catches hidden duplicate emails!
        if (data?.user?.identities && data.user.identities.length === 0) {
          return { ok: false, error: "An account with this email already exists." };
        }

        // 2. Handle successful signup requiring email confirmation (User exists, Session is null)
        if (data.user && !data.session) {
          return { 
            ok: true, 
            needsEmailConfirmation: true, 
            message: "Success! Please check your email to verify your account." 
          };
        }

        // 3. Fallback for catastrophic failure
        if (!data.user) {
          return { ok: false, error: "Could not create account." };
        }

        // 4. Handle successful signup where they are instantly logged in
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
      setSubmissions((prev) => [entry, ...prev]);
    },
    [currentUser]
  );

  const updateSubmission = useCallback(
    async (id: string, updates: { status?: SubmissionStatus; feedback?: string }) => {
      if (isSupabaseConfigured && !id.startsWith("sub-")) {
        const { error } = await updateSubmissionInDb(id, updates);
        if (error) console.error("Supabase submission update failed:", error);
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