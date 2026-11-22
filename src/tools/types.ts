import type { CallToolResult, ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import type { z } from "zod";
import type { Deps } from "../deps.js";

/** One tool: its MCP metadata and a handler built from deps. */
export interface ToolDef<Shape extends z.ZodRawShape> {
  name: string;
  title: string;
  description: string;
  inputSchema: Shape;
  annotations: ToolAnnotations;
  handler: (deps: Deps) => (input: z.infer<z.ZodObject<Shape>>) => Promise<CallToolResult>;
}

export function defineTool<Shape extends z.ZodRawShape>(def: ToolDef<Shape>): ToolDef<Shape> {
  return def;
}
