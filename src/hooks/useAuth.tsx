import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ServerManager } from '@/utils/serverManager';

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
  loginAWS: (credentials: AWSCredentials) => Promise<void>;
  loginAzure: (credentials: AzureCredentials) => Promise<void>;
  logout: (provider: 'aws' | 'azure') => void;
  isServerRunning: boolean;
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

  const [isServerRunning, setIsServerRunning] = useState(false);

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

  const loginAWS = async (credentials: AWSCredentials) => {
    console.log('Iniciando login AWS...');
    
    // Primeiro, iniciar o servidor
    const serverStarted = await ServerManager.startServer();
    if (!serverStarted) {
      throw new Error('Falha ao iniciar o servidor backend');
    }
    
    // Inicializar Terraform
    await ServerManager.initializeTerraform();
    
    const authState = {
      isAuthenticated: true,
      credentials
    };
    
    setAwsAuth(authState);
    setIsServerRunning(ServerManager.getServerStatus());
    localStorage.setItem('aws-auth', JSON.stringify(authState));
    
    console.log('Login AWS concluído com sucesso!');
  };

  const loginAzure = async (credentials: AzureCredentials) => {
    console.log('Iniciando login Azure...');
    
    // Primeiro, iniciar o servidor
    const serverStarted = await ServerManager.startServer();
    if (!serverStarted) {
      throw new Error('Falha ao iniciar o servidor backend');
    }
    
    // Inicializar Terraform para Azure
    await ServerManager.initializeTerraform();
    
    const authState = {
      isAuthenticated: true,
      credentials
    };
    
    setAzureAuth(authState);
    setIsServerRunning(ServerManager.getServerStatus());
    localStorage.setItem('azure-auth', JSON.stringify(authState));
    
    console.log('Login Azure concluído com sucesso!');
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
      logout,
      isServerRunning
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
