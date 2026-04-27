import { useEffect, useRef } from "react";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";

type BaseEChartProps = {
  option: EChartsOption;
  height?: number;
  className?: string;
  onPointClick?: (params: unknown) => void;
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

export function BaseEChart({ option, height = 260, className, onPointClick }: BaseEChartProps) {
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<echarts.EChartsType | null>(null);

  useEffect(() => {
    const node = chartContainerRef.current;
    if (!node) {
      return;
    }

    chartRef.current = echarts.init(node, undefined, { renderer: "canvas" });

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
      true,
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

  const containerClassName = className ? `dashboard-echart ${className}` : "dashboard-echart";

  return <div ref={chartContainerRef} className={containerClassName} style={{ height }} aria-hidden="true" />;
}
