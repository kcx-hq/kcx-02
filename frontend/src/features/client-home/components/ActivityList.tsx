import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type ActivityListColumn<T extends { id: string }> = {
  key: string
  label: string
  render: (row: T) => ReactNode
}

type ActivityListProps<T extends { id: string }> = {
  title: string
  rows: T[]
  columns: ActivityListColumn<T>[]
  emptyText: string
  viewAllLabel?: string
}

export function ActivityList<T extends { id: string }>({
  title,
  rows,
  columns,
  emptyText,
  viewAllLabel = "View all",
}: ActivityListProps<T>) {
  return (
    <Card className="rounded-md border-[color:var(--border-light)] bg-[color:var(--kcx-card-light)] shadow-sm-custom">
      <CardHeader className="flex flex-row items-center justify-between p-5 pb-3">
        <CardTitle className="text-base text-text-primary">{title}</CardTitle>
        <Button variant="ghost" className="h-8 rounded-md px-2 text-sm text-text-secondary">
          {viewAllLabel}
        </Button>
      </CardHeader>
      <CardContent className="p-5 pt-0">
        {rows.length === 0 ? (
          <div className="rounded-md border border-dashed border-[color:var(--border-light)] bg-[color:var(--bg-surface)] p-4 text-sm text-text-muted">
            {emptyText}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((column) => (
                  <TableHead key={column.key}>{column.label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.slice(0, 3).map((row) => (
                <TableRow key={row.id}>
                  {columns.map((column) => (
                    <TableCell key={column.key}>{column.render(row)}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
