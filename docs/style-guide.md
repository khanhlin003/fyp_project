# AI-Powered ETF Advisor - Style Guide & Design System

## 🎨 **Color Palette**

### **Primary Colors**
```css
--primary-navy: #0F172A;      /* Slate 900 - Main brand color */
--primary-blue: #1E40AF;      /* Blue 700 - Primary CTAs */
--primary-blue-light: #3B82F6; /* Blue 500 - Interactive elements */
--primary-blue-hover: #1D4ED8; /* Blue 600 - Hover states */
```

### **Secondary Colors**
```css
--secondary-blue: #2563EB;    /* Blue 600 - Secondary actions */
--secondary-blue-light: #60A5FA; /* Blue 400 - Accent elements */
--secondary-gray: #64748B;    /* Slate 500 - Secondary text */
--secondary-light: #94A3B8;   /* Slate 400 - Muted text */
```

### **Background Colors**
```css
--bg-primary: #FFFFFF;        /* Pure white - Main background */
--bg-secondary: #F8FAFC;      /* Slate 50 - Section backgrounds */
--bg-tertiary: #F1F5F9;       /* Slate 100 - Cards/containers */
--bg-blue-light: #EFF6FF;     /* Blue 50 - Light blue backgrounds */
--bg-blue-subtle: #DBEAFE;    /* Blue 100 - Subtle blue accents */
```

### **Text Colors**
```css
--text-primary: #0F172A;      /* Primary text */
--text-secondary: #64748B;    /* Secondary text */
--text-muted: #94A3B8;        /* Muted/placeholder text */
--text-white: #FFFFFF;        /* White text on dark backgrounds */
--text-blue: #1E40AF;         /* Blue accent text */
--text-blue-light: #3B82F6;   /* Light blue links/highlights */
```

### **Gradients**
```css
--gradient-hero: linear-gradient(135deg, #0F172A 0%, #1E40AF 100%);
--gradient-cta: linear-gradient(135deg, #1E40AF 0%, #3B82F6 100%);
--gradient-card: linear-gradient(145deg, #FFFFFF 0%, #F8FAFC 100%);
--gradient-blue-subtle: linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%);
--gradient-navy: linear-gradient(135deg, #0F172A 0%, #1E293B 100%);
```

---

## 🔤 **Typography System**

### **Font Families**
```css
/* Import fonts */
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

/* Font family variables */
--font-primary: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-mono: 'JetBrains Mono', 'SF Mono', Monaco, 'Cascadia Code', monospace;
```

### **Font Scale & Hierarchy**
```css
/* Headings */
--text-5xl: 3.5rem;    /* 56px - Hero titles */
--text-4xl: 2.5rem;    /* 40px - Section titles */
--text-3xl: 2rem;      /* 32px - Page titles */
--text-2xl: 1.5rem;    /* 24px - Card titles */
--text-xl: 1.25rem;    /* 20px - Subheadings */
--text-lg: 1.125rem;   /* 18px - Large body text */

/* Body text */
--text-base: 1rem;     /* 16px - Base body text */
--text-sm: 0.875rem;   /* 14px - Small text */
--text-xs: 0.75rem;    /* 12px - Captions/labels */
```

### **Font Weights**
```css
--font-light: 300;     /* Light text */
--font-regular: 400;   /* Regular body text */
--font-medium: 500;    /* Navigation, buttons */
--font-semibold: 600;  /* Subheadings, feature titles */
--font-bold: 700;      /* Main headings */
--font-extrabold: 800; /* Hero titles (use sparingly) */
```

### **Line Heights**
```css
--leading-tight: 1.1;   /* Large headings */
--leading-normal: 1.4;  /* Subheadings */
--leading-relaxed: 1.6; /* Body text */
--leading-loose: 1.8;   /* Captions, small text */
```

### **Letter Spacing**
```css
--tracking-tight: -0.025em;  /* Large headings */
--tracking-normal: 0;        /* Body text */
--tracking-wide: 0.025em;    /* Monospace numbers */
```

---

## 📐 **Spacing System**

### **Padding & Margins**
```css
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
--space-20: 5rem;     /* 80px */
```

