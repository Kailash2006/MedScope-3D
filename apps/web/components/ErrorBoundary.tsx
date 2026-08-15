"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback: ReactNode;
}

interface State {
  hasError: boolean;
}

// Reusable class error boundary. Used to isolate the 3D canvas so a WebGL/render
// crash degrades to the 2D body map instead of breaking the whole page.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    // eslint-disable-next-line no-console
    console.warn("[ErrorBoundary] caught", error);
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
