import Link from 'next/link'
import { motion } from 'framer-motion'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#F0F4FF] flex items-center justify-center px-4">
      <div className="bg-white rounded-[24px] shadow-[0_8px_32px_rgba(0,0,0,0.08)] border border-slate-100 p-10 max-w-md w-full text-center">
        <p className="text-6xl font-bold text-slate-100 mb-2">404</p>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Page not found</h2>
        <p className="text-sm text-slate-500 mb-8 leading-relaxed">
          The page you&apos;re looking for doesn&apos;t exist.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-xl transition-colors"
        >
          Back to Chromium
        </Link>
      </div>
    </div>
  )
}
