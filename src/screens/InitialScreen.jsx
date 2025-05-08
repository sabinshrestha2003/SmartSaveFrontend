import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import colors from '../styles/colors';

const InitialScreen = () => {
  const navigation = useNavigation();

  useEffect(() => {
    const checkOnboarding = async () => {
      const hasSeen = await AsyncStorage.getItem('hasSeenOnboarding');
      if (hasSeen === 'true') {
        navigation.replace('Login');
      } else {
        navigation.replace('Onboarding');
      }
    };

    checkOnboarding();
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
      <ActivityIndicator size="large" color={colors.accentPurple} />
    </View>
  );
};

export default InitialScreen;
