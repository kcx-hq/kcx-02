import { useEffect, useMemo, useRef, useState } from "react";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";

import type { CostBreakdownItem } from "../../api/dashboardApi";
import { ChartPlaceholder } from "./ChartPlaceholder";

type TopRegionsGeoMapProps = {
  data: CostBreakdownItem[];
  height?: number;
};

type Coordinate = {
  lat: number;
  lon: number;
};

type MappedRegion = {
  name: string;
  value: [number, number, number, number];
  billedCost: number;
  contributionPct: number;
  coordinateSource: "billing-file" | "mapped-reference";
};

const MAP_NAME = "kcx_world";
const PUBLIC_BASE_URL = import.meta.env.BASE_URL ?? "/";
const LOCAL_WORLD_MAP_FILES = ["maps/world-lite.geo.json"];

const TOP_ONE_REGION_COLOR = "#2563eb";
const BILLING_FILE_REGION_COLOR = "#1f8b7a";
const NON_BILLING_FILE_REGION_COLOR = "#6b7280";

const REGION_COORDINATES: Record<string, Coordinate> = {
  // AWS
  "us east (n. virginia)": { lat: 38.9072, lon: -77.0369 },
  "us east (ohio)": { lat: 39.9612, lon: -82.9988 },
  "us west (oregon)": { lat: 45.5152, lon: -122.6784 },
  "us west (n. california)": { lat: 37.7749, lon: -122.4194 },
  "canada (central)": { lat: 45.4215, lon: -75.6972 },
  "south america (sao paulo)": { lat: -23.5558, lon: -46.6396 },
  "eu (ireland)": { lat: 53.3498, lon: -6.2603 },
  "eu (london)": { lat: 51.5072, lon: -0.1276 },
  "eu (frankfurt)": { lat: 50.1109, lon: 8.6821 },
  "eu (paris)": { lat: 48.8566, lon: 2.3522 },
  "eu (stockholm)": { lat: 59.3293, lon: 18.0686 },
  "middle east (bahrain)": { lat: 26.2285, lon: 50.5861 },
  "africa (cape town)": { lat: -33.9249, lon: 18.4241 },
  "asia pacific (mumbai)": { lat: 19.076, lon: 72.8777 },
  "asia pacific (tokyo)": { lat: 35.6762, lon: 139.6503 },
  "asia pacific (singapore)": { lat: 1.3521, lon: 103.8198 },
  "asia pacific (sydney)": { lat: -33.8688, lon: 151.2093 },
  "asia pacific (seoul)": { lat: 37.5665, lon: 126.978 },

  // Azure
  "west europe": { lat: 52.3676, lon: 4.9041 },
  "north europe": { lat: 53.3498, lon: -6.2603 },
  "germany west central": { lat: 50.1109, lon: 8.6821 },
  "germany north": { lat: 52.52, lon: 13.405 },
  "norway east": { lat: 59.9139, lon: 10.7522 },
  "norway west": { lat: 60.39299, lon: 5.32415 },
  "sweden central": { lat: 59.3293, lon: 18.0686 },
  "switzerland north": { lat: 47.3769, lon: 8.5417 },
  "france central": { lat: 48.8566, lon: 2.3522 },
  "uksouth": { lat: 51.5072, lon: -0.1276 },
  "uk south": { lat: 51.5072, lon: -0.1276 },
  "ukwest": { lat: 53.483959, lon: -2.244644 },
  "uk west": { lat: 53.483959, lon: -2.244644 },
  "east us": { lat: 37.4316, lon: -78.6569 },
  "east us 2": { lat: 36.8508, lon: -76.2859 },
  "central us": { lat: 41.2565, lon: -95.9345 },
  "west us": { lat: 37.7749, lon: -122.4194 },
  "west us 2": { lat: 47.6062, lon: -122.3321 },
  "south central us": { lat: 32.7767, lon: -96.797 },
  "australia east": { lat: -33.8688, lon: 151.2093 },
  "southeast asia": { lat: 1.3521, lon: 103.8198 },
  "japan east": { lat: 35.6762, lon: 139.6503 },
  "central india": { lat: 19.076, lon: 72.8777 },

  // GCP
  "europe-west1": { lat: 50.1109, lon: 8.6821 },
  "europe-west2": { lat: 51.5072, lon: -0.1276 },
  "europe-west3": { lat: 50.9375, lon: 6.9603 },
  "europe-west4": { lat: 52.3676, lon: 4.9041 },
  "europe-west8": { lat: 47.3769, lon: 8.5417 },
  "europe-north1": { lat: 60.1699, lon: 24.9384 },
  "us-central1": { lat: 41.8781, lon: -87.6298 },
  "us-east1": { lat: 33.749, lon: -84.388 },
  "us-east4": { lat: 39.0438, lon: -77.4874 },
  "us-west1": { lat: 45.5152, lon: -122.6784 },
  "asia-south1": { lat: 19.076, lon: 72.8777 },
  "asia-east1": { lat: 25.033, lon: 121.5654 },
  "asia-northeast1": { lat: 35.6762, lon: 139.6503 },
};

