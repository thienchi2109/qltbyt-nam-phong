# Vercel AI SDK — Assistant Chat UI/UX Design Plan

> **Revision 2 — 2026-03-03** — Major upgrade from v1 skeleton to production-ready premium design spec.
> Informed by 2026 AI chat UI trends (ChatGPT, Claude, Gemini, Copilot patterns).

---

## 1. Design Philosophy & Inspiration

### 1.1 Core Principles

| Principle | Description |
|-----------|-------------|
| **Copilot, not Chatbot** | An intelligent workspace extension, not a popup widget. Feels like a senior colleague available on demand. |
| **Trust through Transparency** | Clear indicators for thinking, tool execution, and draft output. Never leave the user guessing what the AI is doing. |
| **Contextual & Non-intrusive** | Accessible from anywhere without disrupting the current workflow. Quick dismiss, instant resume. |
| **Vietnamese-first** | All UI labels, placeholders, disclaimers, and suggested questions in Vietnamese. |

### 1.2 Trend Influences (2026)

| Trend | Source | How we apply it |
|-------|--------|-----------------|
| **Floating workspace panel** | Copilot (assistive side panel), Gemini (Dynamic View) | Floating popover anchored to FAB — not a modal that blocks content |
| **Streaming word-by-word reveal** | ChatGPT, Claude | Smooth character-by-character rendering with subtle fade-in per word |
| **Tool execution transparency** | Claude (Cowork mode), Copilot (shared workspace) | Collapsible inline cards showing which RPC/tool is executing and its result |
| **Glassmorphism + soft shadows** | Gemini visual design, enterprise SaaS trends | Semi-translucent panel backdrop with layered depth |
| **Proactive suggested actions** | Gemini, Copilot Notebooks | Quick-ask chips, context-aware suggestions |
| **Thinking state animation** | Gemini (gradient shimmer), Claude (pulsing dots) | Branded shimmer gradient during AI processing |
| **Markdown-rich responses** | ChatGPT, Claude | Formatted tables, code blocks, bold/italic, lists in AI responses |
| **Dark mode as first-class** | All platforms | Full dark mode parity using existing CSS variables |

---

## 2. Color System (Assistant-Specific Tokens)

Extends the project's HSL-based CSS variable system in `globals.css`. These tokens are **scoped to the assistant** to avoid polluting global styles.

### 2.1 Chat-Specific CSS Variables

```css
/* --- Light Mode --- */
:root {
  /* Assistant panel background — subtle warm off-white */
  --assistant-bg: 210 20% 98%;
  --assistant-border: 214 20% 90%;

  /* User message bubble — primary teal gradient anchor */
  --assistant-user-bubble: 194 45% 42%;
  --assistant-user-bubble-hover: 194 45% 38%;
  --assistant-user-text: 0 0% 100%;

  /* AI message bubble — soft neutral surface */
  --assistant-ai-bubble: 210 15% 95%;
  --assistant-ai-text: 224 71% 4%;

  /* Accent for links, icons, interactive elements */
  --assistant-accent: 194 50% 48%;
  --assistant-accent-muted: 194 30% 90%;

  /* Tool execution card */
  --assistant-tool-bg: 194 25% 96%;
  --assistant-tool-border: 194 20% 88%;
  --assistant-tool-icon: 194 45% 42%;

  /* Suggested question chip */
  --assistant-chip-bg: 0 0% 100%;
  --assistant-chip-border: 214 20% 88%;
  --assistant-chip-hover-bg: 194 40% 96%;
  --assistant-chip-hover-border: 194 35% 72%;
  --assistant-chip-text: 220 10% 35%;

  /* Shimmer/thinking gradient */
  --assistant-shimmer-from: 194 40% 92%;
  --assistant-shimmer-via: 194 50% 85%;
  --assistant-shimmer-to: 194 40% 92%;

  /* Status indicator */
  --assistant-status-online: 142 70% 45%;
  --assistant-status-error: 0 84% 60%;
}

/* --- Dark Mode --- */
.dark {
  --assistant-bg: 200 35% 11%;
  --assistant-border: 200 25% 18%;

  --assistant-user-bubble: 194 45% 38%;
  --assistant-user-bubble-hover: 194 45% 42%;
  --assistant-user-text: 0 0% 98%;

  --assistant-ai-bubble: 200 25% 16%;
  --assistant-ai-text: 0 0% 92%;

  --assistant-accent: 194 50% 55%;
  --assistant-accent-muted: 194 30% 20%;

  --assistant-tool-bg: 200 25% 14%;
  --assistant-tool-border: 200 20% 22%;
  --assistant-tool-icon: 194 50% 55%;

  --assistant-chip-bg: 200 30% 14%;
  --assistant-chip-border: 200 25% 22%;
  --assistant-chip-hover-bg: 194 25% 18%;
  --assistant-chip-hover-border: 194 35% 40%;
  --assistant-chip-text: 0 0% 80%;

  --assistant-shimmer-from: 194 30% 16%;
  --assistant-shimmer-via: 194 40% 24%;
  --assistant-shimmer-to: 194 30% 16%;

  --assistant-status-online: 142 60% 50%;
  --assistant-status-error: 0 62% 50%;
}
```

