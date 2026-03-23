import React, { useState, useEffect, useCallback } from 'react';
import { getActiveTenantId } from '../../contexts/TenantContext';

// ============================================================================
// UNIFIED SCHEMA CACHE MANAGER - FIXED CREDENTIAL HANDLING
// ============================================================================
// Single page to manage schema caching for Amazon, eBay, and Temu
// FIX: Auto-resolves credential_id and passes it to backend
// ============================================================================

const MARKETPLACE_CONFIGS = {
  amazon: {
    name: 'Amazon',
    color: '#FF9900',
    icon: '🛒',
    marketplaces: [
      { id: 'A1F83G8C2ARO7P', name: 'UK', flag: '🇬🇧' },
      { id: 'ATVPDKIKX0DER', name: 'US', flag: '🇺🇸' },
      { id: 'A1PA6795UKMFR9', name: 'DE', flag: '🇩🇪' },
      { id: 'A1RKKUPIHCS9HS', name: 'ES', flag: '🇪🇸' },
      { id: 'A13V1IB3VIYZZH', name: 'FR', flag: '🇫🇷' },
      { id: 'APJ6JRA9NG5V4', name: 'IT', flag: '🇮🇹' },
    ],
  },
  ebay: {
    name: 'eBay',
    color: '#E53238',
    icon: '🏷️',
    marketplaces: [
      { id: 'EBAY_GB', name: 'UK', flag: '🇬🇧' },
      { id: 'EBAY_US', name: 'US', flag: '🇺🇸' },
      { id: 'EBAY_DE', name: 'DE', flag: '🇩🇪' },
      { id: 'EBAY_AU', name: 'AU', flag: '🇦🇺' },
      { id: 'EBAY_CA', name: 'CA', flag: '🇨🇦' },
      { id: 'EBAY_FR', name: 'FR', flag: '🇫🇷' },
      { id: 'EBAY_IT', name: 'IT', flag: '🇮🇹' },
      { id: 'EBAY_ES', name: 'ES', flag: '🇪🇸' },
    ],
  },
  temu: {
    name: 'Temu',
    color: '#FF6B35',
    icon: '🎁',
    marketplaces: [{ id: 'global', name: 'Global', flag: '🌍' }],
  },
};

