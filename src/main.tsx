import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

type CrashNotice = {
  title: string;
  message: string;
  details?: string;
  timestamp: string;
};

type CrashGuardState = {
  fatalError: CrashNotice | null;
  notice: CrashNotice | null;
};

class GlobalCrashGuard extends React.Component<{ children: React.ReactNode }, CrashGuardState> {
  state: CrashGuardState = { fatalError: null, notice: null };

  static getDerivedStateFromError(error: Error): Partial<CrashGuardState> {
    return {
      fatalError: {
        title: 'Aplikasi mengalami crash',
        message: error?.message || 'Terjadi kesalahan saat merender aplikasi.',
        details: error?.stack,
        timestamp: new Date().toLocaleString(),
      },
    };
  }

  componentDidMount() {
    window.addEventListener('error', this.handleWindowError);
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  componentWillUnmount() {
    window.removeEventListener('error', this.handleWindowError);
    window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[Global application crash]', error, info.componentStack);
    this.setState((state) => ({
      fatalError: state.fatalError
        ? { ...state.fatalError, details: [state.fatalError.details, info.componentStack].filter(Boolean).join('\n\nComponent stack:\n') }
        : null,
    }));
  }

  handleWindowError = (event: ErrorEvent) => {
    if (!event.error && !event.message) return;
    const error = event.error;
    const notice: CrashNotice = {
      title: 'Runtime error terdeteksi',
      message: error?.message || event.message || 'Terjadi JavaScript runtime error.',
      details: error?.stack || [event.filename, event.lineno ? `Line: ${event.lineno}` : ''].filter(Boolean).join('\n'),
      timestamp: new Date().toLocaleString(),
    };
    console.error('[Global runtime error]', event.error || event.message, notice.details);
    this.setState({ notice });
  };

  handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const message = reason instanceof Error ? reason.message : String(reason ?? 'Promise rejection tanpa detail.');
    const notice: CrashNotice = {
      title: 'Background operation gagal',
      message,
      details: reason instanceof Error ? reason.stack : undefined,
      timestamp: new Date().toLocaleString(),
    };
    console.error('[Unhandled promise rejection]', reason);
    this.setState({ notice });
  };

  renderNotice(notice: CrashNotice, fatal = false) {
    return (
      <div className={fatal
        ? 'min-h-screen bg-[#080b12] p-5 text-white'
        : 'fixed right-4 top-4 z-[99999] w-[min(560px,calc(100vw-2rem))] rounded-xl border border-red-500/70 bg-[#190d12] p-4 text-white shadow-2xl'}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-red-400">Sabung Idol Arena · Crash Monitor</p>
            <h2 className="mt-1 text-lg font-black">{notice.title}</h2>
            <p className="mt-2 break-words text-sm text-red-100">{notice.message}</p>
            <p className="mt-2 text-[11px] text-slate-400">Waktu: {notice.timestamp}</p>
          </div>
          {!fatal && <button type="button" onClick={() => this.setState({ notice: null })} className="rounded-lg border border-red-400/30 px-3 py-1.5 text-xs font-bold text-red-100 hover:bg-red-400/10">Tutup</button>}
        </div>
        {notice.details && <details className="mt-3">
          <summary className="cursor-pointer text-xs font-bold text-red-300">Detail teknis</summary>
          <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/40 p-3 text-[11px] text-slate-300">{notice.details}</pre>
        </details>}
        {fatal && <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" onClick={() => window.location.reload()} className="rounded-lg bg-red-500 px-4 py-2 text-sm font-black text-white hover:bg-red-400">Muat ulang aplikasi</button>
          <button type="button" onClick={() => { void navigator.clipboard?.writeText([notice.title, notice.message, notice.details || ''].join('\n\n')); }} className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-bold text-slate-200 hover:bg-slate-800">Salin error</button>
        </div>}
      </div>
    );
  }

  render() {
    if (this.state.fatalError) return this.renderNotice(this.state.fatalError, true);
    return <>
      {this.props.children}
      {this.state.notice && this.renderNotice(this.state.notice)}
    </>;
  }
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <GlobalCrashGuard>
      <App />
    </GlobalCrashGuard>
  </React.StrictMode>,
);