### 2.2 Design Token Rationale

- **User bubble** uses the brand teal (`194°`) saturated higher than the global primary for visual pop against the neutral AI bubble.
- **AI bubble** remains neutral gray to create clear visual hierarchy — user = colored, AI = neutral.
- **Tool execution cards** use a desaturated teal tint to feel "system-level" without competing with message bubbles.
- **Shimmer gradient** uses three teal stops for a smooth branded loading animation.

---

## 3. Typography (Chat Context)

Uses the project's existing font stack (system fonts). These size scales are optimized for chat readability.

| Element | Size | Weight | Line-height | Letter-spacing |
|---------|------|--------|-------------|----------------|
| Panel header title | `text-sm` (14px) | `font-semibold` (600) | 1.4 | -0.01em |
| User message body | `text-sm` (14px) | `font-normal` (400) | 1.6 | normal |
| AI message body | `text-sm` (14px) | `font-normal` (400) | 1.65 | 0.005em |
| AI message — bold/heading in markdown | `text-sm` (14px) | `font-semibold` (600) | 1.5 | -0.005em |
| AI message — code inline | `text-xs` (12px) | `font-mono` (400) | 1.5 | 0.02em |
| AI message — code block | `text-xs` (12px) | `font-mono` (400) | 1.6 | 0.02em |
| Timestamp / metadata | `text-[11px]` | `font-normal` (400) | 1.4 | 0.02em |
| Composer input | `text-sm` (14px) | `font-normal` (400) | 1.5 | normal |
| Composer placeholder | `text-sm` (14px) | `font-normal` (400) | 1.5 | normal |
| Suggested chip text | `text-xs` (12px) | `font-medium` (500) | 1.4 | 0.01em |
| Disclaimer footer | `text-[11px]` | `font-normal` (400) | 1.4 | 0.01em |
| Tool execution label | `text-xs` (12px) | `font-medium` (500) | 1.4 | 0.01em |

---

## 4. Component Specifications

### 4.1 AssistantTriggerButton (FAB)

| Property | Value |
|----------|-------|
| **Position** | Fixed, bottom-right. Uses existing `.fab-above-footer` utility (bottom offset for mobile footer nav, `z-70`). |
| **Size** | `48×48px` desktop, `52×52px` mobile (meets 44px touch target) |
| **Shape** | Fully round (`rounded-full`) |
| **Background** | `bg-gradient-to-br from-primary-600 to-primary-700` — subtle teal gradient |
| **Shadow** | `shadow-lg` → `shadow-xl` on hover |
| **Icon** | `Sparkles` from `lucide-react` (24px, white). Transitions to `X` when panel is open. |
| **Hover** | `scale(1.08)`, shadow elevation increase, 200ms ease-out |
| **Active/Press** | `scale(0.95)`, 100ms |
| **Tooltip** | "Trợ lý AI" (shown on desktop hover after 500ms delay) |
| **Badge** | Optional future: small pulsing dot (absolute `-top-0.5 -right-0.5`, `bg-destructive`, 8px) for unread notifications |
| **Transition** | Icon crossfade with `rotate-90` on state change, 200ms |

