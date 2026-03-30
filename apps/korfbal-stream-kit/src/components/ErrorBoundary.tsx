import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from './ui/button';
import { MdErrorOutline, MdRefresh } from 'react-icons/md';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center bg-red-900/10 border border-red-500/20 rounded-lg m-4">
          <MdErrorOutline className="w-16 h-16 text-red-500 mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Oeps! Er is iets misgegaan.</h2>
          <p className="text-white/60 mb-6 max-w-md">
            Er is een onverwachte fout opgetreden in dit onderdeel van de applicatie.
            {this.state.error && (
              <span className="block mt-2 font-mono text-xs bg-black/40 p-2 rounded overflow-auto max-h-32 text-red-400">
                {this.state.error.message}
              </span>
            )}
          </p>
          <div className="flex gap-4">
            <Button
              onClick={() => window.location.reload()}
              className="bg-red-600 hover:bg-red-700 flex items-center gap-2"
            >
              <MdRefresh />
              Pagina herladen
            </Button>
            <Button
              onClick={() => this.setState({ hasError: false, error: null })}
              variant="outline"
              className="border-white/10 hover:bg-white/5"
            >
              Probeer opnieuw
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
