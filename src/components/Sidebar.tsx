import React, { useRef } from 'react';
import { ActiveTab } from '../types';
import { compressImage } from '../utils/imageHelper';
import {
  LayoutDashboard,
  Settings as SettingsIcon,
  Users,
  Layers,
  Award,
  Globe,
  Trophy,
  Swords,
  Table,
  BarChart3,
  User,
  GitCompare,
  Crown,
  Flame,
  Archive,
  Info,
  Play,
  Eye,
  Camera,
  X,
  UserX,
  Sparkles,
  Sliders,
  Database,
  FastForward,
} from 'lucide-react';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  isTournamentActive: boolean;
  seasonNumber: number;
  appLogoUrl?: string;
  onUpdateAppLogo?: (logoUrl: string) => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isTournamentActive,
  seasonNumber,
  appLogoUrl,
  onUpdateAppLogo,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUpdateAppLogo) return;

    try {
      const compressed = await compressImage(file, 200, 200, 0.9);
      onUpdateAppLogo(compressed);
    } catch {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (result) {
          onUpdateAppLogo(result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSelectTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const groups = [
    {
      title: 'OVERVIEW',
      items: [
        { id: 'dashboard' as ActiveTab, label: 'Dashboard', icon: LayoutDashboard },
        { id: 'rank_panel' as ActiveTab, label: 'Rank Panel', icon: Crown, badge: 'New' },
        { id: 'system_info' as ActiveTab, label: 'System Info', icon: Info },
      ],
    },
    {
      title: 'PERMANENT DATABASE',
      items: [
        { id: 'idols' as ActiveTab, label: 'Idol Database', icon: Users },
        { id: 'groups' as ActiveTab, label: 'Girl Group Manager', icon: Layers },
        { id: 'ratings' as ActiveTab, label: 'Rating Manager', icon: Sliders, badge: '0-100' },
        { id: 'seeds' as ActiveTab, label: 'Seed Manager', icon: Award },
        { id: 'inactive_manager' as ActiveTab, label: 'Inactive Manager', icon: UserX },
        { id: 'nationalities' as ActiveTab, label: 'Nationality Manager', icon: Globe },
        { id: 'settings' as ActiveTab, label: 'Settings', icon: SettingsIcon },
      ],
    },
    {
      title: 'TOURNAMENT WORKSPACE',
      items: [
        {
          id: 'season_simulator' as ActiveTab,
          label: 'Full Season Simulator',
          icon: FastForward,
          badge: '1-Click',
        },
        { id: 'competition' as ActiveTab, label: 'Competition Manager', icon: Play },
        { id: 'draw' as ActiveTab, label: 'Group Draw', icon: Layers },
        {
          id: 'group_stage' as ActiveTab,
          label: 'Group Stage',
          icon: Table,
          badge: isTournamentActive ? 'Live' : undefined,
        },
        {
          id: 'knockout' as ActiveTab,
          label: 'Knockout Bracket',
          icon: Swords,
          badge: isTournamentActive ? 'Live' : undefined,
        },
        {
          id: 'cup_competitions' as ActiveTab,
          label: 'Cup Competitions',
          icon: Trophy,
          badge: 'Cups',
        },
        {
          id: 'division_system' as ActiveTab,
          label: 'Division System',
          icon: Trophy,
          badge: 'D1 / D2',
        },
        {
          id: 'league_system' as ActiveTab,
          label: 'Legacy League System',
          icon: Trophy,
          badge: 'Legacy',
        },
        {
          id: 'the_idols' as ActiveTab,
          label: 'The Idols',
          icon: Sparkles,
          badge: 'Elite',
        },
        { id: 'public_results' as ActiveTab, label: 'Public Live Results', icon: Eye },
      ],
    },
    {
      title: 'HISTORICAL & STATS',
      items: [
        { id: 'data_studio' as ActiveTab, label: 'Data & Stats Studio', icon: Database, badge: 'Editor' },
        { id: 'match_db' as ActiveTab, label: 'Match Database', icon: Table },
        { id: 'career_stats' as ActiveTab, label: 'Career Stats', icon: BarChart3 },
        { id: 'girl_group_stats' as ActiveTab, label: 'Girl Group Stats', icon: Users },
        { id: 'idol_profile' as ActiveTab, label: 'Idol Profile', icon: User },
        { id: 'season_profile' as ActiveTab, label: 'Season Profile', icon: Trophy },
        { id: 'h2h' as ActiveTab, label: 'Head to Head', icon: GitCompare },
        { id: 'hall_of_champions' as ActiveTab, label: 'Hall of Champions', icon: Crown },
        { id: 'all_time_records' as ActiveTab, label: 'All-Time Records', icon: Flame },
        { id: 'archive' as ActiveTab, label: 'Tournament Archive', icon: Archive },
      ],
    },
  ];

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm md:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 md:w-64 flex-shrink-0 border-r-2 border-black bg-[#14100d] flex flex-col h-screen transition-transform duration-300 ease-in-out md:static md:translate-x-0 ${
          isMobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand Header - Sabung Idol Poster Style */}
        <div className="p-4 border-b-2 border-black bg-[#1c1612] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Clickable Logo Avatar */}
            <div
              onClick={() => fileInputRef.current?.click()}
              title="Click to change website logo"
              className="group relative flex h-12 w-12 flex-shrink-0 cursor-pointer items-center justify-center rounded-2xl border-2 border-black bg-[#991b1b] text-white poster-shadow transition-transform hover:scale-105 overflow-hidden"
            >
              {appLogoUrl ? (
                <img
                  src={appLogoUrl}
                  alt="Sabung Idol Logo"
                  className="h-full w-full object-cover"
                />
              ) : (
                <Trophy className="h-6 w-6 text-amber-300 group-hover:opacity-40 transition-opacity" />
              )}

              {/* Hover Overlay Icon */}
              <div className="absolute inset-0 flex items-center justify-center bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="h-4 w-4 text-amber-300" />
              </div>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleLogoUpload}
                accept="image/*"
                className="hidden"
              />
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-poster-title text-xl text-red-500 tracking-wider leading-tight drop-shadow-[2px_2px_0px_#000]">
                  SABUNG IDOL
                </h1>
              </div>
              <p className="font-poster-body text-[9px] font-black uppercase tracking-widest text-amber-400 -mt-0.5">
                BY PESUT MAHAKAM
              </p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="h-2 w-2 rounded-full bg-emerald-400 border border-black animate-pulse" />
                <span className="text-[10px] font-black text-amber-200 uppercase tracking-wide">
                  Season {seasonNumber} Active
                </span>
              </div>
            </div>
          </div>

          {/* Close button for Mobile Drawer */}
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              type="button"
              className="md:hidden flex h-9 w-9 items-center justify-center rounded-xl border border-black bg-[#281e17] text-amber-200 hover:text-white"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 custom-scrollbar">
          {groups.map((group) => (
            <div key={group.title}>
              <div className="px-3 mb-2 text-[10px] font-black tracking-widest text-amber-400 uppercase font-poster-body">
                {group.title}
              </div>
              <div className="space-y-1.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelectTab(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-black transition-all ${
                        isActive
                          ? 'poster-pill-red font-poster-body tracking-wide scale-[1.02] text-white shadow-md'
                          : 'text-amber-100 font-bold hover:bg-[#281e17] hover:text-white border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={`h-4 w-4 ${isActive ? 'text-amber-200' : 'text-amber-400/80'}`} />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className="px-2 py-0.5 text-[9px] font-black rounded-full bg-amber-400 text-black border border-black poster-shadow-sm">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer System Info */}
        <div className="p-3 border-t-2 border-black bg-[#18130f]">
          <div className="rounded-xl bg-[#221a14] p-2.5 border border-black text-center poster-shadow-sm">
            <p className="text-[10px] text-amber-300 font-black tracking-wide font-poster-body">Sabung Idol Engine v2.4</p>
            <p className="text-[9px] text-amber-100/70 mt-0.5 font-bold">Pesut Mahakam Tournament System</p>
          </div>
        </div>
      </aside>
    </>
  );
};
