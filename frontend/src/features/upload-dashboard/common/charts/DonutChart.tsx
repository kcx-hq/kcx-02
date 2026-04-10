import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { BaseEChart } from "./BaseEChart";
import { ChartPlaceholder } from "./ChartPlaceholder";

type DonutSlice = {
  name: string;
  value: number;
};

type DonutChartProps = {
  data: DonutSlice[];
  height?: number;
};

const donutColors = ["#1f8b7a", "#56ab99", "#8ac8ba", "#bedfd8", "#355d5d"];

export function DonutChart({ data, height }: DonutChartProps) {
  const option = useMemo<EChartsOption>(() => {
    return {
      color: donutColors,
      tooltip: { trigger: "item" },
      legend: {
        bottom: 0,
        icon: "circle",
        itemWidth: 8,
        itemHeight: 8,
        textStyle: { color: "#58706d", fontSize: 11 },
      },
      series: [
        {
          name: "Breakdown",
          type: "pie",
          radius: ["58%", "76%"],
          center: ["50%", "44%"],
          avoidLabelOverlap: true,
          itemStyle: {
            borderColor: "#f7fbfb",
            borderWidth: 2,
          },
          label: {
            show: false,
          },
          labelLine: {
            show: false,
          },
          data,
        },
      ],
    };
  }, [data]);

  if (!data.length) {
    return <ChartPlaceholder />;
  }

  return <BaseEChart option={option} {...(height ? { height } : {})} />;
}