### 4.2 AssistantPanel (Container)

| Property | Value |
|----------|-------|
| **Position (desktop)** | Fixed, anchored 16px above FAB, right-aligned. `right-6 bottom-[calc(env(safe-area-inset-bottom,0px)+6rem)]` |
| **Size (desktop)** | `w-[420px] h-[min(680px,calc(100vh-8rem))]` — large enough for rich content, contained enough to feel non-intrusive |
| **Size (mobile < 768px)** | Full-screen bottom sheet: `inset-0`, with drag-down-to-dismiss handle |
| **Background** | `hsl(var(--assistant-bg))` with `backdrop-blur-xl` for glassmorphism |
| **Border** | `1px solid hsl(var(--assistant-border))` |
| **Border radius** | `rounded-2xl` desktop, `rounded-t-2xl rounded-b-none` mobile (sheet) |
| **Shadow** | `shadow-2xl` with custom spread: `0 25px 50px -12px rgba(0,0,0,0.15)` light / `rgba(0,0,0,0.4)` dark |
| **z-index** | `z-[998]` — below `Dialog` (z-999) so dialogs triggered by chat remain on top |
| **Layout** | Flex column: `[header] [message-list (flex-1 overflow)] [suggested-questions?] [composer] [disclaimer]` |

#### Panel entrance/exit animation

```
Opening:  translate-y-4 → translate-y-0, opacity 0 → 1, scale 0.97 → 1
          duration: 250ms, ease-out (cubic-bezier(0.16, 1, 0.3, 1))

Closing:  reverse with duration: 180ms, ease-in
```

#### Panel Header

| Element | Spec |
|---------|------|
| **Title** | "Trợ lý ảo CVMEMS" — `text-sm font-semibold`, left-aligned |
| **Status dot** | 6px circle, `bg-[hsl(var(--assistant-status-online))]` with `animate-pulse` (subtle), next to title |
| **Status text** | "Sẵn sàng" — `text-[11px] text-muted-foreground`, shown on desktop only |
| **Actions (right)** | Icon buttons (20×20 icon, 32×32 touch target): `RotateCcw` (reset chat), `Minus` (minimize), `X` (close) |
| **Border** | `border-b border-[hsl(var(--assistant-border))]` |
| **Padding** | `px-4 py-3` |
| **Height** | ~48px |

### 4.3 AssistantMessageList

| Property | Value |
|----------|-------|
| **Container** | `flex-1 overflow-y-auto` with momentum scrolling (`-webkit-overflow-scrolling: touch`) |
| **Padding** | `px-4 py-3` |
| **Message gap** | `gap-3` (12px between messages) |
| **Auto-scroll** | Scroll to bottom on new AI message; pause auto-scroll if user has scrolled up; show "scroll to bottom" FAB when not at bottom |

#### User Message Bubble

| Property | Value |
|----------|-------|
| **Alignment** | Right-aligned (`ml-12` max offset from left) |
| **Background** | `hsl(var(--assistant-user-bubble))` |
| **Text color** | `hsl(var(--assistant-user-text))` (white) |
| **Border radius** | `rounded-2xl rounded-br-md` — fully rounded except bottom-right creates "speech tail" effect |
| **Padding** | `px-3.5 py-2.5` |
| **Max width** | `max-w-[85%]` |
| **Shadow** | `shadow-sm` |
| **Entrance** | Slide up 8px + fade in, 200ms, staggered 50ms from previous |

#### AI Message Bubble

