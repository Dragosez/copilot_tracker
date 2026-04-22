import React, { useState, useEffect } from 'react'

interface CopilotData {
  billed: string;
  consumed: string;
  total: string;
  lastUpdated: string;
}

declare global {
    interface Window {
    electronAPI: {
      getCopilotData: () => Promise<CopilotData>;
      loginWithGitHub: () => Promise<string>;
      onRefreshData: (callback: () => void) => void;
      onMainProcessMessage: (callback: (message: any) => void) => void;
    }
  }
}

const App: React.FC = () => {
  const [data, setData] = useState<CopilotData | null>(null)
  const [loading, setLoading] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await window.electronAPI.getCopilotData()
      setData(result)
      setShowSettings(false)
    } catch (err: any) {
      console.error('Failed to fetch data:', err)
      setError(err.message === 'AUTH_EXPIRED' ? 'Authentication expired. Please log in again.' : 'Failed to connect to GitHub.')
      setShowSettings(true)
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = async () => {
    setLoading(true)
    setError(null)
    try {
      await window.electronAPI.loginWithGitHub()
      // Once login window closes successfully, it means we have cookies
      await fetchData()
    } catch (err: any) {
      console.error('Login failed:', err)
      setError('Login was cancelled or failed.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    window.electronAPI.onRefreshData(() => {
      fetchData()
    })
  }, [])

  const consumedPercent = data ? (parseFloat(data.consumed) / parseFloat(data.total)) * 100 : 0

  if (showSettings) {
    return (
      <div className="flex-1 flex flex-col glass rounded-xl overflow-hidden shadow-2xl border border-github-border p-6 justify-center items-center space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold text-white">Authorization Required</h2>
          <p className="text-sm text-github-text">Connect your GitHub account to start tracking your Copilot usage.</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-lg w-full text-center">
            {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full py-3 bg-github-dark border border-github-border hover:border-github-blue/50 rounded-xl flex items-center justify-center space-x-3 transition-all group"
        >
          {loading ? (
             <div className="w-5 h-5 border-2 border-github-blue border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <svg className="w-5 h-5 text-white group-hover:text-github-blue transition-colors" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12c0-5.523-4.477-10-10-10z" />
              </svg>
              <span className="font-semibold text-white">Log in with GitHub</span>
            </>
          )}
        </button>

        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 flex items-start space-x-3">
          <svg className="w-5 h-5 text-github-blue mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-github-text leading-relaxed">
            This app will securely open a GitHub login window. We never store your password.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col glass rounded-xl overflow-hidden shadow-2xl border border-github-border">
      {/* Header */}
      <div className="px-4 py-3 flex justify-between items-center border-b border-github-border bg-github-dark/50">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 bg-github-blue rounded-md flex items-center justify-center">
             <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12c0-5.523-4.477-10-10-10z" />
             </svg>
          </div>
          <h1 className="text-sm font-bold text-white">Copilot Tracker</h1>
        </div>
        <button onClick={fetchData} className="p-1 hover:bg-github-border rounded-md transition-colors text-github-text hover:text-white">
          <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Main Stats */}
      <div className="p-4 space-y-6">
        <div className="space-y-4">
          <div className="flex justify-between items-end">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-github-text font-bold">Premium Consumption</p>
              <div className="flex items-baseline space-x-2">
                <span className="text-3xl font-black text-white">{data?.consumed || 0}</span>
                <span className="text-github-text text-sm">/ {data?.total || 300} requests</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-sm font-bold text-github-blue">{Math.round(consumedPercent)}%</span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="h-3 bg-github-dark rounded-full border border-github-border p-0.5">
            <div 
              className="h-full bg-gradient-to-r from-github-blue to-purple-500 rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(56,139,253,0.3)]"
              style={{ width: `${Math.min(consumedPercent, 100)}%` }}
            />
          </div>
        </div>

        {/* Billed Amount Card */}
        <div className="bg-github-dark/50 border border-github-border rounded-xl p-4 flex justify-between items-center group hover:border-github-blue/30 transition-colors">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center border border-green-500/20 text-green-500 group-hover:scale-110 transition-transform">
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
               </svg>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-github-text font-bold">Billed This Period</p>
              <p className="text-xl font-black text-white">{data?.billed || '$0.00'}</p>
            </div>
          </div>
          <div className="text-[10px] text-github-text bg-github-border/30 px-2 py-1 rounded">PREMIUM</div>
        </div>

        {/* Status */}
        <div className="flex justify-between items-center px-1">
          <div className="flex items-center space-x-2">
             <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_5px_rgba(34,197,94,0.5)]" />
             <span className="text-[10px] text-github-text uppercase font-bold tracking-tighter">Live Tracking Active</span>
          </div>
          <p className="text-[10px] text-github-text font-medium italic">
            Last update: {data?.lastUpdated ? new Date(data.lastUpdated).toLocaleTimeString() : 'Never'}
          </p>
        </div>
      </div>
    </div>
  )
}

export default App
