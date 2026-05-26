// Staff page
import { useState, useEffect } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import { authAPI } from '../../services/api';
import { Plus, Users2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminStaff() {
  const [staff, setStaff] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', role: 'kitchen' });
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    setSaving(true);
    try {
      await authAPI.createStaff(form);
      toast.success('Staff member added');
      setShowAdd(false);
      setForm({ name: '', email: '', password: '', phone: '', role: 'kitchen' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add staff');
    } finally { setSaving(false); }
  };

  return (
    <AdminLayout title="Staff Management">
      <div className="flex justify-end mb-4">
        <button onClick={() => setShowAdd(true)} className="btn-primary"><Plus className="w-4 h-4" />Add Staff</button>
      </div>
      <div className="card">
        <div className="flex items-center gap-3 py-4 border-b border-stone-100">
          <Users2 className="w-5 h-5 text-stone-400" />
          <div className="text-stone-500 text-sm">Staff members are visible after they log in. Add a new member to get started.</div>
        </div>
      </div>
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowAdd(false)} />
          <div className="relative bg-white rounded-3xl p-6 w-full max-w-sm animate-fade-up space-y-4">
            <h2 className="font-display font-bold text-xl">Add Staff Member</h2>
            <div><label className="label">Name</label><input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><label className="label">Email</label><input type="email" className="input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
            <div><label className="label">Password</label><input type="password" className="input" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} /></div>
            <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
            <div><label className="label">Role</label>
              <select className="input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                <option value="kitchen">Kitchen Staff</option>
                <option value="manager">Manager</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowAdd(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleAdd} disabled={saving} className="btn-primary flex-1">
                {saving ? <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" /> : 'Add Staff'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
