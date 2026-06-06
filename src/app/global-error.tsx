'use client'

import { useEffect } from 'react'

// global-error replaces the root layout — must include <html> and <body>
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[global-error]', error)
  }, [error])

  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#F0F4FF', fontFamily: 'system-ui, sans-serif' }}>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '24px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
              border: '1px solid #f1f5f9',
              padding: '2.5rem',
              maxWidth: '400px',
              width: '100%',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⚠️</div>
            <h2 style={{ color: '#1e293b', marginBottom: '0.5rem', fontSize: '1.25rem' }}>
              Critical error
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
              The application encountered a critical error. Please reload the page.
            </p>
            {error.digest && (
              <p style={{ color: '#cbd5e1', fontSize: '0.625rem', fontFamily: 'monospace', marginBottom: '1rem' }}>
                {error.digest}
              </p>
            )}
            <button
              onClick={reset}
              style={{
                background: '#3b82f6',
                color: '#fff',
                border: 'none',
                borderRadius: '12px',
                padding: '0.625rem 1.5rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Reload
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
