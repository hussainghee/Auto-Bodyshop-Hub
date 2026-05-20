import { useEffect, useState } from "react";
import { api } from "../lib/api";
import PageHeader from "../components/PageHeader";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Plus, Trash2, Edit3 } from "lucide-react";
import { toast } from "sonner";

export default function Settings() {
  const [users, setUsers] = useState([]);
  const [vts, setVts] = useState([]);
  const [makes, setMakes] = useState([]);

  const [userOpen, setUserOpen] = useState(false);
  const [userForm, setUserForm] = useState({ name: "", email: "", password: "", role: "sales" });

  const [makeOpen, setMakeOpen] = useState(false);
  const [makeForm, setMakeForm] = useState({ label: "", models: [] });
  const [modelInput, setModelInput] = useState("");
  const [editingMakeId, setEditingMakeId] = useState(null);

  const load = async () => {
    const [u, v, m] = await Promise.all([api.get("/users"), api.get("/vehicle-types"), api.get("/vehicle-makes")]);
    setUsers(u.data); setVts(v.data); setMakes(m.data);
  };
  useEffect(() => { load(); }, []);

  const saveUser = async (e) => {
    e.preventDefault();
    try {
      await api.post("/users", userForm);
      toast.success("User created");
      setUserOpen(false); setUserForm({ name: "", email: "", password: "", role: "sales" }); load();
    } catch (err) { toast.error(err?.response?.data?.detail || "Failed"); }
  };

  const openNewMake = () => {
    setMakeForm({ label: "", models: [] }); setEditingMakeId(null); setMakeOpen(true);
  };
  const openEditMake = (m) => {
    setMakeForm({ label: m.label, models: [...m.models] }); setEditingMakeId(m.id); setMakeOpen(true);
  };
  const addModel = () => {
    if (!modelInput.trim()) return;
    setMakeForm({ ...makeForm, models: [...makeForm.models, modelInput.trim()] });
    setModelInput("");
  };
  const saveMake = async (e) => {
    e.preventDefault();
    try {
      if (editingMakeId) await api.patch(`/vehicle-makes/${editingMakeId}`, makeForm);
      else await api.post("/vehicle-makes", makeForm);
      toast.success("Saved");
      setMakeOpen(false); load();
    } catch (err) { toast.error(err?.response?.data?.detail || "Failed"); }
  };
  const deleteMake = async (id) => {
    if (!window.confirm("Delete this make?")) return;
    await api.delete(`/vehicle-makes/${id}`);
    load();
  };

  return (
    <div data-testid="settings-page">
      <PageHeader title="Settings" subtitle="Admin" />
      <div className="p-8 space-y-6">
        {/* USERS */}
        <div className="border border-border bg-[#0F1115] rounded-sm">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Users & Roles</div>
            <Button onClick={() => setUserOpen(true)} size="sm" className="bg-[#0066FF] hover:bg-[#3385FF] rounded-sm"><Plus size={14} className="mr-1" /> New User</Button>
          </div>
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-widest text-muted-foreground bg-[#0a0b0e]">
              <tr className="border-b border-border">
  <th className="text-left px-6 py-3">Name</th>
  <th className="text-left px-6 py-3">Mobile</th>
  <th className="text-left px-6 py-3">Email</th>
  <th className="text-left px-6 py-3">Role</th>
  <th className="text-left px-6 py-3">Status</th>
</tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-border/60">
                  <td className="px-6 py-3 font-semibold">{u.name}</td>
                  <td className="px-6 py-3 font-mono-data text-muted-foreground">
                    {u.mobile || u.phone || u.mobile_number || "—"}
                  </td>
                  <td className="px-6 py-3 font-mono-data text-muted-foreground">
                    {u.email || "—"}
                  </td>
                  <td className="px-6 py-3"><span className="text-[10px] uppercase tracking-wider px-2 py-1 border border-border rounded-sm">{u.role}</span></td>
                  <td className="px-6 py-3 text-emerald-400 text-xs uppercase tracking-wider">{u.active === false ? "Disabled" : "Active"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* VEHICLE MAKES */}
        <div className="border border-border bg-[#0F1115] rounded-sm">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Vehicle Makes & Models</div>
              <div className="text-xs text-muted-foreground mt-1">Kuwait market presets. Add/edit as needed.</div>
            </div>
            <Button onClick={openNewMake} size="sm" className="bg-[#0066FF] hover:bg-[#3385FF] rounded-sm" data-testid="new-make-btn"><Plus size={14} className="mr-1" /> New Make</Button>
          </div>
          <div className="p-6 grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {makes.map(m => (
              <div key={m.id} className="border border-border rounded-sm p-3" data-testid={`make-${m.id}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-display font-bold">{m.label}</div>
                  <div className="flex gap-1">
                    <button onClick={() => openEditMake(m)} className="text-muted-foreground hover:text-white p-1" data-testid={`edit-make-${m.id}`}><Edit3 size={12} /></button>
                    <button onClick={() => deleteMake(m.id)} className="text-muted-foreground hover:text-[#FF3B30] p-1"><Trash2 size={12} /></button>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">{m.models.length} models</div>
                <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{m.models.slice(0, 5).join(", ")}{m.models.length > 5 ? "…" : ""}</div>
              </div>
            ))}
            {makes.length === 0 && <div className="col-span-full text-center text-sm text-muted-foreground py-8">No makes added yet. Run seed or click "New Make".</div>}
          </div>
        </div>

        {/* VEHICLE TYPES (view only) */}
        <div className="border border-border bg-[#0F1115] rounded-sm">
          <div className="px-6 py-4 border-b border-border text-[10px] uppercase tracking-widest text-muted-foreground">Vehicle Types & Areas</div>
          <div className="p-6 grid md:grid-cols-2 gap-4">
            {vts.map(t => (
              <div key={t.id} className="border border-border rounded-sm p-4">
                <div className="font-display text-lg font-bold">{t.label}</div>
                <div className="text-[11px] uppercase tracking-widest text-muted-foreground mt-1">key: {t.key}</div>
                <div className="mt-3 text-sm">{t.panels?.length || 0} panels · {t.glass_areas?.length || 0} glass areas</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* NEW USER MODAL */}
      <Dialog open={userOpen} onOpenChange={setUserOpen}>
        <DialogContent className="bg-[#0F1115] border-border rounded-sm">
          <DialogHeader><DialogTitle className="font-display text-2xl font-black tracking-tighter">New User</DialogTitle></DialogHeader>
          <form onSubmit={saveUser} className="space-y-3 mt-2">
            <div><Label className="text-[10px] uppercase tracking-wider">Name *</Label><Input required value={userForm.name} onChange={e => setUserForm({...userForm, name: e.target.value})} className="mt-1 bg-background border-border rounded-sm" /></div>
            <div><Label className="text-[10px] uppercase tracking-wider">Email *</Label><Input required type="email" value={userForm.email} onChange={e => setUserForm({...userForm, email: e.target.value})} className="mt-1 bg-background border-border rounded-sm" /></div>
            <div><Label className="text-[10px] uppercase tracking-wider">Password *</Label><Input required type="password" value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} className="mt-1 bg-background border-border rounded-sm" /></div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider">Role</Label>
              <Select value={userForm.role} onValueChange={(v) => setUserForm({...userForm, role: v})}>
                <SelectTrigger className="mt-1 bg-background border-border rounded-sm"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#0F1115] border-border">
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="sales">Sales / Front Desk</SelectItem>
                  <SelectItem value="technician">Technician</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => setUserOpen(false)} className="border-border rounded-sm">Cancel</Button>
              <Button type="submit" className="bg-[#0066FF] hover:bg-[#3385FF] rounded-sm">Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MAKE MODAL */}
      <Dialog open={makeOpen} onOpenChange={setMakeOpen}>
        <DialogContent className="bg-[#0F1115] border-border rounded-sm max-w-lg">
          <DialogHeader><DialogTitle className="font-display text-2xl font-black tracking-tighter">{editingMakeId ? "Edit Make" : "New Make"}</DialogTitle></DialogHeader>
          <form onSubmit={saveMake} className="space-y-3 mt-2" data-testid="make-form">
            <div><Label className="text-[10px] uppercase tracking-wider">Make Name *</Label><Input required value={makeForm.label} onChange={e => setMakeForm({...makeForm, label: e.target.value})} className="mt-1 bg-background border-border rounded-sm" data-testid="make-name" /></div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider">Models</Label>
              <div className="flex gap-2 mt-1">
                <Input value={modelInput} onChange={e => setModelInput(e.target.value)} placeholder="Add model and press Enter"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addModel(); } }}
                  className="bg-background border-border rounded-sm" data-testid="model-add-input" />
                <Button type="button" onClick={addModel} className="bg-[#0066FF] hover:bg-[#3385FF] rounded-sm">Add</Button>
              </div>
              <div className="mt-2 flex gap-2 flex-wrap">
                {makeForm.models.map((m, i) => (
                  <span key={i} className="text-xs border border-border rounded-sm px-2 py-1 flex items-center gap-1.5">
                    {m}
                    <button type="button" onClick={() => setMakeForm({ ...makeForm, models: makeForm.models.filter((_, x) => x !== i) })} className="hover:text-[#FF3B30]">×</button>
                  </span>
                ))}
                {makeForm.models.length === 0 && <span className="text-xs text-muted-foreground">No models yet.</span>}
              </div>
            </div>
            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => setMakeOpen(false)} className="border-border rounded-sm">Cancel</Button>
              <Button type="submit" className="bg-[#0066FF] hover:bg-[#3385FF] rounded-sm" data-testid="make-save">Save Make</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