export default function SchemaCacheManager() {
  const [activeTab, setActiveTab] = useState('amazon');
  const [selectedMarketplace, setSelectedMarketplace] = useState({
    amazon: 'A1F83G8C2ARO7P',
    ebay: 'EBAY_GB',
    temu: 'global',
  });

  const [stats, setStats] = useState({});
  const [jobs, setJobs] = useState({});
  const [activeJob, setActiveJob] = useState(null);
  const [pollingInterval, setPollingInterval] = useState(null);
  const [showErrors, setShowErrors] = useState(false);
  const [credentials, setCredentials] = useState({}); // Store resolved credentials

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';
  const tenantId = getActiveTenantId();

  // Fetch credentials on mount
  useEffect(() => {
    const fetchCredentials = async () => {
      try {
        const res = await fetch(`${API_BASE}/marketplace/credentials`, {
          headers: { 'X-Tenant-Id': tenantId },
        });

        if (res.ok) {
          const data = await res.json();
          const creds = data.credentials || data || [];
          
          // Map credentials by channel
          const credMap = {};
          creds.forEach(cred => {
            if (cred.active && cred.channel) {
              credMap[cred.channel] = cred.credential_id || cred.id || cred.credentialId;
            }
          });

          setCredentials(credMap);
          console.log('Resolved credentials:', credMap);
        }
      } catch (err) {
        console.error('Failed to fetch credentials:', err);
      }
    };

    if (tenantId) {
      fetchCredentials();
    }
  }, [tenantId, API_BASE]);

  // Fetch stats for a marketplace
  const fetchStats = useCallback(async (marketplace) => {
    const config = MARKETPLACE_CONFIGS[marketplace];
    const mpId = selectedMarketplace[marketplace];
    const url = marketplace === 'temu'
      ? `${API_BASE}/temu/schemas/stats`
      : marketplace === 'ebay'
      ? `${API_BASE}/ebay/schemas/stats?marketplace_id=${mpId}`
      : `${API_BASE}/amazon/schemas/list?marketplace_id=${mpId}`;

    try {
      const res = await fetch(url, {
        headers: {
          'X-Tenant-Id': tenantId,
        },
      });
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      const data = await res.json();
      
      // Normalize stats structure
      if (marketplace === 'amazon') {
        setStats(prev => ({
          ...prev,
          [marketplace]: {
            totalSchemas: data.count || 0,
            lastSync: null,
            cachePercentage: 100,
          },
        }));
      } else {
        setStats(prev => ({
          ...prev,
          [marketplace]: data,
        }));
      }
    } catch (err) {
      console.error(`Failed to fetch ${marketplace} stats:`, err);
    }
  }, [tenantId, selectedMarketplace, API_BASE]);

  // Fetch recent jobs
  const fetchJobs = useCallback(async (marketplace) => {
    const url = `${API_BASE}/${marketplace}/schemas/jobs`;
    try {
      const res = await fetch(url, {
        headers: {
          'X-Tenant-Id': tenantId,
        },
      });
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      const data = await res.json();
      setJobs(prev => ({
        ...prev,
        [marketplace]: data.jobs || [],
      }));

      // Check if there's an active job
      const running = (data.jobs || []).find(j => j.status === 'running');
      if (running && marketplace === activeTab) {
        setActiveJob(running);
        startPolling(marketplace, running.jobId);
      } else if (!running && marketplace === activeTab) {
        stopPolling();
      }
    } catch (err) {
      console.error(`Failed to fetch ${marketplace} jobs:`, err);
    }
  }, [tenantId, activeTab, API_BASE]);

  // Start sync job - WITH CREDENTIAL_ID
  const startSync = async (marketplace, fullSync = false) => {
    const mpId = selectedMarketplace[marketplace];
    const credentialId = credentials[marketplace];

    // Check if we have a credential
    if (!credentialId) {
      alert(`No ${MARKETPLACE_CONFIGS[marketplace].name} credential found.\n\nPlease add a credential in Marketplace Connections first.`);
      return;
    }

    const body = marketplace === 'temu'
      ? { fullSync }
      : { marketplaceId: mpId, fullSync };

    const url = marketplace === 'amazon'
      ? `${API_BASE}/amazon/schemas/download-all?credential_id=${credentialId}` // ADD credential_id
      : `${API_BASE}/${marketplace}/schemas/sync?credential_id=${credentialId}`; // ADD credential_id

    console.log('Starting sync:', { marketplace, url, body, credentialId });

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': tenantId,
        },
        body: JSON.stringify(body),
      });
      
      // Check if response is OK
      if (!res.ok) {
        const text = await res.text();
        let errorMsg = `HTTP ${res.status}: ${res.statusText}`;
        try {
          const errorData = JSON.parse(text);
          errorMsg = errorData.error || errorMsg;
        } catch (e) {
          // Response is not JSON, use status text
        }
        throw new Error(errorMsg);
      }
      
      const data = await res.json();
      
      if (data.jobId) {
        const newJob = {
          jobId: data.jobId,
          status: 'running',
          downloaded: 0,
          failed: 0,
          skipped: 0,
          total: 0,
          startedAt: new Date().toISOString(),
        };
        setActiveJob(newJob);
        startPolling(marketplace, data.jobId);
        await fetchJobs(marketplace);
      }
    } catch (err) {
      console.error(`Failed to start ${marketplace} sync:`, err);
      alert(`Failed to start sync: ${err.message}\n\nMake sure you have ${MARKETPLACE_CONFIGS[marketplace].name} credentials configured in Marketplace Connections.`);
    }
  };

  // Cancel job
  const cancelJob = async (marketplace, jobId) => {
    const url = `${API_BASE}/${marketplace}/schemas/jobs/${jobId}/cancel`;
    try {
      await fetch(url, {
        method: 'POST',
        headers: {
          'X-Tenant-Id': tenantId,
        },
      });
      stopPolling();
      await fetchJobs(marketplace);
    } catch (err) {
      console.error(`Failed to cancel job:`, err);
    }
  };

  // Poll job status
  const pollJobStatus = useCallback(async (marketplace, jobId) => {
    const url = `${API_BASE}/${marketplace}/schemas/jobs/${jobId}`;
    try {
      const res = await fetch(url, {
        headers: {
          'X-Tenant-Id': tenantId,
        },
      });
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      
      const job = await res.json();
      setActiveJob(job);

      if (job.status !== 'running') {
        stopPolling();
        await fetchStats(marketplace);
        await fetchJobs(marketplace);
      }
    } catch (err) {
      console.error('Failed to poll job status:', err);
    }
  }, [tenantId, API_BASE, fetchStats, fetchJobs]);

  // Start polling
  const startPolling = (marketplace, jobId) => {
    stopPolling();
    const interval = setInterval(() => {
      pollJobStatus(marketplace, jobId);
    }, 2000);
    setPollingInterval(interval);
  };

  // Stop polling
  const stopPolling = () => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
  };

  // Load initial data
  useEffect(() => {
    if (tenantId) {
      fetchStats(activeTab);
      fetchJobs(activeTab);
    }
  }, [tenantId, activeTab, fetchStats, fetchJobs]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => stopPolling();
  }, []);

  // Calculate progress percentage
  const getProgress = (job) => {
    if (!job || !job.total) return 0;
    return Math.round(((job.downloaded + job.skipped + job.failed) / job.total) * 100);
  };

  // Estimate time remaining
  const getETA = (job) => {
    if (!job || !job.total || !job.startedAt) return null;
    const elapsed = Date.now() - new Date(job.startedAt).getTime();
    const processed = job.downloaded + job.skipped + job.failed;
    if (processed === 0) return null;
    const remaining = job.total - processed;
    const avgTime = elapsed / processed;
    const eta = remaining * avgTime;
    const minutes = Math.round(eta / 60000);
    if (minutes < 1) return '< 1 min';
    if (minutes < 60) return `${minutes} min`;
    return `${Math.round(minutes / 60)}h ${minutes % 60}m`;
  };

  const config = MARKETPLACE_CONFIGS[activeTab];
  const currentStats = stats[activeTab] || {};
  const currentJobs = jobs[activeTab] || [];
  const hasCredential = !!credentials[activeTab];

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '600', marginBottom: '8px', color: 'var(--text-primary)' }}>
          Schema Cache Manager
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Download and cache marketplace category trees and attribute schemas for AI listing generation
        </p>
      </div>

      {/* Credential Warning */}
      {!hasCredential && (
        <div style={{
          marginBottom: '24px',
          padding: '16px',
          background: '#FEF3C7',
          border: '1px solid #F59E0B',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'start',
          gap: '12px'
        }}>
          <span style={{ fontSize: '24px' }}>⚠️</span>
          <div>
            <div style={{ fontWeight: '600', color: '#92400E', marginBottom: '4px' }}>
              No {config.name} Credential Found
            </div>
            <div style={{ fontSize: '14px', color: '#78350F' }}>
              Please add a {config.name} credential in <a href="/marketplace/connections" style={{ color: '#F59E0B', textDecoration: 'underline' }}>Marketplace Connections</a> before syncing schemas.
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid var(--border-color)' }}>
        {Object.entries(MARKETPLACE_CONFIGS).map(([key, cfg]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            style={{
              padding: '12px 24px',
              background: activeTab === key ? cfg.color : 'transparent',
              color: activeTab === key ? '#fff' : 'var(--text-secondary)',
              border: 'none',
              borderBottom: activeTab === key ? `3px solid ${cfg.color}` : 'none',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'all 0.2s',
            }}
          >
            <span style={{ marginRight: '8px' }}>{cfg.icon}</span>
            {cfg.name}
            {credentials[key] && <span style={{ marginLeft: '8px', fontSize: '10px' }}>✓</span>}
          </button>
        ))}
      </div>

      {/* Rest of the component remains the same... */}
      {/* Marketplace Selector */}
      {config.marketplaces.length > 1 && (
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '8px', color: 'var(--text-secondary)' }}>
            Marketplace
          </label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {config.marketplaces.map((mp) => (
              <button
                key={mp.id}
                onClick={() => {
                  setSelectedMarketplace(prev => ({ ...prev, [activeTab]: mp.id }));
                  fetchStats(activeTab);
                }}
                style={{
                  padding: '8px 16px',
                  background: selectedMarketplace[activeTab] === mp.id ? config.color : 'var(--bg-secondary)',
                  color: selectedMarketplace[activeTab] === mp.id ? '#fff' : 'var(--text-primary)',
                  border: `1px solid ${selectedMarketplace[activeTab] === mp.id ? config.color : 'var(--border-color)'}`,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '500',
                }}
              >
                <span style={{ marginRight: '6px' }}>{mp.flag}</span>
                {mp.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ padding: '20px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Total Categories</div>
          <div style={{ fontSize: '28px', fontWeight: '600', color: config.color }}>
            {activeTab === 'amazon' ? currentStats.totalSchemas || 0 : currentStats.totalCategories || 0}
          </div>
        </div>
        
        <div style={{ padding: '20px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Cached</div>
          <div style={{ fontSize: '28px', fontWeight: '600', color: config.color }}>
            {activeTab === 'amazon' 
              ? currentStats.totalSchemas || 0
              : activeTab === 'ebay'
              ? currentStats.cachedAspects || 0
              : currentStats.cachedTemplates || 0
            }
          </div>
        </div>

        <div style={{ padding: '20px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Cache Coverage</div>
          <div style={{ fontSize: '28px', fontWeight: '600', color: config.color }}>
            {Math.round(currentStats.cachePercentage || 0)}%
          </div>
        </div>

        <div style={{ padding: '20px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Last Sync</div>
          <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)' }}>
            {currentStats.lastSync 
              ? new Date(currentStats.lastSync).toLocaleDateString()
              : 'Never'
            }
          </div>
        </div>
      </div>

      {/* Sync Controls */}
      <div style={{ marginBottom: '24px', padding: '20px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '4px', color: 'var(--text-primary)' }}>
              Sync Schema Cache
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Download category trees and attribute schemas. Incremental sync skips cached items newer than 7 days.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => startSync(activeTab, false)}
              disabled={!!activeJob || !hasCredential}
              style={{
                padding: '10px 20px',
                background: (activeJob || !hasCredential) ? 'var(--bg-tertiary)' : config.color,
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: (activeJob || !hasCredential) ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                opacity: (activeJob || !hasCredential) ? 0.5 : 1,
              }}
            >
              🔄 Sync New Only
            </button>
            <button
              onClick={() => startSync(activeTab, true)}
              disabled={!!activeJob || !hasCredential}
              style={{
                padding: '10px 20px',
                background: (activeJob || !hasCredential) ? 'var(--bg-tertiary)' : config.color,
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: (activeJob || !hasCredential) ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                opacity: (activeJob || !hasCredential) ? 0.5 : 1,
              }}
            >
              ⚡ Full Sync
            </button>
          </div>
        </div>

        {/* Active Job Progress */}
        {activeJob && (
          <div>
            <div style={{ marginBottom: '12px', padding: '12px', background: 'var(--bg-primary)', borderRadius: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)' }}>
                  {activeJob.status === 'running' ? '⚙️ Syncing...' : `✅ ${activeJob.status}`}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {activeJob.downloaded + activeJob.skipped + activeJob.failed} / {activeJob.total || '?'}
                  {activeJob.status === 'running' && getETA(activeJob) && ` • ETA: ${getETA(activeJob)}`}
                </div>
              </div>

              {/* Progress Bar */}
              <div style={{ height: '8px', background: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden', marginBottom: '8px' }}>
                <div style={{
                  height: '100%',
                  width: `${getProgress(activeJob)}%`,
                  background: `linear-gradient(90deg, ${config.color}, ${config.color}dd)`,
                  transition: 'width 0.3s',
                }} />
              </div>

              {/* Stats Row */}
              <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <span>✅ Downloaded: {activeJob.downloaded || 0}</span>
                <span>⏭️ Skipped: {activeJob.skipped || 0}</span>
                <span>❌ Failed: {activeJob.failed || 0}</span>
                <span>📊 {getProgress(activeJob)}%</span>
              </div>
            </div>

            {/* Errors (Collapsible) */}
            {activeJob.errors && activeJob.errors.length > 0 && (
              <div style={{ marginTop: '12px' }}>
                <button
                  onClick={() => setShowErrors(!showErrors)}
                  style={{
                    padding: '8px 12px',
                    background: 'transparent',
                    color: '#ef4444',
                    border: '1px solid #ef4444',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: '500',
                  }}
                >
                  {showErrors ? '▼' : '▶'} {activeJob.errors.length} Errors
                </button>
                {showErrors && (
                  <div style={{
                    marginTop: '8px',
                    padding: '12px',
                    background: 'var(--bg-primary)',
                    borderRadius: '4px',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    color: '#ef4444',
                  }}>
                    {activeJob.errors.slice(0, 50).map((err, i) => (
                      <div key={i} style={{ marginBottom: '4px' }}>{err}</div>
                    ))}
                    {activeJob.errors.length > 50 && (
                      <div style={{ marginTop: '8px', fontStyle: 'italic' }}>
                        ... and {activeJob.errors.length - 50} more
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Cancel Button */}
            {activeJob.status === 'running' && (
              <button
                onClick={() => cancelJob(activeTab, activeJob.jobId)}
                style={{
                  marginTop: '12px',
                  padding: '8px 16px',
                  background: '#ef4444',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '500',
                }}
              >
                🛑 Cancel Job
              </button>
            )}
          </div>
        )}
      </div>

      {/* Job History */}
      <div>
        <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: 'var(--text-primary)' }}>
          Recent Jobs
        </h3>
        <div style={{ background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
          {currentJobs.slice(0, 5).map((job, i) => (
            <div
              key={job.jobId}
              style={{
                padding: '16px',
                borderBottom: i < Math.min(currentJobs.length, 5) - 1 ? '1px solid var(--border-color)' : 'none',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)', marginBottom: '4px' }}>
                    {job.status === 'completed' && '✅'}
                    {job.status === 'running' && '⚙️'}
                    {job.status === 'failed' && '❌'}
                    {job.status === 'cancelled' && '🛑'}
                    {' '}
                    {job.jobId}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {new Date(job.startedAt).toLocaleString()}
                    {job.marketplaceId && ` • ${job.marketplaceId}`}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)' }}>
                    {job.downloaded || 0} / {job.total || 0}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {job.failed > 0 && `${job.failed} failed`}
                    {job.skipped > 0 && ` • ${job.skipped} skipped`}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {currentJobs.length === 0 && (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>
              No jobs yet. Start a sync to cache schemas.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
