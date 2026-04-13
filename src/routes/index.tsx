'use client'

import { createFileRoute } from '@tanstack/react-router'
import {
  GitFork, Bot, Shield, Layers, ArrowRight,
  CheckCircle, FileCode, Network, GitBranch, Cpu, Zap,
  ExternalLink, Lock,
} from 'lucide-react'

export const Route = createFileRoute('/')({
  component: LandingPage,
})

const FILE_TYPES = [
  { ext: 'req', label: 'Requirements', color: '#6366f1' },
  { ext: 'blk', label: 'Block', color: '#8b5cf6' },
  { ext: 'fun', label: 'Function', color: '#06b6d4' },
  { ext: 'haz', label: 'Hazard', color: '#f59e0b' },
  { ext: 'fta', label: 'Fault Tree', color: '#ef4444' },
  { ext: 'smd', label: 'State Machine', color: '#10b981' },
  { ext: 'seq', label: 'Sequence', color: '#3b82f6' },
  { ext: 'tst', label: 'Test', color: '#22c55e' },
  { ext: 'ifc', label: 'Interface', color: '#a78bfa' },
  { ext: 'ple', label: 'Product Line', color: '#f97316' },
  { ext: 'vml', label: 'Variant Model', color: '#ec4899' },
  { ext: 'fml', label: 'Feature Model', color: '#14b8a6' },
  { ext: 'agt', label: 'Agent', color: '#6366f1' },
  { ext: 'spec', label: 'Spec', color: '#8b5cf6' },
  { ext: 'sam', label: 'Safety Analysis', color: '#f59e0b' },
  { ext: 'spr', label: 'Sprint', color: '#06b6d4' },
  { ext: 'ucd', label: 'Use Case', color: '#10b981' },
  { ext: 'flr', label: 'Failure Rate', color: '#ef4444' },
  { ext: 'vcf', label: 'Variant Config', color: '#a78bfa' },
  { ext: 'itm', label: 'Item', color: '#3b82f6' },
  { ext: 'sgl', label: 'Safety Goal', color: '#22c55e' },
  { ext: 'dash', label: 'Dashboard', color: '#f97316' },
  { ext: 'extend', label: 'Extension', color: '#94a3b8' },
]

const FEATURES = [
  { icon: FileCode, title: '23 Semantic File Types', desc: 'Requirements, blocks, functions, hazards, FTA, state machines — every MBSE artifact has a dedicated first-class DSL.', color: '#6366f1' },
  { icon: Bot, title: 'Hermes AI Agent', desc: 'Connect your local or VPS Hermes instance. It reads, creates, and modifies Sylang files directly in your GitHub repo.', color: '#8b5cf6' },
  { icon: Shield, title: 'ISO 26262 & ASPICE', desc: 'ASIL assignment, FMEA, FTA, traceability matrices, and safety goal allocation — compliance baked into the language.', color: '#10b981' },
  { icon: GitBranch, title: 'GitHub Native', desc: 'Your models live in Git. Sign in with GitHub, open any repo, edit files, and commit changes — zero extra infrastructure.', color: '#06b6d4' },
  { icon: Network, title: 'Full Traceability', desc: 'Automatic cross-file linking: requirements trace to tests, blocks, safety goals, and failure modes through the DSL.', color: '#f59e0b' },
  { icon: Cpu, title: 'Block-Based Editor', desc: 'Tiptap-powered structured editor with slash commands, property tables, and cell pickers — no raw text required.', color: '#ec4899' },
]

const STEPS = [
  { num: '01', title: 'Sign in with GitHub', desc: 'OAuth login gives Sylang read/write access to your repositories. Your models stay in your repo — always.' },
  { num: '02', title: 'Open any Sylang repo', desc: 'Browse your repos, pick a branch, and navigate the file tree. Click any .req, .blk, or .fta file to open it.' },
  { num: '03', title: 'Edit, ask Hermes, commit', desc: 'Use the structured Tiptap editor or ask the Hermes agent to read and write files for you.' },
]

