declare module "react-grid-layout" {
  import { Component, CSSProperties, ReactNode } from "react";

  export interface LayoutItem {
    i: string;
    x: number;
    y: number;
    w: number;
    h: number;
    minW?: number;
    minH?: number;
    maxW?: number;
    maxH?: number;
    static?: boolean;
  }

  export interface GridLayoutProps {
    layout: LayoutItem[];
    cols: number;
    rowHeight: number;
    width: number;
    isDraggable?: boolean;
    isResizable?: boolean;
    draggableHandle?: string;
    resizeHandles?: string[];
    compactType?: "vertical" | "horizontal" | null;
    margin?: [number, number];
    containerPadding?: [number, number];
    onLayoutChange?: (layout: LayoutItem[]) => void;
    onDragStop?: (layout: LayoutItem[]) => void;
    onResizeStop?: (layout: LayoutItem[]) => void;
    useCSSTransforms?: boolean;
    children?: ReactNode;
    className?: string;
    style?: CSSProperties;
  }

  export default class GridLayout extends Component<GridLayoutProps> {}
}

declare module "react-grid-layout/css/styles.css" {
  const content: string;
  export default content;
}
