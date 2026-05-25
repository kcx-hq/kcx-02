import { useEffect, useRef } from "react";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";

type BaseEChartProps = {
  option: EChartsOption;
  height?: number;
  className?: string;
  onPointClick?: (params: unknown) => void;
  onPointHover?: (params: unknown) => void;
  onPointLeave?: () => void;
};

const sharedOption: EChartsOption = {
  animationDuration: 320,
  animationEasing: "cubicOut",
  textStyle: {
    fontFamily: "IBM Plex Sans, sans-serif",
    color: "#2d4544",
  },
  grid: {
    left: 8,
    right: 8,
    top: 22,
    bottom: 12,
    containLabel: true,
  },
};

export function BaseEChart({ option, height = 260, className, onPointClick, onPointHover, onPointLeave }: BaseEChartProps) {
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<echarts.EChartsType | null>(null);

  useEffect(() => {
    const node = chartContainerRef.current;
    if (!node) {
      return;
    }

    chartRef.current = echarts.init(node, undefined, { renderer: "canvas", useDirtyRect: true });

    const resizeObserver = new ResizeObserver(() => {
      chartRef.current?.resize();
    });

    resizeObserver.observe(node);

    return () => {
      resizeObserver.disconnect();
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!chartRef.current) {
      return;
    }

    chartRef.current.setOption(
      {
        ...sharedOption,
        ...option,
      },
      {
        notMerge: false,
        lazyUpdate: true,
      },
    );
  }, [option]);

  useEffect(() => {
    if (!chartRef.current) return;
    if (!onPointClick) return;

    const handler = (params: unknown) => {
      onPointClick(params);
    };

    chartRef.current.on("click", handler);
    return () => {
      chartRef.current?.off("click", handler);
    };
  }, [onPointClick]);

  useEffect(() => {
    if (!chartRef.current) return;
    if (!onPointHover && !onPointLeave) return;

    const handleOver = (params: unknown) => {
      onPointHover?.(params);
    };
    const handleOut = () => {
      onPointLeave?.();
    };

    if (onPointHover) {
      chartRef.current.on("mouseover", handleOver);
    }
    chartRef.current.on("mouseout", handleOut);
    chartRef.current.on("globalout", handleOut);

    return () => {
      if (onPointHover) {
        chartRef.current?.off("mouseover", handleOver);
      }
      chartRef.current?.off("mouseout", handleOut);
      chartRef.current?.off("globalout", handleOut);
    };
  }, [onPointHover, onPointLeave]);

  const containerClassName = className ? `dashboard-echart ${className}` : "dashboard-echart";

  return <div ref={chartContainerRef} className={containerClassName} style={{ height, cursor: onPointClick ? "pointer" : undefined }} aria-hidden="true" />;
}
