import { workspacePageQuerySchema } from "../../../packages/schemas/src/workspace-reads";
/** Only validates an existing opaque token and detects revisiting the current route's ancestors. */
export function canAdvanceCursor(nextCursor: string | null, visited: readonly (string | undefined)[]): boolean {
  return nextCursor !== null && workspacePageQuerySchema.shape.cursor.safeParse(nextCursor).success && !visited.includes(nextCursor);
}
