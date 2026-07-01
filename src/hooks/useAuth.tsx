import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
};

const ADMIN_EMAIL = "yb109324@gmail.com";

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  loading: true,
  isAdmin: false,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function applySession(s: Session | null) {
      if (!mounted) return;
      setLoading(true);
      setSession(s);
      setUser(s?.user ?? null);

      if (!s?.user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      const admin = await checkAdmin(s.user);
      if (!mounted) return;
      setIsAdmin(admin);
      setLoading(false);
    }

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setTimeout(() => void applySession(s), 0);
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      void applySession(s);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function checkAdmin(currentUser: User) {
    const emailIsAdmin = currentUser.email?.toLowerCase() === ADMIN_EMAIL;

    try {
      const { data: ensured } = await (supabase as any).rpc("ensure_user_account");
      if (ensured?.is_admin === true || emailIsAdmin) return true;

      const { data } = await supabase.rpc("has_role", {
        _user_id: currentUser.id,
        _role: "admin",
      });
      return !!data;
    } catch (error) {
      console.error("Admin role check failed:", error);
      return emailIsAdmin;
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        isAdmin,
        signOut: async () => {
          await supabase.auth.signOut();
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
