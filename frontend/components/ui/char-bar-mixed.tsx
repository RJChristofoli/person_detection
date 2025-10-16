"use client"

import { TrendingUp } from "lucide-react"
import { Bar, BarChart, XAxis, YAxis, Cell } from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"

export const description = "A mixed bar chart"

// Componente genérico de barra mista para uma série única (vertical)
export function ChartBarMixedSimple({
  data,
  categoryKey = "category",
  valueKey = "value",
  config,
  className,
}: {
  data: Array<Record<string, any>>
  categoryKey?: string
  valueKey?: string
  config: ChartConfig
  className?: string
}) {
  return (
    <ChartContainer
      config={config}
      className={className}
      style={{ aspectRatio: "auto", width: "100%", height: "100%" }}
    >
      <BarChart
        accessibilityLayer
        data={data}
        layout="vertical"
        margin={{ left: 12, right: 12, top: 8, bottom: 8 }}
      >
        <YAxis
          dataKey={categoryKey}
          type="category"
          tickLine={false}
          tickMargin={10}
          axisLine={false}
          tickFormatter={(value) => config[value as keyof typeof config]?.label as string}
        />
        <XAxis dataKey={valueKey} type="number" hide />
        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
        <Bar dataKey={valueKey} layout="vertical" radius={5}>
          {data.map((entry) => (
            <Cell key={entry[categoryKey]} fill={`var(--color-${entry[categoryKey]})`} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}
