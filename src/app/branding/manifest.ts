interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose: string;
}

interface AppManifest {
  name: string;
  short_name: string;
  description: string;
  theme_color: string;
  background_color: string;
  display: string;
  scope: string;
  start_url: string;
  icons: ManifestIcon[];
}

const DEFAULT_ICONS: ManifestIcon[] = [
  { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
  { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
];

let currentManifestUrl: string | null = null;

export function applyManifest(logo: string | null): void {
  const manifest: AppManifest = {
    name: 'Employee Management',
    short_name: 'EM',
    description: 'Local-first employee attendance and management app.',
    theme_color: '#3730a3',
    background_color: '#f8fafc',
    display: 'standalone',
    scope: './',
    start_url: './',
    icons: logo
      ? [
          { src: logo, sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: logo, sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ]
      : DEFAULT_ICONS,
  };

  const blob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' });
  const url = URL.createObjectURL(blob);

  let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'manifest';
    document.head.appendChild(link);
  }
  link.href = url;

  if (currentManifestUrl) URL.revokeObjectURL(currentManifestUrl);
  currentManifestUrl = url;

  applyFavicon(logo);
}

function applyFavicon(logo: string | null): void {
  const href = logo ?? 'favicon.ico';
  const type = logo ? 'image/png' : 'image/x-icon';

  let icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!icon) {
    icon = document.createElement('link');
    icon.rel = 'icon';
    document.head.appendChild(icon);
  }
  icon.type = type;
  icon.href = href;

  let apple = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
  if (!apple) {
    apple = document.createElement('link');
    apple.rel = 'apple-touch-icon';
    document.head.appendChild(apple);
  }
  apple.href = logo ?? 'icons/icon-192.png';
}
