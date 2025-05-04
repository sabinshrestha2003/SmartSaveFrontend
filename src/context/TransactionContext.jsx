import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API from '../utils/api';
import { useAuth } from './AuthContext';

const TransactionContext = createContext();

export const TransactionProvider = ({ children }) => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { user } = useAuth();

  const fetchTransactions = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        throw new Error('No token found');
      }
      const response = await API.get('/transactions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data) {
        setTransactions(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
      setError('Failed to fetch transactions. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const addIncome = async (incomeData) => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await API.post('/transactions/income', incomeData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data) {
        setTransactions((prev) => [...prev, response.data]);
      }
    } catch (error) {
      console.error('Failed to add income:', error);
      throw error;
    }
  };

  const addExpense = async (expenseData) => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await API.post('/transactions/expense', expenseData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data) {
        setTransactions((prev) => [...prev, response.data]);
      }
    } catch (error) {
      console.error('Failed to add expense:', error);
      throw error;
    }
  };

  const updateTransaction = async (id, updatedTransaction) => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await API.put(`/transactions/${id}`, updatedTransaction, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data) {
        setTransactions((prevTransactions) =>
          prevTransactions.map((txn) => (txn.id === id ? response.data : txn))
        );
        return response.data;
      }
    } catch (error) {
      console.error('Failed to update transaction:', error);
      throw error;
    }
  };

  const deleteTransaction = async (id) => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        throw new Error('No token found');
      }
      setLoading(true);
      setError(null);
      await API.delete(`/transactions/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTransactions((prevTransactions) =>
        prevTransactions.filter((txn) => txn.id !== id)
      );
    } catch (error) {
      console.error('Failed to delete transaction:', error);
      setError('Failed to delete transaction. Please try again.');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  return (
    <TransactionContext.Provider
      value={{
        transactions,
        addIncome,
        addExpense,
        updateTransaction,
        deleteTransaction, 
        loading,
        error,
        fetchTransactions,
      }}
    >
      {children}
    </TransactionContext.Provider>
  );
};

export const useTransaction = () => useContext(TransactionContext);