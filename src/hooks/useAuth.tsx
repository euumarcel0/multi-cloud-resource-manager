
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AWSCredentials {
  accessKey: string;
  secretKey: string;
  token?: string;
  region: string;
}

interface AzureCredentials {
  subscriptionId: string;
  clientId: string;
  clientSecret: string;
  tenantId: string;
  location: string;
}

interface AuthState {
  isAuthenticated: boolean;
  credentials: AWSCredentials | AzureCredentials | null;
}

interface AuthContextType {
  awsAuth: AuthState;
  azureAuth: AuthState;
  loginAWS: (credentials: AWSCredentials) => void;
  loginAzure: (credentials: AzureCredentials) => void;
  logout: (provider: 'aws' | 'azure') => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [awsAuth, setAwsAuth] = useState<AuthState>({
    isAuthenticated: false,
    credentials: null
  });

  const [azureAuth, setAzureAuth] = useState<AuthState>({
    isAuthenticated: false,
    credentials: null
  });

  // Carregar credenciais do localStorage na inicialização
  useEffect(() => {
    const savedAwsAuth = localStorage.getItem('aws-auth');
    const savedAzureAuth = localStorage.getItem('azure-auth');

    if (savedAwsAuth) {
      setAwsAuth(JSON.parse(savedAwsAuth));
    }

    if (savedAzureAuth) {
      setAzureAuth(JSON.parse(savedAzureAuth));
    }
  }, []);

  const loginAWS = (credentials: AWSCredentials) => {
    const authState = {
      isAuthenticated: true,
      credentials
    };
    setAwsAuth(authState);
    localStorage.setItem('aws-auth', JSON.stringify(authState));
  };

  const loginAzure = (credentials: AzureCredentials) => {
    const authState = {
      isAuthenticated: true,
      credentials
    };
    setAzureAuth(authState);
    localStorage.setItem('azure-auth', JSON.stringify(authState));
  };

  const logout = (provider: 'aws' | 'azure') => {
    const emptyState = {
      isAuthenticated: false,
      credentials: null
    };

    if (provider === 'aws') {
      setAwsAuth(emptyState);
      localStorage.removeItem('aws-auth');
    } else {
      setAzureAuth(emptyState);
      localStorage.removeItem('azure-auth');
    }
  };

  return (
    <AuthContext.Provider value={{
      awsAuth,
      azureAuth,
      loginAWS,
      loginAzure,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
