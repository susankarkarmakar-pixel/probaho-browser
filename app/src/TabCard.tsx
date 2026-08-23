import React from 'react';
import {
  AlertCircle,
  EyeOff,
  Globe,
  Volume2,
  VolumeX,
  X
} from 'lucide-react';

export type TabCardModel = {
  id: string;
  title: string;
  favicon?: string;
  loading?: boolean;
  suspended?: boolean;
  isPrivate?: boolean;
  isPinned?: boolean;
  isAudible?: boolean;
  isMuted?: boolean;
  loadError?: { description: string };
};

export type TabCardGroup = { name: string; color: string };

type TabCardProps = {
  tab: TabCardModel;
  group?: TabCardGroup | null;
  isFirstInGroup?: boolean;
  isActive: boolean;
  isVertical?: boolean;
  onActivate: (id: string) => void;
  onContextMenu: (event: React.MouseEvent, id: string) => void;
  onDragStart: (event: React.DragEvent, id: string) => void;
  onDragOver: (event: React.DragEvent, id: string) => void;
  onDrop: (event: React.DragEvent, id: string) => void;
  onDragEnd: () => void;
  onMiddleClick: (event: React.MouseEvent, id: string) => void;
  onClose: (event: React.MouseEvent, id: string) => void;
  onToggleMute: (event: React.MouseEvent, id: string) => void;
};

const TabCard = React.memo(function TabCard({
  tab,
  group,
  isFirstInGroup,
  isActive,
  isVertical = false,
  onActivate,
  onContextMenu,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onMiddleClick,
  onClose,
  onToggleMute
}: TabCardProps) {
  const handleActivate = () => onActivate(tab.id);
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onActivate(tab.id);
    }
  };

  return (
    <React.Fragment>
      {group && isFirstInGroup && (
        <div
          style={isVertical ? {
            display: 'flex', alignItems: 'center', padding: '2px 8px', margin: '4px 0',
            borderRadius: '6px', backgroundColor: group.color, color: '#fff',
            fontSize: '11px', fontWeight: 'bold'
          } : {
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '2px 8px', margin: '4px 2px 4px 4px', borderRadius: '12px',
            backgroundColor: group.color, color: '#fff', fontSize: '11px', fontWeight: 'bold',
            maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
          }}
          title={group.name}
        >
          {group.name}
        </div>
      )}
      <div
        data-testid={`tab-${tab.id}`}
        className={`${isVertical ? 'tab vertical-tab' : 'tab'} ${isActive ? 'active' : ''} ${tab.isPrivate ? 'private' : ''} ${tab.isPinned ? 'pinned' : ''} ${tab.suspended ? 'suspended' : ''}`}
        role="tab"
        tabIndex={0}
        aria-selected={isActive}
        aria-label={`${tab.title}${tab.suspended ? ', suspended' : ''}`}
        style={isVertical ? {
          background: isActive ? 'var(--tab-active-bg)' : 'transparent',
          borderLeft: group ? `3px solid ${group.color}` : '1px solid transparent',
          userSelect: 'none'
        } : { borderTop: group ? `3px solid ${group.color}` : undefined }}
        onClick={handleActivate}
        onKeyDown={handleKeyDown}
        onContextMenu={(event) => onContextMenu(event, tab.id)}
        draggable
        onDragStart={(event) => onDragStart(event, tab.id)}
        onDragOver={(event) => onDragOver(event, tab.id)}
        onDrop={(event) => onDrop(event, tab.id)}
        onDragEnd={onDragEnd}
        onMouseDown={(event) => onMiddleClick(event, tab.id)}
      >
        {tab.isPrivate && <EyeOff size={isVertical ? 14 : 10} style={{ marginRight: isVertical ? '8px' : '4px', opacity: 0.8 }} />}
        {!tab.isPrivate && (
          tab.favicon
            ? <img src={tab.favicon} alt="" style={{ width: isVertical ? 16 : 14, height: isVertical ? 16 : 14, marginRight: tab.isPinned ? 0 : (isVertical ? 8 : 6), flexShrink: 0 }} />
            : <Globe size={isVertical ? 16 : 14} style={{ marginRight: tab.isPinned ? 0 : (isVertical ? 8 : 6), opacity: 0.7, flexShrink: 0 }} />
        )}
        {tab.loading && <span className="tab-loading-indicator" role="status" aria-label="Loading tab"><span /></span>}
        {tab.loadError && <span className="tab-error-indicator" title={tab.loadError.description} aria-label="Page failed to load"><AlertCircle size={12} /></span>}
        {!tab.isPinned && <span className="tab-title" title={tab.title} style={isVertical ? { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '13px', color: isActive ? 'var(--text-color)' : 'var(--text-muted)' } : undefined}>{tab.title}</span>}
        {tab.suspended && <span className="tab-suspended-badge">Suspended</span>}
        {!isVertical && !tab.isPinned && (
          <button className="tab-close" type="button" aria-label={`Close ${tab.title}`} onClick={(event) => onClose(event, tab.id)}><X size={12} /></button>
        )}
        {isVertical && <span className="tab-title" title={tab.title} style={{ display: 'none' }}>{tab.title}</span>}
        {tab.isAudible || tab.isMuted ? (
          <div
            className="tab-audio-indicator"
            style={{ marginLeft: '4px', display: 'flex', alignItems: 'center', opacity: 0.8, cursor: 'pointer' }}
            onClick={(event) => onToggleMute(event, tab.id)}
          >
            {tab.isMuted ? <VolumeX size={12} /> : <Volume2 size={12} />}
          </div>
        ) : null}
        {isVertical && <button className="tab-close" type="button" aria-label={`Close ${tab.title}`} onClick={(event) => onClose(event, tab.id)}><X size={12} /></button>}
      </div>
    </React.Fragment>
  );
});

export default TabCard;