let mapLoadedPromise: Promise<boolean> | null = null;

const getPublicAssetPath = (assetPath: string) => {
  const base = PUBLIC_BASE_URL.endsWith("/") ? PUBLIC_BASE_URL : `${PUBLIC_BASE_URL}/`;
  const normalizedAssetPath = assetPath.startsWith("/") ? assetPath.slice(1) : assetPath;
  return `${base}${normalizedAssetPath}`;
};

const isGeoJsonFeatureCollection = (value: unknown): boolean => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as { type?: unknown; features?: unknown };
  return candidate.type === "FeatureCollection" && Array.isArray(candidate.features) && candidate.features.length > 0;
};

const registerWorldMap = (mapPayload: unknown): boolean => {
  if (!isGeoJsonFeatureCollection(mapPayload)) {
    return false;
  }

  try {
    echarts.registerMap(MAP_NAME, mapPayload as Parameters<typeof echarts.registerMap>[1]);
    return true;
  } catch {
    return false;
  }
};

const loadWorldMap = async (): Promise<boolean> => {
  const getMapFn = (echarts as unknown as { getMap?: (name: string) => unknown }).getMap;
  if (typeof getMapFn === "function" && getMapFn(MAP_NAME)) {
    return true;
  }

  if (mapLoadedPromise) {
    return mapLoadedPromise;
  }

  mapLoadedPromise = (async () => {
    try {
      for (const filePath of LOCAL_WORLD_MAP_FILES) {
        const path = getPublicAssetPath(filePath);
        const localResponse = await fetch(path);
        if (!localResponse.ok) {
          continue;
        }

        const localGeoJson = await localResponse.json();
        if (registerWorldMap(localGeoJson)) {
          return true;
        }
      }

      const cdnResponse = await fetch("https://echarts.apache.org/examples/data/asset/geo/world.json");
      if (!cdnResponse.ok) {
        return false;
      }

      const cdnGeoJson = await cdnResponse.json();
      return registerWorldMap(cdnGeoJson);
    } catch {
      return false;
    }
  })();

  const isLoaded = await mapLoadedPromise;
  if (!isLoaded) {
    mapLoadedPromise = null;
  }
  return isLoaded;
};

const normalizeRegionName = (name: string) => name.trim().toLowerCase();

