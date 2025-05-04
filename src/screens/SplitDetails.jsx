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
  ScrollView,
  Alert,
  Animated,
  Image,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useBillSplitting } from '../context/BillSplittingContext';
import colors from '../styles/colors';
import api from '../utils/api';

const SplitDetails = ({ navigation, route }) => {
  const { splitId, splitName } = route.params || {};
  const { billSplits, user, groups, refreshBillSplitting } = useBillSplitting();
  const [split, setSplit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.95));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      })
    ]).start();

    navigation.setOptions({
      title: splitName || 'Split Details',
      headerShown: false,
    });

    fetchSplitDetails();
  }, [splitId, navigation, fadeAnim, scaleAnim]);

  // Update split when billSplits changes
  useEffect(() => {
    const updatedSplit = billSplits.find(s => String(s.id) === String(splitId));
    if (updatedSplit) {
      enrichParticipants(updatedSplit).then(enriched => {
        setSplit(enriched);
        navigation.setOptions({ title: enriched.name || 'Split Details' });
      });
    }
  }, [billSplits, splitId]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      console.log(`SplitDetails focused with splitId: ${splitId}`);
      const contextSplit = billSplits.find(s => String(s.id) === String(splitId));
      if (contextSplit) {
        enrichParticipants(contextSplit).then(enriched => {
          setSplit(enriched);
          navigation.setOptions({ title: enriched.name || 'Split Details' });
        });
      } else {
        fetchSplitDetails();
      }
    });
    return () => unsubscribe();
  }, [navigation, splitId, billSplits]);

  const enrichParticipants = async (splitData) => {
    if (!splitData?.participants || splitData.participants.length === 0) {
      return { ...splitData, participants: [] };
    }

    try {
      const enrichedParticipants = await Promise.all(
        splitData.participants.map(async (participant) => {
          if (!participant.user_id) {
            console.warn('Participant missing user_id:', participant);
            return { ...participant, name: 'Unknown User' };
          }
          if (String(participant.user_id) === String(user?.id)) {
            return { ...participant, name: 'You' };
          }
          try {
            const response = await api.get('/splits/users/search', {
              params: { q: participant.user_id },
            });
            const userData = response.data.users.find(u => String(u.id) === String(participant.user_id));
            return {
              ...participant,
              name: userData?.name || `User ${participant.user_id}`,
            };
          } catch (err) {
            console.error(`Error fetching user ${participant.user_id}:`, err.response?.data || err.message);
            return { ...participant, name: `User ${participant.user_id}` };
          }
        })
      );
      console.log('Enriched participants:', enrichedParticipants);
      return { ...splitData, participants: enrichedParticipants };
    } catch (error) {
      console.error('Error enriching participants:', error);
      return {
        ...splitData,
        participants: splitData.participants.map(p => ({
          ...p,
          name: String(p.user_id) === String(user?.id) ? 'You' : `User ${p.user_id || 'Unknown'}`,
        })),
      };
    }
  };

  const fetchSplitDetails = async () => {
    if (!splitId) {
      Alert.alert('Error', 'No split ID provided.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
      return;
    }

    setLoading(true);
    try {
      let splitData = billSplits.find(s => String(s.id) === String(splitId));
      if (splitData) {
        console.log('Using split from context:', splitData);
      } else {
        const response = await api.get(`/splits/bill_splits/${splitId}`);
        console.log('Fetched split from API:', response.data);
        splitData = response.data.bill_split;
        if (!splitData) {
          throw new Error('Split data not found in API response');
        }
      }
      const enrichedSplit = await enrichParticipants(splitData);
      setSplit(enrichedSplit);
      navigation.setOptions({ title: enrichedSplit.name || 'Split Details' });
    } catch (error) {
      console.error('Error fetching split details:', error.response?.data || error.message);
      Alert.alert('Error', error.response?.data?.error || 'Failed to load split details.');
      setSplit(null);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    if (String(split?.creator_id) !== String(user?.id)) {
      Alert.alert('Permission Denied', 'Only the creator can edit this split.');
      return;
    }
    navigation.navigate('EditSplit', {
      splitId: split.id,
      splitName: split.name,
      onEditSuccess: async (updatedSplit) => {
        const enrichedSplit = await enrichParticipants(updatedSplit);
        setSplit(enrichedSplit);
        navigation.setOptions({ title: enrichedSplit.name || 'Split Details' });
        await refreshBillSplitting();
      },
    });
  };

  const handleDelete = () => {
    if (String(split?.creator_id) !== String(user?.id)) {
      Alert.alert('Permission Denied', 'Only the creator can delete this split.');
      return;
    }
    Alert.alert(
      'Delete Split',
      'Are you sure you want to delete this split? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/splits/bill_splits/${splitId}`);
              await refreshBillSplitting();
              Alert.alert('Success', 'Split deleted successfully.', [
                { text: 'OK', onPress: () => navigation.navigate('BillSplittingDashboard') },
              ]);
            } catch (error) {
              console.error('Delete split error:', error.response?.data || error.message);
              Alert.alert('Error', error.response?.data?.error || 'Failed to delete split.');
            }
          },
        },
      ]
    );
  };

  const handleSettle = () => {
    navigation.navigate('SettleUp', {
      splitId,
      participants: split?.participants,
      onSettleSuccess: async () => {
        await fetchSplitDetails();
        await refreshBillSplitting();
      },
    });
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'Dining Out': return 'restaurant-outline';
      case 'Groceries': return 'basket-outline';
      case 'Drinks': return 'wine-outline';
      case 'Transport': return 'car-outline';
      case 'Ride Share': return 'car-sport-outline';
      case 'Travel': return 'airplane-outline';
      case 'Hotel': return 'bed-outline';
      case 'Entertainment': return 'film-outline';
      case 'Activities': return 'tennisball-outline';
      case 'Shopping': return 'cart-outline';
      case 'Utilities': return 'flash-outline';
      case 'Rent': return 'home-outline';
      default: return 'receipt-outline';
    }
  };

  const renderParticipant = useCallback(
    ({ item, index }) => {
      const amountOwed = (item.share_amount || 0) - (item.paid_amount || 0);
      const isCurrentUser = String(item.user_id) === String(user?.id);
      const isCreator = String(split?.creator_id) === String(item.user_id);

      let status;
      let statusColor;
      let statusIcon;

      if (amountOwed > 0) {
        status = 'To Give';
        statusColor = colors.errorRed;
        statusIcon = 'arrow-up-outline';
      } else if (amountOwed < 0) {
        status = 'To Take';
        statusColor = colors.successGreen;
        statusIcon = 'arrow-down-outline';
      } else {
        status = 'Settled';
        statusColor = colors.textSecondary;
        statusIcon = 'checkmark-circle-outline';
      }

      // Animation for each participant row
      const itemFadeAnim = new Animated.Value(0);
      const itemTranslateY = new Animated.Value(20);
      
      Animated.parallel([
        Animated.timing(itemFadeAnim, {
          toValue: 1,
          duration: 300,
          delay: index * 100,
          useNativeDriver: true,
        }),
        Animated.timing(itemTranslateY, {
          toValue: 0,
          duration: 300,
          delay: index * 100,
          useNativeDriver: true,
        })
      ]).start();

      return (
        <Animated.View 
          style={[
            styles.participantCard,
            { 
              opacity: itemFadeAnim,
              transform: [{ translateY: itemTranslateY }]
            }
          ]}
        >
          <View style={styles.participantHeader}>
            <View style={styles.participantAvatarContainer}>
              <View style={[
                styles.participantAvatar,
                isCurrentUser && styles.currentUserAvatar
              ]}>
                <Text style={[
                  styles.participantInitial,
                  isCurrentUser && styles.currentUserInitial
                ]}>
                  {item.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.participantNameContainer}>
                <Text style={styles.participantName}>
                  {item.name} {isCreator && <Text style={styles.creatorBadge}>Creator</Text>}
                </Text>
                {isCurrentUser && <Text style={styles.youBadge}>You</Text>}
              </View>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
              <Ionicons name={statusIcon} size={14} color={statusColor} style={styles.statusIcon} />
              <Text style={[styles.statusText, { color: statusColor }]}>{status}</Text>
            </View>
          </View>
          
          <View style={styles.participantDetails}>
            <View style={styles.detailRow}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Paid</Text>
                <Text style={styles.detailValue}>${(item.paid_amount || 0).toFixed(2)}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Share</Text>
                <Text style={styles.detailValue}>${(item.share_amount || 0).toFixed(2)}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>{status}</Text>
                <Text style={[styles.detailValue, { color: statusColor }]}>
                  ${Math.abs(amountOwed).toFixed(2)}
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>
      );
    },
    [user?.id, split?.creator_id]
  );

  const getGroupName = (groupId) => {
    const group = groups.find(g => String(g.id) === String(groupId));
    return group ? group.name : 'No Group';
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <View style={styles.loadingContainer}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={colors.primaryGreen} />
            <Text style={styles.loadingText}>Loading split details...</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!split) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <View style={styles.errorContainer}>
          <View style={styles.errorCard}>
            <View style={styles.errorIconContainer}>
              <Ionicons name="alert-circle" size={48} color={colors.errorRed} />
            </View>
            <Text style={styles.errorTitle}>Split Not Found</Text>
            <Text style={styles.errorText}>We couldn't find the split you're looking for.</Text>
            <TouchableOpacity
              style={styles.backButtonError}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.backButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const totalPaid = split.participants.reduce((sum, p) => sum + (p.paid_amount || 0), 0);
  const totalShare = split.participants.reduce((sum, p) => sum + (p.share_amount || 0), 0);
  const currentUserParticipant = split.participants.find(p => String(p.user_id) === String(user?.id));
  const userAmountOwed = currentUserParticipant 
    ? (currentUserParticipant.share_amount || 0) - (currentUserParticipant.paid_amount || 0)
    : 0;
  
  const formattedDate = new Date(split.created_at || Date.now()).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <ScrollView 
        style={styles.container} 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View 
          style={[
            styles.header, 
            { 
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }]
            }
          ]}
        >
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color={colors.primaryGreen} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {split.name}
          </Text>
          {String(split.creator_id) === String(user?.id) && (
            <TouchableOpacity 
              onPress={handleEdit} 
              style={styles.editButton}
              activeOpacity={0.7}
            >
              <Ionicons name="pencil" size={20} color={colors.primaryGreen} />
            </TouchableOpacity>
          )}
        </Animated.View>

        <Animated.View 
          style={[
            styles.summaryContainer, 
            { 
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }]
            }
          ]}
        >
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <View style={styles.categoryIconContainer}>
                <Ionicons 
                  name={getCategoryIcon(split.category)} 
                  size={24} 
                  color={colors.white} 
                />
              </View>
              <View style={styles.summaryTitleContainer}>
                <Text style={styles.summaryTitle}>Total Amount</Text>
                {split.group_id && (
                  <View style={styles.groupBadge}>
                    <Ionicons name="people" size={12} color={colors.primaryGreen} style={styles.groupIcon} />
                    <Text style={styles.groupName}>{getGroupName(split.group_id)}</Text>
                  </View>
                )}
              </View>
            </View>
            
            <Text style={styles.summaryAmount}>${(split.total_amount || 0).toFixed(2)}</Text>
            
            <View style={styles.summaryMetaContainer}>
              <View style={styles.summaryMetaItem}>
                <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} style={styles.summaryMetaIcon} />
                <Text style={styles.summaryMetaText}>{formattedDate}</Text>
              </View>
              
              {currentUserParticipant && (
                <View style={[
                  styles.userStatusBadge,
                  userAmountOwed > 0 ? styles.userStatusOwe : 
                  userAmountOwed < 0 ? styles.userStatusOwed : 
                  styles.userStatusSettled
                ]}>
                  <Text style={styles.userStatusText}>
                    {userAmountOwed > 0 
                      ? `You owe $${userAmountOwed.toFixed(2)}` 
                      : userAmountOwed < 0 
                      ? `You're owed $${Math.abs(userAmountOwed).toFixed(2)}`
                      : "You're settled"}
                  </Text>
                </View>
              )}
            </View>
            
            {split.notes && (
              <View style={styles.notesContainer}>
                <Text style={styles.notesLabel}>Notes:</Text>
                <Text style={styles.notesText}>{split.notes}</Text>
              </View>
            )}
          </View>
        </Animated.View>

        <Animated.View 
          style={[
            styles.balanceContainer, 
            { 
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }]
            }
          ]}
        >
          <View style={styles.balanceCard}>
            <View style={styles.balanceRow}>
              <View style={styles.balanceItem}>
                <Text style={styles.balanceLabel}>Total Paid</Text>
                <Text style={styles.balanceValue}>${totalPaid.toFixed(2)}</Text>
              </View>
              <View style={styles.balanceDivider} />
              <View style={styles.balanceItem}>
                <Text style={styles.balanceLabel}>Total Share</Text>
                <Text style={styles.balanceValue}>${totalShare.toFixed(2)}</Text>
              </View>
            </View>
          </View>
        </Animated.View>

        <Animated.View 
          style={[
            styles.section, 
            { 
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }]
            }
          ]}
        >
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Participants</Text>
            <View style={styles.participantCountBadge}>
              <Text style={styles.participantCount}>{split.participants.length}</Text>
            </View>
          </View>
          
          <FlatList
            data={split.participants}
            renderItem={renderParticipant}
            keyExtractor={item => String(item.user_id || Math.random())}
            scrollEnabled={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="people" size={40} color={colors.lightGray} />
                <Text style={styles.emptyText}>No participants found</Text>
              </View>
            }
          />
        </Animated.View>

        <Animated.View 
          style={[
            styles.actionsContainer, 
            { 
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }]
            }
          ]}
        >
          <TouchableOpacity 
            style={styles.settleButton} 
            onPress={handleSettle}
            activeOpacity={0.8}
          >
            <Ionicons name="cash" size={20} color={colors.white} style={styles.actionButtonIcon} />
            <Text style={styles.actionButtonText}>Settle Up</Text>
          </TouchableOpacity>
          
          {String(split.creator_id) === String(user?.id) && (
            <TouchableOpacity 
              style={styles.deleteButton} 
              onPress={handleDelete}
              activeOpacity={0.8}
            >
              <Ionicons name="trash" size={20} color={colors.white} style={styles.actionButtonIcon} />
              <Text style={styles.actionButtonText}>Delete Split</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.03)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
    marginLeft: 12,
    fontFamily: 'Inter-Bold',
  },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.03)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryContainer: {
    marginBottom: 16,
  },
  summaryCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryGreen,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  summaryTitleContainer: {
    flex: 1,
  },
  summaryTitle: {
    fontSize: 16,
    color: colors.textSecondary,
    fontFamily: 'Inter-Medium',
    marginBottom: 4,
  },
  groupBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76,175,80,0.1)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  groupIcon: {
    marginRight: 4,
  },
  groupName: {
    fontSize: 12,
    color: colors.primaryGreen,
    fontFamily: 'Inter-Medium',
  },
  summaryAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 12,
    fontFamily: 'Inter-Bold',
  },
  summaryMetaContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryMetaIcon: {
    marginRight: 4,
  },
  summaryMetaText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontFamily: 'Inter-Regular',
  },
  userStatusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  userStatusOwe: {
    backgroundColor: 'rgba(244,67,54,0.1)',
  },
  userStatusOwed: {
    backgroundColor: 'rgba(76,175,80,0.1)',
  },
  userStatusSettled: {
    backgroundColor: 'rgba(158,158,158,0.1)',
  },
  userStatusText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
    color: colors.textPrimary,
  },
  notesContainer: {
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  notesLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
    fontFamily: 'Inter-SemiBold',
  },
  notesText: {
    fontSize: 14,
    color: colors.textPrimary,
    fontFamily: 'Inter-Regular',
    lineHeight: 20,
  },
  balanceContainer: {
    marginBottom: 16,
  },
  balanceCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceItem: {
    flex: 1,
    alignItems: 'center',
  },
  balanceDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(0,0,0,0.1)',
    marginHorizontal: 16,
  },
  balanceLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
    fontFamily: 'Inter-Medium',
  },
  balanceValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: 'Inter-Bold',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: 'Inter-Bold',
  },
  participantCountBadge: {
    backgroundColor: 'rgba(76,175,80,0.1)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  participantCount: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primaryGreen,
    fontFamily: 'Inter-SemiBold',
  },
  participantCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    marginBottom: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  participantHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  participantAvatarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  participantAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  currentUserAvatar: {
    backgroundColor: 'rgba(76,175,80,0.2)',
  },
  participantInitial: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    fontFamily: 'Inter-SemiBold',
  },
  currentUserInitial: {
    color: colors.primaryGreen,
  },
  participantNameContainer: {
    flex: 1,
  },
  participantName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    fontFamily: 'Inter-SemiBold',
  },
  creatorBadge: {
    fontSize: 12,
    color: colors.primaryGreen,
    fontFamily: 'Inter-Medium',
  },
  youBadge: {
    fontSize: 12,
    color: colors.primaryGreen,
    fontFamily: 'Inter-Medium',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  statusIcon: {
    marginRight: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
  participantDetails: {
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 12,
    padding: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailItem: {
    alignItems: 'center',
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
    fontFamily: 'Inter-Regular',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    fontFamily: 'Inter-SemiBold',
  },
  emptyContainer: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 12,
    textAlign: 'center',
    fontFamily: 'Inter-Regular',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  settleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryGreen,
    borderRadius: 16,
    padding: 16,
    shadowColor: colors.primaryGreenDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  deleteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.errorRed,
    borderRadius: 16,
    padding: 16,
    shadowColor: 'rgba(244,67,54,0.5)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  actionButtonIcon: {
    marginRight: 8,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
    fontFamily: 'Inter-SemiBold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  loadingCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    width: '100%',
    maxWidth: 300,
  },
  loadingText: {
    fontSize: 16,
    color: colors.textPrimary,
    marginTop: 16,
    fontFamily: 'Inter-Medium',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  errorCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    width: '100%',
    maxWidth: 300,
  },
  errorIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(244,67,54,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
    fontFamily: 'Inter-Bold',
  },
  errorText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    fontFamily: 'Inter-Regular',
  },
  backButtonError: {
    backgroundColor: colors.primaryGreen,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    shadowColor: colors.primaryGreenDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  backButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
});

export default SplitDetails;