| Property | Value |
|----------|-------|
| **Alignment** | Left-aligned (`mr-12` max offset from right) |
| **Avatar** | 28×28px circle to the left, containing a gradient bot icon or `Sparkles` icon. `bg-gradient-to-br from-primary-500 to-primary-700` with white icon (14px). |
| **Background** | `hsl(var(--assistant-ai-bubble))` |
| **Text color** | `hsl(var(--assistant-ai-text))` |
| **Border radius** | `rounded-2xl rounded-bl-md` |
| **Padding** | `px-3.5 py-2.5` |
| **Max width** | `max-w-[88%]` (wider than user to accommodate tool results/tables) |
| **Shadow** | none — keeps AI responses feeling lighter/softer than user bubbles |
| **Entrance** | Slide up 8px + fade in, 200ms |

#### Markdown Rendering in AI Responses

AI responses must render rich Markdown. Use `react-markdown` (or equivalent lightweight renderer) with these styled elements:

| Markdown element | Style |
|-----------------|-------|
| **Bold** | `font-semibold` |
| *Italic* | `italic` |
| `inline code` | `bg-muted/60 px-1.5 py-0.5 rounded text-xs font-mono` |
| Code block | `bg-muted rounded-lg p-3 text-xs font-mono overflow-x-auto` with language label |
| Table | `text-xs` with `border-collapse`, alternating row tint, `rounded-lg overflow-hidden` |
| List | `pl-4`, bullets use `•` with `text-primary` color |
| Heading (h3/h4) | `font-semibold text-sm mt-2 mb-1` |
| Link | `text-primary underline underline-offset-2 hover:text-primary-700` |

### 4.4 Tool Execution Card (Inline)

When the AI calls an RPC tool, show an inline card within the AI message flow:

| State | Visual |
|-------|--------|
| **Executing** | Compact card: `bg-[hsl(var(--assistant-tool-bg))]` with `border border-[hsl(var(--assistant-tool-border))]`. Shows `Loader2` spinner (16px, animate-spin) + tool label (e.g., "Đang tra cứu thiết bị..."). Shimmer gradient overlay on the card. |
| **Completed** | Spinner replaced with `CheckCircle2` icon (16px, `text-[hsl(var(--assistant-status-online))]`). Label becomes "Đã tra cứu: [tên tool]". Collapsible chevron to expand/collapse raw result summary. |
| **Error** | `AlertCircle` icon (16px, `text-destructive`). "Không thể tra cứu: [tên tool]". Red-tinted border. |

| Property | Value |
|----------|-------|
| **Border radius** | `rounded-lg` |
| **Padding** | `px-3 py-2` |
| **Font** | `text-xs font-medium` for label |
| **Width** | Full width of message bubble |
| **Entrance** | Fade in + slide down 4px, 200ms |
| **Collapse** | Animated height with `200ms ease-out` |

### 4.5 Draft Output Card

When the AI generates a draft (e.g., repair request), render it as a special "draft card" distinct from regular messages:

| Property | Value |
|----------|-------|
| **Border** | `border-2 border-dashed border-secondary-600` (orange dashed = draft signal) |
| **Background** | `hsl(var(--secondary-50))` (warm tint) |
| **Header** | "📝 Bản nháp yêu cầu sửa chữa" — `text-xs font-semibold text-secondary-foreground` |
| **Fields** | Rendered as a structured mini-form: label-value pairs, `text-xs` |
| **Badge** | "BẢN NHÁP" pill badge: `bg-secondary text-secondary-foreground text-[10px] font-bold uppercase px-2 py-0.5 rounded-full` |
| **Actions** | No submit button (V1 is read-only). Future: "Tạo yêu cầu" button |
| **Disclaimer** | "Bản nháp này chưa được gửi. Vui lòng kiểm tra trước khi tạo yêu cầu." `text-[11px] text-muted-foreground italic` |

### 4.6 AssistantSuggestedQuestions

