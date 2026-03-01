# Vercel AI SDK Integration - Phase 4: Chat UI Design & Layout Plan

## 1. Core Design Philosophy
To provide a modern, engaging, and professional user experience, the AI assistant UI will adopt a **"Copilot"** design pattern. It must feel like an organic extension of the application—responsive, context-aware, and unobtrusive.

- **Modern & Professional:** Clean lines, ample whitespace, and nuanced typography.
- **Seamless & Embedded:** Easy to access without breaking the user's current workflow.
- **Trust & Transparency:** Clear indicators when the AI is "thinking," fetching data, or generating drafts.

## 2. Global Layout & Integrations

### 2.1 AssistantTriggerButton
- **Positioning:** Fixed floating action button (FAB) in the bottom-right corner of the application viewport. Ensures global accessibility across all protected routes.
- **Styling:** 
  - Circular button with a soft drop shadow (`shadow-lg`).
  - Primary brand color background with a modern AI icon (e.g., Sparkles ✨ or an abstract bot icon).
- **Interactions:**
  - **Hover:** Slight scale-up (`hover:scale-105`) with a tooltip ("Trợ lý AI").
  - **Active State:** When the panel is open, the icon transitions to a "Close" (X) icon or a chevron down.
  - **Badge:** A small red dot or subtle pulse if there's an unread suggestion or system notification (optional future enhancement).

### 2.2 AssistantPanel (The Chat Interface)
- **Positioning:** A floating popover anchored above the trigger button, or a right-side sliding drawer. For a modern SaaS feel, a floating popover (e.g., `w-[400px] h-[650px]`) is recommended.
- **Container Styling:**
  - High elevation shadow (`shadow-2xl`).
  - Rounded corners (`rounded-2xl`).
  - Glassmorphic backdrop or solid clean white (`bg-white dark:bg-slate-900`) with subtle borders (`border-slate-200 dark:border-slate-800`).
- **Header Section:**
  - **Title:** "Trợ lý ảo CVMEMS" (font-semibold, text-sm).
  - **Status:** A subtle green dot indicating "Online / Sẵn sàng".
  - **Controls:** Reset/Clear chat icon button (trash or refresh), and a Close button.

## 3. Conversational UX

### 3.1 AssistantMessageList
- **User Messages:**
  - Aligned right.
  - Bubble: Solid primary color (`bg-blue-600`) with white text.
  - Border radius: Fully rounded except for the bottom-right corner (`rounded-2xl rounded-br-sm`).
- **AI Messages:**
  - Aligned left.
  - Bubble: Soft gray or secondary tint (`bg-slate-100 dark:bg-slate-800`) with high-contrast text.
  - Border radius: Fully rounded except for the bottom-left corner (`rounded-2xl rounded-bl-sm`).
  - **Avatar:** A 24x24px stylized AI avatar placed to the left of the AI bubble to establish persona.
- **Tool Execution States (Invisible to UI, but visually apparent):**
  - While fetching RPC data, display an inline loading skeleton or a subtle text indicator: *"Đang tra cứu hệ thống..."* with a pulsing animation to build trust and show progress without exposing raw JSON.

### 3.2 AssistantSuggestedQuestions
- **Visibility:** Rendered only when the conversation history is empty (on empty state).
- **Layout:** Vertical stack or a flex-wrap container immediately above the composer frame.
- **Styling:**
  - Pill-shaped chips (`rounded-full`).
  - Outline style (`border border-slate-200 hover:border-blue-500 hover:bg-blue-50 dark:border-slate-700`).
  - Left-aligned text, possibly prefixed with a lightweight icon (e.g., a search magnifying glass or a lightning bolt).
- **Interaction:**
  - Clicking a chip immediately submits the query as a user message and hides the suggestion list.
  - Disabled and slightly washed out if the assistant is not in a `ready` state.
- **Default Prompts:**
  1. *Thiết bị nào sắp đến hạn bảo trì trong 30 ngày tới?*
  2. *Có bao nhiêu yêu cầu sửa chữa đang chờ xử lý tại cơ sở hiện tại?*
  3. *Tóm tắt các thiết bị đang cần ưu tiên xử lý hôm nay.*

## 4. Input & Control

### 4.1 AssistantComposer
- **Layout:** Pinned to the bottom of the `AssistantPanel`. Separated from the message list by a subtle top border (`border-t`).
- **Input Area:**
  - Auto-resizing textarea (grows up to 4-5 lines, then scrolls).
  - Placeholder: *"Hỏi AI về thiết bị, bảo trì..."*.
  - Styling: Borderless inner feel, but the outer container has a focus ring (`focus-within:ring-2 focus-within:ring-blue-500`) to highlight active typing.
- **Send Button:**
  - Inside the input container, aligned to the right.
  - Changes state: A solid "Send" arrow when text is present. 
  - Becomes a "Stop" (square) icon while the AI is streaming a response, allowing the user to abort the generation.
- **Trust / Disclaimer Footer:**
  - A micro-copy footer below the composer: *"AI có thể cung cấp thông tin chưa chính xác. Vui lòng kiểm tra lại."* (text-xs, text-slate-500).

## 5. Motion & Micro-interactions
Modern UIs rely on motion to feel fluid and responsive:
- **Panel Visibility:** `slide-in-from-bottom-5 fade-in duration-200 ease-out` when opening.
- **New Messages:** Slide up and fade in individually to draw the eye naturally.
- **Typing Indicator:** Instead of a static "Đang trả lời...", use a 3-dot bouncing animation or a smooth pulsing shimmer effect on a skeleton block while waiting for the first chunk of the stream.

## 6. Development Integration Notes
- Ensure all custom tailwind classes utilize the existing `tailwind.config.ts` design tokens (colors, radii, shadows).
- Use `lucide-react` (or the project's default icon library) for cohesive iconography.
- Maintain responsive behavior: on mobile screens (`< 768px`), the `AssistantPanel` should detach from the FAB and become a full-screen bottom sheet or modal to maximize typing space.
