import React, { useState, useEffect } from 'react';
import { MetricCards } from '../components/MetricCards';
import { FilterBar } from '../components/FilterBar';
import { AssetCard } from '../components/AssetCard';
import { AssetDetailModal } from '../components/AssetDetailModal';
import { Layers, Plus, Sparkles, AlertCircle } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

export const DashboardPage = ({ onOpenCreateAsset, summary, onRefreshSummary }) => {
  const { user, isAdmin, isDepartmentStaff } = useAuth();

  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  useEffect(() => {
    fetchAssets();
  }, [selectedDepartment, selectedType, selectedStatus]);

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedDepartment && !isDepartmentStaff) params.department = selectedDepartment;
      if (selectedType) params.type = selectedType;
      if (selectedStatus) params.status = selectedStatus;

      const res = await api.get('/assets', { params });
      setAssets(res.data.data || []);
    } catch (err) {
      console.error('Error fetching assets:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async (assetId) => {
    try {
      await api.delete(`/assets/${assetId}`);
      await fetchAssets();
      if (onRefreshSummary) onRefreshSummary();
    } catch (err) {
      alert('Deactivation failed: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleResetFilters = () => {
    setSearch('');
    if (!isDepartmentStaff) setSelectedDepartment('');
    setSelectedType('');
    setSelectedStatus('');
  };

  // Client-side text search (name and location)
  const filteredAssets = assets.filter((asset) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const nameMatch = asset.name.toLowerCase().includes(q);
    const buildingMatch = asset.location?.building?.toLowerCase().includes(q);
    const zoneMatch = asset.location?.zone?.toLowerCase().includes(q);
    return nameMatch || buildingMatch || zoneMatch;
  });

  return (
    <div className="space-y-6">
      {/* Overview Metrics Cards */}
      <MetricCards
        summary={summary}
        selectedStatus={selectedStatus}
        onSelectStatus={setSelectedStatus}
      />

      {/* Filter Toolbar */}
      <FilterBar
        search={search}
        setSearch={setSearch}
        selectedDepartment={selectedDepartment}
        setSelectedDepartment={setSelectedDepartment}
        selectedType={selectedType}
        setSelectedType={setSelectedType}
        selectedStatus={selectedStatus}
        setSelectedStatus={setSelectedStatus}
        onReset={handleResetFilters}
        totalCount={filteredAssets.length}
      />

      {/* Assets Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-white">Facility Assets</h2>
            <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-semibold text-slate-400">
              {filteredAssets.length} units
            </span>
          </div>

          {isAdmin && (
            <button
              onClick={onOpenCreateAsset}
              className="flex items-center gap-1.5 rounded-xl bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500 transition-colors shadow-sm shadow-cyan-950"
            >
              <Plus size={14} />
              <span>Register Asset</span>
            </button>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-56 rounded-2xl border border-slate-800 bg-slate-900/40 p-5 animate-pulse"
              ></div>
            ))}
          </div>
        ) : filteredAssets.length === 0 ? (
          <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-12 text-center">
            <AlertCircle size={36} className="mx-auto text-slate-500 mb-2" />
            <h3 className="text-sm font-bold text-slate-200">No Assets Found</h3>
            <p className="text-xs text-slate-400 mt-1">
              No facility assets match your filter criteria. Try clearing filters or seeding sample data.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredAssets.map((asset) => (
              <AssetCard
                key={asset._id}
                asset={asset}
                onSelect={(a) => setSelectedAsset(a)}
                onAddReading={(a) => setSelectedAsset(a)}
                onDeactivate={handleDeactivate}
              />
            ))}
          </div>
        )}
      </div>

      {/* Asset Detail & Telemetry Modal */}
      {selectedAsset && (
        <AssetDetailModal
          asset={selectedAsset}
          onClose={() => setSelectedAsset(null)}
          onAssetUpdated={() => {
            fetchAssets();
            if (onRefreshSummary) onRefreshSummary();
          }}
        />
      )}
    </div>
  );
};
