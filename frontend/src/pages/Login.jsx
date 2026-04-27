import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "sonner";

export default function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("admin@autocrm.kw");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Welcome back");
      nav("/", { replace: true });
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Login failed");
    } finally { setLoading(false); }
  };

  const seed = async () => {
    setSeeding(true);
    try {
      const { data } = await api.post("/seed");
      toast.success(data.seeded ? "Sample data loaded" : "Already seeded");
    } catch { toast.error("Seed failed"); }
    finally { setSeeding(false); }
  };

  return (
    <div className="min-h-screen bg-background grid md:grid-cols-2">
      <div className="relative hidden md:block">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1759673735031-b6eabfc82261?crop=entropy&cs=srgb&fm=jpg&q=85')" }} />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-transparent" />
        <div className="relative h-full flex flex-col justify-between p-12">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 brand-stripe rounded-sm" />
            <div className="font-display text-2xl font-black tracking-tighter">AUTO/CRM</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.4em] text-[#0066FF] mb-3">Kuwait • KWD</div>
            <h2 className="font-display text-5xl font-black leading-none tracking-tighter mb-4">Workshop<br/>Command Center</h2>
            <p className="text-muted-foreground max-w-md leading-relaxed">Paint protection, tinting, full-body paint, and car wash operations — quoted, tracked, and delivered with precision.</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center p-8 bg-[#050505]">
        <form onSubmit={submit} className="w-full max-w-sm" data-testid="login-form">
          <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-2">Sign In</div>
          <h1 className="font-display text-4xl font-black tracking-tighter mb-8">Welcome back.</h1>

          <div className="space-y-4">
            <div>
              <Label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Email</Label>
              <Input value={email} onChange={e => setEmail(e.target.value)} type="email" required className="mt-1.5 bg-[#0F1115] border-border h-11 rounded-sm" data-testid="login-email" />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Password</Label>
              <Input value={password} onChange={e => setPassword(e.target.value)} type="password" required className="mt-1.5 bg-[#0F1115] border-border h-11 rounded-sm" data-testid="login-password" />
            </div>
            <Button type="submit" disabled={loading} className="w-full h-11 rounded-sm bg-[#0066FF] hover:bg-[#3385FF] text-white font-semibold uppercase tracking-wider text-sm" data-testid="login-submit">
              {loading ? "Signing in…" : "Sign In →"}
            </Button>
          </div>

          <div className="mt-8 border border-border rounded-sm p-4">
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2">Demo Credentials</div>
            <div className="text-xs font-mono-data space-y-0.5 text-muted-foreground">
              <div>admin@autocrm.kw / admin123</div>
              <div>sales@autocrm.kw / sales123</div>
              <div>tech@autocrm.kw / tech123</div>
            </div>
            <button type="button" onClick={seed} disabled={seeding} className="mt-3 text-xs text-[#3385FF] hover:underline" data-testid="seed-btn">
              {seeding ? "Loading sample data…" : "Load sample data →"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
