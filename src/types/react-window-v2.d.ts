/**
 * Type declarations for react-window v2.2.0
 * 
 * The package ships with its own .d.ts file, but @types/react-window@1.8.8
 * has conflicting v1 types. This file provides correct types for the v2 API.
 */

declare module "react-window" {
  import type { ComponentType, CSSProperties, HTMLAttributes, ReactElement, ReactNode } from "react";

  // Row component props for List
  export interface RowComponentProps<RowProps extends object = object> {
    index: number;
    style: CSSProperties;
    rowProps: RowProps;
  }

  // Cell component props for Grid  
  export interface CellComponentProps<CellProps extends object = object> {
    rowIndex: number;
    columnIndex: number;
    style: CSSProperties;
    cellProps: CellProps;
  }

  // List imperative API (ref methods)
  export interface ListImperativeAPI {
    scrollTo(offset: number): void;
    scrollToRow(index: number, align?: "auto" | "center" | "end" | "smart" | "start"): void;
  }

  // Grid imperative API (ref methods)
  export interface GridImperativeAPI {
    scrollTo(offset: { scrollLeft: number; scrollTop: number }): void;
    scrollToCell(params: {
      rowIndex: number;
      columnIndex: number;
      align?: "auto" | "center" | "end" | "smart" | "start";
    }): void;
  }

  type TagNames = "div" | "span" | "section" | "article" | "main" | "aside" | "header" | "footer" | "nav";

  // List component props
  export interface ListProps<RowProps extends object, TagName extends TagNames = "div">
    extends Omit<HTMLAttributes<HTMLDivElement>, "onResize"> {
    children?: ReactNode;
    className?: string;
    defaultHeight?: number;
    listRef?: React.MutableRefObject<ListImperativeAPI | null>;
    onResize?: (size: { height: number; width: number }) => void;
    onRowsRendered?: (info: { startIndex: number; stopIndex: number }) => void;
    overscanCount?: number;
    rowComponent: ComponentType<RowComponentProps<RowProps>>;
    rowCount: number;
    rowHeight: number | ((index: number) => number);
    rowProps?: RowProps;
    tagName?: TagName;
    style?: CSSProperties;
  }

  // Grid component props
  export interface GridProps<CellProps extends object, TagName extends TagNames = "div">
    extends Omit<HTMLAttributes<HTMLDivElement>, "onResize"> {
    cellComponent: ComponentType<CellComponentProps<CellProps>>;
    cellProps?: CellProps;
    children?: ReactNode;
    className?: string;
    columnCount: number;
    columnWidth: number | ((index: number) => number);
    defaultHeight?: number;
    defaultWidth?: number;
    dir?: "ltr" | "rtl";
    gridRef?: React.MutableRefObject<GridImperativeAPI | null>;
    onCellsRendered?: (info: {
      startRowIndex: number;
      stopRowIndex: number;
      startColumnIndex: number;
      stopColumnIndex: number;
    }) => void;
    onResize?: (size: { height: number; width: number }) => void;
    overscanCount?: number;
    rowCount: number;
    rowHeight: number | ((index: number) => number);
    style?: CSSProperties;
    tagName?: TagName;
  }

  // List component
  export function List<RowProps extends object = object, TagName extends TagNames = "div">(
    props: ListProps<RowProps, TagName>
  ): ReactElement;

  // Grid component
  export function Grid<CellProps extends object = object, TagName extends TagNames = "div">(
    props: GridProps<CellProps, TagName>
  ): ReactElement;

  // Dynamic row height hook
  export function useDynamicRowHeight(options: {
    defaultRowHeight: number;
    key: string;
  }): {
    rowHeight: (index: number) => number;
    setRowHeight: (index: number, height: number) => void;
    clearCache: () => void;
  };

  // Ref hooks for TypeScript convenience
  export function useListRef(): React.MutableRefObject<ListImperativeAPI | null>;
  export function useGridRef(): React.MutableRefObject<GridImperativeAPI | null>;

  // Utility functions
  export function getScrollbarSize(recalculate?: boolean): number;
}
