'use client'

import { useEffect } from 'react'
import { motion } from 'framer-motion'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[app-error]', error)
  }, [error])

  return (
    <div className="min-h-screen bg-[#F0F4FF] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-white rounded-[24px] shadow-[0_8px_32px_rgba(0,0,0,0.08)] border border-slate-100 p-10 max-w-md w-full text-center"
      >
        <div className="size-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-5">
          <span className="text-2xl">⚠️</span>
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Something went wrong</h2>
        <p className="text-sm text-slate-500 mb-6 leading-relaxed">
          An unexpected error occurred. If the problem persists, the GenLayer
          network may be temporarily unavailable.
        </p>
        {error.digest && (
          <p className="text-[10px] text-slate-300 mb-4 font-mono">
            {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-xl transition-colors"
        >
          Try again
        </button>
      </motion.div>
    </div>
  )
}