const toCoordinate = (name: string): Coordinate | null => {
  const normalized = normalizeRegionName(name);

  if (REGION_COORDINATES[normalized]) {
    return REGION_COORDINATES[normalized];
  }

  if (normalized.includes("virginia")) return REGION_COORDINATES["us east (n. virginia)"];
  if (normalized.includes("ohio")) return REGION_COORDINATES["us east (ohio)"];
  if (normalized.includes("oregon")) return REGION_COORDINATES["us west (oregon)"];
  if (normalized.includes("california")) return REGION_COORDINATES["us west (n. california)"];
  if (normalized.includes("ireland")) return REGION_COORDINATES["eu (ireland)"];
  if (normalized.includes("london")) return REGION_COORDINATES["eu (london)"];
  if (normalized.includes("frankfurt")) return REGION_COORDINATES["eu (frankfurt)"];
  if (normalized.includes("paris")) return REGION_COORDINATES["eu (paris)"];
  if (normalized.includes("stockholm")) return REGION_COORDINATES["eu (stockholm)"];
  if (normalized.includes("mumbai")) return REGION_COORDINATES["asia pacific (mumbai)"];
  if (normalized.includes("tokyo")) return REGION_COORDINATES["asia pacific (tokyo)"];
  if (normalized.includes("singapore")) return REGION_COORDINATES["asia pacific (singapore)"];
  if (normalized.includes("sydney")) return REGION_COORDINATES["asia pacific (sydney)"];
  if (normalized.includes("seoul")) return REGION_COORDINATES["asia pacific (seoul)"];
  if (normalized.includes("sao paulo")) return REGION_COORDINATES["south america (sao paulo)"];

  if (normalized.includes("west europe")) return REGION_COORDINATES["west europe"];
  if (normalized.includes("north europe")) return REGION_COORDINATES["north europe"];
  if (normalized.includes("germany west central")) return REGION_COORDINATES["germany west central"];
  if (normalized.includes("germany north")) return REGION_COORDINATES["germany north"];
  if (normalized.includes("norway east")) return REGION_COORDINATES["norway east"];
  if (normalized.includes("norway west")) return REGION_COORDINATES["norway west"];
  if (normalized.includes("sweden central")) return REGION_COORDINATES["sweden central"];
  if (normalized.includes("switzerland north")) return REGION_COORDINATES["switzerland north"];
  if (normalized.includes("france central")) return REGION_COORDINATES["france central"];
  if (normalized.includes("uk south")) return REGION_COORDINATES["uk south"];
  if (normalized.includes("uk west")) return REGION_COORDINATES["uk west"];
  if (normalized.includes("east us 2")) return REGION_COORDINATES["east us 2"];
  if (normalized.includes("east us")) return REGION_COORDINATES["east us"];
  if (normalized.includes("central us")) return REGION_COORDINATES["central us"];
  if (normalized.includes("west us 2")) return REGION_COORDINATES["west us 2"];
  if (normalized.includes("west us")) return REGION_COORDINATES["west us"];
  if (normalized.includes("south central us")) return REGION_COORDINATES["south central us"];
  if (normalized.includes("australia east")) return REGION_COORDINATES["australia east"];
  if (normalized.includes("southeast asia")) return REGION_COORDINATES["southeast asia"];
  if (normalized.includes("japan east")) return REGION_COORDINATES["japan east"];
  if (normalized.includes("central india")) return REGION_COORDINATES["central india"];

  return null;
};

const getGeoView = (points: MappedRegion[]) => {
  if (!points.length) {
    return {
      center: [15, 20] as [number, number],
      zoom: 1.2,
    };
  }

  const longitudes = points.map((point) => Number(point.value[0]));
  const latitudes = points.map((point) => Number(point.value[1]));

  const minLon = Math.min(...longitudes);
  const maxLon = Math.max(...longitudes);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);

  const lonSpan = maxLon - minLon;
  const latSpan = maxLat - minLat;
  const span = Math.max(lonSpan, latSpan);

  const centerLon = (minLon + maxLon) / 2;
  const centerLat = (minLat + maxLat) / 2;

  let zoom = 1.2;

  if (span <= 12) zoom = 4.5;
  else if (span <= 20) zoom = 3.8;
  else if (span <= 35) zoom = 3.1;
  else if (span <= 60) zoom = 2.4;
  else if (span <= 90) zoom = 1.9;
  else if (span <= 140) zoom = 1.45;
  zoom = Math.min(zoom * 1.22, 6.2);

  return {
    center: [centerLon, centerLat] as [number, number],
    zoom,
  };
};

