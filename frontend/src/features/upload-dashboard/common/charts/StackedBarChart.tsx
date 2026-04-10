import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { BaseEChart } from "./BaseEChart";
import { ChartPlaceholder } from "./ChartPlaceholder";

type StackedBarSeries = {
  name: string;
  values: number[];
};

type StackedBarChartProps = {
  categories: string[];
  series: StackedBarSeries[];
  height?: number;
};

const stackColors = ["#1f8b7a", "#66b9a8", "#a1d8cb", "#345f60"];

export function StackedBarChart({ categories, series, height }: StackedBarChartProps) {
  const option = useMemo<EChartsOption>(() => {
    return {
      color: stackColors,
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      legend: {
        bottom: 0,
        icon: "circle",
        itemWidth: 8,
        itemHeight: 8,
        textStyle: { color: "#58706d", fontSize: 11 },
      },
      grid: {
        left: 8,
        right: 8,
        top: 20,
        bottom: 34,
        containLabel: true,
      },
      xAxis: {
        type: "category",
        data: categories,
        axisLine: { lineStyle: { color: "#d7e4df" } },
        axisLabel: { color: "#5c7370", fontSize: 11 },
      },
      yAxis: {
        type: "value",
        splitLine: { lineStyle: { color: "#e5efec" } },
        axisLabel: { color: "#6d837e", fontSize: 11 },
      },
      series: series.map((item) => ({
        name: item.name,
        type: "bar",
        stack: "total",
        emphasis: { focus: "series" },
        barWidth: "46%",
        data: item.values,
      })),
    };
  }, [categories, series]);

  if (!categories.length || !series.length) {
    return <ChartPlaceholder />;
  }

  return <BaseEChart option={option} {...(height ? { height } : {})} />;
}
