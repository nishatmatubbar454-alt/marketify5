import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in component:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center p-6 text-center">
          <div className="rounded-2xl bg-white p-6 shadow-xl ring-1 ring-black/10 dark:bg-panel dark:ring-white/10 max-w-md w-full">
            <h2 className="text-lg font-bold text-[#0f0f0f] dark:text-white">কিছু একটা সমস্যা হয়েছে</h2>
            <p className="mt-2 text-sm text-[#606060] dark:text-white/70">
              পেজটি রিলোড করে আবার চেষ্টা করুন।
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-[#0f0f0f] shadow transition-all active:scale-95"
            >
              পেজ রিলোড করুন
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