const getTopMarkerSize = (spend: number, maxValue: number) => {
  if (maxValue <= 0) return 8;
  return 7 + Math.sqrt(spend / maxValue) * 5;
};

const mapData = (items: CostBreakdownItem[]): MappedRegion[] => {
  const sorted = [...items].sort((a, b) => b.billedCost - a.billedCost);

  return sorted
    .map((item) => {
      const hasBillingCoordinates = typeof item.latitude === "number" && typeof item.longitude === "number";
      const coordinate =
        hasBillingCoordinates
          ? { lat: item.latitude, lon: item.longitude }
          : toCoordinate(item.name);

      if (!coordinate) {
        return null;
      }

      return {
        name: item.name,
        value: [coordinate.lon, coordinate.lat, item.billedCost, item.contributionPct],
        billedCost: item.billedCost,
        contributionPct: item.contributionPct,
        coordinateSource: hasBillingCoordinates ? "billing-file" : "mapped-reference",
      };
    })
    .filter((item): item is MappedRegion => item !== null);
};

const buildOption = (items: CostBreakdownItem[]): EChartsOption => {
  const mapped = mapData(items);
  const top5Mapped = mapped.slice(0, 5);
  const top5Names = new Set(top5Mapped.map((item) => item.name));
  const normalMapped = mapped.filter((item) => !top5Names.has(item.name));
  const maxValue = mapped.reduce((acc, item) => Math.max(acc, item.billedCost), 0);
  const geoView = getGeoView(top5Mapped.length > 0 ? top5Mapped : mapped);
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);

  return {
    animation: true,
    backgroundColor: "transparent",
    tooltip: {
      trigger: "item",
      backgroundColor: "#0f172a",
      borderColor: "#1e293b",
      borderWidth: 1,
      textStyle: {
        color: "#e2e8f0",
      },
      extraCssText: [
        "border-radius:12px",
        "box-shadow:0 12px 34px rgba(2,6,23,0.35)",
        "padding:0",
        "overflow:hidden",
      ].join(";"),
      formatter: (params: any) => {
        const point = params?.data as MappedRegion | undefined;
        if (!point) return "";

        return `
          <div style="min-width: 170px; padding: 9px 11px;">
            <div style="font-size: 12px; font-weight: 700; color: #f8fafc; margin-bottom: 5px;">
              ${point.name}
            </div>
            <div style="font-size: 11px; color: #94a3b8; margin-bottom: 2px;">
              Total Spend:
              <span style="color: #e2e8f0; font-weight: 600;"> ${formatCurrency(point.billedCost)}</span>
            </div>
            <div style="font-size: 11px; color: #94a3b8;">
              Share:
              <span style="color: #e2e8f0; font-weight: 600;"> ${point.contributionPct.toFixed(2)}%</span>
            </div>
          </div>
        `;
      },
    },
    geo: {
      map: MAP_NAME,
      roam: true,
      center: geoView.center,
      zoom: geoView.zoom,
      scaleLimit: {
        min: 1,
        max: 8,
      },
      itemStyle: {
        areaColor: "#e8f1f6",
        borderColor: "#bfd0da",
        borderWidth: 1,
      },
      emphasis: {
        itemStyle: {
          areaColor: "#dce8ef",
        },
      },
    },
    series: [
      {
        name: "All Regions",
        type: "scatter",
        coordinateSystem: "geo",
        data: normalMapped.map((item) => ({
          ...item,
          itemStyle: {
            color: item.coordinateSource === "billing-file" ? BILLING_FILE_REGION_COLOR : NON_BILLING_FILE_REGION_COLOR,
            opacity: item.coordinateSource === "billing-file" ? 0.88 : 0.74,
          },
        })),
        z: 2,
        zlevel: 1,
        symbolSize: 7,
        emphasis: {
          scale: true,
          itemStyle: {
            borderColor: "#ffffff",
            borderWidth: 1.5,
            opacity: 1,
          },
        },
      },
      {
        name: "Top 5 Regions",
        type: "effectScatter",
        coordinateSystem: "geo",
        data: top5Mapped.map((item, index) => ({
          ...item,
          label: {
            show: true,
            formatter: item.name,
            position: "top",
            distance: 8,
            color: "#0f172a",
            fontSize: 10,
            fontWeight: 700,
            backgroundColor: "rgba(248, 250, 252, 0.95)",
            borderColor: "rgba(255, 255, 255, 0.96)",
            borderWidth: 1,
            padding: [2, 5],
            borderRadius: 999,
          },
          itemStyle: {
            color:
              index === 0
                ? TOP_ONE_REGION_COLOR
                : item.coordinateSource === "billing-file"
                  ? BILLING_FILE_REGION_COLOR
                  : NON_BILLING_FILE_REGION_COLOR,
            borderColor: "#ffffff",
            borderWidth: 1.5,
            shadowColor:
              index === 0
                ? "rgba(37, 99, 235, 0.24)"
                : item.coordinateSource === "billing-file"
                  ? "rgba(31, 139, 122, 0.22)"
                  : "rgba(107, 114, 128, 0.2)",
            shadowBlur: index === 0 ? 7 : 5,
          },
        })),
        z: 9,
        zlevel: 3,
        rippleEffect: {
          brushType: "stroke",
          scale: 2,
        },
        symbolSize: (value: (string | number)[]) => {
          const spend = Number(value[2] ?? 0);
          return getTopMarkerSize(spend, maxValue);
        },
        emphasis: {
          scale: true,
          itemStyle: {
            borderColor: "#ffffff",
            borderWidth: 2.5,
            shadowBlur: 14,
          },
        },
      },
    ],
  };
};

