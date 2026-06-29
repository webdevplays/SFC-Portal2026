import React, { useEffect, useState } from 'react';
import { Barangay, Purok, Household, User, hasRole } from '../types';
import { BarangayActivityChart, PurokActivityChart } from './AdministrativeCharts';
import { PhilHealthLogo } from './PhilHealthLogo';
import { 
  Building2, Activity, MapPin, ClipboardCheck, CheckCircle2, 
  XCircle, MessageSquare, ShieldAlert, Table, Search, RefreshCw,
  FileText, Image, AlertTriangle, Eye, ChevronDown, ChevronUp, Check, AlertCircle,
  ChevronLeft, ChevronRight, SlidersHorizontal, ArrowUpDown, Folder, FolderOpen,
  Pencil, X
} from 'lucide-react';

interface AdminProps {
  currentUser: User;
  tabType: 'barangays' | 'puroks' | 'approvals' | 'audit';
}

export default function Administrative({ currentUser, tabType }: AdminProps) {
  const isSystemMasterAdmin = currentUser && currentUser.email && (
    currentUser.email.toLowerCase() === 'elthrone1233@gmail.com' ||
    currentUser.email.toLowerCase() === 'saintfrancisclinic2026@gmail.com'
  );

  // States
  const [barangays, setBarangays] = useState<Barangay[]>([]);
  const [puroks, setPuroks] = useState<Purok[]>([]);
  const [approvalsQueue, setApprovalsQueue] = useState<Household[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // States for dynamic add panels
  const [showAddBarangay, setShowAddBarangay] = useState(false);
  const [newBarangayName, setNewBarangayName] = useState('');
  const [isBulkBarangay, setIsBulkBarangay] = useState(false);
  const [bulkBarangayText, setBulkBarangayText] = useState('');

  const [showAddPurok, setShowAddPurok] = useState(false);
  const [newPurokName, setNewPurokName] = useState('');
  const [newPurokBarangay, setNewPurokBarangay] = useState('');
  const [isBulkPurok, setIsBulkPurok] = useState(false);
  const [bulkPurokText, setBulkPurokText] = useState('');

  // Search filter inside logs
  const [logSearch, setLogSearch] = useState('');
  const [selectedAuditModule, setSelectedAuditModule] = useState<'all' | 'households' | 'groups' | 'administrative' | 'auth'>('all');

  // Search parameters for Barangays and Puroks
  const [barangaySearch, setBarangaySearch] = useState('');
  const [barangayPage, setBarangayPage] = useState(1);
  const [barangaySort, setBarangaySort] = useState<'a-z' | 'z-a' | 'highest-puroks' | 'lowest-puroks' | 'highest-progress' | 'lowest-progress'>('a-z');
  const [barangayProgressFilter, setBarangayProgressFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  const [purokSearch, setPurokSearch] = useState('');
  const [purokBarangayFilter, setPurokBarangayFilter] = useState('');
  const [purokPage, setPurokPage] = useState(1);
  const [purokSort, setPurokSort] = useState<'highest-hh' | 'lowest-hh' | 'highest-pmrf' | 'lowest-pmrf' | 'a-z'>('highest-hh');
  const [purokProgressFilter, setPurokProgressFilter] = useState<'all' | 'high-pmrf' | 'low-pmrf' | 'high-yakap' | 'low-yakap'>('all');
  
  // Reviewer comment remarks mapped by ID to prevent state replication across rows
  const [remarksMap, setRemarksMap] = useState<Record<string, string>>({});
  const [expandedHHId, setExpandedHHId] = useState<string | null>(null);
  const [selectedApprovalFolder, setSelectedApprovalFolder] = useState<string | null>(null);
  const [approvalTabMap, setApprovalTabMap] = useState<Record<string, 'PMRF' | 'PMRF_BACK' | 'FPE' | 'PCSF'>>({});
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [selectedApprovalStatusFilter, setSelectedApprovalStatusFilter] = useState<'Pending' | 'Approved' | 'Disapproved' | 'All'>('Pending');
  const [allGroups, setAllGroups] = useState<any[]>([]);

  // Master Admin direct household relocation states
  const [relocatingFolders, setRelocatingFolders] = useState<Record<string, string>>({});
  const [isRelocating, setIsRelocating] = useState(false);

  // Barangay rename states
  const [editingBarangayId, setEditingBarangayId] = useState<string | null>(null);
  const [editingBarangayName, setEditingBarangayName] = useState('');

  // Derived filtered, sorted, and paginated lists for Barangays
  const filteredBarangays = barangays
    .filter(b => {
      const bName = b.name || '';
      return bName.toLowerCase().includes((barangaySearch || '').toLowerCase());
    })
    .filter(b => {
      if (barangayProgressFilter === 'all') return true;
      const progress = b.householdProgressBar || 0;
      if (barangayProgressFilter === 'high') return progress >= 75;
      if (barangayProgressFilter === 'medium') return progress >= 25 && progress < 75;
      if (barangayProgressFilter === 'low') return progress < 25;
      return true;
    })
    .sort((a, b) => {
      if (barangaySort === 'z-a') return b.name.localeCompare(a.name);
      if (barangaySort === 'highest-puroks') return (b.puroksCount || 0) - (a.puroksCount || 0);
      if (barangaySort === 'lowest-puroks') return (a.puroksCount || 0) - (b.puroksCount || 0);
      if (barangaySort === 'highest-progress') return (b.householdProgressBar || 0) - (a.householdProgressBar || 0);
      if (barangaySort === 'lowest-progress') return (a.householdProgressBar || 0) - (b.householdProgressBar || 0);
      return a.name.localeCompare(b.name);
    });

  const barangayPageSize = 6;
  const totalBarangayPages = Math.ceil(filteredBarangays.length / barangayPageSize) || 1;
  const activeBarangayPage = barangayPage > totalBarangayPages ? 1 : barangayPage;
  const paginatedBarangays = filteredBarangays.slice(
    (activeBarangayPage - 1) * barangayPageSize,
    activeBarangayPage * barangayPageSize
  );

  // Derived filtered, sorted, and paginated lists for Puroks
  const filteredPuroks = puroks
    .filter(p => {
      const pName = p.name || '';
      const matchSearch = pName.toLowerCase().includes((purokSearch || '').toLowerCase());
      const matchBarangay = !purokBarangayFilter || p.barangay === purokBarangayFilter;
      return matchSearch && matchBarangay;
    })
    .filter(p => {
      if (purokProgressFilter === 'all') return true;
      const pmrfPercent = p.householdCount ? Math.round((p.pmrfCount / p.householdCount) * 100) : 0;
      const yakapPercent = p.householdCount ? Math.round((p.yakapWillingCount / p.householdCount) * 100) : 0;
      if (purokProgressFilter === 'high-pmrf') return pmrfPercent >= 70;
      if (purokProgressFilter === 'low-pmrf') return pmrfPercent < 30;
      if (purokProgressFilter === 'high-yakap') return yakapPercent >= 70;
      if (purokProgressFilter === 'low-yakap') return yakapPercent < 30;
      return true;
    })
    .sort((a, b) => {
      if (purokSort === 'lowest-hh') return (a.householdCount || 0) - (b.householdCount || 0);
      if (purokSort === 'highest-pmrf') {
        const aPercent = a.householdCount ? (a.pmrfCount / a.householdCount) : 0;
        const bPercent = b.householdCount ? (b.pmrfCount / b.householdCount) : 0;
        return bPercent - aPercent;
      }
      if (purokSort === 'lowest-pmrf') {
        const aPercent = a.householdCount ? (a.pmrfCount / a.householdCount) : 0;
        const bPercent = b.householdCount ? (b.pmrfCount / b.householdCount) : 0;
        return aPercent - bPercent;
      }
      if (purokSort === 'a-z') return a.name.localeCompare(b.name);
      return (b.householdCount || 0) - (a.householdCount || 0); // Default: highest-hh
    });

  const purokPageSize = 8;
  const totalPurokPages = Math.ceil(filteredPuroks.length / purokPageSize) || 1;
  const activePurokPage = purokPage > totalPurokPages ? 1 : purokPage;
  const paginatedPuroks = filteredPuroks.slice(
    (activePurokPage - 1) * purokPageSize,
    activePurokPage * purokPageSize
  );

  const handleAddBarangay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBarangayName.trim()) return;

    try {
      const res = await fetch('/api/barangays/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': currentUser.email
        },
        body: JSON.stringify({ name: newBarangayName })
      });
      if (res.ok) {
        setAlertModal({
          isOpen: true,
          title: 'Barangay Registered Successfully',
          description: `Barangay "${newBarangayName}" has been successfully added to the database.`,
          type: 'success'
        });
        setNewBarangayName('');
        setShowAddBarangay(false);
        fetchRequiredData();
      } else {
        const err = await res.json();
        setAlertModal({
          isOpen: true,
          title: 'Failed to Add Barangay',
          description: err.error || 'Failed to add barangay database record.',
          type: 'error'
        });
      }
    } catch (err) {
      setAlertModal({
        isOpen: true,
        title: 'Network Error',
        description: 'Failed to communicate with Saint Francis Database to register barangay.',
        type: 'error'
      });
    }
  };

  // Custom High-Design Confirm Modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);

  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  const handleDeleteBarangay = (id: string, name: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Barangay Jurisdiction",
      description: `Are you absolutely sure you want to permanently delete Barangay "${name}"? This will expunge all of its associated Purok subdivisions and records from the live network. This operation cannot be reversed.`,
      onConfirm: async () => {
        try {
          const res = await fetch('/api/barangays/delete', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-user-email': currentUser.email
            },
            body: JSON.stringify({ id })
          });
          if (res.ok) {
            setConfirmModal(null);
            fetchRequiredData();
            setAlertModal({
              isOpen: true,
              title: 'Barangay Exiled Successfully',
              description: `Barangay "${name}" has been permanently purged from the clinic jurisdictions ledger.`,
              type: 'success'
            });
          } else {
            const err = await res.json();
            setAlertModal({
              isOpen: true,
              title: 'Access Action Denied',
              description: err.error || 'Failed to delete selected barangay.',
              type: 'error'
            });
          }
        } catch(e) {}
      }
    });
  };

  const handleSaveBarangayName = async (id: string) => {
    if (!editingBarangayName.trim()) {
      setAlertModal({
        isOpen: true,
        title: 'Validation Error',
        description: 'Barangay name cannot be empty.',
        type: 'error'
      });
      return;
    }

    try {
      const res = await fetch('/api/barangays/edit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': currentUser.email
        },
        body: JSON.stringify({ id, newName: editingBarangayName })
      });

      if (res.ok) {
        setEditingBarangayId(null);
        setEditingBarangayName('');
        fetchRequiredData();
        setAlertModal({
          isOpen: true,
          title: 'Barangay Renamed Successfully',
          description: 'The Barangay folder name and all corresponding associations have been synced.',
          type: 'success'
        });
      } else {
        const err = await res.json();
        setAlertModal({
          isOpen: true,
          title: 'Operation Failed',
          description: err.error || 'Failed to rename barangay.',
          type: 'error'
        });
      }
    } catch (e: any) {
      setAlertModal({
        isOpen: true,
        title: 'Error',
        description: e.message || 'An unexpected error occurred.',
        type: 'error'
      });
    }
  };

  const handleAddPurok = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPurokName.trim() || !newPurokBarangay) return;

    try {
      const res = await fetch('/api/puroks/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': currentUser.email
        },
        body: JSON.stringify({ name: newPurokName, barangay: newPurokBarangay })
      });
      if (res.ok) {
        setAlertModal({
          isOpen: true,
          title: 'Purok Registered Successfully',
          description: `Purok "${newPurokName}" under Barangay ${newPurokBarangay} has been added successfully.`,
          type: 'success'
        });
        setNewPurokName('');
        setShowAddPurok(false);
        fetchRequiredData();
      } else {
        const err = await res.json();
        setAlertModal({
          isOpen: true,
          title: 'Failed to Add Purok',
          description: err.error || 'Failed to add purok records.',
          type: 'error'
        });
      }
    } catch (err) {
      setAlertModal({
        isOpen: true,
        title: 'Network Error',
        description: 'Failed to communicate with Saint Francis Database to register purok.',
        type: 'error'
      });
    }
  };

  const handleBulkAddBarangay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkBarangayText.trim()) return;

    const names = bulkBarangayText
      .split(/[,\n;]+/)
      .map(item => item.trim())
      .filter(item => item.length > 0);

    if (names.length === 0) return;

    try {
      const res = await fetch('/api/barangays/bulk-add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': currentUser.email
        },
        body: JSON.stringify({ names })
      });
      if (res.ok) {
        const data = await res.json();
        setAlertModal({
          isOpen: true,
          title: 'Bulk Barangays Registered',
          description: `Successfully added ${data.addedCount} new Barangays. Skipped ${data.skippedCount} duplicates/invalid entries.`,
          type: 'success'
        });
        setBulkBarangayText('');
        setShowAddBarangay(false);
        fetchRequiredData();
      } else {
        let errMsg = '';
        try {
          const err = await res.json();
          errMsg = err.error || 'Failed to bulk-add barangays.';
        } catch (jsonErr) {
          try {
            const rawBody = await res.text();
            errMsg = rawBody && rawBody.trim() ? rawBody.substring(0, 200) : `HTTP Status ${res.status}`;
          } catch (txtErr) {
            errMsg = `Server returned HTTP Status ${res.status}`;
          }
        }
        setAlertModal({
          isOpen: true,
          title: 'Failed to Bulk Add',
          description: errMsg,
          type: 'error'
        });
      }
    } catch (err: any) {
      setAlertModal({
        isOpen: true,
        title: 'Network Connection Error',
        description: `Failed to communicate with Saint Francis Database. Error: ${err.message || err}`,
        type: 'error'
      });
    }
  };

  const handleBulkAddPurok = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkPurokText.trim() || !newPurokBarangay) {
      setAlertModal({
        isOpen: true,
        title: 'Form Validation Error',
        description: 'Please specify a target Barangay and type at least one Purok name.',
        type: 'info'
      });
      return;
    }

    const names = bulkPurokText
      .split(/[,\n;]+/)
      .map(item => item.trim())
      .filter(item => item.length > 0);

    if (names.length === 0) return;

    try {
      const res = await fetch('/api/puroks/bulk-add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': currentUser.email
        },
        body: JSON.stringify({ barangay: newPurokBarangay, names })
      });
      if (res.ok) {
        const data = await res.json();
        setAlertModal({
          isOpen: true,
          title: 'Bulk Puroks Registered',
          description: `Successfully added ${data.addedCount} new Puroks in ${newPurokBarangay}. Skipped ${data.skippedCount} duplicates.`,
          type: 'success'
        });
        setBulkPurokText('');
        setShowAddPurok(false);
        fetchRequiredData();
      } else {
        let errMsg = '';
        try {
          const err = await res.json();
          errMsg = err.error || 'Failed to bulk-add puroks.';
        } catch (jsonErr) {
          try {
            const rawBody = await res.text();
            errMsg = rawBody && rawBody.trim() ? rawBody.substring(0, 200) : `HTTP Status ${res.status}`;
          } catch (txtErr) {
            errMsg = `Server response HTTP Status ${res.status}`;
          }
        }
        setAlertModal({
          isOpen: true,
          title: 'Failed to Bulk Add Puroks',
          description: errMsg,
          type: 'error'
        });
      }
    } catch (err: any) {
      setAlertModal({
        isOpen: true,
        title: 'Network Connection Error',
        description: `Failed to communicate with Saint Francis Database. Error: ${err.message || err}`,
        type: 'error'
      });
    }
  };

  const handleDeletePurok = (id: string, name: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Purok Sector",
      description: `Are you sure you want to delete Purok subdivision "${name}"? This action moves the operational sector offline and clears associated geographic markers.`,
      onConfirm: async () => {
        try {
          const res = await fetch('/api/puroks/delete', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-user-email': currentUser.email
            },
            body: JSON.stringify({ id })
          });
          if (res.ok) {
            setConfirmModal(null);
            fetchRequiredData();
            setAlertModal({
              isOpen: true,
              title: 'Purok Exiled Successfully',
              description: `Purok "${name}" has been permanently purged from the active records.`,
              type: 'success'
            });
          } else {
            const err = await res.json();
            setAlertModal({
              isOpen: true,
              title: 'Deletion Failed',
              description: err.error || 'Failed to delete selected purok sector.',
              type: 'error'
            });
          }
        } catch(e) {}
      }
    });
  };

  useEffect(() => {
    fetchRequiredData(true);
  }, [tabType]);

  // Real-time high-speed background sync polling for Verification approvals
  useEffect(() => {
    if (tabType !== 'approvals') return;

    // Fetch and sync data every 3.5 seconds in background
    const intervalId = setInterval(() => {
      fetchRequiredData(false);
    }, 3500);

    return () => clearInterval(intervalId);
  }, [tabType]);

  const fetchRequiredData = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      if (tabType === 'barangays') {
        const res = await fetch('/api/barangays');
        if (res.ok) {
          const data = await res.json();
          setBarangays(data.barangays);
        }
      } else if (tabType === 'puroks') {
        const [res, bRes] = await Promise.all([
          fetch('/api/puroks'),
          fetch('/api/barangays')
        ]);
        if (res.ok) {
          const data = await res.json();
          setPuroks(data);
        }
        if (bRes.ok) {
          const bData = await bRes.json();
          setBarangays(bData.barangays || []);
        }
      } else if (tabType === 'approvals') {
        const [res, bRes, gRes] = await Promise.all([
          fetch('/api/approvals/list'),
          fetch('/api/barangays'),
          fetch('/api/groups')
        ]);
        
        if (res.ok) {
          const data = await res.json();
          setApprovalsQueue(data);
        }
        if (bRes.ok) {
          const bData = await bRes.json();
          setBarangays(bData.barangays || []);
        }
        if (gRes.ok) {
          const gData = await gRes.json();
          setAllGroups(gData || []);
        }
      } else if (tabType === 'audit') {
        const res = await fetch('/api/logs');
        if (res.ok) {
          const data = await res.json();
          setAuditLogs(data);
        }
      }
    } catch(e) {}
    finally {
      if (showLoader) setLoading(false);
    }
  };

  const handleClearLogs = () => {
    setConfirmModal({
      isOpen: true,
      title: "Clear Clinical Action Audit Logs",
      description: "Are you absolutely sure you want to permanently clear all Clinical Action Audit Logs? This action is critical and will wipe out the entire audit trail history across all clinical modules. This cannot be undone.",
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          const res = await fetch('/api/logs/clear', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-user-email': currentUser.email
            }
          });
          if (res.ok) {
            setAuditLogs([]);
            setAlertModal({
              isOpen: true,
              title: "Logs Cleared",
              description: "Clinical Action Audit Logs have been cleared successfully.",
              type: "success"
            });
          } else {
            const data = await res.json();
            setAlertModal({
              isOpen: true,
              title: "Error",
              description: data.error || "Failed to clear clinical action audit logs.",
              type: "error"
            });
          }
        } catch (err: any) {
          setAlertModal({
            isOpen: true,
            title: "Error",
            description: "Connection error while clearing audit logs.",
            type: "error"
          });
        }
      }
    });
  };

  const handleApproveAction = async (id: string, action: 'Approve' | 'Disapprove' | 'RevertPending') => {
    try {
      const remarks = remarksMap[id] || '';
      
      // Enforce remarks validation for disapproval action
      if (action === 'Disapprove' && !remarks.trim()) {
        setAlertModal({
          isOpen: true,
          title: 'Remarks Required',
          description: 'You must provide explanation remarks detailing the reason of disapproval prior to rejecting this submission.',
          type: 'error'
        });
        return;
      }

      // Start action loader screen
      const loadingLabel = action === 'Approve' 
        ? 'Approving Household Submission...' 
        : action === 'Disapprove' 
          ? 'Disapproving Submission...' 
          : 'Reversing Submission Approval...';
      setActionLoading(loadingLabel);

      const res = await fetch('/api/approvals/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': currentUser.email
        },
        body: JSON.stringify({ householdId: id, action, remarks })
      });
      if (res.ok) {
        setAlertModal({
          isOpen: true,
          title: 'Review Settled Successfully',
          description: action === 'RevertPending'
            ? 'The household file has been successfully reverted back to Pending status!'
            : `The household file review has been successfully settled as ${action}d!`,
          type: 'success'
        });
        setRemarksMap(prev => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        fetchRequiredData();
      } else {
        const err = await res.json();
        setAlertModal({
          isOpen: true,
          title: 'Action Failed',
          description: err.error || 'Failed to complete the file review decision.',
          type: 'error'
        });
      }
    } catch (e: any) {
      setAlertModal({
        isOpen: true,
        title: 'Error Occurred',
        description: e.message || 'An unexpected network error occurred.',
        type: 'error'
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRelocateHousehold = async (id: string, targetBarangay: string) => {
    if (!targetBarangay || !targetBarangay.trim()) return;
    setIsRelocating(true);
    // Add a small 600ms simulated network network transfer delay for premium user loading feedback
    await new Promise(resolve => setTimeout(resolve, 600));
    try {
      const res = await fetch('/api/approvals/relocate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': currentUser.email
        },
        body: JSON.stringify({ householdId: id, targetBarangay })
      });
      if (res.ok) {
        setAlertModal({
          isOpen: true,
          title: 'Household Relocated',
          description: `The household file has been successfully moved to Barangay Folder: "${targetBarangay}"!`,
          type: 'success'
        });
        setRelocatingFolders(prev => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        fetchRequiredData();
      } else {
        const err = await res.json();
        setAlertModal({
          isOpen: true,
          title: 'Relocation Failed',
          description: err.error || 'Failed to relocate the household file.',
          type: 'error'
        });
      }
    } catch(e: any) {
      setAlertModal({
        isOpen: true,
        title: 'Error Occurred',
        description: e.message || 'An error occurred during relocation.',
        type: 'error'
      });
    } finally {
      setIsRelocating(false);
    }
  };

  const handleDeleteSubmission = async (id: string, headName: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Verification Submission?',
      description: `Warning: This will permanently delete the pending household submission for head "${headName}" and move it to the Recycle Bin. This action cannot be easily undone.`,
      onConfirm: async () => {
        setConfirmModal(null);
        setActionLoading('Deleting Submission permanently...');
        try {
          const res = await fetch('/api/households/delete', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-user-email': currentUser.email
            },
            body: JSON.stringify({ id })
          });
          if (res.ok) {
            setAlertModal({
              isOpen: true,
              title: 'Submission Deleted Successfully',
              description: `Household submission for "${headName}" has been successfully deleted.`,
              type: 'success'
            });
            fetchRequiredData();
          } else {
            const err = await res.json();
            setAlertModal({
              isOpen: true,
              title: 'Deletion Failed',
              description: err.error || 'Failed to delete the household submission.',
              type: 'error'
            });
          }
        } catch (e: any) {
          setAlertModal({
            isOpen: true,
            title: 'Error Occurred',
            description: e.message || 'Handshake failed with database.',
            type: 'error'
          });
        } finally {
          setActionLoading(null);
        }
      }
    });
  };

  // Grid views depending on administrative activeTab type
  return (
    <div className="font-sans text-xs">
      
      {/* MODULE 1: BARANGAYS VIEW PANEL */}
      {tabType === 'barangays' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-1.5 leading-none">
                <Building2 className="h-5 w-5 text-blue-600 animate-pulse" />
                Barangay Operating Boundaries
              </h2>
              <p className="text-slate-400 text-[10px] mt-1">Review statistical progresses, purok subdivisions, and registration indexes</p>
            </div>
            <div className="flex items-center gap-2">
              {hasRole(currentUser, ['ADMIN', 'MANAGER']) && (
                <button
                  onClick={() => setShowAddBarangay(!showAddBarangay)}
                  className="btn-3d-primary px-3 py-2 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                >
                  ➕ New Barangay
                </button>
              )}
              <button 
                onClick={fetchRequiredData} 
                className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
              >
                <RefreshCw className="h-4 w-4 text-slate-500" />
              </button>
            </div>
          </div>

          {showAddBarangay && (
            <form onSubmit={isBulkBarangay ? handleBulkAddBarangay : handleAddBarangay} className="bg-white p-5 rounded-xl border border-blue-100 shadow-md space-y-4 max-w-sm animate-fade-in animate-duration-200">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <h3 className="font-bold text-slate-800 text-xs">Register Barangay</h3>
                <button type="button" onClick={() => setShowAddBarangay(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm">✕</button>
              </div>

              <div className="flex bg-slate-100 p-1 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                <button
                  type="button"
                  onClick={() => setIsBulkBarangay(false)}
                  className={`flex-1 py-1 text-center rounded transition-all cursor-pointer ${!isBulkBarangay ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Single Entry
                </button>
                <button
                  type="button"
                  onClick={() => setIsBulkBarangay(true)}
                  className={`flex-1 py-1 text-center rounded transition-all cursor-pointer ${isBulkBarangay ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Bulk Add List
                </button>
              </div>

              {!isBulkBarangay ? (
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase leading-none">Barangay Name</label>
                  <input 
                    type="text" 
                    value={newBarangayName}
                    onChange={(e) => setNewBarangayName(e.target.value)}
                    placeholder="e.g. Barangay San Jose"
                    className="w-full mt-1.5 border border-slate-300 rounded px-2.5 py-1.5 text-xs outline-none focus:border-blue-500 bg-slate-50/50"
                    required
                  />
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase leading-none text-slate-500">Barangay Names (Bulk Entries)</label>
                  <textarea
                    rows={4}
                    value={bulkBarangayText}
                    onChange={(e) => setBulkBarangayText(e.target.value)}
                    placeholder="Separate each name with comma, semicolon or line break. e.g.&#13;Barangay San Jose,&#13;Barangay Santa Lucia,&#13;Barangay San Francisco"
                    className="w-full mt-1.5 border border-slate-300 rounded px-2.5 py-1.5 text-xs outline-none focus:border-blue-500 bg-slate-50/50 resize-y"
                    required
                  />
                  <p className="text-[9px] text-slate-400 italic">Saint Francis Database system will ignore existing entries automatically.</p>
                </div>
              )}

              <div className="flex justify-end gap-2 text-[10px] pt-1">
                <button 
                  type="button" 
                  onClick={() => setShowAddBarangay(false)}
                  className="px-2.5 py-1.5 btn-3d-secondary font-bold uppercase cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-3 py-1.5 btn-3d-primary font-bold uppercase cursor-pointer"
                >
                  {isBulkBarangay ? 'Bulk Register' : 'Save Barangay'}
                </button>
              </div>
            </form>
          )}

          {/* Barangay Activity Chart */}
          <BarangayActivityChart barangays={barangays} />

          {/* Interactive Search & Advanced Filtering bar */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-white p-3.5 rounded-xl border border-slate-100 shadow-sm">
            <div className="md:col-span-4 relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search className="h-3.5 w-3.5" />
              </span>
              <input
                type="text"
                placeholder="Search barangay by name..."
                value={barangaySearch}
                onChange={(e) => { setBarangaySearch(e.target.value); setBarangayPage(1); }}
                className="bg-slate-50 border border-slate-200 text-xs px-3 py-2 pl-9 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full"
              />
            </div>

            <div className="md:col-span-4 flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold text-slate-400 whitespace-nowrap">Progress Filter:</span>
              <select
                value={barangayProgressFilter}
                onChange={(e) => { setBarangayProgressFilter(e.target.value as any); setBarangayPage(1); }}
                className="bg-slate-50 border border-slate-200 text-xs px-2 py-1.5 rounded-lg text-slate-700 font-medium focus:outline-none w-full cursor-pointer bg-white"
              >
                <option value="all">All Achievements</option>
                <option value="high">High Progress (≥ 75%)</option>
                <option value="medium">Medium Progress (25% - 74%)</option>
                <option value="low">Low Progress (&lt; 25%)</option>
              </select>
            </div>

            <div className="md:col-span-4 flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold text-slate-400 whitespace-nowrap">Sort By:</span>
              <select
                value={barangaySort}
                onChange={(e) => { setBarangaySort(e.target.value as any); setBarangayPage(1); }}
                className="bg-slate-50 border border-slate-200 text-xs px-2 py-1.5 rounded-lg text-slate-700 font-medium focus:outline-none w-full cursor-pointer bg-white"
              >
                <option value="a-z">Alphabetical (A-Z)</option>
                <option value="z-a">Alphabetical (Z-A)</option>
                <option value="highest-puroks">Puroks Count (Highest)</option>
                <option value="lowest-puroks">Puroks Count (Lowest)</option>
                <option value="highest-progress">Approval Progress (Highest)</option>
                <option value="lowest-progress">Approval Progress (Lowest)</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-solid border-blue-600 border-r-transparent"></div>
            </div>
          ) : filteredBarangays.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-100 p-12 text-center text-slate-400 font-medium text-xs shadow-sm">
              No barangays matches the specified search and filter criteria.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {paginatedBarangays.map((b) => (
                  <div key={b.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4 hover:shadow-md transition">
                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {editingBarangayId === b.id ? (
                          <div className="flex items-center gap-1.5 w-full">
                            <input
                              type="text"
                              value={editingBarangayName}
                              onChange={(e) => setEditingBarangayName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveBarangayName(b.id);
                                if (e.key === 'Escape') {
                                  setEditingBarangayId(null);
                                  setEditingBarangayName('');
                                }
                              }}
                              className="bg-white border border-slate-300 text-xs px-2 py-1 rounded text-slate-850 font-extrabold focus:outline-none focus:ring-1 focus:ring-blue-500 w-full"
                              autoFocus
                              id={`edit-brg-input-${b.id}`}
                            />
                            <button
                              onClick={() => handleSaveBarangayName(b.id)}
                              className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 p-1 rounded transition duration-150"
                              title="Save Name"
                              id={`save-brg-btn-${b.id}`}
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                setEditingBarangayId(null);
                                setEditingBarangayName('');
                              }}
                              className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1 rounded transition duration-150"
                              title="Cancel"
                              id={`cancel-brg-btn-${b.id}`}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <span className="font-extrabold text-slate-800 text-sm tracking-tight truncate">{b.name}</span>
                            {hasRole(currentUser, ['ADMIN', 'MANAGER']) && (
                              <button
                                onClick={() => {
                                  setEditingBarangayId(b.id);
                                  setEditingBarangayName(b.name);
                                }}
                                className="text-slate-400 hover:text-blue-600 hover:bg-blue-50 p-1 rounded-lg transition duration-200 hover:scale-110 active:scale-90"
                                title="Edit Barangay Name"
                                id={`edit-brg-trigger-${b.id}`}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {['elthrone1233@gmail.com', 'saintfrancisclinic2026@gmail.com'].includes(currentUser.email) && (
                              <button 
                                onClick={() => handleDeleteBarangay(b.id, b.name)} 
                                className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-1 rounded-lg transition duration-200 hover:scale-110 active:scale-90"
                                title="Delete Barangay"
                                id={`delete-brg-btn-${b.id}`}
                              >
                                <XCircle className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                      <span className="bg-blue-100 text-blue-900 font-extrabold px-2 py-0.5 rounded text-[9px] font-mono whitespace-nowrap border border-blue-250">
                        {b.puroksCount || 0} Puroks Subdivided
                      </span>
                    </div>

                    <div className="space-y-3.5 pt-2">
                      {/* progress 1 */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] font-extrabold text-slate-500 leading-none">
                          <span>Household Approval Progress</span>
                          <span className="text-slate-900 font-mono font-black">{b.householdProgressBar}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-3.5 border border-slate-200/50 shadow-[inset_0_1.5px_3px_rgba(0,0,0,0.06)] overflow-hidden relative p-[1px]">
                          <div 
                            style={{ width: `${b.householdProgressBar}%` }}
                            className="bg-gradient-to-r from-sky-500 via-sky-400 to-sky-600 h-full rounded-full transition-all duration-1000 shadow-[0_1px_2px_rgba(14,165,233,0.35)] relative overflow-hidden"
                          >
                            {/* 3D Round Cylinder Glossy Sheen Overlay */}
                            <div className="absolute inset-x-0 top-0 h-[35%] bg-white/25 rounded-t-full"></div>
                            {/* Pulsing Glint Sweep overlay */}
                            <div className="absolute inset-y-0 w-12 bg-gradient-to-r from-transparent via-white/35 to-transparent skew-x-30 animate-pulse"></div>
                          </div>
                        </div>
                      </div>

                      {/* progress 2 */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] font-extrabold text-slate-500 leading-none">
                          <span>Member Enrollment Rate</span>
                          <span className="text-slate-900 font-mono font-black">{b.membersProgressBar}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-3.5 border border-slate-200/50 shadow-[inset_0_1.5px_3px_rgba(0,0,0,0.06)] overflow-hidden relative p-[1px]">
                          <div 
                            style={{ width: `${b.membersProgressBar}%` }}
                            className="bg-gradient-to-r from-[#6366f1] via-[#4f46e5] to-[#4338ca] h-full rounded-full transition-all duration-1000 shadow-[0_1px_2px_rgba(99,102,241,0.35)] relative overflow-hidden"
                          >
                            {/* 3D Round Cylinder Glossy Sheen Overlay */}
                            <div className="absolute inset-x-0 top-0 h-[35%] bg-white/25 rounded-t-full"></div>
                            {/* Pulsing Glint Sweep overlay */}
                            <div className="absolute inset-y-0 w-12 bg-gradient-to-r from-transparent via-white/35 to-transparent skew-x-30 animate-pulse"></div>
                          </div>
                        </div>
                      </div>

                      {/* progress 3 */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] font-extrabold text-slate-500 leading-none">
                          <span>PMRF Consent Rate</span>
                          <span className="text-slate-900 font-mono font-black">{b.pmrfProgressBar}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-3.5 border border-slate-200/50 shadow-[inset_0_1.5px_3px_rgba(0,0,0,0.06)] overflow-hidden relative p-[1px]">
                          <div 
                            style={{ width: `${b.pmrfProgressBar}%` }}
                            className="bg-gradient-to-r from-teal-500 via-emerald-400 to-teal-600 h-full rounded-full transition-all duration-1000 shadow-[0_1px_2px_rgba(20,184,166,0.35)] relative overflow-hidden"
                          >
                            {/* 3D Round Cylinder Glossy Sheen Overlay */}
                            <div className="absolute inset-x-0 top-0 h-[35%] bg-white/25 rounded-t-full"></div>
                            {/* Pulsing Glint Sweep overlay */}
                            <div className="absolute inset-y-0 w-12 bg-gradient-to-r from-transparent via-white/35 to-transparent skew-x-30 animate-pulse"></div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-slate-50 pt-3 flex justify-between items-center text-[10px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block"></span>
                        Yakap Consent Count:
                      </span>
                      <strong className="text-slate-700 font-bold">{b.yakapWillingCount || 0} heads Willing</strong>
                    </div>
                  </div>
                ))}
              </div>

              {/* Barangay Pagination Bar */}
              {totalBarangayPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-100 shadow-sm">
                  <span className="text-[10px] font-medium text-slate-500">
                    Showing <span className="font-bold text-slate-800">{Math.min(filteredBarangays.length, (activeBarangayPage - 1) * barangayPageSize + 1)}-{Math.min(filteredBarangays.length, activeBarangayPage * barangayPageSize)}</span> of <span className="font-bold text-slate-800">{filteredBarangays.length}</span> Barangays
                  </span>
                  
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={activeBarangayPage === 1}
                      onClick={() => setBarangayPage(prev => Math.max(1, prev - 1))}
                      className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition text-slate-500 disabled:opacity-40 disabled:cursor-not-allowed hover:text-slate-850 cursor-pointer"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>

                    {Array.from({ length: totalBarangayPages }).map((_, i) => {
                      const pageNum = i + 1;
                      const isCurrent = pageNum === activeBarangayPage;
                      return (
                        <button
                          key={pageNum}
                          type="button"
                          onClick={() => setBarangayPage(pageNum)}
                          className={`min-w-7 h-7 flex items-center justify-center text-[10px] font-black rounded-lg border transition cursor-pointer ${
                            isCurrent 
                              ? 'bg-blue-600 font-extrabold border-blue-600 text-white shadow-xs' 
                              : 'border-slate-200 text-slate-500 hover:text-slate-850 hover:bg-slate-50 bg-white'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}

                    <button
                      type="button"
                      disabled={activeBarangayPage === totalBarangayPages}
                      onClick={() => setBarangayPage(prev => Math.min(totalBarangayPages, prev + 1))}
                      className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition text-slate-500 disabled:opacity-40 disabled:cursor-not-allowed hover:text-slate-850 cursor-pointer"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* MODULE 2: PUROKS GRIDS */}
      {tabType === 'puroks' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-1.5 leading-none">
                <MapPin className="h-5 w-5 text-blue-600" />
                Puroks Demographic Analytics
              </h2>
              <p className="text-slate-400 text-[10px] mt-1 font-mono">Metrics of household sectors in Pagadian City</p>
            </div>
            <div className="flex items-center gap-2">
              {hasRole(currentUser, ['ADMIN', 'MANAGER']) && (
                <button
                  onClick={() => setShowAddPurok(!showAddPurok)}
                  className="btn-3d-primary px-3 py-2 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                >
                  ➕ New Purok
                </button>
              )}
              <button 
                onClick={fetchRequiredData} 
                className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
              >
                <RefreshCw className="h-4 w-4 text-slate-500" />
              </button>
            </div>
          </div>

          {showAddPurok && (
            <form onSubmit={isBulkPurok ? handleBulkAddPurok : handleAddPurok} className="bg-white p-5 rounded-xl border border-blue-100 shadow-md space-y-4 max-w-sm animate-fade-in animate-duration-200">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <h3 className="font-bold text-slate-800 text-xs">Register Purok</h3>
                <button type="button" onClick={() => setShowAddPurok(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm">✕</button>
              </div>

              <div className="flex bg-slate-100 p-1 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                <button
                  type="button"
                  onClick={() => setIsBulkPurok(false)}
                  className={`flex-1 py-1 text-center rounded transition-all cursor-pointer ${!isBulkPurok ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Single Entry
                </button>
                <button
                  type="button"
                  onClick={() => setIsBulkPurok(true)}
                  className={`flex-1 py-1 text-center rounded transition-all cursor-pointer ${isBulkPurok ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Bulk Add List
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase leading-none">Select Barangay Location</label>
                  <select 
                    value={newPurokBarangay}
                    onChange={(e) => setNewPurokBarangay(e.target.value)}
                    className="w-full mt-1.5 border border-slate-300 rounded px-2.5 py-1.5 text-xs outline-none bg-white focus:border-blue-500"
                    required
                  >
                    <option value="">-- Choose Barangay --</option>
                    {barangays.map(brg => (
                      <option key={brg.id} value={brg.name}>{brg.name}</option>
                    ))}
                  </select>
                </div>

                {!isBulkPurok ? (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase leading-none">Purok Name</label>
                    <input 
                      type="text" 
                      value={newPurokName}
                      onChange={(e) => setNewPurokName(e.target.value)}
                      placeholder="e.g. Purok 1"
                      className="w-full mt-1.5 border border-slate-300 rounded px-2.5 py-1.5 text-xs outline-none focus:border-blue-500 bg-slate-50/50"
                      required
                    />
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase leading-none text-slate-500">Purok Names (Bulk Entries)</label>
                    <textarea
                      rows={4}
                      value={bulkPurokText}
                      onChange={(e) => setBulkPurokText(e.target.value)}
                      placeholder="Separate each name with comma, semicolon or line break. e.g.&#13;Purok 1,&#13;Purok 2,&#13;Purok 3"
                      className="w-full mt-1.5 border border-slate-300 rounded px-2.5 py-1.5 text-xs outline-none focus:border-blue-500 bg-slate-50/50 resize-y"
                      required
                    />
                    <p className="text-[9px] text-slate-400 italic">Duplicated purok names under the same Barangay will be ignored automatically.</p>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 text-[10px] pt-1">
                <button 
                  type="button" 
                  onClick={() => setShowAddPurok(false)}
                  className="px-2.5 py-1.5 btn-3d-secondary font-bold uppercase cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-3 py-1.5 btn-3d-primary font-bold uppercase cursor-pointer"
                >
                  {isBulkPurok ? 'Bulk Register' : 'Save Purok'}
                </button>
              </div>
            </form>
          )}

          {/* Purok Activity Chart */}
          <PurokActivityChart puroks={puroks} />

          {/* Interactive Search and Filter controls */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 bg-white p-3.5 rounded-xl border border-slate-100 shadow-sm">
            <div className="sm:col-span-3 relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search className="h-3.5 w-3.5" />
              </span>
              <input
                type="text"
                placeholder="Search purok by name..."
                value={purokSearch}
                onChange={(e) => { setPurokSearch(e.target.value); setPurokPage(1); }}
                className="bg-slate-50 border border-slate-200 text-xs px-2.5 py-1.5 pl-8.5 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full"
              />
            </div>
            
            <div className="sm:col-span-3 flex items-center gap-1.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 whitespace-nowrap">Barangay:</span>
              <select
                value={purokBarangayFilter}
                onChange={(e) => { setPurokBarangayFilter(e.target.value); setPurokPage(1); }}
                className="bg-slate-50 border border-slate-200 text-xs px-2 py-1.5 rounded-lg text-slate-700 font-medium focus:outline-none w-full cursor-pointer bg-white"
              >
                <option value="">All Barangays</option>
                {barangays.map((b, i) => (
                  <option key={i} value={b.name}>{b.name}</option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-3 flex items-center gap-1.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 whitespace-nowrap">Progress:</span>
              <select
                value={purokProgressFilter}
                onChange={(e) => { setPurokProgressFilter(e.target.value as any); setPurokPage(1); }}
                className="bg-slate-50 border border-slate-200 text-xs px-2 py-1.5 rounded-lg text-slate-700 font-medium focus:outline-none w-full cursor-pointer bg-white"
              >
                <option value="all">All Progress Levels</option>
                <option value="high-pmrf">High PMRF (≥ 70%)</option>
                <option value="low-pmrf">Low PMRF (&lt; 30%)</option>
                <option value="high-yakap">High Yakap (≥ 70%)</option>
                <option value="low-yakap">Low Yakap (&lt; 30%)</option>
              </select>
            </div>

            <div className="sm:col-span-3 flex items-center gap-1.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 whitespace-nowrap">Sort By:</span>
              <select
                value={purokSort}
                onChange={(e) => { setPurokSort(e.target.value as any); setPurokPage(1); }}
                className="bg-slate-50 border border-slate-200 text-xs px-2 py-1.5 rounded-lg text-slate-700 font-medium focus:outline-none w-full cursor-pointer bg-white"
              >
                <option value="highest-hh">Households (Highest)</option>
                <option value="lowest-hh">Households (Lowest)</option>
                <option value="highest-pmrf">PMRF Consent % (Highest)</option>
                <option value="lowest-pmrf">PMRF Consent % (Lowest)</option>
                <option value="a-z">Name (A-Z)</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-solid border-blue-600 border-r-transparent"></div>
            </div>
          ) : filteredPuroks.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-100 p-12 text-center text-slate-400 font-medium text-xs shadow-sm">
              No Purok sectors matches specified search and filter criteria.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {paginatedPuroks.map((p) => {
                  const pmrfPercent = p.householdCount ? Math.round((p.pmrfCount / p.householdCount) * 100) : 0;
                  const yakapPercent = p.householdCount ? Math.round((p.yakapWillingCount / p.householdCount) * 100) : 0;

                  return (
                    <div key={p.id} className="bg-white p-4.5 rounded-xl border border-slate-100 shadow-xs flex flex-col justify-between hover:shadow-md transition">
                      <div>
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-bold text-slate-800 text-sm leading-none">{p.name}</h3>
                            <span className="text-[10px] text-slate-400 mt-1 block">Sector of: {p.barangay}</span>
                          </div>
                          {['elthrone1233@gmail.com', 'saintfrancisclinic2026@gmail.com'].includes(currentUser.email) && (
                            <button 
                              onClick={() => handleDeletePurok(p.id, p.name)} 
                              className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition -mt-1 -mr-1"
                              title="Delete Purok"
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-center text-xs mt-4 bg-slate-50 p-2.5 rounded border border-slate-100">
                        <div>
                          <span className="text-[9px] text-slate-400 block font-semibold">Households</span>
                          <strong className="text-slate-700 block mt-1">{p.householdCount} files</strong>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-400 block font-semibold">Citizens</span>
                          <strong className="text-slate-700 block mt-1">{p.memberCount} heads</strong>
                        </div>
                      </div>

                      {/* DUAL HIGH-GRAPHICS 3D VOLUMETRIC PROGRESS BARS */}
                      <div className="space-y-3.5 border-t border-slate-50 pt-3 mt-3">
                        {/* PMRF Progress */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[9px] font-extrabold uppercase tracking-wider leading-none">
                            <span className="flex items-center gap-1 text-sky-800">📋 PMRF Consent</span>
                            <span className="text-sky-700 font-mono font-black">{pmrfPercent}% ({p.pmrfCount}/{p.householdCount})</span>
                          </div>
                          <div className="relative w-full h-3.5 bg-slate-100 rounded-full border border-slate-300/60 p-[1px] shadow-[inset_0_3px_5px_rgba(0,0,0,0.12),_inset_0_-1px_3px_rgba(255,255,255,0.7),_0_0.5px_0.5px_rgba(255,255,255,0.3)] overflow-hidden">
                            {/* Inner progress fill with 3D volumetric glass styling */}
                            <div 
                              style={{ 
                                width: `${pmrfPercent}%`,
                                background: `linear-gradient(to bottom, #7dd3fc 0%, #38bdf8 20%, #0284c7 60%, #0369a1 100%)`
                              }}
                              className="h-full rounded-full transition-all duration-1000 relative shadow-[0_1.5px_3px_rgba(2,132,199,0.35),_inset_0_-1.5px_2px_rgba(0,0,0,0.3),_inset_0_1.5px_2px_rgba(255,255,255,0.4)] overflow-hidden"
                            >
                              {/* Shiny reflection ribbon */}
                              <div className="absolute inset-x-0 top-[1px] h-[35%] bg-white/40 rounded-t-full"></div>
                              {/* Glass sweep light ray animation */}
                              <div className="absolute inset-y-0 w-8 bg-gradient-to-r from-transparent via-white/15 to-transparent -skew-x-20 animate-pulse"></div>
                            </div>
                          </div>
                        </div>

                        {/* Yakap Progress */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[9px] font-extrabold uppercase tracking-wider leading-none">
                            <span className="flex items-center gap-1 text-emerald-800">🛡️ Yakap Consent</span>
                            <span className="text-emerald-700 font-mono font-black">{yakapPercent}% ({p.yakapWillingCount}/{p.householdCount})</span>
                          </div>
                          <div className="relative w-full h-3.5 bg-slate-100 rounded-full border border-slate-300/60 p-[1px] shadow-[inset_0_3px_5px_rgba(0,0,0,0.12),_inset_0_-1px_3px_rgba(255,255,255,0.7),_0_0.5px_0.5px_rgba(255,255,255,0.3)] overflow-hidden">
                            {/* Inner progress fill with 3D volumetric glass styling */}
                            <div 
                              style={{ 
                                width: `${yakapPercent}%`,
                                background: `linear-gradient(to bottom, #6ee7b7 0%, #34d399 20%, #059669 60%, #047857 100%)`
                              }}
                              className="h-full rounded-full transition-all duration-1000 relative shadow-[0_1.5px_3px_rgba(5,150,105,0.35),_inset_0_-1.5px_2px_rgba(0,0,0,0.3),_inset_0_1.5px_2px_rgba(255,255,255,0.4)] overflow-hidden"
                            >
                              {/* Shiny reflection ribbon */}
                              <div className="absolute inset-x-0 top-[1px] h-[35%] bg-white/40 rounded-t-full"></div>
                              {/* Glass sweep light ray animation */}
                              <div className="absolute inset-y-0 w-8 bg-gradient-to-r from-transparent via-white/15 to-transparent -skew-x-20 animate-pulse"></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Purok Pagination Control Bar */}
              {totalPurokPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-100 shadow-sm">
                  <span className="text-[10px] font-medium text-slate-500">
                    Showing <span className="font-bold text-slate-800">{Math.min(filteredPuroks.length, (activePurokPage - 1) * purokPageSize + 1)}-{Math.min(filteredPuroks.length, activePurokPage * purokPageSize)}</span> of <span className="font-bold text-slate-800">{filteredPuroks.length}</span> Purok Sectors
                  </span>
                  
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={activePurokPage === 1}
                      onClick={() => setPurokPage(prev => Math.max(1, prev - 1))}
                      className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition text-slate-500 disabled:opacity-40 disabled:cursor-not-allowed hover:text-slate-850 cursor-pointer"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>

                    {Array.from({ length: totalPurokPages }).map((_, i) => {
                      const pageNum = i + 1;
                      const isCurrent = pageNum === activePurokPage;
                      return (
                        <button
                          key={pageNum}
                          type="button"
                          onClick={() => setPurokPage(pageNum)}
                          className={`min-w-7 h-7 flex items-center justify-center text-[10px] font-black rounded-lg border transition cursor-pointer ${
                            isCurrent 
                              ? 'bg-blue-600 font-extrabold border-blue-600 text-white shadow-xs' 
                              : 'border-slate-200 text-slate-500 hover:text-slate-850 hover:bg-slate-50 bg-white'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}

                    <button
                      type="button"
                      disabled={activePurokPage === totalPurokPages}
                      onClick={() => setPurokPage(prev => Math.min(totalPurokPages, prev + 1))}
                      className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition text-slate-500 disabled:opacity-40 disabled:cursor-not-allowed hover:text-slate-850 cursor-pointer"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* MODULE 3: HOUSEHOLDS APPROVAL QUEUE */}
      {tabType === 'approvals' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-1.5 leading-none">
                <ShieldAlert className="h-5 w-5 text-amber-600 animate-pulse" />
                Household Verification Queue
              </h2>
              <p className="text-slate-400 text-[10px] mt-1">Authorized personnel (Admin, HR, IT) evaluates and approves submissions</p>
            </div>
            <button 
              onClick={fetchRequiredData} 
              className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
            >
              <RefreshCw className="h-4 w-4 text-slate-500" />
            </button>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-solid border-blue-600 border-r-transparent"></div>
            </div>
          ) : (() => {
            const isMasterAdmin = currentUser && (
              (currentUser.email && (
                currentUser.email.toLowerCase() === 'elthrone1233@gmail.com' ||
                currentUser.email.toLowerCase() === 'saintfrancisclinic2026@gmail.com'
              )) ||
              hasRole(currentUser, ['ADMIN', 'MANAGER', 'HR', 'IT'])
            );

            const isRealMasterAdmin = currentUser && (
              currentUser.email && (
                currentUser.email.toLowerCase() === 'elthrone1233@gmail.com' ||
                currentUser.email.toLowerCase() === 'saintfrancisclinic2026@gmail.com'
              )
            );

            // Fetch list of permitted households
            const totalPermitted = approvalsQueue.filter(h => {
              if (isMasterAdmin) return true;
              if (!currentUser.address) return true;
              return h.barangay && h.barangay.trim().toLowerCase() === currentUser.address.trim().toLowerCase();
            });

            const pendingCount = totalPermitted.filter(h => {
              const s = (h.approvalStatus || h.status || 'Pending').toLowerCase().trim();
              return s === 'pending';
            }).length;
            const approvedCount = totalPermitted.filter(h => {
              const s = (h.approvalStatus || h.status || '').toLowerCase().trim();
              return s === 'approved';
            }).length;
            const disapprovedCount = totalPermitted.filter(h => {
              const s = (h.approvalStatus || h.status || '').toLowerCase().trim();
              return s === 'disapproved';
            }).length;
            const allCount = totalPermitted.length;

            // Apply selected status filter to permitted households to get the lists to show matching entries
            const routedApprovals = totalPermitted.filter(h => {
              const statusStr = (h.approvalStatus || h.status || 'Pending').toLowerCase().trim();
              if (selectedApprovalStatusFilter !== 'All') {
                if (selectedApprovalStatusFilter === 'Pending' && statusStr !== 'pending') return false;
                if (selectedApprovalStatusFilter === 'Approved' && statusStr !== 'approved') return false;
                if (selectedApprovalStatusFilter === 'Disapproved' && statusStr !== 'disapproved') return false;
              }
              return true;
            });

            // Auto-create folder directories based on groups' assignedBarangays, existing registered barangays, and active approvals
            const rawFolders = Array.from(new Set([
              ...allGroups.flatMap(g => (g.assignedBarangays || []).map(b => b.trim().toUpperCase())),
              ...barangays.map(b => b.name.trim().toUpperCase()),
              ...approvalsQueue.map(h => (h.barangay || '').trim().toUpperCase()).filter(Boolean)
            ])).filter(Boolean);

            const foldersToRender = rawFolders.filter(bName => {
              if (isMasterAdmin) return true;
              if (!currentUser.address) return true;
              return bName.trim().toLowerCase() === currentUser.address.trim().toLowerCase();
            }).sort((a, b) => a.localeCompare(b));

            return (
              <div className="space-y-6">
                {/* ADVANCED STATUS DASHBOARD FILTER TABS */}
                <div className="bg-slate-100/85 p-1.5 rounded-xl border border-slate-200/60 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedApprovalStatusFilter('Pending');
                      setSelectedApprovalFolder(null); // safely reset folder selection when toggling filters to ensure fresh folder list
                    }}
                    className={`flex-1 min-w-[120px] text-center py-2 px-3 rounded-lg text-xs font-black uppercase tracking-wider transition cursor-pointer ${
                      selectedApprovalStatusFilter === 'Pending'
                        ? 'bg-amber-500 text-white shadow-sm font-extrabold'
                        : 'bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    ⏳ Pending ({pendingCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedApprovalStatusFilter('Approved');
                      setSelectedApprovalFolder(null);
                    }}
                    className={`flex-1 min-w-[120px] text-center py-2 px-3 rounded-lg text-xs font-black uppercase tracking-wider transition cursor-pointer ${
                      selectedApprovalStatusFilter === 'Approved'
                        ? 'bg-emerald-600 text-white shadow-sm font-extrabold'
                        : 'bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    ✅ Approved ({approvedCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedApprovalStatusFilter('Disapproved');
                      setSelectedApprovalFolder(null);
                    }}
                    className={`flex-1 min-w-[120px] text-center py-2 px-3 rounded-lg text-xs font-black uppercase tracking-wider transition cursor-pointer ${
                      selectedApprovalStatusFilter === 'Disapproved'
                        ? 'bg-rose-600 text-white shadow-sm font-extrabold'
                        : 'bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    ❌ Returned ({disapprovedCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedApprovalStatusFilter('All');
                      setSelectedApprovalFolder(null);
                    }}
                    className={`flex-1 min-w-[120px] text-center py-2 px-3 rounded-lg text-xs font-black uppercase tracking-wider transition cursor-pointer ${
                      selectedApprovalStatusFilter === 'All'
                        ? 'bg-slate-800 text-white shadow-sm font-extrabold'
                        : 'bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    📂 All ({allCount})
                  </button>
                </div>

                {/* Barangay-based folder directory view */}
                {!selectedApprovalFolder ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Select Barangay Folder to View {selectedApprovalStatusFilter} Submissions:
                      </span>
                      <span className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-100 rounded-full px-2 py-0.5 animate-pulse">
                        Auto-generated directories base on Leader barangays
                      </span>
                    </div>

                    {foldersToRender.length === 0 ? (
                      <div className="text-center p-12 bg-white rounded-xl border border-slate-100 text-slate-400">
                        No barangay folders matching permissions or leader group configurations!
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {foldersToRender.map((bName) => {
                          const count = routedApprovals.filter(h => h.barangay && h.barangay.toUpperCase() === bName.toUpperCase()).length;
                          const pendingForThisBarangay = totalPermitted.filter(h => h.barangay && h.barangay.toUpperCase() === bName.toUpperCase() && (h.approvalStatus || 'Pending') === 'Pending').length;

                          const storedSeenCount = Number(localStorage.getItem(`seen_pending_count_${bName}`) || '0');
                          const isNewSubmission = selectedApprovalStatusFilter === 'Pending' && pendingForThisBarangay > 0 && pendingForThisBarangay > storedSeenCount;

                          return (
                            <button
                              key={bName}
                              type="button"
                              onClick={() => {
                                setSelectedApprovalFolder(bName);
                                localStorage.setItem(`seen_pending_count_${bName}`, String(pendingForThisBarangay));
                              }}
                              className="flex items-start gap-4 bg-white p-5 rounded-2xl border-2 border-slate-100 hover:border-blue-500 hover:shadow-md transition text-left group cursor-pointer shadow-xs relative"
                            >
                              {isNewSubmission && (
                                <span className="absolute -top-2.5 -right-2 bg-rose-500 text-white text-[8px] font-black tracking-wider px-2 py-0.5 rounded-full shadow-md animate-bounce select-none flex items-center gap-1 z-10 border border-rose-300">
                                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping"></span>
                                  NEW SUBMISSION
                                </span>
                              )}
                              {selectedApprovalStatusFilter === 'Approved' && count > 0 && (
                                <span className="absolute -top-2.5 -right-2 bg-emerald-600 text-white text-[8px] font-black tracking-wider px-2 py-0.5 rounded-full shadow-md select-none flex items-center gap-1 z-10 border border-emerald-400">
                                  <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
                                  APPROVED: {count}
                                </span>
                              )}
                              {selectedApprovalStatusFilter === 'Disapproved' && count > 0 && (
                                <span className="absolute -top-2.5 -right-2 bg-rose-600 text-white text-[8px] font-black tracking-wider px-2 py-0.5 rounded-full shadow-md select-none flex items-center gap-1 z-10 border border-rose-450">
                                  <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
                                  RETURN: {count}
                                </span>
                              )}
                              <div className="p-3 bg-blue-50 rounded-xl text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition shrink-0 relative">
                                <Folder className="h-6 w-6" />
                                {isNewSubmission && (
                                  <span className="absolute top-1 right-1 flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-450 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                                  </span>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <h4 className="font-extrabold text-slate-800 group-hover:text-blue-600 transition truncate uppercase text-sm leading-tight">
                                  {bName}
                                </h4>
                                <div className="space-y-1 mt-1.5">
                                  <span className="text-[9.5px] text-slate-400 font-bold block bg-slate-50 px-2 py-0.5 rounded border border-slate-100/80 w-fit">
                                    {count} {selectedApprovalStatusFilter} record{count !== 1 ? 's' : ''}
                                  </span>
                                  {pendingForThisBarangay > 0 && selectedApprovalStatusFilter !== 'Pending' && (
                                    <span className="text-[9px] text-amber-600 font-bold block animate-bounce">
                                      ⚠️ {pendingForThisBarangay} pending evaluation!
                                    </span>
                                  )}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Folder path and back indicator and summary */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-slate-50 border p-3 rounded-xl col-span-full">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedApprovalFolder(null)}
                          className="flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg text-[10.5px] font-bold cursor-pointer transition shadow-xs active:translate-y-0.5"
                        >
                          📁 Back to Folders
                        </button>
                        <span className="text-slate-300 font-bold">/</span>
                        <span className="text-[11px] font-black text-blue-800 uppercase bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-lg">
                          {selectedApprovalFolder} Collection
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">
                          ({selectedApprovalStatusFilter})
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 font-extrabold bg-white border px-2 py-0.5 rounded">
                        Interactive List ( {routedApprovals.filter(h => h.barangay && h.barangay.toUpperCase() === selectedApprovalFolder.toUpperCase()).length} files matched )
                      </span>
                    </div>

                    <div className="space-y-4">
                      {routedApprovals.filter(h => h.barangay && h.barangay.toUpperCase() === selectedApprovalFolder.toUpperCase()).length === 0 ? (
                        <div className="p-8 text-center bg-white rounded-2xl border-2 border-dashed border-slate-200 text-slate-400">
                          <p className="font-bold text-slate-600 text-xs uppercase tracking-wider">
                            No submissions folder matched with "{selectedApprovalStatusFilter}" criteria!
                          </p>
                          <button
                            type="button"
                            onClick={() => setSelectedApprovalFolder(null)}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 px-3 rounded-lg text-[10.5px] mt-3 transition active:scale-95 cursor-pointer inline-block"
                          >
                            Return to Folder List
                          </button>
                        </div>
                      ) : (
                        routedApprovals
                          .filter(h => h.barangay && h.barangay.toUpperCase() === selectedApprovalFolder.toUpperCase())
                          .map((h) => {
                          // Safely gather PMRF fields
                          let details: any = h.pmrfDetails || {};
                          if (typeof details === 'string') {
                            try {
                              details = JSON.parse(details);
                            } catch (e) {
                              details = {};
                            }
                          }
                          // Explicit merge of dependents if they're available on h.dependents directly
                          if ((!details.dependents || details.dependents.length === 0) && h.dependents) {
                            details.dependents = h.dependents;
                          }
                          const hasAttachment = h.attachments && h.attachments.length > 0;
                          const isExpanded = expandedHHId === h.id;

                          const isDependent = h.isFpePcsfOnly && (h.pcsfDetails?.type === 'DEPENDENT' || h.pcsfType === 'DEPENDENT');
                          const memberType = isDependent ? 'Dependent' : 'Member';

                          return (
                    <div 
                      key={h.id} 
                      className={`border-2 rounded-2xl bg-white transition-all duration-150 overflow-hidden ${
                        isExpanded ? 'border-slate-900 shadow-md' : 'border-slate-200 hover:border-blue-400 hover:shadow-md'
                      }`}
                    >
                      {/* Interactive List View Header Row */}
                      <div 
                        onClick={() => setExpandedHHId(isExpanded ? null : h.id)}
                        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 cursor-pointer select-none transition-all duration-150 ${
                          isExpanded ? 'bg-slate-900 text-white' : 'bg-white hover:bg-slate-50 text-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl">🏡</span>
                          <div>
                            <h3 className={`font-black text-sm uppercase tracking-wide leading-tight ${isExpanded ? 'text-white' : 'text-slate-950'}`}>
                              {h.householdHead}
                            </h3>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              <span className={`font-mono text-[8.5px] px-1.5 py-0.5 rounded font-extrabold border ${
                                isExpanded ? 'bg-blue-900/40 text-blue-300 border-blue-500/20' : 'bg-blue-50 text-blue-800 border-blue-100'
                              }`}>
                                {h.householdNumber}
                              </span>
                              <span className="text-[9.5px] font-bold text-slate-400">
                                Submitted: {h.createdAt ? new Date(h.createdAt).toLocaleDateString() : 'N/A'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5">
                          {/* Forms (Define it if PMRF or FPE/PCSF) Badge */}
                          <span className={`px-2.5 py-1 text-[9.5px] font-black uppercase tracking-wider rounded-lg border leading-none block ${
                            h.isFpePcsfOnly 
                              ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30 dark:text-emerald-400' 
                              : 'bg-blue-500/15 text-blue-600 border-blue-500/30 dark:text-blue-400'
                          }`}>
                            📝 {h.isFpePcsfOnly ? 'FPE/PCSF' : 'PMRF'}
                          </span>

                          {hasAttachment ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600/10 text-emerald-400 border border-emerald-500/25 font-bold uppercase text-[9px] rounded-lg leading-none block">
                              📎 {h.attachments.length} ID Proofs
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-650/10 text-rose-455 text-rose-400 border border-rose-500/25 font-bold uppercase text-[9px] rounded-lg leading-none block animate-pulse">
                              ⚠️ NO ATTACHMENTS
                            </span>
                          )}

                          {h.approvalStatus === 'Approved' ? (
                            <span className="px-2.5 py-1 bg-emerald-500 text-white font-extrabold font-mono uppercase tracking-wider text-[8.5px] rounded-full shadow-xs leading-none block">
                              Approved
                            </span>
                          ) : h.approvalStatus === 'Disapproved' ? (
                            <span className="px-2.5 py-1 bg-rose-600 text-white font-extrabold font-mono uppercase tracking-wider text-[8.5px] rounded-full shadow-xs leading-none block">
                              Recalled
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 bg-amber-500 text-white font-extrabold font-mono uppercase tracking-wider text-[8.5px] rounded-full shadow-xs leading-none block animate-pulse">
                              Pending Review
                            </span>
                          )}
                          
                          <span className={`transition-transform duration-200 ${isExpanded ? 'rotate-180 text-white' : 'text-slate-400'}`}>
                            <ChevronDown className="h-5 w-5" />
                          </span>
                        </div>
                      </div>

                      {/* Dropdown collapsible details container */}
                      {isExpanded && (
                        <div className="p-5 bg-white border-t border-slate-100 space-y-5 animate-slide-up">
                          {/* Standard details block */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-slate-500 bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                            <div>Address Sub: <strong className="text-slate-800 block text-[11px]">{h.barangay}</strong></div>
                            <div>Contact Line: <strong className="text-slate-850 block text-[11px] font-mono">{h.contactNumber || 'N/A'}</strong></div>
                            <div>Created By: <strong className="text-slate-750 block text-[11px]">{h.createdBy}</strong></div>
                            <div>GPS Geotag Index: <strong className="text-slate-800 block font-mono text-[11px]">{h.latitude.toFixed(6)}, {h.longitude.toFixed(6)}</strong></div>
                          </div>

                          {/* THE FULL PMRF DETAILED SHEET DISPLAY */}
                          {(() => {
                            const activeTab = approvalTabMap[h.id] || (h.isFpePcsfOnly ? 'FPE' : 'PMRF');
                            const fpe = h.fpeDetails || {};
                            const pcsf = h.pcsfDetails || {};

                            return (
                              <div className="border border-slate-350 rounded-xl bg-slate-50 p-3 md:p-5 space-y-4 max-h-[70vh] overflow-y-auto animate-fade-in text-[11px] w-full">
                                
                                {/* MULTI-DOCUMENT CLINICAL TAB SWITCHER HEADER */}
                                <div className="flex border-b border-slate-200 pb-2 overflow-x-auto scrollbar-hide gap-1 md:gap-2">
                                  {!h.isFpePcsfOnly && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => setApprovalTabMap({ ...approvalTabMap, [h.id]: 'PMRF' })}
                                        className={`px-2.5 md:px-4 py-2 text-[10px] md:text-[11px] font-extrabold transition duration-155 border-b-2 leading-none uppercase tracking-wider whitespace-nowrap ${
                                          activeTab === 'PMRF'
                                            ? 'border-blue-600 text-blue-600'
                                            : 'border-transparent text-slate-400 hover:text-slate-600'
                                        }`}
                                      >
                                        📋 PMRF Front
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setApprovalTabMap({ ...approvalTabMap, [h.id]: 'PMRF_BACK' })}
                                        className={`px-2.5 md:px-4 py-2 text-[10px] md:text-[11px] font-extrabold transition duration-155 border-b-2 leading-none uppercase tracking-wider whitespace-nowrap ${
                                          activeTab === 'PMRF_BACK'
                                            ? 'border-blue-600 text-blue-600'
                                            : 'border-transparent text-slate-400 hover:text-slate-600'
                                        }`}
                                      >
                                        📋 PMRF Back
                                      </button>
                                    </>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => setApprovalTabMap({ ...approvalTabMap, [h.id]: 'FPE' })}
                                    className={`px-2.5 md:px-4 py-2 text-[10px] md:text-[11px] font-extrabold transition duration-155 border-b-2 leading-none uppercase tracking-wider whitespace-nowrap ${
                                      activeTab === 'FPE'
                                        ? 'border-blue-600 text-blue-600'
                                        : 'border-transparent text-slate-400 hover:text-slate-600'
                                    }`}
                                  >
                                    🩺 Patient clinical Encounter (FPE)
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setApprovalTabMap({ ...approvalTabMap, [h.id]: 'PCSF' })}
                                    className={`px-2.5 md:px-4 py-2 text-[10px] md:text-[11px] font-extrabold transition duration-155 border-b-2 leading-none uppercase tracking-wider whitespace-nowrap ${
                                      activeTab === 'PCSF'
                                        ? 'border-blue-600 text-blue-600'
                                        : 'border-transparent text-slate-400 hover:text-slate-600'
                                    }`}
                                  >
                                    🏢 Primary Provider (PCSF)
                                  </button>
                            </div>

                            {activeTab === 'PMRF' ? (
                              <div className="space-y-4 animate-fade-in w-full overflow-x-auto pb-4">
                                <div className="min-w-[850px] space-y-4">
                          
                           {/* PMRF Header - Redesigned to strictly match the reference image */}
                           <div className="border-[2px] border-black bg-white grid grid-cols-1 md:grid-cols-12 text-black font-sans leading-tight overflow-hidden rounded-lg mb-4 select-none">
                             
                             {/* Left Section: Logo & Reminders */}
                             <div className="md:col-span-6 p-4 flex flex-col border-b md:border-b-0 md:border-r border-black justify-between bg-white text-black text-left">
                               <div className="flex items-center gap-3">
                                 <PhilHealthLogo className="h-12 w-12 shrink-0 animate-pulse bg-emerald-50 p-1.5 rounded-lg border border-emerald-200" />
                                 <div className="flex flex-col text-left">
                                   <div className="flex items-baseline leading-none">
                                     <span className="text-[25px] font-black tracking-tighter text-[#1f2937]" style={{ fontFamily: "Inter, sans-serif" }}>Phil</span>
                                     <span className="text-[25px] font-extrabold tracking-tighter text-[#111827]" style={{ fontFamily: "Georgia, serif" }}>Health</span>
                                   </div>
                                   <span className="text-[9px] font-bold text-slate-800 italic mt-0.5 pl-0.5 block leading-none" style={{ fontFamily: "Georgia, serif" }}>
                                     Your Partner in Health
                                   </span>
                                 </div>
                               </div>

                               <div className="border-t border-black my-2.5"></div>

                               <div className="flex flex-col text-black text-left">
                                 <span className="text-[9.5px] font-black underline tracking-wide mb-1.5 uppercase leading-none block text-left">
                                   REMINDERS:
                                 </span>
                                 <ol className="list-decimal list-outside pl-4 space-y-1 text-[7.5px] font-bold text-justify tracking-tight leading-normal uppercase">
                                   <li>Your PhilHealth Identification Number (PIN) is your unique and permanent number.</li>
                                   <li>Always use your PIN in all transactions with PhilHealth.</li>
                                   <li>For Updating/Amendment check the appropriate box and provide details to be accomplished and submit corresponding supporting documents.</li>
                                   <li>Please read instructions at the back before filling-out this form.</li>
                                 </ol>
                               </div>
                             </div>

                             {/* Right Section: Form titles, PIN, Purpose & Preferred Provider */}
                             <div className="md:col-span-6 p-4 flex flex-col justify-between space-y-4 bg-white text-black text-left">
                               <div className="text-center flex flex-col space-y-1">
                                 <h2 className="text-[24px] font-black tracking-tighter leading-none text-black uppercase" style={{ fontFamily: "Inter, sans-serif" }}>PMRF</h2>
                                 <p className="text-[9px] font-black tracking-tight text-black leading-none uppercase">
                                   PHILHEALTH MEMBER REGISTRATION FORM
                                 </p>
                                 <span className="text-[8.5px] font-bold text-black leading-none uppercase">
                                   UHC v.1 January 2020
                                 </span>
                               </div>

                               {/* Segmented PIN Field (4, 4, 4 grid) */}
                               <div className="flex flex-col items-center select-none">
                                 <div className="flex items-center gap-1.5">
                                   {/* Segment 1: 4 digits */}
                                   <div className="flex border border-black divide-x divide-black h-7 bg-white">
                                     {Array.from({ length: 4 }).map((_, idx) => {
                                       const pinTrimmed = (details.pin || '').replace(/\D/g, '');
                                       const pinPadded = pinTrimmed.padEnd(12, ' ');
                                       const char = pinPadded[idx] || '';
                                       return (
                                         <div
                                           key={idx}
                                           className="w-[20px] h-full flex items-center justify-center font-mono font-black text-xs text-black bg-white select-none"
                                         >
                                           {char.trim()}
                                         </div>
                                       );
                                     })}
                                   </div>

                                   {/* Separator block space */}
                                   <div className="w-[1px]"></div>

                                   {/* Segment 2: 4 digits */}
                                   <div className="flex border border-black divide-x divide-black h-7 bg-white">
                                     {Array.from({ length: 4 }).map((_, idx) => {
                                       const pinTrimmed = (details.pin || '').replace(/\D/g, '');
                                       const pinPadded = pinTrimmed.padEnd(12, ' ');
                                       const char = pinPadded[idx + 4] || '';
                                       return (
                                         <div
                                           key={idx}
                                           className="w-[20px] h-full flex items-center justify-center font-mono font-black text-xs text-black bg-white select-none"
                                         >
                                           {char.trim()}
                                         </div>
                                       );
                                     })}
                                   </div>

                                   {/* Separator block space */}
                                   <div className="w-[1px]"></div>

                                   {/* Segment 3: 4 digits */}
                                   <div className="flex border border-black divide-x divide-black h-7 bg-white">
                                     {Array.from({ length: 4 }).map((_, idx) => {
                                       const pinTrimmed = (details.pin || '').replace(/\D/g, '');
                                       const pinPadded = pinTrimmed.padEnd(12, ' ');
                                       const char = pinPadded[idx + 8] || '';
                                       return (
                                         <div
                                           key={idx}
                                           className="w-[20px] h-full flex items-center justify-center font-mono font-black text-xs text-black bg-white select-none"
                                         >
                                           {char.trim()}
                                         </div>
                                       );
                                     })}
                                   </div>
                                 </div>
                                 <span className="text-[8px] font-black text-black tracking-tight mt-1 ml-0.5 uppercase select-none block text-center">
                                   PHILHEALTH IDENTIFICATION NUMBER (PIN)
                                 </span>
                               </div>

                               {/* PURPOSE Block */}
                               <div className="grid grid-cols-12 gap-1 items-center bg-white">
                                 <span className="col-span-3 text-[9px] font-black text-black uppercase select-none text-left">
                                   PURPOSE:
                                 </span>
                                 <div className="col-span-9 flex items-center gap-6">
                                   <label className="flex items-center gap-1.5 font-bold text-[8.5px] text-black cursor-pointer uppercase select-none">
                                     <input 
                                       type="checkbox" 
                                       readOnly
                                       checked={!details.purpose || details.purpose.toUpperCase() === 'REGISTRATION'}
                                       className="h-3.5 w-3.5 text-black border-black focus:ring-0 accent-black pointer-events-none"
                                     />
                                     <span>REGISTRATION</span>
                                   </label>
                                   <label className="flex items-center gap-1.5 font-bold text-[8.5px] text-black cursor-pointer uppercase select-none">
                                     <input 
                                        type="checkbox" 
                                        readOnly
                                        checked={!!details.purpose && details.purpose.toUpperCase() !== 'REGISTRATION'}
                                        className="h-3.5 w-3.5 text-black border-black focus:ring-0 accent-black pointer-events-none"
                                     />
                                     <span>UPDATING/AMENDMENT</span>
                                   </label>
                                 </div>
                               </div>

                               {/* Preferred KonSuTa Provider */}
                               <div className="flex flex-col space-y-1 bg-white text-left">
                                 <span className="text-[8.5px] font-black text-black uppercase select-none text-left">
                                   Preferred KonSuTa Provider
                                 </span>
                                 <div className="border border-black bg-white px-2.5 py-1 text-[9.5px] font-black text-black uppercase min-h-[25px] flex items-center">
                                   {details.konsulta || 'SAINT FRANCIS CLINIC'}
                                 </div>
                               </div>

                             </div>
                           </div>

                          {/* I. Personal Details Sheet Block - Redesigned to strictly match the reference image */}
                          <div className="space-y-1">
                            {/* Section I Header closely matches the image */}
                            <div className="bg-[#dee5db] border-t border-x border-black text-black font-extrabold px-3 py-1 text-[11px] tracking-wider block select-none text-center uppercase font-sans border-b">
                              I. PERSONAL DETAILS
                            </div>

                            {/* Table grid (MEMBER, MOTHER'S MAIDEN, SPOUSE) */}
                            <div className="overflow-x-auto border-x border-b border-black bg-white select-none">
                              <table className="w-full border-collapse text-[9px] font-sans table-fixed min-w-[700px]">
                                <thead>
                                  <tr className="bg-white border-b border-black text-center select-none h-8 text-[7.5px] font-black pointer-events-none">
                                    <th className="border-r border-black w-[13%]"></th>
                                    <th className="border-r border-black w-[20%] font-black uppercase tracking-tight">LAST NAME</th>
                                    <th className="border-r border-black w-[22%] font-black uppercase tracking-tight">FIRST NAME</th>
                                    <th className="border-r border-black w-[11%] font-black tracking-tight leading-none text-center text-[7.2px]">
                                      NAME<br/>EXTENSION<br/>(Jr./Sr./III)
                                    </th>
                                    <th className="border-r border-black w-[20%] font-black uppercase tracking-tight">MIDDLE NAME</th>
                                    <th className="border-r border-black w-[7%] font-black tracking-tight leading-tight text-center text-[6.5px]">
                                      NO<br/>MIDDLE<br/>NAME
                                    </th>
                                    <th className="w-[7%] font-black tracking-tight leading-none text-center text-[6.5px]">
                                      MONONYM
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {/* MEMBER ROW */}
                                  <tr className="border-b border-black h-9">
                                    <td className="border-r border-black px-2 font-black text-[9px] text-black bg-white text-left uppercase leading-none select-none">
                                      MEMBER
                                    </td>
                                    <td className="border-r border-black p-1 text-[10px] font-bold uppercase text-black bg-white">
                                      {details.lastName || h.householdHead.split(',')[0]}
                                    </td>
                                    <td className="border-r border-black p-1 text-[10px] font-bold uppercase text-black bg-white">
                                      {details.firstName || h.householdHead.split(',')[1] || h.householdHead}
                                    </td>
                                    <td className="border-r border-black p-1 text-[10px] font-bold uppercase text-center text-black bg-white">
                                      {details.nameExt || ''}
                                    </td>
                                    <td className="border-r border-black p-1 text-[10px] font-bold uppercase text-black bg-white">
                                      {details.middleName || ''}
                                    </td>
                                    <td className="border-r border-black bg-white text-center p-1 relative">
                                      <div className="flex items-center justify-center h-full">
                                        <div className="flex items-center justify-center border border-black w-4 h-4 text-[9px] font-black bg-white text-black leading-none select-none">
                                          {(!details.middleName && (details.noMiddleName === true || details.noMiddleName === 'true' || details.pmrfNoMiddleName === true || details.pmrfNoMiddleName === 'true')) ? 'X' : ''}
                                        </div>
                                      </div>
                                    </td>
                                    <td className="bg-white text-center p-1 relative">
                                      <div className="flex items-center justify-center h-full">
                                        <div className="flex items-center justify-center border border-black w-4 h-4 text-[9px] font-black bg-white text-black leading-none select-none">
                                          {details.mononym === true || details.mononym === 'true' || details.pmrfMononym === true || details.pmrfMononym === 'true' ? 'X' : ''}
                                        </div>
                                      </div>
                                    </td>
                                  </tr>

                                  {/* MOTHER'S MAIDEN NAME ROW */}
                                  <tr className="border-b border-black h-9">
                                    <td className="border-r border-black px-2 font-black text-[7.5px] text-black bg-white text-left uppercase leading-tight select-none">
                                      MOTHER'S<br/>MAIDEN NAME
                                    </td>
                                    {(() => {
                                      const motherL = details.pmrfMotherLastName || details.motherLastName || (() => {
                                        if (details.motherMaiden && details.motherMaiden.includes(',')) {
                                          return details.motherMaiden.split(',')[0].trim();
                                        }
                                        return details.motherMaiden || '';
                                      })();
                                      const motherF = details.pmrfMotherFirstName || details.motherFirstName || (() => {
                                        if (details.motherMaiden && details.motherMaiden.includes(',')) {
                                          const rest = details.motherMaiden.split(',')[1] || '';
                                          return rest.trim().split(' ')[0] || '';
                                        }
                                        return '';
                                      })();
                                      const motherM = details.pmrfMotherMiddleName || details.motherMiddleName || (() => {
                                        if (details.motherMaiden) {
                                          if (details.motherMaiden.includes(',')) {
                                            const parts = details.motherMaiden.split(',');
                                            if (parts.length > 2) {
                                              return parts[2].trim();
                                            }
                                            const rest = parts[1] || '';
                                            const words = rest.trim().split(/\s+/);
                                            if (words.length > 1) {
                                              return words.slice(1).join(' ').trim();
                                            }
                                          } else {
                                            const words = details.motherMaiden.trim().split(/\s+/);
                                            if (words.length > 2) {
                                              return words.slice(2).join(' ').trim();
                                            }
                                          }
                                        }
                                        return '';
                                      })();
                                      const motherExt = details.pmrfMotherNameExt || details.motherNameExt || '';
                                      const motherNoMid = details.pmrfMotherNoMN || details.motherNoMN || details.pmrfMotherNoMiddleName || details.motherNoMiddleName || false;
                                      const motherMono = details.pmrfMotherMononym || details.motherMononym || false;

                                      return (
                                        <>
                                          <td className="border-r border-black p-1 text-[10px] font-bold uppercase text-black bg-white">
                                            {motherL}
                                          </td>
                                          <td className="border-r border-black p-1 text-[10px] font-bold uppercase text-black bg-white">
                                            {motherF}
                                          </td>
                                          <td className="border-r border-black p-1 text-[10px] font-bold uppercase text-center text-black bg-white">
                                            {motherExt}
                                          </td>
                                          <td className="border-r border-black p-1 text-[10px] font-bold uppercase text-black bg-white">
                                            {motherM}
                                          </td>
                                          <td className="border-r border-black bg-white text-center p-1 relative">
                                            <div className="flex items-center justify-center h-full">
                                              <div className="flex items-center justify-center border border-black w-4 h-4 text-[9px] font-black bg-white text-black leading-none select-none">
                                                {motherNoMid ? 'X' : ''}
                                              </div>
                                            </div>
                                          </td>
                                          <td className="bg-white text-center p-1 relative">
                                            <div className="flex items-center justify-center h-full">
                                              <div className="flex items-center justify-center border border-black w-4 h-4 text-[9px] font-black bg-white text-black leading-none select-none">
                                                {motherMono ? 'X' : ''}
                                              </div>
                                            </div>
                                          </td>
                                        </>
                                      );
                                    })()}
                                  </tr>

                                  {/* SPOUSE ROW */}
                                  <tr className="h-9">
                                    <td className="border-r border-black px-2 font-black text-[7.5px] text-black bg-white text-left uppercase leading-tight select-none">
                                      SPOUSE<br/><span className="text-[5.5px] font-bold text-slate-705 normal-case">(If married)</span>
                                    </td>
                                    {(() => {
                                      const spouseL = details.pmrfSpouseLastName || details.spouseLastName || (() => {
                                        if (details.spouseName && details.spouseName.includes(',')) {
                                          return details.spouseName.split(',')[0].trim();
                                        }
                                        return details.spouseName || '';
                                      })();
                                      const spouseF = details.pmrfSpouseFirstName || details.spouseFirstName || (() => {
                                        if (details.spouseName && details.spouseName.includes(',')) {
                                          const rest = details.spouseName.split(',')[1] || '';
                                          return rest.trim().split(' ')[0] || '';
                                        }
                                        return '';
                                      })();
                                      const spouseM = details.pmrfSpouseMiddleName || details.spouseMiddleName || (() => {
                                        if (details.spouseName) {
                                          if (details.spouseName.includes(',')) {
                                            const parts = details.spouseName.split(',');
                                            if (parts.length > 2) {
                                              return parts[2].trim();
                                            }
                                            const rest = parts[1] || '';
                                            const words = rest.trim().split(/\s+/);
                                            if (words.length > 1) {
                                              return words.slice(1).join(' ').trim();
                                            }
                                          } else {
                                            const words = details.spouseName.trim().split(/\s+/);
                                            if (words.length > 2) {
                                              return words.slice(2).join(' ').trim();
                                            }
                                          }
                                        }
                                        return '';
                                      })();
                                      const spouseExt = details.pmrfSpouseNameExt || details.spouseNameExt || '';
                                      const spouseNoMid = details.pmrfSpouseNoMN || details.spouseNoMN || details.pmrfSpouseNoMiddleName || details.spouseNoMiddleName || false;
                                      const spouseMono = details.pmrfSpouseMononym || details.spouseMononym || false;

                                      return (
                                        <>
                                          <td className="border-r border-black p-1 text-[10px] font-bold uppercase text-black bg-white">
                                            {spouseL}
                                          </td>
                                          <td className="border-r border-black p-1 text-[10px] font-bold uppercase text-black bg-white">
                                            {spouseF}
                                          </td>
                                          <td className="border-r border-black p-1 text-[10px] font-bold uppercase text-center text-black bg-white">
                                            {spouseExt}
                                          </td>
                                          <td className="border-r border-black p-1 text-[10px] font-bold uppercase text-black bg-white">
                                            {spouseM}
                                          </td>
                                          <td className="border-r border-black bg-white text-center p-1 relative">
                                            <div className="flex items-center justify-center h-full">
                                              <div className="flex items-center justify-center border border-black w-4 h-4 text-[9px] font-black bg-white text-black leading-none select-none">
                                                {spouseNoMid ? 'X' : ''}
                                              </div>
                                            </div>
                                          </td>
                                          <td className="bg-white text-center p-1 relative">
                                            <div className="flex items-center justify-center h-full">
                                              <div className="flex items-center justify-center border border-black w-4 h-4 text-[9px] font-black bg-white text-black leading-none select-none">
                                                {spouseMono ? 'X' : ''}
                                              </div>
                                            </div>
                                          </td>
                                        </>
                                      );
                                    })()}
                                  </tr>
                                </tbody>
                              </table>
                            </div>

                            {/* LOWER GRID: Date of birth, Place of Birth, Sex, Civil status, Citizenship, Philsys, TIN */}
                            <div className="grid grid-cols-1 md:grid-cols-12 border-x border-b border-black divide-y md:divide-y-0 md:divide-x divide-black bg-white text-black select-none leading-tight">
                              
                              {/* Left Segment (Col-span 3): DOB, Sex, Civil Status */}
                              <div className="col-span-12 md:col-span-3 flex flex-col justify-between divide-y divide-black bg-white text-left">
                                
                                {/* Date of Birth Group */}
                                <div className="p-2 flex-1">
                                  <span className="text-[7.5px] font-black text-black leading-none uppercase select-none block text-left">
                                    DATE OF BIRTH
                                  </span>
                                  
                                  {/* Segmented MM DD YYYY display boxes */}
                                  <div className="flex flex-col mt-1.5 items-start">
                                    <div className="flex gap-0.5 items-center">
                                      {(() => {
                                        const rawBirthDate = details.birthDate || '';
                                        let dobMM = '  ';
                                        let dobDD = '  ';
                                        let dobYYYY = '    ';
                                        if (rawBirthDate) {
                                          const parts = rawBirthDate.split('-');
                                          if (parts.length === 3 && parts[0].length === 4) {
                                            dobYYYY = parts[0];
                                            dobMM = parts[1];
                                            dobDD = parts[2];
                                          } else {
                                            const partsSlash = rawBirthDate.split('/');
                                            if (partsSlash.length === 3) {
                                              if (partsSlash[2].length === 4) {
                                                dobMM = partsSlash[0].padStart(2, '0');
                                                dobDD = partsSlash[1].padStart(2, '0');
                                                dobYYYY = partsSlash[2];
                                              } else {
                                                dobYYYY = partsSlash[0];
                                                dobMM = partsSlash[1];
                                                dobDD = partsSlash[2];
                                              }
                                            }
                                          }
                                        }
                                        const dobDigits = `${dobMM}${dobDD}${dobYYYY}`.padEnd(8, ' ').split('');
                                        
                                        return (
                                          <div className="flex border border-black bg-white divide-x divide-black h-5.5 select-none">
                                            {dobDigits.map((char, charIdx) => (
                                              <div
                                                key={charIdx}
                                                className="w-[14px] h-[20px] flex items-center justify-center font-mono font-black text-xs text-black"
                                              >
                                                {char.trim()}
                                              </div>
                                            ))}
                                          </div>
                                        );
                                      })()}
                                    </div>
                                    <div className="flex gap-0 text-[6.5px] font-black text-black tracking-tight mt-0.5 pl-0.5 select-none leading-none">
                                      <span className="w-[28px] text-center font-bold">m &nbsp; m</span>
                                      <span className="w-[30px] text-center font-bold">d &nbsp; d</span>
                                      <span className="w-[60px] text-center font-bold">y &nbsp; y &nbsp; y &nbsp; y</span>
                                    </div>
                                  </div>
                                </div>

                                {/* Sex & Civil Status Container (Side-by-side split inside left bottom box) */}
                                <div className="grid grid-cols-2 divide-x divide-black">
                                  {/* Sex Box */}
                                  <div className="p-2 flex flex-col justify-between">
                                    <span className="text-[7.5px] font-black text-black leading-none uppercase mb-1.5 select-none block text-left">
                                      SEX
                                    </span>
                                    {(() => {
                                      const sexVal = (details.sex || '').trim().toUpperCase();
                                      const isMale = sexVal === 'MALE' || sexVal === 'M';
                                      const isFemale = sexVal === 'FEMALE' || sexVal === 'F';
                                      return (
                                        <div className="flex flex-col gap-1.5">
                                          <label className="flex items-center gap-1.5 font-bold text-[7.5px] text-black cursor-pointer leading-none">
                                            <div className="flex items-center justify-center border border-black w-3.5 h-3.5 text-[8px] font-black bg-white text-black leading-none select-none">
                                              {isMale ? 'X' : ''}
                                            </div>
                                            <span>Male</span>
                                          </label>
                                          <label className="flex items-center gap-1.5 font-bold text-[7.5px] text-black cursor-pointer leading-none">
                                            <div className="flex items-center justify-center border border-black w-3.5 h-3.5 text-[8px] font-black bg-white text-black leading-none select-none">
                                              {isFemale ? 'X' : ''}
                                            </div>
                                            <span>Female</span>
                                          </label>
                                        </div>
                                      );
                                    })()}
                                  </div>

                                  {/* Civil Status Box */}
                                  <div className="p-2 flex flex-col justify-between text-left">
                                    <span className="text-[7.5px] font-black text-black leading-none uppercase mb-1.5 select-none block text-left">
                                      CIVIL STATUS
                                    </span>
                                    {(() => {
                                      const civilVal = (details.civilStatus || '').trim().toUpperCase();
                                      const isSingle = civilVal === 'SINGLE';
                                      const isMarried = civilVal === 'MARRIED';
                                      const isAnnulled = civilVal === 'ANNULLED';
                                      const isWidow = civilVal === 'WIDOWER' || civilVal === 'WIDOW' || civilVal === 'WIDOW/ER';
                                      const isLegSep = civilVal === 'LEGALLY_SEPARATED' || civilVal === 'LEGALLY SEPARATED' || civilVal === 'SEPARATED';
                                      
                                      return (
                                        <div className="flex flex-col gap-1 text-[7px]">
                                          <label className="flex items-center gap-1 font-bold text-black cursor-pointer leading-none">
                                            <div className="flex items-center justify-center border border-black w-3 h-3 text-[7.5px] font-black bg-white text-black leading-none select-none">
                                              {isSingle ? 'X' : ''}
                                            </div>
                                            <span>Single</span>
                                          </label>
                                          <label className="flex items-center gap-1 font-bold text-black cursor-pointer leading-none">
                                            <div className="flex items-center justify-center border border-black w-3 h-3 text-[7.5px] font-black bg-white text-black leading-none select-none">
                                              {isMarried ? 'X' : ''}
                                            </div>
                                            <span>Married</span>
                                          </label>
                                          <label className="flex items-center gap-1 font-bold text-black cursor-pointer leading-none font-bold">
                                            <div className="flex items-center justify-center border border-black w-3 h-3 text-[7.5px] font-black bg-white text-black leading-none select-none">
                                              {isLegSep ? 'X' : ''}
                                            </div>
                                            <span>Legally Separated</span>
                                          </label>
                                          <label className="flex items-center gap-1 font-bold text-black cursor-pointer leading-none">
                                            <div className="flex items-center justify-center border border-black w-3 h-3 text-[7.5px] font-black bg-white text-black leading-none select-none">
                                              {isAnnulled ? 'X' : ''}
                                            </div>
                                            <span>Annulled</span>
                                          </label>
                                          <label className="flex items-center gap-1 font-bold text-black cursor-pointer leading-none">
                                            <div className="flex items-center justify-center border border-black w-3 h-3 text-[7.5px] font-black bg-white text-black leading-none select-none">
                                              {isWidow ? 'X' : ''}
                                            </div>
                                            <span>Widow/er</span>
                                          </label>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                </div>
                              </div>

                              {/* Middle Segment (Col-span 4): Place of Birth & Citizenship */}
                              <div className="col-span-12 md:col-span-4 flex flex-col justify-between divide-y divide-black bg-white text-left text-black">
                                
                                {/* Place of Birth */}
                                <div className="p-2 flex-1 flex flex-col justify-between min-h-[60px]">
                                  <div>
                                    <span className="text-[7.5px] font-black text-black uppercase leading-tight select-none block text-left">
                                      PLACE OF BIRTH <span className="text-[6.5px] font-bold normal-case text-slate-800">(City/Municipality/Province/Country)</span>
                                    </span>
                                    <span className="text-[5.5px] text-slate-600 font-bold normal-case leading-tight block text-left select-none">
                                      (Please indicate country if born outside the Philippines)
                                    </span>
                                  </div>
                                  <div className="text-[10px] font-black text-black uppercase mt-1 border-b border-dashed border-gray-400 pb-0.5 select-all">
                                    {details.birthPlace || 'N/A'}
                                  </div>
                                </div>

                                {/* Citizenship */}
                                <div className="p-2 flex-1 flex flex-col justify-center text-left">
                                  <span className="text-[7.5px] font-black text-black uppercase leading-none mb-1.5 select-none block text-left">
                                    CITIZENSHIP
                                  </span>
                                  {(() => {
                                    const citizenVal = (details.citizenship || '').trim().toUpperCase();
                                    const isFilipino = citizenVal === 'FILIPINO' || !citizenVal;
                                    const isDual = citizenVal === 'DUAL' || citizenVal === 'DUAL CITIZEN' || citizenVal === 'DUAL_CITIZEN';
                                    const isForeign = citizenVal === 'FOREIGN' || citizenVal === 'FOREIGN NATIONAL' || citizenVal === 'FOREIGN_NATIONAL';
                                    return (
                                      <div className="flex flex-col gap-1.5">
                                        <label className="flex items-center gap-1.5 font-bold text-[7.5px] text-black cursor-pointer leading-none">
                                          <div className="flex items-center justify-center border border-black w-3.5 h-3.5 text-[8px] font-black bg-white text-black leading-none select-none">
                                            {isFilipino ? 'X' : ''}
                                          </div>
                                          <span>FILIPINO</span>
                                        </label>
                                        <label className="flex items-center gap-1.5 font-bold text-[7.5px] text-black cursor-pointer leading-none font-bold">
                                          <div className="flex items-center justify-center border border-black w-3.5 h-3.5 text-[8px] font-black bg-white text-black leading-none select-none">
                                            {isDual ? 'X' : ''}
                                          </div>
                                          <span>DUAL CITIZEN</span>
                                        </label>
                                        <label className="flex items-center gap-1.5 font-bold text-[7.5px] text-black cursor-pointer leading-none">
                                          <div className="flex items-center justify-center border border-black w-3.5 h-3.5 text-[8px] font-black bg-white text-black leading-none select-none">
                                            {isForeign ? 'X' : ''}
                                          </div>
                                          <span>FOREIGN NATIONAL</span>
                                        </label>
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>

                              {/* Right Segment (Col-span 5): PhilSys card number & TIN */}
                              <div className="col-span-12 md:col-span-5 flex flex-col justify-between divide-y divide-black bg-white text-left text-black">
                                
                                {/* PhilSys D Number */}
                                <div className="p-2 flex-1 flex flex-col justify-center text-left">
                                  <span className="text-[7.5px] font-black text-black uppercase block leading-none mb-1.5 select-none text-left font-bold">
                                    PHILSYS D NUMBER (Optional)
                                  </span>
                                  {(() => {
                                    const rawPhilsys = (details.philsysNo || '').replace(/\D/g, '').padEnd(12, ' ');
                                    const philsysDigits = rawPhilsys.split('');
                                    
                                    return (
                                      <div className="flex border border-black bg-white divide-x divide-black h-5.5 select-none max-w-xs mt-1">
                                        {philsysDigits.map((char, charIdx) => (
                                          <div
                                            key={charIdx}
                                            className="w-[14px] h-[20px] flex items-center justify-center font-mono font-black text-xs text-black"
                                          >
                                            {char.trim()}
                                          </div>
                                        ))}
                                      </div>
                                    );
                                  })()}
                                </div>

                                {/* TIN */}
                                <div className="p-2 flex-1 flex flex-col justify-center text-left">
                                  <span className="text-[7.5px] font-black text-black uppercase block leading-none mb-1.5 select-none text-left font-bold">
                                    TAX PAYER IDENTIFICATION NUMBER (TIN) (Optional)
                                  </span>
                                  {(() => {
                                    const rawTin = (details.tin || '').replace(/\D/g, '').padEnd(12, ' ');
                                    const tinDigits = rawTin.split('');
                                    const group1 = tinDigits.slice(0, 3);
                                    const group2 = tinDigits.slice(3, 6);
                                    const group3 = tinDigits.slice(6, 9);
                                    const group4 = tinDigits.slice(9, 12);
                                    
                                    return (
                                      <div className="flex items-center gap-0.5 select-none mt-1">
                                        {/* Group 1 */}
                                        <div className="flex border border-black bg-white divide-x divide-black h-5.5">
                                          {group1.map((char, charIdx) => (
                                            <div key={charIdx} className="w-[14px] h-[20px] flex items-center justify-center font-mono font-black text-xs text-black">
                                              {char.trim()}
                                            </div>
                                          ))}
                                        </div>
                                        <span className="text-black font-black text-[9px] mx-0.5 select-none">-</span>
                                        
                                        {/* Group 2 */}
                                        <div className="flex border border-black bg-white divide-x divide-black h-5.5">
                                          {group2.map((char, charIdx) => (
                                            <div key={charIdx} className="w-[14px] h-[20px] flex items-center justify-center font-mono font-black text-xs text-black">
                                              {char.trim()}
                                            </div>
                                          ))}
                                        </div>
                                        <span className="text-black font-black text-[9px] mx-0.5 select-none">-</span>
                                        
                                        {/* Group 3 */}
                                        <div className="flex border border-black bg-white divide-x divide-black h-5.5">
                                          {group3.map((char, charIdx) => (
                                            <div key={charIdx} className="w-[14px] h-[20px] flex items-center justify-center font-mono font-black text-xs text-black">
                                              {char.trim()}
                                            </div>
                                          ))}
                                        </div>
                                        <span className="text-black font-black text-[9px] mx-0.5 select-none">-</span>
                                        
                                        {/* Group 4 */}
                                        <div className="flex border border-black bg-white divide-x divide-black h-5.5">
                                          {group4.map((char, charIdx) => (
                                            <div key={charIdx} className="w-[14px] h-[20px] flex items-center justify-center font-mono font-black text-xs text-black">
                                              {char.trim()}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>

                            </div>
                          </div>

                          {/* II. Address and Contact Details Block - Redesigned to strictly match the reference image */}
                          <div className="space-y-1">
                            {/* Section II Header */}
                            <div className="bg-[#dee5db] border-t border-x border-black text-black font-extrabold px-3 py-1 text-[11px] tracking-wider block select-none text-center uppercase font-sans border-b">
                              II. ADDRESS and CONTACT DETAILS
                            </div>

                            {/* Unified Address & Contact block */}
                            <div className="grid grid-cols-1 md:grid-cols-12 border-x border-b border-black divide-y md:divide-y-0 md:divide-x divide-black bg-white text-black font-sans text-left leading-tight overflow-hidden select-none">
                              
                              {/* Left Column (Col-span 8): Addresses */}
                              <div className="col-span-12 md:col-span-8 flex flex-col divide-y divide-black bg-white">
                                
                                {/* PERMANENT HOME ADDRESS Section */}
                                <div className="flex flex-col bg-white">
                                  {/* Header Label inside section */}
                                  <div className="px-2 py-1 bg-white">
                                    <span className="text-[8.5px] font-black text-black tracking-tight uppercase leading-none select-none block text-left">
                                      PERMANENT HOME ADDRESS
                                    </span>
                                  </div>

                                  {/* Row 1 of Permanent Address: 4 columns */}
                                  <div className="grid grid-cols-4 divide-x divide-black border-t border-black bg-white text-[7px] text-slate-550 min-h-[36px]">
                                    <div className="p-1 flex flex-col justify-between">
                                      <span className="font-extrabold uppercase select-none leading-none tracking-tight block mb-1 text-slate-500">Unit/Room No./Floor</span>
                                      <span className="text-[9.5px] font-black text-black uppercase block leading-tight">{details.addressUnitNoFloor || details.pmrfAddressUnitNoFloor || '—'}</span>
                                    </div>
                                    <div className="p-1 flex flex-col justify-between">
                                      <span className="font-extrabold uppercase select-none leading-none tracking-tight block mb-1 text-slate-500">Building Name</span>
                                      <span className="text-[9.5px] font-black text-black uppercase block leading-tight">{details.addressBuildingName || details.pmrfAddressBuildingName || details.addressBuilding || '—'}</span>
                                    </div>
                                    <div className="p-1 flex flex-col justify-between">
                                      <span className="font-extrabold uppercase select-none leading-none tracking-tight block mb-1 text-slate-500 font-bold">Lot/Block/Phase/House Number</span>
                                      <span className="text-[9.5px] font-black text-black uppercase block leading-tight">{details.addressUnit || details.pmrfAddressUnit || details.addressLot || '—'}</span>
                                    </div>
                                    <div className="p-1 flex flex-col justify-between">
                                      <span className="font-extrabold uppercase select-none leading-none tracking-tight block mb-1 text-slate-500">Street Name</span>
                                      <span className="text-[9.5px] font-black text-black uppercase block leading-tight">{details.addressStreet || details.pmrfAddressStreet || '—'}</span>
                                    </div>
                                  </div>

                                  {/* Row 2 of Permanent Address: 5 columns */}
                                  <div className="grid grid-cols-5 divide-x divide-black border-t border-black bg-white text-[7px] text-slate-550 min-h-[36px]">
                                    <div className="p-1 flex flex-col justify-between">
                                      <span className="font-extrabold uppercase select-none leading-none tracking-tight block mb-1 text-slate-500">Subdivision</span>
                                      <span className="text-[9.5px] font-black text-black uppercase block leading-tight">{details.addressSubdivision || details.pmrfAddressSubdivision || '—'}</span>
                                    </div>
                                    <div className="p-1 flex flex-col justify-between">
                                      <span className="font-extrabold uppercase select-none leading-none tracking-tight block mb-1 text-slate-500">Barangay</span>
                                      <span className="text-[9.5px] font-black text-black uppercase block leading-tight">{details.addressBarangay || details.pmrfAddressBarangay || h.barangay || '—'}</span>
                                    </div>
                                    <div className="p-1 flex flex-col justify-between">
                                      <span className="font-extrabold uppercase select-none leading-none tracking-tight block mb-1 text-slate-500">Municipality/City</span>
                                      <span className="text-[9.5px] font-black text-black uppercase block leading-tight">{details.addressMunicipality || details.pmrfAddressMunicipality || 'PAGADIAN CITY'}</span>
                                    </div>
                                    <div className="p-1 flex flex-col justify-between">
                                      <span className="font-extrabold uppercase select-none leading-none tracking-tight block mb-1 text-slate-500 leading-none">Province/State/Country (if abroad)</span>
                                      <span className="text-[9.5px] font-black text-black uppercase block leading-tight">{details.addressProvince || details.pmrfAddressProvince || 'ZAMBOANGA DEL SUR'}</span>
                                    </div>
                                    <div className="p-1 flex flex-col justify-between">
                                      <span className="font-extrabold uppercase select-none leading-none tracking-tight block mb-1 text-slate-500">ZIP Code</span>
                                      <span className="text-[9.5px] font-black text-black uppercase block leading-tight">{details.addressZip || details.pmrfAddressZip || '7016'}</span>
                                    </div>
                                  </div>
                                </div>

                                {/* MAILING ADDRESS Section */}
                                <div className="flex flex-col bg-white border-t border-black">
                                  {/* Header Label inside section with SAME AS ABOVE checkbox */}
                                  <div className="px-2 py-1 bg-white flex items-center justify-between">
                                    <span className="text-[8.5px] font-black text-black tracking-tight uppercase leading-none select-none block text-left">
                                      MAILING ADDRESS
                                    </span>
                                    <div className="flex items-center gap-1.5 mr-4 font-bold">
                                      <div className="flex items-center justify-center border border-black w-3.5 h-3.5 text-[8px] font-black bg-white text-black leading-none select-none">
                                        {details.mailSame !== false && details.pmrfMailingSame !== false ? 'X' : ''}
                                      </div>
                                      <span className="text-[7.5px] font-black text-black uppercase tracking-tight select-none">SAME AS ABOVE</span>
                                    </div>
                                  </div>

                                  {/* Row 1 of Mailing Address: 4 columns */}
                                  <div className="grid grid-cols-4 divide-x divide-black border-t border-black bg-white text-[7px] text-slate-550 min-h-[36px]">
                                    <div className="p-1 flex flex-col justify-between">
                                      <span className="font-extrabold uppercase select-none leading-none tracking-tight block mb-1 text-slate-500">Unit/Room No./Floor</span>
                                      <span className="text-[9.5px] font-black text-black uppercase block leading-tight">
                                        {(details.mailSame !== false && details.pmrfMailingSame !== false) ? (details.addressUnitNoFloor || details.pmrfAddressUnitNoFloor || '—') : (details.mailUnitNoFloor || details.pmrfMailUnitNoFloor || '—')}
                                      </span>
                                    </div>
                                    <div className="p-1 flex flex-col justify-between">
                                      <span className="font-extrabold uppercase select-none leading-none tracking-tight block mb-1 text-slate-500">Building Name</span>
                                      <span className="text-[9.5px] font-black text-black uppercase block leading-tight">
                                        {(details.mailSame !== false && details.pmrfMailingSame !== false) ? (details.addressBuildingName || details.pmrfAddressBuildingName || details.addressBuilding || '—') : (details.mailBuildingName || details.pmrfMailBuildingName || '—')}
                                      </span>
                                    </div>
                                    <div className="p-1 flex flex-col justify-between">
                                      <span className="font-extrabold uppercase select-none leading-none tracking-tight block mb-1 text-slate-500 font-bold">Lot/Block/Phase/House Number</span>
                                      <span className="text-[9.5px] font-black text-black uppercase block leading-tight">
                                        {(details.mailSame !== false && details.pmrfMailingSame !== false) ? (details.addressUnit || details.pmrfAddressUnit || '—') : (details.mailUnit || details.pmrfMailUnit || '—')}
                                      </span>
                                    </div>
                                    <div className="p-1 flex flex-col justify-between">
                                      <span className="font-extrabold uppercase select-none leading-none tracking-tight block mb-1 text-slate-500">Street Name</span>
                                      <span className="text-[9.5px] font-black text-black uppercase block leading-tight">
                                        {(details.mailSame !== false && details.pmrfMailingSame !== false) ? (details.addressStreet || details.pmrfAddressStreet || '—') : (details.mailStreet || details.pmrfMailStreet || '—')}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Row 2 of Mailing Address: 5 columns */}
                                  <div className="grid grid-cols-5 divide-x divide-black border-t border-black bg-white text-[7px] text-slate-550 min-h-[36px]">
                                    <div className="p-1 flex flex-col justify-between">
                                      <span className="font-extrabold uppercase select-none leading-none tracking-tight block mb-1 text-slate-500">Subdivision</span>
                                      <span className="text-[9.5px] font-black text-black uppercase block leading-tight">
                                        {(details.mailSame !== false && details.pmrfMailingSame !== false) ? (details.addressSubdivision || details.pmrfAddressSubdivision || '—') : (details.mailSubdivision || details.pmrfMailSubdivision || '—')}
                                      </span>
                                    </div>
                                    <div className="p-1 flex flex-col justify-between">
                                      <span className="font-extrabold uppercase select-none leading-none tracking-tight block mb-1 text-slate-500">Barangay</span>
                                      <span className="text-[9.5px] font-black text-black uppercase block leading-tight">
                                        {(details.mailSame !== false && details.pmrfMailingSame !== false) ? (details.addressBarangay || details.pmrfAddressBarangay || h.barangay || '—') : (details.mailBarangay || details.pmrfMailBarangay || '—')}
                                      </span>
                                    </div>
                                    <div className="p-1 flex flex-col justify-between">
                                      <span className="font-extrabold uppercase select-none leading-none tracking-tight block mb-1 text-slate-500">Municipality/City</span>
                                      <span className="text-[9.5px] font-black text-black uppercase block leading-tight">
                                        {(details.mailSame !== false && details.pmrfMailingSame !== false) ? (details.addressMunicipality || details.pmrfAddressMunicipality || 'PAGADIAN CITY') : (details.mailMunicipality || details.pmrfMailMunicipality || '—')}
                                      </span>
                                    </div>
                                    <div className="p-1 flex flex-col justify-between">
                                      <span className="font-extrabold uppercase select-none leading-none tracking-tight block mb-1 text-slate-500 leading-none font-bold">Province/State/Country (if abroad)</span>
                                      <span className="text-[9.5px] font-black text-black uppercase block leading-tight">
                                        {(details.mailSame !== false && details.pmrfMailingSame !== false) ? (details.addressProvince || details.pmrfAddressProvince || 'ZAMBOANGA DEL SUR') : (details.mailProvince || details.pmrfMailProvince || '—')}
                                      </span>
                                    </div>
                                    <div className="p-1 flex flex-col justify-between">
                                      <span className="font-extrabold uppercase select-none leading-none tracking-tight block mb-1 text-slate-500">ZIP Code</span>
                                      <span className="text-[9.5px] font-black text-black uppercase block leading-tight">
                                        {(details.mailSame !== false && details.pmrfMailingSame !== false) ? (details.addressZip || details.pmrfAddressZip || '7016') : (details.mailZip || details.pmrfMailZip || '—')}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Right Column (Col-span 4): Contact Details */}
                              <div className="col-span-12 md:col-span-4 flex flex-col divide-y divide-black bg-white p-2 text-black space-y-2 select-none h-full justify-between">
                                
                                {/* Home Phone */}
                                <div className="flex flex-col space-y-0.5">
                                  <span className="text-[7.5px] font-black text-black uppercase block leading-none select-none text-left">
                                    Home Phone Number
                                  </span>
                                  <div className="border border-black bg-white px-2 py-1 text-[9.5px] font-black text-black uppercase min-h-[22px] flex items-center">
                                    {details.homePhone || '—'}
                                  </div>
                                  <span className="text-[5px] font-bold text-slate-550 leading-none block text-left select-none uppercase font-mono mt-0.5">
                                    (COUNTRY CODE + AREA CODE + TELEPHONE NUMBER)
                                  </span>
                                </div>

                                {/* Mobile Number */}
                                <div className="flex flex-col space-y-0.5">
                                  <span className="text-[7.5px] font-black text-black uppercase block leading-none select-none text-left">
                                    Mobile Number (Required)
                                  </span>
                                  <div className="border border-black bg-white px-2 py-1 text-[9.5px] font-black text-black uppercase min-h-[22px] flex items-center">
                                    {details.mobileNo || h.contactNumber || '—'}
                                  </div>
                                </div>

                                {/* Business Phone */}
                                <div className="flex flex-col space-y-0.5">
                                  <span className="text-[7.5px] font-black text-black uppercase block leading-none select-none text-left">
                                    Business (Direct Line)
                                  </span>
                                  <div className="border border-black bg-white px-2 py-1 text-[9.5px] font-black text-black uppercase min-h-[22px] flex items-center">
                                    {details.businessDirect || details.businessPhone || '—'}
                                  </div>
                                </div>

                                {/* Email Address */}
                                <div className="flex flex-col space-y-0.5">
                                  <span className="text-[7.5px] font-black text-black uppercase block leading-none select-none text-left">
                                    E-mail Address (Required for OFW)
                                  </span>
                                  <div className="border border-black bg-white px-2 py-1 text-[9.5px] font-black text-black uppercase min-h-[22px] flex items-center">
                                    {details.email || '—'}
                                  </div>
                                </div>

                              </div>

                            </div>
                          </div>

                          {/* III. Declaration of Dependents Block to match the reference image */}
                          {(() => {
                            const rowsCount = Math.max(4, details.dependents?.length || 0);
                            const rowsToRender = Array.from({ length: rowsCount }).map((_, idx) => {
                              const dep = (details.dependents && details.dependents[idx]) || {};
                              
                              // Parse fields gracefully, supporting both rich properties & parsed fullName
                              let lastName = dep.lastName || '';
                              let firstName = dep.firstName || '';
                              let middleName = dep.middleName || '';
                              let nameExt = dep.nameExt || '';
                              
                              if (!lastName && !firstName && dep.fullName) {
                                // Fallback parsing of full name e.g. "LAST, FIRST MIDDLE"
                                const parts = dep.fullName.split(',');
                                if (parts.length > 0) {
                                  lastName = parts[0].trim();
                                  if (parts.length > 1) {
                                    const remaining = parts[1].trim().split(' ');
                                    firstName = remaining[0] || '';
                                    if (remaining.length > 1) {
                                      // The rest could be middle name or suffix
                                      const lastPart = remaining[remaining.length - 1];
                                      if (['JR', 'SR', 'JR.', 'SR.', 'III', 'IV', 'V', 'II'].includes(lastPart.toUpperCase())) {
                                        nameExt = lastPart;
                                        middleName = remaining.slice(1, remaining.length - 1).join(' ');
                                      } else {
                                        middleName = remaining.slice(1).join(' ');
                                      }
                                    }
                                  }
                                } else {
                                  firstName = dep.fullName;
                                }
                              }

                              const noMn = dep.noMiddleName === true || dep.noMiddleName === 'true' || dep.noMn === true || dep.noMn === 'true' || false;
                              const mononym = dep.mononym === true || dep.mononym === 'true' || false;
                              const relationship = dep.relationship || '';
                              
                              // Format birthdate safely to MM-DD-YYYY
                              const rawBirthDate = dep.birthDate || dep.birthdate || '';
                              let birthDateFormatted = rawBirthDate;
                              if (rawBirthDate) {
                                let parts = rawBirthDate.split('-');
                                if (parts.length === 3 && parts[0].length === 4) {
                                  // YYYY-MM-DD -> MM-DD-YYYY
                                  birthDateFormatted = `${parts[1]}-${parts[2]}-${parts[0]}`;
                                } else {
                                  parts = rawBirthDate.split('/');
                                  if (parts.length === 3) {
                                    const m = parts[0].padStart(2, '0');
                                    const d = parts[1].padStart(2, '0');
                                    const y = parts[2];
                                    birthDateFormatted = `${m}-${d}-${y}`;
                                  }
                                }
                              }

                              const citizenship = dep.citizenship || (lastName || firstName ? 'FILIPINO' : '');
                              const disabled = dep.isDisabled === true || dep.isDisabled === 'true' || dep.disabled === true || dep.disabled === 'true' || false;

                              return {
                                lastName,
                                firstName,
                                nameExt,
                                middleName,
                                relationship,
                                birthDate: birthDateFormatted,
                                citizenship,
                                noMn,
                                mononym,
                                disabled,
                                sex: dep.gender || dep.sex || (lastName || firstName ? 'Female' : ''),
                                civilStatus: dep.civilStatus || (lastName || firstName ? 'Single' : '')
                              };
                            });

                            return (
                              <div className="space-y-1">
                                {/* Section III Header */}
                                <div className="bg-[#dee5db] border-t border-x border-black text-black font-extrabold px-3 py-1 text-[11px] tracking-wider flex justify-between items-center select-none uppercase font-sans border-b">
                                  <span>III. DECLARATION OF DEPENDENTS</span>
                                  <span className="text-[8.5px] font-bold normal-case text-black tracking-normal select-none italic font-sans">
                                    (Use additional form if necessary)
                                  </span>
                                </div>

                                {/* Table block */}
                                <div className="overflow-x-auto select-none border-x border-b border-black">
                                  <table className="w-full border-collapse text-[9px] font-sans table-fixed min-w-[800px] bg-white">
                                    <thead>
                                      <tr className="bg-white border-b border-black text-black font-extrabold text-[8px] h-[34px]">
                                        <th className="border-r border-black w-[17%] px-1 text-center align-middle select-none uppercase font-sans tracking-tight">
                                          LAST NAME
                                        </th>
                                        <th className="border-r border-black w-[17%] px-1 text-center align-middle select-none uppercase font-sans tracking-tight">
                                          FIRST NAME
                                        </th>
                                        <th className="border-r border-black w-[7%] px-1 text-center align-middle select-none text-[6.5px] font-bold leading-none uppercase font-sans">
                                          NAME <br /> EXTENSION <br /> <span className="text-[5.5px] lowercase">(Jr./Sr./III)</span>
                                        </th>
                                        <th className="border-r border-black w-[15%] px-1 text-center align-middle select-none uppercase font-sans tracking-tight">
                                          MIDDLE NAME
                                        </th>
                                        <th className="border-r border-black w-[8%] px-1 text-center align-middle select-none uppercase font-sans text-[7.5px] tracking-tight">
                                          RELATIONSHIP
                                        </th>
                                        <th className="border-r border-black w-[9%] px-1 text-center align-middle select-none text-[7.5px] leading-tight uppercase font-sans tracking-tight">
                                          DATE OF <br /> BIRTH <br /> <span className="text-[6.5px] lowercase font-normal">(mm-dd-yyyy)</span>
                                        </th>
                                        <th className="border-r border-black w-[6%] px-1 text-center align-middle select-none uppercase font-sans text-[7.5px] tracking-tight">
                                          SEX
                                        </th>
                                        <th className="border-r border-black w-[8%] px-1 text-center align-middle select-none uppercase font-sans text-[7.5px] tracking-tight">
                                          CIVIL <br /> STATUS
                                        </th>
                                        <th className="border-r border-black w-[8%] px-1 text-center align-middle select-none uppercase font-sans text-[7.5px] tracking-tight">
                                          CITIZENSHIP
                                        </th>
                                        <th className="border-r border-black w-[6%] px-1 text-center align-middle select-none uppercase font-sans text-[6px] h-full p-0">
                                          <div className="flex flex-col h-full justify-between py-1 min-h-[30px]">
                                            <span className="font-extrabold block text-[6.5px] leading-none mb-0.5">NO MIDDLE <br /> NAME</span>
                                            <span className="border-t border-black w-full pt-1 text-[5px] font-black text-slate-800 leading-none select-none block">
                                              (If Applicable)
                                            </span>
                                          </div>
                                        </th>
                                        <th className="border-r border-black w-[5%] px-1 text-center align-middle select-none uppercase font-sans text-[6.5px] font-extrabold tracking-tight">
                                          MONONYM
                                        </th>
                                        <th className="w-[5%] px-1 text-center align-middle select-none text-[6.5px] font-extrabold tracking-tight leading-none uppercase font-sans">
                                          Check if <br /> Person with <br /> Disability
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-black text-black">
                                      {rowsToRender.map((row, rIdx) => (
                                        <tr key={rIdx} className="h-[28px] bg-white divide-x divide-black text-[9.5px]">
                                          {/* Last Name */}
                                          <td className="px-1.5 font-black uppercase text-left align-middle truncate min-w-[80px]">
                                            {row.lastName || '—'}
                                          </td>
                                          {/* First Name */}
                                          <td className="px-1.5 font-black uppercase text-left align-middle truncate min-w-[80px]">
                                            {row.firstName || '—'}
                                          </td>
                                          {/* Name Extension */}
                                          <td className="px-1 text-center align-middle font-black uppercase text-[9px]">
                                            {row.nameExt || '—'}
                                          </td>
                                          {/* Middle Name */}
                                          <td className="px-1.5 font-black uppercase text-left align-middle truncate min-w-[80px]">
                                            {row.middleName || '—'}
                                          </td>
                                          {/* Relationship */}
                                          <td className="px-1 font-black uppercase text-center align-middle text-[8.5px] truncate">
                                            {row.relationship || '—'}
                                          </td>
                                          {/* Date of Birth */}
                                          <td className="px-1 font-mono font-black text-center align-middle text-[9px]">
                                            {row.birthDate || '—'}
                                          </td>
                                          {/* Sex */}
                                          <td className="px-1 font-black uppercase text-center align-middle text-[8.5px] truncate">
                                            {row.sex || '—'}
                                          </td>
                                          {/* Civil Status */}
                                          <td className="px-1 font-black uppercase text-center align-middle text-[8.5px] truncate">
                                            {row.civilStatus || '—'}
                                          </td>
                                          {/* Citizenship */}
                                          <td className="px-1 font-black uppercase text-center align-middle text-[8.5px] truncate">
                                            {row.citizenship || '—'}
                                          </td>
                                          {/* No Middle Name Checkbox */}
                                          <td className="p-1 text-center align-middle">
                                            <div className="flex items-center justify-center">
                                              <div className="border border-black w-3.5 h-3.5 text-[8.5px] font-black bg-white text-black flex items-center justify-center leading-none select-none">
                                                {row.noMn ? 'X' : ''}
                                              </div>
                                            </div>
                                          </td>
                                          {/* Mononym Checkbox */}
                                          <td className="p-1 text-center align-middle">
                                            <div className="flex items-center justify-center">
                                              <div className="border border-black w-3.5 h-3.5 text-[8.5px] font-black bg-white text-black flex items-center justify-center leading-none select-none">
                                                {row.mononym ? 'X' : ''}
                                              </div>
                                            </div>
                                          </td>
                                          {/* Disability Checkbox */}
                                          <td className="p-1 text-center align-middle">
                                            <div className="flex items-center justify-center">
                                              <div className="border border-black w-3.5 h-3.5 text-[8.5px] font-black bg-white text-black flex items-center justify-center leading-none select-none">
                                                {row.disabled ? 'X' : ''}
                                              </div>
                                            </div>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            );
                          })()}

                          {/* IV. Member Classification & Financial details Redesigned identically to the image */}
                          {(() => {
                            const isDirect = String(details.contributorCategory || '').toUpperCase() === 'DIRECT';
                            const rawSubCategory = String(details.contributorType || '').toUpperCase().trim();
                            const subCategory = (() => {
                              const raw = rawSubCategory;
                              if (raw === 'EMPLOYED PRIVATE' || raw === 'EMPLOYED_PRIVATE') return "EMPLOYED_PRIVATE";
                              if (raw === 'EMPLOYED GOVERNMENT' || raw === 'EMPLOYED_GOV') return "EMPLOYED_GOV";
                              if (raw === 'PROFESSIONAL PRACTITIONER' || raw === 'PROF_PRACTITIONER') return "PROF_PRACTITIONER";
                              if (raw === 'SELF-EARNING INDIVIDUAL' || raw === 'SELF_EARNING' || raw === 'SELF_EARNING_INDIVIDUAL') return "SELF_EARNING_INDIVIDUAL";
                              if (raw === 'KASAMBAHAY') return "KASAMBAHAY";
                              if (raw === 'FAMILY DRIVER' || raw === 'FAMILY_DRIVER') return "FAMILY_DRIVER";
                              if (raw === 'MIGRANT WORKER (LAND-BASED)' || raw === 'MIGRANT_LAND' || raw === 'LAND-BASED' || raw === 'MIGRANT WORKER (LAND-BASED)') return "MIGRANT_LAND";
                              if (raw === 'MIGRANT WORKER (SEA-BASED)' || raw === 'MIGRANT_SEA' || raw === 'SEA-BASED' || raw === 'MIGRANT WORKER (SEA-BASED)') return "MIGRANT_SEA";
                              if (raw === 'LIFETIME' || raw === 'LIFETIME MEMBER') return "LIFETIME";
                              
                              // Indirect
                              if (raw === 'INDIGENT' || raw === 'LISTAHANAN' || raw === 'LISTAHANAN INDIGENT') return "LISTAHANAN";
                              if (raw === 'INDIGENT 4PS' || raw === 'FOURPS' || raw === '4PS / PANTAWID PAMILYA') return "FOURPS";
                              if (raw === 'SENIOR' || raw === 'SENIOR CITIZEN') return "SENIOR";
                              if (raw === 'PWD' || raw === 'PERSON WITH DISABILITY (PWD)') return "PWD";
                              
                              return raw;
                            })();
                            const philhealthUse = String(details.philhealthUse || details.philHealthUse || details.officialUse || '').toUpperCase();

                            const renderCheckbox = (label: string, checked: boolean, indent: boolean = false, subtext: string = '') => (
                              <div className={`flex items-start gap-1 select-none ${indent ? 'pl-4' : ''}`}>
                                <div className="border border-black w-3.5 h-3.5 text-[8.5px] font-black bg-white text-black flex items-center justify-center leading-none mt-0.5 select-none shrink-0">
                                  {checked ? 'X' : ''}
                                </div>
                                <div className="flex flex-col text-left">
                                  <span className="text-[8.5px] font-extrabold text-black uppercase leading-tight select-none">
                                    {label}
                                  </span>
                                  {subtext && (
                                    <span className="text-[5.5px] text-slate-500 font-bold leading-none uppercase mt-0.5 select-none font-sans">
                                      {subtext}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );

                            return (
                              <div className="space-y-1">
                                {/* Section IV Header */}
                                <div className="bg-[#dee5db] border-t border-x border-black text-black font-extrabold px-3 py-1 text-[11px] tracking-wider block select-none text-center uppercase font-sans border-b">
                                  IV. MEMBER TYPE
                                </div>

                                {/* Form Body */}
                                <div className="overflow-x-auto select-none border-x border-b border-black">
                                  <div className="min-w-[800px] bg-white grid grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-black text-black font-sans leading-tight">
                                    
                                    {/* Left Column (DIRECT CONTRIBUTOR) - spans 8 cols */}
                                    <div className="col-span-12 md:col-span-8 flex flex-col justify-between divide-y divide-black bg-white">
                                      
                                      {/* Checkboxes container */}
                                      <div className="p-2 flex flex-col text-left">
                                        <div className="text-[9.5px] font-black text-black tracking-wider block text-center mb-2 uppercase font-sans select-none border-b border-black pb-1">
                                          DIRECT CONTRIBUTOR
                                        </div>

                                        <div className="flex gap-2">
                                          {/* Col 1: Employed Private to Self-Earning Group */}
                                          <div className="w-[42%] flex flex-col gap-1.5 pr-2 border-r border-dashed border-slate-300">
                                            {renderCheckbox("Employed Private", isDirect && subCategory === "EMPLOYED_PRIVATE")}
                                            {renderCheckbox("Employed Government", isDirect && subCategory === "EMPLOYED_GOV")}
                                            {renderCheckbox("Professional Practitioner", isDirect && subCategory === "PROF_PRACTITIONER")}
                                            {renderCheckbox("Self-Earning Individual", isDirect && (subCategory === "SELF_EARNING" || subCategory === "SELF_EARNING_INDIVIDUAL" || subCategory === "SELF_EARNING_SOLE" || subCategory === "SELF_EARNING_GROUP"))}
                                            
                                            {/* Indented Options */}
                                            {renderCheckbox("Individual", isDirect && subCategory === "SELF_EARNING_INDIVIDUAL", true)}
                                            {renderCheckbox("Sole Proprietor", isDirect && subCategory === "SELF_EARNING_SOLE", true)}
                                            {renderCheckbox("Group Enrollment Scheme", isDirect && subCategory === "SELF_EARNING_GROUP", true)}
                                          </div>

                                          {/* Col 2 & 3: Kasambahay, Family Driver, Migrant, Lifetime, Dual, Foreign */}
                                          <div className="w-[58%] flex flex-col gap-1.5 pl-2 justify-between">
                                            
                                            {/* Kasambahay & Family Driver Row */}
                                            <div className="flex items-start">
                                              <div className="w-[66%]">
                                                {renderCheckbox("Kasambahay", isDirect && subCategory === "KASAMBAHAY")}
                                              </div>
                                              <div className="w-[34%]">
                                                {renderCheckbox("Family Driver", isDirect && subCategory === "FAMILY_DRIVER")}
                                              </div>
                                            </div>

                                            {/* Migrant Worker Row */}
                                            <div className="flex flex-col gap-0.5">
                                              <span className="text-[8.5px] font-black text-black uppercase leading-none select-none block text-left">
                                                Migrant Worker
                                              </span>
                                              <div className="flex items-start pl-3">
                                                <div className="w-[66%]">
                                                  {renderCheckbox("Land-Based", isDirect && subCategory === "MIGRANT_LAND")}
                                                </div>
                                                <div className="w-[34%]">
                                                  {renderCheckbox("Sea-Based", isDirect && subCategory === "MIGRANT_SEA")}
                                                </div>
                                              </div>
                                            </div>

                                            {renderCheckbox("Lifetime Member", isDirect && subCategory === "LIFETIME")}
                                            {renderCheckbox("Filipinos with Dual Citizenship / Living Abroad", isDirect && subCategory === "FILIPINO_DUAL")}
                                            {renderCheckbox("Foreign National", isDirect && subCategory === "FOREIGN")}

                                            {/* SRRV / ACR Identifiers */}
                                            <div className="flex flex-col gap-1.5 pl-4 select-none">
                                              <div className="flex items-center gap-1.5 h-4 text-[7.5px] font-extrabold uppercase text-left">
                                                <span>PRA SRRV No.</span>
                                                <div className="border-b border-black flex-1 text-[8.5px] font-black pb-0.5 font-mono px-1">
                                                  {details.praSrrvNo || details.praNo || '—'}
                                                </div>
                                              </div>
                                              <div className="flex items-center gap-1.5 h-4 text-[7.5px] font-extrabold uppercase text-left">
                                                <span>ACR I-Card No.</span>
                                                <div className="border-b border-black flex-1 text-[8.5px] font-black pb-0.5 font-mono px-1">
                                                  {details.acrICardNo || details.acrNo || '—'}
                                                </div>
                                              </div>
                                            </div>

                                          </div>
                                        </div>
                                      </div>

                                      {/* Direct Contributor bottom cells */}
                                      <div className="grid grid-cols-12 divide-x divide-black border-t border-black select-none bg-white">
                                        <div className="col-span-6 p-2 flex flex-col justify-between min-h-[50px] text-left">
                                          <span className="text-[8px] font-black text-black leading-normal select-none">
                                            PROFESSION: <span className="text-[6.5px] font-bold text-slate-550 lowercase normal-case tracking-tight select-none">(Except Employed, Lifetime Members and Sea-based Migrant Worker)</span>
                                          </span>
                                          <div className="text-[9.5px] font-black text-black uppercase mb-0.5">
                                            {details.profession || '—'}
                                          </div>
                                        </div>

                                        <div className="col-span-3 p-2 flex flex-col justify-between min-h-[50px] text-left">
                                          <span className="text-[8px] font-black text-black leading-none select-none">
                                            MONTHLY INCOME:
                                          </span>
                                          <div className="text-[9.5px] font-black text-black uppercase mb-0.5">
                                            {details.monthlyIncome ? `₱${parseInt(details.monthlyIncome).toLocaleString()}` : '—'}
                                          </div>
                                        </div>

                                        <div className="col-span-3 p-2 flex flex-col justify-between min-h-[50px] text-left">
                                          <span className="text-[8px] font-black text-black leading-none select-none">
                                            PROOF OF INCOME:
                                          </span>
                                          <div className="text-[9.5px] font-black text-black uppercase mb-0.5">
                                            {details.proofOfIncome || '—'}
                                          </div>
                                        </div>
                                      </div>

                                    </div>

                                    {/* Right Column (INDIRECT CONTRIBUTOR) - spans 4 cols */}
                                    <div className="col-span-12 md:col-span-4 flex flex-col justify-between divide-y divide-black bg-white">
                                      
                                      {/* Top part: title and checkboxes */}
                                      <div className="p-2 flex flex-col text-left">
                                        <div className="text-[9.5px] font-black text-black tracking-wider block text-center mb-2 uppercase font-sans select-none border-b border-black pb-1">
                                          INDIRECT CONTRIBUTOR
                                        </div>

                                        <div className="flex gap-1">
                                          {/* Col A of Indirect */}
                                          <div className="w-[50%] flex flex-col gap-1.5 pr-1 border-r border-dashed border-slate-300">
                                            {renderCheckbox("Listahanan", !isDirect && subCategory === "LISTAHANAN")}
                                            {renderCheckbox("4Ps/MCCT", !isDirect && subCategory === "FOURPS")}
                                            {renderCheckbox("Senior Citizen", !isDirect && subCategory === "SENIOR")}
                                            {renderCheckbox("PAMANA", !isDirect && subCategory === "PAMANA")}
                                            {renderCheckbox("KIA/KIPO", !isDirect && subCategory === "KIA_KIPO")}
                                            {renderCheckbox("Bangsamoro/Normalization", !isDirect && subCategory === "BANGSAMORO")}
                                          </div>

                                          {/* Col B of Indirect */}
                                          <div className="w-[50%] flex flex-col gap-1.5 pl-1 justify-between h-full">
                                            <div className="flex flex-col gap-1.5">
                                              {renderCheckbox("LGU-sponsored", !isDirect && subCategory === "LGU_SPONSORED")}
                                              {renderCheckbox("NGA-sponsored", !isDirect && subCategory === "NGA_SPONSORED")}
                                              {renderCheckbox("Private-sponsored", !isDirect && subCategory === "PRIVATE_SPONSORED")}
                                              {renderCheckbox("Person with Disability", !isDirect && subCategory === "PWD")}
                                            </div>

                                            {/* PWD ID Field */}
                                            <div className="flex items-center gap-1 h-4 text-[7px] font-extrabold uppercase mt-1">
                                              <span>PWD ID No.</span>
                                              <div className="border-b border-black flex-1 text-[8px] font-black pb-0.5 font-mono px-0.5">
                                                {details.pwdIdNo || '—'}
                                              </div>
                                            </div>

                                          </div>
                                        </div>
                                      </div>

                                      {/* Bottom part: Philhealth use only */}
                                      <div className="p-2 flex flex-col justify-between min-h-[50px] bg-[#f4f7f4]/40 select-none text-left">
                                        <span className="text-[8.5px] font-extrabold text-black block tracking-tight text-center uppercase select-none italic font-sans leading-none mb-1.5">
                                          For PhilHealth Use only:
                                        </span>

                                        <div className="flex flex-col gap-1.5 select-none pl-1">
                                          {renderCheckbox("Point of Service (POS) Financially Incapable", philhealthUse === "POS_INCAPABLE")}
                                          {renderCheckbox("Financially Incapable", philhealthUse === "INCAPABLE")}
                                        </div>
                                      </div>

                                    </div>

                                  </div>
                                </div>

                                {/* Local Administrative Metadata Tracking (so we preserve any state trackers cleanly!) */}
                                <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex flex-wrap gap-x-6 gap-y-1.5 text-[10px] select-none">
                                  <div className="text-slate-500 font-bold uppercase select-none">Local Metadata Accents:</div>
                                  <div className="text-slate-800">
                                    Consent Willing Status: <strong className="text-emerald-700 font-extrabold uppercase">{h.pmrfStatus || 'Willing'}</strong>
                                  </div>
                                  <div className="text-slate-800">
                                    Yakap Willing Status: <strong className="text-blue-800 font-extrabold uppercase">{h.yakapWillingStatus || 'Willing'}</strong>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                      ) : activeTab === 'PMRF_BACK' ? (
                              <div className="space-y-4 animate-fade-in w-full overflow-x-auto pb-4 text-black select-none">
                                <div className="min-w-[850px] space-y-4">
                                {/* SECTION V. UPDATING/AMENDMENT FOR SYSTEM REVIEWER */}
                                <div className="bg-white border-[2px] border-black p-4 text-black font-sans text-[9px] uppercase tracking-normal relative rounded-lg">
                                  
                                  <div className="overflow-x-auto select-none">
                                    <div className="min-w-[750px] border border-black flex flex-col mt-1 bg-white">
                                      
                                      {/* Header Title */}
                                      <div className="bg-[#dee5db] border-b border-black text-center font-extrabold text-[12px] py-2 tracking-wider uppercase font-sans text-black">
                                        V. UPDATING/AMENDMENT
                                      </div>

                                      {/* Subheadings PLEASE CHECK:, FROM, TO */}
                                      <div className="grid grid-cols-10 divide-x divide-black border-b border-black font-extrabold text-[9px] bg-white text-black h-8 items-center text-left">
                                        <div className="col-span-4 px-3 py-1 font-black text-black select-none uppercase tracking-wide">
                                          PLEASE CHECK:
                                        </div>
                                        <div className="col-span-3 px-3 py-1 text-center font-black text-black select-none uppercase tracking-wide">
                                          FROM
                                        </div>
                                        <div className="col-span-3 px-3 py-1 text-center font-black text-black select-none uppercase tracking-wide">
                                          TO
                                        </div>
                                      </div>

                                      {/* Row 1: Name */}
                                      <div className="grid grid-cols-10 divide-x divide-black border-b border-black text-black">
                                        <div className="col-span-4 p-2 flex items-start gap-2.5 bg-white select-none">
                                          <div className="border border-black w-3.5 h-3.5 text-[8.5px] font-black bg-white text-black flex items-center justify-center leading-none mt-0.5 select-none shrink-0">
                                            {details.pmrfBackChangeName ? 'X' : ''}
                                          </div>
                                          <div className="flex flex-col text-left">
                                            <span className="font-extrabold text-[9px] text-black leading-tight uppercase font-sans">Change/Correction of Name</span>
                                            <span className="text-[6px] text-gray-400 font-bold normal-case tracking-tight leading-normal mt-0.5 font-sans">
                                              (Last Name, First Name, Name Extension (Jr./Sr./III) Middle Name)
                                            </span>
                                          </div>
                                        </div>
                                        <div className="col-span-3 p-2 flex items-center bg-white font-mono font-bold text-[10px] min-h-10 text-slate-800 text-left">
                                          {details.pmrfBackChangeName ? (details.pmrfBackFromValueName || '—') : '—'}
                                        </div>
                                        <div className="col-span-3 p-2 flex items-center bg-white font-mono font-bold text-[10px] min-h-10 text-blue-700 text-left">
                                          {details.pmrfBackChangeName ? (details.pmrfBackToValueName || '—') : '—'}
                                        </div>
                                      </div>

                                      {/* Row 2: DOB */}
                                      <div className="grid grid-cols-10 divide-x divide-black border-b border-black text-black">
                                        <div className="col-span-4 p-2.5 flex items-center gap-2.5 bg-white select-none">
                                          <div className="border border-black w-3.5 h-3.5 text-[8.5px] font-black bg-white text-black flex items-center justify-center leading-none select-none shrink-0">
                                            {details.pmrfBackChangeDOB ? 'X' : ''}
                                          </div>
                                          <span className="font-extrabold text-[9px] text-black leading-none uppercase font-sans text-left">Correction of Date of Birth</span>
                                        </div>
                                        <div className="col-span-3 p-2 flex items-center bg-white font-mono font-bold text-[10px] h-8 text-left">
                                          {details.pmrfBackChangeDOB ? (
                                            <span className="text-slate-800">{details.pmrfBackFromValueDOB || '—'}</span>
                                          ) : (
                                            <span className="text-gray-300 font-bold font-sans">YYYY-MM-DD</span>
                                          )}
                                        </div>
                                        <div className="col-span-3 p-2 flex items-center bg-white font-mono font-bold text-[10px] h-8 text-left">
                                          {details.pmrfBackChangeDOB ? (
                                            <span className="text-blue-700">{details.pmrfBackToValueDOB || '—'}</span>
                                          ) : (
                                            <span className="text-gray-300 font-bold font-sans">YYYY-MM-DD</span>
                                          )}
                                        </div>
                                      </div>

                                      {/* Row 3: Sex */}
                                      <div className="grid grid-cols-10 divide-x divide-black border-b border-black text-black">
                                        <div className="col-span-4 p-2.5 flex items-center gap-2.5 bg-white select-none">
                                          <div className="border border-black w-3.5 h-3.5 text-[8.5px] font-black bg-white text-black flex items-center justify-center leading-none select-none shrink-0">
                                            {details.pmrfBackChangeSex ? 'X' : ''}
                                          </div>
                                          <span className="font-extrabold text-[9px] text-black leading-none uppercase font-sans text-left">Correction of Sex</span>
                                        </div>
                                        <div className="col-span-3 p-2 flex items-center bg-white font-mono font-bold text-[10px] h-8 text-slate-800 text-left">
                                          {details.pmrfBackChangeSex ? (details.pmrfBackFromValueSex || '—') : '—'}
                                        </div>
                                        <div className="col-span-3 p-2 flex items-center bg-white font-mono font-bold text-[10px] h-8 text-blue-700 text-left">
                                          {details.pmrfBackChangeSex ? (details.pmrfBackToValueSex || '—') : '—'}
                                        </div>
                                      </div>

                                      {/* Row 4: Civil Status */}
                                      <div className="grid grid-cols-10 divide-x divide-black border-b border-black text-black">
                                        <div className="col-span-4 p-2.5 flex items-center gap-2.5 bg-white select-none">
                                          <div className="border border-black w-3.5 h-3.5 text-[8.5px] font-black bg-white text-black flex items-center justify-center leading-none select-none shrink-0">
                                            {details.pmrfBackChangeCivilStatus ? 'X' : ''}
                                          </div>
                                          <span className="font-extrabold text-[9px] text-black leading-none uppercase font-sans text-left">Change of Civil Status</span>
                                        </div>
                                        <div className="col-span-3 p-2 flex items-center bg-white font-mono font-bold text-[10px] h-8 text-slate-800 text-left">
                                          {details.pmrfBackChangeCivilStatus ? (details.pmrfBackFromValueCivil || '—') : '—'}
                                        </div>
                                        <div className="col-span-3 p-2 flex items-center bg-white font-mono font-bold text-[10px] h-8 text-blue-700 text-left">
                                          {details.pmrfBackChangeCivilStatus ? (details.pmrfBackToValueCivil || '—') : '—'}
                                        </div>
                                      </div>

                                      {/* Row 5: Info/Address */}
                                      <div className="grid grid-cols-10 divide-x divide-black text-black">
                                        <div className="col-span-4 p-2 flex items-start gap-2.5 bg-white select-none">
                                          <div className="border border-black w-3.5 h-3.5 text-[8.5px] font-black bg-white text-black flex items-center justify-center leading-none mt-0.5 select-none shrink-0">
                                            {details.pmrfBackChangePersonalInfo ? 'X' : ''}
                                          </div>
                                          <div className="flex flex-col text-left">
                                            <span className="font-extrabold text-[9px] text-black leading-snug font-sans uppercase">Updating of Personal Information/Address/</span>
                                            <span className="font-extrabold text-[9px] text-black leading-snug font-sans uppercase">Telephone Number/Mobile Number/e-mail Address</span>
                                          </div>
                                        </div>
                                        <div className="col-span-3 p-2 flex items-center bg-white font-mono font-bold text-[10px] min-h-11 text-slate-800 text-left">
                                          {details.pmrfBackChangePersonalInfo ? (details.pmrfBackFromValueInfo || '—') : '—'}
                                        </div>
                                        <div className="col-span-3 p-2 flex items-center bg-white font-mono font-bold text-[10px] min-h-11 text-blue-700 text-left">
                                          {details.pmrfBackChangePersonalInfo ? (details.pmrfBackToValueInfo || '—') : '—'}
                                        </div>
                                      </div>

                                    </div>
                                  </div>

                                  {/* Attestation Area */}
                                  <div className="overflow-x-auto mt-4 select-none">
                                    <div className="min-w-[750px] border border-black grid grid-cols-12 divide-x divide-black bg-white">
                                      
                                      {/* Attestation Text */}
                                      <div className="col-span-8 p-3.5 flex flex-col justify-between font-sans text-left text-black bg-white">
                                        <div className="text-[7.5px] text-black text-justify leading-relaxed normal-case">
                                          <p className="font-bold">
                                            Under penalty of law, I hereby attest that the information provided, including the documents I have attached to this form, are true and accurate to the best of my knowledge. I agree and authorize PhilHealth for the subsequent validation, verification and for other data sharing purposes only under the following circumstances:
                                          </p>
                                          <ul className="list-disc pl-4 mt-1 space-y-0.5 font-bold">
                                            <li>As necessary for the proper execution of processes related to the legitimate and declared purpose;</li>
                                            <li>The use or disclosure is reasonably necessary, required or authorized by or under the law; and,</li>
                                            <li>Adequate security measures are employed to protect my information.</li>
                                          </ul>
                                        </div>

                                        {/* Signature / Thumb subgrid */}
                                        <div className="grid grid-cols-12 gap-2 mt-4 pt-4 border-t border-dashed border-gray-300">
                                          
                                          {/* Signature Fields (Maximized) */}
                                          <div className="col-span-12 flex flex-col justify-end pb-1 text-center">
                                            <div className="flex gap-4">
                                              <div className="flex-1 flex flex-col justify-end items-center">
                                                <div className="w-full border-b border-black pb-0.5 overflow-hidden flex items-center justify-center h-16 bg-white">
                                                  {(() => {
                                                    const sameAsFront = details.pmrfBackSameAsFront !== false;
                                                    const sig = sameAsFront 
                                                      ? (h.patientSignature || details.patientSignature) 
                                                      : details.pmrfBackSignature;
                                                    
                                                    if (sig) {
                                                      return <img src={sig} className="max-h-16 w-auto object-contain filter contrast-125 saturate-0" alt="Representative Signature" referrerPolicy="no-referrer" />;
                                                    }
                                                    return <span className="text-[8px] text-gray-400 font-bold italic font-sans normal-case">No Signature Captured</span>;
                                                  })()}
                                                </div>
                                                <span className="text-[7px] font-black mt-1.5 text-black font-sans leading-none block uppercase">
                                                  Member's Signature over Printed Name
                                                </span>
                                              </div>

                                              <div className="w-[120px] flex flex-col justify-end items-center">
                                                <div className="w-full border-b border-black text-[10px] font-bold uppercase pb-0.5 text-center text-black h-16 flex items-end justify-center font-mono">
                                                  {details.pmrfBackSignatureDate || h.createdAt?.substring(0, 10) || new Date().toISOString().substring(0, 10)}
                                                </div>
                                                <span className="text-[7px] font-black mt-1.5 text-black font-sans leading-none block uppercase">
                                                  Date
                                                </span>
                                              </div>
                                            </div>
                                          </div>



                                        </div>
                                      </div>

                                      {/* Right side: Use Only */}
                                      <div className="col-span-4 flex flex-col bg-[#f4f7f4]/40 h-full font-sans text-left text-black">
                                        <div className="bg-[#dee5db] border-b border-black text-center font-extrabold text-[10px] py-2 tracking-wider uppercase font-sans text-black select-none">
                                          FOR PHILHEALTH USE ONLY
                                        </div>
                                        <div className="p-3.5 flex flex-col justify-between flex-1 select-none text-black">
                                          <div className="text-[9.5px] font-extrabold tracking-wide text-black text-left mb-2 underline leading-none uppercase">
                                            RECEIVED BY:
                                          </div>
                                          <div className="flex flex-col gap-3 ml-0.5">
                                            <div className="flex flex-col text-left">
                                              <span className="text-[7.5px] font-extrabold text-black uppercase leading-none mb-0.5">Full Name:</span>
                                              <span className="border-b border-black text-[9.5px] font-bold uppercase pb-0.5 text-black min-h-5 flex items-end font-mono">
                                                {details.pmrfBackReceivedByFullName || 'OFFICER IN-CHARGE'}
                                              </span>
                                            </div>
                                            <div className="flex flex-col text-left text-black">
                                              <span className="text-[7.5px] font-extrabold text-black uppercase leading-none mb-0.5">PRO/LHIO/Branch:</span>
                                              <span className="border-b border-black text-[9.5px] font-bold uppercase pb-0.5 text-black min-h-5 flex items-end font-mono">
                                                {details.pmrfBackReceivedByBranch || 'PAGADIAN BRANCH'}
                                              </span>
                                            </div>
                                            <div className="flex flex-col text-left text-black">
                                              <span className="text-[7.5px] font-extrabold text-black uppercase leading-none mb-0.5">Date & Time:</span>
                                              <span className="border-b border-black text-[9.5px] font-bold uppercase pb-0.5 text-black min-h-5 flex items-end font-mono">
                                                {(() => {
                                                  const dt = details.pmrfBackReceivedByDateTime;
                                                  if (dt) return dt.replace("T", " ");
                                                  return h.createdAt?.replace("Z", "").replace("T", " ") || "2026-06-06 12:00";
                                                })()}
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                      </div>

                                    </div>
                                  </div>

                                  {/* INSTRUCTIONS */}
                                  <div className="mt-6 pt-5 border-t border-black normal-case font-sans text-[9px] text-justify text-black leading-relaxed space-y-4 select-none bg-white">
                                    <div className="text-center font-extrabold text-[12px] underline tracking-widest block uppercase mb-4 text-black font-sans">
                                      INSTRUCTIONS
                                    </div>
                                    <ol className="list-none space-y-2.5 text-black text-left">
                                      <li className="flex items-start">
                                        <span className="w-5 font-extrabold shrink-0">1.</span>
                                        <span>All information should be written in UPPER CASE/CAPITAL LETTERS. If the information is not applicable, write "N/A."</span>
                                      </li>
                                      <li className="flex items-start">
                                        <span className="w-5 font-extrabold shrink-0">2.</span>
                                        <span>All fields are mandatory unless indicated as optional. By affixing your signature, you certify the truthfulness and accuracy of all information provided.</span>
                                      </li>
                                      <li className="flex items-start">
                                        <span className="w-5 font-extrabold shrink-0">3.</span>
                                        <span>A properly accomplished PMRF shall be accompanied by a valid proof of identity for first time registrants, and supporting documents to establish relationship between member and dependent/s for updating or request for amendment.</span>
                                      </li>
                                      <li className="flex items-start">
                                        <span className="w-5 font-extrabold shrink-0">4.</span>
                                        <span>On the PURPOSE, check the appropriate box if for <span className="font-extrabold underline">Registration</span> or for <span className="font-extrabold underline">Updating/Amendment</span> of information.</span>
                                      </li>
                                      <li className="flex items-start">
                                        <span className="w-5 font-extrabold shrink-0">5.</span>
                                        <span>Indicate preferred KonSuLTa provider near the place of work or residence.</span>
                                      </li>
                                      <li className="flex flex-col">
                                        <div className="flex items-start">
                                          <span className="w-5 font-extrabold shrink-0">6.</span>
                                          <span>For PERSONAL DETAILS, all name entries should follow the format given below. Check the appropriate box if registrant has no middle name and/or with single name (mononym).</span>
                                        </div>
                                        <div className="w-full max-w-[550px] mx-auto my-3 grid grid-cols-4 text-center border-t border-b border-slate-200 py-2.5 px-2 bg-slate-50/50 rounded">
                                          <div className="flex flex-col">
                                            <span className="text-[7.5px] font-black text-black">LAST NAME</span>
                                            <span className="text-[9.5px] text-slate-700 font-extrabold mt-0.5">SANTOS</span>
                                          </div>
                                          <div className="flex flex-col">
                                            <span className="text-[7.5px] font-black text-black">FIRST NAME</span>
                                            <span className="text-[9.5px] text-slate-700 font-extrabold mt-0.5">JUAN ANDRES</span>
                                          </div>
                                          <div className="flex flex-col">
                                            <span className="text-[7.5px] font-black text-black">NAME EXTENSION (JR./SR./III)</span>
                                            <span className="text-[9.5px] text-slate-700 font-extrabold mt-0.5">III</span>
                                          </div>
                                          <div className="flex flex-col">
                                            <span className="text-[7.5px] font-black text-black">MIDDLE NAME</span>
                                            <span className="text-[9.5px] text-slate-700 font-extrabold mt-0.5">DELA CRUZ</span>
                                          </div>
                                        </div>
                                      </li>
                                      <li className="flex items-start">
                                        <span className="w-5 font-extrabold shrink-0">7.</span>
                                        <span>Indicate registrant's/member's name as it appears in the birth certificate.</span>
                                      </li>
                                      <li className="flex items-start">
                                        <span className="w-5 font-extrabold shrink-0">8.</span>
                                        <span>The full mother's maiden name of registrant/member must be indicated as it appears in the birth certificate.</span>
                                      </li>
                                      <li className="flex items-start">
                                        <span className="w-5 font-extrabold shrink-0">9.</span>
                                        <span>Indicate the full name of spouse if registrant/member is married.</span>
                                      </li>
                                      <li className="flex items-start">
                                        <span className="w-5 font-extrabold shrink-0">10.</span>
                                        <span>Indicate the complete permanent and mailing addresses and contact numbers.</span>
                                      </li>
                                      <li className="flex items-start">
                                        <span className="w-5 font-extrabold shrink-0">11.</span>
                                        <span>For updating/amendment, check the appropriate box to be updated/amended and indicate the correct data.</span>
                                      </li>
                                      <li className="flex items-start">
                                        <span className="w-5 font-extrabold shrink-0">12.</span>
                                        <span>For MEMBER TYPE, check the appropriate box which best describes your current membership status.</span>
                                      </li>
                                      <li className="flex items-start">
                                        <span className="w-5 font-extrabold shrink-0">13.</span>
                                        <span>For Direct Contributors, except employed, sea-based migrant workers and lifetime members, indicate the profession, monthly income and proof of income to be submitted.</span>
                                      </li>
                                      <li className="flex items-start">
                                        <span className="w-5 font-extrabold shrink-0">14.</span>
                                        <span>For Self-earning individuals, Kasambahays and Family Drivers, indicate the actual monthly income in the space provided.</span>
                                      </li>
                                      <li className="flex items-start">
                                        <span className="w-5 font-extrabold shrink-0">15.</span>
                                        <span>In declaring dependents, provide the full name of the living spouse, children below 21 years old, and parents who are 60 years old and above totally dependent to the member.</span>
                                      </li>
                                      <li className="flex items-start">
                                        <span className="w-5 font-extrabold shrink-0">16.</span>
                                        <span>Dependents with disability shall be registered as principal members in accordance with Republic Act 11228 on mandatory PhilHealth coverage for all persons with disability (PWD).</span>
                                      </li>
                                      <li className="flex items-start">
                                        <span className="w-5 font-extrabold shrink-0">17.</span>
                                        <span>The registrant must affix his/her signature over printed name (or right thumbmark if unable to write) and indicate the date when the PMRF was signed.</span>
                                      </li>
                                    </ol>
                                  </div>

                                </div>
                              </div>
                            </div>
                            ) : activeTab === 'FPE' ? (
                              <div className="space-y-4 animate-fade-in text-slate-800 w-full">
                                {/* Clear Patient Full Name Display Card */}
                                <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                  <div>
                                    <span className="text-[9px] uppercase tracking-wider font-extrabold text-sky-600 block">PATIENT FULL NAME</span>
                                    <strong className="text-sm font-extrabold text-sky-950 uppercase">{pcsf.fullName || h.householdHead}</strong>
                                  </div>
                                  <div className="sm:text-right">
                                    <span className="text-[9px] uppercase tracking-wider font-extrabold text-sky-600 block">MEMBER TYPE</span>
                                    <strong className="text-slate-705 text-slate-800 font-mono text-xs font-bold bg-white border border-sky-200 px-2 py-0.5 rounded leading-none block mt-1">{memberType}</strong>
                                  </div>
                                </div>

                                <div className="border-b border-slate-300 pb-2 flex justify-between items-center text-slate-850">
                                  <div>
                                    <h4 className="font-extrabold uppercase text-xs text-slate-900">First Patient Encounter (FPE) Clinical Profile</h4>
                                    <p className="text-[9px] text-slate-500 font-medium">Primary care encounter records for verification queue</p>
                                  </div>
                                  <div className="text-right">
                                    <span className="font-extrabold block text-[9px] text-slate-400 uppercase">Consultation Code</span>
                                    <strong className="font-mono text-xs text-sky-800 bg-sky-50 px-2 py-0.5 rounded border font-extrabold">KONSULTA FPE-01</strong>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {/* Box 1: Verified Vital Signs */}
                                  <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3 shadow-xs">
                                    <span className="font-extrabold text-blue-900 border-b pb-1 text-[10px] uppercase block tracking-wider">🌡️ Verified Vital Signs</span>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                                      <div className="bg-slate-50 p-2 rounded border">
                                        <span className="text-slate-500 block text-[9px]">Blood Pressure</span>
                                        <strong className="text-slate-800 font-mono text-[11px]">{fpe.vitalBp || '120/80'} mmHg</strong>
                                      </div>
                                      <div className="bg-slate-50 p-2 rounded border">
                                        <span className="text-slate-500 block text-[9px]">Body Temp</span>
                                        <strong className="text-slate-800 font-mono text-[11px]">{fpe.vitalTemp || '36.5'} °C</strong>
                                      </div>
                                      <div className="bg-slate-50 p-2 rounded border">
                                        <span className="text-slate-500 block text-[9px]">Heart Rate</span>
                                        <strong className="text-slate-800 font-mono text-[11px]">{fpe.vitalHr || '72'} bpm</strong>
                                      </div>
                                      <div className="bg-slate-50 p-2 rounded border">
                                        <span className="text-slate-500 block text-[9px]">Respiratory Rate</span>
                                        <strong className="text-slate-800 font-mono text-[11px]">{fpe.vitalRr || '16'} cpm</strong>
                                      </div>
                                      <div className="bg-slate-50 p-2 rounded border">
                                        <span className="text-slate-500 block text-[9px]">Weight & Height</span>
                                        <strong className="text-slate-800 font-mono text-[11px]">{fpe.vitalWt || '65'} kg / {fpe.vitalHt || '165'} cm</strong>
                                      </div>
                                      <div className="bg-slate-50 p-2 rounded border">
                                        <span className="text-slate-505 block text-[9px]">Calculated BMI</span>
                                        <strong className="text-indigo-700 font-mono text-[11px]">{fpe.vitalBmi || '23.88'}</strong>
                                      </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-3 gap-2 text-[10px] bg-slate-50 p-2.5 rounded border border-dashed border-slate-200">
                                      <div>Waist: <strong className="text-slate-800 font-mono">{fpe.vitalWaist || '32'} in</strong></div>
                                      <div>Upper Arm: <strong className="text-slate-800 font-mono">{fpe.vitalUpperArm || '28'} cm</strong></div>
                                      <div>Mid Arm: <strong className="text-slate-800 font-mono">{fpe.vitalMidArm || '27'} cm</strong></div>
                                    </div>
                                  </div>

                                  {/* Box 2: Chief Complaints */}
                                  <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3.5 shadow-xs">
                                    <div>
                                      <span className="font-extrabold text-blue-900 border-b pb-1 text-[10px] uppercase block tracking-wider mb-2">😷 Present Chief Complaints</span>
                                      <div className="flex gap-1.5 flex-wrap">
                                        {fpe.ccNone && <span className="px-2 py-0.5 bg-slate-100 text-slate-500 font-bold rounded text-[9px] uppercase border">No Complaints</span>}
                                        {fpe.ccFever && <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-bold rounded text-[9px] uppercase border border-amber-300">Fever</span>}
                                        {fpe.ccCough && <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-bold rounded text-[9px] uppercase border border-amber-300">Cough</span>}
                                        {fpe.ccBodyPain && <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-bold rounded text-[9px] uppercase border border-amber-300">Body Pain</span>}
                                        {fpe.ccDyspnea && <span className="px-2 py-0.5 bg-red-100 text-red-800 font-bold rounded text-[9px] uppercase border border-red-300 animate-pulse">Dyspnea / Short Breath</span>}
                                        {fpe.ccOthers && <span className="px-2 py-0.5 bg-blue-100 text-blue-800 font-bold rounded text-[9px] uppercase border border-blue-200">Other: {fpe.ccOthers}</span>}
                                        {(!fpe.ccNone && !fpe.ccFever && !fpe.ccCough && !fpe.ccBodyPain && !fpe.ccDyspnea && !fpe.ccOthers) && (
                                          <span className="px-2 py-0.5 bg-slate-100 text-slate-500 font-bold rounded text-[9px] uppercase border">No Complaints</span>
                                        )}
                                      </div>
                                    </div>

                                    <div>
                                      <span className="font-extrabold text-blue-900 border-b pb-1 text-[10px] uppercase block tracking-wider mb-2">💊 Active Medications</span>
                                      <div className="bg-slate-550 bg-slate-50 p-2.5 rounded border text-xs">
                                        {fpe.medNone === false && fpe.medSpecify ? (
                                          <div className="space-y-1">
                                            <span className="text-[9px] text-indigo-705 text-indigo-700 font-extrabold block">MAINTENANCE PHARMACEUTICAL DRUGS</span>
                                            <strong className="text-[#b91c1c] text-xs block font-mono">{fpe.medSpecify}</strong>
                                          </div>
                                        ) : (
                                          <span className="text-slate-500 font-bold">Patient is not taking any long-term drugs or maintenance medications.</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  {/* Medical History */}
                                  <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2 shadow-xs">
                                    <span className="font-extrabold text-blue-900 border-b pb-1 text-[10px] uppercase block tracking-wider">🏥 Medical History</span>
                                    <div className="flex flex-wrap gap-1.5 pt-1">
                                      {fpe.mhNone && <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded text-[9px] uppercase border border-emerald-300">Clean History</span>}
                                      {fpe.mhHypertension && <span className="px-2 py-0.5 bg-red-100 text-red-800 font-bold rounded text-[9px] uppercase border border-red-200">Hypertension</span>}
                                      {fpe.mhDiabetes && <span className="px-2 py-0.5 bg-red-100 text-red-800 font-bold rounded text-[9px] uppercase border border-red-200">Diabetes</span>}
                                      {fpe.mhAstmaCopd && <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-bold rounded text-[9px] uppercase border border-amber-200">Asthma/COPD</span>}
                                      {fpe.mhHeart && <span className="px-2 py-0.5 bg-red-100 text-red-800 font-bold rounded text-[9px] uppercase border border-red-200">Heart Disease</span>}
                                      {fpe.mhStroke && <span className="px-2 py-0.5 bg-red-100 text-red-800 font-bold rounded text-[9px] uppercase border border-red-200">Stroke History</span>}
                                      {fpe.mhCancer && <span className="px-2 py-0.5 bg-rose-200 text-rose-900 font-bold rounded text-[9px] uppercase border border-rose-300">Cancer</span>}
                                      {fpe.mhTb && <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-bold rounded text-[9px] uppercase border border-amber-200">Tuberculosis</span>}
                                      {fpe.mhKidney && <span className="px-2 py-0.5 bg-red-100 text-red-800 font-bold rounded text-[9px] uppercase border border-red-200">Kidney Disease</span>}
                                      {(!fpe.mhNone && !fpe.mhHypertension && !fpe.mhDiabetes && !fpe.mhAstmaCopd && !fpe.mhHeart && !fpe.mhStroke && !fpe.mhCancer && !fpe.mhTb && !fpe.mhKidney) && (
                                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded text-[9px] uppercase border border-emerald-300">Clean History</span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Family History */}
                                  <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2 shadow-xs">
                                    <span className="font-extrabold text-blue-900 border-b pb-1 text-[10px] uppercase block tracking-wider">🧬 Family Medical History</span>
                                    <div className="flex flex-wrap gap-1.5 pt-1">
                                      {fpe.fhNone && <span className="px-2 py-0.5 bg-slate-100 text-slate-500 font-bold rounded text-[9px] uppercase border">No Family Heredity</span>}
                                      {fpe.fhHypertension && <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-bold rounded text-[9px] uppercase border border-amber-250">Hypertension</span>}
                                      {fpe.fhDiabetes && <span className="px-2 py-0.5 bg-amber-100 text-amber-805 text-amber-800 font-bold rounded text-[9px] uppercase border border-amber-250">Diabetes</span>}
                                      {fpe.fhHeart && <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-bold rounded text-[9px] uppercase border border-amber-250">Heart Failure</span>}
                                      {fpe.fhCancer && <span className="px-2 py-0.5 bg-rose-100 text-rose-800 font-bold rounded text-[9px] uppercase border border-rose-200">Malignancies</span>}
                                      {(!fpe.fhNone && !fpe.fhHypertension && !fpe.fhDiabetes && !fpe.fhHeart && !fpe.fhCancer) && (
                                        <span className="px-2 py-0.5 bg-slate-100 text-slate-500 font-bold rounded text-[9px] uppercase border">No Family Heredity</span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Social History */}
                                  <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2 shadow-xs">
                                    <span className="font-extrabold text-blue-900 border-b pb-1 text-[10px] uppercase block tracking-wider">🚬 Lifestyle & Social History</span>
                                    <div className="space-y-1.5 pt-1 leading-none text-[10px]">
                                      <div className="flex justify-between items-center bg-slate-50 p-1 px-2 rounded border border-slate-100">
                                        <span>Smoking Habit:</span>
                                        <strong className={`font-mono uppercase ${fpe.shSmoking === 'Current' ? 'text-red-600 font-extrabold' : fpe.shSmoking === 'Former' ? 'text-amber-600 font-extrabold' : 'text-slate-500'}`}>
                                          {fpe.shSmoking || 'N/A'}
                                        </strong>
                                      </div>
                                      <div className="flex justify-between items-center bg-slate-50 p-1 px-2 rounded border border-slate-100">
                                        <span>Alcohol Consumption:</span>
                                        <strong className={`font-mono uppercase ${fpe.shAlcohol === 'Regular' ? 'text-red-600 font-extrabold' : fpe.shAlcohol === 'Occasional' ? 'text-amber-600 font-extrabold' : 'text-slate-500'}`}>
                                          {fpe.shAlcohol || 'N/A'}
                                        </strong>
                                      </div>
                                      <div className="flex justify-between items-center bg-slate-50 p-1 px-2 rounded border border-slate-100">
                                        <span>Primary Occupation:</span>
                                        <strong className="font-mono uppercase text-slate-800 font-extrabold">
                                          {fpe.shOccupation || 'N/A'}
                                        </strong>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Plan / Physical Exam highlights */}
                                <div className="bg-slate-900 text-white rounded-xl p-4 space-y-2">
                                  <span className="text-[10px] uppercase font-bold tracking-widest block text-sky-400 border-b border-sky-900/50 pb-1">📋 Primary Diagnosis, Assessment & Treatment Plan</span>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                                    <div>
                                      <span className="text-[9px] text-slate-400 block uppercase font-bold">Physical Exam Highlights</span>
                                      <p className="text-xs pt-1 font-sans leading-relaxed text-slate-200 whitespace-pre-line">{fpe.physicalExam || 'Completed with zero acute pathologies flagged.'}</p>
                                    </div>
                                    <div>
                                      <span className="text-[9px] text-slate-400 block uppercase font-bold">Medical Treatment & Follow-up Plan</span>
                                      <p className="text-xs pt-1 font-sans leading-relaxed text-slate-200 whitespace-pre-line">{fpe.assessmentPlan || 'Assign first patient encounter monitoring via primary care specialist clinic.'}</p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-4 animate-fade-in text-slate-800 w-full">
                                {/* Clear Patient Full Name Display Card */}
                                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                  <div>
                                    <span className="text-[9px] uppercase tracking-wider font-extrabold text-indigo-600 block">PATIENT FULL NAME</span>
                                    <strong className="text-sm font-extrabold text-indigo-950 uppercase">{pcsf.fullName || h.householdHead}</strong>
                                  </div>
                                  <div className="sm:text-right">
                                    <span className="text-[9px] uppercase tracking-wider font-extrabold text-indigo-600 block">MEMBER TYPE</span>
                                    <strong className="text-slate-705 text-slate-800 font-mono text-xs font-bold bg-white border border-indigo-200 px-2 py-0.5 rounded leading-none block mt-1">{memberType}</strong>
                                  </div>
                                </div>

                                <div className="border-b border-slate-300 pb-2 flex justify-between items-center text-slate-850">
                                  <div>
                                    <h4 className="font-extrabold uppercase text-xs text-slate-900">Primary Care Selection (PCSF) Preferences</h4>
                                    <p className="text-[9px] text-slate-500 font-medium">PhilHealth Primary Care Selection Form duplication data</p>
                                  </div>
                                  <div className="text-right">
                                    <span className="font-extrabold block text-[9px] text-slate-400 uppercase">Filing Category</span>
                                    <strong className="font-mono text-xs text-indigo-805 bg-indigo-50 px-2 py-0.5 rounded border font-extrabold uppercase">Provider selection</strong>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {/* Box 1: Registrar details */}
                                  <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3 shadow-xs">
                                    <span className="font-extrabold text-indigo-900 border-b pb-1 text-[10px] uppercase block tracking-wider">👤 Registering Individual</span>
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <span className="text-slate-405 block text-[9px] uppercase tracking-wider font-bold">Participant Option</span>
                                        <strong className="text-blue-800 font-mono text-[11px] uppercase p-1 bg-blue-50/50 rounded border border-blue-100 block mt-1 text-center font-bold">{pcsf.type || 'MEMBER'}</strong>
                                      </div>
                                      <div>
                                        <span className="text-slate-405 block text-[9px] uppercase tracking-wider font-bold">Filing Timestamp</span>
                                        <strong className="text-slate-850 text-slate-800 font-mono text-[11px] block mt-1">{pcsf.date || new Date().toLocaleDateString()}</strong>
                                      </div>
                                      <div className="col-span-2">
                                        <span className="text-slate-405 block text-[9px] uppercase tracking-wider font-bold">Primary Registrant Name</span>
                                        <strong className="text-slate-900 font-sans text-xs mt-0.5 block font-extrabold">{pcsf.fullName || h.householdHead}</strong>
                                      </div>
                                      <div className="col-span-2 bg-slate-50 p-2.5 rounded border">
                                        <span className="text-slate-405 block text-[9px] uppercase font-bold mb-1">Mailing Address Records</span>
                                        <p className="text-slate-800 font-semibold leading-relaxed">
                                          Barangay {pcsf.addressBarangay || h.barangay}, {pcsf.addressCity || 'Pagadian City'}, {pcsf.addressProvince || 'Zamboanga del Sur'}
                                        </p>
                                      </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                                      <div>Registered Contact No: <strong className="block text-slate-805 block text-slate-800 font-mono">{pcsf.contactNo || h.contactNumber || 'N/A'}</strong></div>
                                      <div>Registered Email: <strong className="block text-slate-705 block text-slate-700 font-semibold lowercase">{pcsf.email || 'N/A'}</strong></div>
                                    </div>
                                  </div>

                                  {/* Box 2: Provider preferences */}
                                  <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3 shadow-xs">
                                    <span className="font-extrabold text-indigo-900 border-b pb-1 text-[10px] uppercase block tracking-wider">🏢 Preferred Primary Care Provider Priorities</span>
                                    
                                    <div className="space-y-3">
                                      {pcsf.registerPcc !== false ? (
                                        <div className="p-3 bg-indigo-50/50 border border-indigo-200 rounded-lg space-y-1">
                                          <span className="text-[9px] font-black uppercase text-indigo-950 tracking-wider">Priority 1 Choice: (Primary Center)</span>
                                          <strong className="text-indigo-900 block text-xs">{pcsf.pcc1 || 'Saint Francis Clinic'}</strong>
                                          <span className="text-[10px] text-slate-505 text-slate-500 block">Address: {pcsf.pcc1Addr || 'San Francisco, Pagadian City, Zamboanga del Sur'}</span>
                                        </div>
                                      ) : (
                                        <div className="p-3 bg-red-50 text-red-000 text-red-800 border rounded-lg font-bold">
                                          ⚠️ No Primary Care Center Selected!
                                        </div>
                                      )}

                                      {pcsf.pcc2 && (
                                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                                          <span className="text-[9px] font-black uppercase text-slate-650 tracking-wider">Back-up Priority 2 Choice: (Secondary Center)</span>
                                          <strong className="text-slate-850 block text-xs">{pcsf.pcc2}</strong>
                                          <span className="text-[10px] text-slate-500 block">Address: {pcsf.pcc2Addr || 'N/A'}</span>
                                        </div>
                                      )}

                                      <div className="flex items-center gap-1.5 p-2 bg-slate-50 border rounded-lg text-[10px] text-slate-500">
                                        <span>Include declared family dependents under this PCC selection?</span>
                                        <strong className="uppercase font-mono text-slate-800 bg-white border px-1.5 py-0.5 rounded">
                                          {pcsf.registerDependents ? 'YES' : 'NO'}
                                        </strong>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Transfer Details Section */}
                                <div className="bg-slate-50 border p-4 rounded-xl space-y-3">
                                  <div className="flex items-center justify-between border-b pb-1.5">
                                    <span className="font-extrabold text-slate-700 text-[10px] uppercase block tracking-wider">🔄 Transfer / Inter-Clinic Migration Request Logs</span>
                                    <span className={`px-2 py-0.5 rounded font-extrabold text-[9px] uppercase border ${pcsf.transfer ? 'bg-amber-100 text-amber-805 text-amber-800 border-amber-300 animate-pulse' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                      {pcsf.transfer ? 'Active Change Request' : 'No Change Requested'}
                                    </span>
                                  </div>

                                  {pcsf.transfer ? (
                                    <div className="space-y-3">
                                      <div className="grid grid-cols-2 gap-4 text-xs">
                                        <div className="bg-white p-2.5 rounded border">
                                          <span className="text-slate-400 block text-[9px]">PREVIOUS PRIMARY CARE PROVIDER</span>
                                          <strong className="text-red-750 text-red-700 font-semibold block mt-0.5">{pcsf.prevPcc || 'N/A'}</strong>
                                        </div>
                                        <div className="bg-white p-2.5 rounded border">
                                          <span className="text-slate-400 block text-[9px]">REASON FOR PORTABILITY TRANSFER</span>
                                          <strong className="text-slate-855 text-slate-800 font-semibold block mt-0.5">Change of residence / closer proximity</strong>
                                        </div>
                                      </div>

                                      {pcsf.transferPcc1 && (
                                        <div className="p-3 bg-emerald-50/50 border border-emerald-250 border-emerald-250 rounded-lg space-y-1">
                                          <span className="text-[9px] font-black uppercase text-emerald-950 tracking-wider">Migrating To Priority Link 1:</span>
                                          <strong className="text-emerald-950 block text-xs">{pcsf.transferPcc1}</strong>
                                          <span className="text-[10px] text-slate-500 block">Address: {pcsf.transferPcc1Addr || 'Pagadian City'}</span>
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <p className="text-[10px] text-slate-400 leading-normal">
                                      Registrant is establishing a fresh primary health care coordinate record at SFC without moving from another provider. No historical registration transfers or inter-clinic relocations have been recorded on this file.
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}

                          </div>
                        );
                      })()}

                    {/* PHYSICAL ATTACHMENTS VIEW AREA FOR ADMIN REVIEW */}
                    <div className="p-4 bg-slate-50 border rounded-xl space-y-3">
                      <span className="font-extrabold text-slate-700 text-[10px] uppercase block tracking-wider flex items-center gap-1.5">
                        <Image className="h-4 w-4 text-emerald-600" />
                        Attached ID & Signed PDF Document Proof Scans:
                      </span>

                      {hasAttachment ? (
                        <div className="space-y-2">
                          <p className="text-[10px] text-slate-500 font-serif">
                            The following real document scans are loaded to prove eligibility. Hover or click preview to evaluate details at full resolution:
                          </p>
                          <div className="flex gap-4 flex-wrap">
                            {h.attachments.map((img, i) => {
                              const isObj = img && typeof img === 'object';
                              const fileData = isObj ? img.fileData : img;
                              const fullName = isObj ? img.fullName : 'Identity Scan';
                              const docType = isObj ? img.documentType : 'Verification File';
                              const fileName = isObj ? img.fileName : '';
                              const isPdf = fileData?.startsWith('data:application/pdf') || (fileName && fileName.toLowerCase().endsWith('.pdf'));

                              return (
                                <div key={i} className="flex flex-col items-center gap-1">
                                  <button 
                                    type="button"
                                    onClick={() => setViewingImage(fileData)}
                                    className="relative border-2 border-emerald-500 rounded-lg overflow-hidden h-24 w-24 block hover:scale-105 active:scale-95 transition group cursor-pointer focus:outline-none bg-slate-100"
                                    title="Click to view file in full-screen preview"
                                  >
                                    {isPdf ? (
                                      <div className="h-full w-full bg-white flex flex-col items-center justify-center p-2 text-center">
                                        <FileText className="h-10 w-10 text-red-500 mb-1" />
                                        <span className="text-[7px] font-black text-slate-500 truncate max-w-full font-mono">{fileName || 'PDF Document'}</span>
                                      </div>
                                    ) : (
                                      <img src={fileData} alt={fullName} className="h-full w-full object-cover" />
                                    )}
                                    <div className="absolute inset-0 bg-black/40 text-white font-extrabold opacity-0 group-hover:opacity-100 flex items-center justify-center text-[9px] transition">
                                      <Eye className="h-4 w-4" /> Full View
                                    </div>
                                  </button>
                                  <span className="text-[9px] font-bold text-slate-700 max-w-[100px] truncate block" title={fullName}>{fullName}</span>
                                  <span className="text-[7px] font-black uppercase tracking-wider text-slate-500">{docType === 'FPE/PCSF' ? 'FPE' : 'HH File'}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="bg-red-50 border border-red-150 p-3 rounded-lg flex items-center gap-3 text-red-800 font-semibold font-serif text-[11px]">
                          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
                          <div>
                            <strong className="block text-red-950">WARNING: No Attached Credentials Found!</strong>
                            Please review if there is an offline verification proof documented prior to approving this registration request.
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Comment formulation and Evaluation controls */}
                    <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col md:flex-row gap-3 items-end">
                      <div className="w-full">
                        <label className="text-[10px] text-slate-500 font-extrabold flex items-center gap-1.5 mb-1 uppercase tracking-wide">
                          <MessageSquare className="h-3.5 w-3.5 text-blue-600" /> Evaluator Remarks & Audit trail message
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Cleared health cards and coordinate references..."
                          value={remarksMap[h.id] !== undefined ? remarksMap[h.id] : (h.remarks || '')}
                          disabled={(h.approvalStatus === 'Approved' || h.approvalStatus === 'Disapproved') && !isRealMasterAdmin}
                          onChange={(e) => setRemarksMap({ ...remarksMap, [h.id]: e.target.value })}
                          className="bg-white border-2 border-slate-200 p-2.5 w-full rounded focus:outline-none focus:ring-2 focus:ring-[#1a56db] text-xs font-semibold text-slate-800 disabled:bg-slate-50 disabled:border-slate-100 disabled:text-slate-400"
                        />
                      </div>

                      <div className="flex gap-2.5 flex-wrap items-center self-stretch md:self-auto shrink-0 font-bold text-xs text-white">
                        {h.approvalStatus === 'Approved' || h.approvalStatus === 'Disapproved' ? (
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-600 italic font-mono font-bold text-[10px] flex items-center justify-center gap-1">
                              ℹ️ Review Settled: {h.approvalStatus.toUpperCase()}
                            </div>
                            {isRealMasterAdmin && (
                              <button
                                onClick={() => handleApproveAction(h.id, 'RevertPending')}
                                className="bg-amber-500 hover:bg-amber-600 font-extrabold px-4 py-3 text-white flex items-center justify-center gap-1 cursor-pointer rounded-xl transition shadow-sm"
                                title="Revert this approved/returned file back to Pending status"
                              >
                                ⏳ Revert to Pending
                              </button>
                            )}
                          </div>
                        ) : (
                          <>
                            {isRealMasterAdmin && (
                              <button
                                onClick={() => handleDeleteSubmission(h.id, h.householdHead)}
                                className="flex-1 bg-red-600 hover:bg-red-700 font-bold px-4 py-3 text-white flex items-center justify-center gap-1 cursor-pointer rounded-xl transition"
                                title="Delete Submission permanently"
                              >
                                🗑️ Delete
                              </button>
                            )}
                            <button
                              onClick={() => handleApproveAction(h.id, 'Disapprove')}
                              className="flex-1 btn-3d-danger px-4 py-3 text-white flex items-center justify-center gap-1 cursor-pointer font-bold"
                            >
                              <XCircle className="h-4 w-4" /> Disapprove
                            </button>
                            <button
                              onClick={() => handleApproveAction(h.id, 'Approve')}
                              className="flex-1 btn-3d-primary px-5 py-3 text-white flex items-center justify-center gap-1.5 cursor-pointer font-extrabold"
                            >
                              <CheckCircle2 className="h-4 w-4" /> Approve File
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                        </div>
                      )}
                    </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* MODULE 4: AUDIT TRAIL LOGS */}
      {tabType === 'audit' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-1.5 leading-none">
                <Table className="h-5 w-5 text-blue-600 animate-pulse" />
                Clinical Action Audit Logs
              </h2>
              <p className="text-slate-400 text-[10px] mt-1">A complete real-time tracking audit of all database registrations, deletions and reviews</p>
            </div>
            
            <div className="flex items-center gap-2">
              {isSystemMasterAdmin && (
                <button
                  onClick={handleClearLogs}
                  className="px-3 py-1.5 bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 hover:text-red-700 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all duration-200 flex items-center gap-1.5 cursor-pointer hover:shadow-xs active:scale-95"
                  title="Permanently clear clinical action audit logs"
                >
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Clear Logs
                </button>
              )}
              <button 
                onClick={fetchRequiredData} 
                className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition anim"
                title="Refresh audit trail logs"
              >
                <RefreshCw className="h-4 w-4 text-slate-500" />
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-slate-400 pointer-events-none">
                <Search className="h-4 w-4" />
              </span>
              <input
                type="text"
                placeholder="Filter audit trail events..."
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                className="bg-white text-slate-705 border border-slate-200 rounded-lg py-2 pl-8 pr-2 w-full sm:w-64 focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap gap-1.5 text-[10px]">
              <button
                type="button"
                onClick={() => setSelectedAuditModule('all')}
                className={`px-2.5 py-1 rounded-full font-bold cursor-pointer transition ${
                  selectedAuditModule === 'all' ? 'bg-slate-800 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Modules
              </button>
              <button
                type="button"
                onClick={() => setSelectedAuditModule('households')}
                className={`px-2.5 py-1 rounded-full font-bold cursor-pointer transition ${
                  selectedAuditModule === 'households' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                Households & Approvals
              </button>
              <button
                type="button"
                onClick={() => setSelectedAuditModule('groups')}
                className={`px-2.5 py-1 rounded-full font-bold cursor-pointer transition ${
                  selectedAuditModule === 'groups' ? 'bg-blue-600 text-white shadow-xs' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                }`}
              >
                Group Settings
              </button>
              <button
                type="button"
                onClick={() => setSelectedAuditModule('administrative')}
                className={`px-2.5 py-1 rounded-full font-bold cursor-pointer transition ${
                  selectedAuditModule === 'administrative' ? 'bg-purple-600 text-white shadow-xs' : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                }`}
              >
                Demographics & Limits
              </button>
              <button
                type="button"
                onClick={() => setSelectedAuditModule('auth')}
                className={`px-2.5 py-1 rounded-full font-bold cursor-pointer transition ${
                  selectedAuditModule === 'auth' ? 'bg-amber-600 text-white shadow-xs' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                }`}
              >
                Logins & Accounts
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-solid border-blue-600 border-r-transparent"></div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-100 overflow-x-auto shadow-sm">
              <table className="w-full text-left border-collapse text-[11px] leading-tight">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 h-10 text-[9px] uppercase font-semibold text-slate-500 pl-4">
                    <th className="py-2 pl-4">Audit ID</th>
                    <th className="py-2">System Module</th>
                    <th className="py-2">Active Field Personnel</th>
                    <th className="py-2 text-left">Trigger Action Log</th>
                    <th className="py-2">Calendar Date</th>
                    <th className="py-2 pr-4 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 font-sans text-slate-600">
                  {auditLogs.filter(log => {
                    const matchesSearch = log.user.toLowerCase().includes(logSearch.toLowerCase()) || 
                                          log.action.toLowerCase().includes(logSearch.toLowerCase()) ||
                                          log.module.toLowerCase().includes(logSearch.toLowerCase());
                    if (!matchesSearch) return false;

                    if (selectedAuditModule === 'households') {
                      return ['Households', 'Household Approval'].includes(log.module);
                    }
                    if (selectedAuditModule === 'groups') {
                      return ['Group Management', 'Payroll Settlement'].includes(log.module);
                    }
                    if (selectedAuditModule === 'administrative') {
                      return ['Administrative', 'Settings'].includes(log.module);
                    }
                    if (selectedAuditModule === 'auth') {
                      return ['Authentication', 'Account Management', 'ProfileSettings'].includes(log.module);
                    }
                    return true;
                  }).map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition">
                      <td className="py-3 pl-4 font-mono font-medium text-slate-400 text-[10px]">{log.id}</td>
                      <td className="py-3 font-semibold text-blue-750">
                        <span className="bg-blue-50 px-1.5 py-0.5 rounded text-[9.5px]">
                          {log.module}
                        </span>
                      </td>
                      <td className="py-3 font-extrabold text-slate-800">{log.user}</td>
                      <td className="py-3 font-medium text-slate-600 text-left">{log.action}</td>
                      <td className="py-3 font-mono text-slate-400">{log.date}</td>
                      <td className="py-3 pr-4 text-right font-mono text-slate-400">{log.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* HIGH-DESIGN CUSTOM CONFIRMATION POPUP MODAL */}
      {confirmModal?.isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          {/* Backdrop blur with dark glossiness */}
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity duration-300"
            onClick={() => setConfirmModal(null)}
          ></div>
          
          {/* Main Modal Card frame */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl relative max-w-md w-full overflow-hidden transform transition-all scale-100 duration-300 p-6 space-y-5">
            <div className="flex items-start gap-4">
              <span className="p-3 bg-red-50 text-red-600 rounded-2xl shadow-sm border border-red-100 mt-1 block">
                <ShieldAlert className="h-6 w-6 animate-pulse" />
              </span>
              <div className="space-y-1">
                <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                  {confirmModal.title}
                </h3>
                <span className="text-[10px] font-bold text-red-650 uppercase bg-red-50 border border-red-100 px-2.5 py-0.5 rounded tracking-wider">
                  Critical Action Required
                </span>
                <p className="text-slate-500 text-xs leading-relaxed pt-2">
                  {confirmModal.description}
                </p>
              </div>
            </div>

            {/* Custom High Design hover-effect Buttons list */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 hover:border-slate-300 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all duration-200 hover:shadow-sm"
              >
                Cancel Action
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className="px-5 py-2.5 bg-gradient-to-r from-red-600 to-rose-500 text-white rounded-xl font-extrabold text-[10px] uppercase tracking-wider transition-all duration-300 shadow-lg shadow-red-200/50 hover:shadow-red-300/80 hover:scale-[1.03] active:scale-95 cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM CENTERING ALERT POPUP MODAL */}
      {alertModal?.isOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/65 backdrop-blur-md" onClick={() => setAlertModal(null)}></div>
          <div className="bg-white rounded-3xl border border-slate-150 shadow-2xl relative max-w-sm w-full overflow-hidden p-6 space-y-4 text-center z-[10001] animate-fade-in animate-scale-up">
            <div className="flex flex-col items-center gap-3">
              {alertModal.type === 'success' ? (
                <span className="p-3 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100 block">
                  <Check className="h-8 w-8 animate-bounce" />
                </span>
              ) : (
                <span className="p-3 bg-rose-50 text-rose-650 rounded-full border border-rose-100 block">
                  <AlertCircle className="h-8 w-8 animate-pulse" />
                </span>
              )}
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">{alertModal.title}</h3>
              <p className="text-slate-500 text-xs leading-relaxed">{alertModal.description}</p>
            </div>
            <button
              onClick={() => setAlertModal(null)}
              className="w-full py-2.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-850 hover:shadow-md transition duration-150 cursor-pointer text-xs uppercase tracking-wide font-sans text-center"
            >
              Okay
            </button>
          </div>
        </div>
      )}

      {/* ACTION LOADING SCREEN OVERLAY */}
      {actionLoading && (
        <div className="fixed inset-0 z-[20000] flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white/10 p-8 rounded-3xl border border-white/10 shadow-2xl flex flex-col items-center gap-4 text-center max-w-sm mx-auto">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-4 border-t-blue-500 border-r-transparent border-b-blue-500/20 border-l-transparent animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center text-xl select-none">⚖️</div>
            </div>
            <div>
              <h3 className="text-white font-extrabold text-base tracking-tight">{actionLoading}</h3>
              <p className="text-slate-400 text-[10px] mt-1 uppercase tracking-wider font-semibold">Saint Francis Ledger Verification</p>
            </div>
          </div>
        </div>
      )}

      {/* FULL VIEW LIGHTBOX OVERLAY */}
      {viewingImage && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center z-[11000] p-4 text-white">
          <div className="absolute top-4 right-4 flex gap-3 z-50">
            <button
              onClick={() => {
                const link = document.createElement('a');
                link.href = viewingImage;
                link.download = `attachment_scan_${Date.now()}.${viewingImage.startsWith('data:application/pdf') ? 'pdf' : 'png'}`;
                link.click();
              }}
              className="bg-emerald-600 hover:bg-emerald-700 py-1.5 px-3 rounded text-[10px] uppercase font-bold text-white transition flex items-center gap-1 shadow cursor-pointer"
            >
              📥 Download Document
            </button>
            <button 
              onClick={() => setViewingImage(null)}
              className="bg-red-600 hover:bg-red-700 font-extrabold py-1 px-3 text-sm rounded cursor-pointer transition text-white"
            >
              ✕ Close
            </button>
          </div>
          <div className="w-full max-w-4xl h-[75vh] flex items-center justify-center relative bg-slate-950 rounded-2xl overflow-hidden shadow-2xl p-2 border border-slate-800">
            {viewingImage.startsWith('data:application/pdf') ? (
              <div className="flex flex-col items-center justify-center p-6 text-center space-y-4 bg-slate-950/40 rounded-xl max-w-lg">
                <FileText className="h-16 w-16 text-red-500 animate-pulse" />
                <div className="space-y-1.5">
                  <h3 className="font-extrabold text-white text-sm">Signed PDF Document Proof Scan</h3>
                  <p className="text-slate-400 text-[10.5px] leading-relaxed">
                    Local browser security sandbox prevents displaying embedded PDF files directly. Click below to download or view the official PDF scan document securely in a new tab:
                  </p>
                </div>
                <div className="flex gap-2 w-full pt-2 justify-center">
                  <a 
                    href={viewingImage} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="bg-blue-650 hover:bg-blue-750 text-[10px] font-black uppercase text-white px-4 py-2.5 rounded-lg flex items-center gap-1.5 shadow active:translate-y-0.5 transition cursor-pointer select-none"
                  >
                    🔗 Open in New Tab
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = viewingImage;
                      link.download = `attachment_scan_${Date.now()}.pdf`;
                      link.click();
                    }}
                    className="bg-slate-800 hover:bg-slate-700 text-[10px] font-black uppercase text-white px-4 py-2.5 rounded-lg flex items-center gap-1.5 shadow active:translate-y-0.5 transition cursor-pointer select-none"
                  >
                    📥 Download PDF
                  </button>
                </div>
              </div>
            ) : (
              <img 
                referrerPolicy="no-referrer" 
                src={viewingImage} 
                alt="Expanded identity verification scan" 
                className="object-contain max-h-[70vh] max-w-full rounded-lg"
              />
            )}
          </div>
          <p className="mt-4 text-slate-400 font-medium text-[11px] uppercase tracking-wider text-center">
            Verification Credential Document Preview - Admin Portal
          </p>
        </div>
      )}

      {/* PROCESSING RELOCATION OVERLAY SCREEN */}
      {isRelocating && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-[12000] flex flex-col items-center justify-center p-4">
          <div className="bg-white text-slate-900 rounded-3xl border border-slate-150 shadow-2xl overflow-hidden p-8 max-w-sm w-full text-center space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center justify-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shadow-inner relative">
                <span className="absolute inline-flex h-full w-full rounded-2xl bg-blue-400 opacity-20 animate-ping"></span>
                <span className="text-xl">🚚</span>
              </div>
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-solid border-blue-600 border-r-transparent"></div>
              <div className="space-y-1.5">
                <h3 className="text-base font-black tracking-tight text-slate-900 uppercase">Processing Relocation</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Moving household verification record to the selected Barangay Folder. Please keep this browser window open.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
