'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Map from 'react-map-gl/maplibre';
import { GeoJsonLayer } from '@deck.gl/layers';
import { LightingEffect, AmbientLight, PointLight } from '@deck.gl/core';
import dynamic from 'next/dynamic';
import { normalizeGeographicKey } from '@/lib/normalizeGeographicKey';
import { feature } from 'topojson-client';
import 'maplibre-gl/dist/maplibre-gl.css';

const DeckGL = dynamic(() => import('@deck.gl/react').then(mod => mod.default), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-zinc-950 flex items-center justify-center text-zinc-500">Initializing 3D Map Engine...</div>
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

// Create a premium 3D Lighting Effect
const ambientLight = new AmbientLight({
  color: [255, 255, 255],
  intensity: 1.0
});

const pointLight = new PointLight({
  color: [255, 255, 255],
  intensity: 1.5,
  position: [82.0, 22.0, 80000]
});

const lightingEffect = new LightingEffect({ ambientLight, pointLight });

interface MapComponentProps {
  category: string;
  activeMetric: string;
  selectedState: string | null;
  selectedDistrict: string | null;
  onSelectState: (state: string | null) => void;
  onSelectDistrict: (district: string | null) => void;
  data: any; // data.json contents
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
  setTooltip
}: MapComponentProps) {
  const [viewState, setViewState] = useState({
    longitude: 78.9629,
    latitude: 22.5937,
    zoom: 4.5,
    pitch: 45,
    bearing: -10
  });

  const [topoGeoData, setTopoGeoData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Load geojson data based on selectedState
  useEffect(() => {
    setLoading(true);
    const stateKey = selectedState ? normalizeGeographicKey(selectedState) : null;
    const stateFile = stateKey ? STATE_FILE_MAP[stateKey] : null;
    const statesToLoad = stateFile ? [stateFile] : Object.values(STATE_FILE_MAP);

    let isCancelled = false;
    Promise.all(
      statesToLoad.map(fileName =>
        fetch(`/geojson/states/${fileName}.json`)
          .then(res => {
            if (!res.ok) throw new Error(`Failed to load ${fileName}`);
            return res.json();
          })
          .then(topology => {
            const objectKey = Object.keys(topology.objects)[0];
            const geojson: any = feature(topology, topology.objects[objectKey]);
            if (geojson.type === 'FeatureCollection') {
              return geojson.features;
            } else if (geojson.type === 'Feature') {
              return [geojson];
            }
            return [];
          })
          .then(features => {
            return (features || []).filter((f: any) => f && f.geometry);
          })
          .catch(err => {
            console.error(err);
            return [];
          })
      )
    ).then(results => {
      if (isCancelled) return;
      const mergedFeatures = results.flat();
      setTopoGeoData({
        type: 'FeatureCollection',
        features: mergedFeatures
      });
      setLoading(false);
    });

    return () => {
      isCancelled = true;
    };
  }, [selectedState]);

  // Bounding box calculator
  const getBBox = (coordinates: any[]): [number, number, number, number] => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const processCoords = (coords: any[]) => {
      coords.forEach(c => {
        if (typeof c[0] === 'number') {
          minX = Math.min(minX, c[0]);
          minY = Math.min(minY, c[1]);
          maxX = Math.max(maxX, c[0]);
          maxY = Math.max(maxY, c[1]);
        } else {
          processCoords(c);
        }
      });
    };
    processCoords(coordinates);
    return [minX, minY, maxX, maxY];
  };

  // Center viewState on state select
  useEffect(() => {
    if (selectedState && topoGeoData?.features?.length > 0) {
      // Find a feature belonging to the selected state
      const sample = topoGeoData.features.find((f: any) => {
        const fState = f.properties?.st_nm || f.properties?.state || '';
        return normalizeGeographicKey(fState) === normalizeGeographicKey(selectedState);
      });
      if (sample && sample.geometry?.coordinates) {
        const bbox = getBBox(sample.geometry.coordinates);
        setViewState(prev => ({
          ...prev,
          longitude: (bbox[0] + bbox[2]) / 2,
          latitude: (bbox[1] + bbox[3]) / 2,
          zoom: 6.2,
          transitionDuration: 1000
        } as any));
      }
    } else if (!selectedState) {
      // Revert to India default view
      setViewState(prev => ({
        ...prev,
        longitude: 78.9629,
        latitude: 20.5937,
        zoom: 4.5,
        pitch: 40,
        bearing: -10,
        transitionDuration: 1000
      } as any));
    }
  }, [selectedState, topoGeoData]);

  // Extract active dataset dict
  const activeDict = useMemo(() => {
    const categoryData = data[category.toLowerCase()] || data['combined'];
    // Merge both states and districts to single dictionary for lookup
    const dict = new globalThis.Map<string, any>();
    if (categoryData?.districts) {
      Object.entries(categoryData.districts).forEach(([k, v]) => dict.set(k, v));
    }
    if (categoryData?.states) {
      Object.entries(categoryData.states).forEach(([k, v]) => dict.set(k, v));
    }
    return dict;
  }, [category, data]);

  // Find max value of active indicator for scale mapping
  const maxVal = useMemo(() => {
    let max = 1;
    activeDict.forEach((metrics) => {
      const val = metrics[activeMetric] || 0;
      if (val > max) max = val;
    });
    return max;
  }, [activeDict, activeMetric]);

  // Heuristic indicator categorization for coloring
  const isAlertIndicator = useMemo(() => {
    const alerts = [
      'sti_rti_diagnosed',
      'hiv_reactive',
      'hiv_confirmed_positive',
      'syphilis_reactive',
      'tb_suspected',
      'tb_positive'
    ];
    return alerts.includes(activeMetric);
  }, [activeMetric]);

  const getColor = useCallback((metrics: any): [number, number, number, number] => {
    if (!metrics) return [30, 41, 59, 140]; // Dark Slate-800 for empty
    const val = metrics[activeMetric] || 0;
    if (val === 0) return [30, 41, 59, 140];

    const ratio = Math.min(val / maxVal, 1);

    if (isAlertIndicator) {
      // Hot Red/Orange scale for alert indicators (high value = urgent)
      return [
        Math.floor(220 + ratio * 35), // Red
        Math.floor(80 - ratio * 60),  // Green
        Math.floor(80 - ratio * 60),  // Blue
        220
      ];
    } else {
      // Emerald Green / Teal scale for screening / service metrics (high value = positive)
      return [
        Math.floor(16 + ratio * 20),
        Math.floor(120 + ratio * 100),
        Math.floor(100 + ratio * 80),
        220
      ];
    }
  }, [activeMetric, maxVal, isAlertIndicator]);

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
      wireframe: true,
      lineWidthMinPixels: 1.5,
      getLineColor: [255, 255, 255, 25],
      getFillColor: (f: any) => {
        const name = f.properties?.district || f.properties?.st_nm || '';
        const key = normalizeGeographicKey(name);
        const metrics = activeDict.get(key);
        return getColor(metrics);
      },
      getElevation: (f: any) => {
        const name = f.properties?.district || f.properties?.st_nm || '';
        const key = normalizeGeographicKey(name);
        const metrics = activeDict.get(key);
        if (!metrics) return 100;
        const val = metrics[activeMetric] || 0;
        return (val / maxVal) * 35000 + 100; // Scale height up to 35km
      },
      updateTriggers: {
        getFillColor: [activeMetric, activeDict, maxVal],
        getElevation: [activeMetric, activeDict, maxVal]
      },
      onHover: (info: any) => {
        if (info.x && info.y && info.object) {
          const props = info.object.properties;
          const name = props.district || props.st_nm || '';
          const state = props.st_nm || props.state || '';
          const key = normalizeGeographicKey(name);
          const metrics = activeDict.get(key);

          setTooltip({
            x: info.x,
            y: info.y,
            name,
            state,
            metrics: metrics || null
          });
        } else {
          setTooltip(null);
        }
      },
      onClick: (info: any) => {
        if (info.object) {
          const props = info.object.properties;
          const stateName = props.st_nm || props.state || '';
          const districtName = props.district || '';

          if (districtName) {
            onSelectDistrict(districtName);
          }
          if (stateName) {
            onSelectState(stateName);
          }
        }
      }
    });
  }, [topoGeoData, activeMetric, activeDict, maxVal, getColor, onSelectState, onSelectDistrict, setTooltip]);

  return (
    <div className="relative w-full h-full">
      <DeckGL
        viewState={viewState}
        onViewStateChange={(e: any) => setViewState(e.viewState)}
        controller={true}
        layers={[mapLayer].filter(Boolean)}
        effects={[lightingEffect]}
        getCursor={({ isHovering }) => (isHovering ? 'pointer' : 'default')}
      >
        <Map
          reuseMaps
          mapLib={import('maplibre-gl')}
          mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
        />
      </DeckGL>

      {loading && (
        <div className="absolute top-4 left-4 z-50 px-4 py-2 bg-black/80 border border-zinc-800 text-xs font-semibold text-zinc-300 rounded-md shadow-2xl backdrop-blur-md flex items-center gap-2">
          <svg className="animate-spin h-3.5 w-3.5 text-indigo-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Loading Geographic Geometry...
        </div>
      )}
    </div>
  );
}
