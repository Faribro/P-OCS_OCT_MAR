'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  Activity, 
  ShieldAlert, 
  Trash2, 
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Globe, 
  HeartPulse, 
  Sparkles, 
  Info,
  Layers,
  MapPin,
  TrendingUp,
  Award,
  Users,
  Filter,
  SlidersHorizontal,
  AlertTriangle
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { normalizeGeographicKey } from '@/lib/normalizeGeographicKey';

// Load map component dynamically to avoid SSR errors
const MapComponent = dynamic(() => import('./MapComponent'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-zinc-950 flex flex-col items-center justify-center gap-4 text-zinc-500 border-3 border-black">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-yellow-500"></div>
      Loading 3D Spatial Maps...
    </div>
  )
});

const CATEGORIES = [
  { id: 'Combined', label: 'Combined', desc: 'All Categories Merged', color: 'bg-purple-500 hover:bg-purple-600 text-black border-purple-300' },
  { id: 'Prison', label: 'Prisons', desc: 'Prison Settings', color: 'bg-blue-500 hover:bg-blue-600 text-black border-blue-300' },
  { id: 'OCS', label: 'OCS Settings', desc: 'OCS Settings', color: 'bg-orange-500 hover:bg-orange-600 text-black border-orange-300' },
  { id: 'JH_CCI', label: 'Juvenile Homes', desc: 'JH / CCI Settings', color: 'bg-emerald-500 hover:bg-emerald-600 text-black border-emerald-300' },
  { id: 'DRC', label: 'Rehab Centres', desc: 'DRC Settings', color: 'bg-red-500 hover:bg-red-600 text-black border-red-300' }
];

const INDICATORS = [
  { key: 'hiv_screened', label: 'HIV Screened', desc: 'Screened or tested for HIV', group: 'HIV', color: 'border-l-red-500' },
  { key: 'tb_positive', label: 'TB Positive', desc: 'Tested and found TB positive', group: 'TB', alert: true, color: 'border-l-blue-500' }
];

