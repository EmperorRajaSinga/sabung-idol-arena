import React, { useState } from 'react';
import { GirlGroup, Idol } from '../types';
import { generateAvatarUrl } from '../data/initialData';
import { compressImage } from '../utils/imageHelper';
import { Layers, Plus, Upload, Trash2, X, Check } from 'lucide-react';

interface GirlGroupManagerPanelProps {
  girlGroups: GirlGroup[];
  idols: Idol[];
  onAddGirlGroup: (groupName: string, memberNames: string[], logoUrl?: string) => void;
  onUpdateGroupMembers: (groupId: string, memberNames: string[]) => void;
  onUpdateGroupLogo: (groupId: string, logoUrl: string) => void;
  onDeleteGroup: (groupId: string) => void;
  onDeleteMemberFromGroup: (groupId: string, memberName: string) => void;
}

export const GirlGroupManagerPanel: React.FC<GirlGroupManagerPanelProps> = ({
  girlGroups,
  idols,
  onAddGirlGroup,
  onUpdateGroupMembers,
  onUpdateGroupLogo,
  onDeleteGroup,
  onDeleteMemberFromGroup,
}) => {
  const [showAddGroupModal, setShowAddGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupMembersText, setNewGroupMembersText] = useState('');

  // Bulk Edit Modal
  const [editingGroup, setEditingGroup] = useState<GirlGroup | null>(null);
  const [editText, setEditText] = useState('');

  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    const names = newGroupMembersText
      .split('\n')
      .map((n) => n.trim())
      .filter(Boolean);

    onAddGirlGroup(newGroupName.trim(), names);
    setNewGroupName('');
    setNewGroupMembersText('');
    setShowAddGroupModal(false);
  };

  const handleSaveBulkEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGroup) return;

    const names = editText
      .split('\n')
      .map((n) => n.trim())
      .filter(Boolean);

    onUpdateGroupMembers(editingGroup.id, names);
    setEditingGroup(null);
  };

  const handleGroupLogoFile = async (
    groupId: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImage(file, 400, 400, 0.85);
      onUpdateGroupLogo(groupId, compressed);
    } catch {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (result) {
          onUpdateGroupLogo(groupId, result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white flex items-center gap-2">
            <Layers className="h-6 w-6 text-indigo-400" />
            <span>Girl Group Manager</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Create girl groups, upload custom logos, and paste member lists (one name per line) to auto-create idols.
          </p>
        </div>

        <button
          onClick={() => setShowAddGroupModal(true)}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-500 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>New Girl Group</span>
        </button>
      </div>

      {/* Girl Group Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {girlGroups.map((group) => {
          const groupMembers = idols.filter((i) => i.girlGroup === group.name);

          return (
            <div
              key={group.id}
              className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 flex flex-col justify-between space-y-4 hover:border-slate-700 transition-colors shadow-lg"
            >
              <div>
                {/* Card Header */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-3">
                    {/* Logo */}
                    <div className="relative h-12 w-12 overflow-hidden rounded-xl border border-indigo-500/30 bg-slate-950 p-1">
                      {group.logoUrl ? (
                        <img
                          src={group.logoUrl}
                          alt={group.name}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center font-black text-xs text-indigo-400">
                          {group.name.substring(0, 3).toUpperCase()}
                        </div>
                      )}
                      <label className="absolute inset-0 flex items-center justify-center bg-slate-950/80 text-white opacity-0 hover:opacity-100 transition-opacity cursor-pointer">
                        <Upload className="h-4 w-4" />
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleGroupLogoFile(group.id, e)}
                          className="hidden"
                        />
                      </label>
                    </div>

                    <div>
                      <h3 className="font-extrabold text-lg text-white leading-tight">
                        {group.name}
                      </h3>
                      <span className="text-[11px] font-semibold text-slate-400">
                        {groupMembers.length} Members
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => onDeleteGroup(group.id)}
                    title="Delete Girl Group"
                    className="p-2 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Members List */}
                <div className="mt-3 space-y-1.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                  {groupMembers.length > 0 ? (
                    groupMembers.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800/60 text-xs text-slate-200"
                      >
                        <div className="flex items-center gap-2">
                          {member.photoUrl ? (
                            <img
                              src={member.photoUrl}
                              alt={member.name}
                              className="h-6 w-6 rounded-md object-cover border border-slate-700"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="h-6 w-6 rounded-md bg-slate-800 flex items-center justify-center text-[10px] font-bold text-amber-300">
                              {(member.name || 'ID').slice(0, 1)}
                            </div>
                          )}
                          <span className="font-bold">{member.name}</span>
                          <span className="text-[10px] text-slate-500 font-semibold">
                            ({member.seed})
                          </span>
                        </div>
                        <button
                          onClick={() => onDeleteMemberFromGroup(group.id, member.name)}
                          title="Remove from group"
                          className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="py-6 text-center text-xs text-slate-500">
                      No members assigned yet.
                    </div>
                  )}
                </div>
              </div>

              {/* Action */}
              <button
                onClick={() => {
                  setEditingGroup(group);
                  setEditText(groupMembers.map((m) => m.name).join('\n'));
                }}
                className="w-full py-2 text-xs font-bold text-indigo-400 rounded-xl border border-indigo-500/20 bg-indigo-500/10 hover:bg-indigo-500/20 transition-colors"
              >
                Paste / Edit Member List
              </button>
            </div>
          );
        })}
      </div>

      {/* Add New Group Modal */}
      {showAddGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
            <h3 className="font-extrabold text-lg text-white">Create New Girl Group</h3>
            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                  Girl Group Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. aespa"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                  Member Names (One per line)
                </label>
                <textarea
                  rows={6}
                  placeholder={`Karina\nWinter\nGiselle\nNingning`}
                  value={newGroupMembersText}
                  onChange={(e) => setNewGroupMembersText(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddGroupModal(false)}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500"
                >
                  Create Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Edit Modal */}
      {editingGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
            <h3 className="font-extrabold text-lg text-white">
              Edit Members for {editingGroup.name}
            </h3>
            <p className="text-xs text-slate-400">
              Paste member names below (one per line). Any new names will automatically create a new idol entry in the database.
            </p>

            <form onSubmit={handleSaveBulkEdit} className="space-y-4">
              <textarea
                rows={8}
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingGroup(null)}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500"
                >
                  Save Members
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
