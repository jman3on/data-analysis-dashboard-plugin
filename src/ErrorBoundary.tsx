import React from 'react';

interface ErrorBoundaryState {
  message?: string;
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = {};

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { message: error.message };
  }

  componentDidCatch(error: Error) {
    console.error(error);
  }

  render() {
    if (this.state.message) {
      return (
        <main className="dashboard-shell">
          <section className="summary-panel">
            <div className="summary-content">
              <article className="markdown-text">
                <h2>插件加载失败</h2>
                <p>{this.state.message}</p>
                <p>请刷新页面，或把这个错误信息发给开发者排查。</p>
              </article>
            </div>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
