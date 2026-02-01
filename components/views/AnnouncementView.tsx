import React, { useState, useEffect, useRef } from 'react';
import { AppState } from '../../types';
import { Icons } from '../../constants';
import { formatDateTime } from '../Layout';
import { Button, Modal } from '../shared';
import { updateAnnouncement } from '../../services/databaseService';

interface AnnouncementViewProps {
  state: AppState;
  onAdd: (title: string, content: string) => void;
  onEdit?: (announcementId: string, title: string, content: string) => void;
  onDelete?: (announcementId: string) => void;
  onMarkSeen?: (announcementId: string) => void;
  dateFilter?: { type: 'all' | 'today' | '7d' | '30d' | 'custom'; from?: string; to?: string };
}

const AnnouncementView: React.FC<AnnouncementViewProps> = ({ state, onAdd, onEdit, onDelete, onMarkSeen, dateFilter }) => {
  const isAdmin = state.currentUser?.role === 'admin';
  const [form, setForm] = useState({ title: '', content: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: '', content: '' });
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Dropdown state for announcement actions
  const [openMenuFor, setOpenMenuFor] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!openMenuFor) return;
      if (menuRef.current && menuRef.current.contains(e.target as Node)) return;
      setOpenMenuFor(null);
    };
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [openMenuFor]);

  // Setup IntersectionObserver for marking announcements as seen
  useEffect(() => {
    if (isAdmin) return; // Only for employees

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const announcementId = entry.target.getAttribute('data-announcement-id');
            if (announcementId) {
              const announcement = state.announcements.find(a => a.id === announcementId);
              if (announcement && !announcement.seenBy?.includes(state.currentUser!.id)) {
                // Mark as seen in local state and database
                const updatedAnnouncement = {
                  ...announcement,
                  seenBy: [...(announcement.seenBy || []), state.currentUser!.id]
                };
                updateAnnouncement(updatedAnnouncement);
                if (onMarkSeen) {
                  onMarkSeen(announcementId);
                }
                // Stop observing this element after it's been seen
                observerRef.current?.unobserve(entry.target);
              }
            }
          }
        });
      },
      { threshold: 0.1 } // Trigger when 10% of element is visible
    );

    return () => {
      observerRef.current?.disconnect();
    };
  }, [state.announcements, state.currentUser, isAdmin, onMarkSeen]);

  const handleStartEdit = (announcementId: string) => {
    const announcement = state.announcements.find(a => a.id === announcementId);
    if (announcement) {
      setEditingId(announcementId);
      setEditForm({ title: announcement.title, content: announcement.content });
    }
  };

  const handleSaveEdit = async () => {
    if (editingId && onEdit) {
      await onEdit(editingId, editForm.title, editForm.content);
      setEditingId(null);
      setEditForm({ title: '', content: '' });
    }
  };

  const handleDeleteAnnouncement = async (announcementId: string) => {
    if (onDelete && confirm('Are you sure you want to delete this announcement?')) {
      await onDelete(announcementId);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10 text-slate-900">
      {isAdmin && (
        <div className="bg-white p-6 md:p-12 rounded-[1rem] border border-slate-200 shadow-sm">
          <h3 className="text-xl font-bold text-slate-800 mb-4 tracking-tight">Broadcast something</h3>
          <form className="space-y-5" onSubmit={e => { e.preventDefault(); onAdd(form.title, form.content); setForm({ title: '', content: '' }); }}>
            <input type="text" required placeholder="Subject" className="w-full px-4 py-3 md:px-6 md:py-4 rounded-xl bg-slate-50 border border-slate-200 outline-none text-slate-800" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            <textarea required placeholder="Message..." className="w-full h-40 px-4 py-3 md:px-6 md:py-5 rounded-xl bg-slate-50 border border-slate-200 outline-none resize-none text-sm font-medium leading-relaxed" value={form.content} onChange={e => setForm({ ...form, content: e.target.value })}></textarea>
            <button type="submit" className="w-full py-3 md:py-5 bg-indigo-600 text-white rounded-xl font-bold uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-3 shadow-xl shadow-indigo-100 active:scale-[0.98] hover:bg-indigo-700 transition-all">
              <Icons.Speakerphone /> Publish Notice
            </button>
          </form>
        </div>
      )}
      <div className="space-y-6">
        {(
          // Apply date filter if provided
          (dateFilter && dateFilter.type !== 'all') ? state.announcements.filter(a => {
            const t = new Date(a.timestamp).getTime();
            const now = Date.now();
            if (dateFilter.type === 'today') {
              const d = new Date(a.timestamp);
              const today = new Date();
              return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
            }
            if (dateFilter.type === '7d') return t >= (now - 7 * 24 * 60 * 60 * 1000);
            if (dateFilter.type === '30d') return t >= (now - 30 * 24 * 60 * 60 * 1000);
            if (dateFilter.type === 'custom' && dateFilter.from) {
              const from = new Date(dateFilter.from).getTime();
              const to = dateFilter.to ? new Date(dateFilter.to).getTime() : Date.now();
              return t >= from && t <= to;
            }
            return true;
          }) : state.announcements
        ).map(a => {
          // Check if current user has seen this announcement
          const isSeen = a.seenBy?.includes(state.currentUser?.id || '');
          
          return (
            <div 
              key={a.id} 
              ref={(el) => {
                if (el && !isAdmin && !isSeen && observerRef.current) {
                  observerRef.current.observe(el);
                }
              }}
              data-announcement-id={a.id}
              className={`bg-white p-6 md:p-8 rounded-[1rem] border border-slate-200 shadow-sm border-l-8 transition-all ${
                isSeen ? 'border-l-slate-300' : 'border-l-indigo-600 hover:shadow-md'
              } ${!isSeen && !isAdmin ? 'bg-indigo-50/30' : ''}`}
            >
              <div className="flex justify-between items-start mb-5">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-800 text-lg tracking-tight break-words">{a.title}</h4>
                    <div className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">{formatDateTime(a.timestamp)}</div>
                  </div>
                  {!isSeen && !isAdmin && (
                    <span className="inline-flex items-center justify-center h-3 w-3 rounded-full bg-indigo-600 mt-1" />
                  )}
                </div>

                <div className="flex items-center gap-3 ml-4 flex-none">
                  {isAdmin && (
                    <div className="relative">
                      <button
                        onClick={(e) => { e.stopPropagation(); setOpenMenuFor(openMenuFor === a.id ? null : a.id); }}
                        aria-haspopup="true"
                        aria-expanded={openMenuFor === a.id}
                        className="p-2 rounded-full hover:bg-slate-50 text-slate-600"
                        title="More"
                      >
                        {/* Three-dot icon */}
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM18 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </button>

                      {openMenuFor === a.id && (
                        <div ref={(el) => { menuRef.current = el; }} onClick={(e) => e.stopPropagation()} className="absolute right-0 mt-2 w-40 bg-white border border-slate-100 rounded-xl shadow-lg p-2 z-50">
                          <button onClick={() => { setOpenMenuFor(null); handleStartEdit(a.id); }} className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-md">Edit</button>
                          <button onClick={() => { setOpenMenuFor(null); handleDeleteAnnouncement(a.id); }} className="w-full text-left px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-50 rounded-md">Delete</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <p className="text-sm text-slate-600 leading-loose whitespace-pre-wrap font-medium" dangerouslySetInnerHTML={{ __html: a.content }}></p>
            </div>
          );
        })}
        {state.announcements.length === 0 && <div className="text-center py-24 text-slate-300 font-bold uppercase tracking-[0.3em] text-[10px]">No new notices</div>}
      </div>

      {/* Edit Modal */}
      <Modal 
        isOpen={editingId !== null}
        onClose={() => setEditingId(null)}
        title="Edit Announcement"
        maxWidth="lg"
      >
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Subject</label>
            <input
              type="text"
              required
              placeholder="Subject"
              className="w-full px-6 py-4 rounded-xl bg-slate-50 border border-slate-200 outline-none font-bold text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              value={editForm.title}
              onChange={e => setEditForm({ ...editForm, title: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Message</label>
            <textarea
              required
              placeholder="Message..."
              className="w-full h-48 px-6 py-5 rounded-xl bg-slate-50 border border-slate-200 outline-none resize-none text-sm font-medium leading-relaxed focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              value={editForm.content}
              onChange={e => setEditForm({ ...editForm, content: e.target.value })}
            ></textarea>
          </div>
          <div className="flex gap-3 pt-4">
            <button
              onClick={handleSaveEdit}
              className="flex-1 py-4 bg-indigo-600 text-white rounded-xl font-bold uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 active:scale-[0.98] hover:bg-indigo-700 transition-all"
            >
              <Icons.Check /> Save
            </button>
            <button
              onClick={() => setEditingId(null)}
              className="flex-1 py-4 bg-slate-200 text-slate-800 rounded-xl font-bold uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-2 active:scale-[0.98] hover:bg-slate-300 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AnnouncementView;
