
export class ServerManager {
  private static isServerRunning = false;
  private static isInitialized = false;
  private static backendUrl = 'https://ctq7dlxk-3001.brs.devtunnels.ms';

  static async startServer(): Promise<boolean> {
    console.log('🚀 Conectando ao servidor backend externo...');
    
    const serverRunning = await this.checkRealServer();
    
    if (serverRunning) {
      this.isServerRunning = true;
      console.log('✅ Servidor backend conectado com sucesso!');
      return true;
    }

    console.log('❌ Servidor backend não está acessível');
    return false;
  }

  static async checkRealServer(): Promise<boolean> {
    try {
      console.log(`🔍 Verificando servidor em: ${this.backendUrl}/health`);
      
      const response = await fetch(`${this.backendUrl}/health`, { 
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        mode: 'cors',
        signal: AbortSignal.timeout(10000)
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`🌐 Servidor respondeu:`, data);
        return true;
      } else {
        console.log(`❌ Servidor retornou status: ${response.status}`);
      }
    } catch (error) {
      console.error(`❌ Erro ao conectar com servidor:`, error);
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.log('❌ Erro de rede - verifique se o backend está rodando');
      } else if (error instanceof Error && error.name === 'AbortError') {
        console.log('❌ Timeout na conexão com o servidor');
      }
    }
    return false;
  }

  static async initializeTerraform(): Promise<boolean> {
    try {
      console.log('🔧 Inicializando Terraform no servidor externo...');
      
      const response = await fetch(`${this.backendUrl}/api/terraform/init`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        mode: 'cors',
        signal: AbortSignal.timeout(30000)
      });

      if (response.ok) {
        const result = await response.json();
        this.isInitialized = true;
        console.log('✅ Terraform inicializado com sucesso!', result);
        return true;
      } else {
        const errorText = await response.text();
        throw new Error(`Falha na inicialização (${response.status}): ${errorText}`);
      }
    } catch (error) {
      console.error('❌ Erro ao inicializar Terraform:', error);
      return false;
    }
  }

  static async reinitializeTerraform(userId: string): Promise<boolean> {
    try {
      console.log('🔄 Reinicializando Terraform para nova execução...');
      
      const response = await fetch(`${this.backendUrl}/api/terraform/reinit`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        mode: 'cors',
        body: JSON.stringify({ userId: userId }),
        signal: AbortSignal.timeout(60000)
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Terraform reinicializado com sucesso!', result);
        return true;
      } else {
        const errorText = await response.text();
        console.warn(`⚠️ Aviso na reinicialização (${response.status}): ${errorText}`);
        return true; // Continua mesmo se reinit falhar
      }
    } catch (error) {
      console.warn('⚠️ Aviso ao reinicializar Terraform:', error);
      return true; // Continua mesmo se reinit falhar
    }
  }

  static async sendCredentials(userId: string, credentials: any): Promise<boolean> {
    try {
      console.log('📡 Enviando credenciais para o servidor externo...');
      
      const response = await fetch(`${this.backendUrl}/api/aws/credentials`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        mode: 'cors',
        body: JSON.stringify({ 
          userId: userId, 
          credentials: credentials 
        }),
        signal: AbortSignal.timeout(15000)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Falha ao enviar credenciais (${response.status}): ${errorText}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || 'Falha ao armazenar credenciais');
      }

      console.log('✅ Credenciais enviadas com sucesso!');
      return true;
    } catch (error) {
      console.error('❌ Erro ao enviar credenciais:', error);
      throw error;
    }
  }

  static getServerStatus(): boolean {
    return this.isServerRunning;
  }

  static getBackendUrl(): string {
    return this.backendUrl;
  }

  static reset(): void {
    this.isServerRunning = false;
    this.isInitialized = false;
    console.log('🔄 ServerManager resetado');
  }
}
