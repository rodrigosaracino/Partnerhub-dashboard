import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Video, Settings, Target, DollarSign,
  MessageSquare, Camera, BarChart2, PlaySquare, Users, Trophy
} from 'lucide-react';
import { cn } from '../components/Button';

export function Sidebar() {
  const navGroups = [
    {
      label: 'Dashboards',
      items: [
        { name: 'Mix / Visão Geral', path: '/',           icon: <BarChart2 size={17} />,   exact: true },
        { name: 'Instagram',         path: '/instagram',  icon: <Camera size={17} />             },
        { name: 'YouTube',           path: '/youtube',    icon: <PlaySquare size={17} />         },
      ]
    },
    {
      label: 'Gestão',
      items: [
        { name: 'Financeiro',    path: '/finance',      icon: <DollarSign size={17} />   },
        { name: 'Automações',    path: '/automations',  icon: <MessageSquare size={17} /> },
        { name: 'Estratégia',    path: '/strategy',     icon: <Target size={17} />       },
        { name: 'Conteúdo',      path: '/content',      icon: <Video size={17} />        },
        { name: 'Concorrentes',  path: '/competitors',  icon: <Users size={17} />        },
        { name: 'Benchmark',     path: '/benchmark',    icon: <Trophy size={17} />       },
        { name: 'Configurações', path: '/settings',     icon: <Settings size={17} />     },
      ]
    }
  ];

  const allItems = navGroups.flatMap(g => g.items);

  return (
    <>
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">PH</div>
          <h1>PartnerHub</h1>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1, overflowY: 'auto' }}>
          {navGroups.map(group => (
            <div key={group.label}>
              <p className="nav-group-label">{group.label}</p>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {group.items.map(item => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.exact}
                    className={({ isActive }) => cn('nav-link', isActive && 'active')}
                  >
                    {item.icon}
                    {item.name}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div style={{ paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: '0.5rem' }}>
          <p style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', textAlign: 'center', letterSpacing: '0.08em' }}>
            PartnerHub © 2026
          </p>
        </div>
      </aside>

      <nav className="mobile-nav">
        {allItems.slice(0, 5).map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.exact}
            className={({ isActive }) => cn('mobile-nav-link', isActive && 'active')}
          >
            {React.cloneElement(item.icon as React.ReactElement, { size: 20 })}
            <span>{item.name.split('/')[0].trim()}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
}
