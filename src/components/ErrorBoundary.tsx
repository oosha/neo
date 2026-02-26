'use client'

import React from 'react'

interface State { error: Error | null }

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          margin: '32px 0', padding: '20px 24px',
          background: '#1a1010', border: '1px solid #5a1a1a',
          borderRadius: 8, color: '#f87171', fontFamily: 'monospace', fontSize: 13,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>⚠ Tab failed to render</div>
          <div style={{ color: '#fca5a5', marginBottom: 4 }}>{this.state.error.message}</div>
          <pre style={{ fontSize: 11, color: '#f87a7a', margin: 0, overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
            {this.state.error.stack?.split('\n').slice(0, 8).join('\n')}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}