| Property | Value |
|----------|-------|
| **Visibility** | Only when message list is empty (first interaction or after reset) |
| **Position** | Vertically centered in the message area, or above the composer if panel is compact |
| **Layout** | Vertical stack with `gap-2` |
| **Chip style** | `border border-[hsl(var(--assistant-chip-border))] bg-[hsl(var(--assistant-chip-bg))] rounded-xl px-3.5 py-2.5` |
| **Chip hover** | `bg-[hsl(var(--assistant-chip-hover-bg))] border-[hsl(var(--assistant-chip-hover-border))]`, 150ms transition |
| **Chip text** | `text-xs font-medium text-[hsl(var(--assistant-chip-text))]` |
| **Chip icon** | Left-aligned `Zap` icon (14px), `text-primary` |
| **Disabled state** | `opacity-50 cursor-not-allowed` when chat status ≠ `ready` |
| **Click behavior** | Immediately submits as user message (not just prefill). Suggestion list hides on first user message. |
| **Entrance** | Staggered fade-in, 100ms between each chip, 300ms total |

**Default prompts (3):**

1. ⚡ *Thiết bị nào sắp đến hạn bảo trì trong 30 ngày tới?*
2. ⚡ *Có bao nhiêu yêu cầu sửa chữa đang chờ xử lý tại cơ sở hiện tại?*
3. ⚡ *Tóm tắt các thiết bị đang cần ưu tiên xử lý hôm nay.*

### 4.7 AssistantComposer

| Property | Value |
|----------|-------|
| **Position** | Pinned to bottom of panel, above disclaimer |
| **Border** | `border-t border-[hsl(var(--assistant-border))]` |
| **Padding** | `px-3 py-2.5` |
| **Input** | Auto-resizing `<textarea>`, min 1 row, max 5 rows then scroll. Borderless inside, focus ring on outer container: `focus-within:ring-2 focus-within:ring-primary/40 rounded-xl` |
| **Placeholder** | *"Hỏi AI về thiết bị, bảo trì..."* — `text-muted-foreground` |
| **Send button** | Inside input container, right-aligned. `ArrowUp` icon in a circle (`h-7 w-7 rounded-full bg-primary text-primary-foreground`). Only visible when input has content. |
| **Stop button** | While streaming: replace send icon with `Square` icon (filled, 12px) in same styled circle but `bg-destructive`. Click aborts generation. |
| **Send transition** | `scale(0) → scale(1)` spring animation when text appears, 200ms |
| **Disabled state** | Input and button are `disabled` when status ≠ `ready` and not streaming |
| **Submit** | Enter to send, Shift+Enter for newline |

### 4.8 Disclaimer Footer

| Property | Value |
|----------|-------|
| **Text** | "AI có thể cung cấp thông tin chưa chính xác. Vui lòng kiểm tra lại." |
| **Style** | `text-[11px] text-muted-foreground text-center py-1.5 px-4` |
| **Position** | Below composer, pinned to bottom of panel |

---

## 5. Thinking / Loading States

### 5.1 AI Thinking Indicator

When waiting for the first token from the AI:

```
┌──────────────────────────────────┐
│ [Avatar]  ● ● ●                  │  ← Three dots with staggered bounce
│           ──────── [shimmer]     │  ← OR: branded shimmer skeleton
└──────────────────────────────────┘
```

**Option A — Bouncing dots (recommended):**
- 3 circles, 6px, `bg-muted-foreground/50`
- Staggered `translateY(-4px)` bounce, 100ms delay between each
- Total cycle: 800ms, infinite loop
- Contained in a pill-shaped bubble matching AI message style

**Option B — Shimmer skeleton:**
- 2-3 skeleton lines in AI bubble shape
- Gradient sweep left-to-right: `var(--assistant-shimmer-from) → var(--assistant-shimmer-via) → var(--assistant-shimmer-to)`
- Sweep duration: 1.5s, infinite

### 5.2 Streaming State

