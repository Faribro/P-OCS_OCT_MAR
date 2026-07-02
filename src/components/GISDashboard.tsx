'use client';

import { useState, useEffect, useMemo } from 'react';
import { ShieldAlert, Sparkles, Globe, MapPin, Layers, Building2, Trash2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { normalizeGeographicKey } from '@/lib/normalizeGeographicKey';

// Load map dynamically to avoid SSR errors
const MapComponent = dynamic(() => import('./MapComponent'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-slate-100 flex flex-col items-center justify-center gap-4 text-slate-400">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-indigo-500" />
      <span className="text-sm font-semibold tracking-wide">Loading 3D Spatial Map...</span>
    </div>
  )
});

const CATEGORIES = [
  { id: 'Combined',  label: 'Combined'        },
  { id: 'Prison',   label: 'Prisons'          },
  { id: 'OCS',      label: 'OCS Settings'     },
  { id: 'JH_CCI',  label: 'Juvenile Homes'   },
  { id: 'DRC',      label: 'Rehab Centres'    },
];

const INDICATORS = [
  { key: 'hiv_screened', label: '5. HIV Screened (Month)',  group: 'HIV' },
  { key: 'tb_positive',  label: '15. TB Positive (Month)', group: 'TB'  },
];

export default function GISDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeCategory, setActiveCategory] = useState('Combined');
  const [activeMetric, setActiveMetric]     = useState('hiv_screened');
  const [selectedState, setSelectedState]   = useState<string | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<any>(null);

  // Fetch compiled data on mount
  useEffect(() => {
    fetch('/data.json')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load compiled dataset.');
        return res.json();
      })
      .then(d => { setData(d); setLoading(false); })
      .catch(err => { console.error(err); setError(err.message); setLoading(false); });
  }, []);

  const handleCategoryChange = (cat: string) => {
    setActiveCategory(cat);
    setSelectedState(null);
    setSelectedDistrict(null);
  };

  const activeDataset = useMemo(() => {
    if (!data) return null;
    return data[activeCategory.toLowerCase()] || data['combined'];
  }, [data, activeCategory]);

  const availableStates = useMemo(() => {
    if (!activeDataset?.states) return [];
    return Object.values(activeDataset.states)
      .map((s: any) => s.name)
      .sort();
  }, [activeDataset]);

  const availableDistricts = useMemo(() => {
    if (!activeDataset?.districts) return [];
    const districts = Object.values(activeDataset.districts) as any[];
    if (selectedState) {
      const stateNorm = normalizeGeographicKey(selectedState);
      return districts
        .filter(d => normalizeGeographicKey(d.state) === stateNorm)
        .map(d => d.name)
        .sort();
    }
    return districts.map(d => d.name).sort();
  }, [activeDataset, selectedState]);

  const handleStateChange = (state: string | null) => {
    setSelectedState(state);
    setSelectedDistrict(null);
  };

  const activeMetricMeta = useMemo(
    () => INDICATORS.find(ind => ind.key === activeMetric),
    [activeMetric]
  );

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-white text-slate-900 gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-indigo-500" />
        <p className="text-slate-500 font-semibold tracking-wide text-sm">Loading dataset...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-white text-slate-900 gap-4">
        <ShieldAlert className="w-16 h-16 text-red-500" />
        <h2 className="text-xl font-bold">Error loading data</h2>
        <p className="text-slate-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-white text-slate-900">

      {/* ── Top Header Bar ── */}
      <header className="shrink-0 bg-white border-b border-slate-200 shadow-sm px-5 py-3 flex flex-wrap items-center gap-3 z-40">

        {/* Title */}
        <div className="flex items-center gap-2 mr-4">
          <Sparkles className="w-4 h-4 text-indigo-500" />
          <h1 className="text-sm font-black tracking-tight text-slate-900 whitespace-nowrap">
            P &amp; OCS · Data Compilation · OCT–MAR
          </h1>
        </div>

        {/* ── Category Dropdown ── */}
        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 shadow-sm hover:border-indigo-300 transition-colors">
          <Building2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
          <select
            id="category-select"
            value={activeCategory}
            onChange={e => handleCategoryChange(e.target.value)}
            className="bg-transparent border-none text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer pr-1"
          >
            {CATEGORIES.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.label}</option>
            ))}
          </select>
        </div>

        {/* ── State Dropdown ── */}
        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 shadow-sm hover:border-indigo-300 transition-colors">
          <Globe className="w-3.5 h-3.5 text-purple-500 shrink-0" />
          <select
            id="state-select"
            value={selectedState || ''}
            onChange={e => handleStateChange(e.target.value || null)}
            className="bg-transparent border-none text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer pr-1 max-w-[160px]"
          >
            <option value="">All States</option>
            {availableStates.map(st => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>
        </div>

        {/* ── District Dropdown ── */}
        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 shadow-sm hover:border-indigo-300 transition-colors">
          <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <select
            id="district-select"
            value={selectedDistrict || ''}
            disabled={availableDistricts.length === 0}
            onChange={e => setSelectedDistrict(e.target.value || null)}
            className="bg-transparent border-none text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer disabled:opacity-40 pr-1 max-w-[160px]"
          >
            <option value="">All Districts</option>
            {availableDistricts.map(dt => (
              <option key={dt} value={dt}>{dt}</option>
            ))}
          </select>
        </div>

        {/* ── Indicator Dropdown ── */}
        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 shadow-sm hover:border-indigo-300 transition-colors">
          <Layers className="w-3.5 h-3.5 text-blue-500 shrink-0" />
          <select
            id="indicator-select"
            value={activeMetric}
            onChange={e => setActiveMetric(e.target.value)}
            className="bg-transparent border-none text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer pr-1 max-w-[220px]"
          >
            {INDICATORS.map(ind => (
              <option key={ind.key} value={ind.key}>{ind.label}</option>
            ))}
          </select>
        </div>

        {/* ── Reset button — only when filters active ── */}
        {(selectedState || selectedDistrict) && (
          <button
            id="reset-filters-btn"
            onClick={() => { setSelectedState(null); setSelectedDistrict(null); }}
            className="ml-auto flex items-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 border border-red-200 hover:border-red-400 text-xs font-semibold text-red-600 rounded-lg transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Reset
          </button>
        )}

        {/* ── Active indicator badge ── */}
        <div className="ml-auto flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
          <div className={`w-2 h-2 rounded-full ${activeMetric === 'tb_positive' ? 'bg-red-500 animate-pulse' : 'bg-cyan-500'}`} />
          <span className="text-[11px] font-bold text-indigo-700 whitespace-nowrap">
            {activeMetricMeta?.label ?? activeMetric}
          </span>
          {selectedState && (
            <>
              <span className="text-indigo-300 text-xs">·</span>
              <span className="text-[11px] font-semibold text-indigo-500">{selectedState}</span>
            </>
          )}
          {selectedDistrict && (
            <>
              <span className="text-indigo-300 text-xs">·</span>
              <span className="text-[11px] font-semibold text-indigo-500">{selectedDistrict}</span>
            </>
          )}
        </div>
      </header>

      {/* ── Map fills all remaining space ── */}
      <div className="flex-1 overflow-hidden relative" style={{ minHeight: 0 }}>
        <div className="w-full h-full relative overflow-hidden">
          <MapComponent
            category={activeCategory}
            activeMetric={activeMetric}
            selectedState={selectedState}
            selectedDistrict={selectedDistrict}
            onSelectState={handleStateChange}
            onSelectDistrict={setSelectedDistrict}
            data={data}
            setTooltip={setTooltip}
          />

          {/* Hover tooltip */}
          {tooltip && (
            <div
              className="absolute pointer-events-none z-50 bg-white border border-slate-200 rounded-xl shadow-xl p-4 text-xs max-w-xs transition-all duration-75"
              style={{ left: tooltip.x + 16, top: tooltip.y + 16 }}
            >
              <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-100">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">{tooltip.name}</h4>
                  {tooltip.state && <p className="text-[10px] text-slate-400 mt-0.5">{tooltip.state}</p>}
                </div>
                <span className="text-[10px] font-semibold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                  {activeCategory}
                </span>
              </div>

              {tooltip.metrics ? (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">{activeMetricMeta?.label}:</span>
                    <span className="font-bold text-indigo-600 text-sm">
                      {(tooltip.metrics[activeMetric] || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-2 border-t border-slate-100">
                    <div className="text-slate-500">
                      HIV Screened: <span className="font-bold text-slate-800">{(tooltip.metrics.hiv_screened || 0).toLocaleString()}</span>
                    </div>
                    <div className="text-slate-500">
                      TB Positive: <span className="font-bold text-red-600">{(tooltip.metrics.tb_positive || 0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-slate-400 italic">No data for this region.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
