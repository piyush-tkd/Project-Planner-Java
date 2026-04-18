import { AQUA, AQUA_TINTS, DEEP_BLUE, DEEP_BLUE_TINTS, BORDER_DEFAULT, BORDER_SUBTLE, FONT_FAMILY } from '../../brandTokens';

export const NLP_STYLES = `
  /* Hero section glass-morphism */
  @keyframes nlp-gradient-shift {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  .nlp-hero-brain {
    animation: nlp-hero-glow 3s ease-in-out infinite;
  }
  @keyframes nlp-hero-glow {
    0%, 100% { box-shadow: 0 0 24px ${AQUA}20, inset 0 0 16px ${AQUA}10; }
    50% { box-shadow: 0 0 32px ${AQUA}30, inset 0 0 20px ${AQUA}15; }
  }
  /* Insight card hover */
  .nlp-insight-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(45,204,211,0.12) !important;
    border-left-color: ${AQUA} !important;
  }
  [data-mantine-color-scheme="light"] .nlp-insight-card:hover {
    background: #fafffe !important;
  }
  [data-mantine-color-scheme="dark"] .nlp-insight-card:hover {
    background: rgba(45,204,211,0.06) !important;
  }
  /* Search container glow */
  .nlp-search-container {
    backdrop-filter: blur(8px);
  }
  .nlp-typing-indicator {
    animation: nlp-typing-bounce 1s ease-in-out infinite;
  }
  @keyframes nlp-typing-bounce {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.6; transform: scale(1.1); }
  }
  /* Progress bar shimmer */
  @keyframes nlp-shimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }
  .nlp-progress-shimmer {
    animation: nlp-shimmer 2s infinite;
  }
  /* Quick action enhancements */
  .nlp-quick-action:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px ${AQUA}20, inset 0 0 12px ${AQUA}10;
    border-color: ${AQUA} !important;
    background: linear-gradient(135deg, ${AQUA}08 0%, ${DEEP_BLUE}04 100%) !important;
  }
  .nlp-action-icon {
    transition: transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .nlp-quick-action:hover .nlp-action-icon {
    transform: rotate(12deg) scale(1.1);
  }
  .nlp-suggestion-badge:hover {
    background: ${AQUA_TINTS[10]} !important;
    transform: translateY(-1px);
  }
  .nlp-info-tile {
    transition: all 150ms ease;
  }
  .nlp-info-tile:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  }
  .nlp-list-item {
    transition: all 150ms ease;
  }
  .nlp-list-item:hover {
    background: ${AQUA_TINTS[10]};
    border-left-color: ${AQUA} !important;
    box-shadow: 0 1px 6px rgba(45, 204, 211, 0.10);
  }
  .nlp-list-item[style*="cursor: pointer"]:hover {
    transform: translateX(2px);
  }
  .nlp-list-item[style*="cursor: pointer"]:hover svg {
    opacity: 0.8 !important;
    transform: translateX(2px);
    transition: all 150ms ease;
  }
  .nlp-list-item[style*="cursor: pointer"]:active {
    transform: translateX(1px);
    background: ${DEEP_BLUE_TINTS[10]};
  }
  .nlp-list-item.nlp-list-focused {
    background: ${AQUA_TINTS[10]};
    border-left-color: ${AQUA} !important;
    box-shadow: 0 0 0 2px ${AQUA};
    outline: none;
  }
  .nlp-recent-badge:hover {
    background: ${AQUA_TINTS[10]} !important;
    color: ${AQUA} !important;
  }
  /* Autocomplete dropdown styling */
  .mantine-Autocomplete-dropdown {
    border: 1px solid ${BORDER_DEFAULT};
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.08);
    padding: 4px;
    margin-top: 4px;
  }
  .mantine-Autocomplete-option {
    border-radius: 8px;
    font-size: 13px;
    font-family: ${FONT_FAMILY};
    padding: 8px 12px;
  }
  .mantine-Autocomplete-option[data-combobox-selected] {
    background: ${AQUA_TINTS[10]};
    color: ${DEEP_BLUE};
  }
  .mantine-Autocomplete-option:hover {
    background: ${AQUA_TINTS[10]};
  }
  @keyframes nlp-count-up {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .nlp-count-animate {
    animation: nlp-count-up 400ms ease-out;
  }
  @keyframes nlp-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  .nlp-loading-pulse {
    animation: nlp-pulse 1.2s ease-in-out infinite;
  }
  @keyframes nlp-slide-in {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .nlp-stagger-item {
    animation: nlp-slide-in 300ms ease-out both;
  }
  @keyframes nlp-skeleton-shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  .nlp-skeleton {
    background: linear-gradient(90deg, ${BORDER_DEFAULT} 25%, ${BORDER_SUBTLE} 50%, ${BORDER_DEFAULT} 75%);
    background-size: 200% 100%;
    animation: nlp-skeleton-shimmer 1.5s ease-in-out infinite;
  }
  @keyframes nlp-thinking-pulse {
    0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(45, 204, 211, 0.3); }
    50% { transform: scale(1.08); box-shadow: 0 0 0 8px rgba(45, 204, 211, 0); }
  }
  .nlp-thinking-icon {
    animation: nlp-thinking-pulse 2s ease-in-out infinite;
  }
  @keyframes nlp-progress-glow {
    0%, 100% { filter: brightness(1); }
    50% { filter: brightness(1.3); }
  }
  .nlp-progress-bar {
    animation: nlp-progress-glow 2s ease-in-out infinite;
  }
  .nlp-breadcrumb-btn:hover {
    background-color: ${AQUA_TINTS[10]} !important;
    box-shadow: 0 0 0 1px ${AQUA};
  }
  /* Additional smooth transitions */
  @keyframes nlp-fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  /* Glow pulse for focus states */
  @keyframes nlp-glow-pulse {
    0%, 100% { box-shadow: 0 0 0 0 ${AQUA}40; }
    50% { box-shadow: 0 0 0 8px ${AQUA}0; }
  }
  /* Smooth gradient transitions */
  .nlp-quick-action,
  .nlp-insight-card {
    background-attachment: fixed;
  }
  /* Hover state consistency */
  .nlp-insight-card,
  .nlp-quick-action,
  .nlp-suggestion-badge,
  .nlp-recent-badge {
    will-change: transform, box-shadow;
  }
`;
