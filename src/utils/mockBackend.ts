
// Mock backend para simular o servidor quando não está disponível
export class MockBackend {
  static async simulateCredentialsStore(userId: string, credentials: any): Promise<void> {
    console.log(`[MOCK] Armazenando credenciais para userId: ${userId}`);
    // Simula o armazenamento em localStorage para fins de demonstração
    localStorage.setItem(`mock-credentials-${userId}`, JSON.stringify(credentials));
    await new Promise(resolve => setTimeout(resolve, 500));
    console.log(`[MOCK] ✓ Credenciais armazenadas com sucesso`);
  }

  static async simulateAWSDeployment(
    resources: any, 
    config: any, 
    auth: any,
    onLog: (message: string) => void
  ): Promise<void> {
    onLog("🔧 [SIMULAÇÃO] Iniciando deployment AWS simulado...\n");
    await new Promise(resolve => setTimeout(resolve, 1000));

    onLog("📋 [SIMULAÇÃO] Gerando arquivo Terraform...\n");
    await new Promise(resolve => setTimeout(resolve, 800));

    onLog("🚀 [SIMULAÇÃO] Executando terraform init...\n");
    onLog("Initializing the backend...\n");
    onLog("Initializing provider plugins...\n");
    await new Promise(resolve => setTimeout(resolve, 1500));

    onLog("✓ [SIMULAÇÃO] Terraform has been successfully initialized!\n\n");

    onLog("🏗️ [SIMULAÇÃO] Executando terraform apply --auto-approve...\n");
    
    // Simula a criação de recursos baseado na seleção
    const selectedResources = Object.entries(resources).filter(([_, selected]) => selected);
    
    for (const [resource, _] of selectedResources) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      switch (resource) {
        case 'vpc':
          onLog(`aws_vpc.main: Creating...\n`);
          await new Promise(resolve => setTimeout(resolve, 800));
          onLog(`aws_vpc.main: Creation complete after 2s [id=vpc-${Math.random().toString(36).substr(2, 8)}]\n`);
          break;
        case 'subnet':
          onLog(`aws_subnet.public: Creating...\n`);
          await new Promise(resolve => setTimeout(resolve, 600));
          onLog(`aws_subnet.public: Creation complete after 1s [id=subnet-${Math.random().toString(36).substr(2, 8)}]\n`);
          break;
        case 'securityGroup':
          onLog(`aws_security_group.web: Creating...\n`);
          await new Promise(resolve => setTimeout(resolve, 700));
          onLog(`aws_security_group.web: Creation complete after 1s [id=sg-${Math.random().toString(36).substr(2, 8)}]\n`);
          break;
        case 'internetGateway':
          onLog(`aws_internet_gateway.main: Creating...\n`);
          await new Promise(resolve => setTimeout(resolve, 500));
          onLog(`aws_internet_gateway.main: Creation complete after 1s [id=igw-${Math.random().toString(36).substr(2, 8)}]\n`);
          break;
        case 'ec2':
          onLog(`aws_instance.web: Creating...\n`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          onLog(`aws_instance.web: Still creating... [10s elapsed]\n`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          onLog(`aws_instance.web: Creation complete after 11s [id=i-${Math.random().toString(36).substr(2, 8)}]\n`);
          break;
      }
    }

    await new Promise(resolve => setTimeout(resolve, 500));
    onLog("\n🎉 [SIMULAÇÃO] Apply complete! Resources: " + selectedResources.length + " added, 0 changed, 0 destroyed.\n");
    onLog("\n✅ [SIMULAÇÃO] Deployment simulado concluído com sucesso!\n");
    onLog("\n💡 NOTA: Esta foi uma simulação. Para deployment real, inicie o servidor backend:\n");
    onLog("   cd backend && node server.js\n");
  }

  static async checkBackendHealth(url: string): Promise<boolean> {
    try {
      const response = await fetch(`${url}/health`, { 
        method: 'GET',
        timeout: 5000 
      } as any);
      return response.ok;
    } catch {
      return false;
    }
  }
}
