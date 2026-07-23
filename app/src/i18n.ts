export type Language = 'en' | 'bn';

export const translations = {
  en: {
    newTab: 'New Tab',
    newPrivateTab: 'New Private Tab',
    error: 'Error',
    blockedAds: 'Blocked {count} ads/trackers',
    history: 'History',
    downloads: 'Downloads',
    bookmarks: 'Bookmarks',
    zoom: 'Zoom',
    print: 'Print...',
    settings: 'Settings',
    devTools: 'Developer tools',
    about: 'About Probaho',
    exit: 'Exit',
    clear: 'Clear',
    noHistory: 'No history yet',
    noDownloads: 'No recent downloads',
    completed: 'Completed',
    openFile: 'Open file',
    showInFolder: 'Show in folder',
    homepageUrl: 'Homepage URL',
    defaultSearchEngine: 'Default Search Engine',
    enableAdBlocker: 'Enable Ad & Tracker Blocking',
    theme: 'Theme',
    dark: 'Dark',
    light: 'Light',
    language: 'Language',
    english: 'English',
    bengali: 'বাংলা',
    aboutTitle: 'About Probaho Browser',
    version: 'Version',
    license: 'License',
    creator: 'Creator',
    description: 'Probaho Browser is a lightweight, fast, and privacy-focused web browser built with modern web technologies.',
    rights: 'All rights reserved.',
    noBookmarks: 'No bookmarks yet',
    findInPage: 'Find in page...',
    searchPlaceholder: 'Search with {engine} or enter address',
    awSnap: 'Aw, Snap!',
    crashedDesc: 'This tab crashed or stopped responding.',
    reloadTab: 'Reload Tab'
  },
  bn: {
    newTab: 'নতুন ট্যাব',
    newPrivateTab: 'নতুন ব্যক্তিগত ট্যাব',
    error: 'ত্রুটি',
    blockedAds: '{count} টি বিজ্ঞাপন/ট্র্যাকার ব্লক করা হয়েছে',
    history: 'হিস্ট্রি',
    downloads: 'ডাউনলোডসমূহ',
    bookmarks: 'বুকমার্কসমূহ',
    zoom: 'জুম',
    print: 'প্রিন্ট করুন...',
    settings: 'সেটিংস',
    devTools: 'ডেভেলপার টুলস',
    about: 'প্রবাহ সম্পর্কে',
    exit: 'প্রস্থান',
    clear: 'মুছুন',
    noHistory: 'কোনো হিস্ট্রি নেই',
    noDownloads: 'সাম্প্রতিক কোনো ডাউনলোড নেই',
    completed: 'সম্পন্ন',
    openFile: 'ফাইল খুলুন',
    showInFolder: 'ফোল্ডারে দেখান',
    homepageUrl: 'হোমপেজ ইউআরএল',
    defaultSearchEngine: 'ডিফল্ট সার্চ ইঞ্জিন',
    enableAdBlocker: 'অ্যাড এবং ট্র্যাকার ব্লকিং চালু করুন',
    theme: 'থিম',
    dark: 'ডার্ক',
    light: 'লাইট',
    language: 'ভাষা',
    english: 'English',
    bengali: 'বাংলা',
    aboutTitle: 'প্রবাহ ব্রাউজার সম্পর্কে',
    version: 'সংস্করণ',
    license: 'লাইসেন্স',
    creator: 'নির্মাতা',
    description: 'প্রবাহ ব্রাউজার আধুনিক ওয়েব প্রযুক্তি দ্বারা নির্মিত একটি হালকা, দ্রুত এবং গোপনীয়তা-কেন্দ্রিক ওয়েব ব্রাউজার।',
    rights: 'সর্বস্বত্ব সংরক্ষিত।',
    noBookmarks: 'কোনো বুকমার্ক নেই',
    findInPage: 'পেজে খুঁজুন...',
    searchPlaceholder: '{engine} দিয়ে খুঁজুন অথবা ঠিকানা লিখুন',
    awSnap: 'ওহ না!',
    crashedDesc: 'এই ট্যাবটি ক্র্যাশ করেছে অথবা কাজ করা বন্ধ করে দিয়েছে।',
    reloadTab: 'ট্যাব রিলোড করুন'
  }
};

export function t(key: keyof typeof translations['en'], lang: Language, params?: Record<string, string | number>) {
  const currentLang = lang && translations[lang] ? lang : 'en';
  let str = translations[currentLang][key] || translations['en'][key] || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replace(`{${k}}`, String(v));
    }
  }
  return str;
}
