'use client';

import { log } from '@/lib/logger';

export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) {
    log.info('This browser does not support desktop notification');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
};

export const showNotification = (title: string, options?: NotificationOptions) => {
  if (Notification.permission === 'granted') {
    new Notification(title, {
      icon: '/favicon.ico', // Update with your logo path
      ...options,
    });
  }
};
