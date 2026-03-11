import { Component, ReactNode } from "react";

interface Props { children: ReactNode; }
interface State { hasError: boolean; }

export class DashboardErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error) { console.error("DashboardErrorBoundary:", error); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-card border border-border rounded-xl p-5 text-center">
          <p className="text-muted-foreground text-sm">Kunne ikke laste denne seksjonen.</p>
          <button onClick={() => this.setState({ hasError: false })} className="text-primary text-sm mt-2 hover:underline">Prøv igjen</button>
        </div>
      );
    }
    return this.props.children;
  }
}
