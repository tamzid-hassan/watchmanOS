import React, { useState, useEffect, useMemo, useDeferredValue } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  LayoutDashboard, 
  ClipboardList, 
  Settings, 
  Calendar, 
  Clock, 
  MapPin, 
  User, 
  Briefcase, 
  DollarSign, 
  ChevronRight, 
  Trash2, 
  CheckCircle2, 
  AlertCircle,
  Filter,
  X,
  Search,
  Download,
  Flame,
  ChevronLeft,
  ChevronDown,
  FileText,
  Info,
  Copy,
  Mail,
  Phone,
  LogOut
} from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { auth, db, googleProvider } from './firebase';
import { 
  signInWithPopup,
  signInWithRedirect,
  signOut, 
  onAuthStateChanged, 
  User as FirebaseUser,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  EmailAuthProvider,
  reauthenticateWithCredential,
  GoogleAuthProvider,
  reauthenticateWithPopup
} from 'firebase/auth';
import { collection, doc, onSnapshot, setDoc, deleteDoc, query, getDoc, where, orderBy, limit } from 'firebase/firestore';

import { ShiftManager } from './components/ShiftManager';
import { SettingsPane } from './components/SettingsPane';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo?: any[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- CONFIG & CONSTANTS ---
const APP_ID = 'watchman-os-v1';

// Settings State
export const initialSettings = {
  defaultRate: 28.50,
  currency: 'USD',
  currencySymbol: '$',
  dutyTypes: ['Static Guard', 'Mobile Patrol', 'Event Security', 'Escort', 'Retail Loss', 'Corporate'],
  agents: ['Independent', 'G4S', 'Securitas', 'Prosegur', 'Allied Universal'],
  locations: [],
  profileName: '',
  profileEmoji: '👤',
  personalPhone: '',
  personalEmail: ''
};

// --- SUB-COMPONENTS ---
const NavButton = ({ id, activeTab, icon: Icon, label, onClick }: any) => (
  <button 
    onClick={() => onClick(id)}
    className={`flex flex-col items-center justify-center w-full py-2 transition-all ${activeTab === id ? 'text-yellow-500' : 'text-zinc-500'}`}
  >
    <Icon size={20} strokeWidth={activeTab === id ? 2.5 : 2} />
    <span className="text-[10px] font-bold uppercase tracking-wider mt-1">{label}</span>
  </button>
);

const StatusBadge = ({ status }: { status: string }) => {
  const colors: Record<string, string> = {
    Paid: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/50',
    Unpaid: 'bg-red-500/10 text-red-500 border-red-500/50',
    Pending: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/50'
  };
  return (
    <span className={`text-[10px] font-black uppercase px-2 py-0.5 border rounded-sm tracking-tighter ${colors[status] || colors.Pending}`}>
      {status}
    </span>
  );
};

const App = () => {
  // --- STATE ---
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'reset'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
  
  const [activeTab, setActiveTab] = useState('shifts');
  const [shifts, setShifts] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingShift, setEditingShift] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [statusFilter, setStatusFilter] = useState('All');
  const [timeFilter, setTimeFilter] = useState('All Time');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [showFilters, setShowFilters] = useState(false);
  const [expandedShiftId, setExpandedShiftId] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void; requireReauth?: boolean; } | null>(null);
  const [alertDialog, setAlertDialog] = useState<{ isOpen: boolean; title: string; message: string } | null>(null);
  const [reauthPassword, setReauthPassword] = useState('');
  const [isReauthing, setIsReauthing] = useState(false);
  
  const [settings, setSettings] = useState(initialSettings);

  const [activeSettingView, setActiveSettingView] = useState(null);

  // Form State
  const initialFormState = {
    location: '',
    date: new Date().toISOString().split('T')[0],
    dutyType: 'Static Guard',
    clockIn: '18:00',
    clockOut: '06:00',
    breakMinutes: 0,
    rate: settings.defaultRate,
    status: 'Unpaid',
    supervisor: '',
    contractor: 'Independent',
    notes: '',
    paymentDate: ''
  };
  const [formData, setFormData] = useState(initialFormState);
  const [hasFetchedSettings, setHasFetchedSettings] = useState(false);

  // --- PERSISTENCE ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
      if (!currentUser) {
        setSettings(initialSettings);
        setHasFetchedSettings(false);
        setShifts([]);
        setFormData({
          location: '',
          date: new Date().toISOString().split('T')[0],
          dutyType: 'Static Guard',
          clockIn: '18:00',
          clockOut: '06:00',
          breakMinutes: 0,
          rate: initialSettings.defaultRate,
          status: 'Unpaid',
          supervisor: '',
          contractor: 'Independent',
          notes: '',
          paymentDate: ''
        });
      }
    });
    return () => unsubscribe();
  }, []);

  // User inactivity sign-out expiry
  useEffect(() => {
    if (!user) return;
    
    let inactivityTimer: any;
    const resetTimer = () => {
      clearTimeout(inactivityTimer);
      // 15 minutes of inactivity logs them out
      inactivityTimer = setTimeout(() => {
        signOut(auth);
        toast.info('Logged out due to inactivity');
      }, 15 * 60 * 1000);
    };

    const events = ['mousemove', 'keydown', 'scroll', 'click', 'touchstart'];
    events.forEach(e => window.addEventListener(e, resetTimer));
    resetTimer();

    return () => {
      clearTimeout(inactivityTimer);
      events.forEach(e => window.removeEventListener(e, resetTimer));
    };
  }, [user]);

  useEffect(() => {
    if (!isAuthReady || !user) return;

    const fetchSettings = async () => {
      const settingsPath = `users/${user.uid}/settings/preferences`;
      const userPath = `users/${user.uid}`;
      try {
        const docSnap = await getDoc(doc(db, settingsPath));
        if (docSnap.exists()) {
          setSettings(prev => ({ ...prev, ...docSnap.data() as any }));
        }
        // Ensure user document exists
        const userSnap = await getDoc(doc(db, userPath));
        if (!userSnap.exists()) {
          const userData: any = { uid: user.uid, createdAt: Date.now() };
          if (user.email) userData.email = user.email;
          await setDoc(doc(db, userPath), userData);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, settingsPath);
      } finally {
        setHasFetchedSettings(true);
      }
    };
    fetchSettings();
  }, [user, isAuthReady]);

  useEffect(() => {
    if (!isAuthReady || !user) return;

    const shiftsPath = `users/${user.uid}/shifts`;
    
    const constraints: any[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let startDateStr = '';
    let endDateStr = '';

    if (timeFilter === 'Weekly') {
      const d = new Date(today); d.setDate(d.getDate() - 7);
      startDateStr = d.toISOString().split('T')[0];
    } else if (timeFilter === 'Fortnightly') {
      const d = new Date(today); d.setDate(d.getDate() - 14);
      startDateStr = d.toISOString().split('T')[0];
    } else if (timeFilter === 'Monthly') {
      const d = new Date(today); d.setDate(d.getDate() - 30);
      startDateStr = d.toISOString().split('T')[0];
    } else if (timeFilter === 'Custom' && dateRange.start && dateRange.end) {
      startDateStr = dateRange.start;
      endDateStr = dateRange.end;
    }

    if (startDateStr) constraints.push(where('date', '>=', startDateStr));
    if (endDateStr) constraints.push(where('date', '<=', endDateStr));
    
    // Fallback limit for All Time to prevent crashing 5000+ shifts on client
    if (timeFilter === 'All Time') {
      constraints.push(limit(500));
    }

    const q = query(collection(db, shiftsPath), ...constraints);

    const unsubscribeShifts = onSnapshot(q, (snapshot) => {
      const loadedShifts = snapshot.docs.map(doc => doc.data());
      setShifts(loadedShifts as any);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, shiftsPath);
    });

    return () => {
      unsubscribeShifts();
    };
  }, [user, isAuthReady, timeFilter, dateRange]);

  // Debounced save
  useEffect(() => {
    if (!isAuthReady || !user || !hasFetchedSettings) return;
    const timeoutId = setTimeout(async () => {
      const settingsPath = `users/${user.uid}/settings/preferences`;
      try {
        await setDoc(doc(db, settingsPath), { ...settings, uid: user.uid });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, settingsPath);
      }
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [settings, user, isAuthReady, hasFetchedSettings]);

  // --- CALCULATIONS ---
  const calculateShiftMetrics = (s) => {
    const [inH, inM] = (s.clockIn || '00:00').split(':').map(Number);
    const [outH, outM] = (s.clockOut || '00:00').split(':').map(Number);
    
    let diffMinutes = (outH * 60 + outM) - (inH * 60 + inM);
    if (diffMinutes < 0) diffMinutes += 24 * 60;
    
    const grossHours = diffMinutes / 60;
    const breakHours = (s.breakMinutes || 0) / 60;
    const netHours = Math.max(0, grossHours - breakHours);
    const totalPay = netHours * (s.rate || 0);
    
    return { 
      netHours: netHours.toFixed(2), 
      totalPay: totalPay.toFixed(2),
      grossHours: grossHours.toFixed(2)
    };
  };

  const filteredShifts = useMemo(() => {
    return shifts
      .filter(s => {
        const matchesSearch = s.location.toLowerCase().includes(deferredSearchQuery.toLowerCase()) || 
                             (s.contractor || '').toLowerCase().includes(deferredSearchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'All' || s.status === statusFilter;
        
        let matchesTime = true;
        const shiftDate = new Date(s.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (timeFilter === 'Weekly') {
          const sevenDaysAgo = new Date(today);
          sevenDaysAgo.setDate(today.getDate() - 7);
          matchesTime = shiftDate >= sevenDaysAgo;
        } else if (timeFilter === 'Fortnightly') {
          const fourteenDaysAgo = new Date(today);
          fourteenDaysAgo.setDate(today.getDate() - 14);
          matchesTime = shiftDate >= fourteenDaysAgo;
        } else if (timeFilter === 'Monthly') {
          const thirtyDaysAgo = new Date(today);
          thirtyDaysAgo.setDate(today.getDate() - 30);
          matchesTime = shiftDate >= thirtyDaysAgo;
        } else if (timeFilter === 'Custom' && dateRange.start && dateRange.end) {
          const start = new Date(dateRange.start);
          const end = new Date(dateRange.end);
          matchesTime = shiftDate >= start && shiftDate <= end;
        }

        return matchesSearch && matchesStatus && matchesTime;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [shifts, deferredSearchQuery, statusFilter, timeFilter, dateRange]);

  const stats = useMemo(() => {
    const totalEarned = filteredShifts.reduce((acc, s) => acc + parseFloat(calculateShiftMetrics(s).totalPay), 0);
    const totalPaid = filteredShifts.filter(s => s.status === 'Paid').reduce((acc, s) => acc + parseFloat(calculateShiftMetrics(s).totalPay), 0);
    const unpaidCount = filteredShifts.filter(s => s.status !== 'Paid').length;
    const totalHours = filteredShifts.reduce((acc, s) => acc + parseFloat(calculateShiftMetrics(s).netHours), 0);
    return { totalEarned, totalPaid, unpaidCount, totalHours };
  }, [filteredShifts]);

  // --- ACTIONS ---
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail || !authPassword) return toast.error('Please fill in all fields');
    setIsSubmittingAuth(true);
    try {
      if (authMode === 'login') {
        await signInWithEmailAndPassword(auth, authEmail, authPassword);
      } else if (authMode === 'signup') {
        await createUserWithEmailAndPassword(auth, authEmail, authPassword);
      }
    } catch (error: any) {
      let errorMsg = error.message || 'Authentication failed';
      if (error.code === 'auth/invalid-email') errorMsg = 'Invalid email address format.';
      else if (error.code === 'auth/user-not-found') errorMsg = 'No user found with this email.';
      else if (error.code === 'auth/wrong-password') errorMsg = 'Incorrect password.';
      else if (error.code === 'auth/email-already-in-use') errorMsg = 'Email is already in use by another account.';
      else if (error.code === 'auth/weak-password') errorMsg = 'Password must be at least 6 characters.';
      else if (error.code === 'auth/invalid-credential') errorMsg = 'Invalid credentials. Please check your email and password.';
      toast.error(errorMsg);
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail) return toast.error('Please enter your email address');
    setIsSubmittingAuth(true);
    try {
      await sendPasswordResetEmail(auth, authEmail);
      toast.success('Password reset email sent!');
      setAuthMode('login');
    } catch (error: any) {
      let errorMsg = error.message || 'Failed to send reset email';
      if (error.code === 'auth/invalid-email') errorMsg = 'Invalid email address format.';
      else if (error.code === 'auth/user-not-found') errorMsg = 'No user found with this email.';
      toast.error(errorMsg);
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleSave = async (e: any) => {
    e.preventDefault();
    if (!user) return;
    
    const shiftId = editingShift ? (editingShift as any).id : crypto.randomUUID();
    const shiftData = { ...formData, id: shiftId, uid: user.uid };
    const shiftPath = `users/${user.uid}/shifts/${shiftId}`;

    try {
      await setDoc(doc(db, shiftPath), shiftData);
      
      // Save new location if it doesn't exist
      if (formData.location && settings.locations && !settings.locations.includes(formData.location)) {
        setSettings(prev => ({
          ...prev,
          locations: [...(prev.locations || []), formData.location]
        }));
      }

      if (editingShift) {
        toast.success('Shift updated successfully', { icon: <CheckCircle2 size={16} /> });
      } else {
        toast.success('New shift logged successfully', { icon: <Plus size={16} /> });
      }
      setIsAdding(false);
      setEditingShift(null);
      setFormData({
        ...initialFormState, 
        rate: settings.defaultRate,
        contractor: settings.agents[0] || 'Independent',
        dutyType: settings.dutyTypes[0] || 'Static Guard'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, shiftPath);
    }
  };

  const deleteShift = async (id: any) => {
    if (!user) return;
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Shift',
      message: 'Erase this record from logs?',
      onConfirm: async () => {
        const shiftPath = `users/${user.uid}/shifts/${id}`;
        try {
          await deleteDoc(doc(db, shiftPath));
          setExpandedShiftId(null);
          if (editingShift && (editingShift as any).id === id) {
            setIsAdding(false);
            setEditingShift(null);
          }
          setConfirmDialog(null);
          toast.error('Shift record deleted', { icon: <Trash2 size={16} /> });
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, shiftPath);
        }
      }
    });
  };

  const duplicateShift = async (shift: any) => {
    if (!user) return;
    const { id, ...rest } = shift;
    const newId = crypto.randomUUID();
    const newShift = { ...rest, id: newId, status: 'Unpaid', uid: user.uid };
    const shiftPath = `users/${user.uid}/shifts/${newId}`;
    try {
      await setDoc(doc(db, shiftPath), newShift);
      toast.info('Shift cloned successfully', { icon: <Copy size={16} /> });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, shiftPath);
    }
  };

  const togglePaid = async (id: any) => {
    if (!user) return;
    const shift = shifts.find((s: any) => s.id === id) as any;
    if (!shift) return;

    const isPaid = shift.status === 'Paid';
    const updatedShift = { 
      ...shift, 
      status: isPaid ? 'Unpaid' : 'Paid',
      paymentDate: isPaid ? '' : new Date().toISOString().split('T')[0]
    };
    const shiftPath = `users/${user.uid}/shifts/${id}`;

    try {
      await setDoc(doc(db, shiftPath), updatedShift);
      if (isPaid) {
        toast.warning('Shift marked as unpaid', { icon: <AlertCircle size={16} /> });
      } else {
        toast.success('Payment recorded', { icon: <DollarSign size={16} /> });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, shiftPath);
    }
  };

  const exportToCSV = () => {
    if (filteredShifts.length === 0) {
      setAlertDialog({
        isOpen: true,
        title: 'Export Failed',
        message: 'No data to export for the selected filters.'
      });
      return;
    }

    const headers = ['Date', 'Location', 'Duty Type', 'Agency', 'Clock In', 'Clock Out', 'Break (Mins)', 'Net Hours', 'Rate', 'Total Pay', 'Status', 'Supervisor', 'Notes'];
    const csvRows = [headers.join(',')];

    const escapeCSV = (str: any) => `"${(str || '').toString().replace(/"/g, '""')}"`;

    filteredShifts.forEach((s: any) => {
      const metrics = calculateShiftMetrics(s);
      const row = [
        s.date,
        escapeCSV(s.location),
        escapeCSV(s.dutyType),
        escapeCSV(s.contractor),
        s.clockIn,
        s.clockOut,
        s.breakMinutes,
        metrics.netHours,
        s.rate,
        metrics.totalPay,
        s.status,
        escapeCSV(s.supervisor),
        escapeCSV(s.notes)
      ];
      csvRows.push(row.join(','));
    });

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `watchman_shifts_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success(`Exported ${filteredShifts.length} shift logs to CSV`, { icon: <Download size={16} /> });
  };

  const handleNavClick = (id: string) => {
    setActiveTab(id);
    setActiveSettingView(null);
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="animate-pulse text-zinc-500 font-mono text-sm">LOADING WATCHMAN OS...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
        <Toaster theme="dark" position="top-center" richColors />
        <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 p-8 rounded-2xl space-y-8 shadow-2xl">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-yellow-500 rounded-2xl mx-auto flex items-center justify-center shadow-[0_0_30px_rgba(234,179,8,0.3)] mb-6">
              <Briefcase size={32} className="text-black" />
            </div>
            <h1 className="text-2xl font-black italic tracking-tighter uppercase text-white">Watchman <span className="text-yellow-500">OS</span></h1>
            <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest">
              {authMode === 'reset' ? 'Password Recovery' : 'Field Unit Authentication'}
            </p>
          </div>

          {authMode === 'reset' ? (
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-zinc-500">Email Address</label>
                <input 
                  type="email" 
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="agent@watchman.os"
                  className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-sm font-bold outline-none focus:border-yellow-500 text-white placeholder:text-zinc-700"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isSubmittingAuth}
                className="w-full bg-yellow-500 text-black font-black uppercase tracking-widest py-3 rounded-xl hover:bg-yellow-400 transition-colors disabled:opacity-50"
              >
                {isSubmittingAuth ? 'Sending...' : 'Send Reset Link'}
              </button>
              <button
                type="button"
                onClick={() => setAuthMode('login')}
                className="w-full text-xs text-zinc-400 hover:text-white font-bold transition-colors"
              >
                Back to Login
              </button>
            </form>
          ) : (
            <form onSubmit={handleEmailAuth} className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-zinc-500">Email Address</label>
                  <input 
                    type="email" 
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="agent@watchman.os"
                    className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-sm font-bold outline-none focus:border-yellow-500 text-white placeholder:text-zinc-700"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase text-zinc-500">Password</label>
                    {authMode === 'login' && (
                      <button 
                        type="button" 
                        onClick={() => setAuthMode('reset')}
                        className="text-[10px] font-bold text-yellow-500 hover:text-yellow-400"
                      >
                        Forgot?
                      </button>
                    )}
                  </div>
                  <input 
                    type="password" 
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-sm font-bold outline-none focus:border-yellow-500 text-white placeholder:text-zinc-700"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmittingAuth}
                className="w-full bg-yellow-500 text-black font-black uppercase tracking-widest py-3 rounded-xl hover:bg-yellow-400 transition-colors disabled:opacity-50 mt-2"
              >
                {isSubmittingAuth ? 'Authenticating...' : (authMode === 'login' ? 'Sign In' : 'Create Account')}
              </button>

              <div className="relative py-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-zinc-800"></div>
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-zinc-900 px-2 text-[10px] font-black uppercase text-zinc-500">Or</span>
                </div>
              </div>

              <button
                type="button"
                onClick={async () => {
                  try {
                    // Try popup first (works nicely in AI studio iframe)
                    await signInWithPopup(auth, googleProvider);
                  } catch (err: any) {
                    if (err.code === 'auth/popup-blocked') {
                       toast.info('Popup blocked natively. Redirecting to Google...');
                       // Fallback to full-page redirect for Vercel/production iOS Safari
                       await signInWithRedirect(auth, googleProvider);
                    } else {
                       toast.error(err.message || 'Authentication failed');
                    }
                  }
                }}
                className="w-full bg-zinc-950 border border-zinc-800 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-3 hover:bg-zinc-800 transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continue with Google
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
                  className="text-xs text-zinc-400 hover:text-white font-bold transition-colors"
                >
                  {authMode === 'login' ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-yellow-500 selection:text-black">
      <Toaster theme="dark" position="top-center" richColors />
      {/* HEADER */}
      <header className="sticky top-0 z-30 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800 px-4 py-4 flex items-center justify-between">
        <div onClick={() => {setActiveTab('shifts'); setActiveSettingView(null);}} className="cursor-pointer">
          <h1 className="text-xl font-black italic tracking-tighter uppercase leading-none">Watchman <span className="text-yellow-500">OS</span></h1>
          <p className="text-[10px] text-zinc-500 font-mono tracking-widest uppercase mt-1">Field Unit // {settings.profileName || user?.displayName || 'Shift Tracker'}</p>
        </div>
        <div className="flex gap-2 items-center">
           <button onClick={() => setShowFilters(!showFilters)} className="p-2 bg-zinc-900 border border-zinc-800 rounded-md">
            <Filter size={18} className={showFilters ? 'text-yellow-500' : 'text-zinc-400'} />
           </button>
           <div className="h-9 w-9 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center overflow-hidden cursor-pointer" onClick={() => setActiveTab('settings')}>
            {settings.profileEmoji && settings.profileEmoji !== '👤' ? (
              <span className="text-xl">{settings.profileEmoji}</span>
            ) : user?.photoURL ? (
              <img src={user.photoURL} alt="Profile" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <User size={18} className="text-zinc-400" />
            )}
           </div>
        </div>
      </header>

      {/* SEARCH & FILTER OVERLAY */}
      <AnimatePresence>
      {showFilters && (
        <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }} transition={{ duration: 0.2 }} className="bg-zinc-900 border-b border-zinc-800 p-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
            <input 
              type="text" 
              placeholder="Search site or agency..." 
              className="w-full bg-black border border-zinc-700 rounded p-2 pl-10 text-sm focus:border-yellow-500 outline-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-2">Status</p>
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
              {['All', 'Paid', 'Unpaid', 'Pending'].map(f => (
                <button 
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`px-4 py-1.5 rounded-full border text-xs font-bold whitespace-nowrap transition-all ${statusFilter === f ? 'bg-yellow-500 text-black border-yellow-500' : 'bg-zinc-800 border-zinc-700 text-zinc-400'}`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-2">Time Range</p>
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
              {['All Time', 'Weekly', 'Fortnightly', 'Monthly', 'Custom'].map(t => (
                <button 
                  key={t}
                  onClick={() => setTimeFilter(t)}
                  className={`px-4 py-1.5 rounded-full border text-xs font-bold whitespace-nowrap transition-all ${timeFilter === t ? 'bg-zinc-100 text-black border-white' : 'bg-zinc-800 border-zinc-700 text-zinc-400'}`}
                >
                  {t}
                </button>
              ))}
            </div>
            <AnimatePresence>
            {timeFilter === 'Custom' && (
              <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }} transition={{ duration: 0.2 }} className="flex items-center gap-2 mt-2">
                 <input type="date" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} className="w-1/2 bg-black border border-zinc-700 rounded p-2 text-xs text-white" />
                 <span className="text-zinc-500">-</span>
                 <input type="date" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} className="w-1/2 bg-black border border-zinc-700 rounded p-2 text-xs text-white" />
              </motion.div>
            )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* MAIN CONTENT AREA */}
      <main className="pb-32 p-4 max-w-2xl mx-auto">
        {activeTab === 'shifts' && (
          <ShiftManager
            timeFilter={timeFilter}
            setTimeFilter={setTimeFilter}
            filteredShifts={filteredShifts}
            expandedShiftId={expandedShiftId}
            setExpandedShiftId={setExpandedShiftId}
            calculateShiftMetrics={calculateShiftMetrics}
            settings={settings}
            setEditingShift={setEditingShift}
            setFormData={setFormData}
            setIsAdding={setIsAdding}
            duplicateShift={duplicateShift}
            deleteShift={deleteShift}
            togglePaid={togglePaid}
            StatusBadge={StatusBadge}
          />
        )}

        {activeTab === 'dashboard' && (
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.3 }} className="space-y-6">
            <div className="flex justify-between items-end px-1 mb-2">
               <h2 className="text-xs font-black uppercase tracking-widest text-zinc-500 truncate mr-2">Summary ({timeFilter})</h2>
               <span className="text-[10px] font-mono text-zinc-600 whitespace-nowrap">{filteredShifts.length} items</span>
            </div>

            {/* LARGE HERO STATS */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-zinc-900 border border-zinc-800 p-4 sm:p-5 rounded-xl space-y-2 overflow-hidden">
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest truncate">Total Earnings</p>
                <h2 className="text-2xl sm:text-3xl font-black text-yellow-500 tracking-tighter truncate">{settings.currencySymbol}{stats.totalEarned.toFixed(2)}</h2>
                <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                   <div 
                    className="h-full bg-emerald-500 transition-all duration-1000" 
                    style={{ width: `${stats.totalEarned > 0 ? (stats.totalPaid / stats.totalEarned) * 100 : 0}%` }}
                   />
                </div>
                <p className="text-[9px] font-mono text-zinc-400 uppercase truncate">Paid: {settings.currencySymbol}{stats.totalPaid.toFixed(2)}</p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 p-4 sm:p-5 rounded-xl space-y-2 overflow-hidden">
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest truncate">Total Hours</p>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tighter italic truncate">{stats.totalHours.toFixed(1)}</h2>
                <div className="flex items-center gap-1.5 text-[9px] font-mono text-zinc-400 uppercase truncate">
                  <Flame size={12} className="text-orange-500 shrink-0" />
                  <span className="truncate">{filteredShifts.length} Shifts Logged</span>
                </div>
              </div>
            </div>

            {/* UNPAID ALERT */}
            {stats.unpaidCount > 0 && (
              <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-xl flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                  <AlertCircle className="text-red-500" size={24} />
                </div>
                <div>
                  <h4 className="text-sm font-black uppercase text-red-500">Unpaid Invoices</h4>
                  <p className="text-xs text-zinc-400">You have {stats.unpaidCount} shifts pending payment totaling <span className="text-zinc-100">{settings.currencySymbol}{(stats.totalEarned - stats.totalPaid).toFixed(2)}</span>.</p>
                </div>
              </div>
            )}

            {/* CONTRACTOR BREAKDOWN */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-zinc-800/50 border-b border-zinc-800 flex justify-between items-center">
                <h3 className="text-[10px] font-black uppercase tracking-widest truncate mr-2">Breakdown by Agency</h3>
                <Download size={14} className="text-zinc-500 cursor-pointer shrink-0" onClick={exportToCSV} />
              </div>
              <div className="p-4 space-y-4">
                {Object.entries(filteredShifts.reduce((acc: Record<string, number>, s) => {
                  const name = s.contractor || 'Independent';
                  acc[name] = (acc[name] || 0) + parseFloat(calculateShiftMetrics(s).totalPay);
                  return acc;
                }, {} as Record<string, number>)).sort((a: [string, number], b: [string, number]) => b[1]-a[1]).map(([name, val]: [string, number]) => (
                  <div key={name} className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-300">{name}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-24 h-1 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-yellow-500" style={{ width: `${stats.totalEarned > 0 ? (val / stats.totalEarned) * 100 : 0}%` }} />
                      </div>
                      <span className="text-xs font-black text-yellow-500 min-w-[60px] text-right">{settings.currencySymbol}{val.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
                {filteredShifts.length === 0 && (
                  <p className="text-xs text-zinc-500 text-center py-2">No data for selected period</p>
                )}
              </div>
            </div>

            {/* DUTY TYPE BREAKDOWN */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-zinc-800/50 border-b border-zinc-800 flex justify-between items-center">
                <h3 className="text-[10px] font-black uppercase tracking-widest truncate mr-2">Breakdown by Duty Type</h3>
                <Download size={14} className="text-zinc-500 cursor-pointer shrink-0" onClick={exportToCSV} />
              </div>
              <div className="p-4 space-y-4">
                {Object.entries(filteredShifts.reduce((acc: Record<string, number>, s) => {
                  const name = s.dutyType || 'Unspecified';
                  acc[name] = (acc[name] || 0) + parseFloat(calculateShiftMetrics(s).totalPay);
                  return acc;
                }, {} as Record<string, number>)).sort((a: [string, number], b: [string, number]) => b[1]-a[1]).map(([name, val]: [string, number]) => (
                  <div key={name} className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-300">{name}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-24 h-1 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500" style={{ width: `${stats.totalEarned > 0 ? (val / stats.totalEarned) * 100 : 0}%` }} />
                      </div>
                      <span className="text-xs font-black text-emerald-500 min-w-[60px] text-right">{settings.currencySymbol}{val.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
                {filteredShifts.length === 0 && (
                  <p className="text-xs text-zinc-500 text-center py-2">No data for selected period</p>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'settings' && (
          <SettingsPane
            user={user}
            settings={settings}
            setSettings={setSettings}
            activeSettingView={activeSettingView}
            setActiveSettingView={setActiveSettingView}
            shifts={shifts}
            setConfirmDialog={setConfirmDialog}
          />
        )}
      </main>

      {/* FAB / ADD SHIFT MODAL */}
      <AnimatePresence>
      {isAdding && (
        <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ duration: 0.3, type: 'tween' }} className="fixed inset-0 z-50 flex flex-col bg-zinc-950">
          <header className="p-4 border-b border-zinc-800 flex items-center justify-between bg-black">
            <button onClick={() => { setIsAdding(false); setEditingShift(null); }} className="text-zinc-500 p-2">
              <X size={24} />
            </button>
            <h2 className="font-black uppercase tracking-tighter text-lg">
              {editingShift ? 'Edit Log' : 'New Shift Entry'}
            </h2>
            <button form="shift-form" type="submit" className="text-yellow-500 font-black uppercase tracking-widest text-sm px-2">
              Save
            </button>
          </header>

          <form id="shift-form" onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-8 bg-zinc-950 pb-32">
            
            {/* Primary Details */}
            <div className="space-y-4">
              <label className="block">
                <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest mb-1 block">Site Location</span>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3.5 text-zinc-500" size={16} />
                  <input 
                    list="saved-locations"
                    required
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 pl-10 focus:border-yellow-500 outline-none font-bold placeholder:text-zinc-700"
                    value={formData.location}
                    onChange={e => setFormData({...formData, location: e.target.value})}
                    placeholder="E.g. Nexus Industrial Park"
                  />
                  <datalist id="saved-locations">
                    {settings.locations?.map((loc: string, idx: number) => (
                      <option key={idx} value={loc} />
                    ))}
                  </datalist>
                </div>
              </label>

              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest mb-1 block">Date</span>
                  <input 
                    type="date"
                    required
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 focus:border-yellow-500 outline-none font-bold text-white"
                    value={formData.date}
                    onChange={e => setFormData({...formData, date: e.target.value})}
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest mb-1 block">Duty Type</span>
                  <select 
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 focus:border-yellow-500 outline-none font-bold appearance-none"
                    value={formData.dutyType}
                    onChange={e => setFormData({...formData, dutyType: e.target.value})}
                  >
                    {settings.dutyTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
              </div>
            </div>

            {/* Time & Pay */}
            <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest mb-1 block">Clock In</span>
                  <input 
                    type="time"
                    className="w-full bg-black border border-zinc-800 rounded-lg p-3 focus:border-yellow-500 outline-none font-black text-xl text-center"
                    value={formData.clockIn}
                    onChange={e => setFormData({...formData, clockIn: e.target.value})}
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest mb-1 block">Clock Out</span>
                  <input 
                    type="time"
                    className="w-full bg-black border border-zinc-800 rounded-lg p-3 focus:border-yellow-500 outline-none font-black text-xl text-center"
                    value={formData.clockOut}
                    onChange={e => setFormData({...formData, clockOut: e.target.value})}
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest mb-1 block">Break (Mins)</span>
                  <input 
                    type="number"
                    className="w-full bg-black border border-zinc-800 rounded-lg p-3 focus:border-yellow-500 outline-none font-bold"
                    value={formData.breakMinutes}
                    onChange={e => setFormData({...formData, breakMinutes: parseInt(e.target.value) || 0})}
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest mb-1 block">Hourly Rate ({settings.currencySymbol})</span>
                  <input 
                    type="number"
                    step="0.01"
                    className="w-full bg-black border border-zinc-800 rounded-lg p-3 focus:border-yellow-500 outline-none font-bold text-yellow-500"
                    value={formData.rate}
                    onChange={e => setFormData({...formData, rate: parseFloat(e.target.value) || 0})}
                  />
                </label>
              </div>
              
              <div className="pt-2 border-t border-zinc-800 flex justify-between items-end">
                <div>
                  <p className="text-[10px] font-black text-zinc-500 uppercase">Calculated Total Pay</p>
                  <p className="text-4xl font-black text-yellow-500 tracking-tighter">
                    {settings.currencySymbol}{calculateShiftMetrics(formData).totalPay}
                  </p>
                </div>
                <div className="text-right">
                   <p className="text-[10px] font-black text-zinc-500 uppercase">Net Duration</p>
                   <p className="text-xl font-bold">{calculateShiftMetrics(formData).netHours}h</p>
                </div>
              </div>
            </div>

            {/* Admin Info */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest mb-1 block">Agency / Contractor</span>
                  <select 
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 focus:border-yellow-500 outline-none font-bold appearance-none"
                    value={formData.contractor}
                    onChange={e => setFormData({...formData, contractor: e.target.value})}
                  >
                    {settings.agents.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest mb-1 block">Supervisor</span>
                  <input 
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 focus:border-yellow-500 outline-none font-bold placeholder:text-zinc-700"
                    value={formData.supervisor}
                    onChange={e => setFormData({...formData, supervisor: e.target.value})}
                    placeholder="On-site contact"
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest mb-1 block">Notes / Incidents</span>
                <textarea 
                  rows={3}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 focus:border-yellow-500 outline-none text-sm"
                  value={formData.notes}
                  onChange={e => setFormData({...formData, notes: e.target.value})}
                  placeholder="Any notable events or overtime justifications..."
                />
              </label>

              <div className="flex items-center justify-between p-4 bg-zinc-900 border border-zinc-800 rounded-xl">
                <span className="text-xs font-black uppercase tracking-widest">Payment Status</span>
                <div className="flex gap-2">
                  {['Unpaid', 'Pending', 'Paid'].map(s => (
                    <button 
                      key={s}
                      type="button"
                      onClick={() => setFormData({...formData, status: s})}
                      className={`px-3 py-1.5 rounded text-[10px] font-black uppercase border transition-all ${formData.status === s ? 'bg-zinc-100 text-black border-white' : 'bg-black text-zinc-500 border-zinc-800'}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {editingShift && (
              <button 
                type="button"
                onClick={() => deleteShift(editingShift.id)}
                className="w-full py-4 text-red-500 font-black uppercase tracking-widest flex items-center justify-center gap-2 border border-red-500/20 rounded-xl"
              >
                <Trash2 size={16} /> Delete Entry
              </button>
            )}
          </form>
        </motion.div>
      )}
      </AnimatePresence>

      {/* BOTTOM NAVIGATION */}
      <nav className="fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-xl border-t border-zinc-800 px-6 py-2 flex items-center justify-between z-40">
        <NavButton id="shifts" activeTab={activeTab} icon={ClipboardList} label="Logs" onClick={handleNavClick} />
        <NavButton id="dashboard" activeTab={activeTab} icon={LayoutDashboard} label="Stats" onClick={handleNavClick} />
        <div className="relative -top-6">
          <button 
            onClick={() => {
              setFormData({
                ...initialFormState,
                rate: settings.defaultRate,
                contractor: settings.agents[0] || 'Independent',
                dutyType: settings.dutyTypes[0] || 'Static Guard'
              });
              setEditingShift(null);
              setIsAdding(true);
            }}
            className="w-14 h-14 bg-yellow-500 text-black rounded-full shadow-[0_0_20px_rgba(234,179,8,0.4)] flex items-center justify-center active:scale-90 transition-transform border-4 border-zinc-950"
          >
            <Plus size={32} strokeWidth={3} />
          </button>
        </div>
        <NavButton id="settings" activeTab={activeTab} icon={Settings} label="Ops" onClick={handleNavClick} />
        <button onClick={exportToCSV} className="flex flex-col items-center justify-center w-full py-2 text-zinc-500 transition-all hover:text-yellow-500">
           <Download size={20} />
           <span className="text-[10px] font-bold uppercase tracking-wider mt-1">Export</span>
        </button>
      </nav>

      {/* CONFIRM DIALOG */}
      <AnimatePresence>
      {confirmDialog?.isOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} transition={{ duration: 0.2 }} className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="p-6 space-y-4">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-2">
                <AlertCircle className="text-red-500" size={24} />
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight">{confirmDialog.title}</h3>
              <p className="text-sm text-zinc-400">{confirmDialog.message}</p>
              
              {confirmDialog.requireReauth && user?.providerData[0]?.providerId === 'password' && (
                <div className="mt-4">
                  <input
                    type="password"
                    placeholder="Enter password to confirm..."
                    value={reauthPassword}
                    onChange={(e) => setReauthPassword(e.target.value)}
                    className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-red-500"
                  />
                </div>
              )}
            </div>
            <div className="flex border-t border-zinc-800">
              <button 
                onClick={() => { setConfirmDialog(null); setReauthPassword(''); }}
                className="flex-1 p-4 text-sm font-bold text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                disabled={isReauthing}
              >
                CANCEL
              </button>
              <button 
                onClick={async () => {
                  if (confirmDialog.requireReauth && user) {
                    setIsReauthing(true);
                    try {
                      if (user.providerData[0]?.providerId === 'google.com') {
                         await reauthenticateWithPopup(user, new GoogleAuthProvider());
                      } else {
                         const cred = EmailAuthProvider.credential(user.email!, reauthPassword);
                         await reauthenticateWithCredential(user, cred);
                      }
                      confirmDialog.onConfirm();
                      setReauthPassword('');
                    } catch (error: any) {
                      toast.error('Authentication failed: ' + error.message);
                    } finally {
                      setIsReauthing(false);
                    }
                  } else {
                    confirmDialog.onConfirm();
                  }
                }}
                disabled={isReauthing || (confirmDialog.requireReauth && user?.providerData[0]?.providerId === 'password' && !reauthPassword)}
                className="flex-1 p-4 text-sm font-black text-red-500 hover:bg-red-500/10 transition-colors border-l border-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isReauthing ? 'VERIFYING...' : 'CONFIRM'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* ALERT DIALOG */}
      <AnimatePresence>
      {alertDialog?.isOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} transition={{ duration: 0.2 }} className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="p-6 space-y-4">
              <div className="w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center mb-2">
                <Info className="text-yellow-500" size={24} />
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight">{alertDialog.title}</h3>
              <p className="text-sm text-zinc-400">{alertDialog.message}</p>
            </div>
            <div className="flex border-t border-zinc-800">
              <button 
                onClick={() => setAlertDialog(null)}
                className="flex-1 p-4 text-sm font-black text-yellow-500 hover:bg-yellow-500/10 transition-colors"
              >
                OKAY
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
};

export default App;