export default function GISDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeCategory, setActiveCategory] = useState('Combined');
  const [activeMetric, setActiveMetric] = useState('hiv_screened');
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<any>(null);

  // KPI ribbon collapsed by default — user can toggle open
  const [kpiOpen, setKpiOpen] = useState(false);

  // Fetch compiled data on mount
  useEffect(() => {
    fetch('/data.json')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load compiled dataset.');
        return res.json();
      })
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError(err.message);
        setLoading(false);
      });
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

  const selectedDetails = useMemo(() => {
    if (!activeDataset) return null;
    
    if (selectedDistrict) {
      const norm = normalizeGeographicKey(selectedDistrict);
      return activeDataset.districts[norm] || null;
    }
    
    if (selectedState) {
      const norm = normalizeGeographicKey(selectedState);
      return activeDataset.states[norm] || null;
    }

    const total: any = { name: 'All States (National Aggregate)', isTotal: true };
    INDICATORS.forEach(ind => {
      total[ind.key] = 0;
    });
    Object.values(activeDataset.states).forEach((s: any) => {
      INDICATORS.forEach(ind => {
        total[ind.key] += s[ind.key] || 0;
      });
    });
    return total;
  }, [activeDataset, selectedState, selectedDistrict]);

  const activeMetricMeta = useMemo(() => {
    return INDICATORS.find(ind => ind.key === activeMetric);
  }, [activeMetric]);

  const totalScreened = useMemo(() => {
    if (!selectedDetails) return 0;
    return selectedDetails.hiv_screened || 0;
  }, [selectedDetails]);

  const totalPositives = useMemo(() => {
    if (!selectedDetails) return 0;
    return selectedDetails.tb_positive || 0;
  }, [selectedDetails]);

  const activeValue = useMemo(() => {
    if (!selectedDetails) return 0;
    return selectedDetails[activeMetric] || 0;
  }, [selectedDetails, activeMetric]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-zinc-950 text-white gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-yellow-500"></div>
        <p className="text-yellow-500 font-bold uppercase tracking-widest text-xs">Loading Comic Command Center...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-zinc-950 text-white gap-4">
        <ShieldAlert className="w-16 h-16 text-red-500" />
        <h2 className="text-xl font-bold uppercase">System Error</h2>
        <p className="text-zinc-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-slate-50 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] text-slate-900 flex flex-col">
      
      {/* Header */}
      <header className="border-b-4 border-black bg-white px-6 py-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4 z-40 shadow-[0_4px_0_0_#000]">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-black flex items-center gap-2 drop-shadow-[1px_1px_0_#ccc]">
            P &amp; OCS - Data Compilation - OCT - MAR
            <Sparkles className="w-5 h-5 text-yellow-500 animate-bounce" />
          </h1>
        </div>

        {/* Categories Slicer - Comic Buttons style */}
        <div className="flex flex-wrap items-center gap-2">
          {CATEGORIES.map(cat => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => handleCategoryChange(cat.id)}
                className={`px-4 py-2 text-xs font-black uppercase border-3 border-black rounded transition-all duration-150 transform hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none ${
                  isActive
                    ? 'bg-yellow-500 text-black shadow-[4px_4px_0_0_#000]'
                    : 'bg-white text-slate-700 hover:text-black shadow-[2px_2px_0_0_#000]'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* Slicers and Controls Subbar */}
      <div className="bg-white border-b-4 border-black px-6 py-3 flex flex-wrap items-center gap-6 z-40 shadow-[0_2px_0_0_#000]">
        {/* State Filter dropdown */}
        <div className="flex items-center gap-2 bg-slate-100 border-2 border-black px-2 py-1 rounded shadow-[2px_2px_0_0_#000]">
          <Globe className="w-4 h-4 text-purple-600" />
          <select
            value={selectedState || ''}
            onChange={e => handleStateChange(e.target.value || null)}
            className="bg-transparent border-none text-xs text-slate-800 font-bold focus:outline-none cursor-pointer"
          >
            <option value="" className="bg-white text-slate-800">All States</option>
            {availableStates.map(st => (
              <option key={st} value={st} className="bg-white text-slate-800">{st}</option>
            ))}
          </select>
        </div>

        {/* District Filter dropdown */}
        <div className="flex items-center gap-2 bg-slate-100 border-2 border-black px-2 py-1 rounded shadow-[2px_2px_0_0_#000]">
          <MapPin className="w-4 h-4 text-emerald-600" />
          <select
            value={selectedDistrict || ''}
            disabled={availableDistricts.length === 0}
            onChange={e => setSelectedDistrict(e.target.value || null)}
            className="bg-transparent border-none text-xs text-slate-800 font-bold focus:outline-none cursor-pointer disabled:opacity-50"
          >
            <option value="" className="bg-white text-slate-800">All Districts</option>
            {availableDistricts.map(dt => (
              <option key={dt} value={dt} className="bg-white text-slate-800">{dt}</option>
            ))}
          </select>
        </div>

        {/* Active Indicators Dropdown */}
        <div className="flex items-center gap-2 bg-slate-100 border-2 border-black px-2 py-1 rounded shadow-[2px_2px_0_0_#000]">
          <Layers className="w-4 h-4 text-blue-600" />
          <select
            value={activeMetric}
            onChange={e => setActiveMetric(e.target.value)}
            className="bg-transparent border-none text-xs text-slate-800 font-bold focus:outline-none cursor-pointer"
          >
            {Object.entries(
              INDICATORS.reduce((groups: any, ind) => {
                if (!groups[ind.group]) groups[ind.group] = [];
                groups[ind.group].push(ind);
                return groups;
              }, {})
            ).map(([group, inds]: any) => (
              <optgroup key={group} label={group} className="bg-white text-slate-400">
                {inds.map((ind: any) => (
                  <option key={ind.key} value={ind.key} className="text-slate-800 bg-white">
                    {ind.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {(selectedState || selectedDistrict) && (
          <button
            onClick={() => {
              setSelectedState(null);
              setSelectedDistrict(null);
            }}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 border-2 border-black text-xs font-black text-white rounded shadow-[2px_2px_0_0_#000] hover:translate-y-0.5 active:translate-y-1 active:shadow-none transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Reset Slices
          </button>
        )}
      </div>

      {/* KPI Summary Ribbon — collapsible */}
      <div className="bg-slate-100 border-b-4 border-black">
        {/* Toggle bar — always visible, shows inline mini-stats */}
        <button
          onClick={() => setKpiOpen(o => !o)}
          className="w-full px-6 py-2 flex items-center gap-4 hover:bg-slate-200/60 transition-colors group"
        >
          <span className="text-[10px] font-black tracking-widest uppercase text-slate-500 group-hover:text-slate-700 transition-colors shrink-0">
            KPI Summary
          </span>
          {/* Inline mini pill stats — always visible when collapsed */}
          <div className="flex flex-wrap items-center gap-3 flex-1 overflow-hidden">
            <span className="text-[10px] font-black text-slate-600">
              HIV Screened: <span className="text-slate-900">{totalScreened.toLocaleString()}</span>
            </span>
            <span className="text-[10px] text-slate-300">·</span>
            <span className="text-[10px] font-black text-slate-600">
              TB Positive: <span className="text-blue-600">{totalPositives.toLocaleString()}</span>
            </span>
            <span className="text-[10px] text-slate-300">·</span>
            <span className="text-[10px] font-black text-slate-600">
              Active ({activeMetricMeta?.label || activeMetric}): <span className="text-yellow-600 font-black">{activeValue.toLocaleString()}</span>
            </span>
          </div>
          <div className="ml-auto shrink-0 text-slate-400 group-hover:text-slate-700 transition-colors">
            {kpiOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {/* Expandable card grid */}
        {kpiOpen && (
          <div className="px-6 pb-4 pt-2 grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-slate-200">
            {/* Card 1: HIV Screened */}
            <div className="bg-white border-3 border-black p-4 rounded shadow-[3px_3px_0_0_#000] flex items-center justify-between group hover:-translate-y-0.5 transition-all">
              <div>
                <span className="text-[10px] font-black text-slate-400 tracking-widest uppercase">HIV Screened</span>
                <h3 className="text-xl font-black text-slate-900 mt-1">
                  {totalScreened.toLocaleString()}
                </h3>
              </div>
              <div className="w-10 h-10 rounded-lg bg-red-50 border-2 border-black flex items-center justify-center text-red-500 group-hover:scale-110 transition-transform">
                <Users className="w-5 h-5" />
              </div>
            </div>

            {/* Card 2: TB Positive */}
            <div className="bg-white border-3 border-black p-4 rounded shadow-[3px_3px_0_0_#000] flex items-center justify-between group hover:-translate-y-0.5 transition-all">
              <div>
                <span className="text-[10px] font-black text-slate-400 tracking-widest uppercase">TB Positive</span>
                <h3 className="text-xl font-black text-slate-900 mt-1">
                  {totalPositives.toLocaleString()}
                </h3>
              </div>
              <div className="w-10 h-10 rounded-lg bg-blue-50 border-2 border-black flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                <AlertTriangle className="w-5 h-5 animate-pulse" />
              </div>
            </div>

            {/* Card 3: Active Metric Status */}
            <div className="bg-yellow-400 border-3 border-black p-4 rounded shadow-[3px_3px_0_0_#000] flex items-center justify-between group hover:-translate-y-0.5 transition-all">
              <div>
                <span className="text-[10px] font-black text-black/60 tracking-widest uppercase">Active: {activeMetricMeta?.label || activeMetric}</span>
                <h3 className="text-xl font-black text-black mt-1">
                  {activeValue.toLocaleString()}
                </h3>
              </div>
              <div className="w-10 h-10 rounded-lg bg-black border-2 border-black flex items-center justify-center text-yellow-500 group-hover:scale-110 transition-transform">
                <Activity className="w-5 h-5" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Map Panel — fills all remaining vertical space */}
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

          {/* Hover tooltips styled as neobrutalist bubble */}
          {tooltip && (
            <div 
              className="absolute pointer-events-none p-4 bg-white border-3 border-black text-xs rounded shadow-[6px_6px_0_0_#000] z-50 transition-all duration-100 max-w-sm"
              style={{ left: tooltip.x + 15, top: tooltip.y + 15 }}
            >
              <div className="flex items-center justify-between border-b-2 border-slate-200 pb-2 mb-2">
                <div>
                  <h4 className="font-black text-slate-900 text-sm uppercase tracking-wider">{tooltip.name}</h4>
                  <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">{tooltip.state || 'State Territory'}</p>
                </div>
                <div className="bg-yellow-400 border-2 border-black px-2 py-0.5 rounded text-[10px] font-black text-black">
                  {activeCategory}
                </div>
              </div>

              {tooltip.metrics ? (
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-slate-700">
                    <span className="font-bold text-slate-500">{activeMetricMeta?.label}:</span>
                    <span className="font-black text-yellow-600 text-sm">
                      {(tooltip.metrics[activeMetric] || 0).toLocaleString()}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-100 text-[10px]">
                    <div className="text-slate-500 font-semibold">
                      HIV Screened: <span className="font-black text-slate-800">{(tooltip.metrics.hiv_screened || 0).toLocaleString()}</span>
                    </div>
                    <div className="text-slate-500 font-semibold">
                      TB Positive: <span className="font-black text-blue-600">{(tooltip.metrics.tb_positive || 0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-slate-400 text-[10px] italic">No indicators reported for this region.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
