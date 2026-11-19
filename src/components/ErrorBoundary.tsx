import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {hasError: false, message: ''};
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error?.message || 'An unexpected error occurred.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Krishi Mitra ErrorBoundary:', error, info);
  }

  render() {
    if (this.state.hasError) {
      let friendly = 'Something went wrong while loading this section.';
      try {
        const parsed = JSON.parse(this.state.message);
        if (parsed?.operationType) {
          friendly = `Sync paused (${parsed.operationType} on ${parsed.path || 'cloud data'}). Your local farm data remains safe.`;
        }
      } catch {
        // Keep friendly fallback
      }

      return (
        <div className="min-h-screen bg-[#F7F8F4] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-[#E4E9E0] rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-[#202820]">Krishi Mitra recovered from an error</h2>
            <p className="mt-2 text-sm text-[#6B756A] leading-relaxed">{friendly}</p>
            <button
              type="button"
              onClick={() => {
                this.setState({hasError: false, message: ''});
                window.location.reload();
              }}
              className="mt-5 inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-[#245C3A] text-white text-sm font-medium hover:bg-[#1e4d30] transition-colors cursor-pointer"
            >
              Reload Krishi Mitra
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
