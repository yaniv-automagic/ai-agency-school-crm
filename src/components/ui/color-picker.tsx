import * as React from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308",
  "#84cc16", "#22c55e", "#10b981", "#14b8a6",
  "#06b6d4", "#0ea5e9", "#3b82f6", "#6366f1",
  "#8b5cf6", "#a855f7", "#d946ef", "#ec4899",
  "#f43f5e", "#78716c", "#64748b", "#1e293b",
]

interface ColorPickerProps {
  value?: string
  onChange?: (color: string) => void
  className?: string
}

export function ColorPicker({ value = "#6366f1", onChange, className }: ColorPickerProps) {
  const [open, setOpen] = React.useState(false)
  const [customColor, setCustomColor] = React.useState(value)

  React.useEffect(() => {
    setCustomColor(value)
  }, [value])

  const handleSelect = (color: string) => {
    onChange?.(color)
    setOpen(false)
  }

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const color = e.target.value
    setCustomColor(color)
    if (/^#[0-9a-fA-F]{6}$/.test(color)) {
      onChange?.(color)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "w-7 h-7 rounded-lg border border-input cursor-pointer ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            className
          )}
          style={{ backgroundColor: value }}
        />
      </PopoverTrigger>
      <PopoverContent className="w-[232px] p-3" align="start">
        <div className="grid grid-cols-5 gap-2 mb-3">
          {PRESET_COLORS.map(color => (
            <button
              key={color}
              type="button"
              onClick={() => handleSelect(color)}
              className={cn(
                "w-8 h-8 rounded-lg border-2 cursor-pointer transition-transform hover:scale-110",
                value === color ? "border-foreground ring-2 ring-ring" : "border-transparent"
              )}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
        <div className="flex items-center gap-2 pt-2 border-t">
          <div
            className="w-8 h-8 rounded-lg border border-input shrink-0"
            style={{ backgroundColor: /^#[0-9a-fA-F]{6}$/.test(customColor) ? customColor : value }}
          />
          <input
            type="text"
            value={customColor}
            onChange={handleCustomChange}
            placeholder="#000000"
            dir="ltr"
            className="flex-1 px-2 py-1.5 text-sm border border-input rounded-md bg-background font-mono focus:outline-none focus:ring-2 focus:ring-ring"
            maxLength={7}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
