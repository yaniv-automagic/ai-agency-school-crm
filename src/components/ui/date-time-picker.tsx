import * as React from "react"
import { format, parse } from "date-fns"
import { he } from "date-fns/locale"
import { CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface DateTimePickerProps {
  value?: string // "YYYY-MM-DDTHH:mm" or "YYYY-MM-DD HH:mm"
  onChange?: (value: string) => void
  placeholder?: string
  className?: string
  required?: boolean
  disabled?: boolean
}

export function DateTimePicker({
  value,
  onChange,
  placeholder = "בחר תאריך ושעה",
  className,
  disabled,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false)

  const parsed = React.useMemo(() => {
    if (!value) return { date: undefined, hours: "09", minutes: "00" }
    const normalized = value.replace("T", " ")
    const [datePart, timePart] = normalized.split(" ")
    const date = parse(datePart, "yyyy-MM-dd", new Date())
    const [hours, minutes] = (timePart || "09:00").split(":")
    return { date, hours: hours || "09", minutes: minutes || "00" }
  }, [value])

  const emitChange = (date: Date | undefined, hours: string, minutes: string) => {
    if (date) {
      const dateStr = format(date, "yyyy-MM-dd")
      onChange?.(`${dateStr}T${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`)
    }
  }

  const handleDateSelect = (day: Date | undefined) => {
    if (day) {
      emitChange(day, parsed.hours, parsed.minutes)
    }
  }

  const handleHourChange = (h: string) => {
    emitChange(parsed.date, h, parsed.minutes)
  }

  const handleMinuteChange = (m: string) => {
    emitChange(parsed.date, parsed.hours, m)
  }

  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"))
  const minutes = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"))

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-between text-right font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="h-4 w-4 opacity-50" />
          {parsed.date ? (
            <span dir="ltr">
              {parsed.hours}:{parsed.minutes}{" "}
              {format(parsed.date, "dd/MM/yyyy", { locale: he })}
            </span>
          ) : (
            <span>{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={parsed.date}
          onSelect={handleDateSelect}
          locale={he}
          initialFocus
        />
        <div className="border-t p-3 flex items-center gap-2 justify-center" dir="ltr">
          <Select value={parsed.hours} onValueChange={handleHourChange}>
            <SelectTrigger className="w-[70px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {hours.map(h => (
                <SelectItem key={h} value={h}>{h}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-lg font-medium">:</span>
          <Select value={parsed.minutes} onValueChange={handleMinuteChange}>
            <SelectTrigger className="w-[70px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {minutes.map(m => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </PopoverContent>
    </Popover>
  )
}
