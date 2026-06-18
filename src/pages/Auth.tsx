import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

const emailSchema = z.string().trim().email("Please enter a valid email address").max(255);
const passwordSchema = z.string().min(6, "Password must be at least 6 characters").max(128);

/** Turn raw Supabase auth errors into clear, friendly messages. */
function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Incorrect email or password. Please try again.";
  if (m.includes("email not confirmed")) return "Please confirm your email before signing in.";
  if (m.includes("user already registered") || m.includes("already been registered"))
    return "An account with this email already exists. Try signing in instead.";
  if (m.includes("password should be") || m.includes("weak"))
    return "Please choose a stronger password (at least 6 characters).";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Too many attempts. Please wait a moment and try again.";
  if (m.includes("network")) return "Network error. Check your connection and try again.";
  return message;
}

export default function Auth() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/";
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"auth" | "forgot">("auth");

  useEffect(() => {
    if (!authLoading && user) navigate(next, { replace: true });
  }, [user, authLoading, navigate, next]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    const ev = emailSchema.safeParse(email);
    const pv = passwordSchema.safeParse(password);
    if (!ev.success || !pv.success) {
      toast({
        title: "Check your details",
        description: ev.success ? pv.error.issues[0].message : ev.error.issues[0].message,
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) {
      toast({ title: "Sign in failed", description: friendlyAuthError(error.message), variant: "destructive" });
      return;
    }
    toast({ title: "Welcome back!", description: "You're signed in." });
    navigate(next, { replace: true });
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    const ev = emailSchema.safeParse(email);
    const pv = passwordSchema.safeParse(password);
    if (!ev.success || !pv.success) {
      toast({
        title: "Check your details",
        description: ev.success ? pv.error.issues[0].message : ev.error.issues[0].message,
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { display_name: name.trim() || email.split("@")[0] },
      },
    });
    setLoading(false);
    if (error) {
      toast({ title: "Sign up failed", description: friendlyAuthError(error.message), variant: "destructive" });
      return;
    }
    // With auto-confirm enabled, a session is returned immediately.
    if (data.session) {
      toast({ title: "Account created!", description: "Welcome to Convertify — enjoy your 20 free credits." });
      navigate(next, { replace: true });
    } else {
      toast({ title: "Check your email", description: "We sent a confirmation link to verify your account." });
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    const ev = emailSchema.safeParse(email);
    if (!ev.success) {
      toast({ title: "Check your email", description: ev.error.issues[0].message, variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast({ title: "Could not send email", description: friendlyAuthError(error.message), variant: "destructive" });
      return;
    }
    toast({ title: "Email sent", description: "Check your inbox for a password reset link." });
    setMode("auth");
  }

  async function handleGoogle() {
    if (loading) return;
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast({ title: "Google sign-in failed", description: result.error.message, variant: "destructive" });
      return;
    }
    if (!result.redirected) navigate(next, { replace: true });
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-background">
      <Link to="/" className="flex items-center gap-2 mb-8 font-bold text-xl">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg gradient-primary shadow-glow">
          <Sparkles className="h-5 w-5 text-primary-foreground" />
        </span>
        <span className="text-gradient">Convertify</span>
      </Link>

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{mode === "forgot" ? "Reset your password" : "Welcome"}</CardTitle>
          <CardDescription>
            {mode === "forgot"
              ? "Enter your email and we'll send you a reset link."
              : "Sign in or create an account to continue."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mode === "forgot" ? (
            <form onSubmit={handleForgot} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="fp-email">Email</Label>
                <Input id="fp-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Sending..." : "Send reset link"}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => setMode("auth")}>
                Back to sign in
              </Button>
            </form>
          ) : (
            <>
              <Tabs defaultValue="signin">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="signin">Sign in</TabsTrigger>
                  <TabsTrigger value="signup">Sign up</TabsTrigger>
                </TabsList>

                <TabsContent value="signin">
                  <form onSubmit={handleSignIn} className="space-y-3">
                    <div className="space-y-1">
                      <Label htmlFor="si-email">Email</Label>
                      <Input id="si-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="si-pass">Password</Label>
                      <Input id="si-pass" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? "Signing in..." : "Sign in"}
                    </Button>
                    <button
                      type="button"
                      className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => setMode("forgot")}
                    >
                      Forgot your password?
                    </button>
                  </form>
                </TabsContent>

                <TabsContent value="signup">
                  <form onSubmit={handleSignUp} className="space-y-3">
                    <div className="space-y-1">
                      <Label htmlFor="su-name">Name (optional)</Label>
                      <Input id="su-name" value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="su-email">Email</Label>
                      <Input id="su-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="su-pass">Password</Label>
                      <Input id="su-pass" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? "Creating..." : "Create account"}
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">You'll get 20 free credits on signup.</p>
                  </form>
                </TabsContent>
              </Tabs>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or</span>
                </div>
              </div>

              <Button type="button" variant="outline" className="w-full" onClick={handleGoogle} disabled={loading}>
                Continue with Google
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
