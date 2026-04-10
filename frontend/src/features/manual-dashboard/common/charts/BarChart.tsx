import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { BaseEChart } from "./BaseEChart";
import { ChartPlaceholder } from "./ChartPlaceholder";

type BarChartPoint = {
  label: string;
  value: number;
};

type BarChartProps = {
  data: BarChartPoint[];
  height?: number;
};

export function BarChart({ data, height }: BarChartProps) {
  const option = useMemo<EChartsOption>(() => {
    return {
      color: ["#2e9987"],
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      xAxis: {
        type: "category",
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
          type: "bar",
          barWidth: "42%",
          data: data.map((item) => item.value),
          itemStyle: {
            borderRadius: [6, 6, 0, 0],
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
