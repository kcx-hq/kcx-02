import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export function SectionPage({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-[56rem]">
          <h1 className="text-2xl font-semibold tracking-[-0.02em] sm:text-[1.75rem]">{title}</h1>
          <p className="mt-1 text-sm text-text-on-dark-muted">{description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary">Create</Button>
          <Button variant="outline">Export</Button>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Coming soon</CardTitle>
          <CardDescription>This section is scaffolded for navigation and layout parity.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-text-on-dark-muted">
            Replace this placeholder with operational workflows, tables, and forms for{" "}
            <span className="text-foreground">{title}</span>.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

