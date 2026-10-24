import { FileText, CircleDot, Hash, ListChecks, SquareCheck, TextCursorInput, ToggleLeft } from "lucide-react";
import type { QuestionType } from "@/lib/tests";

export const QUESTION_TYPE_ICONS: Record<QuestionType, React.ComponentType<{ className?: string }>> = {
  single: CircleDot,
  multiple: SquareCheck,
  truefalse: ToggleLeft,
  dropdown: ListChecks,
  short: TextCursorInput,
  long: FileText,
  number: Hash,
};
