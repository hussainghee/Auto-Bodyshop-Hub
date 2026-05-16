import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "sonner";

const LOGO = "https://customer-assets.emergentagent.com/job_vehicle-care-crm/artifacts/d5acrado_Wetworks-Logo.jpeg";

export default function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);


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


  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm" data-testid="login-form">
        <div className="flex items-center gap-3 mb-10">
          <img src={LOGO} alt="Wetworks" className="w-14 h-14 rounded-sm object-cover" data-testid="brand-logo" />
          <div>
            <div className="font-display text-3xl font-black tracking-tighter leading-none" data-testid="brand">Wetworks</div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mt-2">CRM</div>
          </div>
        </div>

        <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-2">Sign In</div>
        <h1 className="font-display text-3xl font-black tracking-tighter mb-8">Sign in to Wetworks CRM</h1>

        <div className="space-y-4">
          <div>
            <Label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Email or Mobile</Label>
            <Input value={email} onChange={e => setEmail(e.target.value)} type="text" required className="mt-1.5 bg-[#0F1115] border-border h-11 rounded-sm" data-testid="login-email" placeholder="admin@wetworks.kw or +965..." />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Password</Label>
            <Input value={password} onChange={e => setPassword(e.target.value)} type="password" required className="mt-1.5 bg-[#0F1115] border-border h-11 rounded-sm" data-testid="login-password" />
          </div>
          <Button type="submit" disabled={loading} className="w-full h-11 rounded-sm bg-[#0066FF] hover:bg-[#3385FF] text-white font-semibold uppercase tracking-wider text-sm" data-testid="login-submit">
            {loading ? "Signing in…" : "Sign In →"}
          </Button>
        </div>


      </form>
    </div>
  );
}
