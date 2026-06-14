'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  CloudSun,
  Map,
  Activity,
  Bell,
  Zap,
  Shield,
  Globe,
  Cpu,
  ExternalLink,
  Wallet,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { useWallet } from '@/hooks/useWallet'

const FEATURES = [
  {
    icon: CloudSun,
    title: 'AI Weather Analysis',
    desc: 'Onchain GO / CAUTION / AVOID decisions with confidence scores. Every query submits a real GenLayer transaction paid in GEN gas.',
    color: 'text-blue-500',
    bg: 'bg-blue-50 dark:bg-blue-950/40',
  },
  {
    icon: Map,
    title: 'Multi-Location Compare',
    desc: 'Rank up to 5 cities side-by-side for travel or activities. Powered by TravelComparisonContract on studionet.',
    color: 'text-violet-500',
    bg: 'bg-violet-50 dark:bg-violet-950/40',
  },
  {
    icon: Activity,
    title: 'Activity Risk Assessment',
    desc: 'Assess weather risk for hiking, surfing, cycling, and more. Find the best date across a 7-day window, one transaction per date.',
    color: 'text-emerald-500',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
  },
  {
    icon: Bell,
    title: 'Smart Alerts',
    desc: 'Blockchain-verified extreme weather detection including thunderstorms, heat waves and blizzards, up to 72 hours ahead.',
    color: 'text-amber-500',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
  },
]

const GENLAYER_PILLARS = [
  {
    icon: Cpu,
    title: 'Intelligent Contracts',
    desc: 'Python smart contracts that access live web data and run LLM reasoning natively as part of onchain consensus.',
  },
  {
    icon: Shield,
    title: 'Verifiable Decisions',
    desc: 'Every weather decision is a transaction on studionet. Any validator can re-run the computation and verify the conclusion.',
  },
  {
    icon: Globe,
    title: 'Decentralised Intelligence',
    desc: 'No centralised AI API. Weather data is fetched and reasoned over by the contract itself during the consensus round.',
  },
  {
    icon: Zap,
    title: 'Studionet',
    desc: "GenLayer's development network where Chromium's four Intelligent Contracts live. Real transactions, real consensus.",
  },
]

const PREREQS = [
  {
    icon: '1',
    text: 'Searching a city uses geocoding only and does not trigger a transaction. Transactions begin when you click Analyze, Compare, Assess, or Check Alerts.',
  },
  {
    icon: '2',
    text: 'Each analysis submits a real studionet transaction signed by your MetaMask wallet. GEN gas is deducted from your wallet balance for each feature you use.',
  },
  {
    icon: '3',
    text: 'Consensus takes 2-5 minutes. Results appear once the GenLayer validators agree on the AI output. Cached results return instantly for repeated queries.',
  },
  {
    icon: '4',
    text: 'Weather data is fetched from Open-Meteo directly by the smart contract during the consensus round, not by a server.',
  },
  {
    icon: '5',
    text: 'AI reasoning (GO/CAUTION/AVOID) happens inside the contract and is verifiable by any network participant.',
  },
]

