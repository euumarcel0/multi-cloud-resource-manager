
export class ServerManager {
  private static isServerRunning = false;
  private static isInitialized = false;
  private static backendUrl = 'https://ctq7dlxk-3001.brs.devtunnels.ms';

  static async startServer(): Promise<boolean> {
    console.log('🚀 Conectando ao servidor backend...');
    
    // Conecta diretamente ao servidor especificado
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
      const response = await fetch(`${this.backendUrl}/health`, { 
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      if (response.ok) {
        console.log(`🌐 Servidor encontrado em: ${this.backendUrl}`);
        return true;
      }
    } catch (error) {
      console.log(`❌ Servidor não encontrado em: ${this.backendUrl}`);
    }
    return false;
  }

  static async initializeTerraform(): Promise<boolean> {
    if (this.isInitialized) {
      console.log('✅ Terraform já foi inicializado');
      return true;
    }

    try {
      console.log('🔧 Inicializando Terraform...');
      
      const response = await fetch(`${this.backendUrl}/api/terraform/init`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        this.isInitialized = true;
        console.log('✅ Terraform inicializado com sucesso!');
        console.log('✅ Providers AWS e Azure configurados');
        return true;
      } else {
        throw new Error(`Falha na inicialização: ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Erro ao inicializar Terraform:', error);
      return false;
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
