'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Map from 'react-map-gl/maplibre';
import { GeoJsonLayer, TextLayer, ColumnLayer } from '@deck.gl/layers';
import { LightingEffect, AmbientLight, PointLight } from '@deck.gl/core';
import dynamic from 'next/dynamic';
import { normalizeGeographicKey } from '@/lib/normalizeGeographicKey';
import { feature } from 'topojson-client';
import 'maplibre-gl/dist/maplibre-gl.css';

const DeckGL = dynamic(() => import('@deck.gl/react').then(mod => mod.default), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-slate-50 flex items-center justify-center text-slate-500">Initializing 3D Map Engine...</div>
});

const STATE_FILE_MAP: Record<string, string> = {
  'maharashtra': 'maharashtra',
  'karnataka': 'karnataka',
  'delhi': 'delhi',
  'tamil nadu': 'tamilnadu',
  'uttar pradesh': 'uttar-pradesh',
  'west bengal': 'west-bengal',
  'gujarat': 'gujarat',
  'rajasthan': 'rajasthan',
  'madhya pradesh': 'madhya-pradesh',
  'andhra pradesh': 'andhra-pradesh',
  'telangana': 'telangana',
  'kerala': 'kerala',
  'bihar': 'bihar',
  'odisha': 'odisha',
  'punjab': 'punjab',
  'haryana': 'haryana',
  'jharkhand': 'jharkhand',
  'chhattisgarh': 'chhattisgarh',
  'assam': 'assam',
  'uttarakhand': 'uttarakhand',
  'himachal pradesh': 'himachal-pradesh',
  'goa': 'goa',
  'jammu and kashmir': 'jammu-and-kashmir',
  'ladakh': 'ladakh',
  'mizoram': 'mizoram',
  'chandigarh': 'chandigarh',
  'arunachal pradesh': 'arunachal-pradesh',
  'manipur': 'manipur',
  'meghalaya': 'meghalaya',
  'nagaland': 'nagaland',
  'sikkim': 'sikkim',
  'tripura': 'tripura',
  'andaman and nicobar islands': 'andaman-and-nicobar-islands',
  'dnh and dd': 'dnh-and-dd',
  'lakshadweep': 'lakshadweep',
  'puducherry': 'puducherry',
};

// Premium lighting
const ambientLight = new AmbientLight({ color: [255, 255, 255], intensity: 1.2 });
const pointLight = new PointLight({ color: [255, 245, 200], intensity: 2.0, position: [82.0, 22.0, 120000] });
const lightingEffect = new LightingEffect({ ambientLight, pointLight });

// Centroid calculator — average of all leaf coordinates
const getCentroid = (coordinates: any[]): [number, number] => {
  let sumX = 0, sumY = 0, count = 0;
  const traverse = (coords: any[]) => {
    if (typeof coords[0] === 'number') { sumX += coords[0]; sumY += coords[1]; count++; }
    else { for (let i = 0; i < coords.length; i++) traverse(coords[i]); }
  };
  traverse(coordinates);
  return count > 0 ? [sumX / count, sumY / count] : [78.9629, 22.5937];
};

// Bounding box calculator
const getBBox = (coordinates: any[]): [number, number, number, number] => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const processCoords = (coords: any[]) => {
    coords.forEach(c => {
      if (typeof c[0] === 'number') {
        minX = Math.min(minX, c[0]); minY = Math.min(minY, c[1]);
        maxX = Math.max(maxX, c[0]); maxY = Math.max(maxY, c[1]);
      } else { processCoords(c); }
    });
  };
  processCoords(coordinates);
  return [minX, minY, maxX, maxY];
};

interface MapComponentProps {
  category: string;
  activeMetric: string;
  selectedState: string | null;
  selectedDistrict: string | null;
  onSelectState: (state: string | null) => void;
  onSelectDistrict: (district: string | null) => void;
  data: any;
  setTooltip: (tooltip: any) => void;
}

