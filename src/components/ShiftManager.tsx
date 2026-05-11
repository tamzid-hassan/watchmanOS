import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, Clock, MapPin, ChevronDown, Briefcase, User, FileText, X } from 'lucide-react';

export const ShiftManager = ({
  timeFilter,
  setTimeFilter,
  filteredShifts,
  expandedShiftId,
  setExpandedShiftId,
  calculateShiftMetrics,
  settings,
  setEditingShift,
  setFormData,
  setIsAdding,
  duplicateShift,
  deleteShift,
  togglePaid,
  StatusBadge
}: any) => {
  return (
    <div className="space-y-3">
      {timeFilter !== 'All Time' && (
        <div className="flex items-center gap-2 px-2 py-1 bg-zinc-900/50 border border-zinc-800 rounded-md w-fit mb-2">
          <Calendar size={12} className="text-yellow-500" />
          <span className="text-[10px] font-black uppercase tracking-tighter text-zinc-400">
            {timeFilter} Range Applied • {filteredShifts.length} Results
          </span>
          <button onClick={() => setTimeFilter('All Time')} className="ml-1 text-zinc-600 hover:text-white">
            <X size={12} />
          </button>
        </div>
      )}
      {filteredShifts.length === 0 ? (
        <div className="py-20 text-center space-y-4">
          <div className="inline-block p-4 rounded-full bg-zinc-900 border border-dashed border-zinc-700">
            <Calendar className="text-zinc-600" size={32} />
          </div>
          <p className="text-zinc-500 font-mono text-xs uppercase tracking-widest">No shift records found</p>
        </div>
      ) : (
        filteredShifts.map((s: any) => {
          const { netHours, totalPay, grossHours } = calculateShiftMetrics(s);
          const isOvertime = false;
          const isExpanded = expandedShiftId === s.id;

          return (
            <div key={s.id} className={`group relative bg-zinc-900 border rounded-lg overflow-hidden transition-all ${isExpanded ? 'border-yellow-500/50 ring-1 ring-yellow-500/20' : 'border-zinc-800'}`}>
              {/* Header Click Area */}
              <div 
                onClick={() => setExpandedShiftId(isExpanded ? null : s.id)}
                className="p-4 cursor-pointer active:bg-zinc-800/50"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <MapPin size={12} className="text-yellow-500" />
                      <h3 className="font-black text-sm uppercase tracking-tight">{s.location}</h3>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-zinc-500 font-mono">
                      <span className="flex items-center gap-1"><Calendar size={10} /> {s.date}</span>
                      <span className="flex items-center gap-1"><Clock size={10} /> {s.clockIn} - {s.clockOut}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                      <StatusBadge status={s.status} />
                      <ChevronDown size={14} className={`text-zinc-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 border-t border-zinc-800 mt-3 pt-3">
                  <div className="space-y-0.5">
                    <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Net Hours</p>
                    <p className={`text-lg font-black ${isOvertime ? 'text-orange-500' : 'text-zinc-100'}`}>
                      {netHours}
                      {isOvertime && <span className="ml-1 text-[8px] align-top bg-orange-500 text-black px-1 rounded-sm tracking-normal">OT</span>}
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Rate</p>
                    <p className="text-lg font-black">{settings.currencySymbol}{s.rate}</p>
                  </div>
                  <div className="space-y-0.5 text-right">
                    <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Earnings</p>
                    <p className="text-lg font-black text-yellow-500">{settings.currencySymbol}{totalPay}</p>
                  </div>
                </div>
              </div>

              {/* Expandable Content */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }} 
                    animate={{ height: 'auto', opacity: 1 }} 
                    exit={{ height: 0, opacity: 0 }} 
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden bg-black/40 border-t border-zinc-800"
                  >
                    <div className="p-4 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Agency</p>
                      <p className="text-xs font-bold flex items-center gap-1.5"><Briefcase size={10} className="text-zinc-400" /> {s.contractor}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Supervisor</p>
                      <p className="text-xs font-bold flex items-center gap-1.5"><User size={10} className="text-zinc-400" /> {s.supervisor || 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Duty Type</p>
                      <p className="text-xs font-bold">{s.dutyType}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Time Details</p>
                      <p className="text-[10px] text-zinc-400 font-mono">Gross: {grossHours}h • Break: {s.breakMinutes}m</p>
                    </div>
                  </div>

                  {s.notes && (
                    <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg">
                        <div className="flex items-center gap-2 mb-1.5">
                          <FileText size={10} className="text-yellow-500" />
                          <span className="text-[9px] font-black uppercase text-zinc-500 tracking-widest">Operational Notes</span>
                        </div>
                        <p className="text-xs text-zinc-400 leading-relaxed italic">{s.notes}</p>
                      </div>
                    )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Action Bar (Always Visible) */}
              <div className="flex items-center justify-between px-4 py-3 bg-zinc-950/50 border-t border-zinc-800">
                <div className="flex gap-4">
                  <button onClick={(e) => { e.stopPropagation(); setEditingShift(s); setFormData(s); setIsAdding(true); }} className="text-zinc-500 hover:text-white uppercase font-black text-[10px]">Edit</button>
                  <button onClick={(e) => { e.stopPropagation(); duplicateShift(s); }} className="text-zinc-500 hover:text-white uppercase font-black text-[10px]">Clone</button>
                  <button onClick={(e) => { e.stopPropagation(); deleteShift(s.id); }} className="text-red-500/70 hover:text-red-500 uppercase font-black text-[10px]">Delete</button>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); togglePaid(s.id); }} 
                  className={`px-4 py-1.5 rounded text-[10px] font-black uppercase tracking-widest active:scale-95 transition-transform ${s.status === 'Paid' ? 'bg-zinc-800 text-zinc-300 border border-zinc-700' : 'bg-yellow-500 text-black'}`}
                >
                  {s.status === 'Paid' ? 'Mark Unpaid' : 'Record Payment'}
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};