export function TopRegionsGeoMap({ data, height = 340 }: TopRegionsGeoMapProps) {
  const [isMapReady, setIsMapReady] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);

  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<echarts.EChartsType | null>(null);

  const option = useMemo(() => buildOption(data), [data]);

  const mappedCount = useMemo(() => {
    return data.filter((item) => {
      if (typeof item.latitude === "number" && typeof item.longitude === "number") {
        return true;
      }
      return Boolean(toCoordinate(item.name));
    }).length;
  }, [data]);

  useEffect(() => {
    let mounted = true;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    const tryLoadMap = async () => {
      attempt += 1;
      const loaded = await loadWorldMap();

      if (!mounted) return;

      setIsMapReady(loaded);
      setMapFailed(!loaded);

      if (!loaded && attempt < 2) {
        retryTimer = setTimeout(() => {
          void tryLoadMap();
        }, 1200);
      }
    };

    void tryLoadMap();

    return () => {
      mounted = false;
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
    };
  }, []);

  useEffect(() => {
    if (!isMapReady || !chartContainerRef.current) {
      return;
    }

    const chart = echarts.init(chartContainerRef.current, undefined, {
      renderer: "canvas",
    });

    chartRef.current = chart;
    chart.setOption(option, true);

    const resizeObserver = new ResizeObserver(() => {
      chart.resize();
    });

    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, [isMapReady, option]);

  if (!data.length) {
    return (
      <ChartPlaceholder
        title="No region data"
        message="Adjust filters to view region distribution."
      />
    );
  }

  if (mappedCount === 0) {
    return (
      <ChartPlaceholder
        title="No mapped region coordinates"
        message="Region names are available, but coordinates are missing or unmatched."
      />
    );
  }

  if (mapFailed) {
    return (
      <ChartPlaceholder
        title="Map unavailable"
        message="Could not load geo map. Check local map file or CDN access."
      />
    );
  }

  if (!isMapReady) {
    return (
      <ChartPlaceholder
        title="Loading region map"
        message="Preparing map visualization..."
      />
    );
  }

  return (
    <div
      ref={chartContainerRef}
      className="dashboard-echart w-full"
      style={{ height }}
      aria-hidden="true"
    />
  );
}