export default function LandingPage() {
  const router = useRouter()
  const { connected, onCorrectChain, connecting, error, hasMetaMask, connect, switchToStudionet } = useWallet()

  useEffect(() => {
    if (connected && onCorrectChain) {
      router.push('/app')
    }
  }, [connected, onCorrectChain, router])

  function ConnectButton({ large = false }: { large?: boolean }) {
    const base = large
      ? 'inline-flex items-center gap-3 px-10 py-5 rounded-2xl font-bold text-lg transition-all duration-300'
      : 'inline-flex items-center gap-3 px-8 py-4 rounded-2xl font-semibold text-base transition-all duration-300'

    if (!hasMetaMask) {
      return (
        <a
          href="https://metamask.io/download/"
          target="_blank"
          rel="noopener noreferrer"
          className={`${base} bg-amber-500 hover:bg-amber-400 text-white shadow-[0_0_40px_rgba(245,158,11,0.35)] hover:scale-105 active:scale-100`}
        >
          <AlertCircle size={large ? 20 : 18} />
          Install MetaMask to Continue
          <ExternalLink size={large ? 16 : 14} className="text-amber-200" />
        </a>
      )
    }

    if (connected && onCorrectChain) {
      return (
        <div className={`${base} bg-emerald-600 text-white shadow-[0_0_40px_rgba(16,185,129,0.35)] cursor-default`}>
          <Loader2 size={large ? 20 : 18} className="animate-spin" />
          Entering Chromium…
        </div>
      )
    }

    if (connected && !onCorrectChain) {
      return (
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={() => void switchToStudionet()}
            disabled={connecting}
            className={`${base} bg-amber-500 hover:bg-amber-400 text-white shadow-[0_0_40px_rgba(245,158,11,0.35)] hover:scale-105 active:scale-100 disabled:opacity-60 disabled:scale-100`}
          >
            {connecting ? <Loader2 size={large ? 20 : 18} className="animate-spin" /> : <AlertCircle size={large ? 20 : 18} />}
            Switch to GenLayer Studionet
          </button>
          {error && <p className="text-red-400 text-xs">{error}</p>}
        </div>
      )
    }

    return (
      <div className="flex flex-col items-center gap-3">
        <button
          onClick={() => void connect()}
          disabled={connecting}
          className={`${base} bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 shadow-[0_0_40px_rgba(99,102,241,0.35)] hover:shadow-[0_0_60px_rgba(99,102,241,0.55)] hover:scale-105 active:scale-100 disabled:opacity-60 disabled:scale-100`}
        >
          {connecting ? <Loader2 size={large ? 20 : 18} className="animate-spin" /> : <Wallet size={large ? 20 : 18} />}
          {connecting ? 'Connecting…' : 'Connect Wallet to Enter'}
        </button>
        {error && <p className="text-red-400 text-xs max-w-xs text-center">{error}</p>}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#080e1a] text-white overflow-x-hidden">

      {/* ─── Hero ─── */}
      <section className="relative flex flex-col items-center justify-center min-h-screen px-4 text-center overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-blue-600/10 blur-[120px]" />
          <div className="absolute top-1/2 left-1/4 w-[300px] h-[300px] rounded-full bg-violet-600/8 blur-[80px]" />
          <div className="absolute top-1/2 right-1/4 w-[300px] h-[300px] rounded-full bg-indigo-600/8 blur-[80px]" />
        </div>

        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="relative z-10 max-w-4xl mx-auto"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-300 text-xs font-medium mb-8"
          >
            <span className="size-1.5 rounded-full bg-blue-400 animate-pulse" />
            Live on GenLayer Studionet
          </motion.div>

          <h1 className="text-7xl md:text-8xl font-black tracking-tighter mb-6 bg-gradient-to-br from-white via-blue-100 to-blue-400 bg-clip-text text-transparent leading-none">
            Chromium
          </h1>

          <p className="text-xl md:text-2xl text-slate-300 font-light mb-4 leading-relaxed">
            AI Weather Intelligence on the Blockchain
          </p>

          <p className="text-slate-400 max-w-2xl mx-auto text-base leading-relaxed mb-12">
            Every weather decision is an onchain AI computation, powered by{' '}
            <span className="text-blue-400 font-medium">GenLayer Intelligent Contracts</span>.
            Verifiable, decentralised, and consensus-backed. Not a weather app, but a weather{' '}
            <span className="italic text-white">oracle</span>.
          </p>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            <ConnectButton />
          </motion.div>
        </motion.div>

        {/* Scroll hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-slate-600 text-xs"
        >
          <span>scroll to learn more</span>
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="w-px h-8 bg-gradient-to-b from-slate-600 to-transparent"
          />
        </motion.div>
      </section>

      {/* ─── Features ─── */}
      <section className="py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Four Intelligent Contracts</h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              Each feature runs inside its own deployed smart contract on studionet. A real onchain transaction, every time you run an analysis.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="rounded-2xl border border-white/8 bg-white/4 backdrop-blur-sm p-6 hover:border-white/15 transition-colors"
              >
                <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl ${f.bg} mb-4`}>
                  <f.icon size={20} className={f.color} />
                </div>
                <h3 className="font-semibold text-white mb-2">{f.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── GenLayer Alignment ─── */}
      <section className="py-24 px-4 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-300 text-xs font-medium mb-6">
              <Cpu size={12} />
              Built on GenLayer
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              What Makes This Different
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto leading-relaxed">
              GenLayer is the first blockchain network where smart contracts execute AI natively, accessing live web data and running LLM reasoning as part of the consensus process.
              Chromium is built entirely on this primitive.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-12">
            {GENLAYER_PILLARS.map((p, i) => (
              <motion.div
                key={p.title}
                initial={{ opacity: 0, x: i % 2 === 0 ? -20 : 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="flex gap-4 p-6 rounded-2xl border border-white/6 bg-white/3"
              >
                <div className="shrink-0 w-9 h-9 rounded-xl bg-violet-500/15 flex items-center justify-center">
                  <p.icon size={16} className="text-violet-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">{p.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{p.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="flex justify-center"
          >
            <a
              href="https://genlayer.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-violet-400 transition-colors"
            >
              Learn more about GenLayer
              <ExternalLink size={13} />
            </a>
          </motion.div>
        </div>
      </section>

      {/* ─── Prerequisites ─── */}
      <section className="py-24 px-4 border-t border-white/5">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs font-medium mb-6">
              <Wallet size={12} />
              Transactions and Gas
            </div>
            <h2 className="text-3xl font-bold mb-4">Before You Begin</h2>
            <p className="text-slate-400">
              A few things to know so you get the most out of Chromium.
            </p>
          </motion.div>

          <motion.ul
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-4"
          >
            {PREREQS.map((item, i) => (
              <li key={i} className="flex items-start gap-4 p-4 rounded-xl border border-white/6 bg-white/3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold flex items-center justify-center mt-0.5">
                  {item.icon}
                </span>
                <p className="text-slate-300 text-sm leading-relaxed">{item.text}</p>
              </li>
            ))}
          </motion.ul>
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section className="py-32 px-4 border-t border-white/5 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="max-w-2xl mx-auto"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to experience onchain weather intelligence?
          </h2>
          <p className="text-slate-400 mb-10">
            Select a city, trigger an onchain transaction from your wallet, and receive a blockchain-verified weather decision in 2-5 minutes.
          </p>

          <ConnectButton large />
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-white/5 text-center text-slate-600 text-xs">
        Chromium · Powered by GenLayer Intelligent Contracts on studionet
      </footer>
    </div>
  )
}
