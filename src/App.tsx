import React, { useState, useEffect } from 'react';
import { Menu, Clock, Bell, ShieldAlert } from 'lucide-react';
import { User, SiteSettings, hasRole } from './types';
import AttendanceCenter from './components/AttendanceCenter';
import Sidebar from './components/Sidebar';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import GeoMap from './components/GeoMap';
import Households from './components/Households';
import Groups from './components/Groups';
import Payroll from './components/Payroll';
import Accounts from './components/Accounts';
import MasterList from './components/MasterList';
import Consultation from './components/Consultation';
import Settings from './components/Settings';
import Administrative from './components/Administrative';
import DisapprovedSubmitted from './components/DisapprovedSubmitted';
import AttendanceMonitoring from './components/AttendanceMonitoring';
import ITStaffPayroll from './components/ITStaffPayroll';
import PCUFiles from './components/PCUFiles';
import DailyAccomplishment from './components/DailyAccomplishment';
import DailyAttachment from './components/DailyAttachment';
import BlankForms from './components/BlankForms';
import Drafts from './components/Drafts';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentTab, setCurrentTab] = useState('dashboard');
  
  // Connection states & active offline draft context
  const [connectionStatus, setConnectionStatus] = useState<'online' | 'slow' | 'offline'>('online');
  const [activeDraft, setActiveDraft] = useState<any>(null);
  const [isDraftOnlyMode, setIsDraftOnlyMode] = useState<boolean>(false);

  // Automatically synchronize pending drafts
  const syncDrafts = async () => {
    if (connectionStatus === 'offline' || !currentUser) return;

    try {
      const stored = localStorage.getItem('sfc_household_drafts');
      let allDrafts = stored ? JSON.parse(stored) : [];
      
      try {
        const { restoreDraftsList } = await import('./lib/draftMedia');
        allDrafts = await restoreDraftsList(allDrafts);
      } catch (mediaErr) {}
      
      // Isolate by current user to enforce security access-control boundaries
      const userDrafts = allDrafts.filter(
        (d: any) => d.accountId && d.accountId.toLowerCase() === currentUser.email.toLowerCase()
      );

      const pendingDrafts = userDrafts.filter(
        (d: any) => d.syncStatus === 'Local Only' || d.syncStatus === 'Waiting for Sync'
      );

      if (pendingDrafts.length === 0) return;

      let successCount = 0;
      for (const draft of pendingDrafts) {
        try {
          const res = await fetch('/api/drafts', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-user-email': currentUser.email
            },
            body: JSON.stringify(draft)
          });

          if (res.ok) {
            successCount++;
            draft.syncStatus = 'Synced';
          } else {
            draft.syncStatus = 'Waiting for Sync';
          }
        } catch (e) {
          draft.syncStatus = 'Waiting for Sync';
          console.error('[Sync Worker] Failed synchronizing draft ID:', draft.id, e);
        }
      }

      if (successCount > 0) {
        const updatedDrafts = allDrafts.map((originalDraft: any) => {
          const match = pendingDrafts.find((p: any) => p.id === originalDraft.id);
          return match ? match : originalDraft;
        });

        localStorage.setItem('sfc_household_drafts', JSON.stringify(updatedDrafts));
        alert('Your field household drafts have been synchronized successfully with the clinic repository.');
      }
    } catch (e) {
      console.error('[Sync Worker] Error in sync process:', e);
    }
  };

  useEffect(() => {
    const handleOnline = () => setConnectionStatus('online');
    const handleOffline = () => setConnectionStatus('offline');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (connectionStatus !== 'offline' && currentUser) {
      syncDrafts();
    }
  }, [connectionStatus, currentUser]);

  useEffect(() => {
    const handleSyncTrigger = () => syncDrafts();
    window.addEventListener('trigger-auto-draft-sync', handleSyncTrigger);
    return () => window.removeEventListener('trigger-auto-draft-sync', handleSyncTrigger);
  }, [currentUser, connectionStatus]);

  // Shared filter states for Accomplishments and Attachments reporting sync
  const [sharedBarangay, setSharedBarangay] = useState<string>('All');
  const [sharedCampaignDate, setSharedCampaignDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [siteSettings, setSiteSettings] = useState<SiteSettings>({
    websiteTitle: 'Saint Francis Portal',
    websiteLogo: 'https://www.image2url.com/r2/default/images/1779782151932-e0fcc309-3ed7-4c15-a3fa-1859006492a3.png',
    faviconTitle: 'Saint Francis Portal',
    faviconLogo: 'https://www.image2url.com/r2/default/images/1779782151932-e0fcc309-3ed7-4c15-a3fa-1859006492a3.png',
    seoTitle: 'Saint Francis Portal',
    seoDescription: 'Health and Household Management System.',
    seoKeywords: 'clinic, health, household, pagadian, philsys'
  });
  const [loading, setLoading] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [sidebarMinimized, setSidebarMinimized] = useState(() => {
    return localStorage.getItem('sfc_sidebar_minimized') === 'true';
  });
  const handleToggleMinimize = () => {
    setSidebarMinimized(prev => {
      const next = !prev;
      localStorage.setItem('sfc_sidebar_minimized', String(next));
      return next;
    });
  };

  // Load session & custom settings on startup
  useEffect(() => {
    const storedUser = localStorage.getItem('sfc_user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setCurrentUser(parsed);
        // Fetch fresh state from server to sync profile pics / names instantly
        fetch('/api/auth/session', {
          headers: {
            'x-user-email': parsed.email
          }
        }).then(res => {
          if (res.ok) {
            return res.json();
          }
        }).then(data => {
          if (data && data.user) {
            setCurrentUser(data.user);
            localStorage.setItem('sfc_user', JSON.stringify(data.user));
          }
        }).catch(() => {});
      } catch (err) {
        localStorage.removeItem('sfc_user');
      }
    }
    fetchSettings();
  }, []);

  const updateFavicon = (href: string) => {
    if (!href) return;
    
    // Standard favicon icon update
    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = href;

    // Apple Touch icon / Mobile Shortcuts update
    let appleLink = document.querySelector("link[rel~='apple-touch-icon']") as HTMLLinkElement;
    if (!appleLink) {
      appleLink = document.createElement('link');
      appleLink.rel = 'apple-touch-icon';
      document.head.appendChild(appleLink);
    }
    appleLink.href = href;
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setSiteSettings(data);
        if (data.websiteTitle) {
          document.title = data.websiteTitle;
        }
        if (data.faviconLogo) {
          updateFavicon(data.faviconLogo);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('sfc_user', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('sfc_user');
    localStorage.removeItem('sfc_auto_login');
  };

  const handleSettingsUpdate = (updatedSettings: SiteSettings) => {
    setSiteSettings(updatedSettings);
    if (updatedSettings.websiteTitle) {
      document.title = updatedSettings.websiteTitle;
    }
    if (updatedSettings.faviconLogo) {
      updateFavicon(updatedSettings.faviconLogo);
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col justify-center items-center bg-slate-900 font-sans text-xs text-slate-400">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-solid border-blue-600 border-r-transparent mb-3"></div>
        <p className="font-semibold text-slate-200">Initializing Saint Francis Clinic Portal...</p>
      </div>
    );
  }

  // Auth Guard
  if (!currentUser) {
    return <Auth onLoginSuccess={handleLoginSuccess} />;
  }

  // Enforce Access Control boundaries on current tab
  const hasAccess = (tab: string) => {
    // Master admin override to access all pages
    if (['elthrone1233@gmail.com', 'saintfrancisclinic2026@gmail.com'].includes(currentUser.email)) return true;

    if (tab === 'pcu-file') {
      return hasAccess('households');
    }

    if (tab === 'drafts') {
      return true;
    }

    const roles = currentUser.position ? currentUser.position.split(',').map(r => r.trim()).filter(Boolean) : [];
    
    // Check if any role has access
    const hasRoleAccess = (role: string) => {
      // Check custom designations for system position first
      if (siteSettings?.userPagePermissions) {
        const allowedPages = siteSettings.userPagePermissions[role];
        if (allowedPages && Array.isArray(allowedPages)) {
          if (allowedPages.includes(tab)) return true;
        }
      }

      if (role === 'MANAGER') return true;
      if (role === 'HR') {
        return [
          'dashboard', 
          'geomap', 
          'barangays', 
          'puroks', 
          'households', 
          'pcu-file',
          'approvals', 
          'masterlist', 
          'daily-accomplishment', 
          'daily-attachment', 
          'consultation', 
          'payroll', 
          'it-payroll',
          'attendance-monitoring', 
          'audit',
          'blank-forms'
        ].includes(tab);
      }
      if (role === 'IT') {
        return [
          'dashboard', 
          'geomap', 
          'barangays', 
          'puroks', 
          'households', 
          'pcu-file',
          'approvals', 
          'masterlist', 
          'daily-accomplishment', 
          'daily-attachment', 
          'consultation', 
          'it-payroll',
          'audit',
          'blank-forms'
        ].includes(tab);
      }
      if (role === 'LEADER' || role === 'CO-LEADER') {
        return [
          'dashboard', 
          'geomap', 
          'households', 
          'pcu-file',
          'masterlist',
          'daily-accomplishment', 
          'daily-attachment', 
          'disapproved-submitted',
          'blank-forms'
        ].includes(tab);
      }
      if (role === 'ADMIN') {
        // Clinical Admin
        return [
          'dashboard', 
          'geomap', 
          'barangays', 
          'puroks', 
          'households', 
          'pcu-file',
          'approvals',
          'masterlist', 
          'daily-accomplishment', 
          'daily-attachment', 
          'consultation', 
          'it-payroll',
          'audit',
          'blank-forms'
        ].includes(tab);
      }
      return false;
    };

    return roles.some(hasRoleAccess);
  };

  const activeComponent = () => {
    if (!hasAccess(currentTab)) {
      return <Dashboard currentUser={currentUser} userEmail={currentUser.email} />;
    }
    switch (currentTab) {
      case 'dashboard':
        return <Dashboard currentUser={currentUser} userEmail={currentUser.email} />;
      case 'geomap':
        return <GeoMap userEmail={currentUser.email} />;
      case 'households':
        return (
          <Households 
            currentUser={currentUser} 
            initialDraftToEdit={activeDraft} 
            onClearActiveDraft={() => {
              setActiveDraft(null);
              setIsDraftOnlyMode(false);
            }}
            connectionStatus={connectionStatus}
            isDraftOnlyMode={isDraftOnlyMode}
          />
        );
      case 'drafts':
        if (activeDraft) {
          return (
            <Households 
              currentUser={currentUser} 
              initialDraftToEdit={activeDraft} 
              onClearActiveDraft={() => {
                setActiveDraft(null);
                setIsDraftOnlyMode(false);
              }}
              connectionStatus={connectionStatus}
              isDraftOnlyMode={isDraftOnlyMode}
            />
          );
        }
        return (
          <Drafts 
            currentUser={currentUser} 
            onEditDraft={(draft) => {
              setActiveDraft(draft);
              setIsDraftOnlyMode(true);
            }}
            onAddDraft={(type) => {
              const newDraft = {
                id: 'draft_' + Math.random().toString(36).substr(2, 9),
                isNewDraft: true,
                isFpePcsfOnly: type !== 'PMRF',
                pcsfType: type === 'PCSF_DEPENDENTS' ? 'DEPENDENT' : type === 'PCSF_MEMBERS' ? 'MEMBER' : '',
                accountId: currentUser.email,
                syncStatus: 'Local Only',
                lastModified: new Date().toISOString()
              };
              setActiveDraft(newDraft);
              setIsDraftOnlyMode(true);
            }}
            connectionStatus={connectionStatus}
          />
        );
      case 'pcu-file':
        return <PCUFiles currentUser={currentUser} />;
      case 'disapproved-submitted':
        return <DisapprovedSubmitted currentUser={currentUser} />;
      case 'groups':
        return <Groups currentUser={currentUser} />;
      case 'masterlist':
        return <MasterList currentUser={currentUser} />;
      case 'daily-accomplishment':
        return (
          <DailyAccomplishment 
            currentUser={currentUser} 
            sharedBarangay={sharedBarangay}
            setSharedBarangay={setSharedBarangay}
            sharedCampaignDate={sharedCampaignDate}
            setSharedCampaignDate={setSharedCampaignDate}
          />
        );
      case 'daily-attachment':
        return (
          <DailyAttachment 
            currentUser={currentUser} 
            sharedBarangay={sharedBarangay}
            setSharedBarangay={setSharedBarangay}
            sharedCampaignDate={sharedCampaignDate}
            setSharedCampaignDate={setSharedCampaignDate}
          />
        );
      case 'consultation':
        return <Consultation currentUser={currentUser} />;
      case 'accounts':
        return <Accounts currentUser={currentUser} />;
      case 'payroll':
        return <Payroll currentUser={currentUser} />;
      case 'it-payroll':
        return <ITStaffPayroll currentUser={currentUser} />;
      case 'attendance-monitoring':
        return <AttendanceMonitoring currentUser={currentUser} />;
      case 'settings':
        return <Settings currentUser={currentUser} onSettingsUpdate={handleSettingsUpdate} />;
      // Administrative routes
      case 'barangays':
        return <Administrative tabType="barangays" currentUser={currentUser} />;
      case 'puroks':
        return <Administrative tabType="puroks" currentUser={currentUser} />;
      case 'approvals':
        return <Administrative tabType="approvals" currentUser={currentUser} />;
      case 'audit':
        return <Administrative tabType="audit" currentUser={currentUser} />;
      case 'blank-forms':
        return <BlankForms currentUser={currentUser} />;
      default:
        return <Dashboard currentUser={currentUser} userEmail={currentUser.email} />;
    }
  };

  return (
    <div className="flex h-screen w-screen bg-slate-50/50 overflow-hidden text-xs relative">
      {/* Structural Sidebar Drawer */}
      <Sidebar 
        currentUser={currentUser} 
        currentTab={currentTab} 
        onChangeTab={setCurrentTab} 
        onLogout={handleLogout}
        siteSettings={siteSettings}
        mobileOpen={mobileSidebarOpen}
        setMobileOpen={setMobileSidebarOpen}
        minimized={sidebarMinimized}
        onToggleMinimize={handleToggleMinimize}
        onUpdateUser={setCurrentUser}
      />

      {/* Mobile backdrop shadow for slide-out sidebar */}
      {mobileSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-[9998] md:hidden transition-opacity"
          onClick={() => setMobileSidebarOpen(false)}
        ></div>
      )}

      {/* Main panel scroll container wrapper */}
      <main className="flex-1 flex flex-col h-full overflow-hidden w-full print:h-auto print:overflow-visible">
        
        {/* Header toolbar */}
        <header className="h-14 bg-white border-b border-slate-100 flex items-center justify-between px-4 md:px-6 shrink-0 z-10 gap-2 print:hidden">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="p-1.5 hover:bg-slate-100 rounded-lg md:hidden text-slate-700 active:scale-95 transition"
              title="Open Navigation Menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-1.5 font-sans font-extrabold text-[11px] md:text-xs text-slate-800 uppercase tracking-widest leading-none">
              {siteSettings.websiteLogo && (siteSettings.websiteLogo.startsWith('http://') || siteSettings.websiteLogo.startsWith('https://') || siteSettings.websiteLogo.startsWith('data:image/')) ? (
                <img src={siteSettings.websiteLogo} className="h-5 w-auto object-contain max-w-[50px]" alt="Logo" referrerPolicy="no-referrer" />
              ) : (
                <span>{siteSettings.websiteLogo}</span>
              )}
              <span className="ml-1">{currentTab.replace('-', ' ')}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasRole(currentUser, ['ADMIN', 'IT', 'MANAGER']) && (
              <button
                onClick={() => setShowAttendanceModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10.5px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-250 hover:bg-emerald-100 active:scale-95 transition cursor-pointer shrink-0"
                title="Attendance Time-clock Dashboard"
              >
                <Clock className="h-3.5 w-3.5 text-emerald-600 animate-pulse" />
                <span className="hidden sm:inline">Time Clock</span>
              </button>
            )}

            <div className="bg-slate-100 text-slate-600 font-mono text-[9px] md:text-[10px] uppercase font-bold py-1 px-1.5 md:px-2.5 rounded border whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px] md:max-w-none">
              {currentUser.position}
            </div>
          </div>
        </header>

        {/* View container */}
        <div className="flex-1 overflow-y-auto p-3 md:p-6 bg-slate-50/40">
          {activeComponent()}
        </div>
      </main>

      {/* Global Attendance Time In / Out Modal Controller */}
      <AttendanceCenter 
        currentUser={currentUser}
        isOpen={showAttendanceModal}
        onClose={() => setShowAttendanceModal(false)}
      />

      {/* Centered screen notification alerts modal with heavy backdrop-blur to obscure all other elements */}
    </div>
  );
}
