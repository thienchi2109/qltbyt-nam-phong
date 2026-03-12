"use client"

import * as React from "react"
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { cn } from "@/lib/utils"

/**
 * Styled Markdown renderer for AI assistant responses.
 *
 * Uses react-markdown + remark-gfm with design-spec styled components.
 * Memoized component map follows rerender-memo best practice.
 * Design spec §4.3 — Markdown Rendering in AI Responses.
 */

const markdownComponents: React.ComponentProps<typeof Markdown>["components"] = {
    strong: ({ children }) => (
        <strong className="font-semibold">{children}</strong>
    ),
    em: ({ children }) => <em className="italic">{children}</em>,
    code: ({ className, children, ...props }) => {
        const isBlock = className?.includes("language-")
        if (isBlock) {
            return (
                <code
                    className={cn(
                        "block bg-muted rounded-lg p-3 text-xs font-mono overflow-x-auto my-2",
                        className,
                    )}
                    {...props}
                >
                    {children}
                </code>
            )
        }
        return (
            <code
                className="bg-muted/60 px-1.5 py-0.5 rounded text-xs font-mono"
                {...props}
            >
                {children}
            </code>
        )
    },
    table: ({ children }) => (
        <div className="my-2 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-xs border-collapse">{children}</table>
        </div>
    ),
    thead: ({ children }) => (
        <thead className="bg-muted/50">{children}</thead>
    ),
    th: ({ children }) => (
        <th className="px-2 py-1.5 text-left font-medium border-b border-border">
            {children}
        </th>
    ),
    td: ({ children }) => (
        <td className="px-2 py-1.5 border-b border-border/50">{children}</td>
    ),
    tr: ({ children, ...props }) => (
        <tr className="even:bg-muted/30" {...props}>
            {children}
        </tr>
    ),
    ul: ({ children }) => (
        <ul className="pl-4 my-1 list-disc marker:text-primary">{children}</ul>
    ),
    ol: ({ children }) => (
        <ol className="pl-4 my-1 list-decimal">{children}</ol>
    ),
    li: ({ children }) => <li className="my-0.5">{children}</li>,
    h3: ({ children }) => (
        <h3 className="font-semibold text-sm mt-2 mb-1">{children}</h3>
    ),
    h4: ({ children }) => (
        <h4 className="font-semibold text-sm mt-2 mb-1">{children}</h4>
    ),
    a: ({ href, children }) => (
        <a
            href={href}
            className="text-primary underline underline-offset-2 hover:text-primary/80"
            target="_blank"
            rel="noopener noreferrer"
        >
            {children}
        </a>
    ),
    p: ({ children }) => <p className="my-1 leading-relaxed">{children}</p>,
}

interface AssistantMarkdownRendererProps {
    content: string
}

export const AssistantMarkdownRenderer = React.memo(
    function AssistantMarkdownRenderer({ content }: AssistantMarkdownRendererProps) {
        return (
            <Markdown
                remarkPlugins={[remarkGfm]}
                components={markdownComponents}
            >
                {content}
            </Markdown>
        )
    },
)
