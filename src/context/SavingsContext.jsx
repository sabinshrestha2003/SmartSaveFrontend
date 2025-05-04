import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../utils/api';
import { useAuth } from './AuthContext'; 

export const SavingsContext = createContext();

export const SavingsProvider = ({ children }) => {
  const [savingsGoals, setSavingsGoals] = useState([]);
  const [loading, setLoading] = useState(false); 
  const [error, setError] = useState(null);
  const { user, loading: authLoading } = useAuth(); 

  const fetchSavingsGoals = async () => {
    console.log('fetchSavingsGoals called, user:', user, 'authLoading:', authLoading);
    if (!user || authLoading) {
      console.log('No user or auth still loading, skipping fetchSavingsGoals');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const response = await api.get('/goals');
      console.log('Savings goals fetched:', response.data);
      setSavingsGoals(response.data);
      setError(null);
    } catch (err) {
      console.error('Fetch savings goals error:', err.response?.data || err.message);
      setError(err.response?.data?.error || 'Failed to fetch savings goals.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSavingsGoals();
  }, [user, authLoading]); 

  const addSavingsGoal = async (goal) => {
    const formattedGoal = {
      ...goal,
      deadline: goal.deadline.toISOString().split('T')[0],
    };

    const tempId = Date.now();
    setSavingsGoals((prev) => [...prev, { ...formattedGoal, id: tempId }]);
    setError(null);

    try {
      const response = await api.post('/goals', formattedGoal);
      setSavingsGoals((prev) =>
        prev.map((g) => (g.id === tempId ? response.data.goal : g))
      );
    } catch (err) {
      setSavingsGoals((prev) => prev.filter((g) => g.id !== tempId));
      setError(err.response?.data?.error || 'Failed to add goal. Please check your input and try again.');
    }
  };

  const updateSavingsGoal = async (id, updatedGoal) => {
    const formattedGoal = {
      ...updatedGoal,
      deadline: updatedGoal.deadline ? new Date(updatedGoal.deadline).toISOString().split('T')[0] : null,
    };

    const previousGoal = savingsGoals.find((g) => g.id === id);
    setSavingsGoals((prev) =>
      prev.map((g) => (g.id === id ? { ...g, ...formattedGoal } : g))
    );
    setError(null);

    try {
      const response = await api.put(`/goals/${id}`, formattedGoal);
      setSavingsGoals((prev) =>
        prev.map((g) => (g.id === id ? response.data.goal : g))
      );
    } catch (err) {
      setSavingsGoals((prev) =>
        prev.map((g) => (g.id === id ? previousGoal : g))
      );
      setError(err.response?.data?.error || 'Failed to update goal. Please check your input and try again.');
    }
  };

  const deleteSavingsGoal = async (id) => {
    const deletedGoal = savingsGoals.find((g) => g.id === id);
    setSavingsGoals((prev) => prev.filter((g) => g.id !== id));
    setError(null);

    try {
      await api.delete(`/goals/${id}`);
    } catch (err) {
      setSavingsGoals((prev) => [...prev, deletedGoal].sort((a, b) => a.id - b.id));
      setError(err.response?.data?.error || 'Failed to delete goal. Please try again.');
    }
  };

  const refreshSavingsGoals = async () => {
    if (!user) {
      console.log('No user, skipping refreshSavingsGoals');
      return;
    }
    setLoading(true);
    try {
      const response = await api.get('/goals');
      setSavingsGoals(response.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to refresh savings goals.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SavingsContext.Provider
      value={{
        savingsGoals,
        loading,
        error,
        addSavingsGoal,
        updateSavingsGoal,
        deleteSavingsGoal,
        refreshSavingsGoals,
      }}
    >
      {children}
    </SavingsContext.Provider>
  );
};

export const useSavings = () => useContext(SavingsContext);