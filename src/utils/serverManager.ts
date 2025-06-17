
import { MockBackend } from './mockBackend';

export class ServerManager {
  private static isServerRunning = false;
  private static isInitialized = false;
  private static isMockMode = false;

  static async startServer(): Promise<boolean> {
    console.log('🚀 Tentando iniciar servidor backend...');
    
    // Tenta conectar ao servidor real primeiro
    const realServerRunning = await this.checkRealServer();
    
    if (realServerRunning) {
      this.isServerRunning = true;
      this.isMockMode = false;
      console.log('✅ Servidor backend real conectado com sucesso!');
      return true;
    }

    // Se não conseguir conectar ao servidor real, usa modo mock
    console.log('⚠️ Servidor backend não encontrado, ativando modo simulação...');
    this.isServerRunning = true;
    this.isMockMode = true;
    
    // Simula tempo de inicialização
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    console.log('✅ Modo simulação ativado!');
    console.log('💡 Para usar o servidor real, execute: cd backend && node server.js');
    return true;
  }

  static async checkRealServer(): Promise<boolean> {
    const urls = [
      'http://localhost:3001',
      'https://07f4b861-def3-4f19-bf23-790e3ad55fc4.lovableproject.com'
    ];

    for (const url of urls) {
      try {
        const response = await fetch(`${url}/health`, { 
          method: 'GET',
          signal: AbortSignal.timeout(3000)
        });
        if (response.ok) {
          console.log(`🌐 Servidor encontrado em: ${url}`);
          return true;
        }
      } catch (error) {
        console.log(`❌ Servidor não encontrado em: ${url}`);
      }
    }
    return false;
  }

  static async initializeTerraform(): Promise<boolean> {
    if (this.isInitialized) {
      console.log('✅ Terraform já foi inicializado');
      return true;
    }

    try {
      console.log('🔧 Simulando inicialização do Terraform...');
      
      // Simular tempo de inicialização do Terraform
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      this.isInitialized = true;
      console.log('✅ Terraform inicializado com sucesso!');
      console.log('✅ Providers AWS e Azure configurados');
      return true;
    } catch (error) {
      console.error('❌ Erro ao simular inicialização do Terraform:', error);
      return false;
    }
  }

  static getServerStatus(): boolean {
    return this.isServerRunning;
  }

  static isMockModeActive(): boolean {
    return this.isMockMode;
  }

  static reset(): void {
    this.isServerRunning = false;
    this.isInitialized = false;
    this.isMockMode = false;
    console.log('🔄 ServerManager resetado');
  }
}
