
import React from 'react';
import { EntityClass, Constructor } from '../types.ts';
import { SelectorCard } from './PicksForm.tsx';
import { TeamIcon } from './icons/TeamIcon.tsx';
import { DriverIcon } from './icons/DriverIcon.tsx';
import { CONSTRUCTORS } from '../constants.ts';

interface SelectorGroupProps {
  title: string;
  slots: number;
  options: { id: string; name: string; class: EntityClass; constructorId?: string }[];
  selected: (string | null)[];
  onSelect: (value: string | null, index: number) => void;
  getUsage: (id: string, type: 'teams' | 'drivers') => number;
  getLimit: (entityClass: EntityClass, type: 'teams' | 'drivers') => number;
  hasRemaining: (id: string, type: 'teams' | 'drivers') => boolean;
  entityType: 'teams' | 'drivers';
  setModalContent: (content: React.ReactNode | null) => void;
  disabled?: boolean;
  allConstructors: Constructor[];
}

// Helper to add alpha to hex for background
const hexToRgba = (hex: string, alpha: number) => {
    // Basic hex parsing
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const SelectorGroup: React.FC<SelectorGroupProps> = ({ title, slots, options, selected, onSelect, getUsage, getLimit, hasRemaining, entityType, setModalContent, disabled, allConstructors }) => {
  
  const entityClass = options[0]?.class || EntityClass.A;
  const limit = getLimit(entityClass, entityType);

  // Helper to find color with fallback to constants
  const getColor = (optionId: string): string | undefined => {
    let color: string | undefined;
    
    if (entityType === 'teams') {
       color = allConstructors.find(c => c.id === optionId)?.color;
       // Fallback to constants if DB record is stale/missing color
       if (!color) color = CONSTRUCTORS.find(c => c.id === optionId)?.color;
    } else {
       // For drivers, find their constructor first
       const driver = options.find(d => d.id === optionId);
       if (driver?.constructorId) {
           color = allConstructors.find(c => c.id === driver.constructorId)?.color;
           if (!color) color = CONSTRUCTORS.find(c => c.id === driver.constructorId)?.color;
       }
    }
    return color;
  };

  const openModal = (index: number) => {
    if (disabled) return;
    const placeholderText = title.endsWith('s') ? title.slice(0, -1) : title;
    
    // Drivers get 4 columns, Teams get 3 columns on desktop
    const gridCols = entityType === 'drivers' ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2 md:grid-cols-3';

    const modalBody = (
      <div className="p-6">
        <h4 className="text-2xl font-bold mb-6 text-pure-white italic uppercase tracking-wider text-center">Select {placeholderText}</h4>
        <div className={`grid ${gridCols} gap-3`}>
          {options.map(option => {
            const isSelected = selected.includes(option.id);
            const canSelect = hasRemaining(option.id, entityType);
            const isModalOptionDisabled = isSelected || !canSelect;
            const usageCount = getUsage(option.id, entityType);
            const color = getColor(option.id);
            
            const handleSelect = () => {
              if (isModalOptionDisabled) return;
              onSelect(option.id, index);
              setModalContent(null);
            };
            
            return (
              <div
                key={option.id}
                onClick={handleSelect}
                style={{
                  borderColor: !isModalOptionDisabled && color ? color : undefined,
                  backgroundColor: !isModalOptionDisabled && color ? hexToRgba(color, 0.15) : undefined,
                  boxShadow: !isModalOptionDisabled && color ? `0 4px 15px -3px ${hexToRgba(color, 0.1)}` : undefined
                }}
                className={`
                  relative flex flex-col items-center justify-center text-center gap-1 h-24 rounded-xl px-2 border transition-all duration-200 group overflow-hidden
                  ${isModalOptionDisabled 
                    ? 'bg-accent-gray opacity-40 cursor-not-allowed border-transparent' 
                    : 'bg-carbon-black border-accent-gray hover:border-pure-white/50 cursor-pointer hover:scale-[1.02] hover:shadow-lg'
                  }
                `}
              >
                {/* Stripe for team color */}
                {!isModalOptionDisabled && color && <div className="absolute left-0 top-0 bottom-0 w-1" style={{backgroundColor: color}}></div>}
                
                <span className="font-bold text-sm md:text-base leading-tight text-pure-white z-10">{option.name}</span>
                
                <div className="telemetry-row mt-1 py-0 px-2 rounded bg-black/30 border border-white/5 text-[9px] z-10">
                    <span className="telemetry-value font-mono">{usageCount} / {limit}</span>
                </div>
                
                {!canSelect && <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20 backdrop-blur-[1px]"><span className="text-[10px] font-black uppercase text-red-500 tracking-widest border border-red-500 px-2 py-1 rounded bg-black/80">Limit</span></div>}
                {isSelected && <div className="absolute inset-0 flex items-center justify-center bg-green-900/60 z-20 backdrop-blur-[1px]"><span className="text-[10px] font-black uppercase text-green-400 tracking-widest border border-green-500 px-2 py-1 rounded bg-black/80">Picked</span></div>}
              </div>
            );
          })}
        </div>
      </div>
    );
    setModalContent(modalBody);
  };

  const Icon = entityType === 'teams' ? TeamIcon : DriverIcon;

  const gridLayoutClass = slots === 1 ? 'grid-cols-1' :
                          slots === 2 ? 'grid-cols-1 md:grid-cols-2' :
                          'grid-cols-1 md:grid-cols-3';

  return (
    <div className={`card-premium-silver p-4 md:p-5 transition-opacity duration-200 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <div className="flex justify-between items-center mb-4 border-b border-pure-white/5 pb-2">
          <h3 className="text-lg font-bold text-pure-white flex items-center gap-2 uppercase tracking-wide">
            <div className={`p-1.5 rounded-lg ${entityClass === EntityClass.A ? 'bg-primary-red/20 text-primary-red' : 'bg-blue-500/20 text-blue-400'}`}>
                <Icon className="w-5 h-5" />
            </div>
            {title}
          </h3>
          <span className="text-[10px] font-black bg-carbon-black/50 border border-pure-white/10 px-2 py-1 rounded text-highlight-silver uppercase tracking-wider">
            {slots} Slot{slots > 1 ? 's' : ''}
          </span>
      </div>
      
      <div className={`grid ${gridLayoutClass} gap-3`}>
        {Array.from({ length: slots }).map((_, index) => {
          const selectedId = selected[index];
          const selectedOption = options.find(o => o.id === selectedId);
          const usage = selectedOption ? `${getUsage(selectedOption.id, entityType)} / ${limit}` : '';
          const placeholderText = entityType === 'teams' ? 'Team' : 'Driver';
          const color = selectedOption ? getColor(selectedOption.id) : undefined;
          
          return (
            <SelectorCard
              key={index}
              option={selectedOption || null}
              isSelected={!!selectedOption}
              onClick={() => openModal(index)}
              placeholder={placeholderText}
              usage={usage}
              disabled={disabled}
              color={color}
            />
          );
        })}
      </div>
    </div>
  );
};

export default SelectorGroup;
