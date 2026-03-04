"use client"

import * as React from "react"
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

interface TruncatedTextProps {
    /** The text to display with truncation */
    text: string
    /** Additional CSS classes for the text element */
    className?: string
    /** HTML element to render, defaults to "span" */
    as?: "span" | "div" | "h4" | "h5" | "p"
    /** Tooltip placement side */
    side?: "top" | "bottom" | "left" | "right"
    /** Tooltip alignment */
    align?: "start" | "center" | "end"
    /** Max width for the tooltip content */
    tooltipMaxWidth?: string
}

/**
 * Renders text with CSS truncation and a Tooltip showing the full text on hover.
 * Wraps the text in the specified HTML element with `truncate` applied.
 */
export function TruncatedText({
    text,
    className,
    as: Component = "span",
    side = "top",
    align = "start",
    tooltipMaxWidth = "max-w-xs",
}: TruncatedTextProps) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Component className={cn("truncate cursor-default", className)}>
                    {text}
                </Component>
            </TooltipTrigger>
            <TooltipContent side={side} align={align}>
                <p className={tooltipMaxWidth}>{text}</p>
            </TooltipContent>
        </Tooltip>
    )
}
