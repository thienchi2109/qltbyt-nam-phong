declare module 'react-virtualized-auto-sizer' {
  import { ReactNode } from 'react'

  export interface Size {
    height: number
    width: number
  }

  export interface AutoSizerProps {
    children: (size: Size) => ReactNode
    className?: string
    defaultHeight?: number
    defaultWidth?: number
    disableHeight?: boolean
    disableWidth?: boolean
    nonce?: string
    onResize?: (size: Size) => void
    style?: React.CSSProperties
  }

  export default function AutoSizer(props: AutoSizerProps): JSX.Element
}
