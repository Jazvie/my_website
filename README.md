# Technical Blog

A minimalist technical blog built with Astro, designed for clear writing and interactive demonstrations.

## Features

- 📝 Clean, readable article layout inspired by Substack
- 🧮 Math rendering with KaTeX
- 💻 Syntax highlighting for code blocks
- ⚛️ Support for interactive React components
- 📱 Fully responsive design
- 🚀 Optimized for GitHub Pages deployment

## Getting Started

### Prerequisites

- Node.js 18+ installed
- A GitHub account

### Installation

1. Clone this repository:
\`\`\`bash
git clone https://github.com/yourusername/your-repo-name.git
cd your-repo-name
\`\`\`

2. Install dependencies:
\`\`\`bash
npm install
\`\`\`

3. Update `astro.config.mjs` with your GitHub Pages settings:
\`\`\`js
export default defineConfig({
  site: 'https://yourusername.github.io',
  base: '/your-repo-name',
  // ...
});
\`\`\`

### Local Development

Run the development server:
\`\`\`bash
npm run dev
\`\`\`

Visit `http://localhost:4321` to see your site.

### Building

Build the site for production:
\`\`\`bash
npm run build
\`\`\`

Preview the production build:
\`\`\`bash
npm run preview
\`\`\`

## Adding New Articles

1. Create a new `.md` file in `src/content/blog/`
2. Add frontmatter with required fields:
\`\`\`md
---
title: "Your Article Title"
subtitle: "Brief description"
date: 2025-01-15
thumbnail: "/images/your-image.jpg"
tags: ["tag1", "tag2"]
---

Your content here...
\`\`\`

3. The article will automatically appear on the homepage

## Deployment to GitHub Pages

### First-Time Setup

1. Go to your GitHub repository settings
2. Navigate to Pages → Source
3. Select "GitHub Actions" as the source

### Automatic Deployment

Every push to the `main` branch automatically triggers deployment via GitHub Actions. The workflow:

1. Builds your Astro site
2. Uploads the build artifacts
3. Deploys to GitHub Pages

Your site will be available at `https://yourusername.github.io/your-repo-name/`

## Project Structure

\`\`\`
/
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Actions deployment
├── public/
│   └── images/                 # Static images
├── src/
│   ├── components/
│   │   └── ArticleCard.astro   # Article preview card
│   ├── content/
│   │   ├── config.ts           # Content collection schema
│   │   └── blog/               # Blog posts (.md files)
│   ├── layouts/
│   │   ├── BaseLayout.astro    # Base HTML layout
│   │   └── BlogPost.astro      # Blog post layout
│   ├── pages/
│   │   ├── index.astro         # Homepage
│   │   └── blog/
│   │       └── [...slug].astro # Dynamic blog routes
│   └── styles/
│       └── global.css          # Global styles
├── astro.config.mjs            # Astro configuration
├── package.json
└── tsconfig.json
\`\`\`

## Adding Interactive Components

To add interactive demos:

1. Create a React component in `src/components/`:
\`\`\`jsx
// src/components/InteractiveDemo.jsx
export default function InteractiveDemo() {
  return <div>Your interactive content</div>;
}
\`\`\`

2. Import and use in your markdown:
\`\`\`md
import InteractiveDemo from '../../components/InteractiveDemo.jsx'

<InteractiveDemo client:load />
\`\`\`

## Customization

### Styling

- Edit `src/styles/global.css` for global styles
- Component-specific styles are in `<style>` blocks within `.astro` files

### Site Information

- Update site title in `src/layouts/BaseLayout.astro`
- Modify hero section in `src/pages/index.astro`

## License

MIT License - feel free to use this template for your own blog.
