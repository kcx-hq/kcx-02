import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { BaseEChart } from "./BaseEChart";
import { ChartPlaceholder } from "./ChartPlaceholder";

export type TrendPoint = {
  label: string;
  value: number;
};

type LineTrendChartProps = {
  data: TrendPoint[];
  height?: number;
};

export function LineTrendChart({ data, height }: LineTrendChartProps) {
  const option = useMemo<EChartsOption>(() => {
    return {
      color: ["#1f8b7a"],
      tooltip: { trigger: "axis" },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: data.map((item) => item.label),
        axisLine: { lineStyle: { color: "#d7e4df" } },
        axisLabel: { color: "#5c7370", fontSize: 11 },
      },
      yAxis: {
        type: "value",
        axisLine: { show: false },
        splitLine: { lineStyle: { color: "#e5efec" } },
        axisLabel: { color: "#6d837e", fontSize: 11 },
      },
      series: [
        {
          type: "line",
          smooth: true,
          data: data.map((item) => item.value),
          symbolSize: 6,
          lineStyle: { width: 2.1 },
          itemStyle: { color: "#1f8b7a", borderColor: "#f7fbfb", borderWidth: 1.5 },
          areaStyle: { opacity: 0 },
        },
      ],
    };
  }, [data]);

  if (!data.length) {
    return <ChartPlaceholder />;
  }

  return <BaseEChart option={option} {...(height ? { height } : {})} />;
}
