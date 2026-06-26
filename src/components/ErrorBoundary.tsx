import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : "Unexpected error",
    };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error("UI error boundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full flex flex-col items-center justify-center gap-3 p-8 text-center">
          <h2 className="text-lg font-semibold text-error">
            Something went wrong
          </h2>
          <p className="text-sm text-text-muted max-w-md">{this.state.message}</p>
          <button
            onClick={() => this.setState({ hasError: false, message: "" })}
            className="btn-primary mt-2"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
