import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import PageHeader from "../components/PageHeader";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { ShieldAlert, Save, Lock, CreditCard, MessageCircle, Mail } from "lucide-react";
import { toast } from "sonner";

const TOGGLE_GROUPS = [
  { label: "Integrations", icon: Lock, items: [
    { key: "payment_gateway_enabled", title: "Payment Gateway", hint: "Enable Tap / MyFatoorah / OTTU configurations" },
    { key: "whatsapp_enabled", title: "WhatsApp Integration", hint: "Show share/send buttons across the app" },
    { key: "email_smtp_enabled", title: "Email SMTP", hint: "Show email send buttons (quotation/invoice email)" },
  ]},
  { label: "Payment Methods", icon: CreditCard, items: [
    { key: "payment_cash", title: "Cash" },
    { key: "payment_knet", title: "K-Net" },
    { key: "payment_card", title: "Credit Card" },
    { key: "payment_bank_transfer", title: "Bank Transfer" },
    { key: "payment_other", title: "Other / Custom" },
  ]},
];

const PAYMENT_PROVIDERS = [
  { id: "tap", name: "TAP Payment", fields: [
    { k: "api_key", label: "API Key", secret: true },
    { k: "secret_key", label: "Secret Key", secret: true },
    { k: "merchant_id", label: "Merchant ID" },
    { k: "callback_url", label: "Callback URL" },
    { k: "webhook_url", label: "Webhook URL" },
  ]},
  { id: "myfatoorah", name: "MyFatoorah", fields: [
    { k: "api_key", label: "API Token", secret: true },
    { k: "callback_url", label: "Callback URL" },
    { k: "webhook_url", label: "Webhook URL" },
  ]},
  { id: "ottu", name: "OTTU", fields: [
    { k: "api_key", label: "API Key", secret: true },
    { k: "merchant_id", label: "Merchant ID" },
    { k: "callback_url", label: "Callback URL" },
    { k: "webhook_url", label: "Webhook URL" },
  ]},
];

const WA_FIELDS = [
  { k: "provider", label: "Provider", placeholder: "e.g. Meta WhatsApp Business / Twilio / 360dialog" },
  { k: "base_url", label: "API Base URL", placeholder: "https://graph.facebook.com/v20.0" },
  { k: "access_token", label: "Access Token", secret: true },
  { k: "phone_number_id", label: "Sender / Phone Number ID" },
  { k: "template_quotation", label: "Template — Quotation Share" },
  { k: "template_invoice", label: "Template — Invoice Share" },
];

const SMTP_FIELDS = [
  { k: "host", label: "SMTP Host", placeholder: "smtp.example.com" },
  { k: "port", label: "Port", placeholder: "465 / 587" },
  { k: "username", label: "Username" },
  { k: "password", label: "Password / Secret", secret: true },
  { k: "from_email", label: "From Email", placeholder: "no-reply@wetworks.kw" },
  { k: "encryption", label: "Encryption", options: [["ssl", "SSL"], ["tls", "TLS"], ["none", "None"]] },
];

