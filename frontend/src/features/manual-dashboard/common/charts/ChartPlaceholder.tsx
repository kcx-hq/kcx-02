import { EmptyStateBlock } from "../components/EmptyStateBlock";

type ChartPlaceholderProps = {
  title?: string;
  message?: string;
};

export function ChartPlaceholder({ title = "No chart data", message = "Adjust filters or data source." }: ChartPlaceholderProps) {
  return <EmptyStateBlock title={title} message={message} />;
}
