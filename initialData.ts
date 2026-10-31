import { Idol, GirlGroup } from '../types';

// Helper to generate a nice clean SVG avatar Data URL with idol initials and group color theme
export function generateAvatarUrl(name: string, group: string): string {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
    
  // Deterministic color based on group name
  let hash = 0;
  for (let i = 0; i < group.length; i++) {
    hash = group.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  const bg1 = `hsl(${hue}, 70%, 25%)`;
  const bg2 = `hsl(${(hue + 40) % 360}, 80%, 15%)`;
  const accent = `hsl(${hue}, 90%, 65%)`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
    <defs>
      <linearGradient id="g_${hash}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${bg1}" />
        <stop offset="100%" stop-color="${bg2}" />
      </linearGradient>
    </defs>
    <rect width="120" height="120" rx="24" fill="url(#g_${hash})" />
    <circle cx="60" cy="50" r="28" fill="${accent}" opacity="0.25" />
    <text x="60" y="58" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="700" font-size="32" fill="#FFFFFF" text-anchor="middle" dominant-baseline="middle">${initials}</text>
    <rect x="20" y="92" width="80" height="18" rx="9" fill="${accent}" opacity="0.3" />
    <text x="60" y="102" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="600" font-size="10" fill="#E2E8F0" text-anchor="middle" dominant-baseline="middle">${group.toUpperCase()}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// Initial default girl groups data
export const INITIAL_GIRL_GROUPS: GirlGroup[] = [
  { id: 'group-ive', name: 'IVE', members: ['An Yujin', 'Gaeul', 'Rei', 'Jang Wonyoung', 'Liz', 'Leeseo'] },
  { id: 'group-aespa', name: 'aespa', members: ['Karina', 'Giselle', 'Winter', 'Ningning'] },
  { id: 'group-twice', name: 'TWICE', members: ['Nayeon', 'Jeongyeon', 'Momo', 'Sana', 'Jihyo', 'Mina', 'Dahyun', 'Chaeyoung', 'Tzuyu'] },
  { id: 'group-blackpink', name: 'BLACKPINK', members: ['Jisoo', 'Jennie', 'Rosé', 'Lisa'] },
  { id: 'group-lesserafim', name: 'LE SSERAFIM', members: ['Kim Chaewon', 'Sakura', 'Huh Yunjin', 'Kazuha', 'Hong Eunchae'] },
  { id: 'group-newjeans', name: 'NewJeans', members: ['Minji', 'Hanni', 'Danielle', 'Haerin', 'Hyein'] },
  { id: 'group-redvelvet', name: 'Red Velvet', members: ['Irene', 'Seulgi', 'Wendy', 'Joy', 'Yeri'] },
  { id: 'group-itzy', name: 'ITZY', members: ['Yeji', 'Lia', 'Ryujin', 'Chaeryeong', 'Yuna'] },
  { id: 'group-nmixx', name: 'NMIXX', members: ['Lily', 'Haewon', 'Sullyoon', 'Bae', 'Jiwoo', 'Kyujin'] },
  { id: 'group-babymonster', name: 'BABYMONSTER', members: ['Ruka', 'Pharita', 'Asa', 'Ahyeon', 'Rami', 'Rora', 'Chiquita'] },
  { id: 'group-illit', name: 'ILLIT', members: ['Yunah', 'Minju', 'Moka', 'Wonhee', 'Iroha'] },
  { id: 'group-kissoflife', name: 'KISS OF LIFE', members: ['Julie', 'Natty', 'Belle', 'Haneul'] },
  { id: 'group-gidle', name: '(G)I-DLE', members: ['Soyeon', 'Miyeon', 'Minnie', 'Yuqi', 'Shuhua'] },
  { id: 'group-stayc', name: 'STAYC', members: ['Isa', 'Sieun', 'Sumin', 'Yoon', 'J', 'Seeun'] },
  { id: 'group-fromis9', name: 'fromis_9', members: ['Nagyung', 'Jiwon', 'Hayoung', 'Chaeyoung', 'Jisun', 'Saerom', 'Seoyeon'] },
  { id: 'group-mamamoo', name: 'MAMAMOO', members: ['Solar', 'Moonbyul', 'Wheein', 'Hwasa'] },
  { id: 'group-kep1er', name: 'Kep1er', members: ['Chaehyun', 'Huening Bahiyyih', 'Yujin', 'Dayeon', 'Hikaru', 'Youngeun', 'Yeseo', 'Mashiro', 'Xiaoting'] },
  { id: 'group-triples', name: 'tripleS', members: ['Yooyeon', 'Nakyoung', 'Seoyeon', 'Kotone', 'Yeonji', 'Nien', 'Soomin', 'Chaeyeon', 'Jiwoo', 'Kaede', 'Dahyun', 'Xinyu'] },
  { id: 'group-unis', name: 'UNIS', members: ['Elisia', 'Gehlee Dangca', 'Kotoko', 'Nana', 'Bang Yunha', 'Lim Seowon', 'Oh Yoona', 'Hyeonju'] },
  { id: 'group-fiftyfifty', name: 'FIFTY FIFTY', members: ['Keena', 'Chanelle', 'Yewon', 'Hana', 'Athena'] },
  { id: 'group-solo', name: 'Soloist', members: ['Chuu', 'IU', 'Taeyeon', 'Sunmi', 'Chungha', 'Somi'] },
];

// Initial 120 Idols (20 Idols per League across all 6 Parallel Divisions)
export const INITIAL_IDOLS: Idol[] = [
  // Seed 1 (Top Tier Idols)
  { id: 'idol-1', name: 'Jang Wonyoung', girlGroup: 'IVE', seed: 'Seed 1', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-2', name: 'Karina', girlGroup: 'aespa', seed: 'Seed 1', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-3', name: 'Winter', girlGroup: 'aespa', seed: 'Seed 1', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-4', name: 'An Yujin', girlGroup: 'IVE', seed: 'Seed 1', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-5', name: 'Jennie', girlGroup: 'BLACKPINK', seed: 'Seed 1', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-6', name: 'Lisa', girlGroup: 'BLACKPINK', seed: 'Seed 1', nationality: 'Thailand', createdAt: Date.now() },
  { id: 'idol-7', name: 'Sana', girlGroup: 'TWICE', seed: 'Seed 1', nationality: 'Japan', createdAt: Date.now() },
  { id: 'idol-8', name: 'Nayeon', girlGroup: 'TWICE', seed: 'Seed 1', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-9', name: 'Minji', girlGroup: 'NewJeans', seed: 'Seed 1', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-10', name: 'Hanni', girlGroup: 'NewJeans', seed: 'Seed 1', nationality: 'Australia', createdAt: Date.now() },
  { id: 'idol-11', name: 'Kim Chaewon', girlGroup: 'LE SSERAFIM', seed: 'Seed 1', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-12', name: 'Huh Yunjin', girlGroup: 'LE SSERAFIM', seed: 'Seed 1', nationality: 'USA', createdAt: Date.now() },
  { id: 'idol-13', name: 'Irene', girlGroup: 'Red Velvet', seed: 'Seed 1', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-14', name: 'Ryujin', girlGroup: 'ITZY', seed: 'Seed 1', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-15', name: 'Sullyoon', girlGroup: 'NMIXX', seed: 'Seed 1', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-16', name: 'Ahyeon', girlGroup: 'BABYMONSTER', seed: 'Seed 1', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-65', name: 'Soyeon', girlGroup: '(G)I-DLE', seed: 'Seed 1', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-66', name: 'Miyeon', girlGroup: '(G)I-DLE', seed: 'Seed 1', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-67', name: 'Yuqi', girlGroup: '(G)I-DLE', seed: 'Seed 1', nationality: 'China', createdAt: Date.now() },
  { id: 'idol-68', name: 'Isa', girlGroup: 'STAYC', seed: 'Seed 1', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-69', name: 'Sieun', girlGroup: 'STAYC', seed: 'Seed 1', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-70', name: 'Chaehyun', girlGroup: 'Kep1er', seed: 'Seed 1', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-71', name: 'Xiaoting', girlGroup: 'Kep1er', seed: 'Seed 1', nationality: 'China', createdAt: Date.now() },
  { id: 'idol-72', name: 'Yooyeon', girlGroup: 'tripleS', seed: 'Seed 1', nationality: 'South Korea', createdAt: Date.now() },

  // Seed 2
  { id: 'idol-17', name: 'Sakura', girlGroup: 'LE SSERAFIM', seed: 'Seed 2', nationality: 'Japan', createdAt: Date.now() },
  { id: 'idol-18', name: 'Kazuha', girlGroup: 'LE SSERAFIM', seed: 'Seed 2', nationality: 'Japan', createdAt: Date.now() },
  { id: 'idol-19', name: 'Haerin', girlGroup: 'NewJeans', seed: 'Seed 2', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-20', name: 'Danielle', girlGroup: 'NewJeans', seed: 'Seed 2', nationality: 'Australia', createdAt: Date.now() },
  { id: 'idol-21', name: 'Ningning', girlGroup: 'aespa', seed: 'Seed 2', nationality: 'China', createdAt: Date.now() },
  { id: 'idol-22', name: 'Giselle', girlGroup: 'aespa', seed: 'Seed 2', nationality: 'Japan', createdAt: Date.now() },
  { id: 'idol-23', name: 'Rei', girlGroup: 'IVE', seed: 'Seed 2', nationality: 'Japan', createdAt: Date.now() },
  { id: 'idol-24', name: 'Liz', girlGroup: 'IVE', seed: 'Seed 2', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-25', name: 'Momo', girlGroup: 'TWICE', seed: 'Seed 2', nationality: 'Japan', createdAt: Date.now() },
  { id: 'idol-26', name: 'Jihyo', girlGroup: 'TWICE', seed: 'Seed 2', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-27', name: 'Mina', girlGroup: 'TWICE', seed: 'Seed 2', nationality: 'Japan', createdAt: Date.now() },
  { id: 'idol-28', name: 'Tzuyu', girlGroup: 'TWICE', seed: 'Seed 2', nationality: 'Taiwan', createdAt: Date.now() },
  { id: 'idol-29', name: 'Jisoo', girlGroup: 'BLACKPINK', seed: 'Seed 2', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-30', name: 'Rosé', girlGroup: 'BLACKPINK', seed: 'Seed 2', nationality: 'New Zealand', createdAt: Date.now() },
  { id: 'idol-31', name: 'Seulgi', girlGroup: 'Red Velvet', seed: 'Seed 2', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-32', name: 'Yeji', girlGroup: 'ITZY', seed: 'Seed 2', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-73', name: 'Minnie', girlGroup: '(G)I-DLE', seed: 'Seed 2', nationality: 'Thailand', createdAt: Date.now() },
  { id: 'idol-74', name: 'Shuhua', girlGroup: '(G)I-DLE', seed: 'Seed 2', nationality: 'Taiwan', createdAt: Date.now() },
  { id: 'idol-75', name: 'Yoon', girlGroup: 'STAYC', seed: 'Seed 2', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-76', name: 'Sumin', girlGroup: 'STAYC', seed: 'Seed 2', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-77', name: 'J', girlGroup: 'STAYC', seed: 'Seed 2', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-78', name: 'Seeun', girlGroup: 'STAYC', seed: 'Seed 2', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-79', name: 'Nagyung', girlGroup: 'fromis_9', seed: 'Seed 2', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-80', name: 'Jiwon', girlGroup: 'fromis_9', seed: 'Seed 2', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-81', name: 'Hayoung', girlGroup: 'fromis_9', seed: 'Seed 2', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-82', name: 'Chaeyoung', girlGroup: 'fromis_9', seed: 'Seed 2', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-83', name: 'Hwasa', girlGroup: 'MAMAMOO', seed: 'Seed 2', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-84', name: 'Solar', girlGroup: 'MAMAMOO', seed: 'Seed 2', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-85', name: 'Moonbyul', girlGroup: 'MAMAMOO', seed: 'Seed 2', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-86', name: 'Wheein', girlGroup: 'MAMAMOO', seed: 'Seed 2', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-87', name: 'Hikaru', girlGroup: 'Kep1er', seed: 'Seed 2', nationality: 'Japan', createdAt: Date.now() },
  { id: 'idol-88', name: 'Mashiro', girlGroup: 'Kep1er', seed: 'Seed 2', nationality: 'Japan', createdAt: Date.now() },

  // Seed 3
  { id: 'idol-33', name: 'Gaeul', girlGroup: 'IVE', seed: 'Seed 3', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-34', name: 'Leeseo', girlGroup: 'IVE', seed: 'Seed 3', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-35', name: 'Hong Eunchae', girlGroup: 'LE SSERAFIM', seed: 'Seed 3', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-36', name: 'Hyein', girlGroup: 'NewJeans', seed: 'Seed 3', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-37', name: 'Dahyun', girlGroup: 'TWICE', seed: 'Seed 3', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-38', name: 'Chaeyoung', girlGroup: 'TWICE', seed: 'Seed 3', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-39', name: 'Jeongyeon', girlGroup: 'TWICE', seed: 'Seed 3', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-40', name: 'Joy', girlGroup: 'Red Velvet', seed: 'Seed 3', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-41', name: 'Wendy', girlGroup: 'Red Velvet', seed: 'Seed 3', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-42', name: 'Yeri', girlGroup: 'Red Velvet', seed: 'Seed 3', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-43', name: 'Chaeryeong', girlGroup: 'ITZY', seed: 'Seed 3', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-44', name: 'Yuna', girlGroup: 'ITZY', seed: 'Seed 3', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-45', name: 'Lia', girlGroup: 'ITZY', seed: 'Seed 3', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-46', name: 'Haewon', girlGroup: 'NMIXX', seed: 'Seed 3', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-47', name: 'Lily', girlGroup: 'NMIXX', seed: 'Seed 3', nationality: 'Australia', createdAt: Date.now() },
  { id: 'idol-48', name: 'Wonhee', girlGroup: 'ILLIT', seed: 'Seed 3', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-89', name: 'Huening Bahiyyih', girlGroup: 'Kep1er', seed: 'Seed 3', nationality: 'USA', createdAt: Date.now() },
  { id: 'idol-90', name: 'Dayeon', girlGroup: 'Kep1er', seed: 'Seed 3', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-91', name: 'Youngeun', girlGroup: 'Kep1er', seed: 'Seed 3', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-92', name: 'Yeseo', girlGroup: 'Kep1er', seed: 'Seed 3', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-93', name: 'Yujin', girlGroup: 'Kep1er', seed: 'Seed 3', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-94', name: 'Nakyoung', girlGroup: 'tripleS', seed: 'Seed 3', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-95', name: 'Kotone', girlGroup: 'tripleS', seed: 'Seed 3', nationality: 'Japan', createdAt: Date.now() },
  { id: 'idol-96', name: 'Seoyeon', girlGroup: 'tripleS', seed: 'Seed 3', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-97', name: 'Nien', girlGroup: 'tripleS', seed: 'Seed 3', nationality: 'Taiwan', createdAt: Date.now() },
  { id: 'idol-98', name: 'Dahyun', girlGroup: 'tripleS', seed: 'Seed 3', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-99', name: 'Kaede', girlGroup: 'tripleS', seed: 'Seed 3', nationality: 'Japan', createdAt: Date.now() },
  { id: 'idol-100', name: 'Jiwoo', girlGroup: 'tripleS', seed: 'Seed 3', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-101', name: 'Chaeyeon', girlGroup: 'tripleS', seed: 'Seed 3', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-102', name: 'Yeonji', girlGroup: 'tripleS', seed: 'Seed 3', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-103', name: 'Soomin', girlGroup: 'tripleS', seed: 'Seed 3', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-104', name: 'Xinyu', girlGroup: 'tripleS', seed: 'Seed 3', nationality: 'China', createdAt: Date.now() },

  // Seed 4
  { id: 'idol-49', name: 'Kyujin', girlGroup: 'NMIXX', seed: 'Seed 4', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-50', name: 'Bae', girlGroup: 'NMIXX', seed: 'Seed 4', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-51', name: 'Jiwoo', girlGroup: 'NMIXX', seed: 'Seed 4', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-52', name: 'Chiquita', girlGroup: 'BABYMONSTER', seed: 'Seed 4', nationality: 'Thailand', createdAt: Date.now() },
  { id: 'idol-53', name: 'Ruka', girlGroup: 'BABYMONSTER', seed: 'Seed 4', nationality: 'Japan', createdAt: Date.now() },
  { id: 'idol-54', name: 'Asa', girlGroup: 'BABYMONSTER', seed: 'Seed 4', nationality: 'Japan', createdAt: Date.now() },
  { id: 'idol-55', name: 'Pharita', girlGroup: 'BABYMONSTER', seed: 'Seed 4', nationality: 'Thailand', createdAt: Date.now() },
  { id: 'idol-56', name: 'Rami', girlGroup: 'BABYMONSTER', seed: 'Seed 4', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-57', name: 'Rora', girlGroup: 'BABYMONSTER', seed: 'Seed 4', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-58', name: 'Minju', girlGroup: 'ILLIT', seed: 'Seed 4', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-59', name: 'Moka', girlGroup: 'ILLIT', seed: 'Seed 4', nationality: 'Japan', createdAt: Date.now() },
  { id: 'idol-60', name: 'Iroha', girlGroup: 'ILLIT', seed: 'Seed 4', nationality: 'Japan', createdAt: Date.now() },
  { id: 'idol-61', name: 'Natty', girlGroup: 'KISS OF LIFE', seed: 'Seed 4', nationality: 'Thailand', createdAt: Date.now() },
  { id: 'idol-62', name: 'Julie', girlGroup: 'KISS OF LIFE', seed: 'Seed 4', nationality: 'USA', createdAt: Date.now() },
  { id: 'idol-63', name: 'Belle', girlGroup: 'KISS OF LIFE', seed: 'Seed 4', nationality: 'USA', createdAt: Date.now() },
  { id: 'idol-64', name: 'Haneul', girlGroup: 'KISS OF LIFE', seed: 'Seed 4', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-105', name: 'Elisia', girlGroup: 'UNIS', seed: 'Seed 4', nationality: 'Philippines', createdAt: Date.now() },
  { id: 'idol-106', name: 'Gehlee Dangca', girlGroup: 'UNIS', seed: 'Seed 4', nationality: 'Philippines', createdAt: Date.now() },
  { id: 'idol-107', name: 'Kotoko', girlGroup: 'UNIS', seed: 'Seed 4', nationality: 'Japan', createdAt: Date.now() },
  { id: 'idol-108', name: 'Nana', girlGroup: 'UNIS', seed: 'Seed 4', nationality: 'Japan', createdAt: Date.now() },
  { id: 'idol-109', name: 'Bang Yunha', girlGroup: 'UNIS', seed: 'Seed 4', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-110', name: 'Lim Seowon', girlGroup: 'UNIS', seed: 'Seed 4', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-111', name: 'Oh Yoona', girlGroup: 'UNIS', seed: 'Seed 4', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-112', name: 'Hyeonju', girlGroup: 'UNIS', seed: 'Seed 4', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-113', name: 'Keena', girlGroup: 'FIFTY FIFTY', seed: 'Seed 4', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-114', name: 'Chanelle', girlGroup: 'FIFTY FIFTY', seed: 'Seed 4', nationality: 'USA', createdAt: Date.now() },
  { id: 'idol-115', name: 'Yewon', girlGroup: 'FIFTY FIFTY', seed: 'Seed 4', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-116', name: 'Hana', girlGroup: 'FIFTY FIFTY', seed: 'Seed 4', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-117', name: 'Athena', girlGroup: 'FIFTY FIFTY', seed: 'Seed 4', nationality: 'Sweden', createdAt: Date.now() },
  { id: 'idol-118', name: 'Chuu', girlGroup: 'Soloist', seed: 'Seed 4', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-119', name: 'IU', girlGroup: 'Soloist', seed: 'Seed 4', nationality: 'South Korea', createdAt: Date.now() },
  { id: 'idol-120', name: 'Taeyeon', girlGroup: 'Soloist', seed: 'Seed 4', nationality: 'South Korea', createdAt: Date.now() },
].map((i) => ({
  ...i,
  photoUrl: generateAvatarUrl(i.name, i.girlGroup),
}));
