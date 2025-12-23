# INUKA Pay Website

A modern, responsive website showcasing the INUKA Pay WhatsApp-based blockchain Chama platform.

## Features

- **Hero Section**: Eye-catching landing with animated gradient orbs
- **Features Grid**: 8 key features with icons and descriptions
- **How It Works**: Step-by-step process with visual flow
- **Tech Stack**: Technologies powering the platform
- **Get Started Section**: Clear CTA with WhatsApp integration
- **Footer**: Links, contract info, and social media

## Design Highlights

- Modern dark theme with green/blue gradient accents
- Smooth animations and transitions
- Fully responsive (mobile, tablet, desktop)
- Accessibility-focused
- Fast loading with optimized assets

## Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

The development server will start at `http://localhost:5173`

## Customization

### Update WhatsApp Number
Edit `src/components/GetStarted.tsx` line 52:
```tsx
href="https://wa.me/YOUR_WHATSAPP_NUMBER?text=menu"
```

### Update Contract Address
Edit `src/components/Footer.tsx` to update the displayed contract address.

### Brand Colors
Edit `src/index.css` CSS variables:
```css
--primary: #10b981;  /* Main green */
--secondary: #3b82f6; /* Blue accent */
--accent: #f59e0b;    /* Orange accent */
```

## Project Structure

```
src/
├── main.tsx              # Entry point
├── App.tsx               # Main app component
├── index.css             # Global styles
└── components/
    ├── Hero.tsx          # Landing hero section
    ├── Features.tsx      # Features grid
    ├── HowItWorks.tsx    # Process steps
    ├── TechStack.tsx     # Technology showcase
    ├── GetStarted.tsx    # CTA section
    └── Footer.tsx        # Site footer
```

## Deployment

The website is a static site that can be deployed to:
- Vercel
- Netlify
- GitHub Pages
- Any static hosting service

Build the site and deploy the `dist/` folder.

## Technologies Used

- **React 18**: UI library
- **TypeScript**: Type safety
- **Vite**: Build tool and dev server
- **CSS3**: Styling with animations
- No external UI libraries - pure CSS for fast loading
