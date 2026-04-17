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
      getCopilotData: (cookie: string) => Promise<CopilotData>;
      loginWithGitHub: () => Promise<string>;
      onMainProcessMessage: (callback: (message: string) => void) => void;
    }
  }
}

const App: React.FC = () => {
  const [data, setData] = useState<CopilotData | null>(null)
  const [loading, setLoading] = useState(false)
  const [cookie, setCookie] = useState(localStorage.getItem('gh_cookie') || '')
  const [showSettings, setShowSettings] = useState(!cookie)

  const handleLogin = async () => {
    setLoading(true)
    try {
      const newCookie = await window.electronAPI.loginWithGitHub()
      setCookie(newCookie)
      localStorage.setItem('gh_cookie', newCookie)
      fetchData(newCookie)
    } catch (error) {
      console.error('Login failed:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchData = async (currentCookie: string = cookie) => {
    if (!currentCookie) {
      setShowSettings(true)
      return
    }
    setLoading(true)
    try {
      const result = await window.electronAPI.getCopilotData(currentCookie)
      setData(result)
      setShowSettings(false)
    } catch (error) {
      console.error('Failed to fetch data:', error)
      setShowSettings(true) // Show settings if cookie is expired/invalid
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (cookie) fetchData()
  }, [])

  const consumedPercent = data ? (parseFloat(data.consumed) / parseFloat(data.total)) * 100 : 0

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
          <span className="font-semibold text-sm">Copilot Tracker</span>
        </div>
        <button 
          onClick={() => setShowSettings(!showSettings)}
          className="p-1 hover:bg-github-border rounded-md transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>

      <div className="p-4 flex-1 space-y-6">
        {showSettings ? (
          <div className="space-y-6 py-4 animate-in fade-in zoom-in-95 duration-300">
            <div className="text-center space-y-2">
              <h2 className="text-lg font-medium">Authorization Required</h2>
              <p className="text-xs text-github-text/60">Connect your GitHub account to start tracking your Copilot usage.</p>
            </div>
            
            <button 
              onClick={handleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center space-x-3 bg-github-dark hover:bg-github-dark/80 border border-github-border text-white py-3 rounded-xl text-sm font-medium transition-all transform active:scale-95 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12c0-5.523-4.477-10-10-10z" />
                  </svg>
                  <span>Log in with GitHub</span>
                </>
              )}
            </button>

            <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-lg flex items-start space-x-2">
              <svg className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-[10px] text-blue-300">
                This app will securely open a GitHub login window to capture your session. We never store your password.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            {/* Billed Requests */}
            <div className="bg-github-dark/40 border border-github-border p-4 rounded-xl">
              <div className="text-xs text-github-text/70 mb-1">Billed premium requests</div>
              <div className="text-3xl font-bold text-white">{data?.billed || '$0.00'}</div>
            </div>

            {/* Consumed Requests */}
            <div className="bg-github-dark/40 border border-github-border p-4 rounded-xl">
              <div className="flex justify-between items-end mb-2">
                <div>
                  <div className="text-xs text-github-text/70 mb-1">Included premium requests consumed</div>
                  <div className="text-2xl font-bold text-white">
                    {data?.consumed || '0'} <span className="text-sm font-normal text-github-text/50">of {data?.total || '300'}</span>
                  </div>
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="w-full h-2.5 bg-github-border rounded-full overflow-hidden">
                <div 
                  className="h-full bg-github-blue rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(31,111,235,0.5)]"
                  style={{ width: `${consumedPercent}%` }}
                />
              </div>
              <div className="mt-3 text-[10px] text-github-text/60 italic">
                Premium requests included in your Copilot plan.
              </div>
            </div>

            {/* Footer Status */}
            <div className="flex justify-between items-center text-[10px] text-github-text/40 pt-4">
              <div className="flex items-center space-x-1">
                <div className={`w-1.5 h-1.5 rounded-full ${loading ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`} />
                <span>{loading ? 'Refreshing...' : 'Live'}</span>
              </div>
              <span>Updated {data ? new Date(data.lastUpdated).toLocaleTimeString() : 'Never'}</span>
            </div>
          </div>
        )}
      </div>

      {!showSettings && (
        <div className="p-3 border-t border-github-border flex justify-center">
           <button 
            onClick={() => fetchData()}
            disabled={loading}
            className="text-xs text-github-blue hover:underline flex items-center space-x-1"
           >
             <svg className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
             </svg>
             <span>Refresh Data</span>
           </button>
        </div>
      )}
    </div>
  )
}

export default App