### **Border Radius**
```css
--radius-sm: 8px;     /* Small elements */
--radius-md: 12px;    /* Buttons, cards */
--radius-lg: 16px;    /* Large cards */
--radius-xl: 20px;    /* Hero elements */
--radius-full: 50%;   /* Circular elements */
```

---

## 🎯 **Component Styles**

### **Buttons**
```css
/* Primary CTA Button */
.btn-primary {
    background: var(--primary-blue);
    color: var(--text-white);
    font-family: var(--font-primary);
    font-weight: var(--font-medium);
    font-size: var(--text-base);
    padding: var(--space-3) var(--space-6);
    border-radius: var(--radius-md);
    border: none;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 4px 15px rgba(30, 64, 175, 0.4);
}

.btn-primary:hover {
    background: var(--primary-blue-hover);
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(30, 64, 175, 0.6);
}

/* Secondary Button */
.btn-secondary {
    background: transparent;
    color: var(--primary-blue-light);
    border: 2px solid var(--primary-blue-light);
    font-family: var(--font-primary);
    font-weight: var(--font-medium);
    font-size: var(--text-base);
    padding: var(--space-3) var(--space-6);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all 0.3s ease;
}

.btn-secondary:hover {
    background: var(--primary-blue-light);
    color: var(--text-white);
}

/* Navigation Button */
.btn-nav {
    background: var(--primary-blue-light);
    color: var(--text-white);
    font-family: var(--font-primary);
    font-weight: var(--font-medium);
    font-size: var(--text-sm);
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-sm);
    border: none;
    cursor: pointer;
    transition: all 0.3s ease;
}

.btn-nav:hover {
    background: var(--secondary-blue);
}
```

### **Cards**
```css
.card {
    background: var(--bg-primary);
    border-radius: var(--radius-lg);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
    padding: var(--space-8);
    transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.card:hover {
    transform: translateY(-5px);
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
}

.card-title {
    font-family: var(--font-primary);
    font-size: var(--text-xl);
    font-weight: var(--font-semibold);
    color: var(--text-primary);
    margin-bottom: var(--space-4);
    letter-spacing: var(--tracking-tight);
}

.card-description {
    font-family: var(--font-primary);
    font-size: var(--text-base);
    font-weight: var(--font-regular);
    color: var(--text-secondary);
    line-height: var(--leading-relaxed);
}
```

### **Navigation**
```css
.navbar {
    position: fixed;
    top: 0;
    width: 100%;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    padding: var(--space-4) var(--space-8);
    display: flex;
    justify-content: space-between;
    align-items: center;
    z-index: 1000;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    transition: box-shadow 0.3s ease;
}

.logo {
    font-family: var(--font-primary);
    font-size: var(--text-2xl);
    font-weight: var(--font-bold);
    color: var(--primary-navy);
    text-decoration: none;
    letter-spacing: var(--tracking-tight);
}

.nav-link {
    font-family: var(--font-primary);
    font-size: var(--text-base);
    font-weight: var(--font-medium);
    color: var(--text-secondary);
    text-decoration: none;
    transition: color 0.3s ease;
}

.nav-link:hover {
    color: var(--primary-blue);
}
```

---

## 📊 **Financial Data Display**

### **Metrics & Numbers**
```css
.financial-metric {
    font-family: var(--font-mono);
    font-weight: var(--font-semibold);
    letter-spacing: var(--tracking-wide);
}

.metric-large {
    font-size: var(--text-2xl);
    color: var(--text-primary);
}

.metric-medium {
    font-size: var(--text-lg);
    color: var(--text-primary);
}

.metric-small {
    font-size: var(--text-base);
    color: var(--text-secondary);
}

.metric-positive {
    color: var(--primary-blue);
}

.metric-neutral {
    color: var(--text-primary);
}

.metric-highlight {
    color: var(--primary-blue-light);
    background: var(--bg-blue-light);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
}

.metric-label {
    font-family: var(--font-primary);
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
}
```

---

## 🎨 **Layout Components**

