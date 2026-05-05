import { useEffect, useState } from "react";
import { api, fmtDate } from "../lib/api";
import PageHeader from "../components/PageHeader";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Checkbox } from "../components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Plus, Edit3, Trash2, Shield } from "lucide-react";
import { toast } from "sonner";

const PERM_GROUPS = [
  { label: "Operations", keys: ["dashboard", "customers", "segments", "vehicles", "quotations", "jobs"] },
  { label: "Catalog", keys: ["inventory_categories", "inventory_products", "services"] },
  { label: "Insights", keys: ["reports"] },
  { label: "Settings", keys: ["settings_roles", "settings_users", "settings_vehicle_management", "system_settings"] },
];

const labelFor = (k) => k.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

const empty = { name: "", description: "", active: true, permissions: {} };

export default function Roles() {
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);

  const load = async () => setList((await api.get("/roles")).data);
  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editId) await api.patch(`/roles/${editId}`, form);
      else await api.post("/roles", form);
      toast.success("Role saved");
      setOpen(false); setForm(empty); setEditId(null); load();
    } catch (err) { toast.error(err?.response?.data?.detail || "Failed"); }
  };

  const startEdit = (r) => { setForm({ name: r.name, description: r.description || "", active: r.active !== false, permissions: r.permissions || {} }); setEditId(r.id); setOpen(true); };

  const remove = async (r) => {
    if (!window.confirm(`Delete "${r.name}"?`)) return;
    try { await api.delete(`/roles/${r.id}`); toast.success("Deleted"); load(); }
    catch (err) { toast.error(err?.response?.data?.detail || "Failed"); }
  };

  const toggleAll = (group, on) => {
    setForm(f => ({ ...f, permissions: { ...f.permissions, ...Object.fromEntries(group.keys.map(k => [k, on])) } }));
  };

  return (
    <div data-testid="roles-page">
      <PageHeader title="Roles" subtitle="Settings"
        actions={<Button onClick={() => { setForm(empty); setEditId(null); setOpen(true); }} className="bg-[#0066FF] hover:bg-[#3385FF] rounded-sm" data-testid="new-role-btn"><Plus size={16} className="mr-1.5" /> New Role</Button>}
      />
      <div className="p-4 sm:p-8 space-y-3">
        {list.map(r => (
          <div key={r.id} className="border border-border bg-[#0F1115] rounded-sm p-4 sm:p-5 flex items-start justify-between gap-3 flex-col sm:flex-row" data-testid={`role-row-${r.id}`}>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Shield size={14} className="text-[#3385FF]" />
                <div className="font-display text-xl font-bold">{r.name}</div>
                <span className={`text-[10px] uppercase tracking-widest border rounded-sm px-2 py-0.5 ${r.active !== false ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/5" : "border-border text-muted-foreground"}`}>{r.active !== false ? "Active" : "Inactive"}</span>
                <span className="text-[10px] uppercase tracking-widest border border-border text-muted-foreground rounded-sm px-2 py-0.5">{r.user_count || 0} user{(r.user_count || 0) === 1 ? "" : "s"}</span>
              </div>
              <div className="text-sm text-muted-foreground mt-1">{r.description || "—"}</div>
              <div className="mt-2 flex flex-wrap gap-1">
                {Object.entries(r.permissions || {}).filter(([, v]) => v).slice(0, 12).map(([k]) => (
                  <span key={k} className="text-[10px] uppercase tracking-widest text-[#3385FF] border border-[#0066FF]/40 bg-[#0066FF]/10 rounded-sm px-2 py-0.5">{labelFor(k)}</span>
                ))}
              </div>
            </div>
            <div className="flex gap-2 self-start sm:self-center">
              <Button onClick={() => startEdit(r)} variant="outline" className="border-border rounded-sm" data-testid={`edit-role-${r.id}`}><Edit3 size={12} className="mr-1" /> Edit</Button>
              <button onClick={() => remove(r)} className="text-[#FF3B30] text-xs hover:underline px-2" data-testid={`del-role-${r.id}`}><Trash2 size={12} className="inline mr-1" />Delete</button>
            </div>
          </div>
        ))}
        {list.length === 0 && <div className="text-center text-muted-foreground py-16">No roles yet. Click "New Role" to create one.</div>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#0F1115] border-border rounded-sm max-w-3xl w-[calc(100vw-1.5rem)] sm:w-auto max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display text-2xl font-black tracking-tighter">{editId ? "Edit Role" : "New Role"}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-4 mt-2" data-testid="role-form">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label className="text-[10px] uppercase tracking-wider">Name *</Label><Input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="mt-1 bg-background border-border rounded-sm" data-testid="role-name" autoFocus /></div>
              <div><Label className="text-[10px] uppercase tracking-wider">Description</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="mt-1 bg-background border-border rounded-sm" /></div>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: !!v })} className="border-border" data-testid="role-active" />
              Active
            </label>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Permissions</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {PERM_GROUPS.map(g => (
                  <div key={g.label} className="border border-border rounded-sm p-3" data-testid={`perm-group-${g.label}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">{g.label}</div>
                      <div className="flex gap-1.5">
                        <button type="button" onClick={() => toggleAll(g, true)} className="text-[10px] text-[#3385FF] hover:underline">All</button>
                        <button type="button" onClick={() => toggleAll(g, false)} className="text-[10px] text-muted-foreground hover:underline">None</button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {g.keys.map(k => (
                        <label key={k} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox checked={!!form.permissions[k]} onCheckedChange={(v) => setForm(f => ({ ...f, permissions: { ...f.permissions, [k]: !!v } }))} className="border-border" data-testid={`perm-${k}`} />
                          {labelFor(k)}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <DialogFooter className="pt-3 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="border-border rounded-sm">Cancel</Button>
              <Button type="submit" className="bg-[#0066FF] hover:bg-[#3385FF] rounded-sm" data-testid="role-save">Save Role</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
