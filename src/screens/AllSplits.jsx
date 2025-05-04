import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Animated,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useBillSplitting } from '../context/BillSplittingContext';
import colors from '../styles/colors';
import api from '../utils/api';

const AllSplits = ({ navigation }) => {
  const { billSplits = [], settlements = [], loading, error, refreshBillSplitting, user } = useBillSplitting();
  const [enrichedItems, setEnrichedItems] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [filter, setFilter] = useState('all'); // 'all', 'to_settle', 'settled'
  const [sortOrder, setSortOrder] = useState('desc'); // 'desc' (newest), 'asc' (oldest)

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    navigation.setOptions({
      title: 'Activity',
    });

    enrichItems();
  }, [billSplits, settlements, navigation, fadeAnim]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      console.log('AllSplits focused');
      handleRefresh();
    });
    return () => unsubscribe();
  }, [navigation, handleRefresh]);

  const enrichItems = async () => {
    if (!user?.id) return;

    try {
      // Enrich bill splits
      const enrichedSplits = await Promise.all(
        billSplits.map(async (split) => {
          const enrichedParticipants = await Promise.all(
            split.participants.map(async (p) => {
              if (String(p.user_id) === String(user.id)) {
                return { ...p, name: 'You' };
              }
              try {
                const response = await api.get('/splits/users/search', { params: { q: p.user_id } });
                const userData = response.data.users.find(u => String(u.id) === String(p.user_id));
                return { ...p, name: userData?.name || `User ${p.user_id}` };
              } catch (err) {
                console.error(`Error fetching user ${p.user_id}:`, err);
                return { ...p, name: `User ${p.user_id}` };
              }
            })
          );
          // Fetch creator name
          const creatorName = String(split.creator_id) === String(user.id)
            ? 'You'
            : (await api.get('/splits/users/search', { params: { q: split.creator_id } }))
                .data.users.find(u => String(u.id) === String(split.creator_id))?.name || `User ${split.creator_id}`;
          return { type: 'split', ...split, participants: enrichedParticipants, date: split.created_at, creatorName };
        })
      );

      // Enrich settlements
      const enrichedSettlements = await Promise.all(
        settlements.map(async (settlement) => {
          const payerName = String(settlement.payer_id) === String(user.id)
            ? 'You'
            : (await api.get('/splits/users/search', { params: { q: settlement.payer_id } }))
                .data.users.find(u => String(u.id) === String(settlement.payer_id))?.name || `User ${settlement.payer_id}`;
          const payeeName = String(settlement.to_user_id) === String(user.id)
            ? 'You'
            : (await api.get('/splits/users/search', { params: { q: settlement.to_user_id } }))
                .data.users.find(u => String(u.id) === String(settlement.to_user_id))?.name || `User ${settlement.to_user_id}`;
          return {
            type: 'settlement',
            ...settlement,
            date: settlement.timestamp,
            payerName,
            payeeName,
          };
        })
      );

      // Combine and sort
      const combined = [...enrichedSplits, ...enrichedSettlements].sort((a, b) =>
        sortOrder === 'desc' ? new Date(b.date) - new Date(a.date) : new Date(a.date) - new Date(b.date)
      );
      setEnrichedItems(combined);
      console.log('Enriched items:', combined);
    } catch (error) {
      console.error('Error enriching items:', error);
      setEnrichedItems([...billSplits.map(s => ({ type: 'split', ...s, date: s.created_at })), ...settlements.map(s => ({ type: 'settlement', ...s, date: s.timestamp }))]);
    }
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshBillSplitting();
      await enrichItems();
      console.log('Activity refreshed');
    } catch (err) {
      console.error('Refresh error:', err);
    } finally {
      setRefreshing(false);
    }
  }, [refreshBillSplitting]);

  const renderItem = useCallback(
    ({ item, index }) => {
      const scaleAnim = new Animated.Value(0.95);
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 30,
        delay: index * 100,
        useNativeDriver: true,
      }).start();

      if (item.type === 'split') {
        const participant = item.participants.find(p => String(p.user_id) === String(user?.id));
        const yourShare = participant?.share_amount || 0;
        const yourPaid = participant?.paid_amount || 0;
        const amountOwed = yourShare - yourPaid;
        const isSettled = Math.abs(amountOwed) < 0.01; // Consider settled if amountOwed is negligible

        return (
          <Animated.View style={{ transform: [{ scale: scaleAnim }], opacity: fadeAnim }}>
            <TouchableOpacity
              style={styles.splitCard}
              onPress={() => navigation.navigate('SplitDetails', { splitId: item.id, splitName: item.name })}
              activeOpacity={0.8}
            >
              <View style={styles.itemContent}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                  <Text style={[styles.itemAmount, { color: colors.primaryGreen }]}>
                    ${item.total_amount.toFixed(2)}
                  </Text>
                </View>
                <Text style={styles.itemMeta}>
                  {new Date(item.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} • Created by {item.creatorName}
                </Text>
                <View style={styles.itemFooter}>
                  <View style={styles.shareContainer}>
                    <Text style={styles.shareLabel}>Your share:</Text>
                    <Text style={[styles.shareAmount, { color: amountOwed > 0 ? colors.errorRed : colors.successGreen }]}>
                      ${yourShare.toFixed(2)}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusContainer,
                      isSettled ? styles.statusSettledContainer : styles.statusOweContainer,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        isSettled ? styles.statusSettled : amountOwed > 0 ? styles.statusOwe : styles.statusOwed,
                      ]}
                    >
                      {isSettled ? 'Settled' : amountOwed > 0 ? `To Settle $${amountOwed.toFixed(2)}` : `Owed $${Math.abs(amountOwed).toFixed(2)}`}
                    </Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          </Animated.View>
        );
      } else {
        const isPayer = String(item.payer_id) === String(user?.id);
        return (
          <Animated.View style={{ transform: [{ scale: scaleAnim }], opacity: fadeAnim }}>
            <View style={styles.settlementCard}>
              <View style={styles.itemContent}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemName} numberOfLines={1}>{item.split_name || 'Direct Settlement'}</Text>
                  <Text style={[styles.itemAmount, { color: isPayer ? colors.errorRed : colors.successGreen }]}>
                    ${item.amount.toFixed(2)}
                  </Text>
                </View>
                <Text style={styles.itemMeta}>
                  {new Date(item.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} • {isPayer ? `To ${item.payeeName}` : `From ${item.payerName}`}
                </Text>
                <View style={styles.itemFooter}>
                  <View
                    style={[styles.statusContainer, styles.statusSettledContainer]}
                  >
                    <Text style={[styles.statusText, styles.statusSettled]}>
                      Settled
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </Animated.View>
        );
      }
    },
    [user?.id, fadeAnim, navigation, sortOrder]
  );

  const filteredItems = enrichedItems.filter(item => {
    if (filter === 'all') return true;
    if (item.type === 'settlement') return filter === 'settled';
    const participant = item.participants.find(p => String(p.user_id) === String(user?.id));
    const amountOwed = (participant?.share_amount || 0) - (participant?.paid_amount || 0);
    const isSettled = Math.abs(amountOwed) < 0.01;
    return filter === 'settled' ? isSettled : !isSettled;
  });

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primaryGreen} />
          <Text style={styles.loadingText}>Loading activity...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <View style={styles.errorContainer}>
          <Ionicons name="wifi-off-outline" size={48} color={colors.errorRed} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <FlatList
        data={filteredItems}
        renderItem={renderItem}
        keyExtractor={item => `${item.type}-${item.id}`}
        contentContainerStyle={styles.contentContainer}
        ListHeaderComponent={
          <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Ionicons name="chevron-back" size={24} color={colors.darkGray} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Activity</Text>
            <TouchableOpacity onPress={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')} style={styles.sortButton}>
              <Ionicons name={sortOrder === 'desc' ? 'arrow-down' : 'arrow-up'} size={20} color={colors.primaryGreen} />
            </TouchableOpacity>
          </Animated.View>
        }
        ListHeaderComponentStyle={{ marginBottom: 16 }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyStateIcon}>
              <Ionicons name="document-text-outline" size={32} color={colors.white} />
            </View>
            <Text style={styles.emptyStateText}>No activity yet</Text>
            <Text style={styles.emptyStateSubtext}>Your splits and settlements will appear here.</Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.primaryGreen]}
            tintColor={colors.primaryGreen}
            progressBackgroundColor={colors.white}
          />
        }
        ListFooterComponent={
          <View style={styles.filterContainer}>
            <TouchableOpacity
              style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
              onPress={() => setFilter('all')}
            >
              <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>All</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, filter === 'to_settle' && styles.filterButtonActive]}
              onPress={() => setFilter('to_settle')}
            >
              <Text style={[styles.filterText, filter === 'to_settle' && styles.filterTextActive]}>To Settle</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, filter === 'settled' && styles.filterButtonActive]}
              onPress={() => setFilter('settled')}
            >
              <Text style={[styles.filterText, filter === 'settled' && styles.filterTextActive]}>Settled</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
    fontFamily: 'Inter-Bold',
  },
  sortButton: {
    padding: 8,
  },
  splitCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  settlementCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  itemContent: {
    flex: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  itemName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    fontFamily: 'Inter-SemiBold',
  },
  itemAmount: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Inter-Bold',
  },
  itemMeta: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 12,
    fontFamily: 'Inter-Regular',
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  shareContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shareLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginRight: 4,
    fontFamily: 'Inter-Regular',
  },
  shareAmount: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
  statusContainer: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  statusOweContainer: {
    backgroundColor: colors.dangerLight,
  },
  statusOwedContainer: {
    backgroundColor: colors.successLight,
  },
  statusSettledContainer: {
    backgroundColor: colors.lightGray,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
  statusOwe: {
    color: colors.errorRed,
  },
  statusOwed: {
    color: colors.successGreen,
  },
  statusSettled: {
    color: colors.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: colors.white,
    borderRadius: 16,
    marginTop: 20,
    elevation: 2,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  emptyStateIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryGreen,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
    fontFamily: 'Inter-SemiBold',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    fontFamily: 'Inter-Regular',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 16,
    fontFamily: 'Inter-Medium',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: colors.background,
  },
  errorText: {
    fontSize: 16,
    color: colors.textPrimary,
    textAlign: 'center',
    marginVertical: 16,
    fontFamily: 'Inter-Medium',
  },
  retryButton: {
    backgroundColor: colors.primaryGreen,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    elevation: 2,
    shadowColor: colors.primaryGreen,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  retryButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
  filterContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
    marginBottom: 20,
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginHorizontal: 8,
    borderRadius: 20,
    backgroundColor: colors.lightGray,
  },
  filterButtonActive: {
    backgroundColor: colors.primaryGreen,
  },
  filterText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
  filterTextActive: {
    color: colors.white,
  },
});

export default AllSplits;