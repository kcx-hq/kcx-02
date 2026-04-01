import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { BaseEChart } from "./BaseEChart";
import { ChartPlaceholder } from "./ChartPlaceholder";

type AreaPoint = {
  label: string;
  value: number;
};

type AreaChartProps = {
  data: AreaPoint[];
  height?: number;
};

export function AreaChart({ data, height }: AreaChartProps) {
  const option = useMemo<EChartsOption>(() => {
    return {
      color: ["#2c9c8a"],
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
        splitLine: { lineStyle: { color: "#e5efec" } },
        axisLabel: { color: "#6d837e", fontSize: 11 },
      },
      series: [
        {
          type: "line",
          smooth: true,
          data: data.map((item) => item.value),
          showSymbol: false,
          lineStyle: { width: 2 },
          areaStyle: {
            opacity: 0.22,
            color: "#89cbbe",
          },
        },
      ],
    };
  }, [data]);

  if (!data.length) {
    return <ChartPlaceholder />;
  }

  return <BaseEChart option={option} {...(height ? { height } : {})} />;
}
