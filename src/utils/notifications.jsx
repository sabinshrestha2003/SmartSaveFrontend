import notifee, { AndroidImportance } from '@notifee/react-native';
import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const getNotificationsKey = (userId) => userId ? `@SmartSave:notifications_${userId}` : '@SmartSave:notifications';

export async function requestNotificationPermission() {
  try {
    if (Platform.OS === 'ios') {
      await notifee.requestPermission();
    } else {
      const settings = await notifee.requestPermission();
      if (!settings.granted) {
        Alert.alert('Permission Denied', 'Please enable notifications in settings.');
        return false;
      }
    }
    await notifee.createChannel({
      id: 'default',
      name: 'Default Channel',
      importance: AndroidImportance.HIGH,
    });
    return true;
  } catch (error) {
    console.error('Permission request error:', error);
    return false;
  }
}

export async function displayNotification(title, body, data = {}, userId = null) {
  try {
    const notification = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      title,
      body,
      data,
      timestamp: new Date().toISOString(),
      read: false,
    };

    await notifee.displayNotification({
      id: notification.id,
      title,
      body,
      data,
      android: {
        channelId: 'default',
        pressAction: { id: 'default' },
      },
      ios: {
        foregroundPresentationOptions: {
          alert: true,
          badge: true,
          sound: true,
        },
      },
    });

    const notificationsKey = getNotificationsKey(userId);
    const storedNotifications = await AsyncStorage.getItem(notificationsKey);
    const notifications = storedNotifications ? JSON.parse(storedNotifications) : [];
    notifications.unshift(notification);
    await AsyncStorage.setItem(notificationsKey, JSON.stringify(notifications));

    console.log('Notification displayed and stored:', title, 'for user:', userId || 'no user');
    return notification.id;
  } catch (error) {
    console.error('Display notification error:', error);
    return null;
  }
}

export async function getNotifications(userId = null) {
  try {
    const notificationsKey = getNotificationsKey(userId);
    const storedNotifications = await AsyncStorage.getItem(notificationsKey);
    return storedNotifications ? JSON.parse(storedNotifications) : [];
  } catch (error) {
    console.error('Get notifications error:', error);
    return [];
  }
}

export async function markNotificationAsRead(notificationId, userId = null) {
  try {
    const notificationsKey = getNotificationsKey(userId);
    const notifications = await getNotifications(userId);
    const updatedNotifications = notifications.map(n =>
      n.id === notificationId ? { ...n, read: true } : n
    );
    await AsyncStorage.setItem(notificationsKey, JSON.stringify(updatedNotifications));
    console.log(`Notification ${notificationId} marked as read for user:`, userId || 'no user');
  } catch (error) {
    console.error('Mark notification read error:', error);
  }
}

export async function clearNotifications(userId = null) {
  try {
    const notificationsKey = getNotificationsKey(userId);
    await AsyncStorage.setItem(notificationsKey, JSON.stringify([]));
    await notifee.cancelAllNotifications();
    console.log('All notifications cleared for user:', userId || 'no user');
  } catch (error) {
    console.error('Clear notifications error:', error);
  }
}