const DSL_LINES = [
  { text: 'REQUIREMENT  REQ-BRK-001  "Emergency braking"', color: '#6366f1', bold: true },
  { text: '  domain      Safety', color: '#10b981' },
  { text: '  asil        D', color: '#ef4444' },
  { text: '  priority    Critical', color: '#f59e0b' },
  { text: '  status      Approved', color: '#22c55e' },
  { text: '', color: 'transparent' },
  { text: '  description |', color: '#94a3b8' },
  { text: '    Decelerate from 100 km/h', color: '#64748b' },
  { text: '    to 0 in ≤ 5 seconds.', color: '#64748b' },
  { text: '', color: 'transparent' },
  { text: '  allocatedTo   BLK-Brake', color: '#06b6d4' },
  { text: '  verifiedBy    TST-BRK-001', color: '#06b6d4' },
  { text: '  derivedFrom   SGL-001', color: '#8b5cf6' },
]

function LandingPage() {
  function handleLogin() {
    window.location.href = '/api/auth/github'
  }

  const bg = '#0a0e17'
  const cardBg = '#111827'
  const borderColor = '#1e293b'
  const textPrimary = '#f1f5f9'
  const textSecondary = '#94a3b8'
  const textMuted = '#64748b'
  const accent = '#6366f1'

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: bg, color: textPrimary, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      {/* Nav */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(10,14,23,0.85)', backdropFilter: 'blur(12px)', borderBottom: `1px solid ${borderColor}` }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', height: 62, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Layers style={{ width: 22, height: 22, color: accent }} />
            <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.03em', color: textPrimary }}>Sylang</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <a href="https://sylang.dev" target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 14, color: textMuted, textDecoration: 'none', padding: '6px 12px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              Docs <ExternalLink style={{ width: 12, height: 12 }} />
            </a>
            <button onClick={handleLogin}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 8, background: textPrimary, color: bg, border: 'none', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
              <GitFork style={{ width: 15, height: 15 }} />
              Sign in with GitHub
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '96px 24px 72px', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 14px', borderRadius: 20, border: `1px solid ${accent}50`, background: `${accent}10`, marginBottom: 32, fontSize: 13, color: accent, fontWeight: 600 }}>
          <Zap style={{ width: 13, height: 13 }} />
          Built for safety-critical systems engineering
        </div>
        <h1 style={{ fontSize: 'clamp(40px, 6vw, 72px)', fontWeight: 900, lineHeight: 1.06, letterSpacing: '-0.04em', marginBottom: 24, color: textPrimary }}>
          MBSE that{' '}
          <span style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #06b6d4 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            AI understands
          </span>
          {' '}natively.
        </h1>
        <p style={{ fontSize: 'clamp(16px, 2vw, 20px)', color: textSecondary, maxWidth: 600, margin: '0 auto 48px', lineHeight: 1.75 }}>
          A web IDE for Sylang — the semantic DSL for Model-Based Systems Engineering.
          Open any GitHub repo, edit system models with structured tooling,
          and collaborate with your Hermes AI agent.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
          <button onClick={handleLogin}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '14px 28px', borderRadius: 10, background: accent, color: '#fff', border: 'none', fontWeight: 700, fontSize: 16, cursor: 'pointer', boxShadow: `0 4px 24px ${accent}50` }}>
            <GitFork style={{ width: 18, height: 18 }} />
            Start with GitHub
            <ArrowRight style={{ width: 16, height: 16 }} />
          </button>
          <a href="https://sylang.dev" target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 28px', borderRadius: 10, background: cardBg, color: textPrimary, border: `1px solid ${borderColor}`, fontWeight: 600, fontSize: 16, textDecoration: 'none' }}>
            Read the docs
          </a>
        </div>
        <p style={{ fontSize: 13, color: textMuted }}>Free to use · No credit card · Your files stay in GitHub</p>
      </section>

      {/* DSL Preview */}
      <section style={{ maxWidth: 1100, margin: '0 auto 96px', padding: '0 24px' }}>
        <div style={{ borderRadius: 16, overflow: 'hidden', border: `1px solid ${borderColor}`, boxShadow: '0 8px 40px rgba(0,0,0,0.3)' }}>
          <div style={{ padding: '12px 18px', background: '#1e1e2e', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
            <span style={{ marginLeft: 14, fontSize: 12, color: textMuted, fontFamily: 'monospace' }}>braking-system.req</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            <div style={{ padding: '28px 32px', background: '#0f1117', borderRight: `1px solid ${borderColor}` }}>
              <pre style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: 13, lineHeight: 1.8, margin: 0, color: '#e2e8f0' }}>
                {DSL_LINES.map((line, i) => (
                  <div key={i} style={{ color: line.color, fontWeight: line.bold ? 700 : 400 }}>{line.text || '\u00A0'}</div>
                ))}
              </pre>
            </div>
            <div style={{ padding: '28px 32px', background: cardBg }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: textMuted, marginBottom: 18, textTransform: 'uppercase' }}>Parsed Properties</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { label: 'ID', value: 'REQ-BRK-001', color: '#6366f1' },
                  { label: 'ASIL', value: 'D', color: '#ef4444' },
                  { label: 'Domain', value: 'Safety', color: '#10b981' },
                  { label: 'Priority', value: 'Critical', color: '#f59e0b' },
                  { label: 'Status', value: 'Approved', color: '#22c55e' },
                  { label: 'Allocated', value: 'BLK-Brake', color: '#06b6d4' },
                  { label: 'Tests', value: 'TST-BRK-001', color: '#06b6d4' },
                  { label: 'Derived', value: 'SGL-001', color: '#8b5cf6' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: 8, background: '#0f1117', border: `1px solid ${borderColor}` }}>
                    <span style={{ fontSize: 12, color: textMuted }}>{label}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color, fontFamily: 'monospace' }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section style={{ maxWidth: 1100, margin: '0 auto 96px', padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <h2 style={{ fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 14, color: textPrimary }}>
            Everything you need for<br /><span style={{ color: accent }}>safety-critical MBSE</span>
          </h2>
          <p style={{ fontSize: 16, color: textMuted, maxWidth: 520, margin: '0 auto' }}>
            From requirements to FTA, from interfaces to sprint planning — all in one structured, AI-ready format.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
          {FEATURES.map(({ icon: Icon, title, desc, color }) => (
            <div key={title} style={{ padding: '28px', borderRadius: 14, background: cardBg, border: `1px solid ${borderColor}`, transition: 'border-color 0.2s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = `${color}60` }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = borderColor }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
                <Icon style={{ width: 22, height: 22, color }} />
              </div>
              <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 10, color: textPrimary }}>{title}</h3>
              <p style={{ fontSize: 14, color: textMuted, lineHeight: 1.7 }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section style={{ maxWidth: 1100, margin: '0 auto 96px', padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <h2 style={{ fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 14, color: textPrimary }}>Up and running in minutes</h2>
          <p style={{ fontSize: 16, color: textMuted }}>No CLI, no setup, no infrastructure to manage.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 0, border: `1px solid ${borderColor}`, borderRadius: 14, overflow: 'hidden' }}>
          {STEPS.map(({ num, title, desc }, i) => (
            <div key={num} style={{ display: 'flex', gap: 20, padding: '36px 28px', background: cardBg, borderRight: i < STEPS.length - 1 ? `1px solid ${borderColor}` : 'none' }}>
              <span style={{ fontSize: 28, fontWeight: 900, color: `${accent}30`, letterSpacing: '-0.04em', flexShrink: 0 }}>{num}</span>
              <div>
                <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 10, color: textPrimary }}>{title}</h3>
                <p style={{ fontSize: 14, color: textMuted, lineHeight: 1.7 }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* File types */}
      <section style={{ background: '#111827', borderTop: `1px solid ${borderColor}`, borderBottom: `1px solid ${borderColor}`, padding: '72px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(24px, 3vw, 36px)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 12, color: textPrimary }}>23 first-class file types</h2>
          <p style={{ fontSize: 15, color: textMuted, marginBottom: 40 }}>Every MBSE artifact expressed in structured Sylang — readable by humans and LLMs alike.</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {FILE_TYPES.map(({ ext, label, color }) => (
              <div key={ext} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 14px', borderRadius: 8, background: bg, border: `1px solid ${color}25` }}>
                <span style={{ fontSize: 11, fontWeight: 800, fontFamily: 'monospace', color, letterSpacing: '0.05em' }}>.{ext}</span>
                <span style={{ fontSize: 12, color: textMuted }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Hermes callout */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '96px 24px' }}>
        <div style={{ borderRadius: 20, padding: '56px 52px', background: 'linear-gradient(135deg, #1e1b4b 0%, #1e1b4b 40%, #0c4a6e 100%)', border: `1px solid ${accent}30`, display: 'grid', gridTemplateColumns: '1fr auto', gap: 40, alignItems: 'center' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 20, border: '1px solid rgba(139,92,246,0.4)', background: 'rgba(139,92,246,0.15)', marginBottom: 20, fontSize: 12, color: '#a78bfa', fontWeight: 700 }}>
              <Bot style={{ width: 12, height: 12 }} /> AI Agent
            </div>
            <h2 style={{ fontSize: 'clamp(22px, 3vw, 34px)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 16, color: textPrimary }}>Meet Hermes — your MBSE co-pilot</h2>
            <p style={{ fontSize: 15, color: textSecondary, lineHeight: 1.75, maxWidth: 520, marginBottom: 28 }}>
              Hermes runs locally or on your VPS. It understands every Sylang file type,
              generates requirements from natural language, performs gap analysis, and writes
              changes directly back to your GitHub repo.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {['Generate .req files from user stories or documents', 'Trace gaps between requirements and tests', 'Write FMEA entries from failure descriptions', 'Summarise ASIL coverage across the model'].map(item => (
                <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <CheckCircle style={{ width: 16, height: 16, color: '#10b981', flexShrink: 0 }} />
                  <span style={{ fontSize: 14, color: textSecondary }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
          <a href="https://pradix.tech" target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderRadius: 10, background: accent, color: '#fff', fontWeight: 600, fontSize: 14, textDecoration: 'none', boxShadow: `0 4px 16px ${accent}50`, flexShrink: 0 }}>
            Learn about Hermes <ExternalLink style={{ width: 14, height: 14 }} />
          </a>
        </div>
      </section>

      {/* Final CTA */}
      <section style={{ background: '#060a12', padding: '96px 24px' }}>
        <div style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center' }}>
          <Lock style={{ width: 36, height: 36, color: accent, margin: '0 auto 20px' }} />
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 900, letterSpacing: '-0.04em', marginBottom: 16, color: textPrimary }}>Start modeling. Right now.</h2>
          <p style={{ fontSize: 16, color: textSecondary, maxWidth: 480, margin: '0 auto 44px', lineHeight: 1.75 }}>
            Sign in with GitHub and open your first Sylang repository in under 60 seconds. No setup. No downloads. Just engineering.
          </p>
          <button onClick={handleLogin}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '16px 36px', borderRadius: 12, background: accent, color: '#fff', border: 'none', fontWeight: 700, fontSize: 18, cursor: 'pointer', boxShadow: `0 4px 28px ${accent}60` }}>
            <GitFork style={{ width: 20, height: 20 }} />
            Sign in with GitHub
          </button>
          <p style={{ marginTop: 18, fontSize: 13, color: textMuted }}>Free to use · Works with any GitHub repo · Your data stays yours</p>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: '#060a12', borderTop: `1px solid ${borderColor}`, padding: '32px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Layers style={{ width: 18, height: 18, color: accent }} />
            <span style={{ fontWeight: 800, fontSize: 15, color: textPrimary }}>Sylang</span>
            <span style={{ fontSize: 11, color: textMuted, marginLeft: 8 }}>Powered by Hermes Workspace</span>
          </div>
          <div style={{ display: 'flex', gap: 24, fontSize: 13 }}>
            <a href="https://sylang.dev" target="_blank" rel="noopener noreferrer" style={{ color: textMuted, textDecoration: 'none' }}>sylang.dev</a>
            <a href="https://pradix.tech" target="_blank" rel="noopener noreferrer" style={{ color: textMuted, textDecoration: 'none' }}>pradix.tech</a>
          </div>
          <span style={{ fontSize: 12, color: textMuted }}>© {new Date().getFullYear()} Balaji Boominathan</span>
        </div>
      </footer>
    </div>
  )
}
