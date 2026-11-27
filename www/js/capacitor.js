// Capacitor native integration (M6).
// Импортируется из index.html при наличии Capacitor.
import { App } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { Share } from '@capacitor/share';
import { Haptics } from '@capacitor/haptics';
import { LocalNotifications } from '@capacitor/local-notifications';

let initialized = false;

export function isNative() {
  return !!(window.Capacitor && window.Capacitor.isNativePlatform());
}

export async function initCapacitor() {
  if (initialized) return;
  initialized = true;
  if (!isNative()) return;

  // Splash: скрыть после загрузки
  await SplashScreen.hide();

  // Back button → minimze
  App.addListener('backButton', ({ canGoBack }) => {
    if (!canGoBack) App.minimizeApp();
  });

  // Запросить разрешение на уведомления
  try {
    const perm = await LocalNotifications.requestPermissions();
    if (perm.display === 'granted') {
      console.log('[capacitor] notifications granted');
    }
  } catch (e) {
    console.warn('[capacitor] notification permission:', e);
  }
}

// Поделиться заметкой
export async function shareNote(text) {
  if (!isNative()) return false;
  try {
    await Share.share({ text, title: 'Живой блокнот' });
    return true;
  } catch (e) {
    if (e.message !== 'canceled') console.warn('[capacitor] share error:', e);
    return false;
  }
}

// Тактильный отклик
export function hapticLight() {
  if (!isNative()) return;
  try { Haptics.impact({ style: 'Light' }); } catch (e) { /* ignore */ }
}

export function hapticSuccess() {
  if (!isNative()) return;
  try { Haptics.notification({ type: 'Success' }); } catch (e) { /* ignore */ }
}

// Планирование уведомлений о просроченных заметках
export async function scheduleOverdueCheck(notes) {
  if (!isNative()) return;
  const now = Date.now();
  const overdue = notes.filter(n => !n.deletedAt && n.completedAt == null && n.dueAt && n.dueAt <= now);
  if (overdue.length === 0) return;
  try {
    await LocalNotifications.schedule({
      notifications: overdue.slice(0, 5).map(n => ({
        title: 'Просрочено',
        body: n.text.slice(0, 100),
        id: n.id.slice(-8).split('').reduce((a,c)=>a+c.charCodeAt(0), 0) % 100000,
        schedule: { at: new Date(now + 1000) },
        smallIcon: 'ic_stat_icon_configurable',
        actionTypeId: 'OPEN_NOTE'
      }))
    });
  } catch (e) {
    console.warn('[capacitor] scheduleOverdueCheck error:', e);
  }
}