import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TEMPLATE_VARIABLE_GROUPS } from "./types";

interface VariableInserterProps {
  onInsert: (varKey: string, varTemplate: string) => void;
  compact?: boolean;
}

export default function VariableInserter({ onInsert, compact }: VariableInserterProps) {
  return (
    <Select
      dir="rtl"
      onValueChange={(key) => {
        if (key) onInsert(key, `{{${key}}}`);
      }}
    >
      <SelectTrigger className={compact ? "h-6 w-[80px] text-[10px] px-1.5 gap-0" : "h-7 w-[90px] text-xs px-1.5 gap-0.5"}>
        <SelectValue placeholder="+ משתנה" />
      </SelectTrigger>
      <SelectContent className="max-h-[300px]">
        {TEMPLATE_VARIABLE_GROUPS.map((group) => (
          <SelectGroup key={group.label}>
            <SelectLabel className="text-[10px] font-bold text-muted-foreground">{group.label}</SelectLabel>
            {group.variables.map((v) => (
              <SelectItem key={v.key} value={v.key} className="text-xs">
                {v.label}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
