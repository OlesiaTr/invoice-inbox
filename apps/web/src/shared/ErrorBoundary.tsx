import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface State {
  error: Error | null;
}

/**
 * Without this, one thrown render unmounts the whole tree and leaves a blank page with
 * nothing but a console message. Offers a reload, which is enough for a UI whose state
 * all lives in the URL and the server.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Reporting the error is this component's job; there is nowhere else for it to go.
    // eslint-disable-next-line no-console
    console.error('Unhandled render error', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <div>
          <h1 className="text-xl font-semibold text-dark dark:text-white">Something went wrong</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The page hit an unexpected error. Reloading usually fixes it.
          </p>
        </div>
        <pre className="max-w-xl overflow-auto rounded-lg bg-muted p-3 text-left text-xs">{error.message}</pre>
        <Button onClick={() => window.location.reload()}>Reload</Button>
      </div>
    );
  }
}
