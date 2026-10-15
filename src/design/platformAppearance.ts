// Shared appearance and navigation for Native and PWA.
export const appearance = {
  light: {
    background: '#F4F6F5',
    cardBg: '#FFFFFF',
    textMain: '#202A25',
    textSub: '#65716A',
    border: '#DFE5E1',
    primary: '#35634B',
    onPrimary: '#FFFFFF',
    primarySoft: '#E7EFEA',
    accent: '#755B42',
    accentSoft: '#F1ECE5',
    placeholder: '#77847C',
    danger: '#B43E3E',
  },
  dark: {
    background: '#1B1B1E',
    cardBg: '#28282D',
    textMain: '#F0F0F2',
    textSub: '#B7B7C0',
    border: '#45454E',
    primary: '#C4C4D0',
    onPrimary: '#24242A',
    primarySoft: '#36363F',
    accent: '#D0BFA8',
    accentSoft: '#3C3632',
    placeholder: '#A5A5B0',
    danger: '#E9A3A3',
  },
};
export const primaryNavigation = [
  { route: 'Home', webRoute: 'home', label: '首頁', icon: 'home-outline' },
  {
    route: 'ItemManagement',
    webRoute: 'items',
    label: '物品',
    icon: 'grid-outline',
  },
  {
    route: 'Market',
    webRoute: 'market',
    label: '二手市集',
    icon: 'storefront-outline',
  },
  {
    route: 'Settings',
    webRoute: 'settings',
    label: '設定',
    icon: 'settings-outline',
  },
] as const;
