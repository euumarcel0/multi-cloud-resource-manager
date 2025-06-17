import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Server, Play, RotateCcw, Eye, EyeOff, AlertCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { ServerManager } from "@/utils/serverManager";

interface SelectedResources {
  vpc: boolean;
  subnet: boolean;
  securityGroup: boolean;
  ec2: boolean;
  loadBalancer: boolean;
  internetGateway: boolean;
}

const AWSDeployment = () => {
  const { toast } = useToast();
  const { awsAuth, isServerRunning } = useAuth();
  const [isDeploying, setIsDeploying] = useState(false);
  const [showTerraform, setShowTerraform] = useState(false);
  const [deploymentLogs, setDeploymentLogs] = useState<string>("");
  const [hasExecuted, setHasExecuted] = useState(false);
  
  const [selectedResources, setSelectedResources] = useState<SelectedResources>({
    vpc: false,
    subnet: false,
    securityGroup: false,
    ec2: false,
    loadBalancer: false,
    internetGateway: false
  });

  const [config, setConfig] = useState({
    region: (awsAuth.credentials && 'region' in awsAuth.credentials) ? awsAuth.credentials.region : "us-east-1",
    vpcName: "vpc-production",
    vpcCidr: "10.0.0.0/16",
    subnetName: "public-subnet", 
    subnetCidr: "10.0.1.0/24",
    existingVpcId: "",
    instanceType: "t2.micro",
    keyPair: "my-keypair",
    sgName: "web-security-group",
    existingSubnetId: "",
    existingSecurityGroupId: ""
  });

  const handleResourceChange = (resource: keyof SelectedResources, checked: boolean) => {
    setSelectedResources(prev => ({ ...prev, [resource]: checked }));
  };

  const handleDeploy = async () => {
    if (!awsAuth.isAuthenticated || !awsAuth.credentials || !('accessKey' in awsAuth.credentials)) {
      toast({
        title: "Erro de Autenticação",
        description: "Você precisa fazer login na AWS primeiro.",
        variant: "destructive"
      });
      return;
    }

    if (!isServerRunning) {
      toast({
        title: "Servidor não está rodando",
        description: "Faça login novamente para conectar ao servidor backend.",
        variant: "destructive"
      });
      return;
    }

    const selectedCount = Object.values(selectedResources).filter(Boolean).length;
    if (selectedCount === 0) {
      toast({
        title: "Nenhum Recurso Selecionado",
        description: "Selecione pelo menos um recurso para criar.",
        variant: "destructive"
      });
      return;
    }

    setIsDeploying(true);
    setHasExecuted(true);
    setDeploymentLogs("🚀 Iniciando deployment AWS...\n");
    
    console.log("Iniciando deployment AWS...");

    try {
        const backendUrl = ServerManager.getBackendUrl();
        const userId = awsAuth.credentials.accessKey;
        
        setDeploymentLogs(prev => prev + "📡 Enviando credenciais para o backend...\n");

        // Enviar credenciais
        const credentialsResponse = await fetch(`${backendUrl}/api/aws/credentials`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                userId: userId, 
                credentials: awsAuth.credentials 
            }),
        });

        if (!credentialsResponse.ok) {
            throw new Error(`Falha ao enviar credenciais: ${credentialsResponse.status}`);
        }

        setDeploymentLogs(prev => prev + "✅ Credenciais enviadas com sucesso!\n");
        setDeploymentLogs(prev => prev + "🚀 Iniciando deployment...\n");

        // Iniciar deployment
        const response = await fetch(`${backendUrl}/api/aws/deploy`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                resources: selectedResources, 
                config, 
                auth: { userId: userId }
            }),
        });

        if (!response.ok) {
            throw new Error(`Falha na requisição de deployment: ${response.status}`);
        }

        // Processar logs em tempo real
        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error("Falha ao obter o leitor de resposta.");
        }

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const text = new TextDecoder().decode(value);
            const lines = text.split('\n').filter(line => line.trim());
            
            for (const line of lines) {
                try {
                    const data = JSON.parse(line);
                    if (data.type === 'log') {
                        setDeploymentLogs(prev => prev + data.message);
                    } else if (data.type === 'error') {
                        setDeploymentLogs(prev => prev + `\n❌ Erro: ${data.message}\n`);
                        toast({
                            title: "Deployment Falhou",
                            description: data.message,
                            variant: "destructive"
                        });
                    } else if (data.type === 'success') {
                        setDeploymentLogs(prev => prev + `\n✅ ${data.message}\n`);
                        toast({
                            title: "Deployment Completo",
                            description: data.message,
                        });
                    }
                } catch (parseError) {
                    setDeploymentLogs(prev => prev + line + '\n');
                }
            }
        }

    } catch (error) {
        console.error("Erro no deployment:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        setDeploymentLogs(prev => prev + `\n❌ Erro: ${errorMessage}\n`);
        
        toast({
            title: "Erro no Deployment",
            description: errorMessage,
            variant: "destructive"
        });
    } finally {
        setIsDeploying(false);
    }
  };

  const generateTerraformPreview = () => {
    let terraformCode = `terraform {
  required_version = ">=1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "5.42.0"
    }
  }
}

provider "aws" {
  region     = "${config.region}"
  access_key = var.access_key
  secret_key = var.secret_key
}

`;

    if (selectedResources.vpc) {
      terraformCode += `resource "aws_vpc" "main" {
  cidr_block = "${config.vpcCidr}"
  tags = {
    Name = "${config.vpcName}"
  }
}

`;
    }

    if (selectedResources.internetGateway) {
      terraformCode += `resource "aws_internet_gateway" "main" {
  vpc_id = ${selectedResources.vpc ? 'aws_vpc.main.id' : `"${config.existingVpcId}"`}
  tags = {
    Name = "main-igw"
  }
}

`;
    }

    if (selectedResources.subnet) {
      terraformCode += `resource "aws_subnet" "public" {
  vpc_id     = ${selectedResources.vpc ? 'aws_vpc.main.id' : `"${config.existingVpcId}"`}
  cidr_block = "${config.subnetCidr}"
  tags = {
    Name = "${config.subnetName}"
  }
}

`;
    }

    if (selectedResources.securityGroup) {
      const vpcReference = selectedResources.vpc ? 'aws_vpc.main.id' : `"${config.existingVpcId}"`;
      terraformCode += `resource "aws_security_group" "web" {
  name        = "${config.sgName}"
  description = "Security group for web servers"
  vpc_id      = ${vpcReference}

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${config.sgName}"
  }
}

`;
    }

    if (selectedResources.ec2) {
      let subnetRef = '';
      let securityGroupRef = '';
      
      if (selectedResources.subnet) {
        subnetRef = 'subnet_id     = aws_subnet.public.id';
      } else if (config.existingSubnetId) {
        subnetRef = `subnet_id     = "${config.existingSubnetId}"`;
      }
      
      if (selectedResources.securityGroup) {
        securityGroupRef = 'vpc_security_group_ids = [aws_security_group.web.id]';
      } else if (config.existingSecurityGroupId) {
        securityGroupRef = `vpc_security_group_ids = ["${config.existingSecurityGroupId}"]`;
      }

      terraformCode += `resource "aws_instance" "web" {
  ami           = "ami-0c02fb55956c7d316"
  instance_type = "${config.instanceType}"
  key_name      = "${config.keyPair}"
  ${subnetRef}
  ${securityGroupRef}
  
  tags = {
    Name = "web-server"
  }
}

`;
    }

    return terraformCode;
  };

  if (!awsAuth.isAuthenticated) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                <Server className="h-5 w-5 text-white" />
              </div>
              <span>AWS Deployment</span>
            </h2>
            <p className="text-gray-600 mt-1">Configure and deploy your AWS infrastructure</p>
          </div>
        </div>

        <Card className="border-0 shadow-lg">
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center space-y-4">
              <AlertCircle className="h-12 w-12 text-orange-500 mx-auto" />
              <h3 className="text-xl font-semibold text-gray-900">Autenticação Necessária</h3>
              <p className="text-gray-600 max-w-md">
                Você precisa fazer login na AWS com suas credenciais para acessar os recursos de deployment.
              </p>
              <p className="text-sm text-gray-500">
                Clique no botão de login AWS na barra lateral para continuar.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const resourcesList = [
    { key: 'vpc' as keyof SelectedResources, name: 'VPC', description: 'Virtual Private Cloud' },
    { key: 'internetGateway' as keyof SelectedResources, name: 'Internet Gateway', description: 'Conecta VPC à internet' },
    { key: 'subnet' as keyof SelectedResources, name: 'Subnet', description: 'Sub-rede dentro da VPC' },
    { key: 'securityGroup' as keyof SelectedResources, name: 'Security Group', description: 'Firewall virtual' },
    { key: 'ec2' as keyof SelectedResources, name: 'EC2 Instance', description: 'Máquina virtual' },
    { key: 'loadBalancer' as keyof SelectedResources, name: 'Load Balancer', description: 'Distribuidor de carga' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
              <Server className="h-5 w-5 text-white" />
            </div>
            <span>AWS Deployment</span>
          </h2>
          <p className="text-gray-600 mt-1">Selecione e configure os recursos AWS que deseja criar</p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="secondary" className="bg-green-100 text-green-700">
            Autenticado
          </Badge>
          <Badge variant="secondary" className={isServerRunning ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
            Server: {isServerRunning ? "Online" : "Offline"}
          </Badge>
          <Badge variant="secondary" className="bg-orange-100 text-orange-700">
            Provider: AWS
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Resource Selection */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Seleção de Recursos</CardTitle>
            <CardDescription>
              Escolha quais recursos AWS você deseja criar
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {resourcesList.map((resource) => (
              <div key={resource.key} className="flex items-center space-x-3 p-3 border rounded-lg">
                <Checkbox
                  id={resource.key}
                  checked={selectedResources[resource.key]}
                  onCheckedChange={(checked) => handleResourceChange(resource.key, checked as boolean)}
                />
                <div className="flex-1">
                  <Label htmlFor={resource.key} className="text-sm font-medium">
                    {resource.name}
                  </Label>
                  <p className="text-xs text-gray-500">{resource.description}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Configuration Panel */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Configuração</CardTitle>
            <CardDescription>
              Configure os parâmetros dos recursos selecionados
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="region">AWS Region</Label>
                <Input
                  id="region"
                  value={config.region}
                  onChange={(e) => setConfig({ ...config, region: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="instanceType">Instance Type</Label>
                <Input
                  id="instanceType"
                  value={config.instanceType}
                  onChange={(e) => setConfig({ ...config, instanceType: e.target.value })}
                  disabled={!selectedResources.ec2}
                />
              </div>
            </div>
            
            {selectedResources.vpc && (
              <div className="space-y-3 p-3 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-900">Configuração VPC</h4>
                <div>
                  <Label htmlFor="vpcName">Nome da VPC</Label>
                  <Input
                    id="vpcName"
                    value={config.vpcName}
                    onChange={(e) => setConfig({ ...config, vpcName: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="vpcCidr">CIDR Block</Label>
                  <Input
                    id="vpcCidr"
                    value={config.vpcCidr}
                    onChange={(e) => setConfig({ ...config, vpcCidr: e.target.value })}
                  />
                </div>
              </div>
            )}

            {selectedResources.subnet && (
              <div className="space-y-3 p-3 bg-green-50 rounded-lg">
                <h4 className="font-medium text-green-900">Configuração Subnet</h4>
                <div>
                  <Label htmlFor="subnetName">Nome da Subnet</Label>
                  <Input
                    id="subnetName"
                    value={config.subnetName}
                    onChange={(e) => setConfig({ ...config, subnetName: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="subnetCidr">CIDR Block</Label>
                  <Input
                    id="subnetCidr"
                    value={config.subnetCidr}
                    onChange={(e) => setConfig({ ...config, subnetCidr: e.target.value })}
                  />
                </div>
                {!selectedResources.vpc && (
                  <div>
                    <Label htmlFor="existingVpcId">ID da VPC Existente</Label>
                    <Input
                      id="existingVpcId"
                      value={config.existingVpcId}
                      onChange={(e) => setConfig({ ...config, existingVpcId: e.target.value })}
                      placeholder="vpc-xxxxxxxxx"
                    />
                  </div>
                )}
              </div>
            )}

            {selectedResources.securityGroup && (
              <div className="space-y-3 p-3 bg-purple-50 rounded-lg">
                <h4 className="font-medium text-purple-900">Configuração Security Group</h4>
                <div>
                  <Label htmlFor="sgName">Nome do Security Group</Label>
                  <Input
                    id="sgName"
                    value={config.sgName}
                    onChange={(e) => setConfig({ ...config, sgName: e.target.value })}
                  />
                </div>
                {!selectedResources.vpc && (
                  <div>
                    <Label htmlFor="existingVpcIdSg">ID da VPC Existente</Label>
                    <Input
                      id="existingVpcIdSg"
                      value={config.existingVpcId}
                      onChange={(e) => setConfig({ ...config, existingVpcId: e.target.value })}
                      placeholder="vpc-xxxxxxxxx"
                    />
                  </div>
                )}
              </div>
            )}

            {selectedResources.ec2 && (
              <div className="space-y-3 p-3 bg-orange-50 rounded-lg">
                <h4 className="font-medium text-orange-900">Configuração EC2</h4>
                <div>
                  <Label htmlFor="keyPair">Key Pair Name</Label>
                  <Input
                    id="keyPair"
                    value={config.keyPair}
                    onChange={(e) => setConfig({ ...config, keyPair: e.target.value })}
                  />
                </div>
                {!selectedResources.subnet && (
                  <div>
                    <Label htmlFor="existingSubnetId">ID da Subnet Existente</Label>
                    <Input
                      id="existingSubnetId"
                      value={config.existingSubnetId}
                      onChange={(e) => setConfig({ ...config, existingSubnetId: e.target.value })}
                      placeholder="subnet-xxxxxxxxx"
                    />
                  </div>
                )}
                {!selectedResources.securityGroup && (
                  <div>
                    <Label htmlFor="existingSecurityGroupId">ID do Security Group Existente</Label>
                    <Input
                      id="existingSecurityGroupId"
                      value={config.existingSecurityGroupId}
                      onChange={(e) => setConfig({ ...config, existingSecurityGroupId: e.target.value })}
                      placeholder="sg-xxxxxxxxx"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="flex space-x-2 pt-4">
              <Button 
                onClick={handleDeploy} 
                disabled={isDeploying}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {isDeploying ? (
                  <>
                    <RotateCcw className="h-4 w-4 mr-2 animate-spin" />
                    Executando terraform apply...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Deploy Infrastructure
                  </>
                )}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowTerraform(!showTerraform)}
              >
                {showTerraform ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                {showTerraform ? 'Ocultar' : 'Ver'} Terraform
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Terraform Code Preview */}
      {showTerraform && (
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Preview do Código Terraform</CardTitle>
            <CardDescription>
              Código que será executado baseado na sua seleção
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
              <pre className="text-green-400 text-sm font-mono whitespace-pre-wrap">
                {generateTerraformPreview()}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Selected Resources Summary */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Recursos Selecionados</CardTitle>
          <CardDescription>
            Resumo dos recursos que serão criados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {Object.entries(selectedResources).map(([key, selected]) => {
              if (!selected) return null;
              const resource = resourcesList.find(r => r.key === key);
              return (
                <Badge key={key} className="bg-orange-100 text-orange-700">
                  {resource?.name}
                </Badge>
              );
            })}
            {Object.values(selectedResources).every(v => !v) && (
              <p className="text-gray-500 text-sm">Nenhum recurso selecionado</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Deployment Logs - Sempre visível após primeira execução */}
      {hasExecuted && (
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Logs de Execução</span>
              <div className="flex items-center space-x-2">
                {isDeploying && (
                  <div className="flex items-center space-x-2">
                    <RotateCcw className="h-4 w-4 animate-spin text-blue-500" />
                    <span className="text-sm text-blue-600">
                      Executando terraform apply...
                    </span>
                  </div>
                )}
                {!isDeploying && deploymentLogs && (
                  <Badge className="bg-green-100 text-green-700">
                    Concluído
                  </Badge>
                )}
              </div>
            </CardTitle>
            <CardDescription>
              Logs do deployment AWS
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-black rounded-lg p-4 h-96 overflow-y-auto">
              <pre className="text-green-400 text-sm font-mono whitespace-pre-wrap">
                {deploymentLogs || "Aguardando execução..."}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AWSDeployment;
