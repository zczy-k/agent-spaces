declare module 'react-virtualized' {
  import type { ComponentType, CSSProperties, ReactNode } from 'react';

  export interface AutoSizerProps {
    children: (size: { height: number; width: number }) => ReactNode;
  }

  export const AutoSizer: ComponentType<AutoSizerProps>;

  export interface ListRowProps {
    index: number;
    key: string;
    parent: unknown;
    style: CSSProperties;
  }

  export interface ListProps {
    ref?: unknown;
    height: number;
    width: number;
    rowCount: number;
    rowHeight: number | ((params: { index: number }) => number);
    rowRenderer: (props: ListRowProps) => ReactNode;
    overscanRowCount?: number;
  }

  export const List: ComponentType<ListProps>;

  export interface ListInstance {
    scrollToRow(index: number): void;
    recomputeRowHeights(index?: number): void;
  }

}
