// Right side of every group's tab strip: collapse for the bottom drawer,
// maximize and float/dock for grid and floating groups.

import { useEffect, useReducer } from 'react';
import type { IDockviewHeaderActionsProps } from 'dockview-react';
import {
  ArrowsInSimple,
  ArrowsOutSimple,
  CaretDown,
  CaretUp,
  PictureInPicture,
  SquareSplitHorizontal,
} from '@phosphor-icons/react';

function Action({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className="pv2-action"
      aria-label={label}
      title={label}
      onClick={e => {
        e.stopPropagation();
        onClick();
      }}
    >
      {children}
    </button>
  );
}

export function GroupActions({ api, containerApi, group }: IDockviewHeaderActionsProps) {
  // Dockview state lives outside React; re-render when any of it moves
  const [, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const subs = [
      api.onDidLocationChange(bump),
      api.onDidCollapsedChange(bump),
      containerApi.onDidMaximizedGroupChange(bump),
    ];
    return () => subs.forEach(s => s.dispose());
  }, [api, containerApi]);

  const location = api.location.type;

  if (location === 'edge') {
    const collapsed = api.isCollapsed();
    return (
      <div className="pv2-actions">
        <Action
          label={collapsed ? 'Expand' : 'Collapse'}
          onClick={() => (collapsed ? api.expand() : api.collapse())}
        >
          {collapsed ? <CaretUp size={14} /> : <CaretDown size={14} />}
        </Action>
      </div>
    );
  }

  if (location === 'floating') {
    return (
      <div className="pv2-actions">
        <Action label="Dock to the right" onClick={() => api.moveTo({ position: 'right' })}>
          <SquareSplitHorizontal size={14} />
        </Action>
      </div>
    );
  }

  const maximized = api.isMaximized();
  return (
    <div className="pv2-actions">
      {!maximized && (
        <Action label="Float" onClick={() => containerApi.addFloatingGroup(group)}>
          <PictureInPicture size={14} />
        </Action>
      )}
      <Action
        label={maximized ? 'Restore' : 'Maximize'}
        onClick={() => (maximized ? api.exitMaximized() : api.maximize())}
      >
        {maximized ? <ArrowsInSimple size={14} /> : <ArrowsOutSimple size={14} />}
      </Action>
    </div>
  );
}
