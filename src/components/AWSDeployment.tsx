import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Server, Play, RotateCcw, Eye, EyeOff, AlertCircle, Info } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { ServerManager } from "@/utils/serverManager";

interface SelectedResources {
  vpc: boolean;
  subnet: boolean;
  securityGroup: boolean;
  ec2: boolean;
  internetGateway: boolean;
}

const AWSDeployment = () => {
  const { toast } = useToast();
  const { awsAuth, isServerRunning } = useAuth();
  const [isDeploying, setIsDeploying] = useState(false);
  const [showTerraform, setShowTerraform] = useState(false);
  const [deploymentLogs, setDeploymentLogs] = useState<string>("");
  
  const [selectedResources, setSelectedResources] = useState<SelectedResources>({
    vpc: false,
    subnet: false,
    securityGroup: false,
    ec2: false,
    internetGateway: false
  });

  const [config, setConfig] = useState({
    // VPC Config
    vpcName: "main-vpc",
    vpcCidr: "10.0.0.0/16",
    
    // Subnet Config
    subnetName: "main-subnet",
    subnetCidr: "10.0.1.0/24",
    
    // EC2 Config - Updated for Windows
    instanceType: "t3.medium", // Changed from t2.micro for Windows
    instanceName: "windows-server",
    ssmEnabled: true, // SSM instead of SSH keys
    
    // Security Group Config
    sgName: "windows-sg",
    
    // Existing Resources
    existingVpcId: "",
    existingSubnetId: "",
    existingSecurityGroupId: ""
  });

  const handleResourceChange = (resource: keyof SelectedResources, checked: boolean) => {
    setSelectedResources(prev => ({ ...prev, [resource]: checked }));
  };

  // Helper function to clean ANSI codes from logs
  const cleanAnsiCodes = (text: string) => {
    return text.replace(/\x1b\[[0-9;]*[mGK]/g, '');
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
    setDeploymentLogs("🚀 Iniciando deployment AWS...\n");
    
    console.log("Iniciando deployment AWS...");

    try {
        const backendUrl = ServerManager.getBackendUrl();
        const userId = awsAuth.credentials.accessKey;
        
        setDeploymentLogs(prev => prev + "📡 Enviando credenciais para o servidor externo...\n");

        if (!awsAuth.credentials.accessKey || !awsAuth.credentials.secretKey || !awsAuth.credentials.region) {
            throw new Error('Credenciais AWS incompletas. Verifique se Access Key, Secret Key e Region estão preenchidos.');
        }

        setDeploymentLogs(prev => prev + "🔄 Preparando Terraform para nova execução...\n");
        
        try {
          await ServerManager.reinitializeTerraform(userId);
          setDeploymentLogs(prev => prev + "✅ Terraform preparado com sucesso!\n");
        } catch (reinitError) {
          console.log("Aviso: Falha na reinicialização do Terraform, continuando...");
          setDeploymentLogs(prev => prev + "⚠️  Terraform já estava inicializado, continuando...\n");
        }

        await ServerManager.sendCredentials(userId, awsAuth.credentials);

        setDeploymentLogs(prev => prev + "✅ Credenciais enviadas com sucesso!\n");
        setDeploymentLogs(prev => prev + "🚀 Iniciando deployment...\n");

        const deploymentPayload = { 
            resources: selectedResources, 
            config: config, 
            auth: { userId: userId },
            storeConfig: true // Flag to store Terraform config instead of deleting
        };

        console.log('Payload de deployment:', deploymentPayload);

        const response = await fetch(`${backendUrl}/api/aws/deploy`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            mode: 'cors',
            body: JSON.stringify(deploymentPayload),
            signal: AbortSignal.timeout(300000)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Falha na requisição de deployment (${response.status}): ${errorText}`);
        }

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
                        const cleanedMessage = cleanAnsiCodes(data.message);
                        setDeploymentLogs(prev => prev + cleanedMessage);
                    } else if (data.type === 'error') {
                        const cleanedMessage = cleanAnsiCodes(data.message);
                        setDeploymentLogs(prev => prev + `\n❌ Erro: ${cleanedMessage}\n`);
                        toast({
                            title: "Deployment Falhou",
                            description: cleanedMessage,
                            variant: "destructive"
                        });
                    } else if (data.type === 'success') {
                        const cleanedMessage = cleanAnsiCodes(data.message);
                        setDeploymentLogs(prev => prev + `\n✅ ${cleanedMessage}\n`);
                        if (data.resources) {
                          setDeploymentLogs(prev => prev + `\n📋 Recursos criados:\n${data.resources.map((r: any) => `• ${r.type}: ${r.id}`).join('\n')}\n`);
                        }
                        toast({
                            title: "Deployment Completo",
                            description: "Recursos criados com sucesso! Terraform configuração salva.",
                        });
                    }
                } catch (parseError) {
                    const cleanedLine = cleanAnsiCodes(line);
                    setDeploymentLogs(prev => prev + cleanedLine + '\n');
                }
            }
        }

    } catch (error) {
        console.error("Erro no deployment:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        if (error instanceof TypeError && error.message.includes('fetch')) {
            const networkError = `Erro de conexão com o backend em: ${ServerManager.getBackendUrl()}`;
            setDeploymentLogs(prev => prev + `\n❌ ${networkError}\n`);
            toast({
                title: "Erro de Conexão",
                description: networkError,
                variant: "destructive"
            });
        } else {
            setDeploymentLogs(prev => prev + `\n❌ Erro: ${errorMessage}\n`);
            toast({
                title: "Erro no Deployment",
                description: errorMessage,
                variant: "destructive"
            });
        }
    } finally {
        setIsDeploying(false);
    }
  };

  const generateTerraformPreview = () => {
    let code = `terraform {
  required_version = ">=1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "5.42.0"
    }
  }
}

provider "aws" {
  region = var.region
  access_key = var.access_key
  secret_key = var.secret_key
}

`;

    // Only generate code for selected resources
    if (selectedResources.vpc) {
        code += `
resource "aws_vpc" "main" {
  cidr_block = "${config.vpcCidr}"
  tags = {
    Name = "${config.vpcName}"
  }
}
`;
    }

    if (selectedResources.internetGateway) {
        code += `
resource "aws_internet_gateway" "main" {
  vpc_id = ${selectedResources.vpc ? 'aws_vpc.main.id' : `"${config.existingVpcId}"`}
  tags = {
    Name = "main-igw"
  }
}
`;
    }

    if (selectedResources.subnet) {
        code += `
resource "aws_subnet" "public" {
  vpc_id     = ${selectedResources.vpc ? 'aws_vpc.main.id' : `"${config.existingVpcId}"`}
  cidr_block = "${config.subnetCidr}"
  tags = {
    Name = "${config.subnetName}"
  }
}
`;
    }

    if (selectedResources.securityGroup) {
        code += `
resource "aws_security_group" "windows" {
  name        = "${config.sgName}"
  description = "Security group for Windows servers with RDP and SSM"
  vpc_id      = ${selectedResources.vpc ? 'aws_vpc.main.id' : `"${config.existingVpcId}"`}

  ingress {
    from_port   = 3389
    to_port     = 3389
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "RDP access"
  }

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTP access"
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS access"
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
        if (selectedResources.subnet) {
            subnetRef = 'subnet_id     = aws_subnet.public.id';
        } else if (config.existingSubnetId) {
            subnetRef = `subnet_id     = "${config.existingSubnetId}"`;
        }

        let securityGroupRef = '';
        if (selectedResources.securityGroup) {
            securityGroupRef = 'vpc_security_group_ids = [aws_security_group.windows.id]';
        } else if (config.existingSecurityGroupId) {
            securityGroupRef = `vpc_security_group_ids = ["${config.existingSecurityGroupId}"]`;
        }

        code += `
# IAM role for SSM
resource "aws_iam_role" "ssm_role" {
  name = "EC2-SSM-Role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ssm_policy" {
  role       = aws_iam_role.ssm_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "ssm_profile" {
  name = "EC2-SSM-Profile"
  role = aws_iam_role.ssm_role.name
}

resource "aws_instance" "windows" {
  ami           = "ami-0c02fb55956c7d316" # Windows Server 2022
  instance_type = "${config.instanceType}"
  ${subnetRef}
  ${securityGroupRef}
  iam_instance_profile = aws_iam_instance_profile.ssm_profile.name

  user_data = <<-EOF
              <powershell>
              # Install SSM Agent (usually pre-installed on Windows AMIs)
              # Configure Windows for remote management
              Enable-PSRemoting -Force
              Set-Item WSMan:\\localhost\\Client\\TrustedHosts -Value "*" -Force
              </powershell>
              EOF

  tags = {
    Name = "${config.instanceName}"
    OS = "Windows"
    SSM = "Enabled"
  }
}
`;
    }

    return code;
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
    { key: 'subnet' as keyof SelectedResources, name: 'Subnet', description: 'Sub-rede pública' },
    { key: 'securityGroup' as keyof SelectedResources, name: 'Security Group', description: 'Firewall para Windows (RDP + HTTP/HTTPS)' },
    { key: 'ec2' as keyof SelectedResources, name: 'Windows EC2', description: 'Instância Windows Server com SSM' }
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
          <p className="text-gray-600 mt-1">Configure e implante sua infraestrutura AWS</p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="secondary" className="bg-green-100 text-green-700">
            Autenticado
          </Badge>
          <Badge variant="secondary" className={isServerRunning ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
            Server: {isServerRunning ? "Online" : "Offline"}
          </Badge>
        </div>
      </div>

      {/* Windows Alert */}
      <Card className="border-orange-200 bg-orange-50">
        <CardContent className="flex items-start space-x-3 p-4">
          <Info className="h-5 w-5 text-orange-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-orange-900">Instâncias Windows com SSM</h4>
            <p className="text-sm text-orange-700 mt-1">
              As instâncias EC2 serão criadas com Windows Server e habilitadas para SSM (Systems Manager) para gerenciamento remoto seguro. 
              Não é necessário configurar chaves SSH. Use o Session Manager da AWS para acesso via console.
            </p>
          </div>
        </CardContent>
      </Card>

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
              </div>
            )}

            {selectedResources.securityGroup && (
              <div className="space-y-3 p-3 bg-purple-50 rounded-lg">
                <h4 className="font-medium text-purple-900">Security Group</h4>
                <div>
                  <Label htmlFor="sgName">Nome do Security Group</Label>
                  <Input
                    id="sgName"
                    value={config.sgName}
                    onChange={(e) => setConfig({ ...config, sgName: e.target.value })}
                  />
                </div>
                <p className="text-xs text-purple-700">
                  Configurado automaticamente para Windows: RDP (3389), HTTP (80), HTTPS (443)
                </p>
              </div>
            )}

            {selectedResources.ec2 && (
              <div className="space-y-3 p-3 bg-orange-50 rounded-lg">
                <h4 className="font-medium text-orange-900">Configuração Windows EC2</h4>
                <div>
                  <Label htmlFor="instanceName">Nome da Instância</Label>
                  <Input
                    id="instanceName"
                    value={config.instanceName}
                    onChange={(e) => setConfig({ ...config, instanceName: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="instanceType">Tipo da Instância</Label>
                  <Select 
                    value={config.instanceType}
                    onValueChange={(value) => setConfig({ ...config, instanceType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="t3.medium">t3.medium (Recomendado para Windows)</SelectItem>
                      <SelectItem value="t3.large">t3.large</SelectItem>
                      <SelectItem value="t3.xlarge">t3.xlarge</SelectItem>
                      <SelectItem value="m5.large">m5.large</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-orange-700">
                  ✅ SSM habilitado automaticamente - Não requer chaves SSH
                </p>
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

      {/* Deployment Logs */}
      {deploymentLogs && (
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Logs de Execução</span>
              {isDeploying && (
                <div className="flex items-center space-x-2">
                  <RotateCcw className="h-4 w-4 animate-spin text-blue-500" />
                  <span className="text-sm text-blue-600">
                    Executando terraform apply...
                  </span>
                </div>
              )}
            </CardTitle>
            <CardDescription>
              Logs do deployment AWS em tempo real
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-black rounded-lg p-4 h-96 overflow-y-auto">
              <pre className="text-green-400 text-sm font-mono whitespace-pre-wrap">
                {deploymentLogs}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AWSDeployment;