export default function SystemSettings() {
  const { user } = useAuth();
  const isMaster =
  user?.is_master === true ||
  user?.is_master_admin === true ||
  user?.isMasterAdmin === true;
  const [data, setData] = useState({ toggles: {}, integrations: {} });
  const [tab, setTab] = useState("toggles");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data: d } = await api.get("/system-settings");
    setData(d);
  };
  useEffect(() => { load(); }, []);

  const setToggle = (key, val) => {
    setData(d => ({ ...d, toggles: { ...d.toggles, [key]: val } }));
  };

  const saveToggles = async () => {
    if (!isMaster) return toast.error("Master admin only");
    setSaving(true);
    try {
      await api.put("/system-settings/toggles", data.toggles);
      toast.success("Saved");
      window.dispatchEvent(new CustomEvent("system-settings-updated"));
    } catch (err) { toast.error(err?.response?.data?.detail || "Failed"); }
    finally { setSaving(false); }
  };

  const saveIntegration = async (name) => {
    if (!isMaster) return toast.error("Master admin only");
    const cfg = data.integrations?.[name] || { enabled: false, fields: {} };
    try {
      const { data: out } = await api.put(`/system-settings/integrations/${name}`, cfg);
      setData(d => ({ ...d, integrations: { ...d.integrations, [name]: out } }));
      toast.success("Integration saved");
    } catch (err) { toast.error(err?.response?.data?.detail || "Failed"); }
  };

  const setIntField = (name, key, value) => {
    setData(d => ({
      ...d,
      integrations: {
        ...d.integrations,
        [name]: {
          enabled: d.integrations?.[name]?.enabled || false,
          fields: { ...(d.integrations?.[name]?.fields || {}), [key]: value },
        },
      },
    }));
  };
  const setIntEnabled = (name, val) => {
    setData(d => ({
      ...d,
      integrations: {
        ...d.integrations,
        [name]: { ...(d.integrations?.[name] || { fields: {} }), enabled: val },
      },
    }));
  };

  if (!isMaster) {
    return (
      <div data-testid="system-settings-page">
        <PageHeader title="System Settings" subtitle="Settings" />
        <div className="p-8">
          <div className="border border-[#FFCC00]/40 bg-[#FFCC00]/5 rounded-sm p-6 max-w-xl flex items-start gap-3" data-testid="master-only-block">
            <ShieldAlert size={20} className="text-[#FFCC00] mt-1 shrink-0" />
            <div>
              <div className="font-display text-lg font-bold text-[#FFCC00]">Master Admin Only</div>
              <div className="text-sm text-muted-foreground mt-1">System Settings — feature toggles and integration configurations — are restricted to Master Admins. Ask your master admin to grant you access if you need to make changes here.</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="system-settings-page">
      <PageHeader title="System Settings" subtitle="Master Admin"
        actions={tab === "toggles"
          ? <Button onClick={saveToggles} disabled={saving} className="bg-[#0066FF] hover:bg-[#3385FF] rounded-sm" data-testid="save-toggles"><Save size={14} className="mr-1.5" /> Save Toggles</Button>
          : null}
      />
      <div className="px-4 sm:px-8 pt-4 flex gap-2 border-b border-border overflow-x-auto" data-testid="settings-tabs">
        <Tab active={tab === "toggles"} onClick={() => setTab("toggles")} testid="tab-toggles">Feature Toggles</Tab>
        <Tab active={tab === "payments"} onClick={() => setTab("payments")} testid="tab-payment-providers">Payment Providers</Tab>
        <Tab active={tab === "whatsapp"} onClick={() => setTab("whatsapp")} testid="tab-whatsapp">WhatsApp</Tab>
        <Tab active={tab === "smtp"} onClick={() => setTab("smtp")} testid="tab-smtp">Email SMTP</Tab>
      </div>

      <div className="p-4 sm:p-8 space-y-6">
        {tab === "toggles" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {TOGGLE_GROUPS.map(g => {
              const Icon = g.icon;
              return (
                <div key={g.label} className="border border-border bg-[#0F1115] rounded-sm p-5">
                  <div className="flex items-center gap-2 mb-3"><Icon size={14} className="text-[#3385FF]" /><div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{g.label}</div></div>
                  <div className="space-y-3">
                    {g.items.map(it => (
                      <div key={it.key} className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold">{it.title}</div>
                          {it.hint && <div className="text-[11px] text-muted-foreground mt-0.5">{it.hint}</div>}
                        </div>
                        <Switch checked={!!data.toggles?.[it.key]} onCheckedChange={(v) => setToggle(it.key, v)} data-testid={`toggle-${it.key}`} />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === "payments" && (
          <div className="space-y-5">
            <div className="text-sm text-muted-foreground">Payment gateway providers commonly used in Kuwait. Secrets are stored masked — paste your real keys here, save, and they'll never be returned in plain text again.</div>
            {PAYMENT_PROVIDERS.map(p => (
              <ProviderCard key={p.id} title={p.name} envName={p.id} cfg={data.integrations?.[p.id]}
                fields={[...p.fields, { k: "environment", label: "Environment", options: [["sandbox", "Sandbox"], ["production", "Production"]] }]}
                onFieldChange={(k, v) => setIntField(p.id, k, v)}
                onEnabledChange={(v) => setIntEnabled(p.id, v)}
                onSave={() => saveIntegration(p.id)} />
            ))}
          </div>
        )}
        {tab === "whatsapp" && (
          <ProviderCard title="WhatsApp Integration" envName="whatsapp" cfg={data.integrations?.whatsapp}
            icon={MessageCircle} fields={WA_FIELDS}
            onFieldChange={(k, v) => setIntField("whatsapp", k, v)}
            onEnabledChange={(v) => setIntEnabled("whatsapp", v)}
            onSave={() => saveIntegration("whatsapp")} />
        )}
        {tab === "smtp" && (
          <ProviderCard title="Email SMTP" envName="email_smtp" cfg={data.integrations?.email_smtp}
            icon={Mail} fields={SMTP_FIELDS}
            onFieldChange={(k, v) => setIntField("email_smtp", k, v)}
            onEnabledChange={(v) => setIntEnabled("email_smtp", v)}
            onSave={() => saveIntegration("email_smtp")} />
        )}
      </div>
    </div>
  );
}

const Tab = ({ active, onClick, children, testid }) => (
  <button onClick={onClick} data-testid={testid}
    className={`px-4 py-2.5 text-xs uppercase tracking-widest font-semibold border-b-2 transition whitespace-nowrap ${active ? "border-[#0066FF] text-white" : "border-transparent text-muted-foreground hover:text-white"}`}>
    {children}
  </button>
);

function ProviderCard({ title, envName, cfg, fields, onFieldChange, onEnabledChange, onSave, icon: Icon }) {
  const f = cfg?.fields || {};
  return (
    <div className="border border-border bg-[#0F1115] rounded-sm p-5" data-testid={`provider-${envName}`}>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {Icon && <Icon size={14} className="text-[#3385FF]" />}
          <div className="font-display text-xl font-bold">{title}</div>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={!!cfg?.enabled} onCheckedChange={onEnabledChange} data-testid={`provider-enabled-${envName}`} />
            <span className="text-[11px] uppercase tracking-widest">{cfg?.enabled ? "Enabled" : "Disabled"}</span>
          </label>
          <Button onClick={onSave} size="sm" className="bg-[#0066FF] hover:bg-[#3385FF] rounded-sm" data-testid={`save-provider-${envName}`}><Save size={12} className="mr-1.5" /> Save</Button>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {fields.map(fld => (
          <div key={fld.k}>
            <Label className="text-[10px] uppercase tracking-wider">{fld.label}{fld.secret && <span className="ml-2 text-[#FFCC00] normal-case">secret</span>}</Label>
            {fld.options ? (
              <Select value={f[fld.k] || ""} onValueChange={(v) => onFieldChange(fld.k, v)}>
                <SelectTrigger className="mt-1 bg-background border-border rounded-sm h-9" data-testid={`field-${envName}-${fld.k}`}><SelectValue placeholder="Choose…" /></SelectTrigger>
                <SelectContent className="bg-[#0F1115] border-border">
                  {fld.options.map(([v, lbl]) => <SelectItem key={v} value={v}>{lbl}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <Input
                type={fld.secret ? "text" : "text"}
                value={f[fld.k] || ""}
                onChange={(e) => onFieldChange(fld.k, e.target.value)}
                placeholder={fld.placeholder || ""}
                className="mt-1 bg-background border-border rounded-sm h-9 font-mono-data"
                data-testid={`field-${envName}-${fld.k}`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
