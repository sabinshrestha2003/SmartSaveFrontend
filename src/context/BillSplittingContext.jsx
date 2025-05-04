import React, { createContext, useState, useEffect, useContext } from 'react';
import { getUserGroups, getBillSplits, getSettlements, addSettlement } from '../utils/api';
import { useAuth } from './AuthContext';
import { displayNotification } from '../utils/notifications';

export const BillSplittingContext = createContext();

export const BillSplittingProvider = ({ children }) => {
  const [groups, setGroups] = useState([]);
  const [billSplits, setBillSplits] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [stats, setStats] = useState({
    totalOwed: 0,
    totalOwing: 0,
    netBalance: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { user, loading: authLoading } = useAuth();

  const calculateStats = (splits, currentUserId, settlements = []) => {
    let totalOwed = 0;
    let totalOwing = 0;

    const userId = String(currentUserId);

    splits.forEach(split => {
      const participant = split.participants.find(p => String(p.user_id) === userId);
      if (participant) {
        const shareAmount = Number(participant.share_amount) || 0;
        const paidAmount = Number(participant.paid_amount) || 0;
        const owedInSplit = shareAmount - paidAmount;

        if (owedInSplit > 0) {
          totalOwed += owedInSplit;
        }

        if (String(split.creator_id) === userId) {
          split.participants
            .filter(p => String(p.user_id) !== userId)
            .forEach(p => {
              const amountOwed = (Number(p.share_amount) || 0) - (Number(p.paid_amount) || 0);
              if (amountOwed > 0) {
                totalOwing += amountOwed;
              }
            });
        }
      }
    });

    settlements.forEach(settlement => {
      const amount = Number(settlement.amount) || 0;
      if (String(settlement.payer_id) === userId) {
        totalOwed -= amount;
      } else if (String(settlement.payee_id) === userId) {
        totalOwing -= amount;
      }
    });

    const netBalance = totalOwing - totalOwed;
    return {
      totalOwed: Math.max(0, totalOwed),
      totalOwing: Math.max(0, totalOwing),
      netBalance,
    };
  };

  const fetchBillSplittingData = async () => {
    if (!user || authLoading) {
      console.log('No user or auth loading, skipping fetchBillSplittingData');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      // Make API calls concurrently but handle failures individually
      const results = await Promise.allSettled([
        getUserGroups(),
        getBillSplits(),
        getSettlements(),
      ]);

      let groupsData = [];
      let billSplitsData = [];
      let settlementsData = [];
      let errors = [];

      // Process each result
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          if (index === 0) {
            groupsData = result.value.data.groups || [];
          } else if (index === 1) {
            billSplitsData = result.value.data.bill_splits || [];
          } else if (index === 2) {
            settlementsData = result.value.data.settlements || [];
          }
        } else {
          const errorMessage = result.reason.response?.data?.error || result.reason.message;
          console.error(`Error in API call ${index}:`, errorMessage);
          errors.push(errorMessage);
        }
      });

      // Update state with successful data
      setGroups(groupsData);
      setBillSplits(billSplitsData);
      setSettlements(settlementsData);

      if (user?.id) {
        const newStats = calculateStats(billSplitsData, user.id, settlementsData);
        setStats(newStats);
        console.log('Updated stats:', newStats);
      }

      // Set error if any API call failed
      if (errors.length > 0) {
        setError(errors.join('; '));
      }
    } catch (err) {
      console.error('Unexpected error in fetchBillSplittingData:', err);
      setError('Unable to load your expense data. Please try again later.');
      setGroups([]);
      setBillSplits([]);
      setSettlements([]);
      setStats({ totalOwed: 0, totalOwing: 0, netBalance: 0 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBillSplittingData();
  }, [user, authLoading]);

  useEffect(() => {
    if (user?.id && billSplits.length > 0) {
      const newStats = calculateStats(billSplits, user.id, settlements);
      setStats(newStats);
      console.log('Recalculated stats on billSplits or settlements change:', newStats);
    }
  }, [billSplits, user?.id, settlements]);

  const refreshBillSplitting = async () => {
    if (!user) {
      console.log('No user, skipping refreshBillSplitting');
      return;
    }
    await fetchBillSplittingData();
  };

  const triggerNotification = async (title, body, data = {}, userId = null) => {
    if (!user) {
      console.log('No user, skipping notification');
      return;
    }
    try {
      const targetUserId = userId || user.id;
      await displayNotification(title, body, data, targetUserId);
      console.log(`Triggered notification for user ${targetUserId}: ${title}`);
    } catch (err) {
      console.error('Error triggering notification:', err);
    }
  };

  const addSettlement = async (settlement) => {
    if (!user) {
      console.error('Cannot add settlement: No user logged in');
      throw new Error('User not logged in');
    }
    try {
      const response = await addSettlement(settlement);
      const newSettlement = response.data.settlement || settlement;

      setSettlements(prev => [...prev, newSettlement]);

      const notificationData = {
        screen: 'SplitDetails',
        params: { splitId: settlement.bill_split_id },
      };
      await triggerNotification(
        'Settlement Added',
        `You settled $${newSettlement.amount.toFixed(2)} for a bill split.`,
        notificationData
      );

      await refreshBillSplitting();

      console.log('Added settlement:', newSettlement);
      return newSettlement;
    } catch (err) {
      console.error('Error adding settlement:', err.response?.data || err.message);
      throw err;
    }
  };

  const removeGroup = (groupId) => {
    const updatedGroups = groups.filter(g => String(g.id) !== String(groupId));
    const updatedSplits = billSplits.filter(s => String(s.group_id) !== String(groupId));
    setGroups(updatedGroups);
    setBillSplits(updatedSplits);
    if (user?.id) {
      const newStats = calculateStats(updatedSplits, user.id, settlements);
      setStats(newStats);

      const group = groups.find(g => String(g.id) === String(groupId));
      if (group) {
        triggerNotification(
          'Group Removed',
          `The group "${group.name}" has been removed.`,
          { screen: 'BillSplittingDashboard' }
        );
      }
    }
    console.log(`Removed group ${groupId} from context`);
  };

  return (
    <BillSplittingContext.Provider
      value={{
        groups,
        billSplits,
        settlements,
        stats,
        loading,
        error,
        refreshBillSplitting,
        removeGroup,
        user,
        addSettlement,
        triggerNotification,
      }}
    >
      {children}
    </BillSplittingContext.Provider>
  );
};

export const useBillSplitting = () => {
  const context = useContext(BillSplittingContext);
  if (!context) {
    throw new Error('useBillSplitting must be used within a BillSplittingProvider');
  }
  return context;
};