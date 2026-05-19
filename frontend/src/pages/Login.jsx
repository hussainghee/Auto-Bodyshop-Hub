import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import WetworksLogo from "../assets/Wetworks-Logo.jpeg";

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
      nav("/", { replace: true });
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 bg-[#0F1115] border border-[#24262D] rounded-xl overflow-hidden shadow-2xl">
        {/* Left brand panel */}
        <div className="hidden lg:flex flex-col justify-between bg-[#8771B2] p-10 min-h-[620px]">
          <div>
            <img
              src={WetworksLogo}
              alt="WETWORKS Detailing Center"
              className="w-28 h-28 object-cover rounded-md"
              data-testid="brand-logo-large"
            />
          </div>

          <div>
            <div className="text-black font-display text-5xl font-black tracking-[0.18em] leading-none">
              WETWORKS
            </div>
            <div className="text-black text-sm uppercase tracking-[0.45em] mt-5 font-bold">
              Detailing Center
            </div>
          </div>

          <div className="text-black/80 text-xs uppercase tracking-[0.25em]">
            CRM Portal
          </div>
        </div>

        {/* Login form panel */}
        <div className="flex items-center justify-center p-8 sm:p-12">
          <form onSubmit={submit} className="w-full max-w-sm" data-testid="login-form">
            <div className="flex items-center gap-4 mb-10">
              <img
                src={WetworksLogo}
                alt="WETWORKS"
                className="w-14 h-14 object-cover rounded-md border border-[#D8D0EA]"
                data-testid="brand-logo"
              />

              <div>
                <div
                  className="font-display text-2xl font-black tracking-[0.18em] leading-none"
                  data-testid="brand"
                >
                  WETWORKS
                </div>
                <div className="text-[10px] uppercase tracking-[0.35em] text-[#A7AAB3] mt-2">
                  CRM
                </div>
              </div>
            </div>

            <div className="text-[10px] uppercase tracking-[0.3em] text-[#8771B2] mb-3 font-bold">
              Sign In
            </div>

            <h1 className="font-display text-3xl font-black tracking-tight mb-2">
              Sign in to WETWORKS CRM
            </h1>

            <p className="text-sm text-[#A7AAB3] mb-8">
              Manage customers, quotations, job cards and payments.
            </p>

            <div className="space-y-5">
              <div>
                <Label className="text-[10px] uppercase tracking-[0.2em] text-[#A7AAB3]">
                  Email or Mobile
                </Label>
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="text"
                  required
                  autoComplete="username"
                  className="mt-2 bg-[#050505] border-[#2D3038] h-11 rounded-md text-white placeholder:text-[#5F6470]"
                  data-testid="login-email"
                  placeholder="admin@example.com or 66778899"
                />
              </div>

              <div>
                <Label className="text-[10px] uppercase tracking-[0.2em] text-[#A7AAB3]">
                  Password
                </Label>
                <Input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  required
                  autoComplete="current-password"
                  className="mt-2 bg-[#050505] border-[#2D3038] h-11 rounded-md text-white placeholder:text-[#5F6470]"
                  data-testid="login-password"
                  placeholder="Enter password"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-md bg-[#8771B2] hover:bg-[#7662A3] text-white font-semibold uppercase tracking-wider text-sm"
                data-testid="login-submit"
              >
                {loading ? "Signing in…" : "Sign In →"}
              </Button>
            </div>

            <div className="mt-8 text-center text-[11px] text-[#6B7280]">
              WETWORKS Detailing Center · CRM
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
