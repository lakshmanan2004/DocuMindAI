// Automatic Lite mode (weak devices) & performance utilities
// Master Build Specification - Section 11 & 14

export const initPerformanceMode = () => {
  if (typeof window === 'undefined') return;
  const weak = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
  const saved = localStorage.getItem('lite'); // 'on' | 'off' | null
  const shouldBeLite = saved !== null ? saved === 'on' : weak;
  document.documentElement.classList.toggle('lite', shouldBeLite);
};

export const setLiteMode = (enable) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem('lite', enable ? 'on' : 'off');
  document.documentElement.classList.toggle('lite', enable);
};

export const getLiteMode = () => {
  if (typeof window === 'undefined') return false;
  return document.documentElement.classList.contains('lite');
};

// Initialize on script load
if (typeof window !== 'undefined') {
  initPerformanceMode();
}

