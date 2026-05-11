import React from 'react';
import { motion } from 'motion/react';
import { User, Phone, DollarSign, Briefcase, ClipboardList, MapPin, ChevronRight, ChevronLeft, Trash2, LogOut, Flame } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { deleteDoc, doc } from 'firebase/firestore';
import { toast } from 'sonner';
import { OperationType, handleFirestoreError } from '../App';

export const SettingsPane = ({
  user,
  settings,
  setSettings,
  activeSettingView,
  setActiveSettingView,
  shifts,
  setConfirmDialog
}: any) => {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="space-y-4">
      {!activeSettingView ? (
        <>
          <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
              <div className="px-4 py-3 border-b border-zinc-800">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">Personal Profile</h3>
              </div>
              <div className="divide-y divide-zinc-800">
                {[
                  { id: 'profile', label: 'Profile Details', value: settings.profileName || user?.displayName || 'Set Profile', icon: User },
                  { id: 'contact', label: 'Contact Info', value: settings.personalPhone || settings.personalEmail ? 'Configured' : 'Not Set', icon: Phone },
                ].map((item) => (
                  <div key={item.id} onClick={() => setActiveSettingView(item.id)} className="flex items-center justify-between p-4 active:bg-zinc-800 cursor-pointer">
                    <div className="flex items-center gap-3">
                      <item.icon size={16} className="text-zinc-500" />
                      <span className="text-sm font-bold">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-2 text-zinc-400">
                      <span className="text-xs">{item.value}</span>
                      <ChevronRight size={14} />
                    </div>
                  </div>
                ))}
              </div>
          </section>

          <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
              <div className="px-4 py-3 border-b border-zinc-800">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">Account & Preferences</h3>
              </div>
              <div className="divide-y divide-zinc-800">
                {[
                  { id: 'rate', label: 'Default Hourly Rate', value: `${settings.currencySymbol}${settings.defaultRate.toFixed(2)}`, icon: DollarSign },
                  { id: 'currency', label: 'Currency', value: `${settings.currency} (${settings.currencySymbol})`, icon: Briefcase },
                  { id: 'agents', label: 'Manage Agencies', value: `${settings.agents.length} Registered`, icon: User },
                  { id: 'duties', label: 'Duty Types', value: `${settings.dutyTypes.length} Managed`, icon: ClipboardList },
                  { id: 'locations', label: 'Saved Locations', value: `${settings.locations?.length || 0} Managed`, icon: MapPin },
                ].map((item) => (
                  <div key={item.id} onClick={() => setActiveSettingView(item.id)} className="flex items-center justify-between p-4 active:bg-zinc-800 cursor-pointer">
                    <div className="flex items-center gap-3">
                      <item.icon size={16} className="text-zinc-500" />
                      <span className="text-sm font-bold">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-2 text-zinc-400">
                      <span className="text-xs">{item.value}</span>
                      <ChevronRight size={14} />
                    </div>
                  </div>
                ))}
              </div>
          </section>
          
          <button 
            onClick={() => signOut(auth)}
            className="w-full py-4 text-zinc-400 text-[10px] font-black uppercase tracking-widest border border-zinc-800 rounded-xl bg-zinc-900 mt-4 flex items-center justify-center gap-2 hover:bg-zinc-800 transition-colors"
          >
              <LogOut size={14} />
              Sign Out
          </button>

          <button 
            onClick={() => {
              setConfirmDialog({
                isOpen: true,
                title: 'Destroy All Records',
                message: 'ERASE ALL DATA? This will permanently delete your shift logs.',
                requireReauth: true,
                onConfirm: async () => {
                  if (!user) return;
                  try {
                    await Promise.all(shifts.map((s: any) => deleteDoc(doc(db, `users/${user.uid}/shifts/${s.id}`))));
                    setConfirmDialog(null);
                    toast.error('All records have been destroyed', { icon: <Flame size={16} /> });
                  } catch (error) {
                    handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/shifts`);
                  }
                }
              });
            }}
            className="w-full py-4 text-red-500 text-[10px] font-black uppercase tracking-widest border border-red-500/20 rounded-xl bg-red-500/5 mt-4"
          >
              Destroy All Records
          </button>
        </>
      ) : (
        <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
          <button 
            onClick={() => setActiveSettingView(null)}
            className="flex items-center gap-2 text-zinc-500 mb-4 hover:text-white transition-colors"
          >
            <ChevronLeft size={16} />
            <span className="text-[10px] font-black uppercase tracking-widest">Back to Ops</span>
          </button>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-6">
            {activeSettingView === 'profile' && (
              <div className="space-y-4">
                <h3 className="text-lg font-black uppercase">Profile Details</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-zinc-500">Profile Name</label>
                    <input 
                      type="text" 
                      value={settings.profileName}
                      onChange={(e) => setSettings({...settings, profileName: e.target.value})}
                      placeholder={user?.displayName || "Enter your name"}
                      className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-sm font-bold outline-none focus:border-yellow-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-zinc-500">Profile Emoji</label>
                    <div className="grid grid-cols-5 gap-2">
                      {['👤', '🧑‍✈️', '👮', '🕵️', '💂', '🦸', '🥷', '👷', '👨‍💼', '👩‍💼'].map(emoji => (
                        <button
                          key={emoji}
                          onClick={() => setSettings({...settings, profileEmoji: emoji})}
                          className={`p-3 text-2xl rounded-lg border ${settings.profileEmoji === emoji ? 'border-yellow-500 bg-yellow-500/10' : 'border-zinc-800 bg-black'}`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeSettingView === 'contact' && (
              <div className="space-y-4">
                <h3 className="text-lg font-black uppercase">Contact Info</h3>
                <p className="text-xs text-zinc-500 font-mono">Used for reports and invoices.</p>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-zinc-500">Phone Number</label>
                    <input 
                      type="tel" 
                      value={settings.personalPhone}
                      onChange={(e) => setSettings({...settings, personalPhone: e.target.value})}
                      placeholder="+1 (555) 000-0000"
                      className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-sm font-bold outline-none focus:border-yellow-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-zinc-500">Email Address</label>
                    <input 
                      type="email" 
                      value={settings.personalEmail}
                      onChange={(e) => setSettings({...settings, personalEmail: e.target.value})}
                      placeholder={user?.email || "email@example.com"}
                      className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-sm font-bold outline-none focus:border-yellow-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeSettingView === 'rate' && (
              <div className="space-y-4">
                <h3 className="text-lg font-black uppercase">Default Hourly Rate</h3>
                <p className="text-xs text-zinc-500 font-mono">Starting value for all new shift logs.</p>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-bold">{settings.currencySymbol}</span>
                  <input 
                    type="number" 
                    step="0.01"
                    value={settings.defaultRate}
                    onChange={(e) => setSettings({...settings, defaultRate: parseFloat(e.target.value) || 0})}
                    className="w-full bg-black border border-zinc-800 rounded-lg p-4 pl-10 text-xl font-black text-yellow-500 outline-none focus:border-yellow-500"
                  />
                </div>
              </div>
            )}

            {activeSettingView === 'currency' && (
              <div className="space-y-4">
                <h3 className="text-lg font-black uppercase">Currency Settings</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-zinc-500">Code</label>
                      <input 
                      type="text" 
                      value={settings.currency}
                      onChange={(e) => setSettings({...settings, currency: e.target.value.toUpperCase()})}
                      className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-center font-bold"
                      />
                  </div>
                  <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-zinc-500">Symbol</label>
                      <input 
                      type="text" 
                      value={settings.currencySymbol}
                      onChange={(e) => setSettings({...settings, currencySymbol: e.target.value})}
                      className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-center font-bold text-yellow-500"
                      />
                  </div>
                </div>
              </div>
            )}

            {activeSettingView === 'agents' && (
              <div className="space-y-4">
                <h3 className="text-lg font-black uppercase">Agencies / Contractors</h3>
                <div className="space-y-2">
                  {settings.agents.map((agent: string, idx: number) => (
                    <div key={idx} className="flex items-center justify-between bg-black border border-zinc-800 p-3 rounded-lg group">
                      <span className="text-sm font-bold">{agent}</span>
                      <button 
                        onClick={() => setSettings({...settings, agents: settings.agents.filter((_: string, i: number) => i !== idx)})}
                        className="text-zinc-600 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="pt-4 border-t border-zinc-800">
                    <input 
                    type="text" 
                    placeholder="Add Agency Name..."
                    className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-sm outline-none focus:border-yellow-500 mb-2"
                    onKeyDown={(e: any) => {
                      if (e.key === 'Enter' && e.target.value) {
                        setSettings({...settings, agents: [...settings.agents, e.target.value]});
                        e.target.value = '';
                      }
                    }}
                    />
                    <p className="text-[9px] text-zinc-600 uppercase font-bold text-center italic">Press Enter to Add</p>
                </div>
              </div>
            )}

            {activeSettingView === 'duties' && (
              <div className="space-y-4">
                <h3 className="text-lg font-black uppercase">Duty Types</h3>
                <div className="space-y-2">
                  {settings.dutyTypes.map((type: string, idx: number) => (
                    <div key={idx} className="flex items-center justify-between bg-black border border-zinc-800 p-3 rounded-lg group">
                      <span className="text-sm font-bold">{type}</span>
                      <button 
                        onClick={() => setSettings({...settings, dutyTypes: settings.dutyTypes.filter((_: string, i: number) => i !== idx)})}
                        className="text-zinc-600 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="pt-4 border-t border-zinc-800">
                    <input 
                    type="text" 
                    placeholder="Add New Duty Type..."
                    className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-sm outline-none focus:border-yellow-500 mb-2"
                    onKeyDown={(e: any) => {
                      if (e.key === 'Enter' && e.target.value) {
                        setSettings({...settings, dutyTypes: [...settings.dutyTypes, e.target.value]});
                        e.target.value = '';
                      }
                    }}
                    />
                    <p className="text-[9px] text-zinc-600 uppercase font-bold text-center italic">Press Enter to Add</p>
                </div>
              </div>
            )}

            {activeSettingView === 'locations' && (
              <div className="space-y-4">
                <h3 className="text-lg font-black uppercase">Saved Locations</h3>
                <div className="space-y-2">
                  {settings.locations?.map((loc: string, idx: number) => (
                    <div key={idx} className="flex items-center justify-between bg-black border border-zinc-800 p-3 rounded-lg group">
                      <span className="text-sm font-bold">{loc}</span>
                      <button 
                        onClick={() => setSettings({...settings, locations: settings.locations?.filter((_: string, i: number) => i !== idx)})}
                        className="text-zinc-600 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  {(!settings.locations || settings.locations.length === 0) && (
                    <p className="text-xs text-zinc-500 text-center py-4">No locations saved yet.</p>
                  )}
                </div>
                <div className="pt-4 border-t border-zinc-800">
                    <input 
                    type="text" 
                    placeholder="Add New Location..."
                    className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-sm outline-none focus:border-yellow-500 mb-2"
                    onKeyDown={(e: any) => {
                      if (e.key === 'Enter' && e.target.value) {
                        setSettings({...settings, locations: [...(settings.locations || []), e.target.value]});
                        e.target.value = '';
                      }
                    }}
                    />
                    <p className="text-[9px] text-zinc-600 uppercase font-bold text-center italic">Press Enter to Add</p>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};
