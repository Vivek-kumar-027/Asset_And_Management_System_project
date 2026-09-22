import React, { useState } from 'react';
import { X, Plus, Save } from 'lucide-react';
import api from '../api/client';

export const AssetFormModal = ({ isOpen, onClose, onAssetSaved, editAsset = null }) => {
  const [formData, setFormData] = useState({
    name: editAsset?.name || '',
    type: editAsset?.type || 'HVAC',
    department: editAsset?.department || 'HVAC',
    building: editAsset?.location?.building || '',
    zone: editAsset?.location?.zone || '',
    maintenanceIntervalDays: editAsset?.maintenanceIntervalDays || 60,
    installedDate: editAsset?.installedDate
      ? new Date(editAsset.installedDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0],
    lastServicedDate: editAsset?.lastServicedDate
      ? new Date(editAsset.lastServicedDate).toISOString().split('T')[0]
      : '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const payload = {
        name: formData.name.trim(),
        type: formData.type,
        department: formData.department,
        location: {
          building: formData.building.trim(),
          zone: formData.zone.trim(),
        },
        maintenanceIntervalDays: Number(formData.maintenanceIntervalDays),
        installedDate: new Date(formData.installedDate),
        lastServicedDate: formData.lastServicedDate ? new Date(formData.lastServicedDate) : undefined,
      };

      if (editAsset?._id) {
        await api.put(`/assets/${editAsset._id}`, payload);
      } else {
        await api.post('/assets', payload);
      }

      onAssetSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
          <h3 className="text-lg font-bold text-white">
            {editAsset ? 'Edit Facility Asset' : 'Register New Facility Asset'}
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
            {error}
          </div>
        )}

        <div className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-slate-300 mb-1">Asset Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Primary Backup Generator B"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Type *</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
              >
                {['HVAC', 'Generator', 'Lift', 'Pump', 'Other'].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Department *</label>
              <select
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
              >
                {['Electrical', 'HVAC', 'Plumbing', 'IT', 'General'].map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Building</label>
              <input
                type="text"
                value={formData.building}
                onChange={(e) => setFormData({ ...formData, building: e.target.value })}
                placeholder="e.g. East Tower"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Zone / Room</label>
              <input
                type="text"
                value={formData.zone}
                onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                placeholder="e.g. Basement Sump"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Interval (Days) *</label>
              <input
                type="number"
                min="1"
                required
                value={formData.maintenanceIntervalDays}
                onChange={(e) =>
                  setFormData({ ...formData, maintenanceIntervalDays: e.target.value })
                }
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Installed Date *</label>
              <input
                type="date"
                required
                value={formData.installedDate}
                onChange={(e) => setFormData({ ...formData, installedDate: e.target.value })}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Last Serviced</label>
              <input
                type="date"
                value={formData.lastServicedDate}
                onChange={(e) =>
                  setFormData({ ...formData, lastServicedDate: e.target.value })
                }
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2 border-t border-slate-800 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-1.5 rounded-xl bg-cyan-600 px-5 py-2 text-xs font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
          >
            <Save size={14} />
            <span>{submitting ? 'Saving...' : editAsset ? 'Update Asset' : 'Register Asset'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
