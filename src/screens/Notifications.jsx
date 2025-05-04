import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Alert,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import colors from '../styles/colors';
import { getNotifications, markNotificationAsRead, clearNotifications } from '../utils/notifications';
import { useAuth } from '../context/AuthContext';

const Notifications = ({ navigation }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const fetchedNotifications = await getNotifications(user?.id);
      setNotifications(fetchedNotifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
    } catch (error) {
      console.error('Fetch notifications error:', error);
      Alert.alert('Error', 'Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchNotifications();
    const unsubscribe = navigation.addListener('focus', fetchNotifications);
    return unsubscribe;
  }, [navigation, fetchNotifications]);

  const handleMarkAsRead = async (notificationId) => {
    await markNotificationAsRead(notificationId, user?.id);
    setNotifications(prev =>
      prev.map(n => (n.id === notificationId ? { ...n, read: true } : n))
    );
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear All Notifications',
      'Are you sure you want to clear all notifications?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await clearNotifications(user?.id);
            setNotifications([]);
          },
        },
      ]
    );
  };

  const renderNotification = ({ item }) => (
    <TouchableOpacity
      style={[styles.notificationCard, item.read && styles.notificationRead]}
      onPress={() => {
        handleMarkAsRead(item.id);
        if (item.data.screen) {
          navigation.navigate(item.data.screen, item.data.params || {});
        }
      }}
      activeOpacity={0.8}
    >
      <View style={styles.notificationIcon}>
        <Ionicons
          name={item.read ? 'mail-open-outline' : 'mail-outline'}
          size={24}
          color={item.read ? colors.textSecondary : colors.primaryGreen}
        />
      </View>
      <View style={styles.notificationContent}>
        <Text style={styles.notificationTitle}>{item.title}</Text>
        <Text style={styles.notificationBody} numberOfLines={2}>
          {item.body}
        </Text>
        <Text style={styles.notificationTimestamp}>
          {new Date(item.timestamp).toLocaleString('en-IN', {
            dateStyle: 'short',
            timeStyle: 'short',
          })}
        </Text>
      </View>
      {!item.read && (
        <TouchableOpacity
          style={styles.markReadButton}
          onPress={() => handleMarkAsRead(item.id)}
        >
          <Ionicons name="checkmark-circle" size={20} color={colors.primaryGreen} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={colors.primaryGreen} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        {notifications.length > 0 && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={handleClearAll}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={24} color={colors.errorRed} />
          </TouchableOpacity>
        )}
      </View>
      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="notifications-off-outline" size={64} color={colors.textSecondary} />
          <Text style={styles.emptyText}>No notifications yet</Text>
          <Text style={styles.emptySubtext}>You'll see updates here when you receive them</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderNotification}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: 'Inter-SemiBold',
  },
  clearButton: {
    padding: 8,
  },
  listContainer: {
    padding: 16,
  },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  notificationRead: {
    backgroundColor: colors.lightGray,
  },
  notificationIcon: {
    marginRight: 12,
    alignSelf: 'flex-start',
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
    fontFamily: 'Inter-SemiBold',
  },
  notificationBody: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
    fontFamily: 'Inter-Regular',
  },
  notificationTimestamp: {
    fontSize: 12,
    color: colors.textSecondary,
    fontFamily: 'Inter-Regular',
  },
  markReadButton: {
    padding: 4,
    alignSelf: 'flex-start',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
    fontFamily: 'Inter-Regular',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 16,
    fontFamily: 'Inter-SemiBold',
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
    fontFamily: 'Inter-Regular',
  },
});

export default Notifications;