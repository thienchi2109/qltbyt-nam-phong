'use client';

import { useEffect } from 'react';

export function ThemeColorManager() {
  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;
    const updateThemeColor = () => {
      // Get computed CSS variable for primary color
      const root = document.documentElement;
      const primaryHsl = getComputedStyle(root).getPropertyValue('--primary').trim();
      
      // Convert HSL to hex
      const hslToHex = (hsl: string) => {
        const [h, s, l] = hsl.split(' ').map(val => parseFloat(val.replace('%', '')));
        
        const lightness = l / 100;
        const saturation = s / 100;
        const hue = h;
        
        const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
        const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
        const m = lightness - c / 2;
        
        let r, g, b;
        
        if (0 <= hue && hue < 60) {
          r = c; g = x; b = 0;
        } else if (60 <= hue && hue < 120) {
          r = x; g = c; b = 0;
        } else if (120 <= hue && hue < 180) {
          r = 0; g = c; b = x;
        } else if (180 <= hue && hue < 240) {
          r = 0; g = x; b = c;
        } else if (240 <= hue && hue < 300) {
          r = x; g = 0; b = c;
        } else {
          r = c; g = 0; b = x;
        }
        
        r = Math.round((r + m) * 255);
        g = Math.round((g + m) * 255);
        b = Math.round((b + m) * 255);
        
        return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
      };
      
      try {
        if (primaryHsl) {
          const hexColor = hslToHex(primaryHsl);
          
          // Update theme-color meta tag
          let themeColorMeta = document.querySelector('meta[name="theme-color"]');
          if (!themeColorMeta) {
            themeColorMeta = document.createElement('meta');
            themeColorMeta.setAttribute('name', 'theme-color');
            document.head.appendChild(themeColorMeta);
          }
          themeColorMeta.setAttribute('content', hexColor);
        }
      } catch (error) {
        console.warn('Failed to update theme color:', error);
        // Fallback to static color
        let themeColorMeta = document.querySelector('meta[name="theme-color"]');
        if (!themeColorMeta) {
          themeColorMeta = document.createElement('meta');
          themeColorMeta.setAttribute('name', 'theme-color');
          document.head.appendChild(themeColorMeta);
        }
        themeColorMeta.setAttribute('content', '#447896');
      }
    };

    // Update on mount
    updateThemeColor();

    // Listen for theme changes
    const observer = new MutationObserver(() => {
      updateThemeColor();
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme']
    });

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => updateThemeColor();
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  return null; // This component doesn't render anything
} 