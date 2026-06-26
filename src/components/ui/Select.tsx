import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';

interface SelectOption {
    value: string;
    label: string;
    icon?: React.ReactNode;
    disabled?: boolean;
}

interface SelectProps {
    options: SelectOption[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    size?: "sm" | "md";
    disabled?: boolean;
}

export function Select({ options, value, onChange, placeholder = "Select...", className = "", size = "md", disabled = false }: SelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find(opt => opt.value === value);
    // sm matches the 9px header buttons; md matches the 8px modal buttons/inputs.
    const triggerSize = size === "sm" ? "h-8 px-2.5 text-[13px] rounded-[9px]" : "px-3 py-2 text-sm rounded-lg";
    const dropdownRadius = size === "sm" ? "rounded-[9px]" : "rounded-lg";
    const optionSize = size === "sm" ? "px-2.5 py-2 text-[13px] rounded-[6px]" : "px-3 py-2 text-sm rounded-[6px]";

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        const handleBlurOrResize = () => setIsOpen(false);

        document.addEventListener('mousedown', handleClickOutside);
        window.addEventListener('blur', handleBlurOrResize);
        window.addEventListener('resize', handleBlurOrResize);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('blur', handleBlurOrResize);
            window.removeEventListener('resize', handleBlurOrResize);
        };
    }, []);

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <motion.button
                whileTap={disabled ? undefined : { scale: 0.98 }}
                onClick={() => { if (!disabled) setIsOpen(!isOpen); }}
                disabled={disabled}
                className={`w-full flex items-center justify-between ${triggerSize} bg-surface-elevated border border-border text-text-primary transition-colors ${disabled ? 'opacity-60 cursor-not-allowed' : 'hover:border-accent/50'} ${isOpen ? 'border-accent ring-1 ring-accent/20' : ''}`}
            >
                <span className="flex items-center gap-2 min-w-0 flex-1">
                    {selectedOption?.icon}
                    <span className={`truncate text-left ${!selectedOption ? 'text-text-muted' : ''}`}>
                        {selectedOption ? selectedOption.label : placeholder}
                    </span>
                </span>
                <ChevronDown size={16} className={`text-text-secondary shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </motion.button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        className={`absolute z-50 w-full mt-1 bg-surface-card border border-border ${dropdownRadius} shadow-2xl max-h-60 overflow-y-auto p-1.5 flex flex-col gap-0.5`}
                    >
                        {options.map((option) => (
                            <button
                                key={option.value}
                                disabled={option.disabled}
                                onClick={() => {
                                    if (!option.disabled) {
                                        onChange(option.value);
                                        setIsOpen(false);
                                    }
                                }}
                                className={`w-full flex items-center justify-between text-left transition-colors
                                          ${optionSize}
                                          ${option.disabled ? 'opacity-40 cursor-not-allowed hover:bg-transparent' : 'hover:bg-surface-hover'}
                                          ${option.value === value ? 'text-accent bg-accent/5 font-medium' : 'text-text-primary'}`}
                            >
                                <span className="flex items-center gap-2 min-w-0 flex-1">
                                    {option.icon}
                                    <span className="truncate">{option.label}</span>
                                </span>
                                {option.value === value && <Check size={14} className="shrink-0" />}
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
