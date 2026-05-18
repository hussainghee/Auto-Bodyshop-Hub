import { useEffect, useState } from "react";
import { api, fmtDate } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import PageHeader from "../components/PageHeader";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Checkbox } from "../components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../components/ui/dialog";
import { Plus, Edit3, Trash2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const empty = {
  first_name: "", last_name: "", mobile: "", email: "",
  role_id: "", is_master: false, password: "", active: true,
};

export default function Users() {
  const { user: currentUser } = useAuth();
  const [list, setList] = useState([]);
  const [roles, setRoles] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);

  const load = async () => {
    const [u, r] = await Promise.all([api.get("/users"), api.get("/roles")]);
    setList(u.data); setRoles(r.data);
  };
  useEffect(() => { load(); }, []);

const save = async (e) => {
  e.preventDefault();

  const payload = { ...form };

  if (editId && (!payload.password || payload.password.trim() === "")) {
    delete payload.password;
  }

  console.log("USER SAVE CLICKED", { editId, payload });

  try {
    if (editId) {
      const res = await api.patch(`/users/${editId}`, payload);
      console.log("USER UPDATE RESPONSE", res.data);
    } else {
      const res = await api.post("/users", payload);
      console.log("USER CREATE RESPONSE", res.data);
    }

    toast.success("User saved");
    setOpen(false);
    setForm(empty);
    setEditId(null);
    await load();
  } catch (err) {
    console.error("USER SAVE FAILED", err);
    toast.error(err?.response?.data?.detail || err?.message || "Failed to save user");
  }
};

  const startEdit = (u) => {
    setForm({
      first_name: u.first_name || "", last_name: u.last_name || "",
      mobile: u.mobile || "", email: u.email || "",
      role_id: u.role_id || "", is_master: !!u.is_master,
      password: "", active: u.active !== false,
    });
    setEditId(u.id); setOpen(true);
  };
  const remove = async (u) => {
    if (!window.confirm(`Delete ${u.name}?`)) return;
    try { await api.delete(`/users/${u.id}`); toast.success("Deleted"); load(); }
    catch (err) { toast.error(err?.response?.data?.detail || "Failed"); }
  };

  return (
    <div data-testid="users-page">
      <PageHeader title="Users" subtitle="Settings"
        actions={<Button onClick={() => { setForm({ ...empty, password: "wetworks123" }); setEditId(null); setOpen(true); }} className="bg-[#0066FF] hover:bg-[#3385FF] rounded-sm" data-testid="new-user-btn"><Plus size={16} className="mr-1.5" /> New User</Button>}
      />
      <div className="p-4 sm:p-8 space-y-4">
        <div className="border border-border bg-[#0F1115] rounded-sm overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full text-sm min-w-[780px]">
            <thead className="text-[10px] uppercase tracking-widest text-muted-foreground bg-[#0a0b0e]">
              <tr className="border-b border-border">
                <th className="text-left px-4 sm:px-6 py-3">Name</th>
                <th className="text-left px-4 sm:px-6 py-3">Mobile</th>
                <th className="text-left px-4 sm:px-6 py-3 hidden md:table-cell">Email</th>
                <th className="text-left px-4 sm:px-6 py-3">Role</th>
                <th className="text-left px-4 sm:px-6 py-3">Status</th>
                <th className="text-left px-4 sm:px-6 py-3 hidden lg:table-cell">Created</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map(u => (
                <tr key={u.id} className="border-b border-border/60 hover:bg-white/[0.02]" data-testid={`user-row-${u.id}`}>
                  <td className="px-4 sm:px-6 py-3 font-semibold">
                    {u.name}
                    {u.is_master && <span className="ml-2 text-[10px] uppercase tracking-widest text-[#FFCC00] border border-[#FFCC00]/40 bg-[#FFCC00]/10 rounded-sm px-2 py-0.5"><ShieldCheck size={10} className="inline mr-1" />Master</span>}
                  </td>
                  <td className="px-4 sm:px-6 py-3 font-mono-data text-muted-foreground">{u.mobile || "—"}</td>
                  <td className="px-4 sm:px-6 py-3 text-muted-foreground hidden md:table-cell">{u.email || "—"}</td>
                  <td className="px-4 sm:px-6 py-3 text-muted-foreground">{u.role_name || u.role || "—"}</td>
                  <td className="px-4 sm:px-6 py-3">
                    <span className={`text-[10px] uppercase tracking-widest border rounded-sm px-2 py-0.5 ${u.active !== false ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/5" : "border-border text-muted-foreground"}`}>{u.active !== false ? "Active" : "Inactive"}</span>
                  </td>
                  <td className="px-4 sm:px-6 py-3 text-muted-foreground hidden lg:table-cell">{u.created_at ? fmtDate(u.created_at) : "—"}</td>
                  <td className="px-4 sm:px-6 py-3 text-right">
                    <button onClick={() => startEdit(u)} className="text-[#3385FF] text-xs hover:underline mr-3" data-testid={`edit-user-${u.id}`}><Edit3 size={12} className="inline mr-1" />Edit</button>
                    {!u.is_master && <button onClick={() => remove(u)} className="text-[#FF3B30] text-xs hover:underline" data-testid={`del-user-${u.id}`}><Trash2 size={12} className="inline mr-1" />Delete</button>}
                  </td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">No users yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#0F1115] border-border rounded-sm max-w-2xl w-[calc(100vw-1.5rem)] sm:w-auto max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-black tracking-tighter">{editId ? "Edit User" : "New User"}</DialogTitle>
            <DialogDescription className="sr-only">Provide user name, mobile, role and password.</DialogDescription>
          </DialogHeader>
          <form onSubmit={save} className="space-y-3 mt-2" data-testid="user-form">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label className="text-[10px] uppercase tracking-wider">First Name *</Label><Input required value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} className="mt-1 bg-background border-border rounded-sm" data-testid="user-first-name" autoFocus /></div>
              <div><Label className="text-[10px] uppercase tracking-wider">Last Name</Label><Input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} className="mt-1 bg-background border-border rounded-sm" data-testid="user-last-name" /></div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider">Mobile *</Label>
                <Input required type="tel" value={form.mobile}
                  onKeyDown={(e) => {
                    if (["Backspace","ArrowLeft","ArrowRight","Delete","Tab","Home","End"].includes(e.key)) return;
                    if (e.metaKey || e.ctrlKey) return;
                    if (e.key === "+" && form.mobile === "") return;
                    if (!/^\d$/.test(e.key)) e.preventDefault();
                  }}
                  onChange={e => {
                    const v = e.target.value;
                    const cleaned = v.startsWith("+") ? "+" + v.slice(1).replace(/\D/g, "") : v.replace(/\D/g, "");
                    setForm({ ...form, mobile: cleaned });
                  }}
                  className="mt-1 bg-background border-border rounded-sm font-mono-data" data-testid="user-mobile"
                  placeholder="+96599887766" />
                <div className="text-[11px] text-muted-foreground mt-1">Used as login ID.</div>
              </div>
              <div><Label className="text-[10px] uppercase tracking-wider">Email (optional)</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="mt-1 bg-background border-border rounded-sm" data-testid="user-email" /></div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider">Role *</Label>
                <Select value={form.role_id} onValueChange={(v) => setForm({ ...form, role_id: v })}>
                  <SelectTrigger className="mt-1 bg-background border-border rounded-sm" data-testid="user-role"><SelectValue placeholder="Choose role" /></SelectTrigger>
                  <SelectContent className="bg-[#0F1115] border-border max-h-[280px]">
                    {roles.filter(r => r.active !== false).map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider">{editId ? "New Password (leave blank to keep)" : "Default Password"}</Label>
                <Input type="text" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="mt-1 bg-background border-border rounded-sm font-mono-data" data-testid="user-password" placeholder="wetworks123" />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: !!v })} className="border-border" data-testid="user-active" />
                Active
              </label>
              {currentUser?.is_master && (
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={form.is_master} onCheckedChange={(v) => setForm({ ...form, is_master: !!v })} className="border-border" data-testid="user-is-master" />
                  Master Admin (can configure System Settings)
                </label>
              )}
            </div>
            <DialogFooter className="pt-3 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="border-border rounded-sm">Cancel</Button>
              <Button type="submit" className="bg-[#0066FF] hover:bg-[#3385FF] rounded-sm" data-testid="user-save">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
