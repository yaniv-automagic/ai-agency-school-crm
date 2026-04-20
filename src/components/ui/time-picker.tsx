import * as React from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

interface TimePickerProps {
  value?: string // "HH:mm"
  onChange?: (value: string) => void
  className?: string
}

export function TimePicker({ value = "09:00", onChange, className }: TimePickerProps) {
  const [hours, minutes] = (value || "09:00").split(":")

  const hourOptions = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"))
  const minuteOptions = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"))

  return (
    <div className={cn("flex items-center gap-1", className)} dir="ltr">
      <Select value={hours} onValueChange={h => onChange?.(`${h}:${minutes}`)}>
        <SelectTrigger className="w-[70px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-60">
          {hourOptions.map(h => (
            <SelectItem key={h} value={h}>{h}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-lg font-medium">:</span>
      <Select value={minutes} onValueChange={m => onChange?.(`${hours}:${m}`)}>
        <SelectTrigger className="w-[70px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-60">
          {minuteOptions.map(m => (
            <SelectItem key={m} value={m}>{m}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