### **Sections**
```css
.section {
    padding: var(--space-20) var(--space-8);
}

.section-primary {
    background: var(--bg-primary);
}

.section-secondary {
    background: var(--bg-secondary);
}

.section-hero {
    background: var(--gradient-hero);
    color: var(--text-white);
    min-height: 90vh;
    display: flex;
    align-items: center;
}
```

### **Container**
```css
.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 var(--space-8);
}

.container-narrow {
    max-width: 800px;
    margin: 0 auto;
    padding: 0 var(--space-8);
}
```

### **Grid Systems**
```css
.grid-3 {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: var(--space-12);
}

.grid-2 {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
    gap: var(--space-16);
}

.flex-center {
    display: flex;
    align-items: center;
    justify-content: center;
}

.flex-between {
    display: flex;
    align-items: center;
    justify-content: space-between;
}
```

---

## 📱 **Responsive Breakpoints**

```css
/* Mobile First Approach */
@media (min-width: 640px) { /* sm */ }
@media (min-width: 768px) { /* md */ }
@media (min-width: 1024px) { /* lg */ }
@media (min-width: 1280px) { /* xl */ }
@media (min-width: 1536px) { /* 2xl */ }

/* Mobile Adjustments */
@media (max-width: 768px) {
    .hero-title {
        font-size: var(--text-4xl);
    }
    
    .section {
        padding: var(--space-12) var(--space-4);
    }
    
    .grid-3, .grid-2 {
        grid-template-columns: 1fr;
        gap: var(--space-8);
    }
}
```

---

## ✨ **Animations & Transitions**

```css
/* Standard transitions */
.transition-default {
    transition: all 0.3s ease;
}

.transition-fast {
    transition: all 0.2s ease;
}

.transition-slow {
    transition: all 0.5s ease;
}

/* Hover animations */
.hover-lift {
    transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.hover-lift:hover {
    transform: translateY(-5px);
}

/* Fade in animation */
.fade-in {
    opacity: 0;
    transform: translateY(30px);
    transition: all 0.6s ease;
}

.fade-in.visible {
    opacity: 1;
    transform: translateY(0);
}
```

---

## 📋 **Usage Guidelines**

### **Do's**
- ✅ Use Poppins for all UI text
- ✅ Use JetBrains Mono for financial data (percentages, currency, metrics)
- ✅ Maintain consistent spacing using the defined scale
- ✅ Use blue tones for all CTAs and positive actions
- ✅ Use proper font weights for hierarchy (400-700 range)
- ✅ Test on mobile devices
- ✅ Use navy for primary branding elements

### **Don'ts**
- ❌ Don't use more than 2 font families
- ❌ Don't use colors outside the navy/blue/white palette
- ❌ Don't use font-weight 800+ except for hero titles
- ❌ Don't forget hover states on interactive elements
- ❌ Don't use bright colors that compete with the professional blue theme
- ❌ Don't use green or red unless absolutely necessary for specific contexts

---

## 🔗 **Quick CSS Import**

```css
/* Add this to the top of your CSS files */
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

:root {
  /* Navy & Blue Color Palette */
  --primary-navy: #0F172A;
  --primary-blue: #1E40AF;
  --primary-blue-light: #3B82F6;
  --primary-blue-hover: #1D4ED8;
  --secondary-blue: #2563EB;
  --secondary-blue-light: #60A5FA;
  --secondary-gray: #64748B;
  
  /* Backgrounds */
  --bg-primary: #FFFFFF;
  --bg-secondary: #F8FAFC;
  --bg-blue-light: #EFF6FF;
  --bg-blue-subtle: #DBEAFE;
  
  /* Text */
  --text-primary: #0F172A;
  --text-secondary: #64748B;
  --text-blue: #1E40AF;
  --text-white: #FFFFFF;
  
  /* Typography */
  --font-primary: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  
  /* Spacing */
  --space-4: 1rem;
  --space-8: 2rem;
  --space-12: 3rem;
  --radius-md: 12px;
  --radius-lg: 16px;
}

body {
  font-family: var(--font-primary);
  color: var(--text-primary);
  line-height: 1.6;
}
```

This style guide ensures consistency across all pages of your ETF Advisor platform! 🎯