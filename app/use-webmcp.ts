"use client";
import { useEffect, useLayoutEffect, useRef } from "react";
type Tool = {
  name: string;
  title: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => unknown | Promise<unknown>;
};
type Registry = {
  registerTool: (
    tool: Tool,
    options: { signal: AbortSignal },
  ) => void | Promise<void>;
};
export function useWebMcp(
  read: () => unknown,
  start: (id: string) => Promise<unknown>,
) {
  const callbacks = useRef({ read, start });
  useLayoutEffect(() => {
    callbacks.current = { read, start };
  }, [read, start]);
  useEffect(() => {
    const context = (document as Document & { modelContext?: Registry })
      .modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const tools: Tool[] = [
      {
        name: "read_lotline_response",
        title: "Read recall response",
        description:
          "Read quantities and unresolved records in the currently selected recall response. No stock changes.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute(input) {
          if (
            !input ||
            typeof input !== "object" ||
            Array.isArray(input) ||
            Object.keys(input).length
          )
            throw new Error("Expected an empty object.");
          return callbacks.current.read();
        },
      },
      {
        name: "start_lotline_label_verification",
        title: "Open label verification",
        description:
          "Open the existing label verification form for a stock id. Does not verify a label, save data, or record a physical action.",
        inputSchema: {
          type: "object",
          properties: { stockId: { type: "string" } },
          required: ["stockId"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        execute(input) {
          if (
            !input ||
            typeof input !== "object" ||
            Array.isArray(input) ||
            Object.keys(input).length !== 1 ||
            !("stockId" in input) ||
            typeof input.stockId !== "string" ||
            !/^[A-Za-z0-9_-]{1,60}$/.test(input.stockId)
          )
            throw new Error("A valid stockId is required.");
          return callbacks.current.start(input.stockId);
        },
      },
    ];
    for (const tool of tools) {
      try {
        void Promise.resolve(
          context.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => {});
      } catch {
        /* Browser support is optional. */
      }
    }
    return () => lifecycle.abort();
  }, []);
}
