import React, { useState } from 'react';
import { Group, Idol, KnockoutMatch, TournamentConfig } from '../types';
import { GroupDrawPanel } from './GroupDrawPanel';
import { GroupStagePanel } from './GroupStagePanel';
import { KnockoutBracketPanel } from './KnockoutBracketPanel';
import { Layers, Table, Swords } from 'lucide-react';

type UnzureSection = 'draw' | 'group_stage' | 'knockout';

interface UnzureCupPanelProps {
  groups: Group[];
  knockoutMatches: KnockoutMatch[];
  idolsMap: Map<string, Idol>;
  config: TournamentConfig;
  onRedrawGroups: () => void;
  onStartGroupStage: () => void;
  onSaveGroups: (updatedGroups: Group[]) => void;
  onUpdateFavoriteIdols: (favoriteIds: string[]) => void;
  onUpdateGroupMatch: (groupId: string, matchId: string, scoreA: number, scoreB: number, winnerId: string) => void;
  onFinalizeGroupStageAndBuildKnockout: () => void;
  onResetCurrentSeason: () => void;
  onResetGroupScoresOnly: () => void;
  onResetSingleGroupMatch: (groupId: string, matchId: string) => void;
  onSimulateAllGroupMatches: () => void;
  onUpdateKnockoutMatch: (matchId: string, scoreA: number, scoreB: number, winnerId: string) => void;
  onCrownChampionAndArchive: () => void;
  onSaveKnockoutMatches: (updatedMatches: KnockoutMatch[]) => void;
  onRegenerateAutoBracket: () => void;
  onResetKnockoutOnly: () => void;
  onResetSingleKnockoutMatch: (matchId: string) => void;
  onSimulateAllKnockoutMatches: () => void;
}

const sections: Array<{ id: UnzureSection; label: string; description: string; icon: React.ElementType }> = [
  { id: 'draw', label: 'Group Draw', description: 'Pengundian peserta dan pengaturan grup', icon: Layers },
  { id: 'group_stage', label: 'Group Stage', description: 'Jadwal, hasil pertandingan, dan klasemen grup', icon: Table },
  { id: 'knockout', label: 'Knockout Bracket', description: 'Babak eliminasi hingga penentuan juara', icon: Swords },
];

export const UnzureCupPanel: React.FC<UnzureCupPanelProps> = (props) => {
  const [activeSection, setActiveSection] = useState<UnzureSection>('draw');

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-indigo-400">Tournament Workspace</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-white">Unzure Cup</h1>
            <p className="mt-1 text-xs text-slate-400">Kelola seluruh tahapan turnamen dalam satu panel.</p>
          </div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            {props.config.seasonName || `Season ${props.config.seasonNumber || 1}`}
          </div>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-2 md:grid-cols-3">
          {sections.map((section, index) => {
            const Icon = section.icon;
            const active = activeSection === section.id;
            const complete = section.id === 'draw'
              ? props.groups.length > 0
              : section.id === 'group_stage'
                ? props.config.isGroupStageFinished
                : props.knockoutMatches.length > 0;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSection(section.id)}
                aria-current={active ? 'step' : undefined}
                className={`flex min-w-0 items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${active ? 'border-indigo-400/70 bg-indigo-500/15 shadow-lg shadow-indigo-950/30' : 'border-slate-800 bg-slate-900/70 hover:border-slate-600 hover:bg-slate-900'}`}
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${active ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400'}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-xs font-black ${active ? 'text-white' : 'text-slate-200'}`}>{index + 1}. {section.label}</span>
                  <span className="mt-1 block text-[10px] leading-relaxed text-slate-500">{section.description}</span>
                </span>
                <span className={`h-2 w-2 shrink-0 rounded-full ${complete ? 'bg-emerald-400' : 'bg-slate-700'}`} title={complete ? 'Data tersedia' : 'Belum dimulai'} />
              </button>
            );
          })}
        </div>
      </div>

      {activeSection === 'draw' && (
        <GroupDrawPanel
          groups={props.groups}
          idolsMap={props.idolsMap}
          config={props.config}
          onRedrawGroups={props.onRedrawGroups}
          onStartGroupStage={() => setActiveSection('group_stage')}
          onSaveGroups={props.onSaveGroups}
          onUpdateFavoriteIdols={props.onUpdateFavoriteIdols}
        />
      )}
      {activeSection === 'group_stage' && (
        <GroupStagePanel
          groups={props.groups}
          idolsMap={props.idolsMap}
          config={props.config}
          onUpdateGroupMatch={props.onUpdateGroupMatch}
          onFinalizeGroupStageAndBuildKnockout={() => {
            props.onFinalizeGroupStageAndBuildKnockout();
            setActiveSection('knockout');
          }}
          onSaveGroups={props.onSaveGroups}
          onResetCurrentSeason={props.onResetCurrentSeason}
          onResetGroupScoresOnly={props.onResetGroupScoresOnly}
          onResetSingleGroupMatch={props.onResetSingleGroupMatch}
          onSimulateAllMatches={props.onSimulateAllGroupMatches}
        />
      )}
      {activeSection === 'knockout' && (
        <KnockoutBracketPanel
          knockoutMatches={props.knockoutMatches}
          idolsMap={props.idolsMap}
          config={props.config}
          onUpdateKnockoutMatch={props.onUpdateKnockoutMatch}
          onCrownChampionAndArchive={props.onCrownChampionAndArchive}
          onSaveKnockoutMatches={props.onSaveKnockoutMatches}
          onRegenerateAutoBracket={() => {
            props.onRegenerateAutoBracket();
            setActiveSection('knockout');
          }}
          onResetCurrentSeason={props.onResetCurrentSeason}
          onResetKnockoutOnly={props.onResetKnockoutOnly}
          onResetSingleKnockoutMatch={props.onResetSingleKnockoutMatch}
          onSimulateAllMatches={props.onSimulateAllKnockoutMatches}
        />
      )}
    </div>
  );
};
