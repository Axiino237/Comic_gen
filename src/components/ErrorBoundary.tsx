import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    const { hasError, error } = this.state;
    const { children } = this.props;

    if (hasError) {
      return (
        <div className="min-h-screen bg-[#F5F5F4] flex items-center justify-center p-6">
          <div className="max-w-xl w-full bg-white border-4 border-[#0A0A0A] rounded-[40px] p-12 shadow-2xl text-center space-y-8">
            <div className="w-24 h-24 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-12 h-12" />
            </div>
            <div className="space-y-4">
              <h1 className="text-4xl font-black uppercase tracking-tighter">System Error</h1>
              <p className="serif italic opacity-60 text-lg">
                Something went wrong while rendering the creative suite. Don't worry, your work is likely safe in the database.
              </p>
            </div>
            <div className="bg-red-50 p-4 rounded-2xl text-left overflow-hidden">
              <code className="text-[10px] font-mono text-red-800 break-all">
                {error?.message || 'Unknown Error'}
              </code>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-[#0A0A0A] text-white py-6 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-[#FF4E00] transition-colors flex items-center justify-center gap-4"
            >
              <RefreshCw className="w-5 h-5" />
              Reboot Application
            </button>
          </div>
        </div>
      );
    }

    return children;
  }
}