export default function MapComponent({
  category,
  activeMetric,
  selectedState,
  selectedDistrict,
  onSelectState,
  onSelectDistrict,
  data,
  setTooltip,
}: MapComponentProps) {
  const [viewState, setViewState] = useState({
    longitude: 78.9629,
    latitude: 22.5937,
    zoom: 4.5,
    pitch: 45,
    bearing: -10,
  });

  const [topoGeoData, setTopoGeoData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // depthLevel: 'state' = national view, 'district' = zoomed into a state
  const depthLevel: 'state' | 'district' = useMemo(() => {
    if (selectedState || viewState.zoom >= 5.8) return 'district';
    return 'state';
  }, [selectedState, viewState.zoom]);

  // Load GeoJSON on state selection change
  useEffect(() => {
    setLoading(true);
    const stateKey = selectedState ? normalizeGeographicKey(selectedState) : null;
    const stateFile = stateKey ? STATE_FILE_MAP[stateKey] : null;
    const statesToLoad = stateFile ? [stateFile] : Object.values(STATE_FILE_MAP);

    let isCancelled = false;
    Promise.all(
      statesToLoad.map(fileName =>
        fetch(`/geojson/states/${fileName}.json`)
          .then(res => { if (!res.ok) throw new Error(`Failed to load ${fileName}`); return res.json(); })
          .then(topology => {
            const objectKey = Object.keys(topology.objects)[0];
            const geojson: any = feature(topology, topology.objects[objectKey]);
            if (geojson.type === 'FeatureCollection') return geojson.features;
            if (geojson.type === 'Feature') return [geojson];
            return [];
          })
          .then(features => (features || []).filter((f: any) => f && f.geometry))
          .catch(err => { console.error(err); return []; })
      )
    ).then(results => {
      if (isCancelled) return;
      setTopoGeoData({ type: 'FeatureCollection', features: results.flat() });
      setLoading(false);
    });

    return () => { isCancelled = true; };
  }, [selectedState]);

  // Fly to selected state
  useEffect(() => {
    if (selectedState && topoGeoData?.features?.length > 0) {
      const sample = topoGeoData.features.find((f: any) => {
        const fState = f.properties?.st_nm || f.properties?.state || '';
        return normalizeGeographicKey(fState) === normalizeGeographicKey(selectedState);
      });
      if (sample?.geometry?.coordinates) {
        const bbox = getBBox(sample.geometry.coordinates);
        setViewState(prev => ({
          ...prev,
          longitude: (bbox[0] + bbox[2]) / 2,
          latitude: (bbox[1] + bbox[3]) / 2,
          zoom: 6.2,
          pitch: 50,
          bearing: -8,
        } as any));
      }
    } else if (!selectedState) {
      setViewState(prev => ({
        ...prev,
        longitude: 78.9629,
        latitude: 20.5937,
        zoom: 4.5,
        pitch: 45,
        bearing: -10,
      } as any));
    }
  }, [selectedState, topoGeoData]);

  // Fly to selected district
  useEffect(() => {
    if (selectedDistrict && topoGeoData?.features?.length > 0) {
      const feature = topoGeoData.features.find((f: any) => {
        const dist = f.properties?.district || f.properties?.dtname || '';
        return normalizeGeographicKey(dist) === normalizeGeographicKey(selectedDistrict);
      });
      if (feature?.geometry?.coordinates) {
        const bbox = getBBox(feature.geometry.coordinates);
        setViewState(prev => ({
          ...prev,
          longitude: (bbox[0] + bbox[2]) / 2,
          latitude: (bbox[1] + bbox[3]) / 2,
          zoom: 8.5,
          pitch: 52,
          bearing: -5,
        } as any));
      }
    }
  }, [selectedDistrict, topoGeoData]);

  // Build the active data dictionary (districts + states)
  const activeDict = useMemo(() => {
    const categoryData = data[category.toLowerCase()] || data['combined'];
    const dict = new globalThis.Map<string, any>();
    if (categoryData?.districts) Object.entries(categoryData.districts).forEach(([k, v]) => dict.set(k, v));
    if (categoryData?.states) Object.entries(categoryData.states).forEach(([k, v]) => dict.set(k, v));
    return dict;
  }, [category, data]);

  // Max value for scale mapping
  const maxVal = useMemo(() => {
    let max = 1;
    activeDict.forEach(metrics => { const val = metrics[activeMetric] || 0; if (val > max) max = val; });
    return max;
  }, [activeDict, activeMetric]);

  // Is this metric an alert metric (red scale) or a screening metric (green/teal scale)?
  const isAlertIndicator = useMemo(() => {
    return ['tb_positive', 'hiv_reactive', 'hiv_confirmed_positive', 'sti_rti_diagnosed'].includes(activeMetric);
  }, [activeMetric]);

  const getColor = useCallback((metrics: any): [number, number, number, number] => {
    if (!metrics) return [226, 232, 240, 120]; // slate-200
    const val = metrics[activeMetric] || 0;
    if (val === 0) return [226, 232, 240, 120];
    const ratio = Math.min(val / maxVal, 1);
    if (isAlertIndicator) {
      // Red → Orange gradient (high = more TB positives)
      return [
        Math.floor(220 + ratio * 35),
        Math.floor(50 + ratio * 30),
        Math.floor(30 + ratio * 20),
        200 + Math.floor(ratio * 55),
      ];
    } else {
      // Teal → Indigo gradient (high = more HIV screened)
      return [
        Math.floor(6 + ratio * 60),
        Math.floor(148 + ratio * 70),
        Math.floor(180 + ratio * 60),
        180 + Math.floor(ratio * 60),
      ];
    }
  }, [activeMetric, maxVal, isAlertIndicator]);

  // Pre-calculate centroids and bounding boxes for all features
  const geoMetadata = useMemo(() => {
    const cache = new globalThis.Map<string, { center: [number, number]; bbox: [number, number, number, number] }>();
    if (!topoGeoData?.features) return cache;

    // Group all features by state name → compute merged bbox for state centroid
    const stateGroups = new globalThis.Map<string, { minX: number; minY: number; maxX: number; maxY: number; label: string }>();

    topoGeoData.features.forEach((f: any) => {
      const stateName = f.properties?.st_nm || f.properties?.state || '';
      const districtName = f.properties?.district || f.properties?.dtname || '';

      // District centroid
      if (districtName && f.geometry?.coordinates) {
        const bbox = getBBox(f.geometry.coordinates);
        cache.set(`district-${normalizeGeographicKey(districtName)}`, {
          center: [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2],
          bbox,
        });
      }

      // State bbox accumulation
      if (stateName && f.geometry?.coordinates) {
        const key = normalizeGeographicKey(stateName);
        const bbox = getBBox(f.geometry.coordinates);
        const existing = stateGroups.get(key);
        if (!existing) {
          stateGroups.set(key, { minX: bbox[0], minY: bbox[1], maxX: bbox[2], maxY: bbox[3], label: stateName });
        } else {
          existing.minX = Math.min(existing.minX, bbox[0]);
          existing.minY = Math.min(existing.minY, bbox[1]);
          existing.maxX = Math.max(existing.maxX, bbox[2]);
          existing.maxY = Math.max(existing.maxY, bbox[3]);
        }
      }
    });

    stateGroups.forEach((v, key) => {
      if (v.minX !== Infinity) {
        cache.set(`state-${key}`, {
          center: [(v.minX + v.maxX) / 2, (v.minY + v.maxY) / 2],
          bbox: [v.minX, v.minY, v.maxX, v.maxY],
        });
      }
    });

    return cache;
  }, [topoGeoData]);

  // State-level labels: one label per state, always visible in national view
  const stateLabels = useMemo(() => {
    if (!topoGeoData?.features) return [];

    // Build unique state names from features
    const stateNameMap = new globalThis.Map<string, string>(); // key → display name
    topoGeoData.features.forEach((f: any) => {
      const stateName = f.properties?.st_nm || f.properties?.state || '';
      if (stateName) stateNameMap.set(normalizeGeographicKey(stateName), stateName);
    });

    const labels: any[] = [];
    stateNameMap.forEach((displayName, key) => {
      const cached = geoMetadata.get(`state-${key}`);
      if (!cached) return;
      const metrics = activeDict.get(key);
      const val = metrics ? (metrics[activeMetric] || 0) : 0;
      if (val > 0) labels.push({ name: displayName, value: val, position: cached.center, isState: true });
    });
    return labels;
  }, [topoGeoData, geoMetadata, activeDict, activeMetric]);

  // District-level labels: visible when state is selected or zoomed in
  const districtLabels = useMemo(() => {
    if (!topoGeoData?.features) return [];

    const labels: any[] = [];
    topoGeoData.features.forEach((f: any) => {
      const districtName = f.properties?.district || f.properties?.dtname || '';
      const stateName = f.properties?.st_nm || f.properties?.state || '';

      // If a state is selected, only show districts of that state
      if (selectedState && normalizeGeographicKey(stateName) !== normalizeGeographicKey(selectedState)) return;
      if (!districtName) return;

      const key = normalizeGeographicKey(districtName);
      const cached = geoMetadata.get(`district-${key}`);
      if (!cached) return;

      const metrics = activeDict.get(key);
      const val = metrics ? (metrics[activeMetric] || 0) : 0;
      if (val > 0) labels.push({ name: districtName, value: val, position: cached.center, isState: false });
    });
    return labels;
  }, [topoGeoData, geoMetadata, activeDict, activeMetric, selectedState]);

  // Active map labels based on zoom depth level
  const activeLabels = useMemo(() => {
    return depthLevel === 'state' ? stateLabels : districtLabels;
  }, [depthLevel, stateLabels, districtLabels]);

  // Max value among active labels (for column height scaling)
  const maxLabelVal = useMemo(() => {
    let max = 1;
    activeLabels.forEach(d => { if (d.value > max) max = d.value; });
    return max;
  }, [activeLabels]);

  // GeoJSON choropleth layer
  const mapLayer = useMemo(() => {
    if (!topoGeoData) return null;
    return new GeoJsonLayer({
      id: 'india-geojson-layer',
      data: topoGeoData,
      pickable: true,
      autoHighlight: true,
      stroked: true,
      filled: true,
      extruded: true,
      wireframe: false,
      lineWidthMinPixels: 1,
      getLineColor: [100, 100, 120, 60],
      getFillColor: (f: any) => {
        const districtName = f.properties?.district || f.properties?.dtname || '';
        const stateName = f.properties?.st_nm || f.properties?.state || '';
        const useName = depthLevel === 'district' ? districtName : stateName;
        const key = normalizeGeographicKey(useName || districtName || stateName);
        return getColor(activeDict.get(key));
      },
      getElevation: (f: any) => {
        const districtName = f.properties?.district || f.properties?.dtname || '';
        const stateName = f.properties?.st_nm || f.properties?.state || '';
        const useName = depthLevel === 'district' ? districtName : stateName;
        const key = normalizeGeographicKey(useName || districtName || stateName);
        const metrics = activeDict.get(key);
        if (!metrics) return 500;
        const val = metrics[activeMetric] || 0;
        return (val / maxVal) * 40000 + 500;
      },
      updateTriggers: {
        getFillColor: [activeMetric, activeDict, maxVal, depthLevel],
        getElevation: [activeMetric, activeDict, maxVal, depthLevel],
      },
      onHover: (info: any) => {
        if (info.x && info.y && info.object) {
          const props = info.object.properties;
          const districtName = props.district || props.dtname || '';
          const stateName = props.st_nm || props.state || '';
          const name = districtName || stateName;
          const key = normalizeGeographicKey(name);
          const metrics = activeDict.get(key);
          setTooltip({ x: info.x, y: info.y, name, state: stateName, metrics: metrics || null });
        } else {
          setTooltip(null);
        }
      },
      onClick: (info: any) => {
        if (info.object) {
          const props = info.object.properties;
          const stateName = props.st_nm || props.state || '';
          const districtName = props.district || props.dtname || '';
          if (districtName) onSelectDistrict(districtName);
          if (stateName) onSelectState(stateName);
        }
      },
    });
  }, [topoGeoData, activeMetric, activeDict, maxVal, getColor, onSelectState, onSelectDistrict, setTooltip, depthLevel]);

  // Glowing column pillars on each label position
  const columnLayer = useMemo(() => {
    if (!activeLabels.length) return null;
    return new ColumnLayer({
      id: 'indicator-columns',
      data: activeLabels,
      pickable: false,
      extruded: true,
      diskResolution: 6,
      radius: depthLevel === 'state' ? 15000 : 6000,
      getPosition: (d: any) => d.position,
      getElevation: (d: any) => {
        const ratio = maxLabelVal > 0 ? d.value / maxLabelVal : 0;
        return ratio * 55000 + 2000;
      },
      getFillColor: (d: any) => {
        if (d.value === 0) return [200, 210, 220, 80];
        const ratio = maxLabelVal > 0 ? Math.min(d.value / maxLabelVal, 1) : 0;
        if (isAlertIndicator) {
          return [255, Math.floor(80 - ratio * 60), Math.floor(60 - ratio * 40), 220];
        } else {
          return [Math.floor(6 + ratio * 60), Math.floor(182 + ratio * 50), Math.floor(212 - ratio * 30), 220];
        }
      },
      updateTriggers: {
        getElevation: [activeLabels, maxLabelVal],
        getFillColor: [activeLabels, maxLabelVal, isAlertIndicator],
      },
    });
  }, [activeLabels, maxLabelVal, depthLevel, isAlertIndicator]);

  // Text layer — state/district name + value on each pillar
  const textLayer = useMemo(() => {
    if (!activeLabels.length) return null;

    return new TextLayer({
      id: 'indicator-text-layer',
      data: activeLabels,
      pickable: false,
      parameters: { depthTest: false, blend: true },
      getPosition: (d: any) => {
        const ratio = maxLabelVal > 0 ? d.value / maxLabelVal : 0;
        const elev = ratio * 55000 + 2000;
        return [d.position[0], d.position[1], elev + 6000];
      },
      getText: (d: any) => {
        const valuePart = d.value > 0 ? d.value.toLocaleString() : '—';
        const namePart = depthLevel === 'state'
          ? d.name.toUpperCase()
          : d.name;
        return `${namePart}\n${valuePart}`;
      },
      getSize: depthLevel === 'state' ? 13 : 11,
      sizeUnits: 'pixels',
      getAngle: 0,
      getTextAnchor: 'middle',
      getAlignmentBaseline: 'center',
      getColor: [15, 23, 42, 255], // slate-900
      background: true,
      backgroundColor: [255, 255, 255, 230],
      backgroundPadding: [5, 3, 5, 3],
      fontFamily: 'Inter, system-ui, sans-serif',
      fontWeight: 700,
      updateTriggers: {
        getText: [activeMetric, activeLabels],
        getPosition: [activeLabels, maxLabelVal],
        getSize: [depthLevel],
      },
    });
  }, [activeLabels, maxLabelVal, depthLevel, activeMetric]);

  return (
    <div className="relative w-full h-full">
      <DeckGL
        viewState={viewState}
        onViewStateChange={(e: any) => setViewState(e.viewState)}
        controller={true}
        layers={[mapLayer, columnLayer, textLayer].filter(Boolean)}
        effects={[lightingEffect]}
        getCursor={({ isHovering }) => (isHovering ? 'pointer' : 'default')}
      >
        <Map
          reuseMaps
          mapLib={import('maplibre-gl')}
          mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
        />
      </DeckGL>

      {/* Depth indicator badge */}
      <div className="absolute top-3 right-3 z-30 flex items-center gap-1.5 bg-white/90 backdrop-blur border border-slate-200 rounded-md px-3 py-1.5 shadow-sm">
        <div className={`w-2 h-2 rounded-full ${depthLevel === 'district' ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600">
          {depthLevel === 'state' ? 'State View' : 'District View'}
        </span>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-30 bg-white/90 backdrop-blur border border-slate-200 rounded-lg px-4 py-3 shadow-sm">
        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">
          {activeMetric === 'hiv_screened' ? 'HIV Screened' : 'TB Positive'}
        </p>
        <div className="flex items-center gap-2">
          <div className={`w-20 h-3 rounded-sm ${isAlertIndicator ? 'bg-gradient-to-r from-orange-100 to-red-600' : 'bg-gradient-to-r from-sky-100 to-cyan-600'}`} />
          <span className="text-[9px] text-slate-500 font-semibold">Low → High</span>
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[8px] text-slate-400">0</span>
          <span className="text-[8px] text-slate-400">{maxVal.toLocaleString()}</span>
        </div>
      </div>

      {/* Loading overlay */}
      {loading && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-white/90 border border-slate-200 text-xs font-semibold text-slate-700 rounded-md shadow-lg backdrop-blur-md flex items-center gap-2">
          <svg className="animate-spin h-3.5 w-3.5 text-indigo-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Loading Geographic Data...
        </div>
      )}
    </div>
  );
}
