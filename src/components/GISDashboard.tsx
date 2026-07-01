'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  Activity, 
  ShieldAlert, 
  Trash2, 
  ChevronRight, 
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
  { key: 'ipc_sessions', label: 'IPC Sessions', desc: 'Information sessions completed', group: 'General', color: 'border-l-purple-500' },
  { key: 'sti_rti_checkup', label: 'STI/RTI Check-ups', desc: 'Regular check-ups completed', group: 'STI/RTI', color: 'border-l-amber-500' },
  { key: 'sti_rti_diagnosed', label: 'STI/RTI Diagnosed', desc: 'Diagnosed cases', group: 'STI/RTI', alert: true, color: 'border-l-amber-500' },
  { key: 'sti_rti_treated', label: 'STI/RTI Treated', desc: 'Treated cases', group: 'STI/RTI', color: 'border-l-amber-500' },
  
  { key: 'hiv_screened', label: 'HIV Screened', desc: 'Screened or tested for HIV', group: 'HIV', color: 'border-l-red-500' },
  { key: 'hiv_reactive', label: 'HIV Reactive', desc: 'Screened and found reactive', group: 'HIV', alert: true, color: 'border-l-red-500' },
  { key: 'hiv_confirmed_positive', label: 'HIV Confirmed Positive', desc: 'Confirmed HIV positive cases', group: 'HIV', alert: true, color: 'border-l-red-500' },
  { key: 'linked_to_art', label: 'HIV Linked to ART', desc: 'Linked to ART clinics', group: 'HIV', color: 'border-l-red-500' },
  
  { key: 'syphilis_screened', label: 'Syphilis Screened', desc: 'Screened or tested for Syphilis', group: 'Syphilis', color: 'border-l-orange-500' },
  { key: 'syphilis_reactive', label: 'Syphilis Reactive', desc: 'Found Syphilis reactive', group: 'Syphilis', alert: true, color: 'border-l-orange-500' },
  { key: 'syphilis_treated', label: 'Syphilis Treated', desc: 'Treated for Syphilis', group: 'Syphilis', color: 'border-l-orange-500' },
  
  { key: 'tb_screened', label: 'TB Screened', desc: 'Screened for Tuberculosis', group: 'TB', color: 'border-l-blue-500' },
  { key: 'tb_suspected', label: 'TB Suspected', desc: 'Suspected TB cases', group: 'TB', alert: true, color: 'border-l-blue-500' },
  { key: 'tb_tested', label: 'TB Tested', desc: 'Suspects tested for TB', group: 'TB', color: 'border-l-blue-500' },
  { key: 'tb_positive', label: 'TB Positive', desc: 'Tested and found TB positive', group: 'TB', alert: true, color: 'border-l-blue-500' },
  { key: 'tb_treatment_initiated', label: 'TB Initiated', desc: 'Initiated TB treatment', group: 'TB', color: 'border-l-blue-500' },
  
  { key: 'ost_initiated', label: 'OST Initiated', desc: 'Initiated OST treatment', group: 'OST', color: 'border-l-emerald-500' },
  { key: 'ost_ongoing', label: 'OST Ongoing', desc: 'Ongoing OST treatments', group: 'OST', color: 'border-l-emerald-500' }
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

  // Slicers/Range Filters: 'all' | 'high_screening' | 'alert_only'
  const [volumeSlicer, setVolumeSlicer] = useState<'all' | 'high_screening' | 'alert_only'>('all');

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

  // KPI Calculations
  const statsOverview = useMemo(() => {
    if (!activeDataset) return { totalScreened: 0, totalDiagnosed: 0, treatmentRate: 0, testYield: 0 };
    
    let totalScreened = 0;
    let totalDiagnosed = 0;
    let totalTreated = 0;

    const source = selectedState 
      ? Object.values(activeDataset.districts).filter((d: any) => normalizeGeographicKey(d.state) === normalizeGeographicKey(selectedState))
      : Object.values(activeDataset.states);

    source.forEach((item: any) => {
      totalScreened += (item.hiv_screened || 0) + (item.tb_screened || 0) + (item.syphilis_screened || 0);
      totalDiagnosed += (item.hiv_confirmed_positive || 0) + (item.tb_positive || 0) + (item.sti_rti_diagnosed || 0);
      totalTreated += (item.linked_to_art || 0) + (item.tb_treatment_initiated || 0) + (item.sti_rti_treated || 0);
    });

    const treatmentRate = totalDiagnosed > 0 ? (totalTreated / totalDiagnosed) * 100 : 0;
    const testYield = totalScreened > 0 ? (totalDiagnosed / totalScreened) * 100 : 0;

    return { totalScreened, totalDiagnosed, treatmentRate, testYield };
  }, [activeDataset, selectedState]);

  // Apply slicers to leaderboard / district lists
  const leaderboard = useMemo(() => {
    if (!activeDataset?.districts) return [];
    
    let list = Object.values(activeDataset.districts) as any[];

    // Geolocation filter
    if (selectedState) {
      const stateNorm = normalizeGeographicKey(selectedState);
      list = list.filter(d => normalizeGeographicKey(d.state) === stateNorm);
    }

    // Interactive Slicer implementation
    if (volumeSlicer === 'high_screening') {
      // High volume screenings > 500 cases
      list = list.filter(d => {
        const scr = (d.hiv_screened || 0) + (d.tb_screened || 0) + (d.syphilis_screened || 0);
        return scr > 500;
      });
    } else if (volumeSlicer === 'alert_only') {
      // Show only regions with active positive cases
      list = list.filter(d => {
        const positives = (d.hiv_confirmed_positive || 0) + (d.tb_positive || 0) + (d.sti_rti_diagnosed || 0);
        return positives > 0;
      });
    }

    return list
      .map(d => ({
        name: d.name,
        state: d.state,
        value: d[activeMetric] || 0
      }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [activeDataset, selectedState, activeMetric, volumeSlicer]);

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
    return (selectedDetails.hiv_screened || 0) + (selectedDetails.tb_screened || 0) + (selectedDetails.syphilis_screened || 0);
  }, [selectedDetails]);

  const totalPositives = useMemo(() => {
    if (!selectedDetails) return 0;
    return (selectedDetails.hiv_confirmed_positive || 0) + (selectedDetails.tb_positive || 0) + (selectedDetails.syphilis_reactive || 0) + (selectedDetails.sti_rti_diagnosed || 0);
  }, [selectedDetails]);

  const totalTreated = useMemo(() => {
    if (!selectedDetails) return 0;
    return (selectedDetails.linked_to_art || 0) + (selectedDetails.tb_treatment_initiated || 0) + (selectedDetails.syphilis_treated || 0) + (selectedDetails.sti_rti_treated || 0);
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
    <div className="flex-1 bg-[#09090b] bg-[linear-gradient(to_right,#1f2937_1px,transparent_1px),linear-gradient(to_bottom,#1f2937_1px,transparent_1px)] bg-[size:4rem_4rem] text-white flex flex-col min-h-screen">
      
      {/* Comic Styled Neobrutalism Header */}
      <header className="border-b-4 border-black bg-zinc-900/90 backdrop-blur-md px-6 py-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4 z-40 shadow-[0_4px_0_0_#000]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="h-3 w-3 rounded-full bg-yellow-500 border-2 border-black animate-pulse"></span>
            <span className="text-[10px] font-black text-yellow-500 tracking-widest uppercase bg-black px-2 py-0.5 rounded border border-yellow-500/40">
              POP-ART COMMAND CENTER
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2 drop-shadow-[2px_2px_0_#000]">
            P &amp; OCS - Data Compilation - OCT - MAR
            <Sparkles className="w-5 h-5 text-yellow-400 animate-bounce" />
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
                    : 'bg-zinc-800 text-zinc-300 hover:text-white shadow-[2px_2px_0_0_#000]'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* Slicers and Controls Subbar */}
      <div className="bg-zinc-950/80 border-b-4 border-black px-6 py-3 flex flex-wrap items-center gap-6 z-40 shadow-[0_2px_0_0_#000]">
        {/* State Filter dropdown */}
        <div className="flex items-center gap-2 bg-zinc-900 border-2 border-black px-2 py-1 rounded shadow-[2px_2px_0_0_#000]">
          <Globe className="w-4 h-4 text-purple-400" />
          <select
            value={selectedState || ''}
            onChange={e => handleStateChange(e.target.value || null)}
            className="bg-transparent border-none text-xs text-zinc-200 font-bold focus:outline-none cursor-pointer"
          >
            <option value="" className="bg-zinc-900">All States</option>
            {availableStates.map(st => (
              <option key={st} value={st} className="bg-zinc-900">{st}</option>
            ))}
          </select>
        </div>

        {/* District Filter dropdown */}
        <div className="flex items-center gap-2 bg-zinc-900 border-2 border-black px-2 py-1 rounded shadow-[2px_2px_0_0_#000]">
          <MapPin className="w-4 h-4 text-emerald-400" />
          <select
            value={selectedDistrict || ''}
            disabled={availableDistricts.length === 0}
            onChange={e => setSelectedDistrict(e.target.value || null)}
            className="bg-transparent border-none text-xs text-zinc-200 font-bold focus:outline-none cursor-pointer disabled:opacity-50"
          >
            <option value="" className="bg-zinc-900">All Districts</option>
            {availableDistricts.map(dt => (
              <option key={dt} value={dt} className="bg-zinc-900">{dt}</option>
            ))}
          </select>
        </div>

        {/* Active Indicators Dropdown */}
        <div className="flex items-center gap-2 bg-zinc-900 border-2 border-black px-2 py-1 rounded shadow-[2px_2px_0_0_#000]">
          <Layers className="w-4 h-4 text-blue-400" />
          <select
            value={activeMetric}
            onChange={e => setActiveMetric(e.target.value)}
            className="bg-transparent border-none text-xs text-zinc-200 font-bold focus:outline-none cursor-pointer"
          >
            {Object.entries(
              INDICATORS.reduce((groups: any, ind) => {
                if (!groups[ind.group]) groups[ind.group] = [];
                groups[ind.group].push(ind);
                return groups;
              }, {})
            ).map(([group, inds]: any) => (
              <optgroup key={group} label={group} className="bg-zinc-900 text-zinc-400">
                {inds.map((ind: any) => (
                  <option key={ind.key} value={ind.key} className="text-zinc-200">
                    {ind.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Interactive Volume Slicer Slicer */}
        <div className="flex items-center gap-2 bg-zinc-900 border-2 border-black px-2 py-1 rounded shadow-[2px_2px_0_0_#000]">
          <SlidersHorizontal className="w-4 h-4 text-yellow-400" />
          <span className="text-xs font-black text-zinc-400 uppercase mr-1">Slicer:</span>
          <div className="flex gap-1">
            {[
              { id: 'all', label: 'All' },
              { id: 'high_screening', label: 'High Vol (>500)' },
              { id: 'alert_only', label: 'Alerts Only' }
            ].map(slice => (
              <button
                key={slice.id}
                onClick={() => setVolumeSlicer(slice.id as any)}
                className={`px-2 py-0.5 text-[10px] font-black uppercase rounded transition-colors ${
                  volumeSlicer === slice.id
                    ? 'bg-yellow-500 text-black font-extrabold'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {slice.label}
              </button>
            ))}
          </div>
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

      {/* Summary KPI Ribbon */}
      <div className="px-6 py-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-zinc-950/60 border-b-4 border-black">
        {/* Card 1: Total Screened */}
        <div className="bg-zinc-900 border-3 border-black p-4 rounded shadow-[3px_3px_0_0_#000] flex items-center justify-between group hover:-translate-y-0.5 transition-all">
          <div>
            <span className="text-[10px] font-black text-zinc-500 tracking-widest uppercase">Total Screened</span>
            <h3 className="text-xl font-black text-white mt-1">
              {totalScreened.toLocaleString()}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-lg bg-zinc-800 border-2 border-black flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2: Positive / Reactive cases */}
        <div className="bg-zinc-900 border-3 border-black p-4 rounded shadow-[3px_3px_0_0_#000] flex items-center justify-between group hover:-translate-y-0.5 transition-all">
          <div>
            <span className="text-[10px] font-black text-red-500 tracking-widest uppercase">Positives &amp; Reactive</span>
            <h3 className="text-xl font-black text-red-400 mt-1">
              {totalPositives.toLocaleString()}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-lg bg-red-950/30 border-2 border-red-500/50 flex items-center justify-center text-red-400 group-hover:scale-110 transition-transform">
            <AlertTriangle className="w-5 h-5 animate-pulse" />
          </div>
        </div>

        {/* Card 3: Treated / Linked to ART */}
        <div className="bg-zinc-900 border-3 border-black p-4 rounded shadow-[3px_3px_0_0_#000] flex items-center justify-between group hover:-translate-y-0.5 transition-all">
          <div>
            <span className="text-[10px] font-black text-emerald-500 tracking-widest uppercase">Treated &amp; Linked</span>
            <h3 className="text-xl font-black text-emerald-400 mt-1">
              {totalTreated.toLocaleString()}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-950/30 border-2 border-emerald-500/50 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
            <HeartPulse className="w-5 h-5" />
          </div>
        </div>

        {/* Card 4: Active Metric Status */}
        <div className="bg-yellow-500 border-3 border-black p-4 rounded shadow-[3px_3px_0_0_#000] flex items-center justify-between group hover:-translate-y-0.5 transition-all">
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

      {/* Main Command Dashboard Panels */}
      <div className="flex-1 grid grid-cols-1 xl:grid-cols-3 overflow-hidden relative">

        {/* Center Panel: Map area with custom border */}
        <div className="xl:col-span-2 relative h-[500px] xl:h-auto border-r-4 border-black overflow-hidden">
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
              className="absolute pointer-events-none p-4 bg-zinc-950 border-3 border-black text-xs rounded shadow-[6px_6px_0_0_#000] z-50 transition-all duration-100 max-w-sm"
              style={{ left: tooltip.x + 15, top: tooltip.y + 15 }}
            >
              <div className="flex items-center justify-between border-b-2 border-black pb-2 mb-2">
                <div>
                  <h4 className="font-black text-white text-sm uppercase tracking-wider">{tooltip.name}</h4>
                  <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">{tooltip.state || 'State Territory'}</p>
                </div>
                <div className="bg-yellow-500 border-2 border-black px-2 py-0.5 rounded text-[10px] font-black text-black">
                  {activeCategory}
                </div>
              </div>

              {tooltip.metrics ? (
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-zinc-300">
                    <span className="font-bold text-zinc-400">{activeMetricMeta?.label}:</span>
                    <span className="font-black text-yellow-400 text-sm">
                      {(tooltip.metrics[activeMetric] || 0).toLocaleString()}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-zinc-800 text-[10px]">
                    <div className="text-zinc-500 font-semibold">
                      HIV Screened: <span className="font-black text-zinc-300">{(tooltip.metrics.hiv_screened || 0).toLocaleString()}</span>
                    </div>
                    <div className="text-zinc-500 font-semibold">
                      HIV Positives: <span className="font-black text-rose-500">{(tooltip.metrics.hiv_confirmed_positive || 0).toLocaleString()}</span>
                    </div>
                    <div className="text-zinc-500 font-semibold">
                      TB Screened: <span className="font-black text-zinc-300">{(tooltip.metrics.tb_screened || 0).toLocaleString()}</span>
                    </div>
                    <div className="text-zinc-500 font-semibold">
                      TB Positives: <span className="font-black text-rose-500">{(tooltip.metrics.tb_positive || 0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-zinc-600 text-[10px] italic">No indicators reported for this region.</p>
              )}
            </div>
          )}

          {/* Choropleth Legend panel */}
          <div className="absolute bottom-6 left-6 z-30 p-4 bg-zinc-900 border-2 border-black rounded shadow-[4px_4px_0_0_#000] max-w-xs">
            <h4 className="text-[10px] font-black uppercase text-yellow-500 tracking-widest mb-2">GIS Choropleth Scale</h4>
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-[10px] text-zinc-500 font-black">0</span>
              <div className="flex-1 h-3 rounded-sm bg-gradient-to-r from-slate-800 to-indigo-600"></div>
              <span className="text-[10px] text-zinc-300 font-black">Max</span>
            </div>
            <p className="text-[9px] text-zinc-500 font-bold leading-tight">
              3D Extrusion height represents case intensity relative to national aggregate peaks.
            </p>
          </div>
        </div>

        {/* Right Details Panel: Clinical funnels and Metric Index */}
        <div className="xl:col-span-1 p-4 flex flex-col gap-4 bg-zinc-950/20 overflow-y-auto max-h-[calc(100vh-130px)]">
          
          {/* Active selection info */}
          <div className="bg-zinc-900 border-2 border-black rounded p-4 shadow-[3px_3px_0_0_#000]">
            <span className="text-[9px] uppercase tracking-widest text-yellow-500 font-black flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              Slicing Detail
            </span>
            <h2 className="text-lg font-black tracking-tight text-white mt-1 uppercase truncate">
              {selectedDetails?.name || 'National Aggregate'}
            </h2>
            {selectedDetails?.state && selectedDetails?.state !== selectedDetails?.name && (
              <p className="text-xs text-zinc-500 font-bold uppercase mt-0.5">State: {selectedDetails.state}</p>
            )}
          </div>

          {/* Clinical Cascade block funnels */}
          {selectedDetails && (
            <div className="bg-zinc-900 border-2 border-black rounded p-4 space-y-4 shadow-[4px_4px_0_0_#000]">
              <h3 className="text-xs font-black tracking-widest text-zinc-400 uppercase flex items-center gap-1.5 border-b border-zinc-800 pb-2">
                <HeartPulse className="w-4 h-4 text-rose-500" />
                Cascade Waterfall
              </h3>

              {/* TB Cascade Funnel */}
              <div>
                <span className="text-[9px] text-zinc-500 font-black uppercase tracking-wider block mb-2">Tuberculosis Waterfall</span>
                <div className="space-y-1.5">
                  {[
                    { label: 'Screened', val: selectedDetails.tb_screened || 0, color: 'bg-zinc-700' },
                    { label: 'Suspected', val: selectedDetails.tb_suspected || 0, color: 'bg-amber-500' },
                    { label: 'Tested', val: selectedDetails.tb_tested || 0, color: 'bg-indigo-500' },
                    { label: 'Positive', val: selectedDetails.tb_positive || 0, color: 'bg-rose-500' },
                    { label: 'Initiated', val: selectedDetails.tb_treatment_initiated || 0, color: 'bg-emerald-500' }
                  ].map((step, idx, arr) => {
                    const max = arr[0].val || 1;
                    const width = (step.val / max) * 100;
                    return (
                      <div key={step.label} className="text-[10px]">
                        <div className="flex justify-between text-zinc-400 mb-0.5 font-bold">
                          <span>{step.label}</span>
                          <span className="font-extrabold text-white">{step.val.toLocaleString()}</span>
                        </div>
                        <div className="w-full bg-zinc-950 h-2 border border-black">
                          <div className={`h-full ${step.color}`} style={{ width: `${width}%` }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* HIV Cascade Funnel */}
              <div>
                <span className="text-[9px] text-zinc-500 font-black uppercase tracking-wider block mb-2">HIV Waterfall</span>
                <div className="space-y-1.5">
                  {[
                    { label: 'Screened', val: selectedDetails.hiv_screened || 0, color: 'bg-zinc-700' },
                    { label: 'Reactive', val: selectedDetails.hiv_reactive || 0, color: 'bg-orange-500' },
                    { label: 'Confirmed', val: selectedDetails.hiv_confirmed_positive || 0, color: 'bg-rose-500' },
                    { label: 'ART Link', val: selectedDetails.linked_to_art || 0, color: 'bg-emerald-500' }
                  ].map((step, idx, arr) => {
                    const max = arr[0].val || 1;
                    const width = (step.val / max) * 100;
                    return (
                      <div key={step.label} className="text-[10px]">
                        <div className="flex justify-between text-zinc-400 mb-0.5 font-bold">
                          <span>{step.label}</span>
                          <span className="font-extrabold text-white">{step.val.toLocaleString()}</span>
                        </div>
                        <div className="w-full bg-zinc-950 h-2 border border-black">
                          <div className={`h-full ${step.color}`} style={{ width: `${width}%` }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Indicator Index */}
          <div className="bg-zinc-900 border-2 border-black rounded p-4 flex-1 flex flex-col shadow-[4px_4px_0_0_#000]">
            <h3 className="text-xs font-black tracking-widest text-zinc-400 uppercase mb-3 flex items-center gap-1.5 border-b border-zinc-800 pb-2">
              <Activity className="w-4 h-4 text-indigo-400" />
              Indicator Index
            </h3>

            {selectedDetails ? (
              <div className="space-y-2 flex-1 overflow-y-auto pr-1">
                {INDICATORS.map(ind => {
                  const val = selectedDetails[ind.key] || 0;
                  const isActive = activeMetric === ind.key;
                  return (
                    <div 
                      key={ind.key}
                      onClick={() => setActiveMetric(ind.key)}
                      className={`p-2 rounded cursor-pointer border-2 transition-all duration-150 flex justify-between items-center ${ind.color} ${
                        isActive
                          ? 'bg-zinc-950 border-black shadow-[2px_2px_0_0_#000] scale-[1.01]'
                          : 'bg-zinc-900/40 border-transparent hover:border-zinc-800'
                      }`}
                    >
                      <div className="max-w-[160px]">
                        <p className="text-[11px] font-black text-zinc-200">{ind.label}</p>
                        <p className="text-[9px] text-zinc-500 truncate font-semibold">{ind.desc}</p>
                      </div>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded border border-black ${
                        ind.alert && val > 0
                          ? 'bg-rose-600 text-white'
                          : 'bg-zinc-950 text-zinc-300'
                      }`}>
                        {val.toLocaleString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-zinc-600 text-xs italic py-8 text-center uppercase font-black">Select region to load index</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
