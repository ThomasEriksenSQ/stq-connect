import { Component, type ReactNode } from "react";

const SHOW_RENDER_ERROR_DETAILS = import.meta.env.DEV;

interface RenderErrorBoundaryProps {
  children: ReactNode;
  resetKey?: string | number | null;
  fallbackMessage?: string;
}

interface RenderErrorBoundaryState {
  hasError: boolean;
  errorMessage?: string | null;
}

export class RenderErrorBoundary extends Component<RenderErrorBoundaryProps, RenderErrorBoundaryState> {
  state: RenderErrorBoundaryState = { hasError: false, errorMessage: null };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("RenderErrorBoundary:", error);
    this.setState({ errorMessage: error?.message || "Ukjent render-feil" });
  }

  componentDidUpdate(prevProps: RenderErrorBoundaryProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, errorMessage: null });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-card border border-border rounded-xl p-5 text-center">
          <p className="text-muted-foreground text-sm">
            {this.props.fallbackMessage || "Kunne ikke laste denne seksjonen."}
          </p>
          {SHOW_RENDER_ERROR_DETAILS && this.state.errorMessage ? (
            <p className="text-[12px] text-destructive mt-2 break-words">
              {this.state.errorMessage}
            </p>
          ) : null}
          <button
            onClick={() => this.setState({ hasError: false, errorMessage: null })}
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
