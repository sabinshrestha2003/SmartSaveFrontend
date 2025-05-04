import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import { AuthProvider } from './src/context/AuthContext';
import { SavingsProvider } from './src/context/SavingsContext';
import { TransactionProvider } from './src/context/TransactionContext';
import { BillSplittingProvider } from './src/context/BillSplittingContext';

const App = () => {
  return (
    <AuthProvider>
      <SavingsProvider>
        <TransactionProvider>
          <BillSplittingProvider>
            <NavigationContainer>
              <AppNavigator />
            </NavigationContainer>
          </BillSplittingProvider>
        </TransactionProvider>
      </SavingsProvider>
    </AuthProvider>
  );
};

export default App;