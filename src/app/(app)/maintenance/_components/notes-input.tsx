import * as React from "react"
import { Input } from "@/components/ui/input"

export const NotesInput = React.memo(({ taskId, value, onChange }: {
  taskId: number;
  value: string;
  onChange: (value: string) => void;
}) => {
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8"
      autoFocus
    />
  );
});
NotesInput.displayName = "NotesInput";