While tokens are arriving:
- Words appear with a subtle per-word fade-in (`opacity: 0 → 1`, 80ms)
- Blinking cursor at the end of the stream: `|` with `animate-pulse`
- Composer shows "Stop" button instead of "Send"

### 5.3 Tool Execution State

While an RPC tool is executing (between AI chunks):
- Inline tool card appears (§4.4 above)
- Panel top-bar shows a thin progress bar: `h-[2px] bg-primary animate-[progress-indeterminate_1.5s_ease-in-out_infinite]`
- After tool completes, the tool card collapses to summary and the AI continues streaming

---

## 6. Motion & Animation

### 6.1 Keyframe Definitions

```css
/* Panel open/close */
@keyframes assistant-panel-open {
  from {
    opacity: 0;
    transform: translateY(16px) scale(0.97);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes assistant-panel-close {
  from {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  to {
    opacity: 0;
    transform: translateY(16px) scale(0.97);
  }
}

/* Message entrance */
@keyframes assistant-message-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Thinking dots bounce */
@keyframes assistant-dot-bounce {
  0%, 80%, 100% { transform: translateY(0); }
  40% { transform: translateY(-4px); }
}

/* Shimmer sweep */
@keyframes assistant-shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

/* Indeterminate progress bar */
@keyframes assistant-progress {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(300%); }
}

/* Chip stagger entrance */
@keyframes assistant-chip-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

### 6.2 Animation Timing

| Animation | Duration | Easing | Delay |
|-----------|----------|--------|-------|
| Panel open | 250ms | `cubic-bezier(0.16, 1, 0.3, 1)` | 0 |
| Panel close | 180ms | `ease-in` | 0 |
| Message entrance | 200ms | `ease-out` | 0 |
| Thinking dots | 800ms/cycle | `ease-in-out` | 0, 100ms, 200ms (staggered) |
| Shimmer sweep | 1.5s/cycle | `ease-in-out` | 0 |
| Chip entrance | 200ms | `ease-out` | 0, 80ms, 160ms (staggered) |
| Send button appear | 200ms | spring | 0 |
| Tool card expand/collapse | 200ms | `ease-out` | 0 |

---

## 7. Responsive Behavior

### 7.1 Breakpoints

| Breakpoint | Panel behavior |
|------------|---------------|
| **Desktop (≥ 768px)** | Floating popover: `420×680px` (max), anchored above FAB |
| **Mobile (< 768px)** | Full-screen bottom sheet from `bottom: 0` to almost full height. Drag handle at top for dismiss. `rounded-t-2xl`. FAB hidden while panel is open. |

### 7.2 Mobile-Specific Adaptations

- **Safe area insets**: Panel respects `env(safe-area-inset-bottom)` for iOS notch/home indicator
- **Header**: Status text hidden, only status dot + title + close button
- **Composer**: Input gets `font-size: 16px` to prevent iOS zoom on focus
- **Keyboard open**: Panel resizes automatically via `visualViewport` API to keep composer visible
- **Suggested chips**: Horizontal scroll on small screens (flex-row + overflow-x-auto)
- **Drag dismiss**: Top `8px × 40px` handle bar, swipe down > 100px = dismiss

---

## 8. Accessibility

| Feature | Implementation |
|---------|---------------|
| **Focus management** | Focus trapped inside panel when open. First focusable = composer input. Shift+Tab cycles to header actions. |
| **Keyboard shortcuts** | `Escape` = close panel. `Ctrl+Shift+A` = toggle panel (optional). `Enter` = send, `Shift+Enter` = newline. |
| **ARIA roles** | Panel: `role="dialog" aria-label="Trợ lý AI"`. Message list: `role="log" aria-live="polite"`. |
| **Screen reader** | Tool execution cards announce status change. Draft cards announced with "Bản nháp" prefix. |
| **Reduced motion** | `@media (prefers-reduced-motion: reduce)` — disable all entrance/shimmer animations, use instant opacity change instead |
| **Color contrast** | All text meets WCAG 2.1 AA (4.5:1 minimum). Tested in both light and dark mode. |
| **Touch targets** | All interactive elements ≥ 44×44px (uses existing `.touch-target` utility) |

---

## 9. Z-Index Layering Integration

Per the project's [layering contract](file:///e:/qltbyt-nam-phong/docs/frontend/layering.md):

| Element | z-index | Rationale |
|---------|---------|-----------|
| FAB trigger | `z-70` (existing `.fab-above-footer`) | Above mobile footer nav |
| Assistant panel | `z-[998]` | Below Dialog (z-999) so in-app dialogs work above chat |
| Mobile sheet backdrop | `z-[997]` | Behind panel |
| "Scroll to bottom" mini-FAB | Relative within panel (no global z) | Only needs to float above message list |

> **Rule**: The assistant panel must NEVER be above `Dialog`, `Sheet`, `AlertDialog`, or `Tooltip` tiers. Users must be able to dismiss confirmations and interact with dropdowns while chat is open.

---

## 10. Empty State & Onboarding

When the panel opens for the first time (no messages):

```
┌─────────────────────────────────────┐
│  Trợ lý ảo CVMEMS    ● Sẵn sàng  X │
├─────────────────────────────────────┤
│                                     │
│         [Sparkles icon, 48px]       │
│       "Xin chào! Tôi có thể        │
│    giúp gì cho bạn hôm nay?"       │
│          text-sm, muted             │
│                                     │
│  ⚡ Thiết bị sắp đến hạn bảo trì?  │
│  ⚡ Yêu cầu sửa chữa đang chờ?    │
│  ⚡ Thiết bị cần ưu tiên hôm nay?  │
│                                     │
├─────────────────────────────────────┤
│  [  Hỏi AI về thiết bị, bảo trì…  ]│
├─────────────────────────────────────┤
│  AI có thể chưa chính xác. Kiểm    │
│  tra lại.                           │
└─────────────────────────────────────┘
```

---

## 11. Error & Retry States

| Scenario | UI Behavior |
|----------|-------------|
| **Stream error** | Red-tinted AI message with `AlertCircle` icon. Text: "Đã xảy ra lỗi. Vui lòng thử lại." + "Thử lại" button (outline style, `text-destructive`). |
| **Rate limited (429)** | Yellow-tinted message with `Clock` icon. Text: "Bạn đã gửi quá nhiều yêu cầu. Vui lòng chờ giây lát." Composer disabled with timer countdown text. |
| **Network disconnect** | Status dot turns red. Header status: "Mất kết nối". Composer disabled. Auto-retry on reconnect. |
| **No facility selected** | Orange-tinted guidance message: "Vui lòng chọn cơ sở trước khi sử dụng công cụ tra cứu." with link/button to facility selector. |

---

## 12. File Manifest

Components to create (all in `src/components/assistant/`):

| File | Purpose |
|------|---------|
| `AssistantTriggerButton.tsx` | FAB that toggles panel visibility |
| `AssistantPanel.tsx` | Main container (header, body, composer, disclaimer) |
| `AssistantMessageList.tsx` | Scrollable message log with auto-scroll |
| `AssistantMessageBubble.tsx` | Individual message renderer (user/AI variants) |
| `AssistantMarkdownRenderer.tsx` | Rich markdown display for AI responses |
| `AssistantToolExecutionCard.tsx` | Inline tool status card |
| `AssistantDraftCard.tsx` | Draft output card (repair request etc.) |
| `AssistantSuggestedQuestions.tsx` | Quick-ask chips for empty state |
| `AssistantComposer.tsx` | Text input + send/stop button |
| `AssistantThinkingIndicator.tsx` | Bouncing dots / shimmer while waiting |
| `AssistantEmptyState.tsx` | Welcome message + suggestions layout |
| `assistant-styles.css` | CSS variables, keyframes, utilities for assistant |
