import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import API from '../utils/api';
import { displayNotification } from '../utils/notifications';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isLoggedOut, setIsLoggedOut] = useState(false);

  const updateUser = (updatedUser) => {
    setUser(updatedUser);
  };

  const clearNotifications = async () => {
    try {
      await AsyncStorage.removeItem('notifications');
      console.log('Notifications cleared');
    } catch (error) {
      console.error('Error clearing notifications:', error.message);
    }
  };

  const sendOTP = async (email) => {
    try {
      const response = await API.post('/auth/send-otp', { email });
      if (response.data.success) {
        console.log('OTP sent successfully to:', email);
        await displayNotification(
          'OTP Sent',
          `A verification code has been sent to ${email}.`,
          { screen: 'SignupScreen' },
          user?.id
        );
        return true;
      } else {
        Alert.alert('OTP Failed', response.data.message || 'Unable to send OTP.');
        return false;
      }
    } catch (error) {
      console.error('Send OTP error:', error.response?.data || error.message);
      Alert.alert('Error', 'Unable to send OTP. Please try again.');
      return false;
    }
  };

  const sendResetOTP = async (email) => {
    try {
      const response = await API.post('/auth/send-reset-otp', { email });
      if (response.data.success) {
        console.log('Reset OTP sent successfully to:', email);
        await displayNotification(
          'Reset OTP Sent',
          `A password reset code has been sent to ${email}.`,
          { screen: 'ResetPasswordScreen' },
          user?.id
        );
        return true;
      } else {
        throw new Error(response.data.message || 'Unable to send OTP.');
      }
    } catch (error) {
      console.error('Send Reset OTP error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Unable to send OTP.');
    }
  };

  const resetPassword = async (email, code, new_password) => {
    try {
      const response = await API.post('/auth/reset-password', { email, code, new_password });
      if (response.data.success) {
        console.log('Password reset successfully for:', email);
        await displayNotification(
          'Password Reset',
          'Your password has been successfully reset.',
          { screen: 'LoginScreen' },
          user?.id
        );
        return true;
      } else {
        throw new Error(response.data.message || 'Unable to reset password.');
      }
    } catch (error) {
      console.error('Reset Password error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Unable to reset password.');
    }
  };

  const login = async (email, password) => {
    try {
      await AsyncStorage.removeItem('token');
      await clearNotifications();
      console.log('Cleared old token and notifications before login');

      const response = await API.post('/auth/login', { email, password });
      if (response.data.success) {
        const { token } = response.data;
        await AsyncStorage.setItem('token', token);
        console.log('New token stored:', token);

        const userResponse = await API.get('/user');
        if (userResponse.data.success) {
          console.log('Fetched user data:', userResponse.data.user);
          setUser(userResponse.data.user);
          setIsLoggedOut(false);
          await displayNotification(
            'Welcome Back',
            `Logged in successfully as ${email}.`,
            { screen: 'HomeScreen' },
            userResponse.data.user.id
          );
        } else {
          throw new Error(userResponse.data.message || 'Failed to fetch user data');
        }
      } else {
        Alert.alert('Login Failed', response.data.message || 'Invalid credentials.');
      }
    } catch (error) {
      console.error('Login error:', error.response?.data || error.message);
      await AsyncStorage.removeItem('token');
      await clearNotifications();
      Alert.alert('Error', 'Unable to log in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const signup = async (name, email, profession, password, otp_code) => {
    try {
      await AsyncStorage.removeItem('token');
      await clearNotifications();
      console.log('Cleared old token and notifications before signup');

      const response = await API.post('/auth/signup', { name, email, profession, password, otp_code });
      if (response.data.success) {
        const { token, user } = response.data;
        await AsyncStorage.setItem('token', token);
        console.log('New token stored:', token);

        console.log('Fetched user data from signup:', user);
        setUser(user);
        setIsLoggedOut(false);
        await displayNotification(
          'Account Created',
          `Welcome, ${name}! Your account has been successfully created.`,
          { screen: 'HomeScreen' },
          user.id
        );
      } else {
        Alert.alert('Signup Failed', response.data.message || 'Unable to sign up.');
      }
    } catch (error) {
      console.error('Signup error:', error.response?.data || error.message);
      await AsyncStorage.removeItem('token');
      await clearNotifications();
      Alert.alert('Error', 'Unable to sign up. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      console.log('Logout: Token before request:', token ? 'Present' : 'Not Present');

      if (token) {
        try {
          await API.post('/auth/logout');
          console.log('Server logout successful');
        } catch (serverError) {
          console.warn('Server logout failed, proceeding locally:', serverError.response?.data || serverError.message);
        }
      } else {
        console.log('No token found, skipping server logout');
      }

      await AsyncStorage.removeItem('token');
      await clearNotifications();
      setUser(null);
      setIsLoggedOut(true);
      console.log('Logged out: Token cleared, user state reset');
      await displayNotification(
        'Logged Out',
        'You have been successfully logged out.',
        { screen: 'LoginScreen' },
        null
      );
    } catch (error) {
      console.error('Logout error:', error.message);
      await AsyncStorage.removeItem('token');
      await clearNotifications();
      setUser(null);
      setIsLoggedOut(true);
      console.log('Forced logout due to error');
      await displayNotification(
        'Logged Out',
        'You have been logged out. Server sync may have failed.',
        { screen: 'LoginScreen' },
        null
      );
      Alert.alert('Info', 'Logged out successfully. Server sync may have failed.');
    } finally {
      setLoading(false);
    }
  };

  const loadUser = async () => {
    console.log('loadUser started, isLoggedOut:', isLoggedOut);
    if (isLoggedOut) {
      console.log('User is logged out, skipping loadUser');
      setLoading(false);
      return;
    }
    try {
      const token = await AsyncStorage.getItem('token');
      console.log('Token check in loadUser:', token ? 'Present' : 'Not Present');
      if (!token) {
        console.log('No token found, skipping user load');
        setLoading(false);
        return;
      }
      console.log('Loading user with token:', token);

      const userResponse = await API.get('/user');
      if (userResponse.data.success) {
        console.log('Loaded user data:', userResponse.data.user);
        setUser(userResponse.data.user);
      } else {
        throw new Error(userResponse.data.message || 'Unable to fetch user details.');
      }
    } catch (error) {
      console.error('Load user error:', error.response?.data || error.message);
      await AsyncStorage.removeItem('token');
      await clearNotifications();
      setUser(null);
      console.log('Cleared token, notifications, and user due to load error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    console.log('User state updated:', user);
  }, [user]);

  return (
    <AuthContext.Provider
      value={{ user, login, signup, logout, loading, updateUser, isLoggedOut, sendOTP, sendResetOTP, resetPassword }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);