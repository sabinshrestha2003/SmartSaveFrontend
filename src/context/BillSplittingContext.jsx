import React, { createContext, useState, useEffect, useContext } from 'react';
import { getUserGroups, getBillSplits, getSettlements, getGroup, addSettlement } from '../utils/api';
import { useAuth } from './AuthContext';
import { displayNotification } from '../utils/notifications';

export const BillSplittingContext = createContext();

export const BillSplittingProvider = ({ children }) => {
  const [groups, setGroups] = useState([]);
  const [billSplits, setBillSplits] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [invalidGroups, setInvalidGroups] = useState(new Set());
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

  const validateGroup = async (groupId) => {
    if (invalidGroups.has(String(groupId))) {
      console.log(`Skipping validation for known invalid group ID: ${groupId}`);
      return null;
    }

    try {
      console.log(`Validating group ID: ${groupId}`);
      const response = await getGroup(groupId);
      console.log(`Validation response for group ${groupId}:`, response.data.group);
      return response.data.group;
    } catch (err) {
      console.error(`Error validating group ${groupId}:`, err.response?.data || err.message);
      if (err.response?.status === 404) {
        console.log(`Group ${groupId} not found, removing from state`);
        setInvalidGroups(prev => {
          const updated = new Set(prev);
          updated.add(String(groupId));
          console.log(`Updated invalidGroups:`, Array.from(updated));
          return updated;
        });
        setGroups(prev => {
          const updatedGroups = prev.filter(g => String(g.id) !== String(groupId));
          console.log(`Updated groups after removing ${groupId}:`, updatedGroups);
          return updatedGroups;
        });
      }
      return null;
    }
  };

  const fetchBillSplittingData = async () => {
    if (!user || authLoading) {
      console.log('No user or auth loading, skipping fetchBillSplittingData');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      console.log('Fetching bill splitting data');
      const results = await Promise.allSettled([
        getUserGroups(),
        getBillSplits(),
        getSettlements(),
      ]);

      let groupsData = [];
      let billSplitsData = [];
      let settlementsData = [];
      let errors = [];

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          if (index === 0) {
            groupsData = result.value.data.groups || [];
            console.log('Fetched groups:', groupsData);
          } else if (index === 1) {
            billSplitsData = result.value.data.bill_splits || [];
            console.log('Fetched bill splits:', billSplitsData);
          } else if (index === 2) {
            settlementsData = result.value.data.settlements || [];
            console.log('Fetched settlements:', settlementsData);
          }
        } else {
          const errorMessage = result.reason.response?.data?.error || result.reason.message;
          console.error(`Error in API call ${index}:`, errorMessage);
          errors.push(errorMessage);
        }
      });

      // Validate all groups to filter out invalid ones
      const validatedGroups = [];
      for (const group of groupsData) {
        if (invalidGroups.has(String(group.id))) {
          console.log(`Skipping validation for known invalid group ID: ${group.id}`);
          continue;
        }
        const validatedGroup = await validateGroup(group.id);
        if (validatedGroup) {
          validatedGroups.push(validatedGroup);
        }
      }
      console.log('Validated groups before setting state:', validatedGroups);

      validatedGroups.sort((a, b) => Number(a.id) - Number(b.id));
      setGroups(validatedGroups);
      setBillSplits(billSplitsData);
      setSettlements(settlementsData);

      if (user?.id) {
        const newStats = calculateStats(billSplitsData, user.id, settlementsData);
        setStats(newStats);
        console.log('Updated stats:', newStats);
      }

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
      console.log('Finished fetching bill splitting data, current groups:', groups);
    }
  };

  const removeGroup = (groupId) => {
    console.log(`Removing group ${groupId} from context state`);
    setInvalidGroups(prev => {
      const updated = new Set(prev);
      updated.add(String(groupId));
      console.log(`Updated invalidGroups after removal:`, Array.from(updated));
      return updated;
    });
    setGroups(prev => {
      const updatedGroups = prev.filter(g => String(g.id) !== String(groupId));
      console.log(`Updated groups after removing ${groupId}:`, updatedGroups);
      return updatedGroups;
    });
    setBillSplits(prev => {
      const updatedSplits = prev.filter(b => String(b.group_id) !== String(groupId));
      console.log(`Updated bill splits after removing group ${groupId}:`, updatedSplits);
      return updatedSplits;
    });
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
    console.log('Starting refreshBillSplitting, clearing stale state');
    setGroups([]);
    setBillSplits([]);
    setSettlements([]);
    setStats({ totalOwed: 0, totalOwing: 0, netBalance: 0 });
    setInvalidGroups(new Set());
    await fetchBillSplittingData();
    console.log('Completed refreshBillSplitting');
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

  const addNewSettlement = async (settlementData) => {
    if (!user) {
      console.error('Cannot add settlement: No user logged in');
      throw new Error('User not authenticated');
    }
    try {
      const response = await addSettlement(settlementData);
      const newSettlement = response.data.settlement;
      setSettlements(prev => [...prev, newSettlement]);
      const newStats = calculateStats(billSplits, user.id, [...settlements, newSettlement]);
      setStats(newStats);
      console.log('Added new settlement:', newSettlement);
      return newSettlement;
    } catch (err) {
      console.error('Error adding settlement:', err.response?.data || err.message);
      throw new Error(err.response?.data?.error || 'Failed to add settlement');
    }
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
        triggerNotification,
        user,
        addSettlement: addNewSettlement,
        validateGroup,
        removeGroup,
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