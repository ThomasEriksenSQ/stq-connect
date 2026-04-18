import { Component, type ReactNode } from "react";

interface RenderErrorBoundaryProps {
  children: ReactNode;
  resetKey?: string | number | null;
  fallbackMessage?: string;
}

interface RenderErrorBoundaryState {
  hasError: boolean;
}

export class RenderErrorBoundary extends Component<RenderErrorBoundaryProps, RenderErrorBoundaryState> {
  state: RenderErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("RenderErrorBoundary:", error);
  }

  componentDidUpdate(prevProps: RenderErrorBoundaryProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-card border border-border rounded-xl p-5 text-center">
          <p className="text-muted-foreground text-sm">
            {this.props.fallbackMessage || "Kunne ikke laste denne seksjonen."}
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="text-primary text-sm mt-2 hover:underline"
          >
            Prøv igjen
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
